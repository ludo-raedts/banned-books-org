// Shared admin-auth check for /api/admin/* route handlers.
//
// src/proxy.ts rejects unauthenticated requests to /admin/* and /api/admin/*
// at the edge, but every /api/admin/* route handler still calls this helper as
// defense-in-depth (the proxy matcher is a static list and easy to misconfigure).
// Add `const auth = await requireAdmin(); if (!auth.ok) return auth.response`
// to every new admin route. Only login and logout are exempt.

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/admin-session'

export type AdminAuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse }

export async function requireAdmin(): Promise<AdminAuthResult> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE)?.value
  const valid = await verifySessionToken(session, process.env.ADMIN_SECRET)
  if (!valid) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true }
}
