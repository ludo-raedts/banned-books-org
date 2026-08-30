// Production cache-bust helper for batch scripts.
//
// books/[slug] and authors/[slug] run on a 7-day ISR window (staleness cap);
// the actual freshness signal is this call: after a data-changing run, bust the
// pages the run touched so they re-render with the new data on next visit.
// Mints a short-lived admin_session token from ADMIN_SECRET (same HMAC the
// login flow uses) and POSTs to /api/admin/revalidate.
//
// PREFER bustChangedPages() over bustDetailPages(). A route-wide bust
// invalidates all ~20.3k book + ~12.7k author pages at once; every one of them
// is then rewritten to the ISR cache as crawlers sweep the catalogue. ISR
// writes are billed per 8 KB unit and a detail page costs ~5 units, so one
// route-wide bust is worth ~120k write units. A typical enrichment run changes
// hundreds of rows, not tens of thousands — busting only those is the same
// freshness for a fraction of the cost.
//
// Fail-soft by design: a batch run must never fail because the site was
// mid-deploy — worst case the pages refresh within the 7-day window anyway.
import { createSessionToken, SESSION_COOKIE } from '../../src/lib/admin-session'

const DEFAULT_BASE = 'https://www.banned-books.org'

// Must stay ≤ MAX_PATHS in src/app/api/admin/revalidate/route.ts.
const CHUNK = 500

// Above this many changed rows a targeted bust stops being worth it: the run
// has effectively rewritten the catalogue, so one route-wide invalidation is
// both simpler and cheaper than thousands of individual ones.
const ROUTE_WIDE_THRESHOLD = 5000

async function post(base: string, token: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(`${base}/api/admin/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=${token}` },
      body: JSON.stringify(body),
    })
  } catch (e) {
    console.warn(`  ⚠ revalidate: ${e instanceof Error ? e.message : e}`)
    return null
  }
}

function requireSecret(): string | null {
  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    console.warn('  ⚠ ADMIN_SECRET niet gezet — cache-bust overgeslagen (pagina\'s verversen binnen het 7d-ISR-venster).')
    return null
  }
  return secret
}

/**
 * Route-wide invalidation — the blunt instrument. Only correct when a run
 * genuinely changed something on every page (a layout/template change, a
 * site-wide backfill). For data runs use bustChangedPages().
 */
export async function bustDetailPages(
  routes: string[] = ['/books/[slug]', '/authors/[slug]'],
  base: string = process.env.REVALIDATE_BASE_URL ?? DEFAULT_BASE,
): Promise<boolean> {
  const secret = requireSecret()
  if (!secret) return false
  const token = await createSessionToken(secret)
  let ok = true
  for (const path of routes) {
    const res = await post(base, token, { path, type: 'page' })
    if (!res) { ok = false; continue }
    if (!res.ok) {
      console.warn(`  ⚠ revalidate ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
      ok = false
    } else {
      console.log(`  ✓ cache bust (route-wide): ${path}`)
    }
  }
  return ok
}

/**
 * Targeted invalidation of literal paths, chunked. Silently no-ops on an empty
 * list — a run that changed nothing needs no bust.
 */
export async function bustPaths(
  paths: string[],
  base: string = process.env.REVALIDATE_BASE_URL ?? DEFAULT_BASE,
): Promise<boolean> {
  const unique = [...new Set(paths)]
  if (unique.length === 0) {
    console.log('  · geen gewijzigde pagina\'s — cache-bust niet nodig')
    return true
  }
  const secret = requireSecret()
  if (!secret) return false
  const token = await createSessionToken(secret)

  let ok = true
  let done = 0
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK)
    const res = await post(base, token, { paths: chunk })
    if (!res) { ok = false; continue }
    if (!res.ok) {
      console.warn(`  ⚠ revalidate batch ${i / CHUNK + 1}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
      ok = false
    } else {
      done += chunk.length
    }
  }
  console.log(`  ✓ cache bust (gericht): ${done}/${unique.length} pagina's`)
  return ok
}

/**
 * The call an enrichment run should make. Turns changed book/author slugs into
 * literal detail-page paths and busts exactly those — unless the run changed so
 * much that a route-wide bust is cheaper.
 */
export async function bustChangedPages(
  changed: { bookSlugs: string[]; authorSlugs: string[] },
  base: string = process.env.REVALIDATE_BASE_URL ?? DEFAULT_BASE,
): Promise<boolean> {
  const total = changed.bookSlugs.length + changed.authorSlugs.length
  if (total > ROUTE_WIDE_THRESHOLD) {
    console.log(`  · ${total} gewijzigde rijen > ${ROUTE_WIDE_THRESHOLD} — route-brede bust is hier goedkoper`)
    return bustDetailPages(undefined, base)
  }
  const paths = [
    ...changed.bookSlugs.map(s => `/books/${s}`),
    ...changed.authorSlugs.map(s => `/authors/${s}`),
  ]
  return bustPaths(paths, base)
}
