/**
 * Index Librorum Prohibitorum, 1877 edition (Pius IX, "usque ad annum 1876",
 * Romae 1877) — Stap 0 builder (READ-ONLY, never touches Supabase).
 *
 * Source (public domain, open OCR on archive.org):
 *   https://archive.org/details/index-librorum-prohibitorum-catholic
 *   curl -sL -o data/index-1877/index-1877-djvu.txt \
 *     "https://archive.org/download/index-librorum-prohibitorum-catholic/Index%20Librorum%20Prohibitorum%20-%20Catholic_djvu.txt"
 *   (data/index-1877/ is gitignored.)
 *
 *   npx tsx scripts/build-index-1877-stage0.ts [--in=…] [--date=YYYY-MM-DD] [--sample=200]
 *   → data/index-1877/stage0-<date>.json (+ sample-<date>.json with --sample)
 *
 * Layout: after the preface rules (the "libri omnes de …" category bans, which
 * are not books and are skipped), the alphabetical list runs from the
 * "LIBRORUM PROHIBITORUM" heading to the end, including the 1877 appendix.
 * Entries are paragraphs: `SURNAME Firstname. Title. Decr. <d>. <month> <year>.`
 * or, for anonymous works, `TITLE-HEADWORD rest of title. Decr. …`. A line
 * starting with "—" is a further work of the same author. Entries wrap over
 * lines and pages; page headers ("— 109 —", "Index libr. prohibit") are noise.
 *
 * year = DECREE year (= ban year), never the publication year. "Ind. Trid."
 * (Tridentine Index, 1564) and "Ind. Clem." (Clement VIII, 1596) entries carry
 * no decree date; they get the index's promulgation year with year_basis set
 * accordingly, so the importer can decide how to treat them.
 *
 * Classes:
 *   book           — author/title with a work title
 *   blanket-author — "1. Cl." (first class: all works) or "opera omnia" with no
 *                    individual title → is_blanket_works, like Liste Otto
 *   not-a-book     — pastoral letters, decrees, sheets, images, indulgences,
 *                    manuscripts, periodicals, theses, cross-references ("Vide …")
 *   unparseable    — no recognisable author/title split or OCR debris
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { flagValue, intFlag } from './lib/cli'

export const INDEX_1877_SOURCE_NAME =
  'Index librorum prohibitorum … Pii IX Pont. Max. iussu editus, editio novissima … usque ad annum 1876 (Romae 1877)'
export const INDEX_1877_SOURCE_URL = 'https://archive.org/details/index-librorum-prohibitorum-catholic'

const IN = flagValue('in') ?? 'data/index-1877/index-1877-djvu.txt'
const DATE = flagValue('date') ?? new Date().toISOString().slice(0, 10)
const SAMPLE = intFlag('sample', 0)
const OUT_DIR = 'data/index-1877'

export type Index1877Class = 'book' | 'blanket-author' | 'not-a-book' | 'unparseable'
export type Index1877Row = {
  seq: number
  line: number
  raw: string
  class: Index1877Class
  class_reason: string | null
  title: string | null
  authors: string[]
  /** Headword as printed (OCR case noise kept) — the cleanup pass needs it. */
  headword: string
  country_code: 'VA'
  year: number | null
  year_basis: 'decree' | 'decree_group' | 'index_trid_1564' | 'index_clem_1596' | 'llm_decree' | null
  scope_slug: 'government'
  action_type: 'banned' | 'restricted'
  reason_slug: 'religious'
  is_blanket_works: boolean
  language_guess: string | null
  source_url: string
  source_name: string
}

// --- text helpers ----------------------------------------------------------

const PAGE_NOISE = [
  /^[—–-]\s*[\dIVXLCivxlc]+\s*[—–-]\s*$/, // "— 171 —", "— XLV —"
  /^Index\s+libr/i,
  /^[A-Z]\s*$/, // section letters
]
// A bare "1681." line is the tail of a decree date that wrapped, not noise.
const isNoise = (l: string) =>
  PAGE_NOISE.some(r => r.test(l)) || (l.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 3 && !/\b1[5-8]\d\d\b/.test(l))

