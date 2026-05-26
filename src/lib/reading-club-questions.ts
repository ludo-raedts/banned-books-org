// Shared helpers for finding Reading Club rows that lack discussion questions
// and writing generated questions back. Used by:
//   • scripts/generate-discussion-questions.ts (CLI batch)
//   • src/app/api/admin/generate-discussion-questions/route.ts (admin button)
//
// Keeping the row-discovery logic in one place means the CLI and the admin
// button stay in lockstep — same eligibility rules, same scope keys.

import { adminClient } from './supabase'

export type RowSource = 'rc_cc' | 'rc_intl' | 'rc_classics' | 'rc_theme' | 'rc_young_readers'

// Which question column this row maps to. Defaults to 'book' for legacy
// tracks (their single `discussion_questions` column carries the literary
// set). Young-readers rows yield one entry per missing column, one tagged
// 'book' and one tagged 'ban', so the batch generator can dispatch to the
// right prompt and write back to the right column.
export type QuestionSetType = 'book' | 'ban'

export type RowMissingQuestions = {
  source: RowSource
  /** Composite-key fields used to UPDATE this exact row. */
  scope: Record<string, string | number>
  title: string
  author: string
  /** True only when --force is in use; otherwise these rows are filtered out. */
  hasExisting: boolean
  setType: QuestionSetType
  /** Publisher-recorded audience string (young-readers only). Optional context for the LLM. */
  audience?: string | null
}

const TABLE_BY_SOURCE: Record<RowSource, string> = {
  rc_cc:            'reading_club_currently_challenged',
  rc_intl:          'reading_club_international',
  rc_classics:      'reading_club_classics',
  rc_theme:         'reading_club_theme_books',
  rc_young_readers: 'reading_club_young_readers',
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  return false
}

type JoinedBook = {
  title: string
  book_authors: { authors: { display_name: string } | null }[] | null
} | null

function pickAuthor(book: JoinedBook): string {
  if (!book) return ''
  return (book.book_authors ?? [])
    .map(ba => ba.authors?.display_name)
    .filter((s): s is string => !!s)[0] ?? ''
}

// Scans every Reading Club track for rows whose `discussion_questions` is
// null / empty. With `force: true`, returns every row regardless of state.
export async function findReadingClubRowsMissingQuestions(
  opts?: { force?: boolean },
): Promise<RowMissingQuestions[]> {
  const force = !!opts?.force
  const supabase = adminClient()
  const out: RowMissingQuestions[] = []

  // ── Currently Challenged ─────────────────────────────────────────────────
  const { data: cc } = await supabase
    .from('reading_club_currently_challenged')
    .select('year, position, title, author, discussion_questions')
  for (const r of cc ?? []) {
    const has = !isEmpty(r.discussion_questions)
    if (has && !force) continue
    out.push({
      source: 'rc_cc',
      scope: { year: r.year, position: r.position },
      title: r.title,
      author: r.author,
      hasExisting: has,
      setType: 'book',
    })
  }

  // ── International ────────────────────────────────────────────────────────
  const { data: intl } = await supabase
    .from('reading_club_international')
    .select(`book_id, discussion_questions,
             books(title, book_authors(authors(display_name)))`)
  type IntlRow = { book_id: number; discussion_questions: unknown; books: JoinedBook }
  for (const r of (intl ?? []) as unknown as IntlRow[]) {
    const has = !isEmpty(r.discussion_questions)
    if (has && !force) continue
    if (!r.books) continue
    out.push({
      source: 'rc_intl',
      scope: { book_id: r.book_id },
      title: r.books.title,
      author: pickAuthor(r.books),
      hasExisting: has,
      setType: 'book',
    })
  }

  // ── Classics ─────────────────────────────────────────────────────────────
  const { data: classics } = await supabase
    .from('reading_club_classics')
    .select(`book_id, discussion_questions,
             books(title, book_authors(authors(display_name)))`)
  for (const r of (classics ?? []) as unknown as IntlRow[]) {
    const has = !isEmpty(r.discussion_questions)
    if (has && !force) continue
    if (!r.books) continue
    out.push({
      source: 'rc_classics',
      scope: { book_id: r.book_id },
      title: r.books.title,
      author: pickAuthor(r.books),
      hasExisting: has,
      setType: 'book',
    })
  }

  // ── Theme books ──────────────────────────────────────────────────────────
  const { data: themes } = await supabase
    .from('reading_club_theme_books')
    .select(`theme_slug, book_id, discussion_questions,
             books(title, book_authors(authors(display_name)))`)
  type ThemeRow = IntlRow & { theme_slug: string }
  for (const r of (themes ?? []) as unknown as ThemeRow[]) {
    const has = !isEmpty(r.discussion_questions)
    if (has && !force) continue
    if (!r.books) continue
    out.push({
      source: 'rc_theme',
      scope: { theme_slug: r.theme_slug, book_id: r.book_id },
      title: r.books.title,
      author: pickAuthor(r.books),
      hasExisting: has,
      setType: 'book',
    })
  }

  // ── Young Readers ────────────────────────────────────────────────────────
  // Two question columns per row — yield one entry per missing set so the
  // batch generator can dispatch the right prompt and write back to the
  // right column.
  const { data: yr } = await supabase
    .from('reading_club_young_readers')
    .select(`book_id, discussion_questions_book, discussion_questions_ban,
             audience_as_published,
             books(title, book_authors(authors(display_name)))`)
  type YrRow = {
    book_id: number
    discussion_questions_book: unknown
    discussion_questions_ban: unknown
    audience_as_published: string | null
    books: JoinedBook
  }
  for (const r of (yr ?? []) as unknown as YrRow[]) {
    if (!r.books) continue
    const hasBook = !isEmpty(r.discussion_questions_book)
    const hasBan  = !isEmpty(r.discussion_questions_ban)
    if (!hasBook || force) {
      out.push({
        source: 'rc_young_readers',
        scope: { book_id: r.book_id },
        title: r.books.title,
        author: pickAuthor(r.books),
        hasExisting: hasBook,
        setType: 'book',
        audience: r.audience_as_published,
      })
    }
    if (!hasBan || force) {
      out.push({
        source: 'rc_young_readers',
        scope: { book_id: r.book_id },
        title: r.books.title,
        author: pickAuthor(r.books),
        hasExisting: hasBan,
        setType: 'ban',
        audience: r.audience_as_published,
      })
    }
  }

  return out
}

export async function saveDiscussionQuestionsToRow(
  row: Pick<RowMissingQuestions, 'source' | 'scope' | 'setType'>,
  questions: string[],
): Promise<void> {
  const supabase = adminClient()
  const table = TABLE_BY_SOURCE[row.source]

  // Legacy tracks have a single `discussion_questions` column. Young-readers
  // has two columns, one per set-type — pick the right one to update.
  const column = row.source === 'rc_young_readers'
    ? (row.setType === 'ban' ? 'discussion_questions_ban' : 'discussion_questions_book')
    : 'discussion_questions'

  let q = supabase.from(table).update({
    [column]: questions,
    updated_at: new Date().toISOString(),
  })
  for (const [k, v] of Object.entries(row.scope)) {
    q = q.eq(k, v)
  }
  const { error } = await q
  if (error) throw new Error(`DB update failed for ${table}.${column}: ${error.message}`)
}

// Lightweight count for the admin UI badge. Doesn't materialize anything —
// just tells the admin "N books are missing questions across all tracks".
export async function countReadingClubRowsMissingQuestions(): Promise<number> {
  const rows = await findReadingClubRowsMissingQuestions()
  return rows.length
}
