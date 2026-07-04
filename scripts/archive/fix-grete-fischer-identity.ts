#!/usr/bin/env tsx
/**
 * fix-grete-fischer-identity.ts — one-off identity correction for author #16348.
 *
 * Follow-up to fix-impossible-years-2026-07-01.ts (commit 23149a3), which cleared
 * the contaminated American-namesake year/bio but deliberately left the record's
 * display_name/slug as the pseudonym "Joseph Amiel".
 *
 * The real author of the banned 1934 book "Palästina, das erlaubte Land" (#22114)
 * is Grete Fischer (born Margarete Fischer; 6 Feb 1893 Prague – 28 Mar 1977
 * London), who published it under the pseudonym Joseph Amiel. Verified against:
 *   - https://www.fembio.org/biographie.php/frau/biographie/grete-fischer/
 *   - https://de.wikipedia.org/wiki/Grete_Fischer_(Autorin)
 *
 * This promotes the record to her real identity and 301-preserves the old
 * pseudonym URL via an author_slug_alias. Setting birth_year=1893 also re-arms
 * the namesake gate on the enrichment scripts so a future run matches the right
 * Grete Fischer (there are several) instead of re-contaminating the row.
 *
 * Guarded: only writes if the row still holds the exact post-fix state recorded
 * here (display_name 'Joseph Amiel', slug 'joseph-amiel', birth/death/bio NULL).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/fix-grete-fischer-identity.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-grete-fischer-identity.ts --apply  # write
 */
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const WRITE = isApply()
const sb = adminClient()

const AUTHOR_ID = 16348
const OLD_SLUG = 'joseph-amiel'
const NEW_SLUG = 'grete-fischer'

const SET = {
  display_name: 'Grete Fischer',
  slug: NEW_SLUG,
  birth_year: 1893,
  death_year: 1977,
  bio:
    'Grete Fischer (born Margarete Fischer; 6 February 1893 in Prague – ' +
    '28 March 1977 in London) was a German-language author who later lived in ' +
    'Britain. She wrote the 1934 book “Palästina, das erlaubte Land” under the ' +
    'pseudonym Joseph Amiel.',
}

async function main() {
  console.log(`fix-grete-fischer-identity — mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}\n`)

  const { data: cur, error } = await sb
    .from('authors')
    .select('id, slug, display_name, birth_year, death_year, bio')
    .eq('id', AUTHOR_ID)
    .maybeSingle()
  if (error) { console.error(error.message); process.exit(1) }
  if (!cur) { console.error(`author #${AUTHOR_ID} not found`); process.exit(1) }

  // Guard: exact post-fix state expected.
  const expected =
    cur.slug === OLD_SLUG &&
    cur.display_name === 'Joseph Amiel' &&
    cur.birth_year === null &&
    cur.death_year === null &&
    cur.bio === null
  console.log(`before: slug=${cur.slug} name="${cur.display_name}" birth=${cur.birth_year} death=${cur.death_year} bio=${cur.bio ? 'set' : 'NULL'}`)
  if (!expected) {
    console.log('\nSKIP: row is not in the recorded post-fix state — aborting to avoid clobbering a later edit.')
    return
  }

  // Slug collision check.
  const { data: coll } = await sb.from('authors').select('id').eq('slug', NEW_SLUG).maybeSingle()
  if (coll && coll.id !== AUTHOR_ID) {
    console.log(`\nSKIP: slug '${NEW_SLUG}' already taken by author #${coll.id}.`)
    return
  }

  console.log(`after : slug=${SET.slug} name="${SET.display_name}" birth=${SET.birth_year} death=${SET.death_year} bio=set`)
  console.log(`alias : ${OLD_SLUG} → author #${AUTHOR_ID} (source='legacy_slug')`)

  if (!WRITE) { console.log('\nDry-run — re-run with --apply to write.'); return }

  const { error: updErr } = await sb.from('authors').update(SET).eq('id', AUTHOR_ID)
  if (updErr) { console.error(`update failed: ${updErr.message}`); process.exit(1) }

  const { error: aliasErr } = await sb
    .from('author_slug_aliases')
    .upsert({ slug: OLD_SLUG, author_id: AUTHOR_ID, source: 'legacy_slug' }, { onConflict: 'slug' })
  if (aliasErr) { console.error(`alias insert failed: ${aliasErr.message}`); process.exit(1) }

  console.log('\nwritten: author renamed + legacy-slug alias added.')
}

main().then(() => process.exit(0))
