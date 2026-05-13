// Pre-flight dedup against the `books` table.
//
// Reuses the Taak 3 fuzzy-match RPCs so the trigram thresholds and ranking
// stay consistent with the LLM-pipeline path:
//   - find_book_candidates_by_title(q, threshold) → top-10 by similarity
//   - find_author_candidates_by_name(q, threshold) → top-10 by similarity
//
// A book is considered the same when BOTH the title fuzzy-matches AND any of
// the parsed-row authors fuzzy-matches an author already linked to that book.
// Author co-attribution prevents false positives on common-title collisions
// (e.g. multiple distinct books titled "Shame").
//
// Decision boundaries (per spec):
//   similarity > 0.85  → duplicate (skip the row entirely)
//   0.5 < sim ≤ 0.85   → possible_duplicate (route to review; book_id logged)
//   no overlap          → none (new row)

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
  // Without a title or any authors, we cannot stage an author-intersection
  // safely. Caller should already have routed these rows to review on
  // quality flags; returning 'none' here is the safe choice.
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
    return { kind: 'duplicate', book_id: best.id, similarity: best.score }
  }
  return { kind: 'possible_duplicate', book_id: best.id, similarity: best.score }
}
