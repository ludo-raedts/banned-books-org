import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/admin')) return NextResponse.next()
  if (pathname === '/admin/login') return NextResponse.next()
  if (pathname.startsWith('/api/admin/login')) return NextResponse.next()

  const session = request.cookies.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET

  if (!secret || !session || session !== secret) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
