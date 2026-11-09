/**
 * Index Librorum Prohibitorum 1877 — overlap check (READ-ONLY).
 *
 * For every importable stage-1 row (LLM class book/blanket with a ban year) it
 * asks the standard matcher (matchExistingBook: exact slug → fuzzy) for an
 * existing book, then checks the matched book's authors against the entry's
 * author, because Latin generic titles ("Opera", "Fabulae", "Tractatus de …")
 * slug-collide with unrelated books. Authors are matched on slug of the
 * LLM-normalised name. VA books in the DB are compared with the decree year.
 *
 *   npx tsx --env-file=.env.local scripts/_audit_index_1877_overlap.ts [--date=2026-11-09]
 *   → data/index-1877/overlap-<date>.json + overlap-<date>.md
 *
 * --authors: second, fast pass (no matcher calls). The title matcher misses
 * cross-language pairs ("Du contract social" vs "The Social Contract" /
 * "Du contrat social"), so for every row whose author resolves to an existing
 * author (slug of the LLM name, or Latinised surname stem + first initial) it
 * lists that author's books with a title-similarity score for manual review.
 *   → data/index-1877/author-overlap-<date>.md
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { matchExistingBook } from '../src/lib/imports/verifier'
import { slugify } from '../src/lib/imports/slugify'
import { flagValue, hasFlag } from './lib/cli'

const DATE = flagValue('date') ?? new Date().toISOString().slice(0, 10)
const IN = `data/index-1877/stage1-${DATE}.json`
const CONCURRENCY = 4

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
// Latinised surname stem: Lutherus → luther, Grotius → grot, Abaelardus → abaelard
const stem = (s: string) => fold(s).replace(/(ius|us|ii|i|e|o)$/, '')
const lastName = (n: string) => n.replace(/,.*$/, '').trim().split(/\s+/).pop() ?? ''

type Row = any

async function fetchAll<T>(table: string, cols: string): Promise<T[]> {
  const sb = adminClient()
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).order('id').range(from, from + 999)
    if (error) throw error
    out.push(...(data as T[]))
    if (!data || data.length < 1000) return out
  }
}

const words = (t: string) => new Set(fold2(t).split(' ').filter(w => w.length >= 4))
const fold2 = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
function sim(a: string, b: string) {
  const A = words(a), B = words(b)
  if (!A.size || !B.size) return 0
  let n = 0
  for (const w of A) if ([...B].some(x => x.slice(0, 5) === w.slice(0, 5))) n++
  return n / Math.min(A.size, B.size)
}

async function authorsPass() {
  const rows: Row[] = JSON.parse(readFileSync(IN, 'utf8'))
  const cand = rows.filter(r => r.llm && (r.llm.class === 'book' || r.llm.class === 'blanket') && r.year != null && r.llm.author)
  const authors = await fetchAll<{ id: number; slug: string; display_name: string }>('authors', 'id, slug, display_name')
  const bySlug = new Map(authors.map(a => [a.slug, a]))
  const byKey = new Map<string, typeof authors>()
  const key = (n: string) => `${stem(lastName(n))}|${fold(n).slice(0, 1)}`
  for (const a of authors) { const k = key(a.display_name); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k)!.push(a) }
  const hit = new Map<number, { a: (typeof authors)[number]; how: string }[]>()
  for (const r of cand) {
    const exact = bySlug.get(slugify(r.llm.author))
    const list = exact ? [{ a: exact, how: 'slug' }] : (stem(lastName(r.llm.author)).length >= 4 ? (byKey.get(key(r.llm.author)) ?? []).map(a => ({ a, how: 'stem' })) : [])
    if (list.length) hit.set(r.seq, list)
  }
  const authorIds = [...new Set([...hit.values()].flat().map(h => h.a.id))]
  const sb = adminClient()
  const booksOf = new Map<number, any[]>()
  for (let k = 0; k < authorIds.length; k += 200) {
    const { data, error } = await sb.from('book_authors')
      .select('author_id, books(id, title, title_english_meaningful, is_blanket_works, bans(country_code, year_started))')
      .in('author_id', authorIds.slice(k, k + 200)).order('book_id')
    if (error) throw error
    for (const x of data as any[]) { if (!booksOf.has(x.author_id)) booksOf.set(x.author_id, []); booksOf.get(x.author_id)!.push(x.books) }
  }
  const out: string[] = [`# Index 1877 — author-based overlap (${DATE})`, '']
  let rowsWithAuthor = 0, likely = 0, blanketHit = 0
  const likelyRows: string[] = [], authorOnly = new Map<string, number>()
  for (const r of cand) {
    const hs = hit.get(r.seq)
    if (!hs) continue
    rowsWithAuthor++
    const books = hs.flatMap(h => (booksOf.get(h.a.id) ?? []).map(b => ({ ...b, author: h.a.display_name, author_id: h.a.id, how: h.how })))
    if (r.llm.class === 'blanket') { blanketHit++; authorOnly.set(`${hs[0].a.display_name} #${hs[0].a.id}`, (authorOnly.get(`${hs[0].a.display_name} #${hs[0].a.id}`) ?? 0) + 1); continue }
    const scored = books.map(b => ({ b, s: Math.max(sim(r.llm.title, b.title), b.title_english_meaningful ? sim(r.llm.title, b.title_english_meaningful) : 0) }))
      .filter(x => x.s >= 0.5).sort((x, y) => y.s - x.s)
    if (scored.length) {
      likely++
      const b = scored[0].b
      const va = (b.bans ?? []).filter((x: any) => x.country_code === 'VA').map((x: any) => x.year_started)
      likelyRows.push(`- seq ${r.seq} "${r.llm.title}" (${r.llm.author}, ${r.year} ${r.year_basis}) → #${b.id} ${b.title} [${b.author}, ${b.how}] sim ${scored[0].s.toFixed(2)}${va.length ? ' · VA ' + va.join('/') : ''}`)
    } else {
      const k = `${hs[0].a.display_name} #${hs[0].a.id}`
      authorOnly.set(k, (authorOnly.get(k) ?? 0) + 1)
    }
  }
  const summary = { rows_with_author: cand.length, rows_author_resolves: rowsWithAuthor, likely_same_work: likely, blanket_rows_existing_author: blanketHit, existing_authors_hit: authorIds.length }
  console.log(summary)
  out.push('```', JSON.stringify(summary, null, 1), '```', '', '## Likely same work (title sim ≥ 0.5, same author) — review', ...likelyRows,
    '', '## Existing author, no matching title (new book or blanket under existing author)', ...[...authorOnly].sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${k}: ${n}`))
  writeFileSync(`data/index-1877/author-overlap-${DATE}.md`, out.join('\n'))
  console.log(`→ data/index-1877/author-overlap-${DATE}.md`)
}

async function main() {
  if (hasFlag('authors')) return authorsPass()
  const sb = adminClient()
  const rows: Row[] = JSON.parse(readFileSync(IN, 'utf8'))
  const cand = rows.filter(r => r.llm && (r.llm.class === 'book' || r.llm.class === 'blanket') && r.year != null)
  console.log(`candidates: ${cand.length} (book ${cand.filter(r => r.llm.class === 'book').length}, blanket ${cand.filter(r => r.llm.class === 'blanket').length})`)

  // --- authors -------------------------------------------------------------
  const authors = await fetchAll<{ id: number; slug: string; display_name: string }>('authors', 'id, slug, display_name')
  const bySlug = new Map(authors.map(a => [a.slug, a]))
  const names = [...new Set(cand.map(r => r.llm.author).filter(Boolean))] as string[]
  const authorHit = new Map<string, { id: number; display_name: string }>()
  for (const n of names) {
    const a = bySlug.get(slugify(n))
    if (a) authorHit.set(n, a)
  }
  console.log(`authors: ${names.length} distinct LLM names, ${authorHit.size} exact slug hits in ${authors.length} authors`)

  // --- books ---------------------------------------------------------------
  const books = cand.filter(r => r.llm.class === 'book' && r.llm.title)
  const matches: { seq: number; id: number; status: string; confidence: number | null }[] = []
  let i = 0
  async function worker() {
    for (;;) {
      const r = books[i++]
      if (!r) return
      try {
        const m = await matchExistingBook({ title: r.llm.title })
        if (m) matches.push({ seq: r.seq, ...m })
      } catch (e) {
        console.error(`#${r.seq}: ${String(e).slice(0, 120)}`)
      }
      if (i % 500 === 0) console.log(`  ${i}/${books.length}, ${matches.length} matches`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  // Details of matched books: title, authors, VA bans.
  const ids = [...new Set(matches.map(m => m.id))]
  const detail = new Map<number, any>()
  for (let k = 0; k < ids.length; k += 200) {
    const { data, error } = await sb.from('books')
      .select('id, title, slug, first_published_year, is_blanket_works, book_authors(authors(id, display_name)), bans(country_code, year_started)')
      .in('id', ids.slice(k, k + 200))
    if (error) throw error
    for (const b of data ?? []) detail.set(b.id, b)
  }
  const bySeq = new Map(rows.map(r => [r.seq, r]))
  const matched = matches.map(m => {
    const r = bySeq.get(m.seq)!
    const b = detail.get(m.id)
    const bAuthors: string[] = (b?.book_authors ?? []).map((x: any) => x.authors?.display_name).filter(Boolean)
    const want = [r.llm.author, r.headword].filter(Boolean).map((n: string) => stem(lastName(n)))
    const authorAgrees = r.llm.author == null
      ? bAuthors.length === 0
      : bAuthors.some(n => { const s = stem(lastName(n)); return want.some(w => w.length >= 3 && (s.startsWith(w) || w.startsWith(s))) })
    const va = (b?.bans ?? []).filter((x: any) => x.country_code === 'VA')
    return {
      seq: m.seq, status: m.status, confidence: m.confidence,
      index_author: r.llm.author, index_title: r.llm.title, decree: r.year, year_basis: r.year_basis,
      book_id: m.id, book_title: b?.title, book_authors: bAuthors, book_fpy: b?.first_published_year,
      author_agrees: authorAgrees, va_years: va.map((x: any) => x.year_started),
    }
  })

  // --- VA side ---------------------------------------------------------------
  const { data: vaBans, error } = await sb.from('bans')
    .select('id, year_started, book_id, books(id, title, book_authors(authors(display_name)))').eq('country_code', 'VA').order('id')
  if (error) throw error
  const vaMatchedBooks = new Set(matched.filter(m => m.author_agrees).map(m => m.book_id))
  const vaUnmatched = (vaBans ?? []).filter(v => !vaMatchedBooks.has(v.book_id)).map((v: any) => ({
    book_id: v.book_id, title: v.books?.title, year: v.year_started,
    authors: (v.books?.book_authors ?? []).map((x: any) => x.authors?.display_name),
  }))

  const good = matched.filter(m => m.author_agrees)
  const suspect = matched.filter(m => !m.author_agrees)
  const yearDiff = good.filter(m => m.va_years.length && !m.va_years.includes(m.decree))
  const summary = {
    candidates: cand.length,
    books_sent: books.length,
    book_matches: matched.length,
    author_confirmed: good.length,
    title_only_suspect: suspect.length,
    confirmed_with_va_ban: good.filter(m => m.va_years.length).length,
    confirmed_without_va_ban: good.filter(m => !m.va_years.length).length,
    va_year_differs: yearDiff.length,
    va_books_not_found_in_1877: vaUnmatched.length,
    distinct_llm_authors: names.length,
    authors_existing_exact: authorHit.size,
  }
  console.log(summary)
  writeFileSync(`data/index-1877/overlap-${DATE}.json`, JSON.stringify({
    summary, matched, va_unmatched: vaUnmatched,
    authors_existing: [...authorHit].map(([n, a]) => ({ name: n, id: a.id, display_name: a.display_name })),
  }, null, 1))
  const md = [
    `# Index 1877 overlap (${DATE})`, '', '```', JSON.stringify(summary, null, 1), '```', '',
    '## VA year differs (author-confirmed)', ...yearDiff.map(m => `- #${m.book_id} ${m.book_title} — VA ${m.va_years.join('/')} vs 1877 ${m.decree} (${m.year_basis}) · seq ${m.seq}`),
    '', '## Author-confirmed matches', ...good.map(m => `- seq ${m.seq} "${m.index_title}" (${m.index_author ?? 'anon'}, ${m.decree}) → #${m.book_id} ${m.book_title} [${m.book_authors.join('; ')}] ${m.status}${m.va_years.length ? ' · VA ' + m.va_years.join('/') : ''}`),
    '', '## Title-only (author disagrees — do NOT attach)', ...suspect.map(m => `- seq ${m.seq} "${m.index_title}" (${m.index_author ?? 'anon'}) → #${m.book_id} ${m.book_title} [${m.book_authors.join('; ')}] ${m.status} ${m.confidence ?? ''}`),
    '', '## VA books not found among 1877 matches', ...vaUnmatched.map(v => `- #${v.book_id} ${v.title} [${v.authors.join('; ')}] VA ${v.year}`),
  ]
  writeFileSync(`data/index-1877/overlap-${DATE}.md`, md.join('\n'))
  console.log(`→ data/index-1877/overlap-${DATE}.{json,md}`)
}

main().catch(e => { console.error(e); process.exit(1) })
