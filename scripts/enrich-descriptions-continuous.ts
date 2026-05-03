/**
 * Continuously find and fill missing book descriptions (description_book IS NULL).
 * Tracks failed searches persistently in description_search_attempts table.
 *
 * Sources tried in order per book:
 *   1. Open Library by work ID  (works/{id}.json)
 *   2. Open Library by ISBN-13  (api/books?bibkeys=ISBN:...)
 *   3. Google Books by ISBN-13
 *   4. Google Books by title + author
 *
 * Skips books already in description_search_attempts unless
 * they were imported after their last search attempt.
 *
 * Requires migration 006_description_search_attempts.sql to be applied first.
 * If the table is missing the script will print the SQL and exit.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-continuous.ts
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-continuous.ts --once
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-continuous.ts --limit=100
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-continuous.ts --no-google
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-continuous.ts --delay=60
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-continuous.ts --reset
 */

import { franc } from 'franc-min'
import { adminClient } from '../src/lib/supabase'

const ONCE      = process.argv.includes('--once')
const NO_GOOGLE = process.argv.includes('--no-google')
const RESET     = process.argv.includes('--reset')
const limitArg  = process.argv.find(a => a.startsWith('--limit='))
const LIMIT     = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity
const delayArg  = process.argv.find(a => a.startsWith('--delay='))
const LOOP_DELAY_S = delayArg ? parseInt(delayArg.split('=')[1]) : 30

const OL_DELAY_MS   = 150
const GB_DELAY_MS   = 300
const BOOK_DELAY_MS = 200

const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const SENTENCE_FINAL = new Set(['.', '?', '!', '"', '’', '”'])
const MIN_LENGTH = 100
const MAX_LENGTH = 1500

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Text cleaning ─────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/__(.+?)__/gs, '$1')
    .replace(/_(.+?)_/gs, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripLeadingEndorsements(text: string): string {
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line === '') { i++; continue }
    if (/^["'"']/.test(line) || /^[–—\-]/.test(line) || /["'"']\s*[–—\-]/.test(line)) {
      i++; continue
    }
    break
  }
  return lines.slice(i).join('\n').trim()
}

function truncateToSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const chunk = text.slice(0, maxLen)
  // Find last sentence-ending punctuation
  let i = chunk.length - 1
  while (i > 0 && !SENTENCE_FINAL.has(chunk[i])) i--
  return i > MIN_LENGTH ? chunk.slice(0, i + 1) : chunk.slice(0, maxLen)
}

function cleanDescription(raw: string): string {
  let text = stripMarkdown(stripLeadingEndorsements(raw)).trim()
  text = truncateToSentence(text, MAX_LENGTH)
  // Ensure ends with punctuation
  if (text && !SENTENCE_FINAL.has(text.slice(-1))) {
    const lastPunct = Math.max(
      text.lastIndexOf('.'),
      text.lastIndexOf('!'),
      text.lastIndexOf('?'),
    )
    if (lastPunct > MIN_LENGTH) text = text.slice(0, lastPunct + 1)
  }
  return text
}

function isValidDescription(text: string): boolean {
  if (text.length < MIN_LENGTH) return false
  const lang = franc(text)
  return lang === 'eng' || lang === 'und'
}

// ── Open Library sources ──────────────────────────────────────────────────────

function extractOLDesc(json: Record<string, unknown>): string | null {
  const raw = json.description
  if (!raw) return null
  if (typeof raw === 'string') return raw.trim() || null
  if (typeof raw === 'object' && 'value' in raw) {
    const v = (raw as { value: unknown }).value
    return typeof v === 'string' ? v.trim() || null : null
  }
  return null
}

async function olByWorkId(workId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org/works/${workId}.json`, { headers: OL_HEADERS })
    await sleep(OL_DELAY_MS)
    if (!res.ok) return null
    return extractOLDesc(await res.json() as Record<string, unknown>)
  } catch { return null }
}

async function olByIsbn(isbn13: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`,
      { headers: OL_HEADERS },
    )
    await sleep(OL_DELAY_MS)
    if (!res.ok) return null
    const json = await res.json() as Record<string, { notes?: string | { value?: string }; description?: string | { value?: string } }>
    const entry = json[`ISBN:${isbn13}`]
    if (!entry) return null
    const raw = entry.description ?? entry.notes
    if (!raw) return null
    if (typeof raw === 'string') return raw.trim() || null
    if (typeof raw === 'object' && 'value' in raw) return (raw.value ?? '').trim() || null
    return null
  } catch { return null }
}

// ── Google Books sources ──────────────────────────────────────────────────────

