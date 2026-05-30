/**
 * Merge 4 Iran duplicate books created by an earlier Wikipedia bulk-parse
 * import. Each pair has:
 *   - obsolete book row with transliterated Persian as title (no metadata)
 *   - canonical book row with proper English title (already enriched)
 *
 * For each pair:
 *   1. Re-attach the obsolete book's IR-1979 ban to the canonical book
 *      (preserves the Wikipedia source attribution + reason links).
 *   2. Delete the obsolete book_authors row.
 *   3. Delete the obsolete book row.
 *
 * Result: canonical book gains an extra IR-1979 ban (general post-revolution
 * historical attribution) alongside its more specific year ban.
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

// (obsolete_book_id, canonical_book_id, notes)
const MERGES: Array<{ obsolete: number; canonical: number; note: string }> = [
  { obsolete: 7444, canonical: 11,  note: 'ramz-e dāvinchi → The Da Vinci Code' },
  { obsolete: 7454, canonical: 592, note: 'zanān bedun-e mardān → Women Without Men' },
  { obsolete: 7457, canonical: 6,   note: 'āyāt-e sheytāni → The Satanic Verses' },
  { obsolete: 7463, canonical: 733, note: "tubā va ma'nā-ye shab → Touba and the Meaning of Night" },
]

const s = adminClient()

async function main() {
  console.log(`\n── merge-iran-duplicates ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  for (const m of MERGES) {
    console.log(`\n── ${m.note} (book_${m.obsolete} → book_${m.canonical}) ──`)
    const { data: bansOnObsolete } = await s.from('bans').select('id, country_code, year_started, status').eq('book_id', m.obsolete)
    const { data: bansOnCanonical } = await s.from('bans').select('id, country_code, year_started, status').eq('book_id', m.canonical)
    console.log(`  obsolete book has ${bansOnObsolete?.length ?? 0} ban(s)`)
    for (const b of (bansOnObsolete ?? []) as Array<{ id: number; country_code: string; year_started: number; status: string }>) {
      console.log(`    ban_${b.id}  ${b.country_code} ${b.year_started} ${b.status}`)
    }
    console.log(`  canonical book has ${bansOnCanonical?.length ?? 0} ban(s)`)
    for (const b of (bansOnCanonical ?? []) as Array<{ id: number; country_code: string; year_started: number; status: string }>) {
      console.log(`    ban_${b.id}  ${b.country_code} ${b.year_started} ${b.status}`)
    }

    // Pre-check: any ban on obsolete that would collide with canonical on
    // (country_code, year_started, region=NULL, institution=NULL, scope_id)?
    // If so, the UPDATE will fail the unique constraint. Skip + warn.
    const canonicalKeys = new Set<string>()
    for (const b of (bansOnCanonical ?? []) as Array<{ country_code: string; year_started: number }>) {
      canonicalKeys.add(`${b.country_code}|${b.year_started}`)
    }
    const collidingBans: number[] = []
    for (const b of (bansOnObsolete ?? []) as Array<{ id: number; country_code: string; year_started: number }>) {
      if (canonicalKeys.has(`${b.country_code}|${b.year_started}`)) {
        collidingBans.push(b.id)
      }
    }
    if (collidingBans.length > 0) {
      console.log(`  ⚠ ${collidingBans.length} ban(s) would collide with canonical on (country, year); will DELETE obsolete bans instead of reassigning: ${collidingBans.join(', ')}`)
    }

    if (!APPLY) continue

    // Re-attach non-colliding bans to canonical
    const toReassign = ((bansOnObsolete ?? []) as Array<{ id: number }>)
      .filter(b => !collidingBans.includes(b.id))
      .map(b => b.id)

    for (const banId of toReassign) {
      const { error } = await s.from('bans').update({ book_id: m.canonical }).eq('id', banId)
      if (error) {
        console.error(`  ! reassign ban_${banId}: ${error.message}`)
      } else {
        console.log(`  ✓ reassigned ban_${banId} → book_${m.canonical}`)
      }
    }

    // Delete colliding bans (their source_links / reason_links cascade via FK)
    for (const banId of collidingBans) {
      // First delete dependent rows
      await s.from('ban_source_links').delete().eq('ban_id', banId)
      await s.from('ban_reason_links').delete().eq('ban_id', banId)
      const { error } = await s.from('bans').delete().eq('id', banId)
      if (error) {
        console.error(`  ! delete ban_${banId}: ${error.message}`)
      } else {
        console.log(`  ✓ deleted colliding ban_${banId}`)
      }
    }

    // Delete book_authors for obsolete
    const { error: baErr } = await s.from('book_authors').delete().eq('book_id', m.obsolete)
    if (baErr) console.error(`  ! delete book_authors: ${baErr.message}`)
    else console.log(`  ✓ deleted book_authors for book_${m.obsolete}`)

    // Delete obsolete book
    const { error: bErr } = await s.from('books').delete().eq('id', m.obsolete)
    if (bErr) console.error(`  ! delete book_${m.obsolete}: ${bErr.message}`)
    else console.log(`  ✓ deleted book_${m.obsolete}`)
  }

  console.log(`\n── Done ──\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
