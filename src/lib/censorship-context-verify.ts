/**
 * Deterministic helpers for the source-verification pass over
 * books.censorship_context (scripts/verify-censorship-context.ts).
 *
 * The pass lets an LLM search, quote and rewrite, but every step that decides
 * whether a text may be published is checked here in plain code:
 *
 *   - a source URL must be one the search tool actually returned, and must not
 *     be on the deny list (our own site, forums, retailers, study-guide mills);
 *   - a quote must occur character for character on the page WE fetched
 *     (quoteOnPage) — a paraphrased or invented quote is dropped;
 *   - every number in a rewritten sentence must occur in the quotes that
 *     sentence cites, and every proper noun on the cited pages
 *     (sentenceGroundingProblems).
 *
 * Why: the 2026-11-11 UX review found the unsourced AI history contradicting
 * the ban text on the same page (1984: 1988 vs 1990). "A second model thinks
 * it is fine" is not a source. A literal quote on a cited page is.
 */

// ── Source policy ───────────────────────────────────────────────────────

// Never a source. Our own domain is circular (the old text was published
// here); the rest are user-generated, commercial, or essay/study-guide sites
// that restate ban folklore without sources.
const DENY_HOST_SUFFIXES = [
  'banned-books.org',
  'reddit.com', 'quora.com', 'facebook.com', 'x.com', 'twitter.com', 'instagram.com',
  'tiktok.com', 'youtube.com', 'youtu.be', 'pinterest.com', 'tumblr.com', 'threads.net',
  'linkedin.com', 'medium.com', 'substack.com', 'blogspot.com', 'wordpress.com',
  'goodreads.com', 'amazon.com', 'amazon.co.uk', 'bookshop.org', 'barnesandnoble.com',
  'abebooks.com', 'thriftbooks.com', 'audible.com', 'storygraph.com', 'librarything.com',
  'sparknotes.com', 'gradesaver.com', 'supersummary.com', 'litcharts.com', 'shmoop.com',
  'cliffsnotes.com', 'coursehero.com', 'studocu.com', 'bartleby.com', 'ipl.org',
  '123helpme.com', 'studymoose.com', 'ivypanda.com', 'edubirdie.com', 'gradesfixer.com',
  'studycorgi.com', 'enotes.com', 'bookrags.com', 'study.com', 'brainly.com', 'chegg.com',
  'scribd.com', 'prezi.com', 'slideshare.net', 'quizlet.com', 'answers.com',
  'fandom.com', 'wikiwand.com', 'alchetron.com', 'everybodywiki.com', 'kiddle.co',
  'dbpedia.org', 'wikimili.com', 'grokipedia.com',
]

export type SourceTier = 'institutional' | 'reference' | 'other'

const INSTITUTIONAL_HOSTS = [
  'ala.org', 'pen.org', 'ncac.org', 'indexoncensorship.org', 'loc.gov', 'archives.gov',
  'courtlistener.com', 'law.cornell.edu', 'oyez.org', 'justia.com', 'freedomtoread.ca',
  'eff.org', 'aclu.org', 'firstamendment.mtsu.edu', 'thefire.org', 'unesco.org',
  'bl.uk', 'nypl.org', 'everylibrary.org', 'cbldf.org',
]
const REFERENCE_HOSTS = ['wikipedia.org', 'britannica.com', 'encyclopedia.com', 'wikisource.org']

export function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
}

