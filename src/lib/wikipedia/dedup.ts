// Pre-flight dedup against the `books` table.
//
// Two-stage check:
//   1. Slug-collision first pass — fast indexed equality on books.slug
//      using the same `slugify` helper the importer uses for INSERT. This
//      catches the most common duplicate shape (identical canonical title)
//      without paying for two fuzzy RPCs. Added in commit 8 after Rangila
//      Rasul collided at apply-time despite fuzzy returning no candidate
//      (author-name variation broke the intersection).
//   2. Fuzzy similarity second pass — reuses the Taak 3 RPCs so trigram
//      thresholds and ranking stay consistent with the LLM-pipeline path:
//        - find_book_candidates_by_title(q, threshold) → top-10 by similarity
//        - find_author_candidates_by_name(q, threshold) → top-10 by similarity
//      A book is considered the same when BOTH the title fuzzy-matches AND
//      any of the parsed-row authors fuzzy-matches an author already linked
//      to that book. Author co-attribution prevents false positives on
//      common-title collisions (e.g. multiple distinct books titled "Shame").
//
// Decision boundaries:
//   slug equality      → duplicate (match_type: 'slug_collision', sim=1.0)
//   fuzzy sim > 0.85   → duplicate (match_type: 'fuzzy_title_author')
//   0.5 < sim ≤ 0.85   → possible_duplicate (match_type: 'fuzzy_possible')
//   no overlap         → none

import { slugify } from '../imports/slugify'
import type { adminClient } from '../supabase'
import type { DedupResult, ParsedRow } from './types'

type Sb = ReturnType<typeof adminClient>

// Threshold for the RPC's candidate filter. Set conservatively low so that
// long-form Wikipedia titles ("Hind Swaraj or Indian Home Rule") still
// surface DB rows that use shorter canonical titles ("Hind Swaraj"). The
// real auto-vs-review decision happens at DUPLICATE_CUTOFF below; anything
// between the threshold and the cutoff routes to review, never auto-approve.
const BOOK_THRESHOLD = 0.35
const AUTHOR_THRESHOLD = 0.5
const DUPLICATE_CUTOFF = 0.85

type BookCandidate = { id: number; title: string; slug: string; score: number }
type AuthorCandidate = { id: number; display_name: string; slug: string; score: number }

export async function dedupAgainstBooks(
  sb: Sb,
  row: ParsedRow,
): Promise<DedupResult> {
  // 1. Slug-collision first pass. The importer slugifies the title before
  //    INSERT; running the same helper here catches exact-canonical-title
  //    duplicates that fuzzy may miss when author names differ between the
  //    Wikipedia row and the prod row (commit-8 trigger case: Rangila Rasul).
  if (row.title) {
    const candidateSlug = slugify(row.title)
    if (candidateSlug) {
      const { data: slugMatch, error: slugErr } = await sb
        .from('books')
        .select('id')
        .eq('slug', candidateSlug)
        .maybeSingle()
      if (slugErr) {
        throw new Error(`dedup: slug lookup failed: ${slugErr.message}`)
      }
      if (slugMatch) {
        return {
          kind: 'duplicate',
          book_id: slugMatch.id as number,
          similarity: 1,
          match_type: 'slug_collision',
        }
      }
    }
  }

  // 2. Fuzzy second pass. Without a title or any authors, we cannot stage
  //    an author-intersection safely. Caller should already have routed
  //    these rows to review on quality flags; returning 'none' here is the
  //    safe choice.
  if (!row.title || row.authors.length === 0) {
    return { kind: 'none' }
  }

  const { data: bookRpc, error: bookErr } = await sb.rpc(
    'find_book_candidates_by_title',
    { q: row.title, threshold: BOOK_THRESHOLD },
  )
  if (bookErr) {
    throw new Error(`dedup: find_book_candidates_by_title failed: ${bookErr.message}`)
  }
  const bookCandidates = (bookRpc ?? []) as BookCandidate[]
  if (bookCandidates.length === 0) return { kind: 'none' }

  // Collect book_ids that have ANY author fuzzy-matching ANY parsed author.
  const authorMatchedBookIds = new Set<number>()
  for (const authorName of row.authors) {
    const { data: authorRpc, error: authorErr } = await sb.rpc(
      'find_author_candidates_by_name',
      { q: authorName, threshold: AUTHOR_THRESHOLD },
    )
    if (authorErr) {
      throw new Error(
        `dedup: find_author_candidates_by_name failed for '${authorName}': ${authorErr.message}`,
      )
    }
    const authorIds = ((authorRpc ?? []) as AuthorCandidate[]).map(a => a.id)
    if (authorIds.length === 0) continue
    const { data: joinRows, error: joinErr } = await sb
      .from('book_authors')
      .select('book_id')
      .in('author_id', authorIds)
    if (joinErr) {
      throw new Error(`dedup: book_authors lookup failed: ${joinErr.message}`)
    }
    for (const r of joinRows ?? []) {
      authorMatchedBookIds.add(r.book_id as number)
    }
  }

  if (authorMatchedBookIds.size === 0) return { kind: 'none' }

  // Best matching book by title-score that is also author-linked.
  const titleAndAuthor = bookCandidates.filter(b => authorMatchedBookIds.has(b.id))
  if (titleAndAuthor.length === 0) return { kind: 'none' }

  const best = titleAndAuthor[0] // RPC returns rows sorted by score desc
  if (best.score > DUPLICATE_CUTOFF) {
    return {
      kind: 'duplicate',
      book_id: best.id,
      similarity: best.score,
      match_type: 'fuzzy_title_author',
    }
  }
  return {
    kind: 'possible_duplicate',
    book_id: best.id,
    similarity: best.score,
    match_type: 'fuzzy_possible',
  }
}
