import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/admin-session'
import { MARKDOWN_TWINS, prefersMarkdown } from '@/lib/markdown-twins'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Markdown content negotiation for prose pages that have a `.md` twin.
  const twin = MARKDOWN_TWINS[pathname]
  if (twin) {
    if (prefersMarkdown(request.headers.get('accept'))) {
      // Serve the markdown twin at the same URL. `Vary: Accept` keeps this
      // variant in its own cache slot so a browser never receives markdown.
      // Middleware runs ahead of the CDN cache, so HTML requests are routed
      // to the HTML entry below and never read this one.
      const url = request.nextUrl.clone()
      url.pathname = twin
      const res = NextResponse.rewrite(url)
      res.headers.append('Vary', 'Accept')
      return res
    }
    // HTML request: advertise the markdown alternate so agents can discover
    // the twin without having to guess the `.md` convention. Deliberately no
    // `Vary: Accept` here — the HTML page keeps a single cache entry (no
    // Accept-based fragmentation); markdown requests are intercepted above.
    const res = NextResponse.next()
    res.headers.set('Link', `<${twin}>; rel="alternate"; type="text/markdown"`)
    return res
  }

  // /admin pages redirect to the login form; /api/admin gets a plain 401 so
  // unauthenticated scanners are rejected at the edge instead of invoking a
  // function. Every route still calls requireAdmin() as defense-in-depth.
  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')
  if (!isAdminPage && !isAdminApi) return NextResponse.next()
  if (pathname === '/admin/login') return NextResponse.next()
  // login is the gate itself; logout only clears the caller's own cookie.
  if (pathname.startsWith('/api/admin/login') || pathname.startsWith('/api/admin/logout')) {
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
  // Must mirror /admin + every key in MARKDOWN_TWINS (src/lib/markdown-twins.ts).
  // Next.js requires this to be a static literal, so it cannot be derived.
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/',
    '/about',
    '/data-quality',
    '/history',
    '/methodology',
    '/why-not-amazon',
    '/essays/first-amendment-paradox',
    '/essays/forbidden-knowledge-iceberg',
    '/essays/in-whose-name',
    '/essays/the-grey-zone',
    '/essays/what-we-document',
    '/essays/who-hates-beetles',
  ],
}
