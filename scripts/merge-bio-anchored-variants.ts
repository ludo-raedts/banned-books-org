/**
 * Bio-anchored author-variant merge.
 *
 * For each author row that has a Wikipedia-sourced bio (the "anchor"),
 * find other rows WITHOUT a bio whose canonical token set is compatible
 * with the anchor's — and absorb them. Catches honorific-heavy or
 * clan-suffix-bearing forms that mirror the same person but never reached
 * the enrich-author-bios success path, e.g.
 *
 *     anchor      8156  "Ashaari Muhammad"        (Haji Ashaari Muhammad, Al-Arqam founder)
 *     variant     8142  "Ustaz Haji Ashaari Muhammad"
 *     variant     8147  "Sheikh Imam Ashaari Muhammad At-TAmimi"
 *     variant     8165  "Abuya Sheikh Imam Ashaari Muhammad At Tamimi"
 *
 * Compatibility rule (after dropping particles/honorifics on both sides):
 *
 *     candidate.tokens ⊆ anchor.tokens                 (candidate is a "shorter" form)
 *   OR
 *     anchor.tokens    ⊆ candidate.tokens AND
 *     candidate has at most 2 extra tokens             (candidate adds a clan / nisbah suffix)
 *
 * Safety guards:
 *   1. Anchor must have ≥ 2 distinctive (4+ char) tokens. A single-token
 *      name like "Madonna" or "Engels" alone is too generic to anchor on.
 *   2. Candidate is rejected if it is a co-author smush ("X dan Y", "X & Y", …).
 *   3. Candidate is rejected if it matches multiple distinct anchors —
 *      ambiguity, leave for manual review.
 *   4. Candidates that already carry a bio are NOT touched (handled by the
 *      identical-bio merge script).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/merge-bio-anchored-variants.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/merge-bio-anchored-variants.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { canonicaliseAuthorName } from '../src/lib/imports/canonicalise-author-name'

const APPLY = process.argv.includes('--apply')

const PARTICLES = new Set([
  // Name-connector particles
  'bin', 'binti', 'bt', 'bte', 'ibn', 'bint',
  'al', 'el', 'at',
  'de', 'da', 'di', 'du',
  'van', 'von', 'der', 'den', 'des',
  'of', 'the', 'and', 'et',
  // Honorifics / titles
  'dr', 'mr', 'mrs', 'ms', 'prof', 'professor',
  'sheikh', 'syeikh', 'imam', 'iman', 'abuya',
  'hj', 'haji', 'hajjah',
  'ust', 'ustaz', 'ustadz', 'ustazah',
  'sir', 'dame',  // 'lord'/'lady' deliberately omitted — real surnames in this dataset (Cynthia Lord, Sheldon Lord, …)
  'dato', 'datin',
  // Academic suffixes
  'ph', 'phd', 'sc', 'msc', 'bsc',
  'jr', 'sr', 'esq', 'jp', 'dphil',
])

// Multi-author smushes — refuse to merge any row whose display_name contains
// one of these coordination patterns. Case-insensitive so "Dan", "And"
// trigger as well.
const COAUTHOR_SMUSH =
  / &\s+[A-Z]| and \s+[A-Z][a-z]+| dan \s+[A-Z][a-z]+|,\s+[A-Z][a-z]+\s+[A-Z]/i

function tokensFor(displayName: string): Set<string> {
  return new Set(
    canonicaliseAuthorName(displayName)
      .toLowerCase()
      .split(/[\s.,&()'’"\-/]+/)
      .filter(t => t.length >= 2)
      .filter(t => !PARTICLES.has(t))
      .filter(t => !/^\d+$/.test(t)),
  )
}

function distinctiveTokens(t: Set<string>): number {
  let n = 0
  for (const x of t) if (x.length >= 4) n++
  return n
}

function maxTokenLength(t: Set<string>): number {
  let m = 0
  for (const x of t) if (x.length > m) m = x.length
  return m
}

/**
 * Anchor must be "distinctive enough":
 *   - At least 2 canonical tokens after particle drop (so single-token
 *     anchors like "George L." → {george} or "E. J. Schwartz" → {schwartz}
 *     don't accept every "George X" or "X Schwartz" as a variant)
 *   - AND either a long token (≥ 6 chars) or 3+ tokens (avoids generic
 *     2-token composites like "Abdul Hamid" attracting different people
 *     who share the pair).
 */
