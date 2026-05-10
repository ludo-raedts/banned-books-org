import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

function currentMonday(): string {
  const d = new Date()
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { id, action, summary } = await req.json()
  if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

  if (action === 'reject_all') {
    const supabase = adminClient()
    const { error } = await supabase.from('news_items').update({ status: 'rejected' }).eq('status', 'draft')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = adminClient()

  if (action === 'publish') {
    const { error } = await supabase.from('news_items').update({
      status: 'published',
      published_week: currentMonday(),
      ...(summary ? { summary } : {}),
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'reject') {
    const { error } = await supabase.from('news_items').update({ status: 'rejected' }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Unpublish takes a published item back off the public site. Soft-delete:
  // status flips to 'rejected' (so it's hidden from /news and the RSS feed),
  // and published_week is cleared so it won't reappear in any week-grouped
  // view. The source_url stays in the dedup table — same story shouldn't get
  // re-pulled and re-published a day later.
  if (action === 'unpublish') {
    const { error } = await supabase.from('news_items').update({
      status: 'rejected',
      published_week: null,
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'update_summary') {
    const { error } = await supabase.from('news_items').update({ summary }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
