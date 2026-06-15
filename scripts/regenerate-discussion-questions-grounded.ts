/**
 * Grounded regeneration of Reading Club discussion questions.
 *
 * Background: the original questions were produced by
 * generate-discussion-questions.ts, which feeds the LLM only {title, author}.
 * That decouples the questions from our own (verified) content and invites
 * hallucinated plot/character/event specifics — the exact failure mode we
 * want to avoid. This script splits generation into two grounded steps:
 *
 *   1. --export : dump a read-only worklist for EVERY reading-club row to
 *      data/_rc_questions_grounding.json — each entry carries the row's
 *      identity (source + scope + setType), title, author, first-published
 *      year, our stored description_book, the author bio, and a summary of
 *      the ACTUAL ban records (country / years / status / reason slugs).
 *      This is the only factual basis the questions may rely on.
 *
 *   2. --apply : read hand-authored questions from
 *      data/rc-questions-authored.json (an array of
 *      {source, scope, setType, questions[]}), validate them, and write each
 *      set to the right column via saveDiscussionQuestionsToRow. A review
 *      markdown (data/rc-questions-review.md) is emitted showing old vs new.
 *
 * The questions themselves are authored by Claude Opus (in-session), grounded
 * strictly in the exported context — never by an unattended weaker model.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/regenerate-discussion-questions-grounded.ts --export
 *   npx tsx --env-file=.env.local scripts/regenerate-discussion-questions-grounded.ts            (dry-run: validate authored file, no writes)
 *   npx tsx --env-file=.env.local scripts/regenerate-discussion-questions-grounded.ts --apply
 *   ... --apply --only=rc_classics            (restrict to one source/track)
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import {
  findReadingClubRowsMissingQuestions,
  saveDiscussionQuestionsToRow,
  type RowSource,
  type QuestionSetType,
} from '../src/lib/reading-club-questions'
import { isApply, hasFlag, flagValue } from './lib/cli'

const EXPORT = hasFlag('export')
const ONLY = flagValue('only') as RowSource | undefined
const GROUNDING_PATH = 'data/_rc_questions_grounding.json'
const AUTHORED_PATH = 'data/rc-questions-authored.json'
const REVIEW_PATH = 'data/rc-questions-review.md'

const MIN_Q = 5
const MAX_Q = 15 // currently-challenged historically ran 10–15; allow headroom

type GroundingEntry = {
  source: RowSource
  scope: Record<string, string | number>
  setType: QuestionSetType
  title: string
  author: string
  year: number | null
  description: string | null
  bio: string | null
  audience?: string | null
  bans: string[]
  currentCount: number
  current: string[]
}

type AuthoredEntry = {
  source: RowSource
  scope: Record<string, string | number>
  setType: QuestionSetType
  questions: string[]
}

function scopeKey(source: string, scope: Record<string, string | number>, setType: string): string {
  const parts = Object.entries(scope)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
  return `${source}|${parts.join('&')}|${setType}`
}

// ── EXPORT ──────────────────────────────────────────────────────────────────

async function buildBanSummary(db: ReturnType<typeof adminClient>, bookId: number): Promise<string[]> {
  const { data } = await db
    .from('bans')
    .select('country_code, year_started, year_ended, status, description, countries(name_en), ban_reason_links(reasons(slug))')
    .eq('book_id', bookId)
    .limit(40)
  const rows = (data ?? []) as unknown as {
    country_code: string
    year_started: number | null
    year_ended: number | null
    status: string | null
    description: string | null
    countries: { name_en: string } | null
    ban_reason_links: { reasons: { slug: string } | null }[] | null
  }[]
  return rows.map(b => {
    const country = b.countries?.name_en ?? b.country_code
    const span = b.year_started && b.year_ended ? `${b.year_started}–${b.year_ended}` : (b.year_started ? String(b.year_started) : '?')
    const reasons = (b.ban_reason_links ?? []).map(r => r.reasons?.slug).filter(Boolean).join(',')
    const note = b.description ? ` :: ${b.description.slice(0, 200)}` : ''
    return `${country} ${span} [${b.status ?? '?'}]${reasons ? ' reasons=' + reasons : ''}${note}`
  })
}

async function runExport() {
  const db = adminClient()
  // --force so we get EVERY row, not just empty ones — we are regenerating.
  const rows = await findReadingClubRowsMissingQuestions({ force: true })

  // Resolve book_id per row for description/bio/bans lookup.
  const out: GroundingEntry[] = []
  for (const r of rows) {
    if (ONLY && r.source !== ONLY) continue
    let bookId: number | null = typeof r.scope.book_id === 'number' ? r.scope.book_id as number : null
    let description: string | null = null
    let bio: string | null = null
    let year: number | null = null
    let current: string[] = []

    // currently-challenged has no book_id in scope but stores one on the row.
    if (r.source === 'rc_cc') {
      const { data } = await db
        .from('reading_club_currently_challenged')
        .select('book_id, discussion_questions')
        .eq('year', r.scope.year).eq('position', r.scope.position).maybeSingle()
      bookId = (data?.book_id as number | null) ?? null
      current = Array.isArray(data?.discussion_questions) ? data!.discussion_questions as string[] : []
    }

    if (bookId != null) {
      const { data: b } = await db
        .from('books')
        .select('first_published_year, description_book, book_authors(authors(bio))')
        .eq('id', bookId).maybeSingle()
      year = (b?.first_published_year as number | null) ?? null
      description = (b?.description_book as string | null) ?? null
      const authors = ((b?.book_authors ?? []) as { authors: { bio: string | null } | null }[])
        .map(x => x.authors?.bio).filter((s): s is string => !!s)
      bio = authors[0] ?? null
    }

    // Pull current questions for non-cc sources (cc handled above).
    if (r.source !== 'rc_cc' && bookId != null) {
      const col = r.source === 'rc_young_readers'
        ? (r.setType === 'ban' ? 'discussion_questions_ban' : 'discussion_questions_book')
        : 'discussion_questions'
      const table = {
        rc_intl: 'reading_club_international',
        rc_classics: 'reading_club_classics',
        rc_theme: 'reading_club_theme_books',
        rc_young_readers: 'reading_club_young_readers',
      }[r.source as Exclude<RowSource, 'rc_cc'>]
      let q = db.from(table!).select(col)
      for (const [k, v] of Object.entries(r.scope)) q = q.eq(k, v)
      const { data } = await q.maybeSingle()
      const val = data ? (data as Record<string, unknown>)[col] : null
      current = Array.isArray(val) ? val as string[] : []
    }

    const bans = bookId != null ? await buildBanSummary(db, bookId) : []
    out.push({
      source: r.source, scope: r.scope, setType: r.setType,
      title: r.title, author: r.author, year, description, bio,
      audience: r.audience, bans, currentCount: current.length, current,
    })
  }

  writeFileSync(GROUNDING_PATH, JSON.stringify(out, null, 2))
  console.log(`Exported ${out.length} grounding entries → ${GROUNDING_PATH}`)
  const byTrack = out.reduce<Record<string, number>>((acc, e) => {
    const k = `${e.source}${e.setType === 'ban' ? ' (ban)' : ''}`
    acc[k] = (acc[k] ?? 0) + 1; return acc
  }, {})
  for (const [k, n] of Object.entries(byTrack)) console.log(`  ${k}: ${n}`)
}

// ── APPLY / VALIDATE ──────────────────────────────────────────────────────────

// Strip an editor's leading "1." / "1)" / "Big Question:" prefix.
function normalize(q: string): string {
  return q.replace(/^\s*\d+[.)]\s*/, '').replace(/^\s*Big Question:\s*/i, '').trim()
}

