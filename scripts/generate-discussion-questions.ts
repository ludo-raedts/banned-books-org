/**
 * Generate book-club discussion questions for every Reading Club book that
 * doesn't have any yet. Calls Claude Opus 4.7 with adaptive thinking and
 * writes the result back into the per-track `discussion_questions` jsonb
 * column.
 *
 * Books processed (only rows where discussion_questions is null or empty):
 *   • reading_club_currently_challenged   (uses stored title/author)
 *   • reading_club_international          (joins to books for title/author)
 *   • reading_club_classics               (joins to books for title/author)
 *   • reading_club_theme_books            (joins to books for title/author)
 *
 * The same book can appear in multiple tracks; we generate questions per row,
 * not per book — different tracks may want slightly different framings, and
 * the prompt is fast enough that re-asking is cheaper than synchronizing.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/generate-discussion-questions.ts
 *     → dry-run: lists eligible rows, no API calls, no DB writes
 *   npx tsx --env-file=.env.local scripts/generate-discussion-questions.ts --apply
 *     → calls Claude for each eligible row and writes the result
 *   npx tsx --env-file=.env.local scripts/generate-discussion-questions.ts --apply --limit=10
 *     → cap at 10 rows per run (useful when staging on a fresh database)
 *   npx tsx --env-file=.env.local scripts/generate-discussion-questions.ts --apply --force
 *     → regenerate questions even when they already exist (overwrites!)
 *   npx tsx --env-file=.env.local scripts/generate-discussion-questions.ts --apply --provider=openai
 *     → force OpenAI (default: Claude when ANTHROPIC_API_KEY is set, else OpenAI)
 *   npx tsx --env-file=.env.local scripts/generate-discussion-questions.ts --apply --include-auto-themes
 *     → ALSO materialize the auto-pull set for any theme that has no manually
 *       curated books yet (top 12 books matching the theme's reasons), then
 *       generate questions for them. Without this flag, themes that rely on
 *       auto-pull are skipped (their books aren't persisted in the table, so
 *       there's nowhere to attach questions).
 *
 * Environment: ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY in .env.local.
 *
 * Cost (50 books): ~$1–2 with Claude Opus 4.7, ~$0.10 with OpenAI gpt-4o.
 * Quality is highest with Claude Opus 4.7 for this nuance-heavy task; gpt-4o
 * is acceptable.
 *
 * Idempotent by default: re-running without --force only fills rows that are
 * still empty. Failures are logged per-row and don't abort the run.
 */

import { adminClient } from '../src/lib/supabase'
import {
  generateDiscussionQuestions,
  detectProvider,
  type Provider,
} from '../src/lib/discussion-questions'
import { THEME_REASON_MAP } from '../src/lib/reading-club-data'
import {
  findReadingClubRowsMissingQuestions,
  saveDiscussionQuestionsToRow,
} from '../src/lib/reading-club-questions'

const APPLY = process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')
const INCLUDE_AUTO_THEMES = process.argv.includes('--include-auto-themes')
const LIMIT = (() => {
  const arg = process.argv.find(a => a.startsWith('--limit='))
  return arg ? parseInt(arg.slice('--limit='.length), 10) : Infinity
})()
const PROVIDER_OVERRIDE: Provider | undefined = (() => {
  const arg = process.argv.find(a => a.startsWith('--provider='))
  if (!arg) return undefined
  const value = arg.slice('--provider='.length)
  if (value !== 'claude' && value !== 'openai') {
    console.error(`Bad --provider value: ${value}. Use claude or openai.`)
    process.exit(1)
  }
  return value
})()

// Row-finding and DB-write logic now lives in src/lib/reading-club-questions.ts
// so the admin button (POST /api/admin/generate-discussion-questions) and the
// CLI use the exact same eligibility rules and scope keys.

