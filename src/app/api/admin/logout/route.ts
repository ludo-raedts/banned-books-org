import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE } from '@/lib/admin-session'

// Clears the admin session cookie. No auth gate needed — the only effect is
// dropping your own session; middleware then bounces you to /admin/login.
export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  return NextResponse.json({ ok: true })
}
