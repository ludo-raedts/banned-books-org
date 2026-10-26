// Replace foreign-edition ISBNs on English-original books with an English edition.
//
// Audit 2026-10-26: 586 books with original_language='en' carry an isbn13 whose
// registration group is not English-language (978-2 FR, 978-3 DE, 978-84 ES,
// 978-88 IT, 978-5 RU, …) — e.g. /books/1984 = 9782246825777 (Grasset),
// /books/the-handmaids-tale = 9783596259878 (Fischer). That ISBN feeds the Book
// JSON-LD (`isbn` + `inLanguage: en` contradict each other), the Bookshop/Kobo
// deep links (wrong edition for an English-reading visitor) and cover lookups.
//
// Resolution ladder per book:
//   0. bookshop_isbn13 already English (978-0/978-1/979-8) → promote it.
//   1. openlibrary_work_id known → /works/<id>/editions.json (paginated),
//      keep editions with language eng + an English-group ISBN, score them
//      (cover, mainstream publisher, paperback; penalise print-on-demand),
//      pick the best.
//   2. no work id → OL search title+author (author-gated via authorAgrees),
//      take the work key, then step 1; also backfills openlibrary_work_id.
//   3. verifyEdition(isbn, title, 'en') from src/lib/enrich/isbn.ts (title +
//      language check on the edition record) and a UNIQUE check on books.isbn13.
// The replaced ISBN is kept in the report (not stored). Dry-run by default.
//
// Usage:
//   pnpm tsx --env-file=.env.local scripts/fix-foreign-edition-isbns.ts [--limit=N] [--slugs=a,b]
//   pnpm tsx --env-file=.env.local scripts/fix-foreign-edition-isbns.ts --apply
// Pool is ordered by 90-day pageviews so the visible pages are fixed first.
// Checkpoint: data/foreign-isbn-fix.jsonl (resumable). Report: data/foreign-isbn-fix-<date>.md

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { authorAgrees, verifyEdition } from '../src/lib/enrich/isbn'
import { isApply, intFlag, flagValue } from './lib/cli'

const UA = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const CKPT = 'data/foreign-isbn-fix.jsonl'
const DELAY_MS = 1100
const EN_PREFIX = /^(9780|9781|9798)/

type Book = {
  id: number
  slug: string
  title: string
  isbn13: string
  bookshop_isbn13: string | null
  openlibrary_work_id: string | null
  authors: string[]
  pv90: number
}
type Outcome = {
  id: number
  slug: string
  old_isbn: string
  new_isbn: string | null
  work: string | null
  via: 'bookshop' | 'work-editions' | 'search+editions' | null
  publisher?: string
  note: string
  applied: boolean
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function olJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: UA })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    await sleep(DELAY_MS)
  }
}

const POD = /independently published|createspace|lulu|books on demand|lightning source|kessinger|forgotten books|general books|nabu|bibliolife|digireads|wildside|sagwan|hardpress|repro|ebooks|e-artnow|musaicum|otbebookpublishing/i
const MAINSTREAM = /penguin|vintage|random house|harper|houghton|scholastic|simon|schuster|macmillan|farrar|knopf|doubleday|bantam|dell|signet|puffin|bloomsbury|faber|picador|hachette|little, brown|orion|hodder|norton|viking|anchor|ballantine|del rey|tor|orbit|dutton|putnam|riverhead|grove|new directions|oxford|cambridge|yale|harvard|mit press|chicago|princeton|routledge|verso|dover|wordsworth|modern library|everyman|hamish hamilton|secker|chatto|jonathan cape|bodley head|atria|gallery|ace|roc|berkley|st. martin|henry holt|crown|pantheon|schocken|disney|hyperion|candlewick|chronicle|abrams|first second|image|dark horse|dc comics|marvel|viz|kodansha|yen press|seven seas|tokyopop|square enix|titan|rebellion|graphix|razorbill|dial|delacorte|wendy lamb|margaret k|balzer|katherine tegen|greenwillow|clarion|atheneum|little simon|aladdin|flatiron|wednesday|holt|sourcebooks|quirk|algonquin|workman|lerner|capstone|rosen|crabtree|gareth stevens|britannica|dk|dorling/i

type Edition = {
  key: string
  title?: string
  isbn_13?: string[]
  languages?: { key: string }[]
  publishers?: string[]
  publish_date?: string
  physical_format?: string
  covers?: number[]
}