async function gbByIsbn(isbn13: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}&fields=items(volumeInfo(description,language))`,
    )
    await sleep(GB_DELAY_MS)
    if (!res.ok) return null
    const json = await res.json() as {
      items?: Array<{ volumeInfo: { description?: string; language?: string } }>
    }
    return json.items?.[0]?.volumeInfo?.description ?? null
  } catch { return null }
}

async function gbBySearch(title: string, author: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`intitle:${title}${author ? ` inauthor:${author}` : ''}`)
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3&fields=items(volumeInfo(title,description,language))`,
    )
    await sleep(GB_DELAY_MS)
    if (!res.ok) return null
    const json = await res.json() as {
      items?: Array<{ volumeInfo: { title?: string; description?: string } }>
    }
    const needle = title.slice(0, 12).toLowerCase()
    for (const item of json.items ?? []) {
      if (!(item.volumeInfo?.title ?? '').toLowerCase().includes(needle)) continue
      if (item.volumeInfo?.description) return item.volumeInfo.description
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
  original_language: string | null
  created_at: string | null
  author: string | null
}

// ── DB helpers ────────────────────────────────────────────────────────────────

const supabase = adminClient()

async function checkTableExists(): Promise<boolean> {
  const { error } = await supabase.from('description_search_attempts').select('book_id').limit(1)
  if (!error) return true
  if (error.code === '42P01' || error.message.includes('description_search_attempts')) return false
  return true
}

async function fetchBooksToSearch(): Promise<{ books: BookRow[]; skippedCount: number }> {
  const { data: eligible, error } = await supabase
    .from('books')
    .select(`
      id, slug, title, isbn13, openlibrary_work_id, original_language, created_at,
      description_search_attempts!left(book_id, last_searched_at),
      book_authors!left(authors!left(display_name))
    `)
    .is('description_book', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('DB error:', error.message)
    return { books: [], skippedCount: 0 }
  }

  type RawRow = {
    id: number; slug: string; title: string; isbn13: string | null
    openlibrary_work_id: string | null; original_language: string | null; created_at: string | null
    description_search_attempts: Array<{ book_id: number; last_searched_at: string }> | null
    book_authors: Array<{ authors: { display_name: string } | null }> | null
  }

  const all = (eligible ?? []) as unknown as RawRow[]
  const toSearch: BookRow[] = []
  let skippedCount = 0

  for (const row of all) {
    const attempt = row.description_search_attempts?.[0] ?? null
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
      original_language: row.original_language,
      created_at: row.created_at,
      author: row.book_authors?.[0]?.authors?.display_name ?? null,
    })
  }

  return {
    books: toSearch.slice(0, LIMIT === Infinity ? toSearch.length : LIMIT),
    skippedCount,
  }
}

async function saveDescription(bookId: number, text: string) {
  await supabase.from('books').update({ description_book: text, ai_drafted: false }).eq('id', bookId)
  await supabase.from('description_search_attempts').delete().eq('book_id', bookId)
}

async function recordFailure(bookId: number, sourcesTried: string[]) {
  await supabase.from('description_search_attempts').upsert(
    { book_id: bookId, last_searched_at: new Date().toISOString(), sources_tried: sourcesTried },
    { onConflict: 'book_id' },
  )
}

// ── Display ───────────────────────────────────────────────────────────────────

const counters = { olWorkId: 0, olIsbn: 0, gbIsbn: 0, gbSearch: 0, notFound: 0 }
let lastLine = ''
let loopNum = 0
const startedAt = new Date().toLocaleTimeString()

