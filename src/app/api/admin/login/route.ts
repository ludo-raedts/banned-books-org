import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  safeEqual,
} from '@/lib/admin-session'

// In-memory brute-force throttle, keyed by client IP. After MAX_ATTEMPTS failed
// logins inside WINDOW_MS the IP is locked out until the window rolls over.
// Caveat: module state is per-instance and resets on cold start, so on
// serverless this is a speed bump, not a hard guarantee — but combined with a
// long random ADMIN_SECRET it makes online brute force impractical. A durable
// (DB/Redis) limiter would be the next step if abuse is ever observed.
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10
const attempts = new Map<string, { count: number; first: number }>()

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || 'unknown'
}

function isLockedOut(ip: string): boolean {
  const rec = attempts.get(ip)
  if (!rec) return false
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(ip)
    return false
  }
  return rec.count >= MAX_ATTEMPTS
}

function recordFailure(ip: string): void {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now })
  } else {
    rec.count++
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  if (isLockedOut(ip)) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429 },
    )
  }

  const body = await req.json().catch(() => null)
  const password = body?.password
  const secret = process.env.ADMIN_SECRET

  if (!secret || typeof password !== 'string' || !safeEqual(password, secret)) {
    recordFailure(ip)
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  attempts.delete(ip)

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })

  return NextResponse.json({ ok: true })
}
