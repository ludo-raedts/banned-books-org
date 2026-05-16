// Core ISBN-13 enrichment logic, callable from either the CLI script
// (scripts/enrich-isbn.ts) or the in-process API route
// (/api/admin/enrich/run). Strategy:
//   1. Open Library search title+author → isbn13
//   2. Open Library search title-only   → catches author-name mismatches
//   3. Google Books API                  → industryIdentifiers ISBN_13

import { adminClient } from '../supabase'
import { titleLadder } from './_title-ladder'

const OL_DELAY_MS = 400
const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function pickIsbn13(isbns: string[]): string | null {
  return isbns.find(s => s.length === 13 && (s.startsWith('978') || s.startsWith('979'))) ?? null
}

async function searchOL(title: string, author: string): Promise<string | null> {
  const q = encodeURIComponent(`${title}${author ? ` ${author}` : ''}`)
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${q}&fields=isbn&limit=5`,
      { headers: OL_HEADERS },
    )
    if (!res.ok) return null
    const json = await res.json() as { docs: Array<{ isbn?: string[] }> }
    for (const doc of json.docs ?? []) {
      const isbn = pickIsbn13(doc.isbn ?? [])
      if (isbn) return isbn
    }
    return null
  } catch { return null }
}

async function searchGoogleBooks(title: string, author: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`intitle:${title}${author ? ` inauthor:${author}` : ''}`)
    const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json() as {
      items?: Array<{
        volumeInfo: {
          industryIdentifiers?: Array<{ type: string; identifier: string }>
        }
      }>
    }
    for (const item of json.items ?? []) {
      for (const id of item.volumeInfo?.industryIdentifiers ?? []) {
        if (id.type === 'ISBN_13') return id.identifier
      }
    }
    return null
  } catch { return null }
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
  const dryLimit = Math.min(10, books.length)
  const limit = opts.apply
    ? Math.min(books.length, opts.limit ?? Number.POSITIVE_INFINITY)
    : dryLimit

  if (limit === 0) {
    return { totalCandidates, processed: 0, foundOl: 0, foundOlTitle: 0, foundGb: 0, notFound: 0, skippedDup: 0, errors: 0, samples: [] }
  }

  log(`${opts.apply ? `Enriching ${limit} of ${books.length} books…` : `DRY-RUN — sampling ${limit} books`}`)

  let foundOl = 0, foundOlTitle = 0, foundGb = 0, notFound = 0, skippedDup = 0, errors = 0
  const samples: EnrichIsbnResult['samples'] = []

  for (let i = 0; i < limit; i++) {
    const book = books[i]
    const author = book.book_authors?.[0]?.authors?.display_name ?? ''
    const ladder = titleLadder(book)
    let isbn: string | null = null
    let source = ''

    // Walk the title ladder; for each variant try OL+author then GB. First
    // hit wins. Source gets a variant tag (e.g. 'OL:english_meaningful')
    // when the winning variant is not canonical.
    //
    // The previous OL-title-only fallback was dropped on 2026-05-16: it
    // was supposed to "catch author-name mismatches" but in practice the
    // most-popular hit for an ambiguous modern title is typically a
    // 19th-century classic with the wrong ISBN. The title ladder already
    // handles real author-name mismatches by retrying with transliterated
    // and English-meaningful title variants; GB-fallback below provides
    // additional recall without OL's bias toward popular hits.
    for (const variant of ladder) {
      if (isbn) break
      const tag = variant.source === 'canonical' ? '' : `:${variant.source}`

      isbn = await searchOL(variant.title, author)
      await sleep(OL_DELAY_MS)
      if (isbn) { source = `OL${tag}`; break }

      isbn = await searchGoogleBooks(variant.title, author)
      if (isbn) { source = `GB${tag}`; break }
    }

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
      log(`  [${i + 1}/${limit}] ${book.title.slice(0, 50)} → not found`)
      notFound++
      if (samples.length < 10) samples.push({ title: book.title, isbn: null, source: '' })
    }
  }

  return { totalCandidates, processed: limit, foundOl, foundOlTitle, foundGb, notFound, skippedDup, errors, samples }
}
