import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  findReadingClubRowsMissingQuestions,
  saveDiscussionQuestionsToRow,
} from '@/lib/reading-club-questions'
import {
  generateDiscussionQuestions,
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

export const maxDuration = 300

type Action = 'count' | 'generate'

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
    const failures: { source: string; title: string; error: string }[] = []

    for (const row of rows) {
      try {
        const questions = await generateDiscussionQuestions({
          title: row.title,
          author: row.author,
        })
        await saveDiscussionQuestionsToRow(row, questions)
        success++
      } catch (err) {
        failed++
        failures.push({
          source: row.source,
          title: row.title,
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

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
