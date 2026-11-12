/**
 * Index Librorum Prohibitorum, 1938 edition (Pius XI, Typis Polyglottis
 * Vaticanis 1938) — Stap 0 builder (READ-ONLY, never touches Supabase).
 *
 * Source (public domain mark, open OCR on archive.org):
 *   https://archive.org/details/index-librorum-prohibitorum-1938
 *   curl -sL -o data/index-1938/index-1938-djvu.txt \
 *     "https://archive.org/download/index-librorum-prohibitorum-1938/Index%20librorum%20prohibitorum%2C%201938_djvu.txt"
 *   (data/index-1938/ is gitignored.)
 *
 *   npx tsx scripts/build-index-1938-stage0.ts [--date=YYYY-MM-DD] [--sample=60]
 *   → data/index-1938/stage0-<date>.json (+ sample-<date>.json with --sample)
 *
 * Why only "new since 1877": the 1877 edition (usque ad annum 1876) is already
 * imported (scripts/build-index-1877-stage0.ts → import-index-1877.ts). This
 * edition re-prints every older entry, so those add nothing; the value is the
 * works decreed 1877–1938. A row is `scope: 'new'` when EVERY decree year
 * printed on the entry is ≥ 1877; `scope: 'older'` (all < 1877) and
 * `scope: 'mixed'` (older work with a later extra decree) are kept in the
 * stage-0 file for the overlap report but not imported.
 *
 * Layout (differs from 1877): entries are blank-line separated paragraphs,
 * `Surname, Given. Title. Decr. [S. Off.] <d> <mon> <year>.`; a line starting
 * with "—" is a further work of the previous author; anonymous works start with
 * the title headword ("Salette (La). …", "Abbecedario, catechismo …"). OCR
 * noise: "Deer." "Decr" "Dccr", digits as letters in dates, "ó" for 6, etc.
 *
 * year = DECREE year (= ban year), never the publication year.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { flagValue, intFlag } from './lib/cli'

export const INDEX_1938_SOURCE_NAME =
  'Index librorum prohibitorum SS.mi D. N. Pii PP. XI iussu editus (Typis Polyglottis Vaticanis, 1938)'
export const INDEX_1938_SOURCE_URL = 'https://archive.org/details/index-librorum-prohibitorum-1938'

const IN = flagValue('in') ?? 'data/index-1938/index-1938-djvu.txt'
const DATE = flagValue('date') ?? new Date().toISOString().slice(0, 10)
const SAMPLE = intFlag('sample', 0)
const OUT_DIR = 'data/index-1938'

export type Index1938Class = 'book' | 'blanket-author' | 'not-a-book' | 'unparseable'
export type Index1938Row = {
  seq: number
  raw: string
  class: Index1938Class
  class_reason: string | null
  scope: 'new' | 'older' | 'mixed' | 'undated'
  title: string | null
  authors: string[]
  headword: string
  country_code: 'VA'
  year: number | null
  decree_years: number[]
  scope_slug: 'government'
  action_type: 'banned' | 'restricted'
  reason_slug: 'religious'
  is_blanket_works: boolean
  language_guess: string | null
  cross_ref: string | null
  source_url: string
  source_name: string
}

const DECREE = /\b(?:[DP][ec][ec]r|Dccr|Decret)[.,]?/
const NOISE_LINE = /^(?:[—–-]\s*[\dIVXLC]+\s*[—–-]|[\dIVXLC]+\s+[A-Z][a-z]{1,3}\s*[-–]\s*[A-Z][a-z]{1,3}|[A-Z][a-z]{1,3}\s*[-–]\s*[A-Z][a-z]{1,3}\s+[\dIVXLC]+)\s*$/

const NOT_A_BOOK: [RegExp, string][] = [
  [/^\s*v\.\s/i, 'cross-reference'],
  [/\b(lettre|instruction)s?\s+pastorale|\bmandement\b|\blettera\s+pastorale|\bhirtenbrief|\blitterae\s+pastorales/i, 'pastoral letter'],
  [/\b(folium|foglio|feuille\s+volante|fliegendes\s+blatt)\b/i, 'single sheet'],
  [/\b(manuscript\w*|manoscritt\w*|manuscrit\w*)\b/i, 'manuscript'],
  [/\b(indulgenti\w+|imagines?\b)/i, 'image/indulgence'],
  [/\b(giornale|gazzetta|ephemerides|periodic\w*|zeitschrift|rivista|revue\b)/i, 'periodical'],
  [/\b(theses|positiones|conclusiones)\b/i, 'theses'],
]

const LANG_WORDS: Record<string, string[]> = {
  la: ['et', 'de', 'in', 'ad', 'cum', 'seu', 'sive', 'libri', 'liber', 'quae', 'qui', 'ex', 'pro', 'eius'],
  fr: ['le', 'la', 'les', 'des', 'du', 'et', 'sur', 'pour', 'dans', 'une', 'un', 'avec', 'par', 'histoire', 'au'],
  it: ['il', 'lo', 'gli', 'della', 'delle', 'dello', 'di', 'e', 'con', 'per', 'del', 'nella', 'sopra', 'una', 'che'],
  de: ['der', 'die', 'das', 'und', 'von', 'über', 'mit', 'des', 'ein', 'eine', 'zur', 'zum', 'den', 'im'],
  es: ['el', 'los', 'las', 'del', 'y', 'sobre', 'en', 'con', 'por', 'una', 'historia'],
  en: ['the', 'of', 'and', 'on', 'an', 'to', 'with', 'by', 'concerning'],
  nl: ['het', 'van', 'en', 'een', 'over', 'tot'],
  pt: ['o', 'os', 'da', 'do', 'das', 'dos', 'e', 'sobre', 'em', 'com'],
}
function guessLanguage(text: string): string | null {
  const words = text.toLowerCase().split(/[^a-zà-ÿ]+/).filter(Boolean)
  let best: string | null = null
  let bestScore = 0
  for (const [lang, sw] of Object.entries(LANG_WORDS)) {
    const set = new Set(sw)
    const score = words.filter(w => set.has(w)).length
    if (score > bestScore) { best = lang; bestScore = score }
  }
  return bestScore >= 1 ? best : null
}

/** All four-digit years 1500–1938 that sit after the "Decr." marker (OCR-tolerant on the leading 1). */
function decreeYears(text: string): number[] {
  const m = DECREE.exec(text)
  const after = m ? text.slice(m.index) : text
  // Trailing footnote digits glue onto years in the OCR ("19351", "17406") — take the first four.
  const ys = [...after.matchAll(/\b[1I](5[6-9]\d|[6-8]\d\d|9[0-3]\d)\d?\b/g)].map(x => Number('1' + x[1]))
  // "Permittitur editio correcta anno 1918" is not a decree year.
  const perm = /Permittitur[^]*$/i.exec(after)
  const permYears = perm ? new Set([...perm[0].matchAll(/\b[1I](9[0-3]\d|[6-8]\d\d)\b/g)].map(x => Number('1' + x[1]))) : new Set<number>()
  return [...new Set(ys.filter(y => !permYears.has(y)))].sort((a, b) => a - b)
}

