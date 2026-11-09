/**
 * Russia — Federal List of Extremist Materials (ФСЭМ, Минюст) — Stap 0 builder.
 *
 * Turns the OFFICIAL full export of the list into a books-only import seed,
 * following scripts/README.md §1 Stap 0. Batch 1 (data/russia-minjust-batch1.json)
 * came from the RSS feed and covered only ~498 entries; this builder reads the
 * complete list (~5,500 numbered entries, #1 … #5523 on 2026-11-09).
 *
 * ⚠️  NEVER TOUCHES SUPABASE. Writes local files under data/ only. The only
 *     network calls are the minjust CSV download (--fetch) and, with --llm,
 *     the OpenAI books-only gate (OPENAI_FAST, cached per entry).
 *
 * Source: https://minjust.gov.ru/uploaded/files/exportfsm.csv (linked from
 *   https://minjust.gov.ru/ru/extremist-materials/ as "Скачать в формате .csv").
 *   Windows-1251, `;`-separated: `#;Материал;Дата включения`. A Russian federal
 *   government register, published for public notice (art. 13 ФЗ-114) — public
 *   record, redistributable as facts.
 *
 * Labelling — every entry gets exactly one of:
 *   excluded  — "исключён": removed from the list (no longer banned) → skipped
 *   not-book  — video/audio/article/leaflet/periodical/site/image/song/brochure…
 *   book      — imported
 *   doubtful  — NOT imported; listed for the editor
 *
 *   Layer 1 (deterministic, free): the material-type noun at the head of the
 *   entry ("Видеоролик …", "Книга …", "Информационный материал – статья …").
 *   The first type-word decides: not-book / book / brochure / unclear.
 *   Brochures are not books (user scope rule; the gate in
 *   src/lib/imports/extraction-prompt.ts excludes pamphlets) — a brochure that
 *   states ≥49 pages is `doubtful` instead.
 *   Layer 2 (LLM, --llm): the shared books-only extraction gate
 *   (extractWithOpenAI, OPENAI_FAST) on every book/unclear entry. It also
 *   returns title/authors/transliteration/English title for the seed.
 *     rule book    + LLM book                     → book
 *     rule book    + LLM not-book                 → doubtful
 *     rule unclear + LLM book + (ISBN or ≥49 pp.) → book
 *     rule unclear + LLM book otherwise           → doubtful
 *     rule unclear + LLM not-book                 → not-book
 *
 * Ban year: the year of the inclusion date (batch-1 convention); the list only
 * records inclusion dates since 2017-01-01, so older entries fall back to the
 * year of the (first) court decision. first_published_year only when the entry
 * states a year next to the publisher/city (PT rule) — taken from the LLM's
 * year_published, which the gate forbids inferring.
 *
 * Outputs:
 *   data/source-research/russia-fsem-export-<date>.csv     (utf-8 copy of the export)
 *   data/source-research/russia-fsem-llm-cache.jsonl       (resumable gate cache)
 *   data/russia-fsem-<date>.json                           (seed: book rows)
 *   data/source-research/russia-fsem-labels-<date>.md      (counts, samples, doubtful list)
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/build-russia-fsem-stage0.ts --fetch            # download + rule labels only
 *   pnpm tsx --env-file=.env.local scripts/build-russia-fsem-stage0.ts --pilot=200 --llm  # evenly spaced pilot sample
 *   pnpm tsx --env-file=.env.local scripts/build-russia-fsem-stage0.ts --llm              # full run (cached, resumable)
 */