// Heuristic guard against accidentally saving the Dutch conversation copies.
const DUTCH_MARKERS = /\b(het|een|deze|denk je|waarom denk|jouw|niet|wordt|zou|vind je|welke)\b/i
function looksDutch(q: string): boolean {
  return DUTCH_MARKERS.test(q)
}

function validate(entry: AuthoredEntry, grounding: Map<string, GroundingEntry>): string[] {
  const errs: string[] = []
  const key = scopeKey(entry.source, entry.scope, entry.setType)
  if (!grounding.has(key)) errs.push(`no matching reading-club row for scope ${key}`)
  const qs = entry.questions.map(normalize)
  if (qs.length < MIN_Q || qs.length > MAX_Q) errs.push(`question count ${qs.length} outside ${MIN_Q}–${MAX_Q}`)
  qs.forEach((q, i) => {
    if (q.length < 15) errs.push(`q${i + 1} too short: "${q}"`)
    if (looksDutch(q)) errs.push(`q${i + 1} looks Dutch (must be English): "${q.slice(0, 60)}…"`)
  })
  if (new Set(qs).size !== qs.length) errs.push('duplicate questions in set')
  return errs
}

async function runApply() {
  if (!existsSync(GROUNDING_PATH)) {
    console.error(`Missing ${GROUNDING_PATH}. Run with --export first.`)
    process.exit(1)
  }
  if (!existsSync(AUTHORED_PATH)) {
    console.error(`Missing ${AUTHORED_PATH}. Author questions there first (array of {source,scope,setType,questions}).`)
    process.exit(1)
  }
  const grounding = new Map<string, GroundingEntry>()
  for (const g of JSON.parse(readFileSync(GROUNDING_PATH, 'utf8')) as GroundingEntry[]) {
    grounding.set(scopeKey(g.source, g.scope, g.setType), g)
  }
  let authored = JSON.parse(readFileSync(AUTHORED_PATH, 'utf8')) as AuthoredEntry[]
  if (ONLY) authored = authored.filter(a => a.source === ONLY)

  const apply = isApply()
  const review: string[] = ['# Reading Club questions — regeneration review', '']
  let ok = 0, skipped = 0

  for (const entry of authored) {
    const errs = validate(entry, grounding)
    const key = scopeKey(entry.source, entry.scope, entry.setType)
    const g = grounding.get(key)
    const label = g ? `${g.title}${entry.setType === 'ban' ? ' (ban set)' : ''}` : key
    if (errs.length) {
      console.log(`  ✗ SKIP ${label}: ${errs.join('; ')}`)
      skipped++
      continue
    }
    const qs = entry.questions.map(normalize)
    review.push(`## ${label}  \n\`${key}\``, '')
    review.push('**Before:**')
    ;(g?.current ?? []).forEach((q, i) => review.push(`${i + 1}. ${q}`))
    review.push('', '**After:**')
    qs.forEach((q, i) => review.push(`${i + 1}. ${q}`))
    review.push('', '---', '')

    if (apply) {
      await saveDiscussionQuestionsToRow(
        { source: entry.source, scope: entry.scope, setType: entry.setType },
        qs,
      )
      console.log(`  ✓ WROTE ${label} (${qs.length} q)`)
    } else {
      console.log(`  · OK   ${label} (${qs.length} q) — dry-run`)
    }
    ok++
  }

  writeFileSync(REVIEW_PATH, review.join('\n'))
  console.log(`\n${apply ? 'Applied' : 'Validated'} ${ok} set(s), skipped ${skipped}. Review → ${REVIEW_PATH}`)
  if (!apply && ok > 0) console.log('Dry-run only. Re-run with --apply to write.')
}

async function main() {
  if (EXPORT) return runExport()
  return runApply()
}
main().catch(e => { console.error(e); process.exit(1) })
