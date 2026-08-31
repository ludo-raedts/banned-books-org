// apply-bbw-2026-selection.ts — replace the Banned Books Week 2026 featured set.
//
// WHY THIS EXISTS
// The 2026 set was staged on 2026-05-08, before the bulk of the current ban data
// landed (PEN 2024-25 per-district, Utah statewide, FSEM). It shows: the ten
// published picks carry 2-5 bans each, while the titles on the ALA's 2025
// most-challenged list — which is the list in circulation during BBW 2026 — carry
// 30-149 bans each and were never considered. The old set also failed the
// suggester's own diversity rule (RULE_MIN_NON_US = 4; it had 3), and leaned on
// seven US-only long-tail YA removals from a handful of Florida/Tennessee
// districts, which reads oddly next to the hub's own argument that the
// international dimension is what a US-only frame misses.
//
// THE SET BELOW
// Five current US challenges (the ALA 2025 list) and five state-level bans, so
// the section carries the same both-halves argument the hub makes in prose. Every
// blurb states facts drawn from our own `bans` rows — counts, countries, years,
// institutions — and each was checked against the DB on 2026-08-31. ALA ranks are
// from ala.org's 2025 list (published April 2026).
//
// Diversity rules (src/lib/bbw-suggester.ts) against this set:
//   RULE_MIN_NON_US    = 4  -> 7 books carry >=1 non-US ban   PASS
//   RULE_MIN_REASONS   = 3  -> political, religious, sexual, moral, violence,
//                              language, obscenity, lgbtq                PASS
//   RULE_MAX_PER_AUTHOR= 2  -> 10 distinct authors                       PASS
//
// This script publishes directly (published_at = now) rather than staging a
// draft: the admin `save_draft` action nulls published_at for the whole year,
// which would empty the public "Featured books" section until someone hit
// publish. Order is upsert-then-delete so the section is never empty.
//
// Usage:  npx tsx --env-file=.env.local scripts/apply-bbw-2026-selection.ts [--apply]

import { isApply } from './lib/cli'

const YEAR = 2026

type Pick = { slug: string; blurb: string }

// Positions are the array order, 1-based.
const PICKS: Pick[] = [
  // ── Currently challenged in the US (ALA 2025 most-challenged list) ─────────
  {
    slug: 'sold-patricia-mccormick',
    blurb:
      "Number one on the ALA's 2025 most-challenged list. Our records show 138 removals across 19 states since 2012 — a novel about a Nepali girl sold into sex trafficking, most often challenged for depicting what it condemns.",
  },
  {
    slug: 'the-perks-of-being-a-wallflower',
    blurb:
      "Second on the ALA's 2025 list, and one of the few titles our data catches on both sides of the map: 139 district removals across 24 US states, plus a national ban in Belarus in 2025.",
  },
  {
    slug: 'gender-queer',
    blurb:
      "Third on the ALA's 2025 list. We record 94 removals across 26 states — the Department of Defense school system among them — and a restriction in Peru in 2025.",
  },
  {
    slug: 'last-night-at-the-telegraph-club',
    blurb:
      "Joint fifth on the ALA's 2025 list: 68 removals across 12 states since 2022, for a historical novel about a Chinese American teenager in 1950s San Francisco.",
  },
  {
    slug: 'looking-for-alaska',
    blurb:
      "Joint eighth on the ALA's 2025 list, and the most-removed title on that list in our data: 149 district bans across 22 states, running from 2012 to this year.",
  },

  // ── Banned by states, not school boards ───────────────────────────────────
  {
    slug: 'the-satanic-verses',
    blurb:
      'Banned in 22 countries within roughly a year of publication — 17 of them in 1988 alone. The clearest case in the archive of a book banned by governments rather than school boards.',
  },
  {
    slug: '1984',
    blurb:
      "Banned across the Soviet bloc from 1949, in Cuba from 1959, by Argentina's junta in 1976 and in China from 1985 — and, seventy years on, removed from school districts in four US states. Censored from both directions.",
  },
  {
    slug: 'heartstopper',
    blurb:
      'The whole map in one title: national bans in Russia and Belarus in 2025, restrictions in Hungary and Turkey, a school removal in Salford, and four US district bans. Six countries in five years.',
  },
  {
    slug: 'lady-chatterleys-lover',
    blurb:
      'Banned in 13 countries from 1928 onward, with the bans upheld by the supreme courts of Japan, Canada and India. The obscenity fight that defined the century before this one.',
  },
  {
    slug: 'the-ukrainian-night',
    blurb:
      "Banned in Russia in 2022: Marci Shore's account of the Maidan revolution, removed by the state whose invasion it helps explain.",
  },
]

