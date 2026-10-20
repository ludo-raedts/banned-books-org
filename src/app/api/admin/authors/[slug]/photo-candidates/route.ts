import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'
import { authorPhotoCandidates } from '@/lib/enrich/author-photo-candidates'

export const dynamic = 'force-dynamic'
// Wikidata + Commons + Wikipedia + a few Open Library HEAD checks.
export const maxDuration = 30

// GET /api/admin/authors/<slug>/photo-candidates — alternative photos for one
// author, each with a label so the admin can rule out namesakes. Nothing is
// written; choosing one goes through /api/admin/photo-review (action=replace)
// or the author PATCH route.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { slug } = await params
  const { data } = await adminClient().from('authors').select('display_name').eq('slug', slug).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Author not found' }, { status: 404 })
  const candidates = await authorPhotoCandidates(data.display_name as string)
  return NextResponse.json({ candidates })
}