// Materializes the auto-pull list for any theme that has zero rows yet:
// pulls the top 12 books matching the theme's reasons, ranks by ban count,
// and inserts as published rows. Idempotent — only acts on empty themes.
//
// Why this exists: themes without explicit overrides display books computed
// at request time via THEME_REASON_MAP joins; those books aren't in
// reading_club_theme_books, so there's no row to hold discussion_questions.
// Materializing makes them addressable.
async function materializeAutoPullThemes(): Promise<{ themeSlug: string; inserted: number }[]> {
  const supabase = adminClient()
  const summary: { themeSlug: string; inserted: number }[] = []

  const { data: themes } = await supabase
    .from('reading_club_themes')
    .select('slug')
    .order('sort_order')

  for (const theme of themes ?? []) {
    const themeSlug = theme.slug as string
    const reasonSlugs = THEME_REASON_MAP[themeSlug as keyof typeof THEME_REASON_MAP]
    if (!reasonSlugs || reasonSlugs.length === 0) continue

    // Skip themes that already have any rows (curated or previously materialized).
    const { count } = await supabase
      .from('reading_club_theme_books')
      .select('*', { count: 'exact', head: true })
      .eq('theme_slug', themeSlug)
    if ((count ?? 0) > 0) continue

    // Reason IDs for this theme.
    const { data: reasonRows } = await supabase
      .from('reasons')
      .select('id')
      .in('slug', reasonSlugs as string[])
    const reasonIds = (reasonRows ?? []).map(r => r.id as number)
    if (reasonIds.length === 0) continue

    // All bans tagged with any of those reasons.
    const { data: links } = await supabase
      .from('ban_reason_links')
      .select('ban_id')
      .in('reason_id', reasonIds)
    const banIds = Array.from(new Set((links ?? []).map(l => l.ban_id)))
    if (banIds.length === 0) continue

    // Map bans to books, count occurrences per book — top 12 by ban count
    // become the materialized set. Tiebreak by book_id for determinism.
    const { data: bans } = await supabase
      .from('bans')
      .select('book_id')
      .in('id', banIds)
    const counts = new Map<number, number>()
    for (const b of bans ?? []) {
      counts.set(b.book_id, (counts.get(b.book_id) ?? 0) + 1)
    }
    const topBookIds = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 12)
      .map(([id]) => id)
    if (topBookIds.length === 0) continue

    if (!APPLY) {
      summary.push({ themeSlug, inserted: topBookIds.length })
      continue
    }

    const now = new Date().toISOString()
    const rows = topBookIds.map((book_id, i) => ({
      theme_slug: themeSlug,
      book_id,
      position: i + 1,
      published_at: now,
    }))
    const { error } = await supabase.from('reading_club_theme_books').insert(rows)
    if (error) {
      console.error(`  ✗ Could not materialize theme "${themeSlug}": ${error.message}`)
      continue
    }
    summary.push({ themeSlug, inserted: rows.length })
  }
  return summary
}

async function main() {
  if (APPLY) {
    try {
      const provider = PROVIDER_OVERRIDE ?? detectProvider()
      console.log(`Using LLM provider: ${provider}`)
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  }

  // Optional: materialize auto-pull theme books before scanning.
  if (INCLUDE_AUTO_THEMES) {
    const materialized = await materializeAutoPullThemes()
    if (materialized.length > 0) {
      console.log('Auto-pull theme materialization:')
      for (const m of materialized) {
        console.log(`  + ${m.themeSlug}: ${m.inserted} book(s)${APPLY ? ' inserted' : ' would be inserted'}`)
      }
      if (!APPLY) console.log('  (dry-run — re-run with --apply to actually insert)')
    } else {
      console.log('Auto-pull theme materialization: nothing to do (every theme already has rows).')
    }
  } else {
    // Hint: count themes that would benefit from materialization, so the user
    // doesn't silently miss the auto-pull case.
    const supabase = adminClient()
    const { data: themes } = await supabase.from('reading_club_themes').select('slug')
    let needsMat = 0
    for (const t of themes ?? []) {
      const { count } = await supabase
        .from('reading_club_theme_books')
        .select('*', { count: 'exact', head: true })
        .eq('theme_slug', t.slug)
      if ((count ?? 0) === 0) needsMat++
    }
    if (needsMat > 0) {
      console.log(`Note: ${needsMat} theme(s) have no curated books yet — they currently auto-pull at request time.`)
      console.log('      Pass --include-auto-themes to materialize them and generate questions for those books too.')
    }
  }

  const rows = await findReadingClubRowsMissingQuestions({ force: FORCE })
  const eligible = rows.slice(0, Number.isFinite(LIMIT) ? LIMIT : rows.length)

  console.log(`\nFound ${rows.length} eligible row(s). Processing ${eligible.length}.`)
  if (FORCE) console.log('--force is set: existing questions will be overwritten.')
  if (eligible.length === 0) return

  if (!APPLY) {
    for (const r of eligible) {
      const flag = r.hasExisting ? ' (already has questions)' : ''
      console.log(`  [${r.source}] "${r.title}" — ${r.author || 'unknown author'}${flag}`)
    }
    console.log('\nDry run — pass --apply to call the LLM and write to the database.')
    return
  }

  let success = 0
  let failed = 0
  const failures: string[] = []

  for (let i = 0; i < eligible.length; i++) {
    const row = eligible[i]
    const label = `[${i + 1}/${eligible.length}] ${row.title}`
    process.stdout.write(`  ${label} … `)
    try {
      const questions = await generateDiscussionQuestions(
        { title: row.title, author: row.author },
        PROVIDER_OVERRIDE ? { provider: PROVIDER_OVERRIDE } : undefined,
      )
      await saveDiscussionQuestionsToRow(row, questions)
      console.log(`✓ ${questions.length} questions`)
      success++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`✗ ${msg}`)
      failures.push(`${row.source}/"${row.title}": ${msg}`)
      failed++
    }
  }

  console.log(`\nDone. Success: ${success}. Failed: ${failed}.`)
  if (failures.length > 0) {
    console.log('\nFailures:')
    for (const f of failures) console.log(`  • ${f}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
