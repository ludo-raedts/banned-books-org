// genre-folds.ts — the remediation table for off-vocabulary `books.genres` slugs.
//
// The canonical vocabulary is the GENRES map in src/components/genre-badge.tsx
// (gate on isMappedGenre(), never on genreLabel()). Anything outside it renders
// as the grey fallback badge, is dropped from the /discover genre wizard
// (collectDiscoverGenres filters on isMappedGenre), and is invisible to every
// genre-aware query that spells its slugs out.
//
// Drift measured catalogue-wide on 2026-09-03: 48 distinct slugs in the DB
// against 21 in the map, i.e. 27 strays on 504 books. Four strays were real
// categories the map was simply missing and have been promoted into it
// (picture-book, middle-grade-fiction, poetry, drama — see the map's comment);
// the other 23 fold or drop here.
//
// Shared by scripts/_audit_genre_vocabulary.ts (read-only) and
// scripts/_fix_genre_vocabulary.ts (writes), so detector and fixer can never
// disagree about the intended end state.

/** Off-vocabulary slug → canonical replacement, unconditionally. */
export const FOLD: Record<string, string> = {
  // Exact synonyms / spelling variants of a slug already in the map.
  'young-adult-fiction':  'young-adult',
  'childrens-literature': 'children',
  'essays':               'essay',
  'nonfiction':           'non-fiction',
  // "historical" only ever sat on historical novels (I the Supreme, Son of Man,
  // Stalingrad, A Lesson Before Dying).
  'historical':           'historical-fiction',
  // Subject tags whose honest parent genre is in the map. NOTE: the
  // fiction-contradiction guard in resolveGenres() drops the introduced
  // `non-fiction` when the row is already fiction or poetry, so a novelised
  // biography stays fiction instead of becoming both.
  'philosophy':           'non-fiction',
  'science':              'non-fiction',
  'psychology':           'non-fiction',
  'law':                  'non-fiction',
  'travel':               'non-fiction',
  'health':               'non-fiction',
  // A biography of someone else is not the author's own life writing, so
  // non-fiction — NOT memoir.
  'biography':            'non-fiction',
  'political-theory':     'political-non-fiction',
  'mystery':              'thriller',
}

/**
 * Slugs that fold differently depending on whether the row is fiction or
 * non-fiction. `political`/`politics`/`history` all appear on both kinds of book.
 */
export const CONTEXTUAL_FOLD: Record<string, { fiction: string; nonFiction: string }> = {
  'political': { fiction: 'political-fiction', nonFiction: 'political-non-fiction' },
  'politics':  { fiction: 'political-fiction', nonFiction: 'political-non-fiction' },
  // A history book is non-fiction; `history` there adds subject, not genre, so it
  // collapses into the non-fiction slug the row already carries. On a novel it
  // means historical-fiction.
  'history':   { fiction: 'historical-fiction', nonFiction: 'non-fiction' },
}

/**
 * Slugs deleted outright, with the reason. A row left with no slugs at all after
 * dropping goes back to `genres = '{}'`, which is the CORRECT state for a book
 * nobody has classified — it re-enters the enrich-genres-gpt.ts candidate pool
 * instead of sitting behind a label that was never evidence.
 */
export const DROP: Record<string, string> = {
  // Bare "fiction" is the same non-classification as a blanket literary-fiction
  // stamp: it says the book is a novel, which the vocabulary never needed a slug for.
  'fiction':          'not a genre — "it is a novel" is not a classification',
  // Form/subject notes, not genres. Every row carrying these already carries a
  // real slug (literary-fiction / non-fiction), so the drop is lossless.
  'short-stories':    'form, not genre — rows already carry literary-fiction',
  'novella':          'form, not genre — row already carries literary-fiction',
  'war':              'subject, not genre',
  'autobiographical': 'describes an autobiographical NOVEL — literary-fiction already present',
  // `lgbtq` and `political` are ban-REASON slugs (see the reasons table and
  // REASON_SLUGS in src/app/page.tsx). A reason is not a genre.
  'lgbtq':            'ban reason, not a genre — the reasons table carries this',
}

