#!/usr/bin/env tsx
/**
 * Index Librorum Prohibitorum 1877 → REGISTER entries (lean list rows, no book or
 * author records) for the rows the full-book import held back: no reliable decree
 * year in the OCR, a one-word/unidentified author, or a namesake risk. A register
 * row only says "this title is on the 1877 Index", so neither a ban year nor an
 * author identification is needed (schema: supabase/migrations/*_register_lists.sql).
 *
 * Read-only: writes data/index-1877/register-<date>.json (gitignored). The loader
 * runs once register_lists/register_entries exist.
 *
 * Author: printed_author = the headword as printed (OCR form). author_display uses
 * the LLM identification only when it is high-confidence and passed the name guard,
 * or when it was hand-reviewed (patch-index-1877-held.ts); low-confidence LLM names
 * were often wrong (Charles de Bonald for Bordas-Demoulin, Pitcairne for Estrix).
 *
 * Page: the OCR keeps ~245 of the printed "— 171 —" page numbers, some misread.
 * The longest increasing run of them is kept and pages in between are interpolated
 * by line position; the locator says "p. N".
 *
 *   npx tsx scripts/build-index-1877-register.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { flagValue } from './lib/cli'

const DIR = 'data/index-1877'
const DATE = flagValue('date') ?? '2026-11-10'
const STAGE = `${DIR}/stage1-2026-11-10.json`
const PLANS = [`${DIR}/import-plan-2026-11-09.md`, `${DIR}/import-plan-2026-11-10.md`]
const RECOVERY_SEQS = `${DIR}/held-recovery-2026-11-10-seqs.json`
const TEXT = `${DIR}/index-1877-djvu.txt`
const OUT = `${DIR}/register-${DATE}.json`
// Not separate works (editions of the entry above / not a title) — see patch-index-1877-held.ts.
const NOT_ENTRIES = new Set([5776, 5777, 5690, 3121])

type Llm = { class: string; author: string | null; author_confidence: 'high' | 'low' | null; title: string | null }
type Row = {
  seq: number; line: number; raw: string; headword: string; authors: string[]; year: number | string | null
  year_basis: string | null; llm: Llm | null; author_guard: string | null; author_reviewed?: string
}
export type RegisterEntry = {
  source_key: string; edition: '1877'; kind: 'book' | 'blanket'; letter: string; sort_key: string
  printed_author: string | null; author_display: string | null; title: string; ban_year: number | null
  note: string | null; printed_page: number | null; locator: string
}

const plausible = (y: unknown) => /^\d{4}$/.test(String(y ?? '')) && +String(y) >= 1500 && +String(y) <= 1877
// stage0 stores printed names given-first ("Petr. Abaelardus"); the Index prints surname-first.
const indexOrder = (n: string) => { const w = n.trim().split(/\s+/); return w.length > 1 ? `${w.at(-1)}, ${w.slice(0, -1).join(' ')}` : n.trim() }
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

function heldSeqs(): Set<number> {
  const held = new Set<number>()
  for (const p of PLANS) {
    const md = readFileSync(p, 'utf8')
    const sec = md.slice(md.indexOf('## Held (not imported)'))
    for (const m of sec.matchAll(/^- seq ([\d,]+)/gm)) m[1].split(',').forEach(s => held.add(Number(s)))
  }
  // Rows the 2026-11-10 pass imported are no longer held, unless that pass held them again.
  const plan2 = readFileSync(PLANS[1], 'utf8')
  const heldAgain = new Set([...plan2.slice(plan2.indexOf('## Held (not imported)')).matchAll(/^- seq ([\d,]+)/gm)].flatMap(m => m[1].split(',').map(Number)))
  for (const s of JSON.parse(readFileSync(RECOVERY_SEQS, 'utf8')) as number[]) if (!heldAgain.has(s)) held.delete(s)
  for (const s of NOT_ENTRIES) held.delete(s)
  return held
}

function pageOfLine(lines: string[]): (line: number) => number | null {
  const marks: { line: number; page: number }[] = []
  lines.forEach((l, i) => { const m = /^\s*[—–-]\s*(\d{1,3})\s*[—–-]\s*$/.exec(l); if (m) marks.push({ line: i + 1, page: Number(m[1]) }) })
  // Longest chain with increasing page and a plausible lines-per-page (40–110).
  const best: number[] = marks.map(() => 1), prev: number[] = marks.map(() => -1)
  for (let i = 0; i < marks.length; i++) for (let j = 0; j < i; j++) {
    const dp = marks[i].page - marks[j].page, dl = marks[i].line - marks[j].line
    if (dp > 0 && dl / dp >= 40 && dl / dp <= 110 && best[j] + 1 > best[i]) { best[i] = best[j] + 1; prev[i] = j }
  }
  let k = best.indexOf(Math.max(...best))
  const chain: typeof marks = []
  while (k >= 0) { chain.unshift(marks[k]); k = prev[k] }
  console.log(`page markers: ${marks.length} found, ${chain.length} in the consistent chain (p. ${chain[0]?.page}–${chain.at(-1)?.page})`)
  return (line: number) => {
    // The marker is printed at the page top (or foot); interpolate between chain neighbours.
    let i = chain.findIndex(c => c.line > line)
    if (i <= 0) return null
    const a = chain[i - 1], b = chain[i]
    return a.page + Math.floor(((line - a.line) / (b.line - a.line)) * (b.page - a.page))
  }
}

function main() {
  const rows: Row[] = JSON.parse(readFileSync(STAGE, 'utf8'))
  const page = pageOfLine(readFileSync(TEXT, 'utf8').split('\n'))
  const held = heldSeqs()

  let head: Row | null = null
  const headOf = new Map<number, Row>()
  for (const r of rows) { if (!/^[—–]/.test(r.raw)) head = r; headOf.set(r.seq, head ?? r) }

  const out: RegisterEntry[] = []
  const skipped: { seq: number; why: string }[] = []
  for (const r of rows) {
    if (!held.has(r.seq)) continue
    if (!r.llm || !['book', 'blanket'].includes(r.llm.class)) { skipped.push({ seq: r.seq, why: `class ${r.llm?.class}` }); continue }
    const h = headOf.get(r.seq)!
    const kind = r.llm.class === 'blanket' ? 'blanket' : 'book'
    const title = kind === 'blanket' ? 'All works' : r.llm.title?.trim()
    if (!title) { skipped.push({ seq: r.seq, why: 'no title' }); continue }
    let printed = (r.authors.length ? r.authors : h.authors).map(indexOrder).join('; ') || null
    // Anonymous works are filed under a title keyword that stage0 sometimes reads as a
    // name ("CONCILIUM Pisanum" → "Pisanum, Coxcilium"): a name word inside the title = no author.
    const titleWords = new Set(fold(title).toLowerCase().split(/\W+/))
    if (printed && fold(printed).toLowerCase().split(/\W+/).some(w => w.length > 3 && titleWords.has(w))) printed = null
    const src = /^[—–]/.test(r.raw) ? h : r
    const trusted = src.llm?.author && (src.author_reviewed || (src.llm.author_confidence === 'high' && src.author_guard !== 'demoted'))
    const display = trusted ? src.llm!.author : printed
    if (kind === 'blanket' && !display) { skipped.push({ seq: r.seq, why: 'blanket without author' }); continue }
    const hw = fold(h.headword || title).replace(/[^A-Za-z]/g, '')
    const letter = /^[A-Z]/i.test(hw) ? hw[0].toUpperCase() : '#'
    const p = page(r.line)
    out.push({
      source_key: `seq-${r.seq}`,
      edition: '1877',
      kind,
      letter,
      sort_key: `${fold(h.headword || '').toLowerCase()} ${fold(title).toLowerCase()}`.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(),
      printed_author: printed,
      author_display: display,
      title,
      ban_year: plausible(r.year) ? Number(r.year) : null,
      note: r.year_basis === 'index_trid_1564' ? 'Tridentine Index (1564)' : r.year_basis === 'index_clem_1596' ? 'Index of Clement VIII (1596)' : null,
      printed_page: p,
      locator: p ? `p. ${p}` : `OCR line ${r.line}`,
    })
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  const by = (f: (e: RegisterEntry) => string) => out.reduce((m, e) => m.set(f(e), (m.get(f(e)) ?? 0) + 1), new Map<string, number>())
  console.log(`held rows: ${held.size} → register entries: ${out.length}; skipped ${skipped.length} (${[...skipped.reduce((m, s) => m.set(s.why, (m.get(s.why) ?? 0) + 1), new Map<string, number>())].map(([k, v]) => `${k} ${v}`).join(', ')})`)
  console.log(`kind: ${[...by(e => e.kind)].map(([k, v]) => `${k} ${v}`).join(', ')}; with ban_year ${out.filter(e => e.ban_year).length}; with page ${out.filter(e => e.printed_page).length}; with author ${out.filter(e => e.author_display).length}`)
  console.log(`→ ${OUT}`)
}
main()
