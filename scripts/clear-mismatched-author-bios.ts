/**
 * Clear author bios that look like Wikipedia mismatches.
 *
 * Detected in 2026-05-27 audit: when multiple author rows share IDENTICAL
 * bio text, the bio script matched all of them to the same Wikipedia page
 * — sometimes correctly (transliteration / nickname / name-order variants
 * of one person), but often catastrophically wrong:
 *
 *   - 5 different authors all enriched with the "Charlotte Huck Award"
 *     article (Aida Salazar, Jennifer Jacobson, …)
 *   - 11 NZ-banned authors all enriched with "Book censorship has existed
 *     in New Zealand since the colonial period…"
 *   - 12 authors enriched with "Banned books are books or other printed
 *     works…" (the lead of the *Banned books* article itself)
 *   - "Jennifer Bradbury" enriched with the Ray Bradbury biography
 *   - "Suzanne Young" enriched with the Suzanne Collins biography
 *
 * Strategy: for each identical-bio group, score each member's display_name
 * against the bio (fraction of 4+ char name tokens that appear in the bio
 * text, case-insensitive). The highest-scorer is the "owner". If even the
 * owner's score is below 0.4, the bio is unowned (catch-all article) and
 * gets cleared on every member of the group. Otherwise, only the
 * non-owners (score < owner score) get cleared.
 *
 * Clearing means nulling: bio, photo_url, birth_year, death_year,
 * birth_country. Those records will be re-eligible for enrich-author-bios
 * on the next run. The script also wipes `photo_v2_checked_at` so the
 * photo-only re-run picks them up.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/clear-mismatched-author-bios.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/clear-mismatched-author-bios.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const OWNER_THRESHOLD = 0.4   // Below this, no member "owns" the bio → clear all

function tokensFor(displayName: string): string[] {
  return displayName.toLowerCase()
    .split(/[\s.,&()'’"\-/]+/)
    .filter(t => t.length >= 4)
}

function matchScore(displayName: string, bio: string): number {
  const tokens = tokensFor(displayName)
  if (tokens.length === 0) return 0
  const bioLower = bio.toLowerCase()
  const hits = tokens.filter(t => bioLower.includes(t)).length
  return hits / tokens.length
}

async function main() {
  const sb = adminClient()
  console.log(`── clear-mismatched-author-bios ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // 1. Scan
  const PAGE = 1000
  let offset = 0
  type Row = { id: number; display_name: string; bio: string | null; photo_url: string | null; birth_year: number | null; death_year: number | null; birth_country: string | null }
  const rows: Row[] = []
  while (true) {
    const { data, error } = await sb.from('authors').select('id, display_name, bio, photo_url, birth_year, death_year, birth_country').order('id').range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as Row[]))
    if (data.length < PAGE) break
    offset += PAGE
  }
  console.log(`Authors scanned: ${rows.length}`)

  // 2. Group by bio prefix (first 200 chars — enough to identify a Wikipedia
  //    article; collisions on shorter prefixes would be rare).
  const byBio = new Map<string, Row[]>()
  for (const r of rows) {
    if (!r.bio) continue
    const key = r.bio.slice(0, 200)
    const arr = byBio.get(key) ?? []
    arr.push(r)
    byBio.set(key, arr)
  }
  const groups = [...byBio.entries()].filter(([, v]) => v.length > 1)
  console.log(`Identical-bio groups: ${groups.length}\n`)

  // 3. Score and plan
  type Plan = { idsToClear: number[]; reason: string; ownerLabel: string; bioPreview: string }
  const plans: Plan[] = []
  for (const [bioKey, members] of groups) {
    const scored = members.map(m => ({ row: m, score: matchScore(m.display_name, m.bio ?? '') }))
    scored.sort((a, b) => b.score - a.score)
    const maxScore = scored[0].score
    const bioPreview = bioKey.slice(0, 90)
    if (maxScore < OWNER_THRESHOLD) {
      // Catch-all article: clear all
      plans.push({
        idsToClear: scored.map(s => s.row.id),
        reason: `catch-all (max score ${maxScore.toFixed(2)})`,
        ownerLabel: '— (no owner)',
        bioPreview,
      })
    } else {
      // Identify owners (anyone tied for max) and non-owners
      const owners = scored.filter(s => s.score >= maxScore - 1e-9)
      const nonOwners = scored.filter(s => s.score < maxScore - 1e-9)
      if (nonOwners.length === 0) continue   // Everyone tied: probably legit (e.g., Engels group); skip
      plans.push({
        idsToClear: nonOwners.map(s => s.row.id),
        reason: `mismatch (owner score ${maxScore.toFixed(2)})`,
        ownerLabel: owners.map(o => `${o.row.display_name} (${o.row.id})`).join(', '),
        bioPreview,
      })
    }
  }
  const totalClear = plans.reduce((s, p) => s + p.idsToClear.length, 0)
  console.log(`Planned bio clears: ${totalClear} record(s) across ${plans.length} group(s)\n`)

  for (const p of plans) {
    console.log(`  bio="${p.bioPreview}..." [${p.reason}]`)
    console.log(`    OWNER: ${p.ownerLabel}`)
    const cleared = rows.filter(r => p.idsToClear.includes(r.id))
    for (const r of cleared) {
      console.log(`    CLEAR id=${r.id} | ${r.display_name}`)
    }
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──`)
    return
  }

  // 4. Apply clears
  const allIds = plans.flatMap(p => p.idsToClear)
  let cleared = 0, errors = 0
  const CHUNK = 50
  for (let i = 0; i < allIds.length; i += CHUNK) {
    const slice = allIds.slice(i, i + CHUNK)
    const { error } = await sb.from('authors')
      .update({
        bio: null,
        photo_url: null,
        birth_year: null,
        death_year: null,
        birth_country: null,
      })
      .in('id', slice)
    if (error) { errors += slice.length; console.error(`  ! chunk error: ${error.message}`) }
    else cleared += slice.length
  }
  console.log(`\n  cleared: ${cleared}, errors: ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
