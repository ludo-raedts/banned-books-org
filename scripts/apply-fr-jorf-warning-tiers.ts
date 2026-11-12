#!/usr/bin/env tsx
/**
 * Editorial-note tiers for the French JORF Article-14 denial batch (2026-11-12).
 *
 * The classifier left all 30 imported rows at warning_level='none'. Eight of them
 * are works the Ministry of the Interior itself characterised as apology for
 * Nazism / racism / antisemitism / Holocaust denial — the same class as the six
 * Nazi-ideology books tiered earlier (scripts/archive/_apply_fr_nazi_warning_tiers.ts).
 * Tier = 'context' only: 'extended' needs a hand-written essay.
 *
 * inclusion_rationale is INTERNAL (never rendered); each one cites only what the
 * arrêté itself says — we hold no author/blurb for these rows.
 *
 * Deliberately NOT tiered: the ~20 obscenity (sale-to-minors) rows — house line is
 * obscenity cases = none; 'Les Français sont-ils racistes ?' (political pamphlet);
 * 'Moi, la jeune Musulmane' (religious tract).
 *
 *   npx tsx --env-file=.env.local scripts/apply-fr-jorf-warning-tiers.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/apply-fr-jorf-warning-tiers.ts --apply
 */
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()

const A14 = 'Article 14 of the loi du 16 juillet 1949'
const D83 = 'decree 83-1025 (foreign-origin publications)'

const UPDATES: { slug: string; rationale: string }[] = [
  {
    slug: 'politique-raciale',
    rationale: `Banned in France 23 May 1990 by arrêté of the Minister of the Interior under ${D83}; the arrêté cites "apologie du nazisme, du racisme et de l'antisémitisme" (translated work, author not recorded). Same arrêté as the two titles below. Documented as a state ban on Nazi-ideology literature; editorial note frames it like the other French Nazi-ideology entries.`,
  },
  {
    slug: 'lhonneur-sappelle-fidelite',
    rationale: `Banned in France 23 May 1990 by arrêté of the Minister of the Interior under ${D83}; the arrêté cites "apologie du nazisme, du racisme et de l'antisémitisme". Same arrêté as Politique raciale.`,
  },
  {
    slug: 'le-reichsfuhrer-ss-heinrich-himmler-lechelon-de-protection-organisation-de-combat-anti-bolchevique',
    rationale: `Banned in France 23 May 1990 by arrêté of the Minister of the Interior under ${D83}; the arrêté cites "apologie du nazisme, du racisme et de l'antisémitisme" (also titled "La SS, organisation de combat anti-bolchevique"). Same arrêté as Politique raciale.`,
  },
  {
    slug: 'les-juifs-et-la-guerre',
    rationale: `Sale to minors, display and poster advertising prohibited 29 May 1990 by arrêté of the Minister of the Interior under ${A14}; the arrêté cites the work's "caractère antisémite" and the place it gives to discrimination and racial hatred.`,
  },
  {
    slug: 'le-manifeste-antijuif',
    rationale: `Sale to minors, display and poster advertising prohibited 2 March 1992 by arrêté of the Minister of the Interior under ${A14}; the arrêté cites the work's "caractère antisémite" and the place it gives to discrimination and racial hatred.`,
  },
  {
    slug: 'tulle-et-oradour-tragedie-franco-allemande',
    rationale: `Banned in France 10 January 1991 by arrêté of the Minister of the Interior under ${D83} (foreign author); the arrêté calls it a "provocation à l'égard des résistants et des familles des victimes des crimes de guerre nazis". Author Otto Weidinger (SS officer, Das Reich). Borderline: apologia/revisionism rather than outright ideology tract — 'context' is the lowest tier that fits.`,
  },
  {
    slug: 'lordre-ss-ethique-et-ideologie',
    rationale: `Banned in France 2 December 1992 by arrêté of the Minister of the Interior under ${D83}; the arrêté cites "apologie du nazisme". Attributed author Edwige Thibaut; the work's actual character (propaganda vs. study) not independently verified — the tier rests on the arrêté's own finding.`,
  },
  {
    slug: 'encyclopedie-de-lholocauste-non-censuree-et-non-contrainte',
    rationale: `Banned in France in 2026 by arrêté of the Minister of the Interior under ${A14}; the arrêté finds the work (published November 2025) calls the existence of the Holocaust into question, presenting the "solution finale" as an undocumented fiction. Holocaust-denial class; 'context' for now — 'extended' (hand-written essay) is an editorial option.`,
  },
]

async function main() {
  console.log(`── apply-fr-jorf-warning-tiers (${APPLY ? 'APPLY' : 'DRY-RUN'}) — ${UPDATES.length} books\n`)
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
