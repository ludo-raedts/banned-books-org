/**
 * _botd_week_2026_09_07.ts — one-off pre-flight fixes for the book-of-the-day
 * picks 2026-09-07 … 2026-09-14, produced by the /botd-week skill.
 *
 * Every bio below is written from ONE fetched source (recorded in
 * bio_source_url); every link comes from the author's Wikidata entity (probed
 * 2026-09-07) after a namesake check (P31 = Q5 + P569 matching our stored
 * birth_year), or from the author's own verified site; every closing
 * censorship sentence is grounded in our own bans rows for that author.
 *
 * Two photo contaminations and one cover/description contamination were found
 * and are cleared here (see the `why` notes).
 *
 * Read-only by default; pass --apply to write.
 */
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { descriptionBanQualityGate } from '../src/lib/censorship-context-quality'
import { isApply } from './lib/cli'

const NOW = new Date().toISOString()
const APPLY = isApply()

type Patch = { id: number; why: string; patch: Record<string, unknown> }

// ── authors ────────────────────────────────────────────────────────────────
const AUTHORS: Patch[] = [
  {
    id: 275,
    why: 'e lockhart (pick 2026-09-10) — bio was the two-sentence Wikipedia lead, UNSTAMPED, no links. Wikidata Q5322028 (P31=Q5, P569 preferred 1967-09-13 matches our birth_year 1967, description names both the pen name and the real name): website https://www.emilylockhart.com/ (P856, verified 200, title "E. Lockhart"; the other P856, emilyjenkins.com, is the Emily Jenkins site), X @elockhart (P2002, 200), VIAF 22431540 — the P214 value qualified P742 "E. Lockhart"; the other VIAF (47002936) is qualified "Jenkins, Emily". Birthday 13 September.',
    patch: {
      bio: [
        'Emily Jenkins (born 13 September 1967), who writes for teenagers under the pen name E. Lockhart, is an American author of young adult novels, children’s picture books and adult fiction. She grew up in Cambridge, Massachusetts, and in Seattle, where she attended Lakeside School; in high school she went to summer drama schools at Northwestern University and at the Children’s Theatre Company in Minneapolis. She studied at Vassar College, where she wrote a senior thesis on illustrated books and interviewed the illustrator Barry Moser, and took a doctorate in English literature at Columbia University. “Lockhart” was her maternal grandmother’s family name.',
        'Her first book under the pen name was The Boyfriend List, published by Delacorte in 2005 and followed by three sequels — The Boy Book (2006), The Treasure Map of Boys (2009) and Real Live Boyfriends (2010) — known together as the Ruby Oliver novels. The Disreputable History of Frankie Landau-Banks (2008) was a finalist for both the National Book Award for Young People’s Literature and the Michael L. Printz Award. We Were Liars (2014) made the four-book shortlist for the Guardian Children’s Fiction Prize that year and was adapted into a television series in 2025; it has since been joined by Family of Liars (2022) and We Fell Apart (2025). Under her own name she writes picture books and children’s fiction with illustrators, work honoured with an Oppenheim Toy Portfolio Platinum Book Award for Toys Go Out, illustrated by Paul O. Zelinsky, and two Boston Globe–Horn Book Award runner-up citations, for Five Creatures and That New Animal.',
        'Eight of her titles appear in this database, carrying 44 recorded bans and restrictions — all of them in the United States, naming 27 school districts across seven states (Florida, Iowa, Pennsylvania, Tennessee, Texas, Virginia and Wisconsin) between 2021 and 2025. Real Live Boyfriends accounts for 22 of those records on its own. Fly on the Wall: How One Girl Saw Everything carries ten, among them outright removals in Lee County Schools in Florida in 2022 and Rutherford County Schools in Tennessee in 2025.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/E._Lockhart',
      wikidata_id: 'Q5322028',
      website_url: 'https://www.emilylockhart.com/',
      social_links: {
        twitter: 'https://x.com/elockhart',
        viaf: 'https://viaf.org/viaf/22431540',
      },
      birth_month: 9,
      birth_day: 13,
      links_checked_at: NOW,
    },
  },
  {
    id: 7067,
    why: 'Alex London (pick 2026-09-11) — bio was the UNSTAMPED Wikipedia lead with an importer tail "(born in United States in 1980.)"; rewritten and stamped. Wikidata Q104664890 "C. Alexander London" (P31=Q5, P569 1980 precision 9 matches our birth_year 1980, enwiki sitelink = "Alex London"): website https://www.calexanderlondon.com/ (P856, verified 200), VIAF 107960087. P2002 "ca_london" was NOT written — https://x.com/ca_london returns 404, so the Wikidata handle is stale. photo_url NULLED: it pointed at OpenLibrary author OL18319A, which is Mark Twain — a namesake-free but flatly wrong portrait. Wikidata has no P18 for him and Commons has no free photo, so the page now shows the initials avatar. Birth date precision is year-only, so no birthday fields.',
    patch: {
      bio: [
        'Alex London (born 1980), who has also published as Charles London and C. Alexander London, is an American author of picture books, middle-grade and young-adult fiction, and adult non-fiction. He was born in Baltimore, Maryland, attended the Gilman School, graduated from Columbia University in 2002 with a degree in philosophy, and took a master’s in library and information science at the Pratt Institute in 2010. He has worked as a journalist and human-rights researcher reporting from conflict zones and refugee camps, as a young-adult librarian with the New York Public Library, and as a snorkel salesman. He lives with his husband and daughter in Philadelphia.',
        'He was a research associate for Refugees International while working on the book that became One Day the Soldiers Came: Voices of Children in War (2007), and was a Truman National Security Project Fellow in 2009. His fiction ranges across fantasy, science fiction, historical and contemporary settings, published with Scholastic, Penguin Random House, Macmillan and HarperCollins, and has sold an estimated 2.5 million copies in seven languages. Proxy (2013) was one of the very few mainstream dystopian young-adult novels of the 2010s boom with a gay protagonist; Black Wings Beating (2018) took starred reviews from Kirkus and School Library Journal, was called “wondrous” by the New York Times, and was a Rainbow List selection. He wrote in 2016 about why it mattered to him to be out as a gay author in children’s books, and in 2022 helped write an author letter against book banning that Congressman Jamie Raskin read into the congressional record.',
        'Five of his books appear in this database with six recorded bans and restrictions, all in the United States and all logged in PEN America’s school-book-ban indexes: Proxy restricted in North East Independent School District in Texas in 2021 and in Granbury Independent School District in Texas in 2022; Black Wings Beating and Gold Wings Rising restricted in Collierville Schools in Tennessee in 2022; and the Battle Dragons novels City of Speed and City of Secrets removed in Boyle County Schools in Kentucky in 2023 — an attempt made, his Wikipedia entry records, over a non-binary character, and later reversed.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/Alex_London',
      wikidata_id: 'Q104664890',
      website_url: 'https://www.calexanderlondon.com/',
      social_links: { viaf: 'https://viaf.org/viaf/107960087' },
      photo_url: null,
      links_checked_at: NOW,
    },
  },
  {
    id: 9367,
    why: 'José Martí (pick 2026-09-12) — bio was a verbatim, UNSTAMPED single-paragraph dump of the Wikipedia lead; rewritten into three paragraphs and stamped. Wikidata Q103285 (P31=Q5, P569 1853-01-28 and P570 1895-05-19 match our birth_year/death_year) + VIAF 73865537; birthday 28 January. display_name/slug also corrected from the inverted catalogue form "Martí, José" (as it came in from the Argentine APM Córdoba import) to "José Martí" — no other Martí row exists, and marti-jose is kept as a slug alias.',
    patch: {
      display_name: 'José Martí',
      slug: 'jose-marti',
      bio: [
        'José Julián Martí Pérez (28 January 1853 – 19 May 1895) was a Cuban poet, essayist, journalist, translator, professor, publisher and nationalist, regarded as a Cuban national hero for his part in the island’s liberation from Spain and as one of the major figures of Latin American literature. He was born in Havana, at 41 Paula Street, to Spanish parents — a Valencian father, Mariano Martí Navarro, and a mother from the Canary Islands, Leonor Pérez Cabrera — and was the eldest of eight children. His schoolmaster Rafael María de Mendive shaped his politics early; when the Ten Years’ War broke out in 1868 the fifteen-year-old was already writing for Cuban independence.',
        'In October 1869, aged sixteen, he was arrested over a letter he had co-written reproving a friend who joined the Spanish army, and was condemned to six years’ imprisonment; his legs were badly cut by the chains, and he was deported to Spain instead. There he took degrees in civil and canon law and in philosophy and letters at Zaragoza in 1874. Barred from returning to Cuba, he lived and taught in Mexico and Guatemala, founded the Revista Venezolana in Caracas in 1881, and settled in New York, writing for newspapers across the Americas, translating Helen Hunt Jackson’s Ramona, and producing the children’s magazine La Edad de Oro. His essay “Nuestra América” appeared on 1 January 1891 in New York’s Revista Ilustrada and on 30 January in the Mexican paper El Partido Liberal; Versos Sencillos followed that October, and verses from it were later adapted into the song “Guantanamera”. In 1892 he founded Patria, the organ of the Cuban Revolutionary Party he had designed, and travelled the United States, Central America and the Caribbean raising funds and unifying the exile community. He was killed in action at the Battle of Dos Ríos on 19 May 1895.',
        'Four collections of Martí’s writings appear in this database, and all four were banned in Argentina under the military dictatorship’s “Proceso de Reorganización Nacional” between 1976 and 1983: Nuestra América y otros escritos, Cuba, nuestra América y los Estados Unidos, Martí y la primera revolución cubana, and Las seductoras. Each is catalogued in the Biblioteca de Libros Prohibidos compiled by the Archivo Provincial de la Memoria in Córdoba.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/Jos%C3%A9_Mart%C3%AD',
      wikidata_id: 'Q103285',
      social_links: { viaf: 'https://viaf.org/viaf/73865537' },
      birth_month: 1,
      birth_day: 28,
      links_checked_at: NOW,
    },
  },
  {
    id: 6995,
    why: 'Cristina Alger (pick 2026-09-13) — bio MISSING, no links, no birth_year. She has no Wikipedia article, so the bio comes from her publisher page at Penguin Random House. Identity confirmed on two independent handles: Wikidata Q66429496 stores P9802 (Penguin Random House author ID) = 230800, which is exactly the page fetched, and its occupations (writer, financial analyst, jurist) match the publisher bio (financial analyst, corporate attorney, writer). birth_year 1980 from P569 (precision 9, referenced); no month/day. VIAF 185675052. No P856 and no reachable personal domain (cristinaalger.com does not resolve), so website_url stays null. photo_url NULLED: it pointed at the Wikimedia Commons mug shot of Bernard Madoff — presumably matched off her Madoff-era novel The Darlings. No free photo of her exists on Commons (no P18).',
    patch: {
      bio: [
        'Cristina Alger (born 1980) is an American novelist, and the New York Times bestselling author of Girls Like Us, The Banker’s Wife, The Darlings and This Was Not the Plan. A graduate of Harvard College and NYU School of Law, she worked as a financial analyst and as a corporate attorney before becoming a writer. She lives in Connecticut with her husband and children.',
        'Girls Like Us (2019) is the title of hers recorded in this database, with seven bans and restrictions, all in the United States and all logged in PEN America’s school-book-ban indexes: it was removed in Keller Independent School District in Texas and Indian River County School District in Florida in 2021, in Collier County Public Schools in Florida in 2023 and in Mid-Prairie Community School District in Iowa in 2024, and restricted in Keller Independent School District in 2022 and in Elkhorn Area School District in Wisconsin and Escambia County Public Schools in Florida in 2023.',
      ].join('\n\n'),
      bio_source_type: 'manual',
      bio_source_url: 'https://www.penguinrandomhouse.com/authors/230800/cristina-alger/',
      wikidata_id: 'Q66429496',
      birth_year: 1980,
      social_links: { viaf: 'https://viaf.org/viaf/185675052' },
      photo_url: null,
      links_checked_at: NOW,
    },
  },
  {
    id: 5565,
    why: 'Tuppy Owens (pick 2026-09-14) — bio was one THIN sentence, UNSTAMPED, no links. Wikidata Q7853600 (P31=Q5, P569 1944-11-12 and P570 2025-02-28 match our birth_year 1944 / death_year 2025) + VIAF 36541051; birthday 12 November. She has no living website (her official site survives only in the Wayback Machine) and no socials in Wikidata, so website_url stays null.',
    patch: {
      bio: [
        'Rosalind Mary “Tuppy” Owens (12 November 1944 – 28 February 2025) was an English writer, sex therapist, campaigner and disability-rights activist. Born in Cambridge, she took a degree in zoology at Exeter University, worked in ecology in Africa and Trinidad, and was a scientific administrator at the Natural Environment Research Council before setting up a sex-education publishing company in the late 1960s, which she ran as a thriving business from her flat in Mayfair.',
        'From 1972 to 1995 she wrote and published The Sex Maniac’s Diary, later retitled The Safer Sex Maniac’s Diary, which gave the public the first visual instructions on putting on a condom securely and carried safer-sex advice at the start of the HIV epidemic. She began lecturing on sex in 1974 and in 1979 founded the Outsiders Club, which helps disabled people find partners and which she ran voluntarily for the rest of her life. To answer members’ questions accurately she trained as a sex therapist at St George’s Hospital Medical School, taking a diploma in Human Sexuality in 1986, and was later given an honorary doctorate by the Institute for Advanced Study of Human Sexuality in San Francisco. She set up the TLC Trust website, founded the Sexual Health and Disability Alliance in 2005, produced the Sexual Respect Tool Kit, and published Supporting Disabled People with their Sexual Lives with Claire de Than in 2014. In 2009 the Family Planning Association named her one of the eighty most influential achievers in family planning, and in 2015 she won a Lifetime Achievement Award at the European Lifestyles Awards. She died of vascular dementia in Scotland on 28 February 2025, aged 80.',
        'Three of her books are recorded in this database, all of them classified by New Zealand’s Indecent Publications Tribunal: Step by Step Instruction in Sexual Technique was ruled indecent in 1972 and Summer Holiday Sex Manual in 1975, while Love in the Open Air, published in London in 1970, was restricted to readers over 18 in 1972.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/Tuppy_Owens',
      wikidata_id: 'Q7853600',
      social_links: { viaf: 'https://viaf.org/viaf/36541051' },
      birth_month: 11,
      birth_day: 12,
      links_checked_at: NOW,
    },
  },
]

// ── books ──────────────────────────────────────────────────────────────────
const BOOK_PATCHES: Patch[] = [
  {
    id: 1155,
    why: 'Assassination Classroom, Vol. 3 (pick 2026-09-09) — no ISBN at all, so no buy links, and first_published_year carried the 2025 importer stamp. Wikipedia\'s volume list gives volume 3 the Viz Media English ISBN 978-1-4215-7609-1, released 7 April 2015 (Japanese original 4 March 2013); OpenLibrary work OL19999208W confirms the same ISBN for "Time for a Transfer Student", Viz Media 2015, and the Bookshop.org page for that ISBN reads "Assassination Classroom, Vol. 3 … VIZ Media LLC, April 07, 2015, 192 pages" (HTTP 200, so the affiliate deep link resolves). No other row holds this ISBN, so the stale dup_collision status is cleared. Sibling rows use the English-edition year (vol 1 = 2014, vol 10 = 2016, vol 18 = 2017), so 2015 it is. cover_url also replaced: it showed the *Volume 1* Wikipedia jacket; the OpenLibrary cover for this ISBN is the volume 3 jacket (verified visually — pink, numbered 3).',
    patch: {
      isbn13: '9781421576091',
      isbn_status: 'valid',
      isbn_checked_at: NOW,
      bookshop_isbn13: '9781421576091',
      bookshop_status: 'valid',
      bookshop_checked_at: NOW,
      first_published_year: 2015,
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781421576091-L.jpg',
      cover_status: 'valid',
      cover_checked_at: NOW,
    },
  },
  {
    id: 439,
    why: 'Fly on the Wall (pick 2026-09-10) — description_ban was 76 characters and asserted reasons ("sexual content and privacy-related themes") that none of our sources state. Rewritten from our own ten ban rows (PEN America indexes 2021-22 … 2024-25), which give district, state, year and action but no reason for this title.',
    patch: {
      description_ban:
        'Fly on the Wall has been pulled from ten American school districts between 2021 and 2025: removed outright in Charlotte County Public Schools and Lee County Schools in Florida and in Rutherford County Schools in Tennessee, and restricted or pulled pending review in Seminole, Highlands, Okaloosa, Indian River, Santa Rosa and Walton counties in Florida and in Pleasant Valley School District in Pennsylvania. Every record comes from PEN America’s Index of School Book Bans, which lists the district, year and action for this title but no stated reason.',
    },
  },
  {
    id: 14018,
    why: 'Nuestra América y otros escritos (pick 2026-09-12) — description_book MISSING. Written from the Spanish Wikipedia article on the title essay (es.wikipedia.org/wiki/Nuestra_América), translated to English; the edition detail matches our own cover and the OpenLibrary edition record for our ISBN (Ediciones El Andariego, Buenos Aires). first_published_year deliberately left NULL — see the report; the 2006 El Andariego edition post-dates the 1976 ban and this anthology has no single first-publication year.',
    patch: {
      description_book:
        'Nuestra América y otros escritos gathers the essays and political writing of the Cuban poet and independence leader José Martí around his best-known essay, “Nuestra América”. That essay first appeared on 1 January 1891 in the Revista Ilustrada in New York and on 30 January in the Mexican paper El Partido Liberal, written just after the close of the first International Conference of American States as a synthesis of the arguments Martí had been making in his reporting on it. It calls on the peoples of Spanish America to unite, to know themselves, and to govern by the realities of their own countries rather than by constitutions and systems imported from elsewhere — “there is no battle between civilisation and barbarity, but between false learning and nature” — and it warns against the ambitions of the United States, whose people Martí refuses the sole right to the name America. The Argentine edition recorded here was published in Buenos Aires by Ediciones El Andariego.',
      description_source_type: 'wikipedia_translated',
      description_source_url: 'https://es.wikipedia.org/wiki/Nuestra_Am%C3%A9rica',
    },
  },
  {
    id: 7282,
    why: 'Love in the Open Air (pick 2026-09-14) — CONTAMINATED ROW, cleared. cover_url was OpenLibrary cover 6233865, which is the title page of "Dendrologia Britannica, or Trees and Shrubs that will live in the open air of Britain" (P. W. Watson, 1825) — a title-string match on "open air". description_book was the jacket blurb of Nora Roberts\' "Dance Upon the Air" (Three Sisters Island). isbn13 9780750519007 resolves to nothing in OpenLibrary and Bookshop had already marked it not_found; it is not Owens\' 1970 Cand Haven book. All three nulled rather than replaced: no cover or blurb for the real book is available on any allowed host. description_ban rewritten to match the source, which records a restriction, not a ban.',
    patch: {
      cover_url: null,
      cover_status: null,
      description_book: null,
      isbn13: null,
      isbn_status: null,
      bookshop_isbn13: null,
      bookshop_status: null,
      description_ban:
        'Love in the Open Air, published in London by Cand Haven in 1970, was classified by New Zealand’s Indecent Publications Tribunal in 1972 and restricted to readers aged 18 and over. Two more of Tuppy Owens’ sex-education titles went further: Step by Step Instruction in Sexual Technique was ruled indecent by the same tribunal in 1972, and Summer Holiday Sex Manual in 1975.',
    },
  },
]

// ── ban-row fix ────────────────────────────────────────────────────────────
const BAN_PATCHES: Patch[] = [
  {
    id: 5820,
    why: 'ban 5820 (book 7282, Love in the Open Air, NZ 1972) was imported as action_type "banned". Its own source — the Wikipedia list of books banned in New Zealand, citing Perry 1980 p.46, which is the ban_source_links row for this record — says "Restricted 18 in 1972", i.e. an R18 classification, not a prohibition. Corrected to restricted, with the source wording stored on the row.',
    patch: {
      action_type: 'restricted',
      description:
        'Classified by the Indecent Publications Tribunal in 1972 and restricted to readers aged 18 and over ("Restricted 18 in 1972", per Perry 1980, p. 46).',
    },
  },
]

// ── slug aliases (for the José Martí rename) ────────────────────────────────
const ALIASES: Array<{ slug: string; author_id: number }> = [
  { slug: 'marti-jose', author_id: 9367 },
]

async function main() {
  const sb = adminClient()
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN (pass --apply to write) ===')

  // gates
  for (const a of AUTHORS) {
    const p = a.patch.photo_url
    if (typeof p === 'string' && !isAllowedImageUrl(p)) throw new Error(`photo_url rejected: ${p}`)
  }
  for (const b of BOOK_PATCHES) {
    const c = b.patch.cover_url
    if (typeof c === 'string' && !isAllowedImageUrl(c)) throw new Error(`cover_url rejected: ${c}`)
    const d = b.patch.description_ban
    if (typeof d === 'string') {
      const g = descriptionBanQualityGate(d)
      console.log(`gate book ${b.id} description_ban:`, JSON.stringify(g))
    }
  }

  // pre-check: the new José Martí slug must be free
  const { data: slugTaken, error: eSlug } = await sb.from('authors').select('id, display_name').eq('slug', 'jose-marti')
  if (eSlug) throw eSlug
  if ((slugTaken ?? []).some(r => Number((r as { id: number }).id) !== 9367)) {
    throw new Error(`slug jose-marti already taken: ${JSON.stringify(slugTaken)}`)
  }

  let authorRows = 0
  for (const a of AUTHORS) {
    const sel = ['id', 'slug', 'display_name', ...Object.keys(a.patch)].filter((v, i, s) => s.indexOf(v) === i).join(',')
    const { data: before, error: e1 } = await sb.from('authors').select(sel).eq('id', a.id).single()
    if (e1) throw e1
    console.log(`\n--- author ${a.id} — ${a.why}`)
    console.log('BEFORE:', JSON.stringify(before))
    if (!APPLY) {
      console.log('AFTER : (dry run) would set', JSON.stringify(Object.keys(a.patch)))
      continue
    }
    const { data: after, error: e2 } = await sb
      .from('authors')
      .update({ ...a.patch, updated_at: NOW })
      .eq('id', a.id)
      .select(sel)
    if (e2) throw e2
    authorRows += after?.length ?? 0
    console.log('AFTER :', JSON.stringify(after?.[0]))
  }

  let bookRows = 0
  for (const b of BOOK_PATCHES) {
    const sel = ['id', 'title', ...Object.keys(b.patch)].filter((v, i, s) => s.indexOf(v) === i).join(',')
    const { data: before, error: e1 } = await sb.from('books').select(sel).eq('id', b.id).single()
    if (e1) throw e1
    console.log(`\n--- book ${b.id} — ${b.why}`)
    console.log('BEFORE:', JSON.stringify(before))
    if (!APPLY) {
      console.log('AFTER : (dry run)')
      continue
    }
    const { data: after, error: e2 } = await sb
      .from('books')
      .update({ ...b.patch, updated_at: NOW })
      .eq('id', b.id)
      .select(sel)
    if (e2) throw e2
    bookRows += after?.length ?? 0
    console.log('AFTER :', JSON.stringify(after?.[0]))
  }

  let banRows = 0
  for (const p of BAN_PATCHES) {
    const sel = ['id', 'book_id', ...Object.keys(p.patch)].filter((v, i, s) => s.indexOf(v) === i).join(',')
    const { data: before, error: e1 } = await sb.from('bans').select(sel).eq('id', p.id).single()
    if (e1) throw e1
    console.log(`\n--- ban ${p.id} — ${p.why}`)
    console.log('BEFORE:', JSON.stringify(before))
    if (!APPLY) {
      console.log('AFTER : (dry run)')
      continue
    }
    const { data: after, error: e2 } = await sb.from('bans').update(p.patch).eq('id', p.id).select(sel)
    if (e2) throw e2
    banRows += after?.length ?? 0
    console.log('AFTER :', JSON.stringify(after?.[0]))
  }

  let aliasRows = 0
  for (const al of ALIASES) {
    if (!APPLY) {
      console.log(`\n--- alias (dry run) ${al.slug} → ${al.author_id}`)
      continue
    }
    const { data, error } = await sb
      .from('author_slug_aliases')
      .upsert({ ...al, source: 'merge' }, { onConflict: 'slug' })
      .select()
    if (error) throw error
    aliasRows += data?.length ?? 0
    console.log(`\n--- alias ${al.slug} → ${al.author_id}:`, JSON.stringify(data))
  }

  console.log(
    `\n== rows: authors ${authorRows}, books ${bookRows}, bans ${banRows}, author_slug_aliases ${aliasRows}`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
