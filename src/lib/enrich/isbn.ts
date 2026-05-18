// Core ISBN-13 enrichment logic, callable from either the CLI script
// (scripts/enrich-isbn.ts) or the in-process API route
// (/api/admin/enrich/run). Strategy:
//   0. Prefilter structurally unsearchable rows (placeholder titles, pinyin-
//      only zh rows without an English fallback) → no network at all.
//   1. Open Library search title+author → isbn13 + matched record title
//   2. Google Books API → ISBN_13 + matched volumeInfo title
//   Title-similarity guard rejects any candidate whose matched record title
//   has too little overlap with the query (catches 9798-prefix POD
//   collisions and other "top-popular-doc-wins" false positives).

import { adminClient } from '../supabase'
import { titleLadder } from './_title-ladder'

const OL_DELAY_MS = 400
const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }

// Minimum word-containment similarity between the query title and the title
// of the record OL/GB returned. Below this, treat as a false positive.
// 0.5 = at least half the smaller set's significant words must overlap.
// Tuned by walking the 2026-05-18 run: catches "The Bible → Far Eastern Art"
// and the 9798-POD collisions while passing series-Vol matches.
const TITLE_MATCH_THRESHOLD = 0.5

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function pickIsbn13(isbns: string[]): string | null {
  return isbns.find(s => s.length === 13 && (s.startsWith('978') || s.startsWith('979'))) ?? null
}

// Placeholder/structured titles that NEVER produce a meaningful API hit. The
// search engines fall back to ranking-by-popularity, which means a row like
// "Suicide (Title only, no further information)" matches whatever random
// book is most-cited for "suicide" — guaranteed false positive.
const PLACEHOLDER_TITLE_PATTERNS: RegExp[] = [
  /\(title only,?\s*no further inform/i,
  /\(title and author only,?\s*no further inform/i,
  /\(series,?\s*title not specifi?ed/i, // tolerates the 'Specifed' typo in DB
  /\(journal article/i,
  /\s\(series\)\s*$/i,
]

export function isPlaceholderTitle(t: string): boolean {
  return PLACEHOLDER_TITLE_PATTERNS.some(re => re.test(t))
}

// Pinyin-romanised Chinese titles with no English-meaningful fallback have a
// near-zero OL/GB hit rate; the matches that DO come back are virtually
// always wrong (top-popular-doc bias). Skip to preserve API budget and
// avoid contaminating the catalogue. Native-script and english_meaningful
// rows still go through the normal title ladder.
export function isPinyinOnlyZh(b: {
  title: string
  title_english_meaningful: string | null
  original_language: string | null
}): boolean {
  if (b.original_language !== 'zh') return false
  if (b.title_english_meaningful?.trim()) return false
  // Pure ASCII → no CJK → pinyin romanisation. (Punctuation/digits are fine.)
  return /^[\x00-\x7F]+$/.test(b.title)
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by',
  'from', 'or', 'is', 'as', 'be', 'it', 'de', 'la', 'el', 'le', 'les', 'du',
  'des', 'un', 'une', 'y', 'en', 'der', 'die', 'das', 'und', 'van', 'het',
  'vol', 'volume',
])

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !STOPWORDS.has(w)),
  )
}

// Containment, not Jaccard: how much of the shorter title is covered by the
// longer one. Series titles ("Soul Eater" vs "Soul Eater, Vol. 1") score 1.0;
// unrelated titles ("Flight" vs "Blade") score 0.
export function titleContainment(a: string, b: string): number {
  const A = tokenize(a)
  const B = tokenize(b)
  if (A.size === 0 || B.size === 0) return 0
  const smaller = A.size <= B.size ? A : B
  const larger = A.size <= B.size ? B : A
  let hits = 0
  for (const w of smaller) if (larger.has(w)) hits++
  return hits / smaller.size
}

type SearchHit = { isbn: string; matchedTitle: string }