async function main() {
  const APPLY = isApply()
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  // ── Resolve slugs -> ids, refuse on any miss ──────────────────────────────
  const slugs = PICKS.map(p => p.slug)
  const { data: books, error: bErr } = await sb
    .from('books')
    .select('id, slug, title, cover_url, is_blanket_works')
    .in('slug', slugs)
  if (bErr) throw new Error(bErr.message)
  const bySlug = new Map(((books ?? []) as any[]).map(b => [b.slug, b]))
  const missing = slugs.filter(s => !bySlug.has(s))
  if (missing.length > 0) throw new Error(`unknown slug(s): ${missing.join(', ')}`)

  const noCover = (books ?? []).filter((b: any) => !b.cover_url)
  if (noCover.length > 0) {
    throw new Error(`featured books must have a cover: ${noCover.map((b: any) => b.slug).join(', ')}`)
  }
  const blanket = (books ?? []).filter((b: any) => b.is_blanket_works)
  if (blanket.length > 0) {
    throw new Error(`blanket-works rows are not real titles: ${blanket.map((b: any) => b.slug).join(', ')}`)
  }

  // ── BEFORE ────────────────────────────────────────────────────────────────
  const { data: before } = await sb
    .from('bbw_featured_selections')
    .select('book_id, position, published_at, custom_blurb, books(title)')
    .eq('year', YEAR)
    .order('position')
  console.log(`════ BEFORE — ${(before ?? []).length} rows for ${YEAR} ════`)
  for (const r of (before ?? []) as any[]) {
    console.log(`  #${String(r.position).padStart(2)} ${r.published_at ? 'PUB  ' : 'draft'} ${r.books?.title ?? r.book_id}${r.custom_blurb ? ' [blurb]' : ''}`)
  }

  const newRows = PICKS.map((p, i) => ({
    year: YEAR,
    book_id: bySlug.get(p.slug).id as number,
    position: i + 1,
    custom_blurb: p.blurb,
    pinned: false,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))
  const keepIds = new Set(newRows.map(r => r.book_id))
  const dropped = ((before ?? []) as any[]).filter(r => !keepIds.has(r.book_id))

  console.log(`\n════ PLANNED — ${YEAR} ════`)
  for (const r of newRows) {
    const b = ((books ?? []) as any[]).find(x => x.id === r.book_id)
    const isNew = !((before ?? []) as any[]).some(x => x.book_id === r.book_id)
    console.log(`  #${String(r.position).padStart(2)} ${isNew ? '+ ' : '~ '}${b.title}`)
    console.log(`        ${r.custom_blurb}`)
  }
  console.log(`\n  dropped (${dropped.length}): ${dropped.map(r => r.books?.title ?? r.book_id).join(', ') || '—'}`)

  if (!APPLY) {
    console.log('\nDRY RUN — re-run with --apply to write.')
    return
  }

  // Upsert first so the public section is never empty, then drop the leftovers.
  const { error: upErr } = await sb
    .from('bbw_featured_selections')
    .upsert(newRows, { onConflict: 'year,book_id' })
  if (upErr) throw new Error(`upsert failed: ${upErr.message}`)
  console.log(`\n  ~ upserted ${newRows.length} published rows`)

  if (dropped.length > 0) {
    const { error: delErr } = await sb
      .from('bbw_featured_selections')
      .delete()
      .eq('year', YEAR)
      .in('book_id', dropped.map(r => r.book_id))
    if (delErr) throw new Error(`delete failed: ${delErr.message}`)
    console.log(`  - dropped ${dropped.length} superseded rows`)
  }

  await sb.from('editorial_publish_log').insert({
    content_type: 'bbw_featured',
    content_key: String(YEAR),
    action: 'publish',
    notes: `Replaced the ${YEAR} featured set: 5 ALA-2025 US challenges + 5 state-level bans, all with cited custom blurbs. Superseded the stale 2026-05-08 suggester output.`,
  })

  // ── AFTER ─────────────────────────────────────────────────────────────────
  const { data: after } = await sb
    .from('bbw_featured_selections')
    .select('book_id, position, published_at, custom_blurb, books(title)')
    .eq('year', YEAR)
    .order('position')
  console.log(`\n════ AFTER — ${(after ?? []).length} rows ════`)
  for (const r of (after ?? []) as any[]) {
    console.log(`  #${String(r.position).padStart(2)} ${r.published_at ? 'PUB  ' : 'draft'} ${r.books?.title ?? r.book_id}${r.custom_blurb ? ' [blurb]' : ' [NO BLURB]'}`)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
