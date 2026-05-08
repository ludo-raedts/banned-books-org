import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getBBWConfig, updateBBWConfig } from '@/config/banned-books-week'
import { adminClient } from '@/lib/supabase'

// GET  /api/admin/bbw-config — read current row (live, bypasses cache)
// PATCH /api/admin/bbw-config — update one or more fields
//   Body: { enabled?, year?, startDate?, endDate?, promoStartDate? }
//   Date fields accept ISO 'YYYY-MM-DD' strings; promoStartDate also
//   accepts null to clear the lead-up.
//
// Validation: enforces startDate ≤ endDate and (when present)
// promoStartDate ≤ endDate, so an invalid window can't go live.

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const config = await getBBWConfig()
  return NextResponse.json(config)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, unknown> = {}
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
  if (Number.isInteger(body.year)) patch.year = body.year
  if (typeof body.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) {
    patch.startDate = body.startDate
  }
  if (typeof body.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.endDate)) {
    patch.endDate = body.endDate
  }
  if (body.promoStartDate === null) {
    patch.promoStartDate = null
  } else if (typeof body.promoStartDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.promoStartDate)) {
    patch.promoStartDate = body.promoStartDate
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Cross-field validation against the post-merge config so a partial PATCH
  // can't introduce an invalid window (start after end, etc.).
  const current = await getBBWConfig()
  const merged = { ...current, ...patch } as {
    startDate: string; endDate: string; promoStartDate: string | null
  }
  if (merged.startDate > merged.endDate) {
    return NextResponse.json({ error: 'startDate must be on or before endDate' }, { status: 400 })
  }
  if (merged.promoStartDate && merged.promoStartDate > merged.endDate) {
    return NextResponse.json({ error: 'promoStartDate must be on or before endDate' }, { status: 400 })
  }

  try {
    const updated = await updateBBWConfig(patch)
    // Single shared audit log (used elsewhere for content-block + track publishes).
    await adminClient().from('editorial_publish_log').insert({
      content_type: 'bbw_config',
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