function hostMatches(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`)
}

export function isDeniedSource(url: string): boolean {
  const host = hostOf(url)
  if (!host) return true
  return DENY_HOST_SUFFIXES.some(s => hostMatches(host, s))
}

export function sourceTier(url: string): SourceTier {
  const host = hostOf(url)
  if (INSTITUTIONAL_HOSTS.some(s => hostMatches(host, s))) return 'institutional'
  if (/\.(gov|edu)$/.test(host) || /\.(gov|ac|edu)\.[a-z]{2}$/.test(host)) return 'institutional'
  if (REFERENCE_HOSTS.some(s => hostMatches(host, s))) return 'reference'
  return 'other'
}

/** URL identity without tracking params, fragment, trailing slash, host case. */
export function normUrl(u: string): string {
  try {
    const url = new URL(u)
    for (const k of [...url.searchParams.keys()]) if (k.startsWith('utm_')) url.searchParams.delete(k)
    url.hash = ''
    return `${url.host.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${url.search}`
  } catch {
    return u
  }
}

/** The URL as we store and show it: no tracking params, no text fragment. */
export function cleanUrl(u: string): string {
  try {
    const url = new URL(u)
    for (const k of [...url.searchParams.keys()]) if (k.startsWith('utm_')) url.searchParams.delete(k)
    url.hash = ''
    return url.toString()
  } catch {
    return u
  }
}

// ── HTML → text ─────────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', shy: '', eacute: 'é',
  egrave: 'è', agrave: 'à', uuml: 'ü', ouml: 'ö', auml: 'ä', szlig: 'ß', ccedil: 'ç',
  ntilde: 'ñ', iacute: 'í', oacute: 'ó', aacute: 'á', uacute: 'ú', copy: '©', middot: '·',
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' '
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m
  })
}

export function htmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m) return null
  const t = decodeEntities(m[1]).replace(/\s+/g, ' ').trim()
  return t || null
}

/**
 * Readable text of a page: scripts, styles, navigation and footnote markers
 * removed, block ends as newlines. Not a renderer — only good enough to find
 * the passage a human would see when opening the link.
 */
export function htmlToText(html: string): string {
  let s = html
  s = s.replace(/<!--[\s\S]*?-->/g, ' ')
  s = s.replace(/<(script|style|noscript|svg|template|iframe|head|nav|footer|form|button|select)\b[\s\S]*?<\/\1>/gi, ' ')
  // Wikipedia-style footnote markers: <sup class="reference">[12]</sup>
  s = s.replace(/<sup\b[^>]*>[\s\S]{0,120}?<\/sup>/gi, '')
  s = s.replace(/<(?:br|hr)\b[^>]*>/gi, '\n')
  s = s.replace(/<\/(?:p|div|li|ul|ol|h[1-6]|tr|table|blockquote|section|article|dd|dt|figcaption)>/gi, '\n')
  s = s.replace(/<\/(?:td|th)>/gi, ' | ')
  s = s.replace(/<[^>]+>/g, ' ')
  s = decodeEntities(s)
  s = s.replace(/\[\s*(?:\d{1,3}|citation needed|edit|note \d+)\s*\]/gi, '')
  s = s.replace(/[ \t\f\v ]+/g, ' ')
  s = s.replace(/ ?\n ?/g, '\n').replace(/\n{2,}/g, '\n')
  s = s.replace(/ +([,.;:!?)\]])/g, '$1').replace(/([(\[]) +/g, '$1')
  return s.trim()
}

// ── Quote matching ──────────────────────────────────────────────────────

/** Typography-insensitive form used ONLY to compare a quote with a page. */
export function normForMatch(s: string): string {
  return s.normalize('NFKC')
    .replace(/[‘’‚′`´]/g, "'")
    .replace(/[“”„″«»]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/­/g, '')
    .replace(/\[\s*(?:\d{1,3}|citation needed|edit|note \d+)\s*\]/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/ +([,.;:!?)\]])/g, '$1').replace(/([(\[]) +/g, '$1')
    .trim()
    .toLowerCase()
}

export const MIN_QUOTE_CHARS = 40
export const MAX_QUOTE_CHARS = 500

/** True when `quote` occurs as one contiguous passage in `pageText`. */
export function quoteOnPage(quote: string, pageText: string): boolean {
  const q = normForMatch(quote)
  if (q.length < MIN_QUOTE_CHARS || q.length > MAX_QUOTE_CHARS) return false
  return normForMatch(pageText).includes(q)
}

// ── Focus window ────────────────────────────────────────────────────────

function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * The parts of a long page that mention the book: ±radius characters around
 * every occurrence of a needle (title, author surname), merged, capped.
 * Returns null when no needle occurs — the page is not about this book.
 * Folding keeps string length, so indices map back onto the original text.
 */
export function focusText(text: string, needles: string[], radius = 1500, cap = 16000): string | null {
  const hay = fold(text)
  if (hay.length !== text.length) {
    // NFD expansion changed the length (precomposed accents): fall back to a
    // plain lowercase scan so offsets stay valid.
    return focusPlain(text, needles, radius, cap)
  }
  return focusOn(text, hay, needles.map(fold), radius, cap)
}

function focusPlain(text: string, needles: string[], radius: number, cap: number): string | null {
  return focusOn(text, text.toLowerCase(), needles.map(n => n.toLowerCase()), radius, cap)
}

function focusOn(text: string, hay: string, needles: string[], radius: number, cap: number): string | null {
  const spans: Array<[number, number]> = []
  for (const n of needles) {
    if (n.length < 3) continue
    let from = 0
    for (let hits = 0; hits < 60; hits++) {
      const i = hay.indexOf(n, from)
      if (i < 0) break
      spans.push([Math.max(0, i - radius), Math.min(text.length, i + n.length + radius)])
      from = i + n.length
    }
  }
  if (spans.length === 0) return null
  if (text.length <= cap) return text
  spans.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const sp of spans) {
    const last = merged[merged.length - 1]
    if (last && sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1])
    else merged.push([sp[0], sp[1]])
  }
  const parts: string[] = []
  let used = 0
  for (const [a, b] of merged) {
    if (used >= cap) break
    const piece = text.slice(a, Math.min(b, a + (cap - used)))
    parts.push(piece)
    used += piece.length
  }
  return parts.join('\n[…]\n')
}

