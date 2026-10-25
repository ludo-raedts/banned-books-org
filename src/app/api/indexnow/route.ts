import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { submitToIndexNow } from '@/lib/indexnow'
import { SESSION_COOKIE, safeEqual, verifySessionToken } from '@/lib/admin-session'

const MAX_URLS = 10_000

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false

  const auth = request.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ') && safeEqual(auth.slice(7), secret)) return true

  // Admin sessions are HMAC tokens (exp.sig), never the raw secret — the old
  // `=== secret` compare could never match a real login.
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value, secret)
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.INDEXNOW_KEY) {
    return NextResponse.json({ error: 'INDEXNOW_KEY not configured' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const urls = (body as { urls?: unknown })?.urls
  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: 'Body must be { urls: string[] }' }, { status: 400 })
  }
  if (urls.length > MAX_URLS) {
    return NextResponse.json({ error: `Too many URLs (max ${MAX_URLS})` }, { status: 400 })
  }
  if (!urls.every((u) => typeof u === 'string')) {
    return NextResponse.json({ error: 'All urls must be strings' }, { status: 400 })
  }

  const result = await submitToIndexNow(urls as string[])
  const status = result.ok ? 200 : result.status >= 400 ? result.status : 502
  return NextResponse.json(result, { status })
}
