/**
 * Index Librorum Prohibitorum 1877 — LLM cleanup pass over the stage-0 rows
 * (READ-ONLY w.r.t. Supabase; writes local files only).
 *
 * The OCR mangles the small-caps surnames ("Diperor" = Diderot, "Quixer" =
 * Quinet), the rule parser cannot always split author from title, and ~1,000
 * book rows have no decree year because the date sits in a wrapped/braced
 * layout. OPENAI_FAST reads each raw entry (plus its neighbours as context)
 * and returns: class, a normalised author name, the clean title, the decree
 * year as printed, and the title language. It must never invent: the year
 * has to appear in the entry text, and a name it cannot recognise stays as
 * printed with author_confidence 'low'.
 *
 *   npx tsx --env-file=.env.local scripts/clean-index-1877-llm.ts \
 *     --in=data/index-1877/stage0-2026-11-09.json [--limit=40] [--max-usd=1]
 *   → data/index-1877/llm-cache.jsonl (resumable, keyed by seq + raw hash)
 *   → data/index-1877/stage1-<date>.json (stage-0 rows + llm fields)
 *
 * Cross-references ("Vide …") are skipped: they carry no work of their own.
 */
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import OpenAI from 'openai'
import { OPENAI_COST_PER_TOKEN, OPENAI_FAST, OPENAI_NO_REASONING } from '../src/lib/llm-models'
import { flagValue, intFlag } from './lib/cli'
import type { Index1877Row } from './build-index-1877-stage0'

const DATE = flagValue('date') ?? new Date().toISOString().slice(0, 10)
const IN = flagValue('in') ?? `data/index-1877/stage0-${DATE}.json`
const OUT = `data/index-1877/stage1-${DATE}.json`
const CACHE = 'data/index-1877/llm-cache.jsonl'
const LIMIT = intFlag('limit', 0)
const MAX_USD = Number(flagValue('max-usd') ?? 1)
const BATCH = 20
const CONCURRENCY = 6

export type LlmFields = {
  class: 'book' | 'blanket' | 'not_book' | 'garbage'
  author: string | null
  author_confidence: 'high' | 'low' | null
  title: string | null
  decree_year: number | null
  language: string | null
  note?: string | null
}
type CacheRow = { seq: number; h: string; llm: LlmFields }

const SYSTEM = `You clean OCR'd entries from the 1877 Roman Index Librorum Prohibitorum (Index of Forbidden Books). Each entry is "SURNAME Firstname. Title. Decr. <day>. <month> <year>." or, for anonymous works, a title whose first word is the headword. A line starting with "—" is another work by the previous entry's author (that author is given to you). "1. Cl." (also OCR'd "4. Cl.", "I. CI.") means first class: ALL works of the author are forbidden. "Ind. Trid." = Tridentine Index (1564). "Donec corrig." = until corrected.

The surnames are printed in small caps and the OCR garbles them (e.g. "Diperor Jaco." = Jacques Diderot, "Quixer EpcanD." = Edgar Quinet, "Secn1i Bern." = Bernardo Segni, "loan." = Ioan.). Latin given-name abbreviations: Ioan.=Johannes, Petr.=Petrus, Franc.=Franciscus, Iac./Iaco.=Iacobus, Guil.=Guilelmus, Ios.=Iosephus.

For each entry return:
- class: "book" (a named work: book, treatise, pamphlet, dissertation, collected volume), "blanket" (author-level ban without a specific title: "1. Cl.", "opera omnia"), "not_book" (a single letter, pastoral letter/mandement, theses, decree, single sheet, image, indulgence, prayer card, manuscript, periodical, a cross-reference "Vide …"), or "garbage" (OCR debris with no recoverable work).
- author: the author's name in its standard modern form if you RECOGNISE the person with confidence (e.g. "Denis Diderot", "Hugo Grotius", "Edgar Quinet"); otherwise the de-garbled name as printed, given name(s) first ("Iohannes Jaan"). null for anonymous works. Never invent a person.
- author_confidence: "high" only if you recognise the real person; "low" otherwise; null if no author.
- title: the work's title in its ORIGINAL language, OCR errors fixed, without the decree/index/edition tail ("Decr. …", "Ind. Trid.", "Donec corrig."), without place/year of printing, and without the "— Latine: …" Latin gloss. Keep the first clause; trim very long descriptive titles to the main title (max ~120 chars). For anonymous works restore the inverted article ("Chiesa (la) cattolica" → "La chiesa cattolica"). null for blanket/garbage.
- decree_year: the year of the condemnation (after "Decr.", "Brevi", "Bulla", "S. Off.", "Congr.") ONLY if it appears in this entry's text or in the immediately following "—" context of the same author group; never a printing year, never guessed. null if not present. OCR may print 1 as l/I and 7 as 4 inside years.
- language: ISO 639-1 of the title (la, it, fr, de, es, pt, en, nl, pl, …), null if unknown.
- note: optional, max 10 words, only when something is doubtful.

Return JSON {"entries":[{"seq":…, "class":…, "author":…, "author_confidence":…, "title":…, "decree_year":…, "language":…, "note":…}]} with one object per input seq, in order.`

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '')
const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12)

