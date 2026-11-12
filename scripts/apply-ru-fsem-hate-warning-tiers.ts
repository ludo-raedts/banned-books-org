#!/usr/bin/env tsx
/**
 * Editorial-note tiers for hate / Nazi-ideology texts on Russia's FSEM list that
 * the classifier left at warning_level='none' (found by read-only scan of RU bans,
 * 2026-11-12). Same class as the French JORF tiering (apply-ru-fsem-hate-warning-tiers.ts)
 * and the earlier Nazi-ideology books. Tier = 'context' only; 'extended' needs a
 * hand-written essay (International Jew / Siege are candidates for one).
 *
 * inclusion_rationale is INTERNAL (never rendered); each cites only what our own
 * ban record says (FSEM entry numbers + description).
 *
 * Deliberately NOT tiered: Hitler's Table Talk (historical source), Hitler without
 * lies and myths (biography), God's People (unclear), Maus (not a hate text).
 * BORDERLINE (included, flagged in rationale): Siege (operational-propaganda
 * criterion review), Skins: Rus' is Awakening (novel).
 *
 *   npx tsx --env-file=.env.local scripts/apply-ru-fsem-hate-warning-tiers.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/apply-ru-fsem-hate-warning-tiers.ts --apply
 */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const F = "Banned by Russia's FSEM (Federal List of Extremist Materials)"

const UPDATES: { slug: string; rationale: string }[] = [
  { slug: 'the-international-jew', rationale: `${F}, entries #459 and #2955. Henry Ford's 1920 antisemitic pamphlet series (Dearborn Independent). Closest analogue: The Protocols of the Elders of Zion (extended tier) — candidate for an extended essay.` },
  { slug: 'the-jewish-question-as-a-question-of-racial-character-and-its-harmful-influence-on-the-existence-of-peoples-on-manners-and-culture', rationale: `${F}, entries #979 and #3329. 1881 antisemitic tract by the German philosopher Eugen Dühring; influenced later Nazi racial theory.` },
  { slug: 'the-jewish-question-through-the-eyes-of-an-american', rationale: `${F}, entry #5104. Antisemitic book by a US white-supremacist author.` },
  { slug: 'jews-in-history', rationale: `${F}, entry #2931. Early-20th-century antisemitic tract.` },
  { slug: 'dezionization', rationale: `${F}, entry #970. Soviet-era antisemitic and anti-Zionist tract.` },
  { slug: 'memoirs', rationale: `${F}, entry #1648. Memoir by the Nazi ideologue executed at Nuremberg (Alfred Rosenberg).` },
  { slug: 'restruct', rationale: `${F}, entry #2572. Manifesto by a Russian neo-Nazi figure ('Tesak').` },
  { slug: 'siege', rationale: `${F}. James Mason's collected essays advocating neo-Nazi accelerationism; influential text in 21st-century far-right terrorism. BORDERLINE: sits near the inclusion criterion's exclusion of operational propaganda tied to mass violence — needs an editorial decision on inclusion/tier (extended essay vs. exclude), not just a note.` },
  { slug: 'skins-rus-is-awakening', rationale: `${F}, entry #1482. Skinhead-movement novel. BORDERLINE: fiction; included at 'context' on the strength of the FSEM listing alone.` },
]

async function main() {
  console.log(`── apply-ru-fsem-hate-warning-tiers (${APPLY ? 'APPLY' : 'DRY-RUN'}) — ${UPDATES.length} books\n`)
  const pg = newPgClient()
  await pg.connect()
  let changed = 0
  try {
    for (const u of UPDATES) {
      const { rows } = await pg.query<{ id: number; title: string; warning_level: string }>(
        'SELECT id, title, warning_level FROM books WHERE slug = $1',
        [u.slug],
      )
      if (rows.length === 0) { console.log(`  ✗ slug not found: ${u.slug}\n`); continue }
      const b = rows[0]
      console.log(`  [book ${b.id}] "${b.title}"\n     ${b.warning_level} → context\n     rationale: ${u.rationale}`)
      if (APPLY && b.warning_level === 'none') {
        await pg.query(
          `UPDATE books SET warning_level = 'context', inclusion_rationale = $2 WHERE slug = $1`,
          [u.slug, u.rationale],
        )
        changed++
        console.log('     ✓ applied')
      }
      console.log('')
    }
  } finally {
    await pg.end()
  }
  console.log(APPLY ? `Applied ${changed}/${UPDATES.length}.` : 'Dry-run. Re-run with --apply to write to DB.')
}

main().catch(e => { console.error(e); process.exit(1) })
