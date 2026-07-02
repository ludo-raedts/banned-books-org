import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'
import {
  gbVolumesByIsbn,
  gbVolumesByTitleAuthor,
  pickGbImageLink,
  hasGbKey,
} from '@/lib/enrich/google-books'

// GET /api/admin/books/<slug>/cover-candidates
//
// On-request alternative covers for the book editor: the admin clicks "Find
// alternative covers", picks one visually, and saves — the PATCH route then
// stamps cover_status='manual_override' so enrichment never touches it again.
//
// Candidate ladder mirrors scripts/recover-nulled-covers.ts, strongest binding
// first: ISBN-direct OL cover → stored work-id's edition covers → Google Books
// by ISBN → OL title(+author) search → Google Books title search.
//
// NB: this endpoint deliberately reads GB imageLinks without the pHash
// placeholder gate (resolveGbCover) — it only *displays* candidates; the human
// picking from the grid IS the placeholder/namesake gate here, and the chosen
// URL still passes the PATCH allowlist. Nothing is written by this route.

const UA = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }

type Candidate = { url: string; source: string }

async function olJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) })
    return r.ok ? ((await r.json()) as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// ISBN-direct cover; ?default=false makes OL 404 instead of serving a 1×1
// blank, and the content-length floor drops degenerate thumbnails.
async function olIsbnCover(isbn: string): Promise<Candidate[]> {
  try {
    const r = await fetch(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
    })
    if (r.ok && Number(r.headers.get('content-length') || 0) > 2000) {
      return [{ url: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`, source: 'OpenLibrary · ISBN' }]
    }
  } catch {
    /* candidate source is best-effort */
  }
  return []
}

// All cover ids across the stored work's editions — the right cover is often
// not covers[0] (same insight as recover-nulled-covers.ts).
async function olEditionCovers(workId: string): Promise<Candidate[]> {
  const j = await olJson(`https://openlibrary.org/works/${workId}/editions.json?limit=50`)
  const entries = (j?.entries ?? []) as Array<{ covers?: number[] }>
  const ids: number[] = []
  for (const e of entries) for (const c of e.covers ?? []) if (c > 0 && !ids.includes(c)) ids.push(c)
  return ids.slice(0, 5).map((id) => ({
    url: `https://covers.openlibrary.org/b/id/${id}-L.jpg`,
    source: 'OpenLibrary · edition',
  }))
}

async function olSearchCovers(title: string, author: string | null): Promise<Candidate[]> {
  const p = new URLSearchParams({ title, fields: 'key,cover_i,author_name', limit: '5' })
  if (author) p.set('author', author)
  const j = await olJson(`https://openlibrary.org/search.json?${p}`)
  const docs = (j?.docs ?? []) as Array<{ cover_i?: number }>
  return docs
    .filter((d) => d.cover_i && d.cover_i > 0)
    .slice(0, 3)
    .map((d) => ({
      url: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`,
      source: 'OpenLibrary · title search',
    }))
}

async function gbCovers(
  isbn: string | null,
  title: string,
  author: string | null,
): Promise<Candidate[]> {
  if (!hasGbKey()) return []
  const out: Candidate[] = []
  try {
    if (isbn) {
      for (const v of (await gbVolumesByIsbn(isbn)).slice(0, 2)) {
        const url = pickGbImageLink(v.volumeInfo)
        if (url) out.push({ url, source: 'Google Books · ISBN' })
      }
    }
    if (author) {
      for (const v of (await gbVolumesByTitleAuthor(title, author)).slice(0, 3)) {
        const url = pickGbImageLink(v.volumeInfo)
        if (url) out.push({ url, source: 'Google Books · title' })
      }
    }
  } catch {
    /* quota / network — other sources still return */
  }
  return out
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { slug } = await params
  const { data: book } = await adminClient()
    .from('books')
    .select('title, isbn13, openlibrary_work_id, cover_url, book_authors(authors(display_name))')
    .eq('slug', slug)
    .maybeSingle()
  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  const authors = (book.book_authors ?? []) as unknown as Array<{ authors: { display_name: string } | null }>
  const author = authors[0]?.authors?.display_name ?? null

  const settled = await Promise.allSettled([
    book.isbn13 ? olIsbnCover(book.isbn13) : Promise.resolve([]),
    book.openlibrary_work_id ? olEditionCovers(book.openlibrary_work_id) : Promise.resolve([]),
    gbCovers(book.isbn13, book.title, author),
    olSearchCovers(book.title, author),
  ])

  // Priority order = ladder order; dedupe by URL and drop the current cover.
  const seen = new Set<string>(book.cover_url ? [book.cover_url] : [])
  const candidates: Candidate[] = []
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue
    for (const c of s.value) {
      if (seen.has(c.url)) continue
      seen.add(c.url)
      candidates.push(c)
    }
  }

  return NextResponse.json({ candidates: candidates.slice(0, 9) })
}
