/**
 * _botd_week_2026_09_21b.ts — second pass of the /botd-week pre-flight for
 * 2026-09-21 … 2026-09-28.
 *
 * Adding the warning_level='extended' gate to eligibleBookIds() (and the
 * manual exclusion of book 6515) pushed two NEW titles into the week, so they
 * need the same pre-flight as the rest:
 *
 *   2026-09-23  The Other Boleyn Girl (4787) / Philippa Gregory (3172)
 *   2026-09-25  Face à Hitler et à Mein Kampf (15016) / Roger Morvilliers (10325)
 *
 * Author 3172 Philippa Gregory — Q240212, b. 1954-01-09, matches
 *   authors.birth_year 1954. Importer-template bio replaced with a
 *   Wikipedia-grounded one; wikidata_id, VIAF, website and the two socials her
 *   own site links (x.com/PhilippaGBooks, facebook.com/PhilippaGregoryOfficial)
 *   written; birth_country was 'United Kingdom' but she was born in Nairobi.
 *
 * Author 10325 Roger Morvilliers — NOT TOUCHED. He has no Wikidata entity, no
 *   Wikipedia article and no VIAF personal-name authority; the only
 *   biographical text anywhere is an unsourced user note on OpenLibrary
 *   ("Habitait dans les années 1965-1975 rue de la Croix Bosset / Peintre"),
 *   which is not groundable. Left for user review.
 *
 * Book 4787 The Other Boleyn Girl:
 *   - isbn13 was 9785389000926 — a 978-5 (Russian) prefix, i.e. the ISBN of a
 *     Russian translation sitting on the English row, which is why there were
 *     no buy links. Replaced with the Simon & Schuster/Touchstone US edition
 *     (9780743227445, 664 pp; verified via OpenLibrary, no collision).
 *   - genres ['literary-fiction'] → ['historical-fiction'] (importer stamp; the
 *     old value is in GENRE_BLOCKLIST).
 *   - description_ban asserted a motive and a process no source of ours
 *     supports ("due to its sexual content and perceived immorality … local
 *     school boards responding to parental complaints … No notable public
 *     statements or legal challenges have been documented"). Rewritten from
 *     our own three ban rows and run through descriptionBanQualityGate().
 *
 * Book 15016 Face à Hitler et à Mein Kampf: description_book was null.
 *   Written from the Library of Congress/OpenLibrary edition record
 *   (OL6403530M: Sèvres, Seine-et-Oise, 1939, 251 pp, "En vente chez
 *   l'auteur", LCCN 40013544, class DD247.H5, and the book's own opening
 *   sentence) plus our Liste Otto ban row. It has no ISBN and never will —
 *   a self-published French book from 1939.
 *
 * Read-only by default; pass --apply to write.
 */
import { adminClient } from '../src/lib/supabase'
import { descriptionBanQualityGate } from '../src/lib/censorship-context-quality'
import { isApply } from './lib/cli'

const NOW = new Date().toISOString()
const APPLY = isApply()
const WP = (t: string) => `https://en.wikipedia.org/wiki/${t}`

type Patch = { id: number; label: string; patch: Record<string, unknown> }

const NEW_BAN_DESC_4787 =
  'Recorded in three United States school districts, all of them in 2024. The Clear Lake Community School District in Iowa and Wilson County Schools in Tennessee removed the novel outright; Orange County Public Schools in Florida restricted access to it. The Iowa and Florida records name the administration as the actor; the Tennessee record names none. The same Iowa district removed four further Gregory novels that year: The Boleyn Inheritance, The Constant Princess, The Queen’s Fool and The Virgin’s Lover.'

