/**
 * _botd_week_2026_09_21.ts — pre-flight fixes for the book-of-the-day picks of
 * 2026-09-21 … 2026-09-28. Produced by the /botd-week skill.
 *
 * Authors fixed (grounded; namesake-checked against Wikidata birth year +
 * description before anything was written):
 *    110  Arundhati Roy   Q212801 (b. 1961-11-24, matches authors.birth_year)
 *    411  William Powell  NO Wikidata entity for the Anarchist Cookbook author.
 *                         Bio grounded in en.wikipedia "The Anarchist Cookbook"
 *                         + "American Anarchist"; death_year 2016 added.
 *   1686  Lisa Bullard    NO Wikidata / no Wikipedia article. Bio grounded in
 *                         her own site (press kit + about page).
 *   7416  Vladimir Lenin  Q1394 — importer-template bio replaced and stamped.
 *  11979  Franz Werfel    Q78514 (b. 1890-09-10, d. 1945-08-26 — both match).
 *
 * Three CONTAMINATED author photos found and nulled:
 *    411  William Powell  held File:William_Powell_by_Hurrell.jpg — a 1936
 *                         George Hurrell publicity still of the HOLLYWOOD ACTOR
 *                         William Powell (1892–1984), not the Anarchist
 *                         Cookbook author (1949–2016). No free portrait of the
 *                         author exists.
 *   2563  Cathy Young     held File:Cathy_Young.jpg — the Russian-American
 *                         political commentator Catherine Alicia Young
 *                         (b. 1963, Q2262391). Her Wikipedia bibliography lists
 *                         exactly two books and neither is the 2002 Knopf Books
 *                         for Young Readers YA anthology we hold. Identity
 *                         unresolved → photo nulled, nothing else written.
 *   4598  Brenton Tarrant held File:Christchurch_Mosque,_New_Zealand.jpg — a
 *                         photo of the mosque he attacked, used as his author
 *                         portrait. Nulled. No bio written (see report).
 *
 * Books:
 *   3868  genres ['literary-fiction'] → ['young-adult'] (the known importer
 *         stamp on a Knopf Books for Young Readers anthology).
 *   7885  genres ['literary-fiction'] → ['children'] (a picture book).
 *         'literary-fiction' is in GENRE_BLOCKLIST, so both rows were invisible
 *         to genre discovery.
 *  16701  bookshop_isbn13 + isbn13 = 9781567924077, the David R. Godine edition
 *         of the complete Dunlop/Reidel translation (893 pp). Verified against
 *         the OpenLibrary editions list for work OL1219873W; no isbn13 collision.
 *   6305  description_book was the HINDI-translation blurb from Google Books
 *         sitting on an original_language='en' row. Replaced with a grounded
 *         English description from the publisher's own page.
 *
 * Read-only by default; pass --apply to write.
 */
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { isApply } from './lib/cli'

const NOW = new Date().toISOString()
const APPLY = isApply()

const WP = (t: string) => `https://en.wikipedia.org/wiki/${t}`

type Patch = { id: number; label: string; patch: Record<string, unknown> }

