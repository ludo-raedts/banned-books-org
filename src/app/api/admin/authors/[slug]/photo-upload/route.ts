import { type NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { adminClient } from '@/lib/supabase'
import { magicBytesMatch } from '@/lib/enrich/mirror-image'
import { readReview, writeReview } from '@/lib/photo-review'

export const dynamic = 'force-dynamic'

// POST /api/admin/authors/<slug>/photo-upload  (multipart form, field "file")
//
// For photos on sites a server cannot fetch (Cloudflare challenges such as
// philpeople.org): the admin saves the image and uploads it here. Stored in
// `author-photos` under a unique key (mirrors carry a one-year cache), then
// set as photo_url with photo_v2_checked_at so enrichment never replaces it.
// A pending photo-review item for this author is marked 'replaced'.
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const MAX = 4 * 1024 * 1024 // below Vercel's 4.5 MB request-body limit

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { slug } = await params

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 })
  const ext = EXT[file.type]
  if (!ext) return NextResponse.json({ error: `unsupported type ${file.type || 'unknown'} (jpeg, png, webp, gif)` }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ error: 'file larger than 4 MB' }, { status: 400 })
  const buf = Buffer.from(await file.arrayBuffer())
  if (!magicBytesMatch(buf, ext)) return NextResponse.json({ error: 'file content does not match its image type' }, { status: 400 })

  const sb = adminClient()
  const { data: author } = await sb.from('authors').select('id').eq('slug', slug).maybeSingle()
  if (!author) return NextResponse.json({ error: 'Author not found' }, { status: 404 })

  const key = `${slug}-${Date.now().toString(36)}.${ext}`
  const { error: upErr } = await sb.storage.from('author-photos').upload(key, buf, { contentType: file.type, cacheControl: '31536000' })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  const url = sb.storage.from('author-photos').getPublicUrl(key).data.publicUrl

  const now = new Date().toISOString()
  const { error } = await sb.from('authors').update({ photo_url: url, photo_v2_checked_at: now }).eq('id', author.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const review = await readReview()
  const item = review.items.find(i => i.author_id === Number(author.id) && !i.decision)
  if (item) {
    item.decision = 'replaced'; item.decided_at = now; item.new_photo_url = url
    await writeReview(review)
  }
  revalidatePath(`/authors/${slug}`)
  return NextResponse.json({ ok: true, photo_url: url })
}
