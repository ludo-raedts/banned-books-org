/**
 * Continuously find and fill missing book cover images.
 * Tracks failed searches persistently in cover_search_attempts table.
 *
 * Tries (in order) per book:
 *   1. Open Library by ISBN-13
 *   2. Open Library by work ID
 *   3. Open Library search (title + author)
 *   4. Google Books by ISBN-13
 *   5. Google Books by title + author
 *
 * Skips books already in cover_search_attempts unless
 * they were imported after their last search attempt.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-covers-continuous.ts
 *   npx tsx --env-file=.env.local scripts/enrich-covers-continuous.ts --once
 *   npx tsx --env-file=.env.local scripts/enrich-covers-continuous.ts --limit=100
 *   npx tsx --env-file=.env.local scripts/enrich-covers-continuous.ts --no-google
 *   npx tsx --env-file=.env.local scripts/enrich-covers-continuous.ts --delay=60
 *   npx tsx --env-file=.env.local scripts/enrich-covers-continuous.ts --reset
 */

import { adminClient } from '../src/lib/supabase'

const ONCE      = process.argv.includes('--once')
const NO_GOOGLE = process.argv.includes('--no-google')
const RESET     = process.argv.includes('--reset')
const limitArg  = process.argv.find(a => a.startsWith('--limit='))
const LIMIT     = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity
const delayArg  = process.argv.find(a => a.startsWith('--delay='))
const LOOP_DELAY_S = delayArg ? parseInt(delayArg.split('=')[1]) : 30

const OL_DELAY_MS   = 100
const GB_DELAY_MS   = 300
const BOOK_DELAY_MS = 150

const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Validation ───────────────────────────────────────────────────────────────

async function isValidOLImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: OL_HEADERS })
    if (!res.ok) return false
    const len = parseInt(res.headers.get('content-length') ?? '0')
    return len > 1000
  } catch { return false }
}

async function isValidGBImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    if (!res.ok) return false
    const ct = res.headers.get('content-type') ?? ''
    return ct.startsWith('image/')
  } catch { return false }
}

function transformGBUrl(url: string): string {
  return url
    .replace('http://', 'https://')
    .replace('zoom=1', 'zoom=3')
    .replace('&edge=curl', '')
    .replace('edge=curl&', '')
    .replace('edge=curl', '')
}

// ── Open Library ─────────────────────────────────────────────────────────────

async function olByIsbn(isbn13: string): Promise<string | null> {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`
  await sleep(OL_DELAY_MS)
  return (await isValidOLImage(url)) ? url : null
}

async function olByWorkId(workId: string): Promise<string | null> {
  const url = `https://covers.openlibrary.org/b/olid/${workId}-L.jpg`
  await sleep(OL_DELAY_MS)
  return (await isValidOLImage(url)) ? url : null
}

async function olSearch(title: string, author: string): Promise<{ coverUrl: string | null; workId: string | null }> {
  try {
    const params = new URLSearchParams({
      title,
      ...(author ? { author } : {}),
      limit: '3',
      fields: 'key,cover_i,title',
    })
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, { headers: OL_HEADERS })
    await sleep(OL_DELAY_MS)
    if (!res.ok) return { coverUrl: null, workId: null }
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number }> }
    for (const doc of json.docs ?? []) {
      if (doc.cover_i) {
        const coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        if (await isValidOLImage(coverUrl)) {
          return { coverUrl, workId: doc.key?.replace('/works/', '') ?? null }
        }
      }
    }
    const workId = json.docs?.[0]?.key?.replace('/works/', '') ?? null
    return { coverUrl: null, workId }
  } catch { return { coverUrl: null, workId: null } }
}

// ── Google Books ──────────────────────────────────────────────────────────────

