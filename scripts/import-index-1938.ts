#!/usr/bin/env tsx
/**
 * Index Librorum Prohibitorum, 1938 edition — import of the works condemned
 * 1877–1938 (the 1877 edition is already imported), from the stage-1 file built
 * by scripts/build-index-1938-stage0.ts + scripts/clean-index-1938-llm.ts
 * (data/index-1938/stage1-<date>.json). Books only, thin reader over the shared
 * commit-lib (commitParsedRow / commitNewBanForBook).
 *
 * Rules (lessons of the 1877 run, see memory project_index_1877_import):
 *  - AUTHOR = the PRINTED name. The LLM's identification is used only when it
 *    shares its opening with the printed headword; otherwise the printed name
 *    is imported (never an invented person). Dash entries take their head
 *    entry's author; when the LLM contradicts the head → hold.
 *  - YEAR = the parser's decree year and the LLM's must agree, else hold.
 *  - MATCH-BEFORE-CREATE: every work goes through matchExistingBook plus an
 *    author-based title-similarity pass. Any hit is NOT imported: it is listed
 *    in the report as overlap (existing book id, its VA bans) for a decision.
 *    Overlap decisions go into OVERLAP below (attach / skip) after review.
 *  - Existing author slug that belongs to a non-historical namesake → hold.
 *
 *   npx tsx --env-file=.env.local scripts/import-index-1938.ts            # dry-run
 *   npx tsx --env-file=.env.local scripts/import-index-1938.ts --apply
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { matchExistingBook } from '../src/lib/imports/verifier'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { commitNewBanForBook, commitParsedRow } from '../src/lib/imports/review-commit'
import { canonicaliseAuthorName } from '../src/lib/imports/canonicalise-author-name'
import { slugify } from '../src/lib/imports/slugify'
import { flagValue, isApply } from './lib/cli'
import { INDEX_1938_SOURCE_NAME, INDEX_1938_SOURCE_URL } from './build-index-1938-stage0'

const APPLY = isApply()
const DATE = flagValue('date') ?? '2026-11-12'
const IN = `data/index-1938/stage1-${DATE}.json`
const REPORT = `data/index-1938/import-plan-${DATE}.md`
const OVERLAP_FILE = `data/index-1938/overlap-decisions-${DATE}.json` // { [seq]: { action:'skip'|'attach'|'new', book_id?, note } }
const ANONYMOUS = 'Anonymous'
// Existing authors without birth_year, checked by hand as the same person (Index author / same-source import).
const ALLOW_EXISTING_AUTHOR_IDS = new Set([14730 /* Enrico Ferri (DE 1938 bans) */, 26850 /* Luigi Anelli (1877 import) */, 26971 /* Guillaume Tiberghien (1877 import) */])
const INCLUSION =
  'Listed in the Index Librorum Prohibitorum (Rome, 1938 edition), the Catholic Church’s official catalogue of books ' +
  'Catholics were forbidden to read, print or keep, here as a work condemned between 1877 and 1938. The Index was abolished in 1966.'

type Llm = { class: 'book' | 'blanket' | 'not_book' | 'garbage'; author: string | null; author_confidence: 'high' | 'low' | null; title: string | null; decree_year: number | null; language: string | null; note?: string | null }
type Row = {
  seq: number; raw: string; scope: string; class: string; authors: string[]; headword: string
  year: number | null; decree_years: number[]; action_type: 'banned' | 'restricted'; llm?: Llm | null
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
const isDash = (r: Row) => /^[—–]/.test(r.raw)
const words = (t: string) => new Set(t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length >= 4))
function sim(a: string, b: string) {
  const A = words(a), B = words(b)
  if (!A.size || !B.size) return 0
  let n = 0
  for (const w of A) if ([...B].some(x => x.slice(0, 5) === w.slice(0, 5))) n++
  return n / Math.min(A.size, B.size)
}
const plausibleYear = (y: number | null) => y != null && y >= 1877 && y <= 1938