function loadCache(): Map<number, CacheRow> {
  const m = new Map<number, CacheRow>()
  if (!existsSync(CACHE)) return m
  for (const line of readFileSync(CACHE, 'utf8').split('\n')) if (line.trim()) {
    const r = JSON.parse(line) as CacheRow
    m.set(r.seq, r)
  }
  return m
}

async function main() {
  const rows: Index1877Row[] = JSON.parse(readFileSync(IN, 'utf8'))
  const cache = loadCache()
  const bySeq = new Map(rows.map(r => [r.seq, r]))
  const todo = rows.filter(r => r.class_reason !== 'cross-reference' && cache.get(r.seq)?.h !== hash(r.raw))
  const queue = LIMIT ? todo.slice(0, LIMIT) : todo
  const batches: Index1877Row[][] = []
  for (let i = 0; i < queue.length; i += BATCH) batches.push(queue.slice(i, i + BATCH))
  console.log(`${rows.length} rows, ${todo.length} uncached, sending ${queue.length} in ${batches.length} batches (${OPENAI_FAST})`)

  const openai = new OpenAI()
  const price = OPENAI_COST_PER_TOKEN[OPENAI_FAST]
  let tin = 0, tout = 0, done = 0, failed = 0
  const cost = () => (price ? tin * price.input + tout * price.output : 0)

  async function worker() {
    for (;;) {
      if (cost() > MAX_USD) return
      const b = batches.shift()
      if (!b) return
      const payload = b.map(r => {
        const next = bySeq.get(r.seq + 1)
        return {
          seq: r.seq,
          entry: r.raw.slice(0, 700),
          ...(/^[—–]/.test(r.raw) ? { previous_author_as_printed: r.headword } : {}),
          ...(next && /^[—–]/.test(next.raw) ? { next_entry_context: next.raw.slice(0, 200) } : {}),
        }
      })
      try {
        const res = await openai.chat.completions.create({
          ...OPENAI_NO_REASONING,
          model: OPENAI_FAST,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(payload) }],
        })
        tin += res.usage?.prompt_tokens ?? 0
        tout += res.usage?.completion_tokens ?? 0
        const out = JSON.parse(res.choices[0]?.message?.content ?? '{}').entries as (LlmFields & { seq: number })[]
        for (const o of out ?? []) {
          const r = bySeq.get(o.seq)
          if (!r || !b.includes(r)) continue
          const { seq, ...llm } = o
          appendFileSync(CACHE, JSON.stringify({ seq, h: hash(r.raw), llm }) + '\n')
          cache.set(seq, { seq, h: hash(r.raw), llm })
        }
      } catch (e) {
        failed++
        console.error(`batch @${b[0].seq} failed: ${String(e).slice(0, 160)}`)
      }
      if (++done % 20 === 0) console.log(`  ${done}/${batches.length} batches, $${cost().toFixed(3)}`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`LLM cost this run: $${cost().toFixed(3)} (${tin} in / ${tout} out), failed batches ${failed}`)
  if (cost() > MAX_USD) console.log(`STOPPED at --max-usd=${MAX_USD}`)

  // Merge: stage-0 row + llm fields; year from the parser wins, the LLM fills gaps
  // only with a year that literally occurs in the raw text.
  const merged = rows.map(r => {
    const llm = cache.get(r.seq)?.h === hash(r.raw) ? cache.get(r.seq)!.llm : null
    let year = r.year
    let year_basis = r.year_basis
    if (year == null && llm?.decree_year && r.raw.includes(String(llm.decree_year))) {
      year = llm.decree_year
      year_basis = 'llm_decree'
    }
    // Name guard: an identification must share its opening with the printed
    // headword ("Diperor" → Diderot, "Quixer" → Quinet); "Acuwets" → Artemidorus
    // does not, so it is demoted and the printed form is kept.
    let author_guard: 'ok' | 'demoted' | null = null
    if (llm?.author && llm.author_confidence === 'high' && r.headword) {
      const h = fold(r.headword).slice(0, 2)
      const ok = llm.author.split(/[\s'’-]+/).some(t => fold(t).startsWith(h))
      author_guard = ok ? 'ok' : 'demoted'
      if (!ok) llm.author_confidence = 'low'
    }
    return { ...r, year, year_basis, llm, author_guard }
  })
  writeFileSync(OUT, JSON.stringify(merged, null, 1))
  const withLlm = merged.filter(m => m.llm)
  const cls: Record<string, number> = {}
  for (const m of withLlm) cls[m.llm!.class] = (cls[m.llm!.class] ?? 0) + 1
  const books = withLlm.filter(m => m.llm!.class === 'book')
  console.log(`→ ${OUT}: ${withLlm.length} rows with llm fields`, cls)
  console.log(`llm books: ${books.length}, with year ${books.filter(b => b.year != null).length}, author high ${books.filter(b => b.llm!.author_confidence === 'high').length}, low ${books.filter(b => b.llm!.author_confidence === 'low').length}, anonymous ${books.filter(b => !b.llm!.author).length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