// ── Sentence grounding (deterministic) ──────────────────────────────────

const NOUN_STOP = new Set([
  'the', 'a', 'an', 'in', 'on', 'at', 'it', 'its', 'he', 'she', 'they', 'this', 'that', 'these',
  'those', 'after', 'before', 'when', 'while', 'during', 'under', 'although', 'however', 'both',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
  'october', 'november', 'december',
])

function wordTokens(s: string): string[] {
  return fold(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
}

export interface GroundingInput {
  sentence: string
  /** Verbatim quotes the sentence cites. */
  quotes: string[]
  /** Full text of the pages those quotes come from. */
  pageTexts: string[]
  /** Words that need no evidence: the book's own title and author. */
  allowWords: string[]
  /** The book's title, removed before the number scan ("1984", "Fahrenheit 451"). */
  title?: string
}

// A sentence that dates an event relative to "now" cannot be published: the
// quote's "last year" is relative to the day the source was written, and
// "remains banned" was true on that day only.
const RELATIVE_TIME_RE = /\b(?:(?:last|this|next|past) (?:year|month|week|decade|century|spring|summer|fall|autumn|winter)|recently|currently|nowadays|today|yesterday|to date|so far|at present|years? ago|months? ago|remains?|(?:is|are|has been|have been) still|as of (?:now|today|this writing))\b/i

/** Share of very common English words — enough to tell an English page from a French or German one. */
export function looksEnglish(text: string): boolean {
  const words = text.slice(0, 20000).toLowerCase().split(/[^a-z']+/).filter(Boolean)
  if (words.length < 80) return true
  let hits = 0
  for (const w of words) if (w === 'the' || w === 'and' || w === 'of' || w === 'was' || w === 'in' || w === 'to') hits++
  return hits / words.length > 0.08
}

/**
 * Problems that make a rewritten sentence unpublishable regardless of what a
 * model says about it:
 *   relative:<p> a time expression relative to "now" ("last year", "remains")
 *   number:<n>  a year or other number that is not in the cited quotes
 *   name:<w>    a capitalised word (not sentence-initial, not the book's own
 *               title/author) that occurs nowhere on the cited pages
 * Numbers are held to the quote; names to the page, because a table row or a
 * section heading often carries the country or body while the quote carries
 * the event. The name check only runs against English pages: an English
 * sentence over a Le Monde quote says "French" where the page says "français".
 */
export function sentenceGroundingProblems(input: GroundingInput): string[] {
  const problems: string[] = []
  const rel = input.sentence.match(RELATIVE_TIME_RE)
  if (rel) problems.push(`relative:${rel[0]}`)

  const quoteText = normForMatch(input.quotes.join(' \n '))
  const quoteDigits = quoteText.replace(/(\d)[,.](?=\d{3}\b)/g, '$1')

  // The title is the book's name, not a claim: "1984 was banned until 1988".
  const noTitle = input.title ? input.sentence.split(input.title).join(' ') : input.sentence
  for (const m of noTitle.matchAll(/\d[\d,.]*\d|\d/g)) {
    const n = m[0].replace(/[,.](?=\d{3}\b)/g, '').replace(/[.,]$/, '')
    const re = new RegExp(`(?<![\\d])${n.replace(/[.]/g, '\\.')}(?![\\d])`)
    if (!re.test(quoteDigits)) problems.push(`number:${n}`)
  }

  if (!input.pageTexts.every(looksEnglish)) return problems

  const allow = new Set(input.allowWords.flatMap(wordTokens))
  const pageWords = new Set(input.pageTexts.flatMap(wordTokens))
  const quoteWords = new Set(wordTokens(input.quotes.join(' ')))
  // Drop quoted titles and the first word of each sentence before scanning.
  const body = input.sentence.replace(/["“][^"”]{1,120}["”]/g, ' ')
  const seen = new Set<string>()
  for (const part of body.split(/(?<=[.!?])\s+/)) {
    const words = part.split(/\s+/)
    for (let i = 1; i < words.length; i++) {
      const raw = words[i].replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, '').replace(/['’]s$/i, '')
      if (raw.length < 3 || !/^[A-ZÀ-Þ]/.test(raw)) continue
      for (const w of wordTokens(raw)) {
        if (w.length < 3 || NOUN_STOP.has(w) || allow.has(w) || seen.has(w)) continue
        seen.add(w)
        if (!quoteWords.has(w) && !pageWords.has(w)) problems.push(`name:${raw}`)
      }
    }
  }
  return problems
}
