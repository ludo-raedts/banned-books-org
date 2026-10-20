import { type NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'
import { isAllowedImageUrl } from '@/lib/allowed-image-hosts'
import { readReview, writeReview, type ReviewItem } from '@/lib/photo-review'

export const dynamic = 'force-dynamic'

// GET  /api/admin/photo-review → pending review items (photo still current) + counts
// POST /api/admin/photo-review  { author_id, action: 'ok' | 'wrong' | 'replace', photo_url? }
//
// Writes follow the author PATCH rules: photo_url only from the image-host
// allowlist, and photo_v2_checked_at is stamped on every change so
// enrich-author-photos-v2 never refills a photo a human removed or chose.

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const file = await readReview()
  const pending = file.items.filter(i => !i.decision)
  // Drop items whose photo changed or was removed since the audit (stale).
  const ids = pending.map(i => i.author_id)
  const current = new Map<number, string | null>()
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await adminClient().from('authors').select('id, photo_url').in('id', ids.slice(i, i + 300))
    for (const r of data ?? []) current.set(Number(r.id), r.photo_url as string | null)
  }
  const live = pending.filter(i => current.get(i.author_id) === i.photo_url)

  const decided = file.items.filter(i => i.decision)
  return NextResponse.json({
    generated_at: file.generated_at,
    items: live,
    counts: {
      pending: live.length,
      stale: pending.length - live.length,
      ok: decided.filter(i => i.decision === 'ok').length,
      wrong: decided.filter(i => i.decision === 'wrong').length,
      replaced: decided.filter(i => i.decision === 'replaced').length,
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await req.json().catch(() => null)) as { author_id?: number; action?: string; photo_url?: string } | null
  const authorId = Number(body?.author_id)
  const action = body?.action
  if (!authorId || !['ok', 'wrong', 'replace'].includes(action ?? '')) {
    return NextResponse.json({ error: 'author_id and action (ok|wrong|replace) required' }, { status: 400 })
  }
  if (action === 'replace' && !isAllowedImageUrl(body?.photo_url)) {
    return NextResponse.json({ error: 'photo_url must be on a host in the image allowlist' }, { status: 400 })
  }

  const file = await readReview()
  const item: ReviewItem | undefined = file.items.find(i => i.author_id === authorId && !i.decision)
  if (!item) return NextResponse.json({ error: 'Not in the review queue (already decided?)' }, { status: 404 })

  const sb = adminClient()
  const now = new Date().toISOString()
  if (action === 'wrong' || action === 'replace') {
    const photo = action === 'replace' ? body!.photo_url! : null
    const { error } = await sb.from('authors')
      .update({ photo_url: photo, photo_v2_checked_at: now })
      .eq('id', authorId)
      .eq('photo_url', item.photo_url) // never clobber a photo changed since the audit
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    item.new_photo_url = photo
  }
  item.decision = action === 'ok' ? 'ok' : action === 'wrong' ? 'wrong' : 'replaced'
  item.decided_at = now
  await writeReview(file)

  if (action !== 'ok') revalidatePath(`/authors/${item.slug}`)
  return NextResponse.json({ ok: true, decision: item.decision })
}
