// Production cache-bust helper for batch scripts.
//
// books/[slug] and authors/[slug] run on a 7-day ISR window (staleness cap);
// the actual freshness signal is this call: after a data-changing run, bust
// the whole route so every page re-renders with the new data on next visit.
// Mints a short-lived admin_session token from ADMIN_SECRET (same HMAC the
// login flow uses) and POSTs to /api/admin/revalidate.
//
// Fail-soft by design: a batch run must never fail because the site was
// mid-deploy — worst case the pages refresh within the 7-day window anyway.
import { createSessionToken, SESSION_COOKIE } from '../../src/lib/admin-session'

const DEFAULT_BASE = 'https://www.banned-books.org'

export async function bustDetailPages(
  routes: string[] = ['/books/[slug]', '/authors/[slug]'],
  base: string = process.env.REVALIDATE_BASE_URL ?? DEFAULT_BASE,
): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    console.warn('  ⚠ ADMIN_SECRET niet gezet — cache-bust overgeslagen (pagina\'s verversen binnen het 7d-ISR-venster).')
    return false
  }
  const token = await createSessionToken(secret)
  let ok = true
  for (const path of routes) {
    try {
      const res = await fetch(`${base}/api/admin/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=${token}` },
        body: JSON.stringify({ path, type: 'page' }),
      })
      if (!res.ok) {
        console.warn(`  ⚠ revalidate ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
        ok = false
      } else {
        console.log(`  ✓ cache bust: ${path}`)
      }
    } catch (e) {
      console.warn(`  ⚠ revalidate ${path}: ${e instanceof Error ? e.message : e}`)
      ok = false
    }
  }
  return ok
}