// "Decr." in OCR: Deer. Dccr. Decr Decret. Deer, …
const DECREE = /\b(?:[DP][ec][ec]r|Dccr|Decret)[.,]?/
const TRID = /\bInd\.?\s*[TP]ri[dg]\b/
const CLEM = /\bInd\.?\s*Clem\b/
// "1. Cl." (OCR also "4. Cl.", "I. CI.") = Tridentine first class: every work of the author.
const FIRST_CLASS = /(?:^|\s)[14I$l]\.\s*C[lI]\./
const OPERA_OMNIA = /\b(opera\s+omnia|omnia\s+opera|opere\s+tutte|oeuvres\s+compl[eè]tes|s[aä]mmtliche\s+(?:werke|schriften))\b/i
const TERMINAL = /(?:\b1[5-8]\d\d\.?|Trid\.?|Clem\.?|omnia\.?|App\.)\s*$/
const CONT_START = /^(?:[a-zà-ÿ\d(.,;:]|(?:Decr|Deer|Dccr|Ind|App|Iul|Tul|Iun|lun|Ian|lan|Aug|Sept|Oct|Nov|Dec|Mart|Apr|Maii|Febr)\b)/

const NOT_A_BOOK: [RegExp, string][] = [
  [/^\s*vide\b|\bVide\s+[A-ZÀ-Þ][^]{0,60}$/, 'cross-reference'],
  // A single letter ("Lettre écrite à …", "Lettera …") — plural collections stay books.
  [/^\s*(lettre|lettera|epistola|letter|brief|carta)\b(?!s)/i, 'letter'],
  [/\b(lettre|instruction)s?\s+pastorale|\bmandement\b|\blitterae\s+pastorales|\bepistola\s+pastoralis|\blettera\s+pastorale|\bhirtenbrief/i, 'pastoral letter'],
  [/\b(folium|folia|foglio|feuille\s+volante|fliegendes\s+blatt)\b/i, 'single sheet'],
  [/\b(manuscript\w*|manoscritt\w*|manuscrit\w*)\b/i, 'manuscript'],
  [/\b(indulgenti\w+|imagines?\b|numismat\w+)/i, 'image/indulgence'],
  [/\b(giornale|gazzetta|journal\s+(?:de|des|du)\b|ephemerides|periodic\w*|zeitschrift|revue\b)/i, 'periodical'],
  [/\b(theses|positiones|conclusiones)\b/i, 'theses'],
  [/^\s*(decretum|decreto|décret)\b/i, 'decree'],
]

// Stopword language guess on the title.
const LANG_WORDS: Record<string, string[]> = {
  la: ['et', 'de', 'in', 'ad', 'cum', 'seu', 'sive', 'libri', 'liber', 'quae', 'qui', 'ex', 'pro', 'eius', 'super', 'circa', 'tractatus', 'per'],
  fr: ['le', 'la', 'les', 'des', 'du', 'et', 'sur', 'pour', 'dans', 'une', 'un', 'avec', 'par', 'histoire', 'au'],
  it: ['il', 'lo', 'gli', 'della', 'delle', 'dello', 'di', 'e', 'con', 'per', 'del', 'nella', 'sopra', 'una', 'che'],
  de: ['der', 'die', 'das', 'und', 'von', 'über', 'mit', 'des', 'ein', 'eine', 'zur', 'zum', 'den', 'im'],
  es: ['el', 'los', 'las', 'del', 'y', 'sobre', 'en', 'con', 'por', 'una', 'historia'],
  en: ['the', 'of', 'and', 'on', 'an', 'to', 'with', 'by', 'concerning'],
  nl: ['het', 'van', 'en', 'een', 'over', 'der', 'tot', 'ende'],
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

const titleCase = (w: string) =>
  w.toLowerCase().replace(/(^|[\s\-'’(])([a-zà-ÿ])/g, (_, p, c) => p + c.toUpperCase())

// Mixed-case OCR of an all-caps headword ("AssrEMIUS", "KxewsTUB") or a proper one.
const isHeadword = (w: string) => {
  const letters = w.replace(/[^A-Za-zÀ-ÿ]/g, '')
  if (letters.length < 2 || !/^[A-ZÀ-Þ]/.test(letters)) return false
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, '').length
  return upper >= 2 || letters.length <= 12
}

// Given-name words in Latinised index form: capitalised, mostly abbreviated, or particles.
const PARTICLE = /^(de|di|da|del|della|van|von|der|le|la|du|des|y|seu|sive|vulgo|alias|\(de\)|\(von\)|\(van\)|\(di\)|\(da\)|\(la\)|\(le\))$/i
const isNameWord = (w: string) => PARTICLE.test(w) || /^[A-ZÀ-Þ][A-Za-zÀ-ÿ'’-]*\.?,?$/.test(w)

/**
 * Split "SURNAME First. Title…" vs anonymous "HEADWORD rest of title". Returns
 * author=null for anonymous works. Abbreviated given names end in "." so the
 * name runs up to the first word that is not a name word, or up to the first
 * full stop after ≥1 given-name word.
 */
function splitAuthor(text: string): { surnameRaw: string; author: string | null; title: string } {
  const words = text.split(/\s+/)
  const head = words[0].replace(/[,.;:]+$/, '')
  // OCR reads a capital I as l in Latin given names: "loan." "los." "lac." → Ioan. Ios. Iac.
  for (let k = 1; k < Math.min(words.length, 4); k++) words[k] = words[k].replace(/^l(?=[a-z]{1,5}\.)/, 'I')
  // Headword followed by a lowercase word, by an inverted article "(la)" "(l')" "(1°)",
  // or by a particle + lowercase word ("Historre de l'Inquisition") → anonymous title.
  const w1 = words[1] ?? ''
  const w2 = words[2] ?? ''
  const anonymous =
    (/^[a-zà-ÿ]/.test(w1) && !PARTICLE.test(w1)) ||
    (/^\((?:la|le|les|il|lo|l['’°]?|1°?|i|gli|der|die|das|el|los|las|o|a|the|een|het|de)\)$/i.test(w1) && /^[a-zà-ÿ]/.test(w2)) ||
    (PARTICLE.test(w1) && !/^\(/.test(w1) && /^[a-zà-ÿ]/.test(w2))
  if (words.length > 1 && anonymous) return { surnameRaw: head, author: null, title: text }
  // Headword ends the name ("ABAELARDUS, seu ABAILARDUS PETR. 1. Cl.")
  const nameParts: string[] = []
  let i = 1
  // "seu/sive VARIANT" alias of the surname — skip it.
  while (i < words.length && /^(seu|sive|vulgo|alias)$/i.test(words[i])) i += 2
  for (; i < words.length && nameParts.length < 4; i++) {
    const w = words[i]
    if (!isNameWord(w)) break
    if (/^\d/.test(w)) break
    nameParts.push(w)
    if (/\.$/.test(w) && !PARTICLE.test(w.replace(/\.$/, '')) && w.length > 2) { i++; break }
    if (/\.$/.test(w)) { i++; break }
  }
  const surname = titleCase(head.replace(/^\W+/, ''))
  const given = nameParts.filter(w => !/^\((de|von|van|di|da|la|le)\)$/i.test(w)).map(w => w.replace(/,$/, ''))
  const particle = nameParts.find(w => /^\((de|von|van|di|da|la|le)\)$/i.test(w))?.replace(/[()]/g, '')
  const author = [given.map(g => (/^[A-ZÀ-Þ]{2,}/.test(g) ? titleCase(g) : g)).join(' '), particle, surname]
    .filter(Boolean)
    .join(' ')
    .trim()
  return { surnameRaw: head, author, title: words.slice(i).join(' ') }
}

function yearOf(text: string): { year: number | null; basis: Index1877Row['year_basis'] } {
  const m = DECREE.exec(text)
  if (m) {
    const after = text.slice(m.index)
    const y = /\b(1[5-8]\d\d)\b/.exec(after)
    if (y) return { year: Number(y[1]), basis: 'decree' }
  }
  // Brief / Bull / S. Off. without the word "Decr."
  const brief = /\b(Brevi|Bulla|Breve|Constit|S\.\s*Off|Congr)\b[^]*?\b(1[5-8]\d\d)\b/.exec(text)
  if (brief) return { year: Number(brief[2]), basis: 'decree' }
  if (CLEM.test(text)) return { year: 1596, basis: 'index_clem_1596' }
  if (TRID.test(text)) return { year: 1564, basis: 'index_trid_1564' }
  return { year: null, basis: null }
}

// Strip the decree/index tail from a title.
function cleanTitle(t: string): string {
  return t
    .replace(new RegExp(`\\s*${DECREE.source}[^]*$`), '')
    .replace(/\s*(?:Donec\s+corr\w*\.?\s*)?(?:[1I$l]\.\s*Cl\.\s*)?(?:App\.?\s*)?Ind\.?\s*[TPC](?:rid|lem)\.?[^]*$/, '')
    .replace(/\s*(?:Brevi|Bulla|Breve)\b[^]*$/, '')
    .replace(/\s*Donec\s+corr\w*\.?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s,;:]+$/, '')
    .trim()
}

// --- main -------------------------------------------------------------------

type Para = { line: number; text: string }

function paragraphs(lines: string[], from: number): Para[] {
  const out: Para[] = []
  let cur: string[] = []
  let start = from
  const flush = () => {
    if (cur.length) out.push({ line: start + 1, text: cur.join('\n') })
    cur = []
  }
  for (let i = from; i < lines.length; i++) {
    const l = lines[i].replace(/^[\s'‘’";|!~*]+(?=[A-Za-zÀ-ÿ—])/, '').trimEnd()
    if (!l.trim()) { flush(); continue }
    if (isNoise(l.trim())) continue
    if (!cur.length) start = i
    cur.push(l.trim())
  }
  flush()
  return out
}

function entries(paras: Para[]): Para[] {
  const out: Para[] = []
  for (const p of paras) {
    const ls = p.text.split('\n')
    let chunk: string[] = []
    let chunkLine = p.line
    const push = () => {
      if (!chunk.length) return
      const text = chunk.join('\n')
      const prev = out[out.length - 1]
      // A paragraph that continues the previous (unterminated) entry across a page break.
      const prevOpen = prev && !TERMINAL.test(prev.text.replace(/\s+$/, ''))
      if (prev && ((prevOpen && CONT_START.test(text)) || /^[—–]?\s*Latine\b/i.test(text))) prev.text += '\n' + text
      else out.push({ line: chunkLine, text })
      chunk = []
    }
    ls.forEach((l, k) => {
      const prevLine = chunk[chunk.length - 1]
      // "— Latine: …" is the Latin gloss of the title above, not another work.
      const startsDash = /^[—–]\s/.test(l) && !/^[—–]\s*Latine\b/i.test(l)
      const newHead = prevLine && TERMINAL.test(prevLine) && isHeadword(l.split(/\s+/)[0]) && !CONT_START.test(l)
      if (chunk.length && (startsDash || newHead)) { push(); chunkLine = p.line + k }
      chunk.push(l)
    })
    push()
  }
  return out
}

export function buildIndex1877(text: string): Index1877Row[] {
  const lines = text.split('\n')
  const startIdx = lines.findIndex((l, i) => i > 2000 && /^LIBRORUM PROHIBITORUM\s*$/.test(l.trim()))
  if (startIdx < 0) throw new Error('main-list heading not found')
  const ents = entries(paragraphs(lines, startIdx + 1))

  const rows: Index1877Row[] = []
  let lastAuthor: { surnameRaw: string; author: string | null } | null = null
  ents.forEach((e, seq) => {
    const raw = e.text.replace(/-\n/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
    const isSub = /^[—–]\s/.test(raw)
    const body = raw.replace(/^[—–]\s*/, '')
    const { year, basis } = yearOf(body)
    const restricted = /\bDonec\s+(corr|expurg)/i.test(body)

    let surnameRaw: string
    let author: string | null
    let title: string
    if (isSub) {
      surnameRaw = lastAuthor?.surnameRaw ?? ''
      author = lastAuthor?.author ?? null
      title = body
    } else {
      ;({ surnameRaw, author, title } = splitAuthor(body))
      lastAuthor = { surnameRaw, author }
    }
    title = cleanTitle(title)

    let cls: Index1877Class = 'book'
    let reason: string | null = null
    const nab = NOT_A_BOOK.find(([re]) => re.test(title || body))
    const blanketMarker = FIRST_CLASS.test(body) || OPERA_OMNIA.test(body)
    const titleLetters = title.replace(/[^A-Za-zÀ-ÿ]/g, '').length
    if (nab) { cls = 'not-a-book'; reason = nab[1] }
    else if ((FIRST_CLASS.test(body) && titleLetters < 40) || (blanketMarker && (titleLetters < 12 || OPERA_OMNIA.test(title)))) { cls = 'blanket-author'; reason = FIRST_CLASS.test(body) ? '1. Cl.' : 'opera omnia' }
    else if (isSub && !lastAuthor) { cls = 'unparseable'; reason = 'sub-entry without head' }
    else if (titleLetters < 6) { cls = 'unparseable'; reason = 'no title' }
    else if (!isSub && !isHeadword(surnameRaw)) { cls = 'unparseable'; reason = 'no headword' }
    else if (/[^A-Za-zÀ-ÿ\s.,;:'’()\-—&!?\d«»"\[\]]/.test(title) && (title.match(/[^A-Za-zÀ-ÿ\s.,;:'’()\-—&!?\d«»"\[\]]/g)?.length ?? 0) > 3) {
      cls = 'unparseable'; reason = 'ocr debris'
    }

    rows.push({
      seq,
      line: e.line,
      raw,
      class: cls,
      class_reason: reason,
      title: cls === 'blanket-author' ? null : title || null,
      authors: author ? [author] : [],
      headword: surnameRaw,
      country_code: 'VA',
      year,
      year_basis: basis,
      scope_slug: 'government',
      action_type: restricted ? 'restricted' : 'banned',
      reason_slug: 'religious',
      is_blanket_works: cls === 'blanket-author',
      language_guess: cls === 'book' ? guessLanguage(title) : null,
      source_url: INDEX_1877_SOURCE_URL,
      source_name: INDEX_1877_SOURCE_NAME,
    })
  })
  // No group inheritance: in the brace layout the shared decree is printed
  // mid-group and a later work often carries its own, later decree (Heine:
  // De la France … 22 Sept 1836, Neue Gedichte 1845), so "next decree in the
  // run" assigned wrong years. Dateless works stay NULL and are held.
  return rows
}

function summarise(label: string, rows: Index1877Row[]) {
  const n = rows.length
  const pct = (k: number) => `${k} (${((100 * k) / n).toFixed(1)}%)`
  const byClass: Record<string, string> = {}
  for (const c of ['book', 'blanket-author', 'not-a-book', 'unparseable'] as const)
    byClass[c] = pct(rows.filter(r => r.class === c).length)
  const books = rows.filter(r => r.class === 'book')
  const nb = books.length || 1
  const byBasis: Record<string, string> = {}
  for (const b of ['decree', 'decree_group', 'index_trid_1564', 'index_clem_1596', null] as const) {
    const k = books.filter(r => r.year_basis === b).length
    byBasis[String(b)] = `${k} (${((100 * k) / nb).toFixed(1)}% of books)`
  }
  const lang: Record<string, number> = {}
  for (const r of books) lang[r.language_guess ?? '?'] = (lang[r.language_guess ?? '?'] ?? 0) + 1
  console.log(`\n== ${label}: ${n} entries ==`)
  console.table(byClass)
  console.log('book year basis:'); console.table(byBasis)
  console.log('book anonymous (no author):', books.filter(r => !r.authors.length).length, '| restricted (donec corrigatur):', books.filter(r => r.action_type === 'restricted').length)
  console.log('book language guess:', lang)
}

function main() {
  const rows = buildIndex1877(readFileSync(IN, 'utf8'))
  mkdirSync(OUT_DIR, { recursive: true })
  const out = `${OUT_DIR}/stage0-${DATE}.json`
  writeFileSync(out, JSON.stringify(rows, null, 1))
  console.log(`${rows.length} entries → ${out}`)
  summarise('FULL', rows)
  if (SAMPLE > 0) {
    const step = rows.length / SAMPLE
    const sample = Array.from({ length: SAMPLE }, (_, i) => rows[Math.floor(i * step)])
    const sOut = `${OUT_DIR}/sample-${DATE}.json`
    writeFileSync(sOut, JSON.stringify(sample, null, 1))
    summarise(`SAMPLE (every ${step.toFixed(1)}th)`, sample)
    console.log(`→ ${sOut}`)
  }
}

if (process.argv[1]?.endsWith('build-index-1877-stage0.ts')) main()