async function gbByIsbn(isbn13: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}&fields=items(volumeInfo(imageLinks))`,
    )
    await sleep(GB_DELAY_MS)
    if (!res.ok) return null
    const json = await res.json() as {
      items?: Array<{ volumeInfo: { imageLinks?: { large?: string; medium?: string; thumbnail?: string } } }>
    }
    for (const item of json.items ?? []) {
      const img = item.volumeInfo?.imageLinks?.large
        ?? item.volumeInfo?.imageLinks?.medium
        ?? item.volumeInfo?.imageLinks?.thumbnail
      if (img) {
        const url = transformGBUrl(img)
        if (await isValidGBImage(url)) return url
      }
    }
    return null
  } catch { return null }
}

async function gbBySearch(title: string, author: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`intitle:${title}${author ? ` inauthor:${author}` : ''}`)
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3&fields=items(volumeInfo(title,authors,imageLinks))`,
    )
    await sleep(GB_DELAY_MS)
    if (!res.ok) return null
    const json = await res.json() as {
      items?: Array<{ volumeInfo: { title?: string; imageLinks?: { large?: string; medium?: string; thumbnail?: string } } }>
    }
    for (const item of json.items ?? []) {
      const t = item.volumeInfo?.title ?? ''
      if (!t.toLowerCase().includes(title.slice(0, 10).toLowerCase())) continue
      const img = item.volumeInfo?.imageLinks?.large
        ?? item.volumeInfo?.imageLinks?.medium
        ?? item.volumeInfo?.imageLinks?.thumbnail
      if (img) {
        const url = transformGBUrl(img)
        if (await isValidGBImage(url)) return url
      }
    }
    return null
  } catch { return null }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type BookRow = {
  id: number
  slug: string
  title: string
  isbn13: string | null
  openlibrary_work_id: string | null
  created_at: string | null
  author: string | null
}

// ── DB helpers ────────────────────────────────────────────────────────────────

const supabase = adminClient()

async function recordFailure(bookId: number, sourcesTried: string[]) {
  await supabase.from('cover_search_attempts').upsert(
    {
      book_id: bookId,
      last_searched_at: new Date().toISOString(),
      sources_tried: sourcesTried,
    },
    { onConflict: 'book_id', ignoreDuplicates: false },
  )
  // Manually increment attempts since upsert can't do arithmetic
  await supabase.rpc('increment_cover_attempts', { bid: bookId }).then(() => {}).catch(() => {})
}

async function clearFailure(bookId: number) {
  await supabase.from('cover_search_attempts').delete().eq('book_id', bookId)
}

async function fetchBooksToSearch(loopStart: Date): Promise<{ books: BookRow[]; skippedCount: number }> {
  // Books without cover that haven't been searched yet, or were imported after their last search
  const { data: eligible, error } = await supabase
    .from('books')
    .select(`
      id, slug, title, isbn13, openlibrary_work_id, created_at,
      cover_search_attempts!left(book_id, last_searched_at),
      book_authors!left(authors!left(display_name))
    `)
    .is('cover_url', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('DB error:', error.message)
    return { books: [], skippedCount: 0 }
  }

  type RawRow = {
    id: number; slug: string; title: string; isbn13: string | null
    openlibrary_work_id: string | null; created_at: string | null
    cover_search_attempts: Array<{ book_id: number; last_searched_at: string }> | null
    book_authors: Array<{ authors: { display_name: string } | null }> | null
  }

  const all = (eligible ?? []) as unknown as RawRow[]

  const toSearch: BookRow[] = []
  let skippedCount = 0

  for (const row of all) {
    const attempt = row.cover_search_attempts?.[0] ?? null
    if (attempt) {
      const importedAt = row.created_at ? new Date(row.created_at) : null
      const searchedAt = new Date(attempt.last_searched_at)
      if (!importedAt || importedAt <= searchedAt) {
        skippedCount++
        continue
      }
    }
    toSearch.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      isbn13: row.isbn13,
      openlibrary_work_id: row.openlibrary_work_id,
      created_at: row.created_at,
      author: row.book_authors?.[0]?.authors?.display_name ?? null,
    })
  }

  return { books: toSearch.slice(0, LIMIT === Infinity ? toSearch.length : LIMIT), skippedCount }
}

// ── Display ───────────────────────────────────────────────────────────────────

const counters = { olIsbn: 0, olWorkId: 0, olSearch: 0, gbIsbn: 0, gbSearch: 0, found: 0, failed: 0 }
let lastBook = ''
let loopNum = 0
const startedAt = new Date().toLocaleTimeString()

