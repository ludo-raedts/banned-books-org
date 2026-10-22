/**
 * _botd_week_2026_09_28.ts — pre-flight fixes for the book-of-the-day picks of
 * 2026-09-28 … 2026-10-05. Produced by the /botd-week skill.
 *
 * Authors fixed (grounded; namesake-checked against Wikidata birth year +
 * description before anything was written):
 *    649  Yaşar Kemal          Q327142 (P569 1923-10-06 matches birth_year; a
 *                              second 1922 claim exists, en.wikipedia says
 *                              6 October 1923). Ungrounded bio rewritten.
 *                              photo_url was a DEAD upload.wikimedia URL (404)
 *                              → nulled; Commons has no free portrait (the
 *                              Wikidata P18 is a wax-museum figure).
 *   1347  Peggy Kern           NO Wikidata / no Wikipedia. Bio grounded in her
 *                              publisher's author note (Townsend Press).
 *   1640  Edward R. Ricciuti   Q112506605 (no description; LCNAF n78097000
 *                              "Animals in atomic research", "The beachwalker's
 *                              guide"; the same OpenLibrary author OL27869A
 *                              holds "What on earth is a pangolin" and "Animals
 *                              in atomic research" → same person). Bio from the
 *                              Penguin Random House author note + LoC record.
 *   8850  Christopher Isherwood Q310111 (1904-08-26). Correct Wikipedia-lead
 *                              bio kept, stamped, censorship sentence added.
 *   5636  Monteiro Lobato      Q606389 (1882-04-18). Importer-template closing
 *                              sentence replaced with grounded censorship text.
 *    164  Jack London          Q45765 (1876-01-12). Same template fix.
 *  13736  Hermann Kesser       Q1433179 (1880-08-04, matches). No en.wikipedia
 *                              article; bio translated from de.wikipedia.
 *
 * Read-only by default; pass --apply to write.
 */
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { isApply } from './lib/cli'

const NOW = new Date().toISOString()
const APPLY = isApply()

const WP = (t: string) => `https://en.wikipedia.org/wiki/${t}`
const VIAF = (id: string) => ({ viaf: `https://viaf.org/viaf/${id}` })

type Patch = { id: number; label: string; patch: Record<string, unknown> }

