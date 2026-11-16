import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  safeEqual,
} from '@/lib/admin-session'

// In-memory brute-force throttle. After MAX_ATTEMPTS failed logins from one
// client inside WINDOW_MS that client is locked out until the window rolls over;
// GLOBAL_MAX_ATTEMPTS caps failures from *all* clients, so rotating the client
// key (spoofed headers, botnets) cannot lift the ceiling.
// Caveat: module state is per-instance and resets on cold start, so on
// serverless this is a speed bump, not a hard guarantee — but combined with a
// long random ADMIN_SECRET it makes online brute force impractical. A durable
// (DB/Redis) limiter would be the next step if abuse is ever observed.
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10
const GLOBAL_MAX_ATTEMPTS = 60
const MAX_TRACKED_IPS = 5000
const attempts = new Map<string, { count: number; first: number }>()
let globalFailures = { count: 0, first: 0 }

// Never trust the first x-forwarded-for entry: it is whatever the client sent.
// x-vercel-forwarded-for / x-real-ip are set by Vercel itself; the *last*
// x-forwarded-for entry is the one appended by the nearest trusted proxy.
function clientIp(req: NextRequest): string {
  const trusted = req.headers.get('x-vercel-forwarded-for') ?? req.headers.get('x-real-ip')
  if (trusted) return trusted.split(',')[0].trim() || 'unknown'
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',').pop()?.trim() || 'unknown'
}

function pruneExpired(now: number): void {
  for (const [ip, rec] of attempts) {
    if (now - rec.first > WINDOW_MS) attempts.delete(ip)
  }
  // Still too big (a flood of distinct keys inside one window): drop the oldest.
  while (attempts.size > MAX_TRACKED_IPS) {
    const oldest = attempts.keys().next().value
    if (oldest === undefined) break
    attempts.delete(oldest)
  }
}

function isLockedOut(ip: string): boolean {
  const now = Date.now()
  if (now - globalFailures.first > WINDOW_MS) globalFailures = { count: 0, first: now }
  if (globalFailures.count >= GLOBAL_MAX_ATTEMPTS) return true
  const rec = attempts.get(ip)
  if (!rec) return false
  if (now - rec.first > WINDOW_MS) {
    attempts.delete(ip)
    return false
  }
  return rec.count >= MAX_ATTEMPTS
}

function recordFailure(ip: string): void {
  const now = Date.now()
  if (now - globalFailures.first > WINDOW_MS) globalFailures = { count: 1, first: now }
  else globalFailures.count++
  const rec = attempts.get(ip)
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now })
    if (attempts.size > MAX_TRACKED_IPS) pruneExpired(now)
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
