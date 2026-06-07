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

  if (!pathname.startsWith('/admin')) return NextResponse.next()
  if (pathname === '/admin/login') return NextResponse.next()
  if (pathname.startsWith('/api/admin/login')) return NextResponse.next()

  const session = request.cookies.get(SESSION_COOKIE)?.value
  const valid = await verifySessionToken(session, process.env.ADMIN_SECRET)

  if (!valid) {
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
  ],
}