function printStatus(totalMissing: number, skipped: number, toTry: number, skipListSize: number) {
  process.stdout.write('\x1b[2J\x1b[H')
  const line = '═'.repeat(47)
  const found = counters.olWorkId + counters.olIsbn + counters.gbIsbn + counters.gbSearch
  console.log(line)
  console.log('Description enrichment — running continuously')
  console.log('Press Ctrl+C to stop')
  console.log(line)
  console.log(`Loop #${loopNum} | Started: ${startedAt}`)
  console.log(`Books without description: ${totalMissing}`)
  console.log(`  Already searched (skipping): ${skipped}`)
  console.log(`  New/updated books to try:    ${toTry}`)
  console.log(`  ✓ OL work ID:    ${String(counters.olWorkId).padStart(4)}`)
  console.log(`  ✓ OL ISBN:       ${String(counters.olIsbn).padStart(4)}`)
  console.log(`  ✓ Google ISBN:   ${String(counters.gbIsbn).padStart(4)}`)
  console.log(`  ✓ Google search: ${String(counters.gbSearch).padStart(4)}`)
  console.log(`  ✗ Not found:     ${String(counters.notFound).padStart(4)} (added to skip list)`)
  console.log(`Books still without description: ${Math.max(0, totalMissing - found)}`)
  if (lastLine) console.log(`Last: ${lastLine}`)
  console.log(line)
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function runLoop(): Promise<{ stillMissing: number; processed: number }> {
  loopNum++
  counters.olWorkId = 0; counters.olIsbn = 0; counters.gbIsbn = 0
  counters.gbSearch = 0; counters.notFound = 0

  const { data: countData } = await supabase
    .from('books').select('*', { count: 'exact', head: true }).is('description_book', null)
  const totalMissing = (countData as unknown as number | null) ?? 0

  const { data: skipData } = await supabase
    .from('description_search_attempts').select('*', { count: 'exact', head: true })
  const skipListSize = (skipData as unknown as number | null) ?? 0

  const { books, skippedCount } = await fetchBooksToSearch()

  printStatus(totalMissing as unknown as number, skippedCount, books.length, skipListSize)

  for (const book of books) {
    const author = book.author ?? ''
    const sourcesTried: string[] = []
    let found: string | null = null
    let source = ''

    // 1. OL by work ID
    if (!found && book.openlibrary_work_id) {
      sourcesTried.push('ol_workid')
      const raw = await olByWorkId(book.openlibrary_work_id)
      if (raw) {
        const cleaned = cleanDescription(raw)
        if (isValidDescription(cleaned)) { found = cleaned; source = 'OL work ID' }
      }
    }

    // 2. OL by ISBN
    if (!found && book.isbn13) {
      sourcesTried.push('ol_isbn')
      const raw = await olByIsbn(book.isbn13)
      if (raw) {
        const cleaned = cleanDescription(raw)
        if (isValidDescription(cleaned)) { found = cleaned; source = 'OL ISBN' }
      }
    }

    // 3. Google Books by ISBN
    if (!found && !NO_GOOGLE && book.isbn13) {
      sourcesTried.push('google_isbn')
      const raw = await gbByIsbn(book.isbn13)
      if (raw) {
        const cleaned = cleanDescription(raw)
        if (isValidDescription(cleaned)) { found = cleaned; source = 'Google ISBN' }
      }
    }

    // 4. Google Books search
    if (!found && !NO_GOOGLE) {
      sourcesTried.push('google_search')
      const raw = await gbBySearch(book.title, author)
      if (raw) {
        const cleaned = cleanDescription(raw)
        if (isValidDescription(cleaned)) { found = cleaned; source = 'Google search' }
      }
    }

    if (found) {
      await saveDescription(book.id, found)
      if (source === 'OL work ID') counters.olWorkId++
      else if (source === 'OL ISBN') counters.olIsbn++
      else if (source === 'Google ISBN') counters.gbIsbn++
      else counters.gbSearch++
      lastLine = `✓ ${source} | ${book.title.slice(0, 38)}`
    } else {
      await recordFailure(book.id, sourcesTried)
      counters.notFound++
      lastLine = `✗ notfound | ${book.title.slice(0, 38)}`
    }

    const { data: newSkip } = await supabase
      .from('description_search_attempts').select('*', { count: 'exact', head: true })

    printStatus(
      totalMissing as unknown as number,
      skippedCount,
      books.length,
      (newSkip as unknown as number | null) ?? skipListSize,
    )

    await sleep(BOOK_DELAY_MS)
  }

  const { data: finalCount } = await supabase
    .from('books').select('*', { count: 'exact', head: true }).is('description_book', null)

  return { stillMissing: (finalCount as unknown as number | null) ?? 0, processed: books.length }
}

async function main() {
  // Check migration
  const tableExists = await checkTableExists()
  if (!tableExists) {
    console.error('\n❌  Table description_search_attempts does not exist.')
    console.error('Run this SQL in the Supabase SQL editor first:\n')
    console.error(`CREATE TABLE IF NOT EXISTS description_search_attempts (
  book_id BIGINT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  last_searched_at TIMESTAMPTZ DEFAULT NOW(),
  attempts INTEGER DEFAULT 1,
  sources_tried TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);\n`)
    process.exit(1)
  }

  process.on('SIGINT', () => {
    console.log('\n\nStopped by user.\n')
    process.exit(0)
  })

  if (RESET) {
    const { error } = await supabase.from('description_search_attempts').delete().neq('book_id', 0)
    if (error) { console.error('Reset failed:', error.message); process.exit(1) }
    console.log('description_search_attempts table cleared.')
    if (ONCE) process.exit(0)
  }

  while (true) {
    const { stillMissing, processed } = await runLoop()

    if (stillMissing === 0) {
      process.stdout.write('\x1b[2J\x1b[H')
      console.log('All books now have descriptions. Done.')
      break
    }

    if (ONCE || processed === 0) {
      console.log(`\nDone. ${stillMissing} books still without description (already searched or no source found).`)
      break
    }

    console.log(`\nWaiting ${LOOP_DELAY_S}s before next loop... (Ctrl+C to stop)`)
    await sleep(LOOP_DELAY_S * 1000)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
