import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { buildSuggesterCorpus } from '@/lib/bbw-data'
import { suggestBBWFeatured } from '@/lib/bbw-suggester'
import { isPageReadyToPublish } from '@/lib/content-blocks'

// POST /api/admin/banned-books-week
// Actions:
//   suggest         — run the engine for { year } and return top10 + alternates
//                     (does not mutate the DB)
//   save_draft      — replace the draft set for { year } with { picks } as
//                     unpublished rows (positions 1..N)
//   publish         — flip every row for { year } to published (refuses if
//                     any required content block is still placeholder)
//   set_blurb       — update custom_blurb for one row
//   toggle_pinned   — flip the pinned bool for one row
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const action = body.action as string | undefined
  if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

  const supabase = adminClient()

  if (action === 'suggest') {
    const year = Number(body.year)
    if (!Number.isInteger(year)) return NextResponse.json({ error: 'Bad year' }, { status: 400 })
    const corpus = await buildSuggesterCorpus(year)
    const result = suggestBBWFeatured(corpus)
    return NextResponse.json({
      top10: result.top10.map(serializeScored),
      alternates: result.alternates.map(serializeScored),
    })
  }

  if (action === 'save_draft') {
    const year = Number(body.year)
    const picks = body.picks as Array<{ book_id: number; position: number; custom_blurb?: string | null; pinned?: boolean }> | undefined
    if (!Number.isInteger(year) || !Array.isArray(picks)) {
      return NextResponse.json({ error: 'Bad input' }, { status: 400 })
    }
    // Replace the draft set: delete unpublished rows for this year, insert new.
    await supabase.from('bbw_featured_selections').delete().eq('year', year).is('published_at', null)
    if (picks.length > 0) {
      const rows = picks.map(p => ({
        year,
        book_id: p.book_id,
        position: p.position,
        custom_blurb: p.custom_blurb ?? null,
        pinned: !!p.pinned,
        published_at: null,
      }))
      const { error } = await supabase.from('bbw_featured_selections').upsert(rows, {
        onConflict: 'year,book_id',
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'publish') {
    const year = Number(body.year)
    if (!Number.isInteger(year)) return NextResponse.json({ error: 'Bad year' }, { status: 400 })

    // Gate: every required block on the BBW hub must be `published`.
    const ready = await isPageReadyToPublish('bbw-hub')
    if (!ready.ready) {
      return NextResponse.json({
        error: 'Cannot publish: content blocks still in placeholder',
        missing: ready.missing,
      }, { status: 409 })
    }

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('bbw_featured_selections')
      .update({ published_at: now })
      .eq('year', year)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('editorial_publish_log').insert({
      content_type: 'bbw_featured',
      content_key: String(year),
      action: 'publish',
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'set_blurb' || action === 'toggle_pinned') {
    const year = Number(body.year)
    const bookId = Number(body.book_id)
    if (!Number.isInteger(year) || !Number.isInteger(bookId)) {
      return NextResponse.json({ error: 'Bad input' }, { status: 400 })
    }
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (action === 'set_blurb') update.custom_blurb = typeof body.custom_blurb === 'string' ? body.custom_blurb : null
    if (action === 'toggle_pinned') update.pinned = !!body.pinned
    const { error } = await supabase
      .from('bbw_featured_selections')
      .update(update)
      .eq('year', year)
      .eq('book_id', bookId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

function serializeScored(b: ReturnType<typeof suggestBBWFeatured>['top10'][number]) {
  return {
    book_id: b.id,
    finalScore: b.finalScore,
    rawScore: b.rawScore,
    components: b.components,
    penaltyApplied: b.penaltyApplied,
    pinned: b.pinned,
    countryCount: b.countryCount,
    banCount: b.banCount,
    countries: b.countries,
    reasons: b.reasons,
    inPreviousYears: b.inPreviousYears,
  }
}
