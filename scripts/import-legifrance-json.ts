#!/usr/bin/env tsx
/**
 * Import 31 French ministerial decrees ("arrêtés") issued under
 * Article 14 of the Loi n° 49-956 du 16 juillet 1949 sur les publications
 * destinées à la jeunesse, restricting publications from sale to minors.
 *
 * The 1949 Act provides for three standard restrictions, often combined:
 *   - "vente aux mineurs"   — ban on sales to minors           (Article 14 al. 1)
 *   - "exposition"          — ban on public display            (Article 14 al. 2)
 *   - "publicité"           — ban on advertising               (Article 14 al. 2)
 * (A full "interdiction de circulation" under al. 3 is rare; none in this set.)
 *
 * All 31 records were discovered + extracted via four ChatGPT scrape sessions
 * against legifrance.gouv.fr (Journal officiel index) and spot-validated via
 * WebFetch (10/10 sampled records confirmed verbatim against the live page).
 * Date range: 1992-05-27 → 2026-02-23. The 2012-2018 gap in the corpus is
 * structural — France effectively stopped routine 1949-Act use around 2011,
 * keeping only high-profile cases (Tawhid 2019, Bien trop petit 2023,
 * Moi la jeune Musulmane 2026).
 *
 * Schema choices:
 *   - action_type='restricted' (not 'banned') — these are sale-to-minors
 *     restrictions, not full circulation bans.
 *   - ban_status='active' — the 1949-Act bans remain legally in force unless
 *     explicitly rescinded; none of these records was rescinded.
 *   - authors=['Anonymous'] for 27 anonymous magazines (publisher in source_name);
 *     real author for 4 records with named human author.
 *   - reason_slug — 'obscenity' for porn magazines, 'religious' for Islamic
 *     children's books, 'sexual' for Bien trop petit (YA explicit content),
 *     'moral' for Carlos jokes.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-legifrance-json.ts            # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-legifrance-json.ts --apply
 */

import { newPgClient } from '../src/lib/wikipedia/importer'
import { commitParsedRow, type CommitInput } from '../src/lib/imports/review-commit'

type BanType = 'vente_aux_mineurs' | 'exposition' | 'publicite' | 'circulation'
type ReasonSlug = 'obscenity' | 'sexual' | 'religious' | 'moral'

type Entry = {
  arrete_id: string
  arrete_date: string  // YYYY-MM-DD
  title: string
  author: string | null  // null → use ['Anonymous']
  publisher: string | null
  ban_types: BanType[]
  ban_motif: string | null  // verbatim French considérant phrase
  reason_slug: ReasonSlug
}

