#!/usr/bin/env tsx
/**
 * One-off: set warning_level + inclusion_rationale (and extended_context for
 * the one extended-tier case) on six Nazi-ideology / Holocaust-denial books
 * imported via the French Article 14 batch. The GPT classifier auto-applied
 * `none` for all six because the prompt deliberately reserves `context`
 * and `extended` for very narrow cases — but the project's editorial
 * practice (cf. Mein Kampf at /books/mein-kampf) DOES label this kind of
 * Nazi-grondtekst-en-Holocaust-denial content with an editorial note. This
 * script aligns the 6 records with that practice.
 *
 * Rationale prose modelled on the Mein Kampf entry: factual statement of
 * what the work is + why documenting its censorship matters.
 *
 *   pnpm tsx --env-file=.env.local scripts/_apply_fr_nazi_warning_tiers.ts
 *   pnpm tsx --env-file=.env.local scripts/_apply_fr_nazi_warning_tiers.ts --apply
 */

import { newPgClient } from '../src/lib/wikipedia/importer'

const APPLY = process.argv.includes('--apply')

type Tier = 'context' | 'extended'
type Update = {
  slug: string
  warning_level: Tier
  inclusion_rationale: string
  extended_context?: string
}

const UPDATES: Update[] = [
  {
    slug: 'le-massacre-doradour',
    warning_level: 'context',
    inclusion_rationale:
      "Holocaust-revisionist tract by Vincent Reynouard reframing the Nazi SS massacre at Oradour-sur-Glane. Banned in France in 1997 by ministerial decree under Article 14 of the loi du 16 juillet 1949, and a recurring test case for the 1990 Gayssot Act criminalising Holocaust denial. Documenting how the French state has handled this work — and the broader denial literature — is core to understanding the contemporary speech-vs-censorship debate.",
  },
  {
    slug: 'les-camps-de-concentration-allemands-1941-1945-mythes-propages-realites-occultees',
    warning_level: 'context',
    inclusion_rationale:
      'Holocaust-denial tract by Vincent Reynouard styled as "myths propagated, realities occluded" about the Nazi concentration camps. Banned in France in 2000 by ministerial decree under Article 14 of the loi du 16 juillet 1949; Reynouard has been convicted multiple times under the Gayssot Act and has lived as a fugitive across European jurisdictions. Documenting how states have handled this work is core to understanding the limits of speech-protection regimes.',
  },
  {
    slug: 'lholocauste-au-scanner',
    warning_level: 'context',
    inclusion_rationale:
      "French translation of Jürgen Graf's Holocaust-denial work \"Der Holocaust auf dem Prüfstand\". Banned in France in 1994 by Interior Minister Charles Pasqua under Article 14 of the loi du 16 juillet 1949; Graf was convicted in Switzerland under that country's anti-racism law in 1998. Documenting how multiple European democracies have handled denial literature is core to understanding postwar speech regimes.",
  },
  {
    slug: 'lheure-decisive-de-la-lutte-entre-leurope-et-le-bolchevisme',
    warning_level: 'context',
    inclusion_rationale:
      'Wartime political tract by Alfred Rosenberg, the leading ideologue of National Socialism and editor of the Völkischer Beobachter — executed at Nuremberg in 1946. Banned in France in 1990 by Interior Minister Pierre Joxe under Article 14 of the loi du 16 juillet 1949. Documenting how the French state has handled posthumous reissues of Nazi-regime ideologues is core to understanding modern censorship.',
  },
  {
    slug: 'the-myth-of-the-twentieth-century-1934-on-the-dark-men-of-our-times',
    warning_level: 'extended',
    inclusion_rationale:
      'Foundational Nazi-ideological text — by historical consensus the second-most-important Nazi political work after Mein Kampf, and the regime\'s most ambitious attempt at a racial-religious worldview. Placed on the Catholic Index of Forbidden Books in 1934 and subject to ongoing postwar copyright suppression in the Federal Republic of Germany until the rights lapsed in 2015. Documenting how states and institutions have handled this work — and how they have failed to — is core to understanding modern censorship.',
    extended_context:
      "Alfred Rosenberg's *Der Mythus des zwanzigsten Jahrhunderts* (1930) is, by historical consensus, the second-most-important political text of National Socialism after Mein Kampf — a 700-page attempt to fuse antisemitic conspiracy theory, racial-Aryan mysticism, and anti-Christian \"positive Christianity\" into a coherent worldview for the Third Reich. Its author was sentenced to death and hanged at Nuremberg in 1946. Like Mein Kampf, the work became a textbook case in postwar copyright suppression: the Free State of Bavaria, holding the rights to all Nazi-confiscated estates, used those rights to block German-language reprints for seven decades. The Catholic Church placed the work on the Index of Forbidden Books in 1934, an unusual gesture of pre-war institutional resistance. Documenting how multiple states and institutions have handled this work — and how they have failed to — is core to understanding modern censorship.",
  },
  {
    slug: 'la-cohue-de-1940',
    warning_level: 'context',
    inclusion_rationale:
      'Self-exculpatory memoir of the 1940 collapse of France by Léon Degrelle — Belgian Rexist Party leader, Waffen-SS general (Brigade Wallonie, Eastern Front), and the highest-profile Belgian Nazi collaborator. Condemned to death in absentia for treason in Belgium in 1944, Degrelle escaped to Franco-era Spain where he lived openly until his death in 1994. Banned in France in 1950 by Interior Minister Henri Queuille under Article 14 of the loi du 16 juillet 1949. Documenting how postwar France handled the writings of Nazi-collaborator exiles is core to understanding the reach of denazification.',
  },
]

async function main() {
  console.log(
    `── apply-fr-nazi-warning-tiers (${APPLY ? 'APPLY' : 'DRY-RUN'}) — ${UPDATES.length} books\n`,
  )

  const pg = newPgClient()
  await pg.connect()
  try {
    for (const u of UPDATES) {
      const { rows } = await pg.query<{ id: number; title: string; warning_level: string | null }>(
        'SELECT id, title, warning_level FROM books WHERE slug = $1',
        [u.slug],
      )
      if (rows.length === 0) {
        console.log(`  ✗ slug not found: ${u.slug}`)
        continue
      }
      const b = rows[0]
      console.log(
        `  [book ${b.id}] "${b.title}"\n     current: warning_level=${b.warning_level}\n     plan:    warning_level=${u.warning_level}${u.extended_context ? ' (+ extended_context)' : ''}`,
      )
      if (APPLY) {
        await pg.query(
          `UPDATE books
             SET warning_level = $2,
                 inclusion_rationale = $3,
                 extended_context = COALESCE($4, extended_context)
           WHERE slug = $1`,
          [u.slug, u.warning_level, u.inclusion_rationale, u.extended_context ?? null],
        )
        console.log('     ✓ applied')
      }
      console.log('')
    }
  } finally {
    await pg.end()
  }

  if (!APPLY) console.log('Dry-run. Re-run with --apply to write to DB.')
  else {
    console.log('After apply, refresh /books/{slug} on localhost to see the Editorial Note frame.')
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
