import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { renderContentBlockHtml } from '@/lib/markdown'

type Action = 'save_draft' | 'publish' | 'revert_to_draft'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { slug } = await params
  const body = await req.json().catch(() => ({}))
  const action = body.action as Action | undefined
  const bodyMarkdown = typeof body.body_markdown === 'string' ? body.body_markdown : null
  const notes = typeof body.notes === 'string' ? body.notes : null

  if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

  const supabase = adminClient()
  const now = new Date().toISOString()

  // Always recompute body_html from markdown at save time so reads are cheap
  // and the public renderer never has to run the pipeline.
  const html = bodyMarkdown ? renderContentBlockHtml(bodyMarkdown) : null

  if (action === 'save_draft') {
    if (!bodyMarkdown || !bodyMarkdown.trim()) {
      return NextResponse.json({ error: 'Markdown is empty' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('content_blocks')
      .update({
        body_markdown: bodyMarkdown,
        body_html: html,
        notes,
        // Stay in 'placeholder' if it was placeholder and we're saving the
        // very first draft? Actually — once any markdown is saved, it's a
        // draft. 'placeholder' means "no content yet".
        status: 'draft',
        last_edited_at: now,
      })
      .eq('slug', slug)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'publish') {
    if (!bodyMarkdown || !bodyMarkdown.trim()) {
      return NextResponse.json({ error: 'Cannot publish empty content' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('content_blocks')
      .update({
        body_markdown: bodyMarkdown,
        body_html: html,
        notes,
        status: 'published',
        last_edited_at: now,
        published_at: now,
      })
      .eq('slug', slug)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('editorial_publish_log').insert({
      content_type: 'content_block',
      content_key: slug,
      action: 'publish',
    })
    return NextResponse.json(data)
  }

  if (action === 'revert_to_draft') {
    const { data, error } = await supabase
      .from('content_blocks')
      .update({
        status: 'draft',
        last_edited_at: now,
      })
      .eq('slug', slug)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('editorial_publish_log').insert({
      content_type: 'content_block',
      content_key: slug,
      action: 'revert_to_draft',
    })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
