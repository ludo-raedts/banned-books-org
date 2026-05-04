/**
 * Re-tries books that already failed cover search with improved strategies.
 *
 * The original enrich-covers-continuous.ts only tried:
 *   - OL search with title+author
 *   - Google Books with intitle+inauthor
 *
 * This script adds:
 *   1. Google Books title-only (no inauthor: — highest hit rate, fixes author name mismatches)
 *   2. OL title-only search (no author)
 *   3. OL stripped-subtitle search (e.g. "1984: The Graphic Novel" → "1984")
 *   4. Wikipedia page thumbnail (covers notable/well-known books)
 *
 * By default, processes all books in the skip list that have NOT yet had
 * the new strategies tried. Use --reset to re-run on all skip list books.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts
 *   npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply
 *   npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --limit=100
 *   npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --reset
 */

import { adminClient } from '../src/lib/supabase'

const APPLY    = process.argv.includes('--apply')
const RESET    = process.argv.includes('--reset')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity

const OL_DELAY_MS   = 200
const GB_DELAY_MS   = 600
const WIKI_DELAY_MS = 200
const BOOK_DELAY_MS = 200

const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }

// If any of these are in sources_tried the book has already had v2 strategies
const NEW_SOURCES = ['ol_title_only', 'ol_stripped', 'gb_title_only', 'wikipedia']

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function stripSubtitle(title: string): string {
  const colon = title.indexOf(':')
  const dash  = title.indexOf(' — ')
  if (colon > 0 && dash > 0) return title.slice(0, Math.min(colon, dash)).trim()
  if (colon > 0) return title.slice(0, colon).trim()
  if (dash  > 0) return title.slice(0, dash).trim()
  return title
}

// ── Open Library ──────────────────────────────────────────────────────────────

async function olSearch(title: string, author: string): Promise<{ coverUrl: string | null; workId: string | null }> {
  try {
    const params = new URLSearchParams({
      title,
      ...(author ? { author } : {}),
      limit: '5',
      fields: 'key,cover_i,title',
    })
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, { headers: OL_HEADERS })
    await sleep(OL_DELAY_MS)
    if (!res.ok) return { coverUrl: null, workId: null }
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number }> }
    for (const doc of json.docs ?? []) {
      if (doc.cover_i) {
        // cover_i from search results is reliable — skip HEAD validation
        return {
          coverUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
          workId: doc.key?.replace('/works/', '') ?? null,
        }
      }
    }
    const workId = json.docs?.[0]?.key?.replace('/works/', '') ?? null
    return { coverUrl: null, workId }
  } catch { return { coverUrl: null, workId: null } }
}

// ── Google Books ──────────────────────────────────────────────────────────────

function transformGBUrl(url: string): string {
  return url
    .replace('http://', 'https://')
    .replace('zoom=1', 'zoom=3')
    .replace('&edge=curl', '')
    .replace('edge=curl&', '')
    .replace('edge=curl', '')
}

