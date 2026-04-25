/**
 * Fetch covers from Open Library for books that don't have one.
 * Rate-limited to ~1 req/sec to respect Open Library's API.
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchCoverUrl(title: string, author: string): Promise<string | null> {
  // Try title + author search first
  const q = encodeURIComponent(`${title} ${author}`.trim())
  try {
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=5&fields=cover_i,title,author_name`, {
      headers: { 'User-Agent': 'banned-books.org/1.0 (ludo.raedts@voys.nl)' }
    })
    if (!res.ok) return null
    const data = await res.json()
    const doc = (data.docs ?? []).find((d: any) => d.cover_i)
    if (doc?.cover_i) {
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
    }
  } catch {
    // fall through to second attempt
  }

  // Try title-only
  try {
    const qt = encodeURIComponent(title.trim())
    const res = await fetch(`https://openlibrary.org/search.json?title=${qt}&limit=5&fields=cover_i`, {
      headers: { 'User-Agent': 'banned-books.org/1.0 (ludo.raedts@voys.nl)' }
    })
    if (!res.ok) return null
    const data = await res.json()
    const doc = (data.docs ?? []).find((d: any) => d.cover_i)
    if (doc?.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
  } catch {
    return null
  }

  return null
}

async function main() {
  // Get all books without covers, with author info
  const { data: books } = await supabase
    .from('books')
    .select('id, slug, title, cover_url, book_authors(authors(display_name))')
    .is('cover_url', null)
    .order('title')

  if (!books?.length) {
    console.log('No books without covers.')
    return
  }

  console.log(`Found ${books.length} books without covers. Fetching from Open Library...\n`)

  let found = 0
  let notFound = 0

  for (const book of books as any[]) {
    const author = book.book_authors?.[0]?.authors?.display_name ?? ''
    const coverUrl = await fetchCoverUrl(book.title, author)

    if (coverUrl) {
      const { error } = await supabase.from('books').update({ cover_url: coverUrl }).eq('id', book.id)
      if (error) {
        console.log(`  ✗ ${book.slug}: DB error — ${error.message}`)
      } else {
        console.log(`  ✓ ${book.slug}`)
        found++
      }
    } else {
      console.log(`  - ${book.slug}: no cover found`)
      notFound++
    }

    // ~1 req/sec to respect Open Library
    await sleep(1100)
  }

  console.log(`\nDone. Found: ${found}, Not found: ${notFound}`)
}

main().catch(console.error)