/** Fiction (or verse/drama) signals — used by the contextual fold and the guard. */
const FICTION_SLUGS = new Set([
  'literary-fiction', 'historical-fiction', 'political-fiction', 'science-fiction',
  'fantasy', 'dystopian', 'romance', 'thriller', 'horror', 'magical-realism',
  'coming-of-age', 'experimental', 'fiction', 'novella', 'short-stories',
  'young-adult', 'young-adult-fiction', 'children', 'picture-book',
  'middle-grade-fiction', 'childrens-literature', 'drama', 'poetry',
])
const NON_FICTION_SLUGS = new Set([
  'non-fiction', 'nonfiction', 'memoir', 'essay', 'essays', 'political-non-fiction',
  'controversial-non-fiction', 'biography', 'history', 'philosophy', 'science',
  'psychology', 'law', 'travel', 'health', 'political-theory',
])
// Slugs that vote NEITHER way, on purpose:
//   satire            — the vocabulary defines it as "fiction OR essay", and it
//                       legitimately pairs with non-fiction (Voltaire's
//                       Philosophical Dictionary).
//   graphic-novel     — a FORM, not a mode. It pairs with memoir (Maus,
//                       Persepolis, Fun Home) and with non-fiction (The
//                       Gettysburg Address: A Graphic Adaptation) just as happily
//                       as with fiction, so it must not vote either way.
//   autobiographical  — sits on an autobiographical NOVEL (#6247 One Man's Bible),
//                       so counting it as non-fiction evidence would flip the row.
//   war, lgbtq        — subject / ban reason, silent on form.

/**
 * Rows where a row already declares itself non-fiction yet carries
 * `political-fiction`. The vocabulary has had `political-non-fiction` since
 * 2026-05-11 ("non-fiction whose core subject is political analysis or polemic")
 * and this is exactly it — Mein Kampf, Das Kapital, The Communist Manifesto and
 * Steal This Book were all tagged political FICTION. Unambiguous: the row's own
 * `non-fiction` slug settles which of the two is wrong.
 *
 * The neighbouring classes are NOT repaired here because which slug is wrong
 * varies per row (`non-fiction`+`historical-fiction`: #147 Tombstone wants
 * non-fiction, #1653 Black Beauty wants historical-fiction). The audit reports
 * them as residue.
 */
export const NON_FICTION_SLUG_REPAIR: Record<string, string> = {
  'political-fiction': 'political-non-fiction',
}

/**
 * Resolve one row's `genres` to the canonical vocabulary.
 *
 * Order matters:
 *   1. DROP        — so a dropped `fiction` cannot vote in the fiction/non-fiction
 *                    decision below.
 *   2. FOLD / CONTEXTUAL_FOLD.
 *   3. NON_FICTION_SLUG_REPAIR on rows that declare `non-fiction`.
 *   4. contradiction guard — an introduced `non-fiction` is dropped again when the
 *      row is fiction/verse and did not already carry it.
 * Dedupes, preserves first-seen order, and caps at the 3 slugs the vocabulary
 * allows (keeping the earliest — the import/classifier writes the primary first).
 */
export function resolveGenres(genres: string[]): string[] {
  const kept = genres.filter((g) => !(g in DROP))

  // Vote on the ORIGINAL array, not on `kept`: `fiction` / `novella` /
  // `short-stories` are real evidence that the book is a novel even though none
  // of them survives as a slug. Voting after the drop turned #1022 The Black
  // Prophet (a famine novel tagged ["fiction","political"]) into
  // political-NON-fiction, because dropping `fiction` erased the only signal.
  const fictionVotes    = genres.filter((g) => FICTION_SLUGS.has(g)).length
  const nonFictionVotes = genres.filter((g) => NON_FICTION_SLUGS.has(g)).length
  // Tie or no signal → treat as non-fiction: every contextual slug (political,
  // politics, history) is overwhelmingly a non-fiction subject in this catalogue,
  // so that beats guessing a novel.
  const isFiction = fictionVotes > nonFictionVotes
  const declaresNonFiction = kept.includes('non-fiction') || kept.includes('nonfiction')
  const hadNonFiction = genres.includes('non-fiction')

  const out: string[] = []
  for (const g of kept) {
    let slug = g
    if (g in FOLD) slug = FOLD[g]
    else if (g in CONTEXTUAL_FOLD) slug = isFiction ? CONTEXTUAL_FOLD[g].fiction : CONTEXTUAL_FOLD[g].nonFiction
    if (declaresNonFiction && slug in NON_FICTION_SLUG_REPAIR) slug = NON_FICTION_SLUG_REPAIR[slug]
    // Contradiction guard: never ADD non-fiction to a row that already resolved
    // to a fiction or verse slug (#6245 The Red Sari = novelised biography,
    // #996 The Prophet = poetry). Checks the resolved set rather than the vote,
    // so a 1-1 tie cannot slip a contradiction through.
    if (slug === 'non-fiction' && !hadNonFiction && out.some((s) => FICTION_SLUGS.has(s))) continue
    if (!out.includes(slug)) out.push(slug)
  }
  return out.slice(0, 3)
}

/** Every slug this table knows how to remove. */
export function isHandledStray(slug: string): boolean {
  return slug in FOLD || slug in CONTEXTUAL_FOLD || slug in DROP
}
