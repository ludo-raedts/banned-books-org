import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { buildIntlCorpus } from '@/lib/reading-club-data'
import { suggestInternational } from '@/lib/reading-club-international-suggester'
import { isPageReadyToPublish } from '@/lib/content-blocks'

// POST /api/admin/reading-club
//
// Single endpoint with a tagged action and a track field. Tracks supported:
//   currently-challenged | international | classics | theme:<slug>
//
// Actions:
//   suggest_international — runs the engine, returns top10 + alternates
//   save_currently_challenged_entry — upsert one row in the manual table
//   save_track_books      — replace draft rows (international/classics/theme)
//   publish_track         — flip every row in a track to published (gated by
//                           the track's required content blocks)
//
// We keep one route handler so the admin client doesn't have to know which
// table backs which track.

type Track = 'currently-challenged' | 'international' | 'classics' | `theme:${string}`

const TRACK_TO_PAGE_KEY: Record<string, string> = {
  'currently-challenged': 'reading-club-currently-challenged',
  'international':        'reading-club-international',
  'classics':             'reading-club-classics',
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const action = body.action as string | undefined
  const track = body.track as Track | undefined
  if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

  const supabase = adminClient()

  if (action === 'suggest_international') {
    const corpus = await buildIntlCorpus()
    const result = suggestInternational(corpus)

    // Hydrate with titles + authors so the admin UI shows real names rather
    // than "Book {id}". Single round-trip for top10 + alternates.
    const allIds = [
      ...result.top10.map(b => b.id),
      ...result.alternates.map(b => b.id),
    ]
    const { data: bookRows } = await supabase
      .from('books')
      .select('id, title, slug, book_authors(authors(display_name))')
      .in('id', allIds)
    type BookRow = {
      id: number
      title: string
      slug: string
      book_authors: { authors: { display_name: string } | null }[] | null
    }
    const byId = new Map<number, BookRow>(
      ((bookRows ?? []) as unknown as BookRow[]).map(b => [b.id, b]),
    )
    const enrich = (b: ReturnType<typeof suggestInternational>['top10'][number]) => {
      const row = byId.get(b.id)
      const authors = (row?.book_authors ?? [])
        .map(ba => ba.authors?.display_name)
        .filter((s): s is string => !!s)
      return {
        book_id: b.id,
        title: row?.title ?? `Book ${b.id}`,
        slug: row?.slug ?? null,
        authors,
        finalScore: b.finalScore,
        components: b.components,
        countries: b.countries,
        reasons: b.reasons,
        countryCount: b.countryCount,
        banCount: b.banCount,
      }
    }

    return NextResponse.json({
      top10: result.top10.map(enrich),
      alternates: result.alternates.map(enrich),
    })
  }

  if (action === 'save_currently_challenged_entry') {
    const year = Number(body.year)
    const e = body.entry as {
      position: number
      title: string
      author: string
      challenge_count?: number | null
      book_id?: number | null
      bookshop_url?: string | null
      discussion_questions?: string[] | null
      source_url?: string | null
    } | undefined
    if (!Number.isInteger(year) || !e) return NextResponse.json({ error: 'Bad input' }, { status: 400 })
    const { error } = await supabase
      .from('reading_club_currently_challenged')
      .upsert({
        year,
        position: e.position,
        title: e.title,
        author: e.author,
        challenge_count: e.challenge_count ?? null,
        book_id: e.book_id ?? null,
        bookshop_url: e.bookshop_url ?? null,
        discussion_questions: e.discussion_questions ?? null,
        source_url: e.source_url ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'year,position' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete_currently_challenged_entry') {
    const year = Number(body.year)
    const position = Number(body.position)
    if (!Number.isInteger(year) || !Number.isInteger(position)) {
      return NextResponse.json({ error: 'Bad input' }, { status: 400 })
    }
    const { error } = await supabase
      .from('reading_club_currently_challenged')
      .delete()
      .eq('year', year)
      .eq('position', position)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'save_track_books') {
    if (!track) return NextResponse.json({ error: 'Missing track' }, { status: 400 })
    const picks = body.picks as Array<{
      book_id: number; position: number; custom_blurb?: string | null;
      discussion_questions?: string[] | null; pinned?: boolean
    }> | undefined
    if (!Array.isArray(picks)) return NextResponse.json({ error: 'Bad picks' }, { status: 400 })

    const { table, themeSlug } = resolveTrackTable(track)
    if (!table) return NextResponse.json({ error: 'Unknown track' }, { status: 400 })

    // Replace the entire set in scope. Two-step: (1) delete rows whose
    // book_id is NOT in the new picks list (handles "removed from list"),
    // (2) upsert the remaining picks. This makes save semantics simple and
    // intuitive — the in-memory state in the admin UI becomes the truth.
    //
    // Rows whose book_id WAS already in the new picks survive step 1 (they
    // are merely UPDATEd in step 2 with the latest custom_blurb / position).
    // Rows that were dropped from the list get DELETEd in step 1.
    const newBookIds = picks.map(p => p.book_id).filter(id => Number.isInteger(id))

    let del = supabase.from(table).delete()
    if (themeSlug) del = del.eq('theme_slug', themeSlug)
    if (newBookIds.length > 0) {
      del = del.not('book_id', 'in', `(${newBookIds.join(',')})`)
    } else {
      // Empty list — wipe everything in scope. We still need a WHERE clause
      // to satisfy Supabase's "no unfiltered DELETE" rule.
      del = del.gt('book_id', 0)
    }
    const { error: delErr } = await del
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    if (picks.length > 0) {
      const rows = picks.map(p => ({
        ...(themeSlug ? { theme_slug: themeSlug } : {}),
        book_id: p.book_id,
        position: p.position,
        custom_blurb: p.custom_blurb ?? null,
        discussion_questions: p.discussion_questions ?? null,
        ...(table === 'reading_club_international' ? { pinned: !!p.pinned } : {}),
        published_at: null,
        updated_at: new Date().toISOString(),
      }))
      const conflictKey = themeSlug ? 'theme_slug,book_id' : 'book_id'
      const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictKey })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'publish_track') {
    if (!track) return NextResponse.json({ error: 'Missing track' }, { status: 400 })
    const pageKey = trackToPageKey(track)
    if (pageKey) {
      const ready = await isPageReadyToPublish(pageKey)
      if (!ready.ready) {
        return NextResponse.json({
          error: 'Cannot publish: content blocks still in placeholder',
          missing: ready.missing,
        }, { status: 409 })
      }
    }
    const { table, themeSlug } = resolveTrackTable(track)
    if (!table) return NextResponse.json({ error: 'Unknown track' }, { status: 400 })

    const now = new Date().toISOString()
    let q = supabase.from(table).update({ published_at: now })
    if (track === 'currently-challenged') {
      const year = Number(body.year)
      if (!Number.isInteger(year)) return NextResponse.json({ error: 'Bad year' }, { status: 400 })
      q = q.eq('year', year)
    } else if (themeSlug) {
      q = q.eq('theme_slug', themeSlug)
    } else {
      // International / Classics — single global set, no scoping column. We
      // still need a WHERE clause so Supabase doesn't reject the UPDATE; use
      // the always-true filter book_id > 0 (book_id is bigint NOT NULL).
      q = q.gt('book_id', 0)
    }
    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('editorial_publish_log').insert({
      content_type: track.startsWith('theme:') ? 'rc_theme'
        : track === 'currently-challenged' ? 'rc_currently_challenged'
        : track === 'international' ? 'rc_international'
        : 'rc_classics',
      content_key: track,
      action: 'publish',
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

function resolveTrackTable(track: Track): { table: string | null; themeSlug: string | null } {
  if (track === 'international') return { table: 'reading_club_international', themeSlug: null }
  if (track === 'classics')      return { table: 'reading_club_classics',      themeSlug: null }
  if (track === 'currently-challenged') return { table: 'reading_club_currently_challenged', themeSlug: null }
  if (track.startsWith('theme:')) return { table: 'reading_club_theme_books', themeSlug: track.slice('theme:'.length) }
  return { table: null, themeSlug: null }
}

function trackToPageKey(track: Track): string | null {
  if (track.startsWith('theme:')) {
    const slug = track.slice('theme:'.length)
    return `theme-${slug}`
  }
  return TRACK_TO_PAGE_KEY[track] ?? null
}
