/**
 * Dry run: show proposed description_book content for 5 truncated books.
 * Does not write anything to the database.
 *
 * Cleaning rules applied to raw OL / Google Books text:
 *   1. Strip leading endorsement-quote blocks (lines like "Quote." –Name before real prose)
 *   2. Strip markdown formatting (**bold**, *italic*, # headers, etc.)
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

const SENTENCE_FINAL = new Set(['.', '?', '!', '"', '’', '”'])

function isTruncated(desc: string): boolean {
  return !SENTENCE_FINAL.has(desc.trimEnd().slice(-1))
}

// ── Cleaning ────────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')          // # headings
    .replace(/\*\*(.+?)\*\*/g, '$1')    // **bold**
    .replace(/\*(.+?)\*/g, '$1')        // *italic*
    .replace(/__(.+?)__/g, '$1')        // __bold__
    .replace(/_(.+?)_/g, '$1')          // _italic_
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // [link](url)
    .replace(/`(.+?)`/g, '$1')          // `code`
    .replace(/\r\n/g, '\n')
    .trim()
}

// A "leading endorsement block" is one or more lines at the top that are:
//   – a bare quotation (starts with " or ") followed by an attribution line starting with –/—
//   – OR a line starting with a praise word and an attribution
// We drop all such lines until we hit a line that looks like real prose.
function stripLeadingEndorsements(text: string): string {
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()

    // Blank line — skip
    if (line === '') { i++; continue }

    // Starts with an opening quote character or is a plain quote string
    const isQuoteLine = /^[“‘"]/.test(line)
    // Attribution line: starts with – or —, or is just –Name format
    const isAttrLine  = /^[–—\-]/.test(line)
    // Single-line format: "Quote." –Attribution  (both in one line)
    const isSingleLineEndorsement = /[”’"]\s*[–—\-]/.test(line)

    if (isSingleLineEndorsement || isQuoteLine || isAttrLine) {
      i++
      continue
    }

    // Not a quote or attribution — this is where real prose starts
    break
  }

  return lines.slice(i).join('\n').trim()
}

function clean(raw: string): string {
  return stripMarkdown(stripLeadingEndorsements(raw))
}

// ── Open Library ─────────────────────────────────────────────────────────────

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

async function fetchOlWorks(workId: string): Promise<{ text: string; url: string } | null> {
  try {
    const url = `https://openlibrary.org/works/${workId}.json`
    const res = await fetch(url, { headers: { 'User-Agent': 'banned-books-org/1.0' } })
    if (!res.ok) return null
    const json = await res.json() as Record<string, unknown>
    const text = extractOlDescription(json)
    return text ? { text, url } : null
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

async function fetchGoogleBooks(title: string, author: string): Promise<{ text: string; url: string } | null> {
  try {
    const q = encodeURIComponent(`intitle:${title} inauthor:${author}`)
    const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json() as {
      items?: Array<{ volumeInfo: { description?: string; infoLink?: string } }>
    }
    const item = json.items?.[0]
    const desc = item?.volumeInfo?.description
    const link = item?.volumeInfo?.infoLink ?? url
    if (!desc || desc.length < 80) return null
    return { text: desc, url: link }
  } catch { return null }
}

function looksEnglish(text: string): boolean {
  const nonLatin = [...text].filter(c => c.codePointAt(0)! > 0x024f).length
  return nonLatin / text.length < 0.15
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Main ──────────────────────────────────────────────────────────────────────

async function propose(book: {
  slug: string; title: string; description: string | null
  openlibrary_work_id: string | null
  book_authors: { authors: { display_name: string } | null }[]
}): Promise<{ proposed: string | null; sourceUrl: string | null; note: string }> {

  const author = book.book_authors[0]?.authors?.display_name ?? ''
  let workId = book.openlibrary_work_id as string | null
  let result: { text: string; url: string } | null = null

  // 1. Direct OL works fetch
  if (workId) {
    result = await fetchOlWorks(workId)
    await sleep(400)
  }

  // 2. Search OL for work ID if needed
  if (!result) {
    workId = await searchOlWorkId(book.title, author)
    await sleep(400)
    if (workId) {
      result = await fetchOlWorks(workId)
      await sleep(400)
    }
  }

  // 3. Validate OL result
  if (result) {
    const cleaned = clean(result.text)
    if (!looksEnglish(cleaned)) return { proposed: null, sourceUrl: null, note: 'OL text rejected: non-English' }
    if (cleaned.length <= (book.description?.length ?? 0) + 10) {
      result = null // try Google Books
    } else {
      return { proposed: cleaned, sourceUrl: result.url, note: '' }
    }
  }

  // 4. Google Books fallback
  const gb = await fetchGoogleBooks(book.title, author)
  await sleep(400)
  if (gb && looksEnglish(gb.text)) {
    const cleaned = clean(gb.text)
    if (cleaned.length > 80) {
      return { proposed: cleaned, sourceUrl: gb.url, note: 'source: Google Books' }
    }
  }

  return { proposed: null, sourceUrl: null, note: 'no description found' }
}

async function main() {
  const { data: books } = await supabase
    .from('books')
    .select('slug, title, description, openlibrary_work_id, book_authors(authors(display_name))')
    .order('title')

  if (!books) { console.error('No books'); process.exit(1) }

  type Row = typeof books[number]

  const truncated = (books as Row[]).filter(
    b => b.description && isTruncated(b.description as string)
  )
  console.log(`Total truncated: ${truncated.length}\n`)

  // 5 samples spread evenly across the list
  const step = Math.floor(truncated.length / 5)
  const sample = [0, 1, 2, 3, 4].map(i => truncated[Math.min(i * step, truncated.length - 1)])

  for (const book of sample) {
    console.log(`━━━ ${book.title}`)
    console.log(`  slug:    ${book.slug}`)
    console.log(`  before:  "${(book.description as string).slice(0, 100)}…"`)

    const { proposed, sourceUrl, note } = await propose(book as Parameters<typeof propose>[0])

    if (proposed) {
      console.log(`  source:  ${sourceUrl}`)
      console.log(`  length:  ${proposed.length} chars (was ${(book.description as string).length})`)
      console.log(`  after:   "${proposed.slice(0, 200)}${proposed.length > 200 ? '…' : ''}"`)
      if (note) console.log(`  note:    ${note}`)
    } else {
      console.log(`  result:  NO DESCRIPTION FOUND${note ? ` (${note})` : ''}`)
    }
    console.log()
  }
}

main().catch(console.error)
