/**
 * Title-to-title containment guard for *title-search* enrichment fallbacks.
 *
 * Background — the recurring "most-popular hit" contamination:
 * When an ISBN lookup fails, the cover/description enrichers fall back to a
 * free-text title search against Open Library / Google Books. Those endpoints
 * happily return the most-popular namesake or sibling volume, and the old
 * acceptance checks were far too weak:
 *   - "first 10/12 characters of the title" prefix match, or
 *   - no title check at all (take docs[0] / items[0]).
 * That pinned "The Seven Wonders of the Ancient World"'s cover onto
 * "...Historic World", every "Assassination Classroom, Vol. N" onto Vol. 1,
 * and pasted Huckleberry Finn's / the Bible's blurb onto dozens of unrelated
 * imports.
 *
 * The guard here is deliberately conservative: a MISSING cover/description is
 * always better than a confidently-wrong one. We require that EVERY
 * significant word of our title — distinctive words *and* volume numbers —
 * is present in the candidate's title. Stopwords (articles, prepositions,
 * "vol"/"volume"/"part"/"book"/"series") are dropped so edition noise and
 * appended subtitles don't break an otherwise-correct match.
 */

const TITLE_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'with',
  'at', 'by', 'from', 'as',
  // volume/part markers — we keep the *number* but drop the marker word so
  // "Vol. 3" still differs from "Vol. 5" via the surviving digit token.
  'vol', 'volume', 'part', 'book', 'series', 'no',
])

export function titleTokens(s: string): Set<string> {
  return new Set(
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter((t) => t.length > 0 && !TITLE_STOPWORDS.has(t)),
  )
}

/**
 * True only when every significant token of `ourTitle` also appears in
 * `candidateTitle`. Asymmetric on purpose: the candidate may carry extra
 * tokens (subtitle, "(Book 1)", series suffix) and still match, but it may
 * NOT be missing any distinctive word of ours.
 *
 * Returns false when our title has no significant tokens — we can't verify a
 * match we can't characterise, so we refuse rather than guess.
 */
export function titlesMatch(ourTitle: string, candidateTitle: string): boolean {
  const ours = titleTokens(ourTitle)
  if (ours.size === 0) return false
  const candidate = titleTokens(candidateTitle)
  for (const tok of ours) {
    if (!candidate.has(tok)) return false
  }
  return true
}
