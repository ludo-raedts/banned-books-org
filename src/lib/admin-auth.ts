// Shared admin-auth check for /api/admin/* route handlers.
//
// The middleware in src/middleware.ts only protects /admin/* page routes; API
// route handlers under /api/admin/* aren't covered, so each one re-checks the
// admin_session cookie itself. Existing routes (e.g. sync-inbox/route.ts)
// inline this check; new routes added by Banned Books Week and Reading Club
// use this helper to keep it consistent.

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export type AdminAuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse }

export async function requireAdmin(): Promise<AdminAuthResult> {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  if (!secret || !session || session !== secret) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true }
}