import { writeFileSync, readFileSync, existsSync, appendFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { extractWithOpenAI } from '../src/lib/imports/llm-extraction'
import type { Extraction } from '../src/lib/imports/extraction-types'
import { OPENAI_COST_PER_TOKEN, OPENAI_FAST } from '../src/lib/llm-models'
import { hasFlag, intFlag, flagValue } from './lib/cli'

const CSV_URL = 'https://minjust.gov.ru/uploaded/files/exportfsm.csv'
const LIST_URL = 'https://minjust.gov.ru/ru/extremist-materials/'
const SOURCE_NAME = 'Russian Ministry of Justice — Federal List of Extremist Materials'
const DATE = flagValue('date') ?? new Date().toISOString().slice(0, 10)
const CSV_PATH = `data/source-research/russia-fsem-export-${DATE}.csv`
const CACHE_PATH = 'data/source-research/russia-fsem-llm-cache.jsonl'
const SEED_PATH = `data/russia-fsem-${DATE}.json`
const PILOT = intFlag('pilot', 0)
const REPORT_PATH = `data/source-research/russia-fsem-labels-${DATE}${PILOT ? `-pilot${PILOT}` : ''}.md`
const USE_LLM = hasFlag('llm')
const CONCURRENCY = 8
const MIN_BOOK_PAGES = 49 // UNESCO: a book is ≥49 pages; below that a pamphlet

type RuleLabel = 'excluded' | 'not-book' | 'book' | 'brochure' | 'unclear'
type Label = 'excluded' | 'not-book' | 'book' | 'doubtful'

interface Entry {
  n: number
  text: string
  inclusion_date: string | null // ISO
}

// ── fetch + parse ──────────────────────────────────────────────────────────

async function fetchCsv(): Promise<void> {
  const res = await fetch(CSV_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (banned-books.org importer)' } })
  if (!res.ok) throw new Error(`minjust CSV: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const text = new TextDecoder('windows-1251').decode(buf).replace(/\r\n?/g, '\n').replace(/\u0085/g, ' ')
  writeFileSync(CSV_PATH, text)
  console.log(`fetched ${buf.length} bytes → ${CSV_PATH}`)
}

/** `;`-separated, `"`-quoted with `""` escapes; quoted fields may span lines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') q = false
      else field += ch
    } else if (ch === '"') q = true
    else if (ch === ';') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

function loadEntries(): Entry[] {
  const rows = parseCsv(readFileSync(CSV_PATH, 'utf8')).slice(1)
  const out: Entry[] = []
  for (const r of rows) {
    const n = Number.parseInt(r[0]?.trim() ?? '', 10)
    if (!Number.isFinite(n)) continue
    const d = (r[2] ?? '').trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    out.push({ n, text: (r[1] ?? '').replace(/\s+/g, ' ').trim(), inclusion_date: d ? `${d[3]}-${d[2]}-${d[1]}` : null })
  }
  return out
}

// ── layer 1: material-type rule ────────────────────────────────────────────

const NOT_BOOK_PREFIXES = [
  'видео', 'аудио', 'фильм', 'кинофильм', 'мультфильм', 'клип', 'ролик', 'файл',
  'листовк', 'листок', 'журнал', 'газет', 'сайт', 'интернет', 'страниц', 'веб',
  'аккаунт', 'сообществ', 'канал', 'профил', 'изображен', 'рисун', 'плакат', 'фото',
  'картин', 'демотиватор', 'стих', 'песн', 'музык', 'композици', 'альбом', 'обращени',
  'лозунг', 'флаер', 'баннер', 'транспарант', 'надпис', 'символ', 'эмблем', 'комментари',
  'высказывани', 'выступлени', 'интервью', 'граффити', 'http', 'www', 'электронн-',
  'мем', 'стикер', 'открытк', 'календар', 'буклет', 'прокламаци', 'воззвани', 'манифест',
]
const NOT_BOOK_WORDS = new Set([
  'статья', 'статьи', 'статью', 'статей', 'статьей', 'статье', 'запись', 'записи', 'записью',
  'записей', 'пост', 'посты', 'речь', 'лекция', 'проповедь', 'url',
])
const BOOK_WORDS = /^(книга|книги|книгу|книге|книгой|книг|книжка|книжку|книгопечатн\S*|сборник\S*|монографи\S*|роман|повесть|трактат)$/

function headOf(text: string): string {
  const cut = text.search(/[«"“„]/)
  const head = cut >= 4 ? text.slice(0, cut) : text.slice(0, 140)
  return head.toLowerCase().replace(/ё/g, 'е').replace(/c/g, 'с') // Latin c typo ("cтатья")
}

function ruleLabel(text: string): RuleLabel {
  const t = text.toLowerCase()
  // Not \W: in JS that class matches every Cyrillic letter, so "… за исключением …"
  // ("except for") would read as a removed entry.
  if (/^[\s\p{P}\d]*((запись|материал)\s+)?исключ[её]н/u.test(t)) return 'excluded'
  for (const w of headOf(text).split(/[^а-яіїєґa-z0-9-]+/).filter(Boolean)) {
    if (BOOK_WORDS.test(w)) return 'book'
    if (w.startsWith('брошюр')) return 'brochure'
    if (NOT_BOOK_WORDS.has(w) || NOT_BOOK_PREFIXES.some((p) => w.startsWith(p))) return 'not-book'
  }
  return 'unclear'
}

function pagesOf(text: string): number | null {
  const m = text.match(/(\d{2,4})\s*(?:с\.|стр\b|стр\.|страниц|с\s*[;,)])/)
  return m ? Number.parseInt(m[1], 10) : null
}
function isbnOf(text: string): string | null {
  const m = text.match(/ISBN[\s:]*([0-9XХх][0-9XХх\-–\s]{8,20}[0-9XХх])/i)
  if (!m) return null
  const d = m[1].replace(/[^0-9XХх]/g, '').replace(/[Хх]/g, 'X')
  return d.length === 10 || d.length === 13 ? d : null
}
function courtOf(text: string): { decision: string | null; date: string | null } {
  const m = text.match(/(решени[еяю][^;()]*?\sот\s(\d{2})\.(\d{2})\.(\d{4}))/i)
  return m ? { decision: m[1].trim(), date: `${m[4]}-${m[3]}-${m[2]}` } : { decision: null, date: null }
}

// ── layer 2: LLM gate (cached) ─────────────────────────────────────────────

interface CacheRow { n: number; h: string; ex: Extraction | null; err?: string; in: number; out: number }
const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12)

function loadCache(): Map<number, CacheRow> {
  const m = new Map<number, CacheRow>()
  if (!existsSync(CACHE_PATH)) return m
  for (const line of readFileSync(CACHE_PATH, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const r = JSON.parse(line) as CacheRow
    if (r.ex) m.set(r.n, r)
  }
  return m
}

async function runGate(todo: Entry[], cache: Map<number, CacheRow>): Promise<void> {
  const queue = todo.filter((e) => cache.get(e.n)?.h !== hash(e.text))
  console.log(`LLM gate: ${todo.length} candidates, ${queue.length} uncached (${OPENAI_FAST})`)
  let done = 0
  let tin = 0
  let tout = 0
  async function worker() {
    for (;;) {
      const e = queue.shift()
      if (!e) return
      let row: CacheRow
      try {
        const { extraction, usage } = await extractWithOpenAI(e.text)
        row = { n: e.n, h: hash(e.text), ex: extraction, in: usage.input_tokens, out: usage.output_tokens }
      } catch (err) {
        row = { n: e.n, h: hash(e.text), ex: null, err: String(err).slice(0, 200), in: 0, out: 0 }
      }
      appendFileSync(CACHE_PATH, `${JSON.stringify(row)}\n`)
      if (row.ex) cache.set(e.n, row)
      tin += row.in
      tout += row.out
      if (++done % 50 === 0) console.log(`  ${done}/${queue.length}`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  const c = OPENAI_COST_PER_TOKEN[OPENAI_FAST]
  if (c) console.log(`LLM cost this run: $${(tin * c.input + tout * c.output).toFixed(3)} (${tin} in / ${tout} out tokens)`)
}

// ── combine ────────────────────────────────────────────────────────────────

interface Labelled extends Entry {
  rule: RuleLabel
  label: Label
  why: string
  ex: Extraction | null
  pages: number | null
  isbn: string | null
}

function combine(e: Entry, ex: Extraction | null): Labelled {
  const rule = ruleLabel(e.text)
  const pages = pagesOf(e.text)
  const isbn = isbnOf(e.text)
  const base = { ...e, rule, ex, pages, isbn }
  if (rule === 'excluded') return { ...base, label: 'excluded', why: 'removed from the list' }
  if (rule === 'not-book') return { ...base, label: 'not-book', why: 'material type' }
  if (rule === 'brochure') {
    return pages !== null && pages >= MIN_BOOK_PAGES
      ? { ...base, label: 'doubtful', why: `brochure but ${pages} pp.` }
      : { ...base, label: 'not-book', why: 'brochure' }
  }
  if (!ex) return { ...base, label: 'doubtful', why: USE_LLM ? 'LLM gate failed' : 'LLM gate not run' }
  if (rule === 'book') {
    return ex.is_book ? { ...base, label: 'book', why: 'type=книга + gate' } : { ...base, label: 'doubtful', why: 'type=книга but gate says not-book' }
  }
  if (!ex.is_book) return { ...base, label: 'not-book', why: 'gate' }
  if (isbn || (pages !== null && pages >= MIN_BOOK_PAGES)) {
    return { ...base, label: 'book', why: `gate + ${isbn ? 'ISBN' : `${pages} pp.`}` }
  }
  return { ...base, label: 'doubtful', why: 'gate says book, type unclear, no ISBN/page count' }
}

// ── seed rows ──────────────────────────────────────────────────────────────

function seedRow(l: Labelled) {
  const ex = l.ex as Extraction
  const court = courtOf(l.text)
  const year = Number.parseInt((l.inclusion_date ?? court.date ?? '').slice(0, 4), 10) || null
  return {
    fsem_entry: l.n,
    title: ex.title_native,
    title_native_script: ex.title_native_script,
    title_transliterated: ex.title_transliterated,
    title_english_meaningful: ex.title_english_meaningful,
    original_language: ex.original_language,
    authors: ex.authors.map((a) => ({
      name_native: a.name_native,
      name_transliterated: a.name_transliterated,
      name_english: a.name_english,
    })),
    first_published_year: ex.year_published,
    isbn: l.isbn,
    pages: l.pages,
    country_code: 'RU',
    year,
    year_basis: l.inclusion_date ? 'inclusion_date' : court.date ? 'court_decision' : null,
    inclusion_date: l.inclusion_date,
    court_decision: court.decision,
    court_decision_date: court.date,
    scope_slug: 'government',
    action_type: 'banned',
    source_url: LIST_URL,
    source_name: SOURCE_NAME,
    label_why: l.why,
    gate_confidence: ex.confidence,
    raw_description: l.text,
  }
}

// ── main ───────────────────────────────────────────────────────────────────

function pick<T>(xs: T[], k: number): T[] {
  if (xs.length <= k) return xs
  return Array.from({ length: k }, (_, i) => xs[Math.floor((i * xs.length) / k)])
}

async function main() {
  if (hasFlag('fetch') || !existsSync(CSV_PATH)) await fetchCsv()
  const all = loadEntries()
  const entries = PILOT ? pick(all, PILOT) : all
  console.log(`${all.length} entries (#${all[0]?.n} … #${all.at(-1)?.n}); labelling ${entries.length}`)

  const cache = loadCache()
  if (USE_LLM) {
    const needGate = entries.filter((e) => ['book', 'unclear'].includes(ruleLabel(e.text)))
    await runGate(needGate, cache)
  }
  const labelled = entries.map((e) => {
    const c = cache.get(e.n)
    return combine(e, c && c.h === hash(e.text) ? c.ex : null)
  })

  const count = (pred: (l: Labelled) => boolean) => labelled.filter(pred).length
  const byLabel = (lab: Label) => labelled.filter((l) => l.label === lab)
  const ruleCounts = ['excluded', 'not-book', 'book', 'brochure', 'unclear'].map((r) => `${r}=${count((l) => l.rule === r)}`).join(' ')
  const live = labelled.length - byLabel('excluded').length
  const pct = (k: number) => `${((100 * k) / Math.max(live, 1)).toFixed(1)}%`

  const lines: string[] = []
  lines.push(`# Russia FSEM — books-only labels (${DATE}${PILOT ? `, pilot ${PILOT}` : ''})`, '')
  lines.push(`Source: ${CSV_URL} — ${all.length} entries (#${all[0]?.n} … #${all.at(-1)?.n}).`, '')
  lines.push(`Rule layer: ${ruleCounts}`, '')
  lines.push('| label | n | share of live entries |', '|---|---|---|')
  for (const lab of ['book', 'doubtful', 'not-book'] as Label[]) lines.push(`| ${lab} | ${byLabel(lab).length} | ${pct(byLabel(lab).length)} |`)
  lines.push(`| excluded (removed from list) | ${byLabel('excluded').length} | — |`, '')
  for (const lab of ['book', 'not-book', 'doubtful'] as Label[]) {
    const rows = lab === 'doubtful' ? byLabel(lab) : pick(byLabel(lab), 8)
    lines.push(`## ${lab}${lab === 'doubtful' ? ' (all — NOT imported)' : ' (samples)'}`, '')
    for (const l of rows) lines.push(`- **#${l.n}** _(${l.why})_ — ${l.text.slice(0, 400)}`)
    lines.push('')
  }
  writeFileSync(REPORT_PATH, lines.join('\n'))
  console.log(lines.slice(0, 12).join('\n'))
  console.log(`report → ${REPORT_PATH}`)

  if (!PILOT && USE_LLM) {
    const seed = {
      source: { name: SOURCE_NAME, url: LIST_URL, csv_url: CSV_URL, fetched: DATE, entries_total: all.length },
      books: byLabel('book').map(seedRow),
      doubtful: byLabel('doubtful').map((l) => ({ fsem_entry: l.n, why: l.why, raw_description: l.text })),
    }
    writeFileSync(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`)
    console.log(`seed → ${SEED_PATH}: ${seed.books.length} books, ${seed.doubtful.length} doubtful`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