async function gbSearch(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&fields=items(volumeInfo(title,imageLinks))`
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
      if (img) return transformGBUrl(img)
    }
    return null
  } catch { return null }
}

// ── Wikipedia ─────────────────────────────────────────────────────────────────

async function wikipediaCover(title: string, author: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${title} ${author} book`.trim())
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&srlimit=3&srprop=`
    )
    await sleep(WIKI_DELAY_MS)
    if (!searchRes.ok) return null
    const searchJson = await searchRes.json() as {
      query?: { search?: Array<{ title: string }> }
    }
    const hits = searchJson.query?.search ?? []
    for (const hit of hits) {
      if (!hit.title.toLowerCase().includes(title.toLowerCase().slice(0, 12))) continue
      const pageSlug = encodeURIComponent(hit.title.replace(/ /g, '_'))
      const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${pageSlug}`)
      await sleep(WIKI_DELAY_MS)
      if (!summaryRes.ok) continue
      const summary = await summaryRes.json() as {
        originalimage?: { source?: string }
        thumbnail?: { source?: string }
      }
      const img = summary.originalimage?.source ?? summary.thumbnail?.source
      if (img) return img
    }
    return null
  } catch { return null }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type BookRow = {
  id: number
  slug: string
  title: string
  openlibrary_work_id: string | null
  author: string | null
  prevSources: string[]
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── enrich-covers-v2 (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  console.log(`Strategies: GB title-only → OL title-only → OL stripped subtitle → Wikipedia\n`)

  const supabase = adminClient()

  const { data: eligible, error } = await supabase
    .from('books')
    .select(`
      id, slug, title, openlibrary_work_id,
      cover_search_attempts!inner(sources_tried),
      book_authors!left(authors!left(display_name))
    `)
    .is('cover_url', null)
    .order('title')

  if (error) { console.error('DB error:', error.message); process.exit(1) }

  type RawRow = {
    id: number; slug: string; title: string
    openlibrary_work_id: string | null
    cover_search_attempts: Array<{ sources_tried: string[] }>
    book_authors: Array<{ authors: { display_name: string } | null }> | null
  }

  const all = (eligible ?? []) as unknown as RawRow[]

  const toSearch: BookRow[] = []
  let alreadyDoneCount = 0

  for (const row of all) {
    const prevSources = row.cover_search_attempts?.[0]?.sources_tried ?? []
    const hasNewSources = NEW_SOURCES.some(s => prevSources.includes(s))
    if (!RESET && hasNewSources) { alreadyDoneCount++; continue }
    toSearch.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      openlibrary_work_id: row.openlibrary_work_id,
      author: row.book_authors?.[0]?.authors?.display_name ?? null,
      prevSources,
    })
  }

  const batch = LIMIT === Infinity ? toSearch : toSearch.slice(0, LIMIT)

  console.log(`Books in skip list:     ${all.length}`)
  console.log(`Already tried v2:       ${alreadyDoneCount}`)
  console.log(`Eligible for v2 search: ${toSearch.length}`)
  console.log(`This run (limit):       ${batch.length}`)
  if (!APPLY) console.log(`\nDRY-RUN — showing first ${Math.min(10, batch.length)} results, no writes\n`)

  const dryRunLimit = APPLY ? batch.length : Math.min(10, batch.length)

  let found = 0, stillFailed = 0
  const foundBySource: Record<string, number> = {}
  const errors: string[] = []
  const start = Date.now()

  for (let i = 0; i < dryRunLimit; i++) {
    const book = batch[i]
    const author   = book.author ?? ''
    const stripped = stripSubtitle(book.title)
    process.stdout.write(`  [${i + 1}/${dryRunLimit}] ${book.title.slice(0, 48).padEnd(48)} `)

    let coverUrl: string | null = null
    let source = ''
    const newSources: string[] = []

    try {
      // 1. Google Books title-only — intitle: operator, then plain query fallback for special chars
      if (!coverUrl) {
        newSources.push('gb_title_only')
        coverUrl = await gbSearch(`intitle:${book.title}`)
          ?? await gbSearch(book.title)
        if (coverUrl) source = 'GB-title-only'
      }

      // 2. OL title-only (no author)
      if (!coverUrl) {
        newSources.push('ol_title_only')
        const { coverUrl: url, workId } = await olSearch(book.title, '')
        if (url) { coverUrl = url; source = 'OL-title-only' }
        if (workId && !book.openlibrary_work_id && APPLY) {
          await supabase.from('books').update({ openlibrary_work_id: workId }).eq('id', book.id)
        }
      }

      // 3. OL stripped subtitle
      if (!coverUrl && stripped !== book.title) {
        newSources.push('ol_stripped')
        const { coverUrl: url } = await olSearch(stripped, author)
        if (url) { coverUrl = url; source = 'OL-stripped' }
      }

      // 4. Wikipedia thumbnail
      if (!coverUrl) {
        newSources.push('wikipedia')
        const url = await wikipediaCover(book.title, author)
        if (url) { coverUrl = url; source = 'Wikipedia' }
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`ERROR`)
      errors.push(`${book.title}: ${msg}`)
      await sleep(BOOK_DELAY_MS)
      continue
    }

    if (coverUrl) {
      if (!APPLY) {
        console.log(`✓ ${source}: ${coverUrl.slice(0, 55)}`)
        foundBySource[source] = (foundBySource[source] ?? 0) + 1
        found++
      } else {
        const { error: ue } = await supabase.from('books').update({ cover_url: coverUrl }).eq('id', book.id)
        if (ue) {
          console.log(`DB error: ${ue.message}`)
          errors.push(`${book.title}: DB error ${ue.message}`)
          stillFailed++
        } else {
          await supabase.from('cover_search_attempts').delete().eq('book_id', book.id)
          console.log(`✓ ${source}`)
          found++
          foundBySource[source] = (foundBySource[source] ?? 0) + 1
        }
      }
    } else {
      console.log(`— not found`)
      if (APPLY) {
        const allSources = [...new Set([...book.prevSources, ...newSources])]
        await supabase.from('cover_search_attempts').upsert(
          { book_id: book.id, last_searched_at: new Date().toISOString(), sources_tried: allSources },
          { onConflict: 'book_id' },
        )
        stillFailed++
      }
    }

    await sleep(BOOK_DELAY_MS)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n── Summary ──`)
  if (APPLY) {
    console.log(`Found:           ${found}`)
    Object.entries(foundBySource).forEach(([s, n]) => console.log(`  via ${s}: ${n}`))
    console.log(`Still not found: ${stillFailed}`)
    if (errors.length) { console.log(`Errors: ${errors.length}`); errors.forEach(e => console.log(`  ✗ ${e}`)) }
  } else {
    console.log(`Dry-run: ${found}/${dryRunLimit} found. Re-run with --apply to write.`)
    Object.entries(foundBySource).forEach(([s, n]) => console.log(`  via ${s}: ${n}`))
  }
  console.log(`Time: ${elapsed}s\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