function banDescription(r: Row): string {
  const until = r.action_type === 'restricted' ? ' until corrected (donec corrigatur)' : ''
  return `Prohibited${until} by a decree of ${r.year}, as recorded in the Index Librorum Prohibitorum (Rome, 1938 edition).`
}
function slugBase(title: string): string {
  const s = slugify(title)
  if (s.length <= 80) return s
  const cut = s.slice(0, 80)
  return cut.slice(0, cut.lastIndexOf('-') > 40 ? cut.lastIndexOf('-') : 80)
}

async function main() {
  const all: Row[] = JSON.parse(readFileSync(IN, 'utf8'))
  const decisions: Record<string, { action: 'skip' | 'attach' | 'new'; book_id?: number; note: string }> = (() => {
    try { return JSON.parse(readFileSync(OVERLAP_FILE, 'utf8')) } catch { return {} }
  })()

  // --- author per row ---------------------------------------------------------
  const bySeq = new Map(all.map(r => [r.seq, r]))
  let head: Row | null = null
  const authorOf = new Map<number, { name: string | null; why?: string }>()
  const printedOf = (r: Row) => r.authors[0] ?? null
  const accept = (llmName: string, headword: string) => {
    const h = fold(headword).slice(0, 2)
    return !!h && llmName.split(/[\s'’-]+/).some(t => fold(t).startsWith(h))
  }
  for (const r of all) {
    if (!isDash(r)) head = r
    if (r.scope !== 'new' || !r.llm) continue
    const src = isDash(r) ? head : r
    if (!src) { authorOf.set(r.seq, { name: null, why: 'dash entry without head' }); continue }
    const printed = printedOf(src)
    const llmName = r.llm.author && !/^(unknown|previous author|anonymous)$/i.test(r.llm.author) ? r.llm.author : null
    if (!printed && !llmName) { authorOf.set(r.seq, { name: null }); continue } // anonymous
    if (!printed) {
      // The parser missed the printed name (OCR gaps, "v. Surname" cross-refs). Accept the LLM's name
      // only when one of its ≥4-letter tokens literally occurs in the printed entry (spaces ignored).
      const rawFold = fold(src.raw)
      const printedIn = !!llmName && llmName.split(/[\s'’.,-]+/).some(t => fold(t).length >= 4 && rawFold.includes(fold(t)))
      authorOf.set(r.seq, printedIn ? { name: llmName } : { name: null, why: 'LLM names an author the entry does not print' })
      continue
    }
    const hw = src.headword || printed.split(/\s+/).pop()!
    if (isDash(r) && llmName && !accept(llmName, hw)) { authorOf.set(r.seq, { name: null, why: `LLM author "${llmName}" contradicts head entry "${printed}"` }); continue }
    authorOf.set(r.seq, { name: llmName && accept(llmName, hw) ? llmName : printed })
  }

  const usable = all.filter(r => r.scope === 'new' && r.llm && (r.llm.class === 'book' || r.llm.class === 'blanket'))
  const held: { rows: Row[]; why: string }[] = []
  const ok: Row[] = []
  for (const r of usable) {
    const a = authorOf.get(r.seq)
    if (a?.why) { held.push({ rows: [r], why: a.why }); continue }
    if (!plausibleYear(r.year)) { held.push({ rows: [r], why: `year ${r.year} outside 1877–1938` }); continue }
    if (r.llm!.decree_year !== r.year) { held.push({ rows: [r], why: `year mismatch: parser ${r.year} vs LLM ${r.llm!.decree_year}` }); continue }
    ok.push(r)
  }

  // --- overlap with the DB (matcher + author-based title similarity) --------------
  const sb = adminClient()
  const authorRows: { id: number; slug: string; display_name: string; birth_year: number | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('authors').select('id, slug, display_name, birth_year').order('id').range(from, from + 999)
    if (error) throw error
    authorRows.push(...data!)
    if (!data || data.length < 1000) break
  }
  const authorBySlug = new Map(authorRows.map(a => [a.slug, a]))
  const overlap = new Map<number, { id: number; title: string; via: string; va: number[] }>()
  let qi = 0
  const needMatch = ok.filter(r => r.llm!.class === 'book' && r.llm!.title && !decisions[r.seq])
  async function worker() {
    for (;;) {
      const r = needMatch[qi++]
      if (!r) return
      const title = r.llm!.title!
      let hit: { id: number; via: string } | null = null
      const m = await matchExistingBook({ title }).catch(() => null)
      if (m) hit = { id: m.id, via: `matcher ${m.status}` }
      if (!hit) {
        const name = authorOf.get(r.seq)?.name
        const a = name ? authorBySlug.get(slugify(canonicaliseAuthorName(name))) : null
        if (a) {
          const { data } = await sb.from('book_authors').select('books(id, title, title_english_meaningful)').eq('author_id', a.id)
          for (const x of (data ?? []) as any[]) {
            const b = x.books
            if (b && Math.max(sim(title, b.title), b.title_english_meaningful ? sim(title, b.title_english_meaningful) : 0) >= 0.5) { hit = { id: b.id, via: `same author #${a.id}` }; break }
          }
        }
      }
      if (hit) {
        const { data: b } = await sb.from('books').select('id, title, bans(country_code, year_started)').eq('id', hit.id).single()
        overlap.set(r.seq, { id: hit.id, title: (b as any)?.title, via: hit.via, va: ((b as any)?.bans ?? []).filter((x: any) => x.country_code === 'VA').map((x: any) => x.year_started) })
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))

  const skipped: { r: Row; note: string }[] = []
  const attach: { r: Row; book_id: number; note: string }[] = []
  const toGroup: Row[] = []
  for (const r of ok) {
    const d = decisions[r.seq]
    if (d?.action === 'skip') { skipped.push({ r, note: d.note }); continue }
    if (d?.action === 'attach') { attach.push({ r, book_id: d.book_id!, note: d.note }); continue }
    const o = overlap.get(r.seq)
    if (o && d?.action !== 'new') { held.push({ rows: [r], why: `OVERLAP #${o.id} "${o.title}" (${o.via})${o.va.length ? ' · VA ' + o.va.join('/') : ''} — decide in ${OVERLAP_FILE}` }); continue }
    toGroup.push(r)
  }

  // --- authors vs existing rows, group into works --------------------------------
  type Work = { key: string; kind: 'book' | 'blanket'; author: string; title: string; rows: Row[] }
  const works = new Map<string, Work>()
  for (const r of toGroup) {
    const name = authorOf.get(r.seq)!.name
    let display = ANONYMOUS
    if (name) {
      display = canonicaliseAuthorName(name)
      const ex = authorBySlug.get(slugify(display))
      if (ex && !(ex.birth_year != null && ex.birth_year < 1930) && !ALLOW_EXISTING_AUTHOR_IDS.has(Number(ex.id))) {
        held.push({ rows: [r], why: `author slug belongs to existing author #${ex.id} ${ex.display_name} (born ${ex.birth_year ?? '?'}) — namesake risk` })
        continue
      }
      if (!/\s/.test(display.trim()) && r.llm!.author_confidence !== 'high' && !/pseudonymus/i.test(r.raw)) {
        held.push({ rows: [r], why: `one-word uncertain author name "${display}"` }); continue
      }
    }
    if (r.llm!.class === 'blanket') {
      if (display === ANONYMOUS) { held.push({ rows: [r], why: 'blanket entry without author' }); continue }
      const key = `blanket|${slugify(display)}`
      const w = works.get(key) ?? { key, kind: 'blanket' as const, author: display, title: `${display} — All works`, rows: [] }
      w.rows.push(r); works.set(key, w); continue
    }
    const title = r.llm!.title?.trim()
    if (!title || !slugify(title)) { held.push({ rows: [r], why: 'no usable title' }); continue }
    const key = `book|${slugify(display)}|${slugBase(title)}${display === ANONYMOUS ? `|${r.year}` : ''}`
    const w = works.get(key) ?? { key, kind: 'book' as const, author: display, title, rows: [] }
    w.rows.push(r); works.set(key, w)
  }

  // --- slugs ------------------------------------------------------------------------
  const allBase = [...works.values()].map(w => slugBase(w.title))
  const taken = new Set<string>()
  for (let i = 0; i < allBase.length; i += 150) {
    const chunk = allBase.slice(i, i + 150)
    const a = await sb.from('books').select('slug').in('slug', chunk)
    const b = await sb.from('book_slug_aliases').select('slug').in('slug', chunk)
    for (const x of [...(a.data ?? []), ...(b.data ?? [])]) taken.add((x as any).slug)
  }
  const plan: (Work & { slug: string; years: [number, Row[]][] })[] = []
  const used = new Set<string>()
  for (const w of works.values()) {
    const base = slugBase(w.title)
    if (w.kind === 'blanket' && taken.has(base)) { for (const r of w.rows) skipped.push({ r, note: `blanket book "${w.title}" already exists` }); continue }
    if (w.kind === 'book' && taken.has(base)) { held.push({ rows: w.rows, why: `exact slug/alias hit on "${base}" — not decided` }); continue }
    const years = [...w.rows.reduce((m, r) => m.set(r.year!, [...(m.get(r.year!) ?? []), r]), new Map<number, Row[]>())].sort((a, b) => a[0] - b[0])
    const authorPart = w.author !== ANONYMOUS ? slugify(w.author.split(/\s+/).pop()!) : ''
    const generic = base.split('-').length <= 2 && !!authorPart
    let slug = ''
    for (const cand of [generic ? '' : base, `${base}-${authorPart}`, `${base}-${authorPart}-${years[0][0]}`, `${base}-${years[0][0]}-${w.rows[0].seq}`]) {
      if (cand && !cand.endsWith('-') && !used.has(cand) && !taken.has(cand)) { slug = cand; break }
    }
    if (!slug) throw new Error(`no free slug for ${w.title}`)
    used.add(slug)
    plan.push({ ...w, slug, years })
  }

  // --- report -------------------------------------------------------------------------
  const pg = newPgClient()
  await pg.connect()
  const before = (await pg.query(`select (select count(*) from books)::int books, (select count(*) from authors)::int authors, (select count(*) from bans where country_code='VA')::int va_bans, (select count(distinct book_id) from bans where country_code='VA')::int va_books`)).rows[0]
  const books = plan.filter(p => p.kind === 'book')
  const blankets = plan.filter(p => p.kind === 'blanket')
  const newAuthors = new Set(plan.map(p => p.author).filter(a => a !== ANONYMOUS && !authorBySlug.has(slugify(a))))
  const heldWhy = new Map<string, number>()
  for (const h of held) { const k = h.why.replace(/".*?"|#\d+.*$/g, '…').replace(/\d{4}/g, 'YYYY'); heldWhy.set(k, (heldWhy.get(k) ?? 0) + h.rows.length) }
  const md: string[] = [
    `# Index 1938 import plan (${DATE}) — ${APPLY ? 'APPLY' : 'DRY-RUN'}`, '',
    `- stage-1 new rows used: ${usable.length}`,
    `- create books: ${books.length} (${books.reduce((s, p) => s + p.years.length, 0)} VA bans; ${books.filter(p => p.author === ANONYMOUS).length} anonymous)`,
    `- create blanket "— All works" books: ${blankets.length}`,
    `- attach VA ban to existing book: ${attach.length}`,
    `- skip: ${skipped.length} rows`,
    `- held: ${held.reduce((s, h) => s + h.rows.length, 0)} rows`,
    ...[...heldWhy].sort((a, b) => b[1] - a[1]).map(([k, n]) => `  - ${k}: ${n}`),
    `- new authors: ${newAuthors.size}`,
    '', '## Create (all)', ...plan.map(p => `- [${p.kind}] /books/${p.slug} "${p.title}" — ${p.author} — VA ${p.years.map(y => y[0]).join(',')}${p.rows.some(r => r.action_type === 'restricted') ? ' (restricted)' : ''} · seq ${p.rows.map(r => r.seq).join(',')}`),
    '', '## Held', ...held.map(h => `- seq ${h.rows.map(r => r.seq).join(',')} "${h.rows[0].llm?.title ?? ''}" — ${h.why}`),
    '', '## Skipped', ...skipped.map(s => `- seq ${s.r.seq} "${s.r.llm?.title ?? ''}" — ${s.note}`),
    '', '## Attach', ...attach.map(a => `- seq ${a.r.seq} → #${a.book_id} [VA ${a.r.year}] ${a.note}`),
  ]
  writeFileSync(REPORT, md.join('\n') + '\n')
  console.log(md.slice(0, 13).join('\n'))
  console.log(`BEFORE: books=${before.books} authors=${before.authors} VA bans=${before.va_bans} VA books=${before.va_books}`)
  console.log(`→ ${REPORT}`)
  if (!APPLY) { await pg.end(); console.log('\nDRY-RUN — nothing written. Re-run with --apply.'); return }

  // --- apply ----------------------------------------------------------------------------
  const common = { country_code: 'VA', scope_slug: 'government', ban_status: 'historical' as const, reason_slug: 'religious', source_url: INDEX_1938_SOURCE_URL, source_name: INDEX_1938_SOURCE_NAME, source_type: 'government' }
  for (const a of attach) await commitNewBanForBook({ ...common, book_id: a.book_id, action_type: a.r.action_type, year: a.r.year!, description_ban: banDescription(a.r) }, pg)
  let done = 0
  for (const p of plan) {
    const [y0, rows0] = p.years[0]
    const lang = p.rows[0].llm?.language
    const res = await commitParsedRow({
      ...common, title: p.title, slug_override: p.slug,
      original_language: p.kind === 'book' && lang && /^[a-z]{2}$/.test(lang) ? lang : null,
      authors: p.author === ANONYMOUS ? [ANONYMOUS] : (p.rows[0].llm?.author?.includes(' and ') && fold(p.rows[0].llm.author).includes(fold(p.author.split(/\s+/).pop()!)) ? p.rows[0].llm.author.split(' and ').map(canonicaliseAuthorName) : [p.author]), year: y0, action_type: rows0[0].action_type,
      description_ban: banDescription(rows0[0]), inclusion_rationale: INCLUSION,
    }, pg)
    if (p.kind === 'blanket') await pg.query(`update books set is_blanket_works = true where id = $1`, [res.book_id])
    for (const [, rs] of p.years.slice(1)) await commitNewBanForBook({ ...common, book_id: res.book_id, action_type: rs[0].action_type, year: rs[0].year!, description_ban: banDescription(rs[0]) }, pg)
    if (++done % 100 === 0) console.log(`  ${done}/${plan.length}`)
  }
  const after = (await pg.query(`select (select count(*) from books)::int books, (select count(*) from authors)::int authors, (select count(*) from bans where country_code='VA')::int va_bans, (select count(distinct book_id) from bans where country_code='VA')::int va_books`)).rows[0]
  console.log(`AFTER: books=${after.books} (+${after.books - before.books}) authors=${after.authors} (+${after.authors - before.authors}) VA bans=${after.va_bans} (+${after.va_bans - before.va_bans}) VA books=${after.va_books} (+${after.va_books - before.va_books})`)
  await pg.end()
  void bySeq
}

main().catch(e => { console.error(e); process.exit(1) })
