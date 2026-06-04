// source-orphan-cluster-bans.ts — attach authoritative source citations to the
// two CLEAN clusters of early seed bans that were imported before the
// source-link discipline was enforced and ended up with zero ban_source_links.
//
// Two clusters, each backed by ONE verified, authoritative catalogue source
// (many bans → one shared ban_sources row via ban_source_links):
//
//   country_code = 'VA' (11 bans)  → Index Librorum Prohibitorum
//       These works/authors are documented entries on the Catholic Church's
//       list of prohibited books. Verified against the Wikipedia "List of
//       authors and works on the Index Librorum Prohibitorum".
//
//   country_code = 'IL' (23 bans)  → B'Tselem, "Banned Books and Authors"
//       (Information Sheet, October 1989) — the Israeli military-censorship
//       list of ~1,600 Arabic/Palestinian titles in the occupied territories.
//       Verified: all sampled titles (The Non-Jewish Jew, Gush Emunim, Darwish
//       Selected Poems, Kanafani's The Lover, Cancer Ward, August 1914, Hamlet,
//       The Story of Mankind, Tolstoy, Constitutional Law) appear in the sheet.
//
// The heterogeneous "canonical" orphans (famous titles banned in scattered
// jurisdictions) are NOT touched here — they need per-record sourcing and a
// few look like questionable seed data. See data/orphan-bans-canonical.md.
//
// Idempotent: re-running creates no duplicate sources or links.
//
// Run (dry):  pnpm tsx --env-file=.env.local scripts/source-orphan-cluster-bans.ts
// Run (write): pnpm tsx --env-file=.env.local scripts/source-orphan-cluster-bans.ts --apply

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const sb = adminClient()

type Cluster = {
  countryCode: string
  source: { source_name: string; source_url: string; source_type: string; accessed_at: string }
}

const CLUSTERS: Cluster[] = [
  {
    countryCode: 'VA',
    source: {
      source_name: 'Index Librorum Prohibitorum (Sacred Congregation of the Index)',
      source_url: 'https://en.wikipedia.org/wiki/List_of_authors_and_works_on_the_Index_Librorum_Prohibitorum',
      source_type: 'wikipedia',
      accessed_at: '2026-06-04',
    },
  },
  {
    countryCode: 'IL',
    source: {
      source_name: "B'Tselem — Banned Books and Authors (Information Sheet, October 1989)",
      source_url: 'https://www.btselem.org/download/198910_banned_books_and_authors_eng.doc',
      source_type: 'human_rights_report',
      accessed_at: '2026-06-04',
    },
  },
]

async function allBanIdsWithSource(): Promise<Set<number>> {
  const withSrc = new Set<number>()
  let from = 0
  const PAGE = 1000
  for (;;) {
    const { data, error } = await sb
      .from('ban_source_links')
      .select('ban_id')
      .order('ban_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    for (const r of data as { ban_id: number }[]) withSrc.add(r.ban_id)
    if (data.length < PAGE) break
    from += PAGE
  }
  return withSrc
}

async function findOrCreateSource(s: Cluster['source']): Promise<number> {
  const { data: existing, error: selErr } = await sb
    .from('ban_sources')
    .select('id')
    .eq('source_url', s.source_url)
    .limit(1)
  if (selErr) throw selErr
  if (existing?.length) return existing[0].id

  if (!APPLY) {
    console.log(`  [dry] would CREATE ban_sources row: ${s.source_name}`)
    return -1
  }
  const { data, error } = await sb.from('ban_sources').insert(s).select('id').single()
  if (error) throw error
  console.log(`  created ban_sources #${data.id}: ${s.source_name}`)
  return data.id
}

async function run() {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN (pass --apply to write) ===')
  const withSrc = await allBanIdsWithSource()

  for (const cluster of CLUSTERS) {
    // orphan bans in this country
    const { data: bans, error } = await sb
      .from('bans')
      .select('id')
      .eq('country_code', cluster.countryCode)
    if (error) throw error
    const orphans = (bans ?? []).filter((b) => !withSrc.has(b.id)).map((b) => b.id)

    console.log(`\n${cluster.countryCode}: ${orphans.length} source-less bans → ${cluster.source.source_name}`)
    if (orphans.length === 0) continue

    const sourceId = await findOrCreateSource(cluster.source)
    if (sourceId === -1) {
      console.log(`  [dry] would LINK ${orphans.length} bans → (new source)`)
      continue
    }

    const links = orphans.map((ban_id) => ({ ban_id, source_id: sourceId }))
    if (APPLY) {
      // ignore-duplicates upsert keeps it idempotent on the (ban_id, source_id) PK
      const { error: linkErr } = await sb
        .from('ban_source_links')
        .upsert(links, { onConflict: 'ban_id,source_id', ignoreDuplicates: true })
      if (linkErr) throw linkErr
      console.log(`  linked ${links.length} bans → ban_sources #${sourceId}`)
    } else {
      console.log(`  [dry] would LINK ${links.length} bans → ban_sources #${sourceId}`)
    }
  }
  console.log('\nDone.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
