/**
 * Merge author rows that share an IDENTICAL bio AND are name-variants of
 * each other (subset, superset, or rearrangement of the same token set).
 * Catches cases the credential-suffix merge missed:
 *
 *   - Name-order swaps:        "Liao Yiwu"   ↔ "Yiwu Liao"
 *   - Punctuation variants:    "E.L. James"  ↔ "E L James"
 *   - Initial vs full name:    "F. Engels"   ↔ "Friedrich Engels"
 *   - Middle-initial presence: "Robie Harris" ↔ "Robie H. Harris"
 *   - Pen-name + alt spelling: "V. E. Schwab" ↔ "Victoria Schwab"
 *
 * Safety guard — refuses to merge when token sets are neither equal nor
 * subset-related, which keeps siblings (Tegan Quin / Sara Quin) and
 * unrelated authors with shared first names (Suzanne Collins / Suzanne
 * Young) apart even though they share a Wikipedia article via the
 * bio-script's mis-match.
 *
 * The keeper in each group is the row with the most tokens after
 * canonicalisation (longest "complete" name); ties broken by lowest id.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/merge-name-variant-authors.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/merge-name-variant-authors.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { canonicaliseAuthorName } from '../src/lib/imports/canonicalise-author-name'

const APPLY = process.argv.includes('--apply')

// Tokens excluded from the canonical set: name-connector particles and
// honorifics/credentials that survive canonicaliseAuthorName (which only
// strips trailing forms). Deliberately omits 2-3-letter strings that are
// real surnames in the dataset — "tan" (Amy Tan), "ma" (Yo-Yo Ma), "ba",
// "puan" — to avoid false-positive merges (incident 2026-05-27).
const PARTICLES = new Set([
  // Name-connector particles
  'bin', 'binti', 'bt', 'bte', 'ibn', 'bint',
  'al', 'el', 'de', 'da', 'di', 'du',
  'van', 'von', 'der', 'den', 'des',
  'of', 'the', 'and', 'et',
  // Honorifics / titles (unambiguous start-of-name words)
  'dr', 'mr', 'mrs', 'ms', 'prof', 'professor',
  'sheikh', 'imam', 'abuya', 'hj', 'haji', 'hajjah',
  'ust', 'ustaz', 'ustadz',
  'sir', 'dame', 'lord', 'lady',
  'dato', 'datin',
  // Academic suffixes that survived (e.g. spaced "Ph. D.", "M.Sc")
  'ph', 'phd', 'sc', 'msc', 'bsc',
  'jr', 'sr', 'esq', 'jp', 'dphil',
])

// Multi-author credit strings — "X & Y", "X, Y", "X and Y" with proper
// nouns on both sides. Refuse to merge such rows because they're not
// name-variants but distinct attributions (a separate split step would
// peel them into individual authors).
const COAUTHOR_SMUSH = / &\s+[A-Z]| and \s*[A-Z][a-z]+\s+[A-Z]|,\s+[A-Z][a-z]+\s+[A-Z]/

function tokensFor(displayName: string): string[] {
  return canonicaliseAuthorName(displayName)
    .toLowerCase()
    .split(/[\s.,&()'’"\-/]+/)
    .filter(t => t.length >= 2)           // drop 1-letter initials
    .filter(t => !PARTICLES.has(t))
    .filter(t => !/^\d+$/.test(t))         // drop all-numeric tokens (years, e.g. "B.T. Ranadive 1948")
}

function isSubsetOrEqual(small: Set<string>, big: Set<string>): boolean {
  if (small.size === 0) return false
  for (const t of small) if (!big.has(t)) return false
  return true
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
  console.log(`── merge-name-variant-authors ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // 1. Scan all authors with a bio
  const PAGE = 1000
  let offset = 0
  type Row = { id: number; display_name: string; bio: string | null }
  const rows: Row[] = []
  while (true) {
    const { data, error } = await sb.from('authors').select('id, display_name, bio').not('bio', 'is', null).order('id').range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as Row[]))
    if (data.length < PAGE) break
    offset += PAGE
  }

  // 2. Group by identical bio prefix
  const byBio = new Map<string, Row[]>()
  for (const r of rows) {
    if (!r.bio) continue
    const key = r.bio.slice(0, 200)
    const arr = byBio.get(key) ?? []
    arr.push(r)
    byBio.set(key, arr)
  }
  const groups = [...byBio.values()].filter(v => v.length > 1)
  console.log(`Identical-bio groups: ${groups.length}\n`)

  // 3. Within each group, partition members by name-variant relation
  //    (subset, superset, equal). Each partition (component) merges into
  //    the member with the most tokens (ties → lowest id).
  type Plan = { keep: Row; drops: Row[] }
  const plans: Plan[] = []

  // Placeholder authors we refuse to merge (each "Unknown" / "Anonymous"
  // row attributes a distinct anonymous work — collapsing them would
  // falsely conflate the underlying books).
  const PLACEHOLDER_NAMES = new Set(['unknown', 'anonymous'])
  for (const members of groups) {
    const scored = members
      .filter(m => !COAUTHOR_SMUSH.test(m.display_name))
      .filter(m => !PLACEHOLDER_NAMES.has(m.display_name.toLowerCase().trim()))
      .map(m => ({ row: m, tokens: new Set(tokensFor(m.display_name)) }))
    // Build undirected variant-graph: edge between i and j if one's token
    // set is subset/equal of the other (and non-empty).
    const n = scored.length
    const parent = Array.from({ length: n }, (_, i) => i)
    const find = (x: number): number => parent[x] === x ? x : (parent[x] = find(parent[x]))
    const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = scored[i].tokens, b = scored[j].tokens
        if (isSubsetOrEqual(a, b) || isSubsetOrEqual(b, a)) union(i, j)
      }
    }
    // Components → merge plans.
    const components = new Map<number, number[]>()
    for (let i = 0; i < n; i++) {
      const root = find(i)
      const arr = components.get(root) ?? []
      arr.push(i)
      components.set(root, arr)
    }
    for (const idxs of components.values()) {
      if (idxs.length < 2) continue
      // Keeper preference:
      //   1. Most canonical-tokens (so "Friedrich Engels" beats bare "Engels")
      //   2. SHORTER display_name when token sets are equal (so plain
      //      "Anis Shorrosh" beats "Dr. Anis A. Shorrosh", and
      //      "Stephanie Tolan" beats "Stephanie S. Tolan")
      //   3. Lowest id (stable tiebreaker)
      idxs.sort((a, b) => {
        const sa = scored[a].tokens.size, sb = scored[b].tokens.size
        if (sa !== sb) return sb - sa
        const la = scored[a].row.display_name.length, lb = scored[b].row.display_name.length
        if (la !== lb) return la - lb
        return scored[a].row.id - scored[b].row.id
      })
      const keep = scored[idxs[0]].row
      const drops = idxs.slice(1).map(i => scored[i].row)
      plans.push({ keep, drops })
    }
  }

  console.log(`Merge plans: ${plans.length} group(s), ${plans.reduce((s, p) => s + p.drops.length, 0)} drop(s)\n`)

  for (const p of plans) {
    console.log(`  KEEP   id=${p.keep.id} | ${p.keep.display_name}`)
    for (const d of p.drops) {
      console.log(`    MERGE id=${d.id} | ${d.display_name}`)
    }
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──`)
    return
  }

  let merged = 0, movedLinks = 0, errors = 0
  for (const p of plans) {
    for (const drop of p.drops) {
      try {
        const moved = await moveLinksAndDelete(sb, drop.id, p.keep.id)
        merged++
        movedLinks += moved
        console.log(`  ✓ merged ${drop.id} → ${p.keep.id} (moved ${moved} link(s))`)
      } catch (err) {
        errors++
        console.error(`  ! ${drop.id} → ${p.keep.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }
  console.log(`\n  merged: ${merged}, links moved: ${movedLinks}, errors: ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
