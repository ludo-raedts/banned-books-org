/**
 * Find cover images for books that currently have cover_url = NULL.
 *
 * Strategy (tried in order):
 *   1. Open Library search by title+author → cover_i → cover URL
 *   2. Open Library search by title only (catches author-name mismatches)
 *   3. Google Books API → thumbnail image
 *
 * Also stores the OL work ID if we find one (and the book didn't have one).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-covers.ts
 *     → dry-run: shows counts and 5 sample results, no writes
 *   npx tsx --env-file=.env.local scripts/enrich-covers.ts --apply
 *     → writes cover_url (and openlibrary_work_id where found) to DB
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const OL_DELAY_MS = 400

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }

interface OLResult {
  coverUrl: string | null
  workId: string | null
}

async function searchOL(title: string, author: string): Promise<OLResult> {
  const q = encodeURIComponent(`${title}${author ? ` ${author}` : ''}`)
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${q}&fields=key,cover_i&limit=3`,
      { headers: OL_HEADERS }
    )
    if (!res.ok) return { coverUrl: null, workId: null }
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number }> }
    for (const doc of json.docs ?? []) {
      if (doc.cover_i) {
        return {
          coverUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
          workId: doc.key?.replace('/works/', '') ?? null,
        }
      }
    }
    // No cover found — still return workId if present
    const workId = json.docs?.[0]?.key?.replace('/works/', '') ?? null
    return { coverUrl: null, workId }
  } catch { return { coverUrl: null, workId: null } }
}

async function searchGoogleBooks(title: string, author: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`intitle:${title}${author ? ` inauthor:${author}` : ''}`)
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3`)
    if (!res.ok) return null
    const json = await res.json() as {
      items?: Array<{ volumeInfo: { imageLinks?: { thumbnail?: string; smallThumbnail?: string } } }>
    }
    for (const item of json.items ?? []) {
      const img = item.volumeInfo?.imageLinks?.thumbnail ?? item.volumeInfo?.imageLinks?.smallThumbnail
      if (img) {
        // Upgrade to larger image by removing zoom param
        return img.replace('&zoom=1', '').replace('zoom=1&', '').replace('zoom=1', '')
          .replace('http://', 'https://')
      }
    }
    return null
  } catch { return null }
}

async function main() {
  console.log(`\n── enrich-covers (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const supabase = adminClient()

  // Load books with no cover
  const { data, error } = await supabase
    .from('books')
    .select('id, slug, title, openlibrary_work_id, book_authors(authors(display_name))')
    .is('cover_url', null)
    .order('title')
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  type BookRow = {
    id: number; slug: string; title: string
    openlibrary_work_id: string | null
    book_authors: Array<{ authors: { display_name: string } | null }>
  }
  const books = (data ?? []) as unknown as BookRow[]
  console.log(`Books with no cover: ${books.length}`)

  if (books.length === 0) { console.log('Nothing to do.'); return }

  const limit = APPLY ? books.length : Math.min(5, books.length)
  console.log(`\n${APPLY ? `Searching covers for ${books.length} books…` : `DRY-RUN — showing ${limit} samples:`}\n`)

  let foundOl = 0, foundGb = 0, notFound = 0

  for (let i = 0; i < limit; i++) {
    const book = books[i]
    const author = book.book_authors?.[0]?.authors?.display_name ?? ''
    process.stdout.write(`  [${i + 1}/${limit}] ${book.title.slice(0, 50)} `)

    let coverUrl: string | null = null
    let workId: string | null = book.openlibrary_work_id
    let source = ''

    // 1. OL search with author
    const olFull = await searchOL(book.title, author)
    await sleep(OL_DELAY_MS)
    if (olFull.coverUrl) {
      coverUrl = olFull.coverUrl
      workId = workId ?? olFull.workId
      source = 'OL'
    } else if (!workId && olFull.workId) {
      workId = olFull.workId
    }

    // 2. OL title-only (catches author name mismatches)
    if (!coverUrl && author) {
      const olTitle = await searchOL(book.title, '')
      await sleep(OL_DELAY_MS)
      if (olTitle.coverUrl) {
        coverUrl = olTitle.coverUrl
        workId = workId ?? olTitle.workId
        source = 'OL-title'
      }
    }

    // 3. Google Books
    if (!coverUrl) {
      const gb = await searchGoogleBooks(book.title, author)
      if (gb) { coverUrl = gb; source = 'GB' }
    }

    if (!coverUrl) {
      console.log('— not found')
      notFound++
      // Still save the work ID if we found one
      if (APPLY && workId && !book.openlibrary_work_id) {
        await supabase.from('books').update({ openlibrary_work_id: workId }).eq('id', book.id)
      }
      continue
    }

    if (!APPLY) {
      console.log(`— ${source}: ${coverUrl.slice(0, 70)}`)
      if (source === 'OL' || source === 'OL-title') foundOl++; else foundGb++
      continue
    }

    const updates: Record<string, string | null> = { cover_url: coverUrl }
    if (workId && !book.openlibrary_work_id) updates.openlibrary_work_id = workId

    const { error: ue } = await supabase.from('books').update(updates).eq('id', book.id)
    if (ue) { console.log(`— DB error: ${ue.message}`); notFound++ }
    else {
      console.log(`✓ ${source}`)
      if (source.startsWith('OL')) foundOl++; else foundGb++
    }
  }

  console.log(`\n── Done ──`)
  if (APPLY) {
    console.log(`Found via OL          : ${foundOl}`)
    console.log(`Found via Google Books: ${foundGb}`)
    console.log(`Not found             : ${notFound}`)
  } else {
    console.log(`Dry-run complete. Re-run with --apply to write.\n`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