const ENTRIES: Entry[] = [
  // 1992
  { arrete_id: 'JORFTEXT000000527183', arrete_date: '1992-05-27', title: 'Gaie France Magazine', author: null, publisher: null, ban_types: ['vente_aux_mineurs'], ban_motif: 'caractères incitatifs à la pédophilie', reason_slug: 'obscenity' },
  // 1994
  { arrete_id: 'JORFTEXT000000729055', arrete_date: '1994-01-26', title: 'Gaie France', author: null, publisher: 'association Alexandre', ban_types: ['vente_aux_mineurs', 'exposition', 'publicite'], ban_motif: 'la place faite dans la revue ci-dessous mentionnée au prosélytisme en faveur de la pédophilie', reason_slug: 'obscenity' },
  // 1995
  { arrete_id: 'JORFTEXT000000537558', arrete_date: '1995-08-28', title: 'Gay Defi', author: null, publisher: 'éditions Defi', ban_types: ['vente_aux_mineurs', 'exposition', 'publicite'], ban_motif: null, reason_slug: 'obscenity' },
  // 1996
  { arrete_id: 'JORFTEXT000000193052', arrete_date: '1996-04-02', title: 'Conspiracy', author: null, publisher: 'société Samouraï', ban_types: ['vente_aux_mineurs', 'exposition'], ban_motif: "le caractère particulièrement violent (sévices divers) et pornographique (représentation complaisante de scènes outrancières) ainsi que le danger que représente cette revue pour les mineurs qui pourraient l'acquérir ou seulement la consulter", reason_slug: 'obscenity' },
  { arrete_id: 'JORFTEXT000000561649', arrete_date: '1996-08-28', title: 'Le Nouveau Lettres de femmes', author: null, publisher: 'Les Publications nouvelles', ban_types: ['vente_aux_mineurs'], ban_motif: "le caractère pornographique (représentation complaisante de scènes outrancières tant en ce qui concerne les textes que l'iconographie) ainsi que le danger que représente cette revue pour les mineurs qui pourraient l'acquérir", reason_slug: 'obscenity' },
  // 1997
  { arrete_id: 'JORFTEXT000000568435', arrete_date: '1997-10-23', title: 'Les Meilleures Histoires drôles de Carlos', author: 'Carlos', publisher: 'éditions Ramsay', ban_types: ['vente_aux_mineurs'], ban_motif: 'caractère particulièrement attentatoire à la dignité humaine', reason_slug: 'moral' },
  // 1998
  { arrete_id: 'JORFTEXT000000556246', arrete_date: '1998-04-17', title: 'Lesbian Licks', author: null, publisher: 'Genesis Publications, New York', ban_types: ['vente_aux_mineurs'], ban_motif: "par l'abondance de photographies de nature pornographique cette revue comporte des risques pour les mineurs qui pourraient l'acquérir", reason_slug: 'obscenity' },
  { arrete_id: 'JORFTEXT000000756326', arrete_date: '1998-10-05', title: 'Tabou Spécial', author: null, publisher: null, ban_types: ['vente_aux_mineurs'], ban_motif: 'le caractère violent et particulièrement pornographique (représentation complaisante de scènes outrancières) de la totalité des récits ainsi que le danger que représente cette revue pour les mineurs qui pourraient l\'acquérir', reason_slug: 'obscenity' },
  // 1999
  { arrete_id: 'JORFTEXT000000579346', arrete_date: '1999-10-13', title: 'Connex Mag', author: null, publisher: 'société SEPA Presse, Levallois-Perret', ban_types: ['vente_aux_mineurs', 'exposition'], ban_motif: 'le caractère particulièrement pornographique (représentation complaisante de scènes outrancières) ainsi que le danger que représente cette revue pour les mineurs qui pourraient l\'acquérir ou simplement la consulter', reason_slug: 'obscenity' },
  // 2000
  { arrete_id: 'JORFTEXT000000402990', arrete_date: '2000-11-17', title: 'Débande dessinée', author: null, publisher: 'société Image', ban_types: ['vente_aux_mineurs', 'exposition'], ban_motif: 'le caractère pornographique (représentation complaisante de scènes outrancières) tant en ce qui concerne les textes que les photographies, ainsi que le danger que représente cette revue pour les mineurs qui pourraient l\'acquérir ou simplement la consulter', reason_slug: 'obscenity' },
  // 2002
  { arrete_id: 'JORFTEXT000000408114', arrete_date: '2002-04-19', title: 'Couples', author: null, publisher: 'société NSP', ban_types: ['vente_aux_mineurs'], ban_motif: 'le caractère pornographique, tant en ce qui concerne les textes que les photographies, ainsi que le danger que représente cette revue pour les mineurs qui pourraient l\'acquérir', reason_slug: 'obscenity' },
  // 2003
  { arrete_id: 'JORFTEXT000000785222', arrete_date: '2003-06-05', title: 'Mes voisines hors série', author: null, publisher: 'éditions Malva Com', ban_types: ['vente_aux_mineurs'], ban_motif: 'le caractère pornographique, tant en ce qui concerne les textes que les photographies, ainsi que le danger que représente cette revue pour les mineurs qui pourraient l\'acquérir', reason_slug: 'obscenity' },
  // 2004
  { arrete_id: 'JORFTEXT000000800414', arrete_date: '2004-02-16', title: 'Pur Hentaï', author: null, publisher: 'éditions Cyber Press SARL', ban_types: ['vente_aux_mineurs'], ban_motif: 'le caractère pornographique, tant en ce qui concerne les textes que les photographies, ainsi que le danger que représente cette revue pour les mineurs qui pourraient l\'acquérir', reason_slug: 'obscenity' },
  { arrete_id: 'JORFTEXT000000251635', arrete_date: '2004-02-16', title: "l'Echangiste", author: null, publisher: 'éditions Eurofox SARL', ban_types: ['vente_aux_mineurs'], ban_motif: 'le caractère pornographique, tant en ce qui concerne les textes que les photographies, ainsi que le danger que représente cette revue pour les mineurs qui pourraient l\'acquérir', reason_slug: 'obscenity' },
  // 2005
  { arrete_id: 'JORFTEXT000000266181', arrete_date: '2005-09-19', title: 'Black Extrême', author: null, publisher: 'éditions ERB Communication', ban_types: ['vente_aux_mineurs', 'exposition'], ban_motif: null, reason_slug: 'obscenity' },
  { arrete_id: 'JORFTEXT000000815056', arrete_date: '2005-10-26', title: 'Brut', author: null, publisher: 'éditions DF Presse', ban_types: ['vente_aux_mineurs', 'exposition'], ban_motif: null, reason_slug: 'obscenity' },
  { arrete_id: 'JORFTEXT000000447449', arrete_date: '2005-10-26', title: 'Charme noir', author: null, publisher: 'éditions Any Time', ban_types: ['vente_aux_mineurs'], ban_motif: null, reason_slug: 'obscenity' },
  { arrete_id: 'JORFTEXT000000265569', arrete_date: '2005-10-26', title: 'Love show', author: null, publisher: 'éditions Ixora', ban_types: ['vente_aux_mineurs'], ban_motif: null, reason_slug: 'obscenity' },
  // 2007
  { arrete_id: 'JORFTEXT000000468850', arrete_date: '2007-06-26', title: 'Newcummers', author: null, publisher: 'éditions The Score Group', ban_types: ['vente_aux_mineurs'], ban_motif: null, reason_slug: 'obscenity' },
  // 2009
  { arrete_id: 'JORFTEXT000021234563', arrete_date: '2009-10-20', title: 'Club Exhib', author: null, publisher: 'éditions H8f7.com', ban_types: ['vente_aux_mineurs'], ban_motif: null, reason_slug: 'obscenity' },
  { arrete_id: 'JORFTEXT000021234566', arrete_date: '2009-10-20', title: 'Club Est', author: null, publisher: 'éditions H8f7.com', ban_types: ['vente_aux_mineurs'], ban_motif: null, reason_slug: 'obscenity' },
  { arrete_id: 'JORFTEXT000021234569', arrete_date: '2009-10-20', title: 'Club Nord et Belgique', author: null, publisher: 'éditions H8f7.com', ban_types: ['vente_aux_mineurs'], ban_motif: null, reason_slug: 'obscenity' },
  { arrete_id: 'JORFTEXT000021234572', arrete_date: '2009-10-20', title: 'Club Ouest et Centre', author: null, publisher: 'éditions H8f7.com', ban_types: ['vente_aux_mineurs'], ban_motif: null, reason_slug: 'obscenity' },
  { arrete_id: 'JORFTEXT000021234584', arrete_date: '2009-10-20', title: 'Indécent', author: null, publisher: 'éditions H8f7.com', ban_types: ['vente_aux_mineurs'], ban_motif: 'le caractère pornographique, tant en ce qui concerne les textes que les photographies, ainsi que le danger que représente cette revue pour les mineurs qui pourraient l\'acquérir', reason_slug: 'obscenity' },
  // 2010
  { arrete_id: 'JORFTEXT000022220530', arrete_date: '2010-03-29', title: 'Marc Dorcel Magazine', author: null, publisher: 'éditions Imagine', ban_types: ['vente_aux_mineurs', 'exposition'], ban_motif: null, reason_slug: 'obscenity' },
  { arrete_id: 'JORFTEXT000022220534', arrete_date: '2010-04-20', title: 'Honcho et All Man', author: null, publisher: 'éditions Village Presse Communication', ban_types: ['vente_aux_mineurs'], ban_motif: null, reason_slug: 'obscenity' },
  { arrete_id: 'JORFTEXT000022593921', arrete_date: '2010-07-13', title: 'RDV mecs', author: null, publisher: 'éditions Village Presse Communication', ban_types: ['vente_aux_mineurs'], ban_motif: null, reason_slug: 'obscenity' },
  // 2011
  { arrete_id: 'JORFTEXT000023946950', arrete_date: '2011-04-04', title: 'Union', author: null, publisher: 'éditions Montreux Publications', ban_types: ['vente_aux_mineurs'], ban_motif: null, reason_slug: 'obscenity' },
  // 2019
  { arrete_id: 'JORFTEXT000038947847', arrete_date: '2019-07-05', title: 'Apprendre le Tawhid aux enfants', author: "Muhammad Ibn'Adi-I-Wahhâb", publisher: 'Al-Haramayn', ban_types: ['vente_aux_mineurs', 'exposition', 'publicite'], ban_motif: null, reason_slug: 'religious' },
  // 2023
  { arrete_id: 'JORFTEXT000047852814', arrete_date: '2023-07-17', title: 'Bien trop petit', author: 'Manu Causse', publisher: 'Thierry Magnier', ban_types: ['vente_aux_mineurs'], ban_motif: null, reason_slug: 'sexual' },
  // 2026
  { arrete_id: 'JORFTEXT000053555226', arrete_date: '2026-02-23', title: 'Moi, la jeune Musulmane', author: "Ahmad Ibn Moubarak ibn Qadhlan Al Mazru'i", publisher: 'éditions Ibn Badis', ban_types: ['vente_aux_mineurs', 'exposition', 'publicite'], ban_motif: null, reason_slug: 'religious' },
]