function printStatus(totalMissing: number, skippedCount: number, toTry: number, skipListSize: number) {
  process.stdout.write('\x1b[2J\x1b[H')
  const line = '═'.repeat(47)
  console.log(line)
  console.log('Cover enrichment — running continuously')
  console.log('Press Ctrl+C to stop')
  console.log(line)
  console.log(`Loop #${loopNum} | Started: ${startedAt}`)
  console.log(`Books without cover: ${totalMissing}`)
  console.log(`  Already searched (skipping): ${skippedCount}`)
  console.log(`  New/updated books to try:    ${toTry}`)
  console.log(`  ✓ Found this loop:           ${counters.found}`)
  console.log(`  ✗ Added to skip list:        ${counters.failed}`)
  console.log(`Total in skip list: ${skipListSize}`)
  if (lastBook) console.log(`Last: ${lastBook}`)
  console.log(line)
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function runLoop() {
  loopNum++
  counters.olIsbn = 0; counters.olWorkId = 0; counters.olSearch = 0
  counters.gbIsbn = 0; counters.gbSearch = 0; counters.found = 0; counters.failed = 0

  const { data: countData } = await supabase
    .from('books').select('*', { count: 'exact', head: true }).is('cover_url', null)
  const totalMissing = (countData as unknown as number | null) ?? 0

  const { data: skipData } = await supabase
    .from('cover_search_attempts').select('*', { count: 'exact', head: true })
  const skipListSize = (skipData as unknown as number | null) ?? 0

  const loopStart = new Date()
  const { books, skippedCount } = await fetchBooksToSearch(loopStart)

  printStatus(totalMissing as unknown as number, skippedCount, books.length, skipListSize)

  for (const book of books) {
    const author = book.author ?? ''
    const sourcesTried: string[] = []
    let coverUrl: string | null = null
    let source = ''

    // 1. OL by ISBN
    if (!coverUrl && book.isbn13) {
      sourcesTried.push('ol_isbn')
      coverUrl = await olByIsbn(book.isbn13)
      if (coverUrl) { source = 'OL ISBN ✓'; counters.olIsbn++ }
    }

    // 2. OL by work ID
    if (!coverUrl && book.openlibrary_work_id) {
      sourcesTried.push('ol_workid')
      coverUrl = await olByWorkId(book.openlibrary_work_id)
      if (coverUrl) { source = 'OL work ID ✓'; counters.olWorkId++ }
    }

    // 3. OL search
    if (!coverUrl) {
      sourcesTried.push('ol_search')
      const { coverUrl: url, workId } = await olSearch(book.title, author)
      if (url) { coverUrl = url; source = 'OL search ✓'; counters.olSearch++ }
      if (workId && !book.openlibrary_work_id) {
        await supabase.from('books').update({ openlibrary_work_id: workId }).eq('id', book.id)
      }
    }

    // 4. Google Books by ISBN
    if (!coverUrl && !NO_GOOGLE && book.isbn13) {
      sourcesTried.push('google_isbn')
      coverUrl = await gbByIsbn(book.isbn13)
      if (coverUrl) { source = 'GB ISBN ✓'; counters.gbIsbn++ }
    }

    // 5. Google Books search
    if (!coverUrl && !NO_GOOGLE) {
      sourcesTried.push('google_search')
      coverUrl = await gbBySearch(book.title, author)
      if (coverUrl) { source = 'GB search ✓'; counters.gbSearch++ }
    }

    if (coverUrl) {
      await supabase.from('books').update({ cover_url: coverUrl }).eq('id', book.id)
      await clearFailure(book.id)
      counters.found++
      lastBook = `"${book.title.slice(0, 35)}" → ${source}`
    } else {
      await supabase.from('cover_search_attempts').upsert(
        { book_id: book.id, last_searched_at: new Date().toISOString(), sources_tried: sourcesTried },
        { onConflict: 'book_id' },
      )
      counters.failed++
      lastBook = `"${book.title.slice(0, 35)}" → not found`
    }

    const { data: newSkipData } = await supabase
      .from('cover_search_attempts').select('*', { count: 'exact', head: true })
    const newSkipSize = (newSkipData as unknown as number | null) ?? skipListSize

    printStatus(
      totalMissing as unknown as number,
      skippedCount,
      books.length,
      newSkipSize,
    )

    await sleep(BOOK_DELAY_MS)
  }

  const { data: finalMissing } = await supabase
    .from('books').select('*', { count: 'exact', head: true }).is('cover_url', null)

  return { stillMissing: (finalMissing as unknown as number | null) ?? 0, processed: books.length }
}

async function main() {
  process.on('SIGINT', () => {
    console.log('\n\nStopped by user.\n')
    process.exit(0)
  })

  if (RESET) {
    const { error } = await supabase.from('cover_search_attempts').delete().neq('book_id', 0)
    if (error) { console.error('Reset failed:', error.message); process.exit(1) }
    console.log('cover_search_attempts table cleared.')
    if (ONCE) process.exit(0)
  }

  while (true) {
    const { stillMissing, processed } = await runLoop()

    if (stillMissing === 0) {
      process.stdout.write('\x1b[2J\x1b[H')
      console.log('All books now have covers. Done.')
      break
    }

    if (ONCE || processed === 0) {
      console.log(`\nDone. ${stillMissing} books still without cover (already searched).`)
      break
    }

    console.log(`\nWaiting ${LOOP_DELAY_S}s before next loop... (Ctrl+C to stop)`)
    await sleep(LOOP_DELAY_S * 1000)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