async function bestEnglishEdition(workId: string): Promise<{ isbn: string; publisher: string } | null> {
  let best: { isbn: string; publisher: string; score: number } | null = null
  for (let offset = 0; offset < 300; offset += 50) {
    const page = await olJson<{ entries: Edition[]; size?: number }>(
      `https://openlibrary.org/works/${workId}/editions.json?limit=50&offset=${offset}`,
    )
    if (!page?.entries?.length) break
    for (const e of page.entries) {
      const lang = e.languages?.map(l => l.key.split('/').pop())
      if (lang && lang.length > 0 && !lang.includes('eng')) continue
      if (!lang || lang.length === 0) continue // unknown language = too risky
      const isbn = (e.isbn_13 ?? []).map(s => s.replace(/[^0-9X]/gi, '')).find(s => s.length === 13 && EN_PREFIX.test(s))
      if (!isbn) continue
      const publisher = (e.publishers ?? [])[0] ?? ''
      let score = 0
      if (e.covers?.length) score += 2
      if (MAINSTREAM.test(publisher)) score += 3
      if (POD.test(publisher) || isbn.startsWith('9798')) score -= 5
      if (/paperback|hardcover|hardback/i.test(e.physical_format ?? '')) score += 1
      if (!publisher) score -= 1
      if (!best || score > best.score) best = { isbn, publisher, score }
    }
    if ((page.size ?? 0) <= offset + 50) break
  }
  return best && best.score >= 2 ? { isbn: best.isbn, publisher: best.publisher } : null
}

async function findWork(b: Book): Promise<string | null> {
  const q = new URLSearchParams({ title: b.title, lang: 'en', limit: '5', fields: 'key,title,author_name' })
  if (b.authors[0]) q.set('author', b.authors[0])
  const res = await olJson<{ docs: { key: string; title: string; author_name?: string[] }[] }>(
    `https://openlibrary.org/search.json?${q.toString()}`,
  )
  for (const d of res?.docs ?? []) {
    if (b.authors[0] && !authorAgrees(b.authors[0], d.author_name ?? [])) continue
    return d.key.replace('/works/', '')
  }
  return null
}

