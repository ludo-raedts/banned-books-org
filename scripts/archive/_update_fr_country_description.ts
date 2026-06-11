#!/usr/bin/env tsx
/**
 * One-off: rewrite `countries.description` for France to reflect the new
 * historical scope after importing Liste Otto (909 records) and the
 * Article 14 Wikipedia list (138 records). The pre-existing intro framed
 * Madame Bovary, Le Grand Secret, and the 1949 Law as the headline cases;
 * the new intro acknowledges Liste Otto + Bernhard as the dominant
 * historical body, names the 1956 Olympia Press decree, and adds the
 * Gayssot Act (Reynouard / Graf / Rosenberg) — all now reflected in the
 * dataset.
 *
 * Same prose style as the existing R1-R6 country descriptions: factual,
 * dated, named, no fluff. Length ~2350 chars (up from 1281).
 *
 *   pnpm tsx --env-file=.env.local scripts/_update_fr_country_description.ts
 *   pnpm tsx --env-file=.env.local scripts/_update_fr_country_description.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

const NEW_DESCRIPTION = `France's documented record of book censorship spans three centuries and three regimes worth singling out. Under the Ancien Régime the Catholic Index banned Voltaire, Rousseau, Diderot, and Stendhal; Gustave Flaubert was prosecuted (and acquitted) for Madame Bovary in 1857, and Charles Baudelaire was convicted in the same year for Les Fleurs du Mal, with six poems ordered struck from the collection (the verdict was formally quashed only in 1949). The single largest body of French bans on record comes from the German occupation (1940–1944): the Liste Otto, compiled by the Syndicat des éditeurs under direction of the Propaganda-Abteilung, ran to three editions and over a thousand titles — works by Jewish authors, communists, anti-Nazis (Heinrich Mann, Stefan Zweig, Louis Aragon, André Malraux), or material the regime simply found undesirable; major French publishers Gallimard, Fayard, Albin Michel, and Flammarion saw dozens of titles withdrawn. The earlier Liste Bernhard (143 political titles, August 1940) was folded into Otto by September. Postwar France enacted the loi du 16 juillet 1949 sur les publications destinées à la jeunesse, whose Article 14 gave the Interior Ministry power to ban any publication deemed dangerous to minors; it was applied for decades to Boris Vian's J'irai cracher sur vos tombes, Henry Miller's Tropic of Cancer and Sexus, Pauline Réage's Story of O, John Cleland's Fanny Hill, and an entire batch of English-language Olympia Press titles in a single decree of 20 December 1956 under minister Jean Gilbert-Jules. The 29 July 1881 Press Law (still in force) and the Loi Pleven of 1972 criminalise incitement to racial, religious and ethnic hatred; the Gayssot Act of 1990 makes Holocaust denial a criminal offence and has since been used to ban works by Vincent Reynouard, Jürgen Graf, and Alfred Rosenberg. The most notorious recent banning concerned Le Grand Secret (1996), former presidential physician Claude Gubler's account of François Mitterrand's hidden cancer — banned for breach of medical confidentiality, then released for sale in 2005 after a European Court of Human Rights ruling against France. France today ranks consistently in the top quartile of global press freedom indices.`

async function main() {
  const sb = adminClient()

  // Show old + new for review.
  const { data, error } = await sb
    .from('countries')
    .select('code, name_en, description')
    .eq('code', 'FR')
    .single()
  if (error) throw error
  const old = (data as { description: string }).description

  console.log('── update-fr-country-description ──')
  console.log(`mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)
  console.log(`OLD (${old.length} chars):`)
  console.log(`  ${old.slice(0, 300)}…\n`)
  console.log(`NEW (${NEW_DESCRIPTION.length} chars):`)
  console.log(`  ${NEW_DESCRIPTION.slice(0, 300)}…\n`)

  if (!APPLY) {
    console.log('Dry-run. Re-run with --apply to write to DB.')
    console.log('Full new text printed below for review:\n')
    console.log('───────────────────────────────────────')
    console.log(NEW_DESCRIPTION)
    console.log('───────────────────────────────────────')
    return
  }

  const { error: uErr } = await sb
    .from('countries')
    .update({ description: NEW_DESCRIPTION })
    .eq('code', 'FR')
  if (uErr) throw uErr
  console.log('✓ Applied. Refresh /countries/FR on localhost to see the new intro.')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
