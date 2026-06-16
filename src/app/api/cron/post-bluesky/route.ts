import { NextRequest, NextResponse } from 'next/server'
import { pickDailyBook, buildPost } from '@/lib/bluesky-post'
import { createSession, uploadImageBlob, createPost, latestPostCreatedAt, type ExternalEmbed } from '@/lib/bluesky'

// Daily "banned book of the day" post to Bluesky (@banned-books.org).
// Protected by CRON_SECRET, same as the other crons.
//
// Posting is OFF by default. The route runs in DRY-RUN unless BLUESKY_POST_ENABLED
// === 'true' in the environment (so the scheduled cron can ship to prod and just
// log until we flip the flag). A dry run returns the exact generated post — text,
// grapheme count, link facet, card metadata — without touching Bluesky.
//   ?dryrun=1  force dry-run even when enabled (safe manual preview)
//   ?live=1    force a live post even when the env flag is off (manual test)

export const maxDuration = 60

function isLive(req: NextRequest): boolean {
  const sp = req.nextUrl.searchParams
  if (sp.get('dryrun') === '1') return false
  if (sp.get('live') === '1') return true
  return process.env.BLUESKY_POST_ENABLED === 'true'
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const live = isLive(req)

  const book = await pickDailyBook(date)
  if (!book) return NextResponse.json({ error: 'No eligible book found' }, { status: 500 })
  const built = buildPost(book)

  const preview = {
    date,
    book: { id: book.id, title: book.title, author: book.author, slug: book.slug, reasons: book.reasons, countryCount: book.countryCount, banCount: book.banCount },
    text: built.text,
    graphemes: Array.from(built.text).length,
    facet: built.facet,
    card: built.card,
  }

  if (!live) return NextResponse.json({ dryRun: true, ...preview })

  const handle = process.env.BLUESKY_HANDLE
  const password = process.env.BLUESKY_APP_PASSWORD
  if (!handle || !password) return NextResponse.json({ error: 'BLUESKY_HANDLE / BLUESKY_APP_PASSWORD not set' }, { status: 500 })

  // Same-day idempotency guard: if the account already posted today (UTC), a
  // cron retry must not double-post.
  const last = await latestPostCreatedAt(handle)
  if (last && last.slice(0, 10) === date) {
    return NextResponse.json({ posted: false, skipped: 'already posted today', last, ...preview })
  }

  const session = await createSession(handle, password)
  const thumb = built.card.coverUrl ? await uploadImageBlob(session, built.card.coverUrl) : null
  const embed: ExternalEmbed = {
    $type: 'app.bsky.embed.external',
    external: { uri: built.card.uri, title: built.card.title, description: built.card.description, ...(thumb ? { thumb } : {}) },
  }
  const facets = [{ index: { byteStart: built.facet.byteStart, byteEnd: built.facet.byteEnd }, features: [{ $type: 'app.bsky.richtext.facet#link' as const, uri: built.facet.uri }] }]

  const result = await createPost(session, { text: built.text, createdAt: new Date().toISOString(), facets, embed })
  return NextResponse.json({ posted: true, uri: result.uri, thumb: !!thumb, ...preview })
}