const AUTHORS: Patch[] = [
  {
    id: 649,
    label: 'Yaşar Kemal',
    patch: {
      bio: [
        'Yaşar Kemal (born Kemal Sadık Gökçeli; 6 October 1923 – 28 February 2015) was a leading Turkish writer of Kurdish descent and a human rights activist. He was born in Hemite (now Gökçedam), a hamlet in Osmaniye province in southern Turkey, and had a hard childhood: he lost his right eye in an accident, and at five he saw his father stabbed to death in a mosque. He was already a locally noted bard before he started school. He worked as a labourer in the Çukurova cotton fields, then as a letter-writer and a journalist; the Turkish police confiscated his first two novels, and in 1950 he was imprisoned for alleged communist activities. He took his pen name after moving to Istanbul to work for the newspaper Cumhuriyet.',
        'His first book, Ağıtlar (1943), collected folk ballads he had begun gathering at sixteen, and the legends of Anatolia and the lives of the people of the Çukurova plain remained the ground of his fiction. Memed, My Hawk (İnce Memed, 1955), about a young man who flees to the mountains to escape the oppression of the landowning aghas, brought him international acclaim, won the Varlık Prize in 1956, was filmed in 1984 with Peter Ustinov, and made him a candidate for the Nobel Prize in Literature. It was followed by The Wind from the Plain (1960), Iron Earth, Copper Sky (1963), The Undying Grass (1968) and the second Memed novel, They Burn the Thistles (1969), among many others; his first wife, Thilda, translated seventeen of his books into English, and he received 38 awards in his lifetime.',
        'Kemal joined the Workers Party of Turkey in 1962 and in 1967 co-founded the Marxist magazine Ant, which was closed after the 1971 military coup. An outspoken intellectual, he often spoke about the oppression of the Kurds: in 1995 he was tried under anti-terror laws over an article for Der Spiegel on the army’s destruction of Kurdish villages, and he later received a suspended 20-month prison sentence for another article criticising racism in Turkey. In this database, both Memed, My Hawk and They Burn the Thistles are recorded as banned in Turkey.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: WP('Ya%C5%9Far_Kemal'),
      wikidata_id: 'Q327142',
      social_links: VIAF('34458659'),
      birth_month: 10,
      birth_day: 6,
      photo_url: null,
      links_checked_at: NOW,
    },
  },
  {
    id: 1347,
    label: 'Peggy Kern',
    patch: {
      bio: [
        'Peggy Kern is an American author of fiction for young readers. She was born and raised in Westbury, New York, where she went to the local public elementary and middle schools as one of the few white students in a predominantly Black and Latino community. She enrolled at LaSalle University in Philadelphia in 1992 and discovered her love of literature and writing there, but paying for college herself proved too much; she moved back to New York, took a full-time job as a secretary and kept studying at night, first at a community college and then on a partial scholarship at Long Island University, graduating with a B.A. in English in 1998.',
        'In 2001 she completed a master’s degree in English and Writing at Southampton College, where she coordinated the Southampton Writers Conference, taught English composition and published several short stories. Her first book for Townsend Press’s Bluford series, No Way Out, appeared in 2008; The Test (2011) follows Liselle Mason, a former Bluford High student facing an unplanned pregnancy. Her novel Little Peach (2015) tells the story of a runaway girl drawn into child prostitution in New York City.',
        'Both of those novels appear in this database. The Test is recorded as banned or restricted in four American school districts between 2021 and 2025, two in Texas and two in Florida, and Little Peach in two more, in Escambia County, Florida, in 2023 and Wilson County, Tennessee, in 2024.',
      ].join('\n\n'),
      bio_source_type: 'manual',
      bio_source_url: 'https://www.townsendpress.com/store/college/fiction-and-nonfiction/test',
      links_checked_at: NOW,
    },
  },
  {
    id: 1640,
    label: 'Edward R. Ricciuti',
    patch: {
      bio: [
        'Edward R. Ricciuti is an American science journalist and naturalist, and a former curator at the New York Zoological Society, now the Wildlife Conservation Society, who has covered wildlife issues around the world. He graduated from the University of Notre Dame in 1959.',
        'He has written a long list of books about animals and the natural world for adults and children, from Animals in Atomic Research (1967) and The Beachwalker’s Guide (1982) to Bears in the Backyard: Big Animals, Sprawling Suburbs, and the New Urban Jungle, which looks at why large wild animals are increasingly turning up in cities and suburbs. For young readers he wrote the “What on Earth Is a …?” series of animal books, among them What on Earth Is a Pangolin? (1994).',
        'That pangolin book is recorded in this database as banned or restricted in two Florida school districts: the School District of Manatee County in 2023 and Hillsborough County Public Schools in 2025.',
      ].join('\n\n'),
      bio_source_type: 'manual',
      bio_source_url: 'https://www.penguinrandomhouse.com/authors/265141/edward-r-ricciuti/',
      wikidata_id: 'Q112506605',
      social_links: VIAF('56615490'),
      birth_year: 1938,
      links_checked_at: NOW,
    },
  },
  {
    id: 8850,
    label: 'Christopher Isherwood',
    patch: {
      bio: [
        'Christopher Isherwood (born Christopher William Bradshaw Isherwood; 26 August 1904 – 4 January 1986) was an English and American novelist, playwright, screenwriter, autobiographer, and diarist. His best-known works include Goodbye to Berlin (1939), a semi-autobiographical novel which was the basis for Cabaret (1966); A Single Man (1964), adapted into a film directed by Tom Ford in 2009; and Christopher and His Kind (1976), a memoir which "carried him into the heart of the Gay Liberation movement".',
        'In this database, Goodbye to Berlin and A Single Man are both recorded as banned in Belarus, added on 1 April 2025 to the Ministry of Information’s Official List of Publications Harmful to National Interests, as documented by PEN Belarus.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: WP('Christopher_Isherwood'),
      wikidata_id: 'Q310111',
      social_links: VIAF('76317308'),
      birth_month: 8,
      birth_day: 26,
      links_checked_at: NOW,
    },
  },
  {
    id: 5636,
    label: 'Monteiro Lobato',
    patch: {
      bio: [
        'José Bento Renato Monteiro Lobato (18 April 1882 – 4 July 1948) was one of Brazil’s most influential writers, mostly for his children’s books set in the fictional Sítio do Picapau Amarelo (Yellow Woodpecker Farm), but he had previously been a prolific writer of fiction, a translator and an art critic. He also founded one of Brazil’s first publishing houses, Companhia Editora Nacional, and was a supporter of nationalism. Lobato was born in Taubaté, São Paulo.',
        'His educational but entertaining children’s books, which make up about half of his output, follow the elderly farm owner Dona Benta, her grandchildren Narizinho and Pedrinho, the cook Tia Nastácia and the rag doll Emília, and teach subjects children often dislike at school — mathematics, grammar, history, geography, astronomy, Greek mythology. The other half of his work, novels and short tales for adult readers, was less popular but marked a watershed in Brazilian literature. The Sítio books became several television series, from TV Tupi in 1952 to Rede Globo in 2001.',
        'Lobato has been posthumously accused of racism for his portrayal of Black characters, and in 2010 a Brazilian educator tried to have Caçadas de Pedrinho legally banned from junior schools. In this database, his História do Mundo para as Crianças (History of the World for Children, 1933) is recorded as banned by the Portuguese government in 1933.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: WP('Monteiro_Lobato'),
      wikidata_id: 'Q606389',
      social_links: VIAF('99985617'),
      birth_month: 4,
      birth_day: 18,
      links_checked_at: NOW,
    },
  },
  {
    id: 164,
    label: 'Jack London',
    patch: {
      bio: [
        'John Griffith London (né Chaney; January 12, 1876 – November 22, 1916), better known as Jack London, was an American novelist, journalist and activist. A pioneer of commercial fiction and American magazines, he was one of the first American authors to become an international celebrity and earn a large fortune from writing, and an innovator in the genre that would later become known as science fiction. Born in San Francisco and raised largely in Oakland, he was mostly self-educated; he worked in a cannery, as an oyster pirate and on a sealing schooner, tramped with Coxey’s Army, and in 1897 sailed north to join the Klondike Gold Rush, the setting of some of his first successful stories.',
        'His most famous works include The Call of the Wild (1903) and White Fang, both set in Alaska and the Yukon, The Sea-Wolf, Martin Eden and the short story “To Build a Fire”. London was a passionate advocate of workers’ rights and socialism — he joined the Socialist Labor Party in 1896 and later the Socialist Party of America — and wrote on those themes in The People of the Abyss and in his dystopian novel The Iron Heel (1908), which anticipated and influenced Orwell’s Nineteen Eighty-Four. He died on his ranch in Glen Ellen, California, in 1916.',
        'In this database, The Iron Heel is recorded as banned in Germany in 1933 and Die Zwangsjacke in 1938, and The Sea Wolf is recorded as prohibited in Ketziot Prison (Ansar III) in Israel’s Negev.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: WP('Jack_London'),
      wikidata_id: 'Q45765',
      social_links: VIAF('46764200'),
      birth_month: 1,
      birth_day: 12,
      links_checked_at: NOW,
    },
  },
  {
    id: 13736,
    label: 'Hermann Kesser',
    patch: {
      bio: [
        'Hermann Kesser (born Hermann Kaeser-Kesser; 4 August 1880 – 5 April 1952) was a German writer and journalist. Born in Munich, he took his doctorate in Zürich in 1903 and worked as a journalist in Berlin, Rome and Wiesbaden before becoming a freelance writer; he also wrote radio plays for the Berlin broadcaster Funk-Stunde.',
        'A politically engaged writer of the left, Kesser was at the height of his career during the Weimar Republic one of the notable literary figures in Germany. His work ranged across stories and novellas — Lukas Langkofler, Der Strassenmann (1926) — novels such as Die Stunde des Martin Jochner (1917) and Musik in der Pension (1928), and plays including Summa summarum (1920), Rotation (1931) and Talleyrand und Napoleon (1938). After 1933 he emigrated to Switzerland, and in 1939 to the United States; after the war he settled in Basel, where he died. His son Armin Kesser also became a writer.',
        'In this database, four of his books — Beethoven der Europäer, Lukas Langkofler, Musik in der Pension and Strassenmann — are recorded as banned in Germany in 1938.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://de.wikipedia.org/wiki/Hermann_Kesser',
      wikidata_id: 'Q1433179',
      social_links: VIAF('8128377'),
      birth_month: 8,
      birth_day: 4,
      links_checked_at: NOW,
    },
  },
]

async function apply(rows: Patch[]) {
  const sb = adminClient()
  let total = 0
  for (const r of rows) {
    const sel = ['id', 'slug', ...Object.keys(r.patch)].filter((v, i, s) => s.indexOf(v) === i).join(',')
    const { data: before, error: e1 } = await sb.from('authors').select(sel).eq('id', r.id).single()
    if (e1) throw e1
    console.log(`\n--- authors ${r.id} ${r.label}`)
    console.log('BEFORE:', JSON.stringify(before))
    if (!APPLY) {
      console.log('AFTER : (dry run) would set', JSON.stringify(Object.keys(r.patch)))
      continue
    }
    const { data: after, error: e2 } = await sb
      .from('authors')
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
  for (const a of AUTHORS) {
    const p = a.patch.photo_url
    if (typeof p === 'string' && !isAllowedImageUrl(p)) throw new Error(`photo_url rejected for ${a.label}: ${p}`)
  }
  const n = await apply(AUTHORS)
  console.log(`\n== rows written: authors ${n}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