function isDistinctiveAnchor(t: Set<string>): boolean {
  return t.size >= 2 && (maxTokenLength(t) >= 6 || t.size >= 3)
}

function subsetOrEqual(small: Set<string>, big: Set<string>): boolean {
  if (small.size === 0) return false
  for (const t of small) if (!big.has(t)) return false
  return true
}

function firstWord(displayName: string): string {
  const parts = displayName.trim().split(/\s+/)
  return (parts[0] ?? '').toLowerCase()
}

function reEscape(s: string): string {
  return s.replace(/[.\\^$*+?()|[\]{}]/g, '\\$&')
}

/**
 * The anchor's first word must appear as a whole word in the candidate's
 * display_name (and vice versa). Stops bio-mismatch leakage: when the
 * anchor's bio was matched to a different person (e.g. "A.S Abdul
 * Rahman" anchor with a Tunku Abdul Rahman bio), the first-word check
 * rejects unrelated candidates that share only the trailing tokens.
 */
function firstWordsCompatible(anchor: string, candidate: string): boolean {
  const aFirst = firstWord(anchor)
  const cFirst = firstWord(candidate)
  if (!aFirst || !cFirst) return false
  const inCand = new RegExp(`\\b${reEscape(aFirst)}\\b`, 'i').test(candidate)
  const inAnchor = new RegExp(`\\b${reEscape(cFirst)}\\b`, 'i').test(anchor)
  return inCand || inAnchor
}

async function moveLinksAndDelete(sb: ReturnType<typeof adminClient>, fromId: number, intoId: number): Promise<number> {
  const { data: fromLinks } = await sb.from('book_authors').select('book_id, role').eq('author_id', fromId)
  const { data: keepLinks } = await sb.from('book_authors').select('book_id').eq('author_id', intoId)
  const keepSet = new Set((keepLinks ?? []).map(r => r.book_id))
  const toLink = (fromLinks ?? []).filter(l => !keepSet.has(l.book_id))
  if (toLink.length > 0) {
    const payload = toLink.map(l => ({ book_id: l.book_id, author_id: intoId, role: l.role ?? 'author' }))
    const { error } = await sb.from('book_authors').insert(payload)
    if (error) throw new Error(`insert links into ${intoId}: ${error.message}`)
  }
  const { error: de } = await sb.from('book_authors').delete().eq('author_id', fromId)
  if (de) throw new Error(`delete links for ${fromId}: ${de.message}`)
  const { error: ae } = await sb.from('authors').delete().eq('id', fromId)
  if (ae) throw new Error(`delete author ${fromId}: ${ae.message}`)
  return toLink.length
}

