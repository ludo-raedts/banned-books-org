/**
 * Enrich books that are missing isbn13 by querying Open Library and Google Books.
 *
 * Strategy (tried in order per book):
 *   1. Open Library search by title+author  → isbn13 from search results
 *   2. Open Library search by title only    → catches author-name mismatches
 *   3. Google Books API                     → industryIdentifiers[type=ISBN_13]
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-isbn.ts
 *     → dry-run: shows counts and 10 sample results, no writes
 *   npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply
 *     → writes isbn13 to DB
 *   npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply --limit=200
 *     → cap at 200 books per run (useful for staged rollouts)
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const MAX = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity

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
      { headers: OL_HEADERS }
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

async function main() {
  console.log(`\n── enrich-isbn (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const supabase = adminClient()

  type BookRow = {
    id: number
    slug: string
    title: string
    book_authors: Array<{ authors: { display_name: string } | null }>
  }

  // Paginate to bypass 1000-row cap
  const books: BookRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, book_authors(authors(display_name))')
      .is('isbn13', null)
      .order('title')
      .range(offset, offset + 999)
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    if (!data?.length) break
    books.push(...(data as unknown as BookRow[]))
    if (data.length < 1000) break
    offset += 1000
  }

  console.log(`Books without ISBN-13: ${books.length}`)
  if (books.length === 0) { console.log('Nothing to do.'); return }

  const limit = APPLY ? Math.min(books.length, MAX) : Math.min(10, books.length)
  console.log(`${APPLY ? `Enriching ${limit} of ${books.length} books…` : `DRY-RUN — sampling ${limit} books:`}\n`)

  let foundOl = 0, foundOlTitle = 0, foundGb = 0, notFound = 0, errors = 0

  for (let i = 0; i < limit; i++) {
    const book = books[i]
    const author = book.book_authors?.[0]?.authors?.display_name ?? ''
    process.stdout.write(`  [${i + 1}/${limit}] ${book.title.slice(0, 50).padEnd(50)} `)

    let isbn: string | null = null
    let source = ''

    // 1. Open Library — title + author
    isbn = await searchOL(book.title, author)
    await sleep(OL_DELAY_MS)
    if (isbn) { source = 'OL' }

    // 2. Open Library — title only (author name mismatch fallback)
    if (!isbn && author) {
      isbn = await searchOL(book.title, '')
      await sleep(OL_DELAY_MS)
      if (isbn) { source = 'OL-title' }
    }

    // 3. Google Books
    if (!isbn) {
      isbn = await searchGoogleBooks(book.title, author)
      if (isbn) { source = 'GB' }
    }

    if (isbn) {
      process.stdout.write(`→ ${isbn}  [${source}]\n`)
      if (source === 'OL') foundOl++
      else if (source === 'OL-title') foundOlTitle++
      else foundGb++

      if (APPLY) {
        const { error } = await supabase
          .from('books')
          .update({ isbn13: isbn })
          .eq('id', book.id)
        if (error) {
          console.error(`    ✗ DB write failed: ${error.message}`)
          errors++
        }
      }
    } else {
      process.stdout.write(`→ not found\n`)
      notFound++
    }
  }

  console.log(`
── Summary ──────────────────────────────
  Found via Open Library (w/ author): ${foundOl}
  Found via Open Library (title only): ${foundOlTitle}
  Found via Google Books:              ${foundGb}
  Total found:                         ${foundOl + foundOlTitle + foundGb}
  Not found:                           ${notFound}
  DB write errors:                     ${errors}
  ${APPLY ? 'Written to DB ✓' : 'DRY-RUN — re-run with --apply to write'}
`)
}

main().catch(e => { console.error(e); process.exit(1) })
