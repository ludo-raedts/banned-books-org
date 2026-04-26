/**
 * Enrich books with Project Gutenberg IDs via the Gutendex API.
 * Only updates books where gutenberg_id IS NULL.
 * Rate-limited to 1 req/sec out of courtesy to the public API.
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()
const DELAY_MS = 1000

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function normalise(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleMatches(dbTitle: string, gutenbergTitle: string): boolean {
  const a = normalise(dbTitle)
  const b = normalise(gutenbergTitle)
  // Accept if one contains the other (handles subtitles, articles, etc.)
  return a.includes(b) || b.includes(a)
}

async function findGutenbergId(title: string, author: string): Promise<{ id: number; matchedTitle: string } | null> {
  const query = [title, author].filter(Boolean).join(' ')
  const url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json()

    for (const book of data.results ?? []) {
      if (book.copyright !== false) continue
      if (!titleMatches(title, book.title)) continue
      return { id: book.id, matchedTitle: book.title }
    }
  } catch {
    // network error or timeout — skip
  }
  return null
}

async function main() {
  const { data: books, error } = await supabase
    .from('books')
    .select('id, slug, title, book_authors(authors(display_name))')
    .is('gutenberg_id', null)
    .order('title')

  if (error) { console.error(error.message); process.exit(1) }
  console.log(`Checking ${books!.length} books...\n`)

  let found = 0
  for (const book of books!) {
    const author = (book.book_authors as any)?.[0]?.authors?.display_name ?? ''
    const match = await findGutenbergId(book.title, author)

    if (match) {
      const { error: updateError } = await supabase
        .from('books')
        .update({ gutenberg_id: match.id })
        .eq('id', book.id)

      if (updateError) {
        console.log(`  ✗ ${book.slug}: ${updateError.message}`)
      } else {
        console.log(`  ✓ ${book.slug} → gutenberg.org/ebooks/${match.id}  («${match.matchedTitle}»)`)
        found++
      }
    } else {
      console.log(`  – ${book.slug}`)
    }

    await sleep(DELAY_MS)
  }

  console.log(`\nDone. Linked ${found} books to Project Gutenberg.`)
}

main().catch(console.error)