async function main() {
  const sb = adminClient()
  console.log(`── merge-bio-anchored-variants ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // 1. Scan all authors
  const PAGE = 1000
  let offset = 0
  type Row = { id: number; display_name: string; bio: string | null }
  const all: Row[] = []
  while (true) {
    const { data, error } = await sb.from('authors').select('id, display_name, bio').order('id').range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as Row[]))
    if (data.length < PAGE) break
    offset += PAGE
  }

  // 2. Build anchors + candidates with tokens
  type Scored = { row: Row; tokens: Set<string> }
  const anchors: Scored[] = []
  const candidates: Scored[] = []
  for (const r of all) {
    const tokens = tokensFor(r.display_name)
    if (r.bio) {
      anchors.push({ row: r, tokens })
    } else {
      candidates.push({ row: r, tokens })
    }
  }
  console.log(`Anchors (with bio): ${anchors.length}`)
  console.log(`Candidates (no bio): ${candidates.length}\n`)

  // 3. For each candidate, find compatible anchors
  type Match = { candidate: Row; anchor: Row; reason: string }
  const matches: Match[] = []
  const ambiguous: { candidate: Row; anchors: Row[] }[] = []

  for (const cand of candidates) {
    if (COAUTHOR_SMUSH.test(cand.row.display_name)) continue
    if (cand.tokens.size === 0) continue

    // Guard 1: candidate must carry at least 2 canonical tokens. Single-
    // token candidates ("Hong", "Magnus", "Émile", "Sam") are too generic
    // to attribute confidently — many real people share one surname.
    if (cand.tokens.size < 2) continue

    const compatibleAnchors: { anchor: Scored; reason: string }[] = []
    for (const anch of anchors) {
      // Guard 2: anchor must be distinctive (long token or 3+ tokens).
      if (!isDistinctiveAnchor(anch.tokens)) continue
      // Guard 3: first-word compatibility — protects against bio-mismatch
      // leaking onto unrelated records that just share trailing tokens.
      if (!firstWordsCompatible(anch.row.display_name, cand.row.display_name)) continue
      // Direction A: candidate ⊆ anchor (candidate is short form of anchor)
      if (subsetOrEqual(cand.tokens, anch.tokens)) {
        compatibleAnchors.push({ anchor: anch, reason: cand.tokens.size === anch.tokens.size ? 'equal' : 'cand⊆anchor' })
        continue
      }
      // Direction B: anchor ⊆ candidate AND candidate has ≤ 1 extra. Allowing
      // ≥ 2 extras lets co-author smushes ("Melanie Tem Nancy Holder" ←
      // "Nancy Holder") merge incorrectly — a single clan/nisbah suffix like
      // "At-Tamimi" is the realistic upper bound.
      if (subsetOrEqual(anch.tokens, cand.tokens)) {
        const extras = cand.tokens.size - anch.tokens.size
        if (extras === 1) {
          compatibleAnchors.push({ anchor: anch, reason: `anchor⊆cand (+1)` })
        }
      }
    }

    if (compatibleAnchors.length === 0) continue
    if (compatibleAnchors.length > 1) {
      ambiguous.push({ candidate: cand.row, anchors: compatibleAnchors.map(x => x.anchor.row) })
      continue
    }
    matches.push({
      candidate: cand.row,
      anchor: compatibleAnchors[0].anchor.row,
      reason: compatibleAnchors[0].reason,
    })
  }

  // 4. Report
  // Group by anchor for readability
  const byAnchor = new Map<number, { anchor: Row; merges: { cand: Row; reason: string }[] }>()
  for (const m of matches) {
    const g = byAnchor.get(m.anchor.id) ?? { anchor: m.anchor, merges: [] }
    g.merges.push({ cand: m.candidate, reason: m.reason })
    byAnchor.set(m.anchor.id, g)
  }

  console.log(`Anchored merges: ${matches.length} candidate(s) across ${byAnchor.size} anchor(s)\n`)
  for (const g of byAnchor.values()) {
    console.log(`  ANCHOR id=${g.anchor.id} | ${g.anchor.display_name}`)
    for (const m of g.merges) {
      console.log(`    MERGE id=${m.cand.id} | ${m.cand.display_name}  [${m.reason}]`)
    }
  }

  if (ambiguous.length > 0) {
    console.log(`\nAmbiguous (multiple anchor matches — skipped): ${ambiguous.length}`)
    for (const a of ambiguous.slice(0, 20)) {
      console.log(`  id=${a.candidate.id} | ${a.candidate.display_name}`)
      for (const an of a.anchors) {
        console.log(`    ↔ anchor id=${an.id} | ${an.display_name}`)
      }
    }
    if (ambiguous.length > 20) console.log(`  ... and ${ambiguous.length - 20} more`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──`)
    return
  }

  // 5. Apply
  let merged = 0, movedLinks = 0, errors = 0
  for (const m of matches) {
    try {
      const moved = await moveLinksAndDelete(sb, m.candidate.id, m.anchor.id)
      merged++
      movedLinks += moved
      console.log(`  ✓ merged ${m.candidate.id} → ${m.anchor.id} (moved ${moved} link(s))`)
    } catch (err) {
      errors++
      console.error(`  ! ${m.candidate.id} → ${m.anchor.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  console.log(`\n  merged: ${merged}, links moved: ${movedLinks}, errors: ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
