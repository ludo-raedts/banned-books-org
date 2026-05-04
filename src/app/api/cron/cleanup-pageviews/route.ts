import { adminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  await adminClient()
    .from('pageviews')
    .delete()
    .lt('viewed_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

  return Response.json({ ok: true })
}