async function searchOL(title: string, author: string): Promise<SearchHit | null> {
  const q = encodeURIComponent(`${title}${author ? ` ${author}` : ''}`)
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${q}&fields=isbn,title&limit=5`,
      { headers: OL_HEADERS },
    )
    if (!res.ok) return null
    const json = (await res.json()) as { docs: Array<{ isbn?: string[]; title?: string }> }
    for (const doc of json.docs ?? []) {
      const isbn = pickIsbn13(doc.isbn ?? [])
      if (isbn) return { isbn, matchedTitle: doc.title ?? '' }
    }
    return null
  } catch {
    return null
  }
}

async function searchGoogleBooks(title: string, author: string): Promise<SearchHit | null> {
  try {
    const q = encodeURIComponent(`intitle:${title}${author ? ` inauthor:${author}` : ''}`)
    const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as {
      items?: Array<{
        volumeInfo: {
          title?: string
          industryIdentifiers?: Array<{ type: string; identifier: string }>
        }
      }>
    }
    for (const item of json.items ?? []) {
      for (const id of item.volumeInfo?.industryIdentifiers ?? []) {
        if (id.type === 'ISBN_13') return { isbn: id.identifier, matchedTitle: item.volumeInfo?.title ?? '' }
      }
    }
    return null
  } catch {
    return null
  }
}

export type EnrichIsbnOpts = {
  apply: boolean
  limit?: number
  onProgress?: (msg: string) => void
}

export type EnrichIsbnResult = {
  totalCandidates: number
  processed: number
  foundOl: number
  foundOlTitle: number
  foundGb: number
  notFound: number
  skippedDup: number
  skippedPrefilter: number
  rejectedLowSimilarity: number
  errors: number
  samples: Array<{ title: string; isbn: string | null; source: string }>
}

export async function enrichIsbn(opts: EnrichIsbnOpts): Promise<EnrichIsbnResult> {
  const log = opts.onProgress ?? (() => {})
  const supabase = adminClient()

  type BookRow = {
    id: number
    slug: string
    title: string
    title_native: string | null
    title_transliterated: string | null
    title_english_meaningful: string | null
    original_language: string | null
    book_authors: Array<{ authors: { display_name: string } | null }>
  }

  const books: BookRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, title_native, title_transliterated, title_english_meaningful, original_language, book_authors(authors(display_name))')
      .is('isbn13', null)
      // "— All works" pseudo-titles are author-omnibus records with no real ISBN;
      // any OL/GB hit is by construction wrong (will match some random book by the author).
      .not('title', 'ilike', '%— All works%')
      .order('title')
      .range(offset, offset + 999)
    if (error) throw new Error(`DB read: ${error.message}`)
    if (!data?.length) break
    books.push(...(data as unknown as BookRow[]))
    if (data.length < 1000) break
    offset += 1000
  }

  log(`Books without ISBN-13: ${books.length}`)

  const totalCandidates = books.length
  // Drop rows where the title is structurally unsearchable BEFORE we spend
  // any API budget on them. These would only ever produce false positives.
  const eligibleBooks = books.filter(b => !isPlaceholderTitle(b.title) && !isPinyinOnlyZh(b))
  const skippedPrefilter = books.length - eligibleBooks.length
  if (skippedPrefilter > 0) {
    log(`Prefilter dropped ${skippedPrefilter} unsearchable rows (placeholder titles / pinyin-only zh)`)
  }

  const dryLimit = Math.min(10, eligibleBooks.length)
  const limit = opts.apply
    ? Math.min(eligibleBooks.length, opts.limit ?? Number.POSITIVE_INFINITY)
    : dryLimit

  if (limit === 0) {
    return { totalCandidates, processed: 0, foundOl: 0, foundOlTitle: 0, foundGb: 0, notFound: 0, skippedDup: 0, skippedPrefilter, rejectedLowSimilarity: 0, errors: 0, samples: [] }
  }

  log(`${opts.apply ? `Enriching ${limit} of ${eligibleBooks.length} eligible books…` : `DRY-RUN — sampling ${limit} books`}`)

  let foundOl = 0, foundOlTitle = 0, foundGb = 0, notFound = 0, skippedDup = 0, rejectedLowSimilarity = 0, errors = 0
  const samples: EnrichIsbnResult['samples'] = []

  for (let i = 0; i < limit; i++) {
    const book = eligibleBooks[i]
    const author = book.book_authors?.[0]?.authors?.display_name ?? ''
    const ladder = titleLadder(book)
    let isbn: string | null = null
    let source = ''

    // Walk the ladder. For each variant try OL+author, then GB+author. Any
    // hit must pass the title-similarity guard against the variant we
    // searched with — catches the OL/GB "top-popular-doc wins" bias where
    // a search for an obscure title returns the ISBN of an unrelated bestseller.
    // First passing hit wins; source gets a variant tag (e.g. 'OL:english_meaningful')
    // when the winning variant isn't canonical.
    let rejectedThisBook = 0
    outer: for (const variant of ladder) {
      const tag = variant.source === 'canonical' ? '' : `:${variant.source}`

      for (const [name, fn] of [
        ['OL', searchOL] as const,
        ['GB', searchGoogleBooks] as const,
      ]) {
        const hit = await fn(variant.title, author)
        if (name === 'OL') await sleep(OL_DELAY_MS)
        if (!hit) continue
        const sim = titleContainment(variant.title, hit.matchedTitle)
        if (sim < TITLE_MATCH_THRESHOLD) {
          rejectedThisBook++
          continue
        }
        isbn = hit.isbn
        source = `${name}${tag}`
        break outer
      }
    }
    if (!isbn && rejectedThisBook > 0) rejectedLowSimilarity++

    if (isbn) {
      log(`  [${i + 1}/${limit}] ${book.title.slice(0, 50)} → ${isbn} [${source}]`)
      // OL-title-only branch retired 2026-05-16; foundOlTitle stays at 0
      // for API back-compat with /api/admin/enrich/run consumers.
      if (source.startsWith('OL')) foundOl++
      else foundGb++

      if (samples.length < 10) samples.push({ title: book.title, isbn, source })

      if (opts.apply) {
        // Pre-check: candidate ISBN may already be claimed by another row.
        // Catches OL/GB false positives where a search returns a different
        // book's ISBN (e.g. POD reprints sharing 9798-prefix space).
        const { data: clash } = await supabase
          .from('books')
          .select('id, title')
          .eq('isbn13', isbn)
          .neq('id', book.id)
          .maybeSingle()
        if (clash) {
          log(`    ⤳ skip: ${isbn} already on book #${clash.id} (${clash.title.slice(0, 40)})`)
          skippedDup++
        } else {
          const { error } = await supabase
            .from('books')
            .update({ isbn13: isbn })
            .eq('id', book.id)
            .is('isbn13', null)
          if (error) {
            log(`    ✗ DB write failed: ${error.message}`)
            errors++
          }
        }
      }
    } else {
      const tag = rejectedThisBook > 0 ? ` (rejected ${rejectedThisBook} low-sim)` : ''
      log(`  [${i + 1}/${limit}] ${book.title.slice(0, 50)} → not found${tag}`)
      notFound++
      if (samples.length < 10) samples.push({ title: book.title, isbn: null, source: '' })
    }
  }

  return { totalCandidates, processed: limit, foundOl, foundOlTitle, foundGb, notFound, skippedDup, skippedPrefilter, rejectedLowSimilarity, errors, samples }
}
