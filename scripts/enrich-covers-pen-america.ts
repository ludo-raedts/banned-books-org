/**
 * Targeted retry for PEN America books missing covers.
 *
 * The v2 pipeline tried:
 *   - GB title-only
 *   - OL title-only (with author)
 *   - OL stripped-subtitle
 *   - Wikipedia
 *
 * It did NOT try:
 *   - OL ISBN endpoint (covers.openlibrary.org/b/isbn/<isbn>-L.jpg)
 *   - GB ISBN search (q=isbn:<isbn>)
 *   - GB intitle+inauthor (v1 strategy)
 *
 * That last bucket is the gap: 118 of the 294 PEN America missing-cover books
 * have an ISBN, and many of the rest have author+year on recent (2020+)
 * English titles that GB should be able to disambiguate with inauthor:.
 *
 * Placeholder rejection via the same pHash check covers.ts uses, so any
 * "no thumbnail available" image from GB is filtered out.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-covers-pen-america.ts
 *   npx tsx --env-file=.env.local scripts/enrich-covers-pen-america.ts --apply
 *   npx tsx --env-file=.env.local scripts/enrich-covers-pen-america.ts --apply --limit=20
 */
import { adminClient } from '../src/lib/supabase'
import { checkImageUrl } from '../src/lib/enrich/_placeholder'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'

const APPLY = process.argv.includes('--apply')
const LIMIT = (() => {
  const a = process.argv.find(x => x.startsWith('--limit='))
  return a ? parseInt(a.split('=')[1], 10) : null
})()
const GB_DELAY_MS = 600
const OL_DELAY_MS = 200
const BOOK_DELAY_MS = 200

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

type Book = {
  id: number
  slug: string
  title: string
  isbn13: string | null
  first_published_year: number | null
  author: string | null
}

function transformGBUrl(url: string): string {
  return url
    .replace('http://', 'https://')
    .replace('zoom=1', 'zoom=3')
    .replace('&edge=curl', '').replace('edge=curl&', '').replace('edge=curl', '')
}

// Open Library returns a 1×1 transparent GIF for "no cover" when default=false
// is NOT passed. With default=false we get a 404 — the cheap signal we want.
async function olIsbnCover(isbn: string): Promise<string | null> {
  const url = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
    await sleep(OL_DELAY_MS)
    if (!res.ok) return null
    const cl = parseInt(res.headers.get('content-length') ?? '0', 10)
    if (cl > 0 && cl < 1000) return null  // sub-1KB is OL's tiny fallback
    return url
  } catch { return null }
}

async function gbIsbnCover(isbn: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1&fields=items(volumeInfo(imageLinks))`,
      { signal: AbortSignal.timeout(8000) },
    )
    await sleep(GB_DELAY_MS)
    if (!res.ok) return null
    const json = await res.json() as {
      items?: Array<{ volumeInfo: { imageLinks?: { large?: string; medium?: string; thumbnail?: string } } }>
    }
    const img = json.items?.[0]?.volumeInfo?.imageLinks
    const url = img?.large ?? img?.medium ?? img?.thumbnail
    return url ? transformGBUrl(url) : null
  } catch { return null }
}

async function gbTitleAuthor(title: string, author: string): Promise<string | null> {
  try {
    const q = `intitle:"${title}" inauthor:"${author}"`
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=3&fields=items(volumeInfo(imageLinks))`,
      { signal: AbortSignal.timeout(8000) },
    )
    await sleep(GB_DELAY_MS)
    if (!res.ok) return null
    const json = await res.json() as {
      items?: Array<{ volumeInfo: { imageLinks?: { large?: string; medium?: string; thumbnail?: string } } }>
    }
    for (const item of json.items ?? []) {
      const img = item.volumeInfo?.imageLinks
      const url = img?.large ?? img?.medium ?? img?.thumbnail
      if (url) return transformGBUrl(url)
    }
    return null
  } catch { return null }
}

async function verifyNotPlaceholder(url: string): Promise<boolean> {
  // Only GB URLs need pHash verification — OL covers don't share the GB
  // placeholder. Skip the check for non-GB hosts to keep the run snappy.
  if (!url.includes('books.google')) return true
  const check = await checkImageUrl(url)
  if (check.ok === false && check.reason === 'placeholder') return false
  return true
}