const AUTHORS: Patch[] = [
  {
    id: 3172,
    label: 'Philippa Gregory',
    patch: {
      bio: [
        'Philippa Gregory (born 9 January 1954) is a Kenyan-born English historical novelist who has been publishing since 1987. She was born in Nairobi, then the capital of the Colony and Protectorate of Kenya, the second daughter of Elaine Wedd and Arthur Percy Gregory, a radio operator and navigator for East African Airways; the family moved to Bristol when she was two. After Colston’s Girls’ School she went to journalism college in Cardiff and spent a year as an apprentice on the Portsmouth News before winning a place at the University of Sussex, where she took a degree in history in 1982. She worked for BBC radio for two years, then completed a PhD at the University of Edinburgh in 1985 on the popular fiction of eighteenth-century commercial circulating libraries, and has taught at Durham, Teesside and the Open University.',
        'Her early novels — the Lacey trilogy of Wideacre, The Favoured Child and Meridon — are set in the eighteenth century, and A Respectable Trade, about the slave trade in Bristol, she adapted herself into a four-part BBC drama whose script was nominated for a BAFTA and won an award from the Committee for Racial Equality. She is best known for her Tudor novels. The Other Boleyn Girl (2001) won the Romantic Novel of the Year Award, was adapted by the BBC in 2003 and filmed by Miramax in 2008 with Natalie Portman and Scarlett Johansson, and produced a string of sequels including The Queen’s Fool, The Virgin’s Lover, The Constant Princess and The Boleyn Inheritance. A later sequence on the Plantagenets and the Wars of the Roses — The White Queen (2009), The Red Queen, The Lady of the Rivers, The Kingmaker’s Daughter and The White Princess — became the BBC One series The White Queen in 2013. AudioFile magazine has called her the queen of British historical fiction. She was appointed CBE in the 2021 Birthday Honours for services to literature and to charity in the United Kingdom and the Gambia, and in 2023 published Normal Women, a non-fiction history of women in England across nine hundred years.',
        'Six Gregory titles appear in this database, carrying nine recorded bans and restrictions — every one of them in a United States school district, and all of them from 2023 and 2024. The Clear Lake Community School District in Iowa accounts for five: it removed The Other Boleyn Girl, The Boleyn Inheritance, The Constant Princess, The Queen’s Fool and The Virgin’s Lover in a single year. Wilson County Schools in Tennessee removed The Other Boleyn Girl and The Boleyn Inheritance in 2024, and Orange County Public Schools in Florida restricted The Other Boleyn Girl in 2024 and Changeling in 2023.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: WP('Philippa_Gregory'),
      wikidata_id: 'Q240212',
      website_url: 'https://www.philippagregory.com/',
      social_links: {
        twitter: 'https://x.com/PhilippaGBooks',
        facebook: 'https://www.facebook.com/PhilippaGregoryOfficial',
        viaf: 'https://viaf.org/viaf/19698456',
      },
      birth_month: 1,
      birth_day: 9,
      // Was 'United Kingdom'; Wikidata P19 and Wikipedia both give Nairobi.
      birth_country: 'Kenya',
      links_checked_at: NOW,
    },
  },
]

const BOOKS: Patch[] = [
  {
    id: 4787,
    label: 'The Other Boleyn Girl',
    patch: {
      isbn13: '9780743227445',
      bookshop_isbn13: '9780743227445',
      genres: ['historical-fiction'],
      description_ban: NEW_BAN_DESC_4787,
    },
  },
  {
    id: 15016,
    label: 'Face à Hitler et à Mein Kampf',
    patch: {
      description_book:
        'A French warning against Hitler and Mein Kampf, written by Roger Morvilliers and published in 1939 from Sèvres in Seine-et-Oise, where the author sold it himself — the imprint on the title page is simply “En vente chez l’auteur”. The 251-page book opens by quoting Marshal Lyautey’s verdict that every Frenchman ought to read Mein Kampf, and sets out to make Hitler’s programme legible to French readers on the eve of the war; the Library of Congress catalogues it under Hitler’s biography. Two years into the occupation the book was suppressed in its own country: it appears in the third edition of the Liste Otto, the register of works the German Propaganda-Abteilung wanted out of French bookshops.',
      description_source_type: 'manual',
      description_source_url: 'https://openlibrary.org/books/OL6403530M',
    },
  },
]

async function apply(table: 'authors' | 'books', rows: Patch[]) {
  const sb = adminClient()
  let total = 0
  for (const r of rows) {
    const sel = ['id', 'slug', ...Object.keys(r.patch)].filter((v, i, s) => s.indexOf(v) === i).join(',')
    const { data: before, error: e1 } = await sb.from(table).select(sel).eq('id', r.id).single()
    if (e1) throw e1
    console.log(`\n--- ${table} ${r.id} ${r.label}`)
    console.log('BEFORE:', JSON.stringify(before))
    if (!APPLY) {
      console.log('AFTER : (dry run) would set', JSON.stringify(Object.keys(r.patch)))
      continue
    }
    const { data: after, error: e2 } = await sb
      .from(table)
      .update({ ...r.patch, updated_at: NOW })
      .eq('id', r.id)
      .select(sel)
    if (e2) throw e2
    console.log('AFTER :', JSON.stringify(after?.[0]))
    total += after?.length ?? 0
  }
  return total
}

async function main() {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN (pass --apply to write) ===')

  const sb = adminClient()
  const { data: old } = await sb.from('books').select('description_ban').eq('id', 4787).single()
  const oldGate = descriptionBanQualityGate(String((old as { description_ban: string }).description_ban))
  const newGate = descriptionBanQualityGate(NEW_BAN_DESC_4787)
  console.log(`description_ban 4787 — OLD: ${oldGate.bucket} (${oldGate.reasoning})`)
  console.log(`description_ban 4787 — NEW: ${newGate.bucket} (${newGate.reasoning})`)
  if (!newGate.accept) throw new Error(`new description_ban rejected by the quality gate: ${newGate.reasoning}`)

  const nA = await apply('authors', AUTHORS)
  const nB = await apply('books', BOOKS)
  console.log(`\n== rows written: authors ${nA}, books ${nB}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
