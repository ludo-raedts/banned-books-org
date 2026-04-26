/**
 * Populate description_book for all books with truncated descriptions.
 * Fetches full text from Open Library works API (or Google Books fallback).
 * Applies two cleaning rules:
 *   1. Strip leading endorsement-quote blocks
 *   2. Strip markdown formatting
 * Writes only to description_book — description_ban is left NULL.
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

const SENTENCE_FINAL = new Set(['.', '?', '!', '"', '’', '”'])

function isTruncated(desc: string): boolean {
  return !SENTENCE_FINAL.has(desc.trimEnd().slice(-1))
}

// ── Cleaning ─────────────────────────────────────────────────────────────────

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
    .trim()
}

function stripLeadingEndorsements(text: string): string {
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line === '') { i++; continue }
    const isQuoteLine = /^[“‘"']/.test(line)
    const isAttrLine  = /^[–—\-]/.test(line)
    const isSingleLine = /[”’"']\s*[–—\-]/.test(line)
    if (isSingleLine || isQuoteLine || isAttrLine) { i++; continue }
    break
  }
  return lines.slice(i).join('\n').trim()
}

function clean(raw: string): string {
  return stripMarkdown(stripLeadingEndorsements(raw))
}

// ── Open Library ──────────────────────────────────────────────────────────────

function extractOlDescription(json: Record<string, unknown>): string | null {
  const raw = json.description
  if (!raw) return null
  if (typeof raw === 'string') return raw.trim() || null
  if (typeof raw === 'object' && 'value' in (raw as object)) {
    const v = (raw as { value: unknown }).value
    return typeof v === 'string' ? v.trim() || null : null
  }
  return null
}

async function fetchOlWorks(workId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org/works/${workId}.json`, {
      headers: { 'User-Agent': 'banned-books-org/1.0' },
    })
    if (!res.ok) return null
    return extractOlDescription(await res.json() as Record<string, unknown>)
  } catch { return null }
}

async function searchOlWorkId(title: string, author: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${q}&fields=key&limit=1`,
      { headers: { 'User-Agent': 'banned-books-org/1.0' } }
    )
    if (!res.ok) return null
    const json = await res.json() as { docs: Array<{ key?: string }> }
    return json.docs?.[0]?.key?.replace('/works/', '') ?? null
  } catch { return null }
}

async function fetchGoogleBooks(title: string, author: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`intitle:${title} inauthor:${author}`)
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`)
    if (!res.ok) return null
    const json = await res.json() as {
      items?: Array<{ volumeInfo: { description?: string } }>
    }
    const desc = json.items?.[0]?.volumeInfo?.description
    return (desc && desc.length >= 80) ? desc : null
  } catch { return null }
}

function looksEnglish(text: string): boolean {
  const nonLatin = [...text].filter(c => c.codePointAt(0)! > 0x024f).length
  return nonLatin / text.length < 0.15
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Per-book resolution ───────────────────────────────────────────────────────

async function resolve(book: {
  title: string
  description: string | null
  openlibrary_work_id: string | null
  book_authors: { authors: { display_name: string } | null }[]
}): Promise<string | null> {
  const author = (book.book_authors as { authors: { display_name: string } | null }[])[0]
    ?.authors?.display_name ?? ''
  const currentLen = book.description?.length ?? 0

  let raw: string | null = null

  // 1. Direct OL works fetch using stored work ID
  if (book.openlibrary_work_id) {
    raw = await fetchOlWorks(book.openlibrary_work_id as string)
    await sleep(600)
  }

  // 2. Search OL if we have no work ID or got nothing
  if (!raw) {
    const workId = await searchOlWorkId(book.title, author)
    await sleep(600)
    if (workId) {
      raw = await fetchOlWorks(workId)
      await sleep(600)
    }
  }

  // 3. Validate OL result
  if (raw) {
    const cleaned = clean(raw)
    if (looksEnglish(cleaned) && cleaned.length > currentLen + 10 && cleaned.length >= 80) {
      return cleaned
    }
    raw = null
  }

  // 4. Google Books fallback
  const gb = await fetchGoogleBooks(book.title, author)
  await sleep(600)
  if (gb) {
    const cleaned = clean(gb)
    if (looksEnglish(cleaned) && cleaned.length >= 80) return cleaned
  }

  return null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { data: books, error } = await supabase
    .from('books')
    .select('id, slug, title, description, openlibrary_work_id, book_authors(authors(display_name))')
    .order('title')

  if (error || !books) { console.error('Fetch failed:', error?.message); process.exit(1) }

  type Row = typeof books[number]
  const truncated = (books as Row[]).filter(
    b => b.description && isTruncated(b.description as string)
  )

  console.log(`Books with truncated descriptions: ${truncated.length}`)
  console.log('Writing to description_book — description_ban left NULL\n')

  let updated = 0, skipped = 0, failed = 0

  for (let i = 0; i < truncated.length; i++) {
    const book = truncated[i] as Row & {
      openlibrary_work_id: string | null
      book_authors: { authors: { display_name: string } | null }[]
    }
    process.stdout.write(`[${i + 1}/${truncated.length}] ${book.title.slice(0, 50).padEnd(50)} `)

    const proposed = await resolve(book)

    if (!proposed) {
      process.stdout.write('— no source found\n')
      skipped++
      continue
    }

    const { error: ue } = await supabase
      .from('books')
      .update({ description_book: proposed })
      .eq('id', book.id)

    if (ue) {
      process.stdout.write(`✗ ${ue.message}\n`)
      failed++
    } else {
      process.stdout.write(`✓ ${proposed.length} chars\n`)
      updated++
    }
  }

  console.log(`\nDone. Updated: ${updated}  Skipped: ${skipped}  Failed: ${failed}`)
}

main().catch(console.error)
