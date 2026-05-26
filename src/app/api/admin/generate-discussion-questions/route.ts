import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import {
  findReadingClubRowsMissingQuestions,
  saveDiscussionQuestionsToRow,
  type QuestionSetType,
  type RowSource,
} from '@/lib/reading-club-questions'
import {
  generateDiscussionQuestions,
  generateBanDiscussionQuestions,
  detectProvider,
  type Provider,
} from '@/lib/discussion-questions'

// One-shot endpoint that scans every Reading Club track for rows missing
// discussion_questions, calls the LLM (Claude if ANTHROPIC_API_KEY is set,
// else OpenAI gpt-4o), and writes the results back. Sequential calls — no
// fan-out — so a slow/failing run can be aborted by closing the request.
//
// maxDuration is bumped to 300s so a moderate batch (~50 books at ~5 sec
// each = 250s) fits inside one Vercel function invocation. Larger batches
// should use the CLI script (scripts/generate-discussion-questions.ts).
//
// Three actions:
//   • count         — return how many rows still need questions.
//   • generate      — batch fill every missing set across all tracks.
//   • generate_one  — inline single-row call used by the admin per-track
//                     "Generate with AI" buttons. Returns the questions
//                     without persisting; the client decides whether to
//                     replace or append before saving via /api/admin/reading-club.

export const maxDuration = 300

type Action = 'count' | 'generate' | 'generate_one'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const action = (body.action as Action | undefined) ?? 'count'
  const force = !!body.force

  if (action === 'count') {
    const rows = await findReadingClubRowsMissingQuestions()
    return NextResponse.json({ count: rows.length })
  }

  if (action === 'generate') {
    let provider: Provider
    try {
      provider = detectProvider()
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'No LLM credentials' },
        { status: 500 },
      )
    }

    const limit = Number.isFinite(body.limit) ? Number(body.limit) : Infinity
    const rows = (await findReadingClubRowsMissingQuestions({ force })).slice(0, limit)

    let success = 0
    let failed = 0
    const failures: { source: string; title: string; setType: QuestionSetType; error: string }[] = []

    for (const row of rows) {
      try {
        const gen = row.setType === 'ban' ? generateBanDiscussionQuestions : generateDiscussionQuestions
        const questions = await gen({
          title: row.title,
          author: row.author,
          audience: row.audience ?? null,
        })
        await saveDiscussionQuestionsToRow(row, questions)
        success++
      } catch (err) {
        failed++
        failures.push({
          source: row.source,
          title: row.title,
          setType: row.setType,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return NextResponse.json({
      provider,
      processed: rows.length,
      success,
      failed,
      failures,
    })
  }

  if (action === 'generate_one') {
    let provider: Provider
    try {
      provider = detectProvider()
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'No LLM credentials' },
        { status: 500 },
      )
    }

    const track = body.track as RowSource | 'classics' | 'international' | 'currently-challenged' | 'theme' | 'young-readers' | undefined
    const bookId = Number(body.book_id)
    const setType: QuestionSetType = body.set_type === 'ban' ? 'ban' : 'book'
    if (!track || !Number.isInteger(bookId)) {
      return NextResponse.json({ error: 'Missing track or book_id' }, { status: 400 })
    }

    // Hydrate context from the book + (for young-readers) the row itself, so
    // the generator gets the right audience hint without the client having
    // to send it.
    const supabase = adminClient()
    const { data: book } = await supabase
      .from('books')
      .select('title, book_authors(authors(display_name))')
      .eq('id', bookId)
      .maybeSingle()
    if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    type B = { title: string; book_authors: { authors: { display_name: string } | null }[] | null }
    const b = book as unknown as B
    const title = b.title
    const author = (b.book_authors ?? [])
      .map(ba => ba.authors?.display_name)
      .filter((s): s is string => !!s)[0] ?? 'Unknown'

    let audience: string | null = null
    if (track === 'young-readers') {
      const { data: yr } = await supabase
        .from('reading_club_young_readers')
        .select('audience_as_published')
        .eq('book_id', bookId)
        .maybeSingle()
      audience = (yr as { audience_as_published: string | null } | null)?.audience_as_published ?? null
    }

    try {
      const gen = setType === 'ban' ? generateBanDiscussionQuestions : generateDiscussionQuestions
      const questions = await gen({ title, author, audience })
      return NextResponse.json({ provider, questions })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Generator failed' },
        { status: 502 },
      )
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
