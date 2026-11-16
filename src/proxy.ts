import { type NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/admin-session'
import { MARKDOWN_TWINS, prefersMarkdown } from '@/lib/markdown-twins'

// Next 16: the `middleware` file convention is deprecated → `proxy` (same
// request/response API, same matcher). Renamed 2026-10-25.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Markdown content negotiation for prose pages that have a `.md` twin.
  // The matcher below only runs this proxy for non-admin paths when the request
  // asks for `text/markdown`, so ordinary browser/crawler traffic never invokes
  // it (a proxy hit sits in front of the CDN cache, so it used to cost a
  // function invocation per homepage/essay view). The `Link: rel="alternate"`
  // discovery header for HTML responses is static — see `headers()` in
  // next.config.ts.
  const twin = MARKDOWN_TWINS[pathname]
  if (twin) {
    if (prefersMarkdown(request.headers.get('accept'))) {
      // Serve the markdown twin at the same URL. `Vary: Accept` keeps this
      // variant in its own cache slot so a browser never receives markdown.
      const url = request.nextUrl.clone()
      url.pathname = twin
      const res = NextResponse.rewrite(url)
      res.headers.append('Vary', 'Accept')
      return res
    }
    return NextResponse.next()
  }

  // /admin pages redirect to the login form; /api/admin gets a plain 401 so
  // unauthenticated scanners are rejected at the edge instead of invoking a
  // function. Every route still calls requireAdmin() as defense-in-depth.
  // Segment-exact matches: a bare startsWith('/admin') would also gate
  // '/administrator', and startsWith('/api/admin/login') would wave through
  // any future '/api/admin/login-*' route without a session check.
  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/')
  const isAdminApi = pathname === '/api/admin' || pathname.startsWith('/api/admin/')
  if (!isAdminPage && !isAdminApi) return NextResponse.next()
  if (pathname === '/admin/login') return NextResponse.next()
  // login is the gate itself; logout only clears the caller's own cookie.
  if (pathname === '/api/admin/login' || pathname === '/api/admin/logout') {
    return NextResponse.next()
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value
  const valid = await verifySessionToken(session, process.env.ADMIN_SECRET)

  if (!valid) {
    if (isAdminApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Admin gate: every request.
    '/admin/:path*',
    '/api/admin/:path*',
    // Markdown negotiation: only requests that explicitly ask for markdown. The
    // twin list lives in src/lib/markdown-twins.ts (no second copy to keep in
    // sync here); non-twin paths just fall through via NextResponse.next().
    {
      source: '/(.*)',
      has: [{ type: 'header', key: 'accept', value: '.*text/markdown.*' }],
    },
  ],
}