async function main() {
  const apply = isApply()
  const limit = intFlag('limit', Infinity)
  const slugs = flagValue('slugs')?.split(',').map(s => s.trim()).filter(Boolean) ?? null
  const sb = adminClient()

  // Pool: English-original books with a non-English-group ISBN, most-viewed first.
  const done = new Set<number>()
  if (existsSync(CKPT)) for (const line of readFileSync(CKPT, 'utf8').split('\n')) if (line.trim()) done.add((JSON.parse(line) as Outcome).id)

  const rows: Book[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb
      .from('books')
      .select('id, slug, title, isbn13, bookshop_isbn13, openlibrary_work_id, book_authors(authors(display_name))')
      .eq('original_language', 'en')
      .not('isbn13', 'is', null)
      .order('id')
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    for (const r of data as unknown as { id: number; slug: string; title: string; isbn13: string; bookshop_isbn13: string | null; openlibrary_work_id: string | null; book_authors: { authors: { display_name: string } | null }[] }[]) {
      if (EN_PREFIX.test(r.isbn13)) continue
      rows.push({ ...r, authors: r.book_authors.map(ba => ba.authors?.display_name).filter((s): s is string => !!s), pv90: 0 })
    }
    if (data.length < 1000) break
  }
  // 90-day pageviews for ordering (chunked reads, counted client-side; the
  // PostgREST 1,000-row cap makes this approximate — ordering only).
  const ids = rows.map(r => r.id)
  const counts = new Map<number, number>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from('pageviews').select('entity_id').eq('entity_type', 'book').in('entity_id', ids.slice(i, i + 200)).gte('viewed_at', new Date(Date.now() - 90 * 86400e3).toISOString()).limit(20000)
    for (const p of (data ?? []) as { entity_id: number }[]) counts.set(p.entity_id, (counts.get(p.entity_id) ?? 0) + 1)
  }
  for (const r of rows) r.pv90 = counts.get(r.id) ?? 0
  rows.sort((a, b) => b.pv90 - a.pv90)

  let pool = rows.filter(r => !done.has(r.id))
  if (slugs) pool = pool.filter(r => slugs.includes(r.slug))
  pool = pool.slice(0, limit)
  console.log(`Pool: ${rows.length} foreign-ISBN English books · checkpointed ${done.size} · this run ${pool.length} · ${apply ? 'APPLY' : 'dry-run'}`)

  const outcomes: Outcome[] = []
  for (const [i, b] of pool.entries()) {
    const out: Outcome = { id: b.id, slug: b.slug, old_isbn: b.isbn13, new_isbn: null, work: b.openlibrary_work_id, via: null, note: '', applied: false }
    let candidate: { isbn: string; publisher: string } | null = null
    if (b.bookshop_isbn13 && EN_PREFIX.test(b.bookshop_isbn13)) {
      candidate = { isbn: b.bookshop_isbn13, publisher: '(bookshop_isbn13)' }
      out.via = 'bookshop'
    } else {
      let work = b.openlibrary_work_id
      if (!work) {
        work = await findWork(b)
        if (work) { out.work = work; out.via = 'search+editions' }
      } else out.via = 'work-editions'
      if (!work) out.note = 'no OL work (author-gated search empty)'
      else {
        candidate = await bestEnglishEdition(work)
        if (!candidate) out.note = 'no scored English edition with 978-0/1 ISBN'
      }
    }
    // Title/coverage verification only when the work came from a title search.
    // Editions pulled by our own openlibrary_work_id are the right work by
    // construction (and their title often differs legitimately: "Nineteen
    // Eighty-Four" vs "1984", "Educated" vs "Educated: A Memoir"); their
    // language was already filtered to eng.
    if (candidate && out.via === 'search+editions') {
      const check = await verifyEdition(candidate.isbn, b.title, 'en')
      if (!check.ok) { out.note = `rejected: ${check.reason}`; candidate = null }
    }
    if (candidate) {
      const { data: clash } = await sb.from('books').select('id, slug').eq('isbn13', candidate.isbn).neq('id', b.id).maybeSingle()
      if (clash) { out.note = `ISBN already on /books/${(clash as { slug: string }).slug} (edition dup?)`; candidate = null }
    }
    if (candidate) {
      out.new_isbn = candidate.isbn
      out.publisher = candidate.publisher
      if (apply) {
        const patch: Record<string, unknown> = { isbn13: candidate.isbn }
        if (!b.openlibrary_work_id && out.work) patch.openlibrary_work_id = out.work
        const { error } = await sb.from('books').update(patch).eq('id', b.id).eq('isbn13', b.isbn13)
        out.applied = !error
        out.note = error ? `update failed: ${error.message}` : 'applied'
      } else out.note = 'would apply'
    }
    outcomes.push(out)
    appendFileSync(CKPT, JSON.stringify(out) + '\n')
    const mark = out.new_isbn ? '✓' : '·'
    console.log(`  ${mark} [${i + 1}/${pool.length}] ${b.slug} (${b.pv90} pv) ${b.isbn13} → ${out.new_isbn ?? '—'} ${out.publisher ? `(${out.publisher})` : ''} ${out.note}`)
  }

  const date = new Date().toISOString().slice(0, 10)
  const fixed = outcomes.filter(o => o.new_isbn)
  const md = [
    `# Foreign-edition ISBN fix — ${date} (${apply ? 'APPLY' : 'dry-run'})`,
    '',
    `Pool ${rows.length} · processed ${outcomes.length} · resolved ${fixed.length} · unresolved ${outcomes.length - fixed.length}`,
    '',
    '| book | old (foreign) | new (English) | via | publisher | note |',
    '|---|---|---|---|---|---|',
    ...outcomes.map(o => `| [${o.slug}](https://www.banned-books.org/books/${o.slug}) | ${o.old_isbn} | ${o.new_isbn ?? ''} | ${o.via ?? ''} | ${o.publisher ?? ''} | ${o.note} |`),
  ]
  writeFileSync(`data/foreign-isbn-fix-${date}.md`, md.join('\n'))
  console.log(`\nResolved ${fixed.length}/${outcomes.length}. Report: data/foreign-isbn-fix-${date}.md`)
  if (!apply) console.log('Dry-run — review, delete the checkpoint rows you want re-run (or the whole data/foreign-isbn-fix.jsonl), then --apply.')
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