const APPLY = process.argv.includes('--apply')

const BAN_TYPE_EN: Record<BanType, string> = {
  vente_aux_mineurs: 'sale to minors',
  exposition: 'public display',
  publicite: 'advertising',
  circulation: 'circulation',
}

const FR_MONTHS = [
  '', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

function frenchDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${FR_MONTHS[m]} ${y}`
}

function legifranceUrl(id: string): string {
  return `https://www.legifrance.gouv.fr/jorf/id/${id}`
}

function buildSourceName(e: Entry): string {
  return `Arrêté du ${frenchDate(e.arrete_date)} (Journal officiel)`
}

function buildDescription(e: Entry): string {
  const dateFr = frenchDate(e.arrete_date)
  const banTypeText = e.ban_types.map(t => BAN_TYPE_EN[t]).join(', ')
  const publisherClause = e.publisher ? ` Published by ${e.publisher}.` : ''
  const baseEn = `Restricted from ${banTypeText} by French ministerial decree of ${dateFr} (arrêté JORF ${e.arrete_id}) under Article 14 of the Loi du 16 juillet 1949 sur les publications destinées à la jeunesse.${publisherClause}`
  return e.ban_motif
    ? `${baseEn} Motif cited: « ${e.ban_motif} ».`
    : baseEn
}