const AUTHORS: Patch[] = [
  {
    id: 1686,
    label: 'Lisa Bullard',
    patch: {
      bio: [
        'Lisa Bullard is an American children’s author who grew up in Bemidji, Minnesota. Writers were her superheroes as a child, she has said, because books worked like travelling machines that carried her out of a small town; she wrote poems, novels, songs, comic strips and neighbourhood newspapers long before she believed an everyday kid could become a professional writer. Her first appearance in print was a letter to the editor of the Bemidji newspaper in fifth grade, urging people to help save baby harp seals. Her first published book was the picture book Not Enough Beds!, about a family holiday with more relatives than sleeping places.',
        'She has since published more than a hundred books for young readers — picture books, informational non-fiction on subjects from sharks to household budgeting, and the middle-grade mystery Turn Left at the Cow, whose setting was drawn from her family’s cabin on Green Lake in Minnesota. She also wrote Get Started in Writing for Children, a guide for adult writers that draws on her sixteen-plus years as a publishing professional. Her awards include an International Reading Association / Children’s Book Council Children’s Choice Award, a National Parenting Publications Children’s Resources Silver Award, a Storytelling World Award honour title, two Teacher’s Choice Awards from Learning magazine, a place on the Science Books & Films “Best Books” list and a place on Booklist’s “Top 10 Financial Series for Youth”; Turn Left at the Cow was nominated for young readers’ awards in Connecticut, Florida, Minnesota and Nebraska. She teaches writing to adults and children, works as a freelance editor and book-marketing consultant, and lives just outside Minneapolis.',
        'Two of her books appear in this database, carrying three recorded restrictions, all of them in United States school districts and all of them on books about families. Different Can Be Great: All Kinds of Families was restricted by the St. John’s County School District in Florida in 2023 and by the Clear Creek-Amana Community School District in Iowa in 2024; My Family, Your Family was restricted by the School District of Manatee County in Florida in 2024.',
      ].join('\n\n'),
      bio_source_type: 'manual',
      bio_source_url: 'https://lisabullard.com/about/press_kit/',
      website_url: 'https://lisabullard.com/',
      links_checked_at: NOW,
    },
  },
  {
    id: 2563,
    label: 'Cathy Young (identity unresolved — photo only)',
    patch: {
      photo_url: null,
    },
  },
  {
    id: 4598,
    label: 'Brenton Tarrant (photo only — see report)',
    patch: {
      photo_url: null,
    },
  },
  {
    id: 411,
    label: 'William Powell',
    patch: {
      bio: [
        'William Powell (1949 – 11 July 2016) was an American writer, teacher and, later in life, a campaigner against his own first book. He wrote The Anarchist Cookbook as a teenager and published it in 1971, at the height of the counterculture era, as a protest against United States involvement in the Vietnam War. Drafted into the war and living in New York City among Vietnam veterans as the pacifist movements of the 1960s turned more violent, he researched the book between 1968 and 1970 in the New York Public Library’s “U.S. Combat Bookshelf”, drawing on sources as varied as The Boy Scout Handbook and Abbie Hoffman’s Fuck the System. What began as an idea for instructional flyers posted around New York grew into a book of “recipes”; more than thirty publishers turned the manuscript down before Lyle Stuart bought it, and its copyright, in 1970.',
        'Powell wrote in the foreword that the book was meant not for existing political fringe groups but for what he called the silent majority, and he later summarised its argument as the idea that violence is an acceptable means of bringing about political change — a position he spent the rest of his life repudiating. He converted to Anglicanism in 1976, left the United States in 1979, and worked for decades as a teacher and administrator in American-backed international schools across the Middle East, Africa and Asia, writing on pedagogy and conflict resolution. Because the copyright had never been his, he could not stop the book being printed; he called publicly in 2013 for it to go quietly out of print, and described it as a youthful mistake that had haunted him for years, including in finding work. In 2011 he and his wife, Ochan Kusuma-Powell, founded Next Frontier: Inclusion, a non-profit for children with developmental and learning disabilities, which he described as a way of atoning for the book. Charlie Siskel’s documentary American Anarchist (2016), built around interviews with Powell, premiered at the Venice Film Festival; Powell died of cardiac arrest that July.',
        'The Anarchist Cookbook is the only Powell title in this database, and it is banned or restricted in five countries — more jurisdictions than almost anything else here. France banned it by ministerial decree in June 1971, the year it appeared, under the 1949 law on publications intended for young people. Australia’s Classification Board refused it classification in May 1985 and again in October 2016, on the ground that it could instruct in matters of crime or violence. New Zealand’s Indecent Publications Tribunal ruled it objectionable in 1994. In the United Kingdom, possession has repeatedly been prosecuted under section 58 of the Terrorism Act 2000, with convictions in 2021 and 2025 and acquittals in 2008 and 2017. Canada’s customs restriction on importing it was the one that ended: it was lifted in 2002, when the Canada Customs and Revenue Agency concluded the book broke neither hate nor obscenity law.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: WP('The_Anarchist_Cookbook'),
      death_year: 2016,
      photo_url: null,
      photo_v2_checked_at: NOW,
      links_checked_at: NOW,
    },
  },
  {
    id: 11979,
    label: 'Franz Werfel',
    patch: {
      bio: [
        'Franz Viktor Werfel (10 September 1890 – 26 August 1945) was a novelist, playwright and poet who wrote in German and whose career ran from the First World War through the interwar years to the Second. He was born in Prague, then in the Kingdom of Bohemia within Austria-Hungary, the eldest of the three children of Rudolf Werfel, a wealthy manufacturer of gloves and leather goods; his mother, Albine Kussi, was a mill owner’s daughter. The family was Jewish, but Werfel was raised in part by a Czech Catholic governess, Barbara Šimůnková, who took him to mass in Prague’s main cathedral, and was educated at a Catholic school run by the Piarists — an upbringing that left him with a lasting interest in comparative religion that runs through both his fiction and his non-fiction.',
        'He published his first book of poems, Der Weltfreund, in 1911, by which time he belonged to the circle of German-Jewish writers around Prague’s Café Arco, Max Brod and Franz Kafka chief among them, and his early poems were championed by Karl Kraus in Die Fackel. In 1912 he moved to Leipzig as an editor for Kurt Wolff’s new publishing firm, where he edited Georg Trakl’s first collection. During the war he served in the Austro-Hungarian army on the Russian front as a telephone operator, and from the summer of 1917 at the Military Press Bureau in Vienna alongside Robert Musil, Rilke and Hugo von Hofmannsthal. There he met Alma Mahler, Gustav Mahler’s widow, then married to Walter Gropius; they married in 1929. Verdi: Roman der Oper (1924) established his reputation as a novelist, the Austrian Academy of Sciences awarded him the Grillparzer Prize in 1926, and by the end of the decade he was among the most established writers in German-language literature.',
        'A journey to British-ruled Palestine in 1930 with Alma, and an encounter with Armenian refugees in Jerusalem, produced the book he is best known for: The Forty Days of Musa Dagh (1933), a novel of Armenian resistance during the genocide of 1915. He lectured on the subject across Germany, and the SS paper Das Schwarze Korps attacked him for propagating what it called alleged Turkish horrors. He was forced out of the Prussian Academy of Arts in 1933 and his books were burned by the Nazis. He left Austria after the Anschluss in 1938 for a fishing village near Marseille, and after the German occupation of France escaped on foot over the Pyrenees with the help of Varian Fry and the Emergency Rescue Committee, sailing from Portugal to New York in October 1940. A vow made during five weeks sheltering at the pilgrimage town of Lourdes became The Song of Bernadette (1941), written in safety in Los Angeles, where he settled among other German and Austrian émigrés and where he died of heart failure in 1945.',
        'The Forty Days of Musa Dagh is the one Werfel title in this database, and it carries a single recorded ban: Turkey banned the novel in 1935, two years after publication, and pressed MGM to abandon its planned film adaptation.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: WP('Franz_Werfel'),
      wikidata_id: 'Q78514',
      social_links: { viaf: 'https://viaf.org/viaf/34464361' },
      birth_month: 9,
      birth_day: 10,
      birth_country: 'Austria-Hungary (now Czech Republic)',
      links_checked_at: NOW,
    },
  },
  {
    id: 7416,
    label: 'Vladimir Lenin',
    patch: {
      bio: [
        'Vladimir Ilyich Ulyanov (22 April [O.S. 10 April] 1870 – 21 January 1924), better known as Vladimir Lenin, was a Russian revolutionary, politician and political theorist. He served as the first and founding head of government of Soviet Russia from 1917 to 1924 and of the Soviet Union from 1922 to 1924. Ideologically a Marxist, his developments to the ideology are called Leninism.',
        'Born to an upper-middle-class family in Simbirsk, he embraced revolutionary socialist politics after his brother’s execution in 1887, was expelled from Kazan Imperial University for protesting against the Tsarist government, and then read for a law degree. He moved to Saint Petersburg in 1893 and became a senior Marxist activist; arrested for sedition in 1897, he was exiled to Shushenskoye in Siberia, where he married Nadezhda Krupskaya. After his exile he moved to Western Europe and became a leading theorist of the Russian Social Democratic Labour Party, taking the Bolshevik side when the party split in 1903. He returned to Russia after the February Revolution of 1917 and led the October Revolution that overthrew the Provisional Government.',
        'His government redistributed land among the peasantry, nationalised banks and large-scale industry, withdrew from the First World War by conceding territory to the Central Powers, and promoted world revolution through the Communist International; opponents were suppressed in the Red Terror, in which tens of thousands were killed or interned. It defeated anti-Bolshevik armies in the Russian Civil War, and in 1921, after wartime devastation, famine and popular uprisings, Lenin encouraged economic growth through the New Economic Policy. He died at Gorki with his health failing and was succeeded by Joseph Stalin. Widely considered one of the most significant figures of the twentieth century, he was the subject of a pervasive personality cult in the Soviet Union until its dissolution in 1991, and remains divisive: a champion of socialism and the working class to his supporters, the architect of a totalitarian dictatorship to his critics.',
        'Thirty-four Lenin titles appear in this database, carrying thirty-eight recorded bans in four countries. Malaysia’s Home Ministry accounts for twenty of them, gazetted under the Printing Presses and Publications Act between 1951 and 1972. Fourteen Spanish-language volumes were banned in Argentina in 1976 under the military dictatorship’s Proceso de Reorganización Nacional and later catalogued by the Comisión Provincial de la Memoria in Córdoba. Singapore banned three in 1963 under the Internal Security Act’s prohibition-of-publications order, lifting them in 2015. And in the United States, The State and Revolution was seized as obscene in Boston in 1927; in a 1940 raid in Oklahoma City copies were seized and burned alongside copies of the Declaration of Independence and the Constitution, and the convictions were reversed on appeal in 1943.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: WP('Vladimir_Lenin'),
      // Wikidata carries both the Julian (10 April) and Gregorian (22 April)
      // date; the row held the Old Style one, which is not the date anyone
      // observes. Switched to the Gregorian date the bio itself gives.
      birth_month: 4,
      birth_day: 22,
      birth_country: 'Russia',
      links_checked_at: NOW,
    },
  },
  {
    id: 110,
    label: 'Arundhati Roy',
    patch: {
      bio: [
        'Suzanna Arundhati Roy (born 24 November 1961) is an Indian author and political activist. She was born in Shillong, in what was then undivided Assam; her mother, Mary Roy, was a Malayali Christian women’s-rights activist from Aymanam in Kerala, and her father, Rajib Roy, a Bengali tea-plantation manager from Kolkata. Her parents divorced when she was two and she returned to Kerala with her mother and brother, where her mother started a school. She studied architecture at the School of Planning and Architecture in New Delhi and later took a position with the National Institute of Urban Affairs.',
        'She began in film and television, appearing in Massey Sahib (1985) and writing the screenplays for In Which Annie Gives It Those Ones (1989), drawn from her years as an architecture student, and Electric Moon (1992); the first won her the National Film Award for Best Screenplay. In 1994 she drew wide attention with “The Great Indian Rape Trick”, a review that challenged Shekhar Kapur’s Bandit Queen for restaging the rape of a living woman without her permission.',
        'Roy wrote The God of Small Things between 1992 and 1996. Semi-autobiographical, drawing on her childhood in Aymanam, it won the 1997 Booker Prize for Fiction and became the biggest-selling book by a non-expatriate Indian author; it was also attacked at home, where the chief minister of Kerala criticised its treatment of sexuality and Roy had to answer charges of obscenity. Since then she has written mainly essays and political non-fiction, collected by Penguin India in a five-volume set in 2014 and in the single volume My Seditious Heart (Haymarket, 2019), along with a second novel, The Ministry of Utmost Happiness (2017), longlisted for the Man Booker Prize, and a memoir of her mother, Mother Mary Comes to Me (2025). She won the 2024 PEN Pinter Prize and named the imprisoned British-Egyptian writer and activist Alaa Abd El-Fattah as the Writer of Courage with whom she shared it.',
        'Four Roy titles appear in this database, carrying sixteen recorded bans and challenges across three countries. Thirteen of them attach to The God of Small Things: Lebanon banned it nationally in 1997, the year it was published; that same year it faced obscenity charges in Kerala that were later dismissed; and eleven United States records follow — nine in Florida school districts, one in Iowa, and one older challenge with no district recorded — the dated ones running from 2022 to 2025. Her Kashmir writing was caught more recently. In August 2025 the Jammu and Kashmir Home Department ordered the seizure of literature it said propagated a false narrative and secessionism, a sweep of roughly two dozen titles that took in both Azadi and Kashmir: The Case for Freedom.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: WP('Arundhati_Roy'),
      birth_month: 11,
      birth_day: 24,
      // Was 'United Kingdom' — she was born in Shillong, in undivided Assam.
      birth_country: 'India',
      links_checked_at: NOW,
    },
  },
]

const BOOKS: Patch[] = [
  { id: 7885, label: 'Different Can Be Great: All Kinds of Families', patch: { genres: ['children'] } },
  { id: 3868, label: 'One Hot Second: Stories About Desire', patch: { genres: ['young-adult'] } },
  {
    id: 16701,
    label: 'The Forty Days of Musa Dagh',
    patch: { isbn13: '9781567924077', bookshop_isbn13: '9781567924077' },
  },
  {
    id: 6305,
    label: 'Azadi',
    patch: {
      description_book:
        'A collection of essays written between 2018 and 2020, built around the Urdu word azadi — freedom — which is the chant of the Kashmiri independence movement and which, Roy notes, came to be shouted on Indian streets by demonstrators against Hindu nationalism. She asks what lies between those two uses of the same word: a chasm, or a bridge. Writing on politics and on literature, and finishing as the COVID-19 pandemic emptied the streets she had been describing, Roy argues that the meaning of freedom is at stake everywhere as authoritarianism grows, and that the rupture of the pandemic is also an opening. Published by Penguin in the United Kingdom and India and by Haymarket Books in the United States in 2020.',
      description_source_type: 'manual',
      description_source_url: 'https://www.penguin.co.uk/books/442065/azadi-by-roy-arundhati/9780241470039',
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
  for (const a of AUTHORS) {
    const p = a.patch.photo_url
    if (typeof p === 'string' && !isAllowedImageUrl(p)) throw new Error(`photo_url rejected for ${a.label}: ${p}`)
  }
  const nA = await apply('authors', AUTHORS)
  const nB = await apply('books', BOOKS)
  console.log(`\n== rows written: authors ${nA}, books ${nB}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