function cleanTitle(t: string): string {
  return t
    .replace(new RegExp(`\\s*${DECREE.source}[^]*$`), '')
    .replace(/\s*v\.\s+[A-ZÀ-Þ][^]*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s,;:]+$/, '')
    .trim()
}

/** "Surname, Given. Title" vs anonymous "Title headword, rest" / "Salette (La). Title". */
function splitAuthor(text: string): { head: string; authors: string[]; title: string } {
  // Author: Capitalised surname words, comma, then given name(s) ending with a period, then a capital.
  text = text.replace(/\s*[\[(]pseudonymus[\])]/i, '')
  const m = /^([A-ZÀ-Þ][\wÀ-ÿ'’\-]+(?:\s+(?:de|di|da|del|van|von|der|le|la|du|des|y|ben|bar)?\s*[A-ZÀ-Þ][\wÀ-ÿ'’\-]+)?),\s+([A-ZÀ-Þ][\wÀ-ÿ.'’\-]*(?:\s+[A-ZÀ-Þ][\wÀ-ÿ.'’\-]*){0,3}?)\.\s+(?=[A-ZÀ-Þ"«'‘(\[\d])(.*)$/s.exec(text)
  if (!m) return { head: text.split(/[\s,.(]/)[0] ?? '', authors: [], title: text }
  let given = m[1] && m[2]
  let rest = m[3]
  const authors = [`${m[2].replace(/\.$/, '')} ${m[1]}`.replace(/\s+/g, ' ').trim()]
  // Co-authors: "Pietro, e Bonelli, G. Teorie…" — second "Surname, G." after "e " / "et " / "und ".
  const co = /^(?:e|et|und|y|and)\s+([A-ZÀ-Þ][\wÀ-ÿ'’\-]+),\s+([A-ZÀ-Þ][\wÀ-ÿ.'’\-]*(?:\s+[A-ZÀ-Þ][\wÀ-ÿ.'’\-]*){0,2}?)\.\s+(.*)$/s.exec(rest)
  if (co) { authors.push(`${co[2].replace(/\.$/, '')} ${co[1]}`); rest = co[3] }
  void given
  return { head: m[1], authors, title: rest }
}

type Para = { text: string }

function paragraphs(lines: string[], from: number): Para[] {
  const out: Para[] = []
  let cur: string[] = []
  const flush = () => { if (cur.length) out.push({ text: cur.join(' ') }); cur = [] }
  for (let i = from; i < lines.length; i++) {
    const l = lines[i].trim()
    if (!l) { flush(); continue }
    if (/^[A-Z]$/.test(l) || NOISE_LINE.test(l)) continue
    cur.push(l)
  }
  flush()
  // A page break can split one entry in two: a paragraph without a decree marker that is
  // followed by a lowercase-initial continuation is glued to it.
  const merged: Para[] = []
  for (const p of out) {
    const prev = merged[merged.length - 1]
    const prevOpen = prev && !DECREE.test(prev.text) && !/\bv\.\s/.test(prev.text) && !/[.\]]\s*$/.test(prev.text.replace(/\s+$/, '')) && !/^[—–]\s*$/.test(prev.text)
    if (prev && prevOpen && /^[a-zà-ÿ(]/.test(p.text)) prev.text += ' ' + p.text
    else merged.push({ text: p.text })
  }
  return merged
}

export function buildIndex1938(text: string): Index1938Row[] {
  const lines = text.split('\n')
  const heads = lines.map((l, i) => (l.trim() === 'LIBRORUM PROHIBITORUM' ? i : -1)).filter(i => i >= 0)
  const startIdx = heads[1] ?? heads[0]
  if (startIdx === undefined) throw new Error('main-list heading not found')
  const paras = paragraphs(lines, startIdx + 1)

  const rows: Index1938Row[] = []
  let last: { head: string; authors: string[] } | null = null
  paras.forEach((p, seq) => {
    const raw = p.text.replace(/-\s+(?=[a-zà-ÿ])/g, '').replace(/\s+/g, ' ').trim()
    const isSub = /^[—–]\s/.test(raw)
    const body = raw.replace(/^[—–]\s*/, '')
    const years = decreeYears(body)

    let head: string
    let authors: string[]
    let title: string
    if (isSub) {
      head = last?.head ?? ''
      authors = last?.authors ?? []
      title = body
    } else {
      ;({ head, authors, title } = splitAuthor(body))
      // Single-name heading ("Ansault. Le culte …") is the author for the dash entries below it.
      const single = !authors.length ? /^([A-ZÀ-Þ][\wÀ-ÿ'’\-]{2,})\.\s+[A-ZÀ-Þ"«]/.exec(body) : null
      last = { head, authors: authors.length ? authors : single ? [single[1]] : [] }
    }
    const cross = /\bv\.\s+([A-ZÀ-Þ][^.]*(?:\.[^.]*)?)/.exec(body)
    title = cleanTitle(title)

    let cls: Index1938Class = 'book'
    let reason: string | null = null
    const nab = NOT_A_BOOK.find(([re]) => re.test(body))
    const letters = title.replace(/[^A-Za-zÀ-ÿ]/g, '').length
    if (!DECREE.test(body) && /^\s*v\.\s/i.test(body)) { cls = 'not-a-book'; reason = 'cross-reference' }
    else if (!DECREE.test(body) && !years.length) { cls = 'not-a-book'; reason = 'no decree (cross-ref or preface)' }
    else if (nab) { cls = 'not-a-book'; reason = nab[1] }
    else if (/\bopera\s+omnia\b|\bomnia\s+opera\b/i.test(body) && letters < 30) { cls = 'blanket-author'; reason = 'opera omnia' }
    else if (isSub && !last) { cls = 'unparseable'; reason = 'sub-entry without head' }
    else if (letters < 6) { cls = 'unparseable'; reason = 'no title' }
    else if ((title.match(/[^A-Za-zÀ-ÿ\s.,;:'’()\-—&!?\d«»"\[\]]/g)?.length ?? 0) > 3) { cls = 'unparseable'; reason = 'ocr debris' }

    const scope: Index1938Row['scope'] =
      !years.length ? 'undated' : years[0] >= 1877 ? 'new' : years[years.length - 1] >= 1877 ? 'mixed' : 'older'

    rows.push({
      seq,
      raw,
      class: cls,
      class_reason: reason,
      scope,
      title: cls === 'blanket-author' ? null : title || null,
      authors,
      headword: head,
      country_code: 'VA',
      year: scope === 'new' ? years[0] : null,
      decree_years: years,
      scope_slug: 'government',
      action_type: /\bPermittitur\b|\bDonec\s+corr/i.test(body) ? 'restricted' : 'banned',
      reason_slug: 'religious',
      is_blanket_works: cls === 'blanket-author',
      language_guess: cls === 'book' ? guessLanguage(title) : null,
      cross_ref: cross ? cross[1].trim() : null,
      source_url: INDEX_1938_SOURCE_URL,
      source_name: INDEX_1938_SOURCE_NAME,
    })
  })
  return rows
}

function summarise(label: string, rows: Index1938Row[]) {
  console.log(`\n== ${label}: ${rows.length} paragraphs ==`)
  const tab: Record<string, number> = {}
  for (const r of rows) tab[`${r.scope} / ${r.class}`] = (tab[`${r.scope} / ${r.class}`] ?? 0) + 1
  console.table(tab)
  const nb = rows.filter(r => r.scope === 'new' && r.class === 'book')
  console.log('new books:', nb.length, '| anonymous:', nb.filter(r => !r.authors.length).length)
  const byDecade: Record<string, number> = {}
  for (const r of nb) { const d = `${Math.floor((r.year ?? 0) / 10) * 10}s`; byDecade[d] = (byDecade[d] ?? 0) + 1 }
  console.table(byDecade)
}

function main() {
  const rows = buildIndex1938(readFileSync(IN, 'utf8'))
  mkdirSync(OUT_DIR, { recursive: true })
  const out = `${OUT_DIR}/stage0-${DATE}.json`
  writeFileSync(out, JSON.stringify(rows, null, 1))
  console.log(`${rows.length} paragraphs → ${out}`)
  summarise('FULL', rows)
  if (SAMPLE > 0) {
    const nb = rows.filter(r => r.scope === 'new')
    const step = nb.length / SAMPLE
    const sample = Array.from({ length: SAMPLE }, (_, i) => nb[Math.floor(i * step)])
    writeFileSync(`${OUT_DIR}/sample-${DATE}.json`, JSON.stringify(sample, null, 1))
    for (const r of sample) console.log(`${r.class.padEnd(14)} ${r.year} | ${r.authors.join(' & ') || '—'} | ${r.title ?? ''} ${r.cross_ref ? '[v. ' + r.cross_ref + ']' : ''}`.slice(0, 200))
  }
}

if (process.argv[1]?.endsWith('build-index-1938-stage0.ts')) main()