async function main() {
  const sb = adminClient()
  const PAGE = 1000
  type Row = {
    id: number
    slug: string
    title: string
    isbn13: string | null
    first_published_year: number | null
    cover_status: string | null
    book_authors: Array<{ authors: { display_name: string } | null }> | null
    bans: Array<{ ban_source_links: Array<{ ban_sources: { source_name: string | null } | null }> | null }> | null
  }
  const all: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('books')
      .select(`
        id, slug, title, isbn13, first_published_year, cover_status,
        book_authors!left(authors!left(display_name)),
        bans!left(ban_source_links!left(ban_sources!left(source_name)))
      `)
      .is('cover_url', null)
      .or('cover_status.is.null,cover_status.eq.valid')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) { console.error(error); process.exit(1) }
    const rows = (data ?? []) as unknown as Row[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }

  const candidates: Book[] = all
    .filter(r =>
      (r.bans ?? []).some(b =>
        (b.ban_source_links ?? []).some(l => /^PEN America/i.test(l.ban_sources?.source_name ?? '')),
      ),
    )
    .map(r => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      isbn13: r.isbn13,
      first_published_year: r.first_published_year,
      author: r.book_authors?.[0]?.authors?.display_name ?? null,
    }))

  const queue = LIMIT != null ? candidates.slice(0, LIMIT) : candidates
  console.log(`${APPLY ? 'Processing' : '[dry-run]'} ${queue.length} of ${candidates.length} PEN America candidates\n`)

  let foundIsbnOl = 0, foundIsbnGb = 0, foundTitleAuthor = 0, stillMissing = 0, errored = 0

  for (let i = 0; i < queue.length; i++) {
    const b = queue[i]
    let coverUrl: string | null = null
    let source = ''

    try {
      if (b.isbn13) {
        const olUrl = await olIsbnCover(b.isbn13)
        if (olUrl && isAllowedImageUrl(olUrl)) { coverUrl = olUrl; source = 'OL-ISBN'; foundIsbnOl++ }
      }

      if (!coverUrl && b.isbn13) {
        const gbUrl = await gbIsbnCover(b.isbn13)
        if (gbUrl && isAllowedImageUrl(gbUrl) && await verifyNotPlaceholder(gbUrl)) {
          coverUrl = gbUrl; source = 'GB-ISBN'; foundIsbnGb++
        }
      }

      if (!coverUrl && b.author) {
        const gbUrl = await gbTitleAuthor(b.title, b.author)
        if (gbUrl && isAllowedImageUrl(gbUrl) && await verifyNotPlaceholder(gbUrl)) {
          coverUrl = gbUrl; source = 'GB-title+author'; foundTitleAuthor++
        }
      }
    } catch (e) {
      console.log(`  [${i + 1}/${queue.length}] ${b.slug}: ERROR ${e instanceof Error ? e.message : String(e)}`)
      errored++
      await sleep(BOOK_DELAY_MS)
      continue
    }

    if (coverUrl) {
      console.log(`  [${i + 1}/${queue.length}] ${b.slug} → ${source}${APPLY ? '' : ' [dry-run]'}`)
      if (APPLY) {
        const { error: ue } = await sb.from('books')
          .update({ cover_url: coverUrl, cover_status: 'valid', cover_checked_at: new Date().toISOString() })
          .eq('id', b.id)
          .is('cover_url', null)
        if (ue) { console.log(`    ✗ write failed: ${ue.message}`); errored++ }
      }
    } else {
      console.log(`  [${i + 1}/${queue.length}] ${b.slug.slice(0, 50)} → still missing`)
      stillMissing++
    }

    await sleep(BOOK_DELAY_MS)
  }

  console.log(`\n── summary ──`)
  console.log(`  OL-ISBN:         ${foundIsbnOl}`)
  console.log(`  GB-ISBN:         ${foundIsbnGb}`)
  console.log(`  GB-title+author: ${foundTitleAuthor}`)
  console.log(`  still missing:   ${stillMissing}`)
  console.log(`  errored:         ${errored}`)
  if (!APPLY) console.log('\nRe-run with --apply to persist.')
}

main().catch(e => { console.error(e); process.exit(1) })
