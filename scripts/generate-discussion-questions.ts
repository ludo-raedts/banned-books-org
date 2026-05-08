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

const APPLY = process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')
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

type Source = 'rc_cc' | 'rc_intl' | 'rc_classics' | 'rc_theme'

type RowToProcess = {
  source: Source
  scope: Record<string, string | number>  // unique-key fields for the UPDATE
  title: string
  author: string
  hasQuestions: boolean  // true if we'd be overwriting (only with --force)
}

const TABLE_BY_SOURCE: Record<Source, string> = {
  rc_cc:       'reading_club_currently_challenged',
  rc_intl:     'reading_club_international',
  rc_classics: 'reading_club_classics',
  rc_theme:    'reading_club_theme_books',
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  return false
}

function pickAuthor(book: {
  book_authors?: { authors: { display_name: string } | null }[] | null
}): string {
  const list = (book.book_authors ?? [])
    .map(ba => ba.authors?.display_name)
    .filter((s): s is string => !!s)
  return list[0] ?? ''
}

async function findRows(): Promise<RowToProcess[]> {
  const supabase = adminClient()
  const out: RowToProcess[] = []

  // ── Currently Challenged ────────────────────────────────────────────────
  const { data: cc } = await supabase
    .from('reading_club_currently_challenged')
    .select('year, position, title, author, discussion_questions')
  for (const r of cc ?? []) {
    const has = !isEmpty(r.discussion_questions)
    if (has && !FORCE) continue
    out.push({
      source: 'rc_cc',
      scope: { year: r.year, position: r.position },
      title: r.title,
      author: r.author,
      hasQuestions: has,
    })
  }

  // ── International ───────────────────────────────────────────────────────
  const { data: intl } = await supabase
    .from('reading_club_international')
    .select(`book_id, discussion_questions,
             books(title, book_authors(authors(display_name)))`)
  type IntlRow = {
    book_id: number
    discussion_questions: unknown
    books: { title: string; book_authors: { authors: { display_name: string } | null }[] | null } | null
  }
  for (const r of (intl ?? []) as unknown as IntlRow[]) {
    const has = !isEmpty(r.discussion_questions)
    if (has && !FORCE) continue
    if (!r.books) continue
    out.push({
      source: 'rc_intl',
      scope: { book_id: r.book_id },
      title: r.books.title,
      author: pickAuthor(r.books),
      hasQuestions: has,
    })
  }

  // ── Classics ────────────────────────────────────────────────────────────
  const { data: classics } = await supabase
    .from('reading_club_classics')
    .select(`book_id, discussion_questions,
             books(title, book_authors(authors(display_name)))`)
  for (const r of (classics ?? []) as unknown as IntlRow[]) {
    const has = !isEmpty(r.discussion_questions)
    if (has && !FORCE) continue
    if (!r.books) continue
    out.push({
      source: 'rc_classics',
      scope: { book_id: r.book_id },
      title: r.books.title,
      author: pickAuthor(r.books),
      hasQuestions: has,
    })
  }

  // ── Theme books ─────────────────────────────────────────────────────────
  const { data: themes } = await supabase
    .from('reading_club_theme_books')
    .select(`theme_slug, book_id, discussion_questions,
             books(title, book_authors(authors(display_name)))`)
  type ThemeRow = IntlRow & { theme_slug: string }
  for (const r of (themes ?? []) as unknown as ThemeRow[]) {
    const has = !isEmpty(r.discussion_questions)
    if (has && !FORCE) continue
    if (!r.books) continue
    out.push({
      source: 'rc_theme',
      scope: { theme_slug: r.theme_slug, book_id: r.book_id },
      title: r.books.title,
      author: pickAuthor(r.books),
      hasQuestions: has,
    })
  }

  return out
}

async function saveQuestions(row: RowToProcess, questions: string[]): Promise<void> {
  const supabase = adminClient()
  const table = TABLE_BY_SOURCE[row.source]
  let q = supabase.from(table).update({
    discussion_questions: questions,
    updated_at: new Date().toISOString(),
  })
  for (const [k, v] of Object.entries(row.scope)) {
    q = q.eq(k, v)
  }
  const { error } = await q
  if (error) throw new Error(`DB update failed: ${error.message}`)
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

  const rows = await findRows()
  const eligible = rows.slice(0, Number.isFinite(LIMIT) ? LIMIT : rows.length)

  console.log(`Found ${rows.length} eligible row(s). Processing ${eligible.length}.`)
  if (FORCE) console.log('--force is set: existing questions will be overwritten.')
  if (eligible.length === 0) return

  if (!APPLY) {
    for (const r of eligible) {
      const flag = r.hasQuestions ? ' (already has questions)' : ''
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
      await saveQuestions(row, questions)
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
