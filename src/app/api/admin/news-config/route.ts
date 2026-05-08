import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getNewsConfig, updateNewsConfig } from '@/config/news'
import { adminClient } from '@/lib/supabase'

// GET   — read current row (live, bypasses cache)
// PATCH — body: { autoPublish?, dedupThreshold?, dedupWindowDays? }
//
// dedupThreshold is clamped to (0, 1]. dedupWindowDays must be ≥ 1.

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  return NextResponse.json(await getNewsConfig())
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, unknown> = {}
  if (typeof body.autoPublish === 'boolean') patch.autoPublish = body.autoPublish
  if (typeof body.dedupThreshold === 'number' && body.dedupThreshold > 0 && body.dedupThreshold <= 1) {
    patch.dedupThreshold = body.dedupThreshold
  }
  if (Number.isInteger(body.dedupWindowDays) && body.dedupWindowDays >= 1) {
    patch.dedupWindowDays = body.dedupWindowDays
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const updated = await updateNewsConfig(patch)
    await adminClient().from('editorial_publish_log').insert({
      content_type: 'news_config',
      content_key: 'singleton',
      action: 'update',
      notes: JSON.stringify(patch),
    })
    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}
