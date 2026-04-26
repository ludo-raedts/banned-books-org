/**
 * Two-pass back-fill for description_book:
 *
 * Pass 1 — copy: books with a full (non-truncated) description but no
 *   description_book yet. Direct copy, no API calls.
 *
 * Pass 2 — retry: books still truncated after the first enrichment run.
 *   Tries title-only OL search and Wikipedia API in addition to the
 *   earlier author-qualified OL search.
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

const SENTENCE_FINAL = new Set(['.', '?', '!', '"', '’', '”'])

function isTruncated(desc: string): boolean {
  return !SENTENCE_FINAL.has(desc.trimEnd().slice(-1))
}

// ── Cleaning (same rules as enrich-descriptions.ts) ──────────────────────────

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
    if (/^["'"']/.test(line) || /^[–—\-]/.test(line) || /["'"']\s*[–—\-]/.test(line)) {
      i++; continue
    }
    break
  }
  return lines.slice(i).join('\n').trim()
}

function clean(raw: string): string {
  return stripMarkdown(stripLeadingEndorsements(raw))
}

function looksEnglish(text: string): boolean {
  const nonLatin = [...text].filter(c => c.codePointAt(0)! > 0x024f).length
  return nonLatin / text.length < 0.15
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

async function searchOlWorkId(query: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(query)
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${q}&fields=key&limit=1`,
      { headers: { 'User-Agent': 'banned-books-org/1.0' } }
    )
    if (!res.ok) return null
    const json = await res.json() as { docs: Array<{ key?: string }> }
    return json.docs?.[0]?.key?.replace('/works/', '') ?? null
  } catch { return null }
}

// ── Wikipedia ─────────────────────────────────────────────────────────────────

async function fetchWikipedia(title: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(title)
    // Use the Wikipedia REST summary endpoint — always English, always prose
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${q}`,
      { headers: { 'User-Agent': 'banned-books-org/1.0' } }
    )
    if (!res.ok) return null
    const json = await res.json() as { extract?: string; type?: string }
    // Reject disambiguation pages
    if (json.type === 'disambiguation') return null
    return json.extract && json.extract.length >= 80 ? json.extract : null
  } catch { return null }
}

// ── Google Books ──────────────────────────────────────────────────────────────

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

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Retry logic for truncated books ──────────────────────────────────────────

async function retryTruncated(book: {
  title: string; description: string | null; openlibrary_work_id: string | null
  book_authors: { authors: { display_name: string } | null }[]
}): Promise<string | null> {
  const author = (book.book_authors as { authors: { display_name: string } | null }[])[0]
    ?.authors?.display_name ?? ''
  const currentLen = book.description?.length ?? 0

  const tryAndClean = async (raw: string | null) => {
    if (!raw) return null
    const c = clean(raw)
    return looksEnglish(c) && c.length > currentLen + 10 && c.length >= 80 ? c : null
  }

  // 1. Title + author OL search (same as before)
  if (book.openlibrary_work_id) {
    const r = await tryAndClean(await fetchOlWorks(book.openlibrary_work_id as string))
    await sleep(500)
    if (r) return r
  }

  let workId = await searchOlWorkId(`${book.title} ${author}`)
  await sleep(500)
  if (workId) {
    const r = await tryAndClean(await fetchOlWorks(workId))
    await sleep(500)
    if (r) return r
  }

  // 2. Title-only OL search
  workId = await searchOlWorkId(book.title)
  await sleep(500)
  if (workId) {
    const r = await tryAndClean(await fetchOlWorks(workId))
    await sleep(500)
    if (r) return r
  }

  // 3. Wikipedia
  const wiki = await tryAndClean(await fetchWikipedia(book.title))
  await sleep(500)
  if (wiki) return wiki

  // 4. Google Books
  const gb = await tryAndClean(await fetchGoogleBooks(book.title, author))
  await sleep(500)
  return gb
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { data: books, error } = await supabase
    .from('books')
    .select('id, slug, title, description, description_book, openlibrary_work_id, book_authors(authors(display_name))')
    .order('title')

  if (error || !books) { console.error('Fetch failed:', error?.message); process.exit(1) }

  type Row = typeof books[number]

  const noCopy  = (books as Row[]).filter(b => !b.description_book)
  const copyable = noCopy.filter(b => b.description && !isTruncated(b.description as string))
  const truncated = noCopy.filter(b => b.description && isTruncated(b.description as string))

  // ── Pass 1: copy ──────────────────────────────────────────────────────────
  console.log(`\nPass 1 — copying full descriptions: ${copyable.length} books`)

  let copied = 0
  for (const book of copyable) {
    const { error: ue } = await supabase
      .from('books')
      .update({ description_book: book.description })
      .eq('id', book.id)
    if (ue) { console.log(`  ✗ ${book.slug}: ${ue.message}`); continue }
    copied++
  }
  console.log(`  Done. Copied: ${copied}`)

  // ── Pass 2: retry truncated ───────────────────────────────────────────────
  console.log(`\nPass 2 — retrying truncated: ${truncated.length} books`)

  let fixed = 0, still = 0
  for (let i = 0; i < truncated.length; i++) {
    const book = truncated[i] as Row & {
      openlibrary_work_id: string | null
      book_authors: { authors: { display_name: string } | null }[]
    }
    process.stdout.write(`[${i + 1}/${truncated.length}] ${book.title.slice(0, 50).padEnd(50)} `)

    const proposed = await retryTruncated(book)
    if (!proposed) {
      process.stdout.write('— not found\n')
      still++
      continue
    }

    const { error: ue } = await supabase
      .from('books')
      .update({ description_book: proposed })
      .eq('id', book.id)

    if (ue) {
      process.stdout.write(`✗ ${ue.message}\n`)
      still++
    } else {
      process.stdout.write(`✓ ${proposed.length} chars\n`)
      fixed++
    }
  }

  console.log(`  Fixed: ${fixed}  Still missing: ${still}`)

  if (still > 0) {
    console.log('\nBooks still needing manual description:')
    for (const b of truncated) {
      const { data } = await supabase.from('books').select('description_book').eq('id', b.id).single()
      if (!data?.description_book) console.log(` ${b.slug}`)
    }
  }

  console.log('\nAll done.')
}

main().catch(console.error)
