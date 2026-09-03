/**
 * Point-fix: genre tags on the four Gareth Hinds graphic-novel adaptations.
 *
 * Two of them (#7547 The Odyssey, #7598 The Iliad) were tagged `literary-fiction`
 * — the enrichment default — which hides the one fact that matters about them:
 * they are comics. Beowulf and Macbeth already carried `graphic-novel`; all four
 * carried a single slug where the vocabulary allows up to three, so this also
 * fills in form and audience.
 *
 * Found 2026-09-03 while checking the Tennessee "Odyssey" bans: Wilson County
 * and Oak Ridge banned the Hinds adaptation, not Homer's text.
 *
 * Slugs come from the 21-slug vocabulary in src/components/genre-badge.tsx.
 * Safe against re-enrichment: enrich-genres-gpt.ts only targets `genres = \'{}\'`,
 * so a non-empty manual value survives every sweep.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/_fix_hinds_graphic_novel_genres.ts
 *   npx tsx --env-file=.env.local scripts/_fix_hinds_graphic_novel_genres.ts --apply
 */
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'
import { isMappedGenre } from '../src/components/genre-badge'

const FIXES: { id: number; slug: string; genres: string[] }[] = [
  { id:  2110, slug: 'beowulf-a-graphic-novel', genres: ['graphic-novel', 'fantasy', 'young-adult'] },
  { id:  7547, slug: 'the-odyssey',             genres: ['graphic-novel', 'fantasy', 'young-adult'] },
  { id:  7598, slug: 'the-iliad',               genres: ['graphic-novel', 'historical-fiction', 'young-adult'] },
  { id: 18043, slug: 'macbeth-the-graphic-novel', genres: ['graphic-novel', 'historical-fiction', 'young-adult'] },
]

async function main() {
  const apply = isApply()
  const sb = adminClient()

  for (const f of FIXES) {
    const bad = f.genres.filter(g => !isMappedGenre(g))
    if (bad.length) throw new Error(`#${f.id}: slug not in vocabulary: ${bad.join(', ')}`)
  }

  const { data: before, error } = await sb.from('books')
    .select('id, slug, title, genres').in('id', FIXES.map(f => f.id)).order('id')
  if (error) throw error
  const byId = new Map((before as any[]).map(b => [b.id, b]))

  console.log(`${apply ? 'APPLY' : 'DRY-RUN'} — ${FIXES.length} books\n`)
  for (const f of FIXES) {
    const b = byId.get(f.id)
    if (!b) throw new Error(`#${f.id} not found`)
    if (b.slug !== f.slug) throw new Error(`#${f.id} slug drift: expected ${f.slug}, got ${b.slug}`)
    console.log(`#${f.id} ${b.title}`)
    console.log(`   before: ${JSON.stringify(b.genres)}`)
    console.log(`   after:  ${JSON.stringify(f.genres)}`)
    if (apply) {
      const { error: e } = await sb.from('books').update({ genres: f.genres }).eq('id', f.id)
      if (e) throw e
    }
  }

  if (apply) {
    const { data: after } = await sb.from('books')
      .select('id, title, genres').in('id', FIXES.map(f => f.id)).order('id')
    console.log('\nVERIFY (re-read from DB):')
    for (const b of (after as any[]) ?? []) console.log(`  #${b.id} ${b.title} → ${JSON.stringify(b.genres)}`)
  } else {
    console.log('\nNo writes. Re-run with --apply.')
  }
}
main().catch(e => { console.error(e); process.exit(1) })