async function main(): Promise<void> {
  const pg = newPgClient()
  await pg.connect()

  try {
    console.log(`\nLegifrance import — ${APPLY ? 'APPLY' : 'DRY-RUN'} — ${ENTRIES.length} arrêtés\n`)
    for (const e of ENTRIES) {
      const authorLabel = e.author ?? 'Anonymous'
      console.log(`  ${e.arrete_date} | ${e.reason_slug.padEnd(10)} | ${e.ban_types.join('+').padEnd(38)} | ${authorLabel} — ${e.title}`)
    }

    if (!APPLY) {
      console.log(`\nDry-run complete. Re-run with --apply.`)
      return
    }

    console.log(`\nApplying...\n`)
    let created = 0

    for (const e of ENTRIES) {
      const authors = e.author ? [e.author] : ['Anonymous']
      const input: CommitInput = {
        title: e.title,
        authors,
        year: Number(e.arrete_date.slice(0, 4)),
        first_published_year: null,
        country_code: 'FR',
        scope_slug: 'government',
        action_type: 'restricted',
        ban_status: 'active',
        reason_slug: e.reason_slug,
        description_ban: buildDescription(e),
        inclusion_rationale: `Imported from Legifrance JORF (${e.arrete_id}) — French Ministry of Interior decree under the Loi du 16 juillet 1949.`,
        source_url: legifranceUrl(e.arrete_id),
        source_name: buildSourceName(e),
        source_type: 'government',
        original_language: 'fr',
      }

      const result = await commitParsedRow(input, pg)
      created++
      console.log(`  ok  book_${result.book_id} + ban_${result.ban_ids[0]}  ${e.arrete_date}  ${e.title}`)
    }

    console.log(`\nWritten: ${created} new book+ban tuples for FR.`)

    // Post-state
    const after = await pg.query<{ bans: string; w_src: string; active: string; historical: string }>(
      `select
         count(*)::text as bans,
         count(*) filter (where exists (select 1 from ban_source_links bsl where bsl.ban_id = b.id))::text as w_src,
         count(*) filter (where status = 'active')::text as active,
         count(*) filter (where status = 'historical')::text as historical
       from bans b
       where country_code = 'FR'`,
    )
    const r = after.rows[0]
    console.log(`\nFR post-state: ${r.bans} bans total, ${r.w_src} with source, ${r.active} active, ${r.historical} historical`)
  } finally {
    await pg.end()
  }
}

main().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})
