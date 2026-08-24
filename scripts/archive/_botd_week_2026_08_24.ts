/**
 * _botd_week_2026_08_24.ts — one-off pre-flight fixes for the book-of-the-day
 * picks 2026-08-24 … 2026-08-31, produced by the /botd-week skill.
 *
 * Every bio below is written from ONE fetched source (recorded in
 * bio_source_url); every link comes from the author's Wikidata entity or their
 * own site; every closing censorship sentence is grounded in our own bans rows.
 *
 * Read-only by default; pass --apply to write.
 */
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { isApply } from './lib/cli'

const NOW = new Date().toISOString()
const APPLY = isApply()

type AuthorPatch = { id: number; why: string; patch: Record<string, unknown> }

const AUTHORS: AuthorPatch[] = [
  {
    id: 619,
    why: 'Dương Thu Hương — bio UNSTAMPED + thin/editorialising; rewritten from en.wikipedia, stamped',
    patch: {
      bio: [
        'Dương Thu Hương (born 1947 in Thái Bình, in northern Vietnam) is a Vietnamese novelist and political dissident. At twenty, while a student at the Vietnamese Ministry of Culture’s Arts College, she volunteered for a women’s youth brigade and spent seven years at the front in Bình Trị Thiên, the most heavily bombarded region of the war — performing for North Vietnamese troops, tending the wounded and burying the dead. She was one of three survivors out of the forty volunteers in her group, and was at the front again during China’s 1979 attack on Vietnam.',
        'After reunification in 1975 she became increasingly outspoken about corruption and repression under the Communist government. She was expelled from the party in 1989, denied the right to travel abroad, and briefly imprisoned in 1991. Her early novels — Journey in Childhood (1985), Beyond Illusions (1987), Paradise of the Blind (1988) and The Lost Life (1989) — were bestsellers in Vietnam before they were banned, and Paradise of the Blind became the first Vietnamese novel published in English in the United States. Novel Without a Name, Memories of a Pure Spring and No Man’s Land followed, most of them appearing abroad. She was made a Chevalier des Arts et des Lettres in 1994 and has since received the Prince Claus Award (2001), the Oxfam Novib/PEN Award (2005), the Grand prix des lectrices de Elle (2007) and the Prix mondial Cino Del Duca (2023). She moved to Paris in 2006.',
        'Her work appears in no Vietnamese anthology, and readers at home reach it mainly through smuggled copies. Five of her novels — Beyond Illusions, Paradise of the Blind, Novel Without a Name, Memories of a Pure Spring and No Man’s Land — are recorded as banned in Vietnam in this database.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/D%C6%B0%C6%A1ng_Thu_H%C6%B0%C6%A1ng',
      links_checked_at: NOW,
    },
  },
  {
    id: 1766,
    why: 'Harry Woodgate — bio MISSING; written from their own official author biography. Photo was Jonathan Woodgate (footballer) → nulled.',
    patch: {
      bio: [
        'Harry Woodgate (pronouns: they/them) is a British author and illustrator of children’s books. They write and illustrate inclusive, uplifting stories intended to encourage young readers to be compassionate, creative, curious and proud of what makes them unique.',
        'Their debut author-illustrator picture book, Grandad’s Camper, won Best Illustrated Book at the Waterstones Children’s Book Prize in 2022 and Children’s Illustrated Book of the Year at the British Book Awards in 2023. It also received a Stonewall Book Award Honor from the American Library Association and was nominated for the CILIP Yoto Kate Greenaway Medal for Illustration. Woodgate’s other books include Grandad’s Pride, The Butterfly House, Timid and the Cinnamon Crumb: Baking Detective series, and their work has been recognised by The Week Junior Book Awards, the Little Rebels Award and the Diverse Book Awards. Alongside their own books they have illustrated for clients including Andersen Press, Penguin Random House, Walker Books, The Sunday Times Magazine and The Washington Post.',
        'Both Grandad books are recorded as banned in this database: Grandad’s Camper was gazetted by Malaysia’s Ministry of Home Affairs in 2025 under the Printing Presses and Publications Act and removed by Clay County School District in Florida in 2022, and Grandad’s Pride was removed by Stillwater Area School District in Minnesota in 2025.',
      ].join('\n\n'),
      bio_source_type: 'manual',
      bio_source_url: 'https://www.harrywoodgate.com/aboutcontact',
      wikidata_id: 'Q130897456',
      website_url: 'https://www.harrywoodgate.com/',
      social_links: { viaf: 'https://viaf.org/viaf/14159761099107880722' },
      photo_url: null,
      birth_country: 'United Kingdom',
      links_checked_at: NOW,
    },
  },
  {
    id: 5977,
    why: 'Peter Mercurio — bio MISSING; written from his own about page + en.wikipedia "Our Subway Baby". Photo was an El Mercurio newspaper front page → nulled.',
    patch: {
      bio: [
        'Peter Mercurio is an American writer, playwright and theatre producer based in New York City. In August 2000 his partner, Danny Stewart, found an abandoned newborn on the floor of the Union Square subway station; the couple adopted the boy, Kevin, in December 2002, and Mercurio told the story in “We Found Our Son in the Subway,” a 2013 essay for The New York Times that was reprinted in magazines around the world.',
        'He turned that story into Our Subway Baby, a picture book illustrated by Leo Espinosa and published in September 2020. It was a finalist for the Lambda Literary Award for Children’s and Young Adult Literature and made the American Library Association’s Rainbow Book List. His memoir There was named a Best Indie Book of 2025 by Kirkus Reviews, which gave it a starred review. Mercurio has also written several plays, among them Two Spoons, Red & Tan Line and Yesterday’s News, and is the founder and artistic director of the nonprofit theatre company Other Side Productions.',
        'Our Subway Baby is recorded in this database as removed from two American school districts: St. John’s County School District in Florida in 2023 and Clear Creek-Amana Community School District in Iowa in 2024.',
      ].join('\n\n'),
      bio_source_type: 'manual',
      bio_source_url: 'https://www.petermercurio.com/about/',
      wikidata_id: 'Q140585021',
      website_url: 'https://www.petermercurio.com/',
      social_links: {
        instagram: 'https://www.instagram.com/petemercurionyc/',
        facebook: 'https://www.facebook.com/petemercurionyc',
      },
      photo_url: null,
      birth_country: 'United States',
      links_checked_at: NOW,
    },
  },
  {
    id: 2573,
    why: 'Rob Thomas (writer, Q2154158) — bio MISSING. Photo was Rob Thomas the MUSICIAN (Q754094, Shankbone/Tribeca 2010) → replaced with the writer’s Wikidata P18.',
    patch: {
      bio: [
        'Robert James Thomas (born August 15, 1965) is an American novelist, screenwriter, producer and director. He was born in Sunnyside, Washington, graduated from San Marcos High School in Texas in 1983, went to Texas Christian University on a football scholarship, then transferred to the University of Texas at Austin, where he took a BA in history in 1987.',
        'Before he wrote fiction he taught high-school journalism in San Antonio and Austin, and from 1993 to 1995 he worked for Channel One News — an experience that fed his 1998 novel Satellite Down. His debut young adult novel, Rats Saw God, appeared in 1996, followed by Slave Day (1997), Doing Time: Notes from the Undergrad (1997), Satellite Down (1998) and Green Thumb (1999). Thomas then moved into television, creating Veronica Mars (2004–2007, 2019), co-developing 90210 and co-creating Party Down and iZombie; he also directed and co-wrote the 2014 Veronica Mars film, funded by a record-setting Kickstarter campaign backed by 88,000 people.',
        'Rats Saw God is recorded in this database as removed from three American school districts: Collier County and Escambia County in Florida in 2023, and Monroe County Schools in Tennessee in 2025.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/Rob_Thomas_(writer)',
      wikidata_id: 'Q2154158',
      social_links: {
        twitter: 'https://x.com/RobThomas',
        viaf: 'https://viaf.org/viaf/79176532',
      },
      photo_url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Rob_Thomas_by_Gage_Skidmore.jpg/500px-Rob_Thomas_by_Gage_Skidmore.jpg',
      birth_year: 1965,
      birth_month: 8,
      birth_day: 15,
      birth_country: 'United States',
      links_checked_at: NOW,
    },
  },
  {
    id: 1294,
    why: 'Gaby Dunn (Gabe Dunn, Q5516152) — bio UNSTAMPED (was a near-verbatim Wikipedia lead); rewritten and stamped, links + birthday + Commons photo added.',
    patch: {
      bio: [
        'Gabriel Shane Dunn (born June 1, 1988), who published as Gaby Dunn, is an American writer, podcaster, actor and filmmaker. He studied multimedia journalism at Emerson College, graduating in 2009, and worked night shifts as a crime reporter for The Boston Globe while still a student.',
        'Dunn first drew wide attention with 100 Interviews, a Tumblr project begun in 2010 in which he set out to publish conversations with a hundred different people; The Village Voice named it the best Tumblr of the year, and it led to a New York Times column profiling internet personalities. He was an early member of BuzzFeed Video’s on-camera team before leaving in 2015 to concentrate on Just Between Us, the YouTube show and podcast he has hosted with Allison Raskin since 2014, and on the personal-finance podcast Bad with Money, which launched in 2016.',
        'His debut young adult novel, I Hate Everyone but You, written with Raskin and published in 2017, reached The New York Times bestseller list; a sequel, Please Send Help, followed in 2019. He has also published two books about money and the queer crime graphic novel Bury the Lede (2019), illustrated by Claire Roe and drawn from his own years as a young reporter. Both of his novels with Raskin are recorded as banned in this database, all in 2024: I Hate Everyone but You in Wilson County Schools in Tennessee and North East Independent School District in Texas, and Please Send Help in Katy Independent School District in Texas.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/Gabe_Dunn',
      wikidata_id: 'Q5516152',
      social_links: {
        instagram: 'https://www.instagram.com/gabesdunn/',
        viaf: 'https://viaf.org/viaf/316150468246604170485',
      },
      photo_url:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Gabe_Dunn_Vlogbrothers_2016.jpg/500px-Gabe_Dunn_Vlogbrothers_2016.jpg',
      birth_month: 6,
      birth_day: 1,
      links_checked_at: NOW,
    },
  },
  {
    id: 877,
    why: 'Arwen Elys Dayton — bio carried the importer TEMPLATE tail; rewritten from en.wikipedia, stamped, links + birth_year (Wikidata P569, sourced to SFE) added.',
    patch: {
      bio: [
        'Arwen Elys Dayton (born 1974) is an American writer of science fiction, fantasy and speculative fiction. Named after the elf in The Lord of the Rings, she began writing stories at seven or eight. She finished high school at sixteen, spent a year tutoring in Europe, and on returning to the United States took a job writing magazine articles rather than enrolling at Stanford; that work led to a writing post on the PBS series The Eddie Files, where she started her first novel.',
        'That book, Sovereign’s Hold, was published in 2000. Resurrection (2012), which sets one warrior’s mission to save her people against the backdrop of ancient Egypt, became a Kindle bestseller, and the Seeker trilogy — Seeker (2015), Traveler (2016) and Disruptor (2017), with the novella The Young Dread in between — brought her a wider readership; Columbia Pictures bought the film rights to Seeker in 2013. Stronger, Faster, and More Beautiful, six linked stories about how far people will go in pursuit of physical perfection, appeared in December 2018 and drew starred reviews from Kirkus Reviews and Publishers Weekly. Tom Shippey of The Wall Street Journal named it one of the best science fiction novels of 2018 and Constance Grady of Vox one of the year’s sixteen best books. Dayton co-founded the production company Getaway Entertainment in 2024 and lives in Oregon’s Willamette Valley.',
        'Stronger, Faster, and More Beautiful is recorded in this database as removed from five Florida school districts between 2023 and 2025: Collier, Clay, Hillsborough, Union and Volusia counties.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/Arwen_Elys_Dayton',
      wikidata_id: 'Q61731671',
      website_url: 'https://www.arwenelysdayton.com/',
      social_links: {
        twitter: 'https://x.com/arwenelysdayton',
        instagram: 'https://www.instagram.com/arwenelysdayton/',
        facebook: 'https://www.facebook.com/arwenelysdaytonauthor',
        viaf: 'https://viaf.org/viaf/306358945',
      },
      birth_year: 1974,
      links_checked_at: NOW,
    },
  },
  // --- book 6522: library-catalogue split "Han, Theodore., Li, John." ---------
  // OpenLibrary/UC Berkeley IEAS record confirms the two real compilers:
  // Theodore Han and John Li. 4606 ("Theodore.") and 4608 ("John.") are linked
  // to book 6522 ONLY, so they can carry the real names. 4605 ("Han") and 4607
  // ("Li") are shared surname-collapse rows on 6-7 other books — untouched, only
  // their 6522 link is removed. 4608's photo was John Sterling → nulled.
  {
    id: 4606,
    why: 'split-author repair: "Theodore." → "Theodore Han" (compiler of the 1992 UC Berkeley IEAS chronology)',
    patch: { display_name: 'Theodore Han', slug: 'theodore-han' },
  },
  {
    id: 4608,
    why: 'split-author repair: "John." → "John Li"; wrong-namesake photo (John Sterling) nulled',
    patch: { display_name: 'John Li', slug: 'john-li', photo_url: null },
  },
]

const BOOK_PATCHES: Array<{ id: number; why: string; patch: Record<string, unknown> }> = [
  {
    id: 6522,
    why: 'first_published_year from OpenLibrary (Institute of East Asian Studies, UC Berkeley, June 1992); ban blurb credited the collapsed surname "Han" only',
    patch: {
      first_published_year: 1992,
      description_ban:
        'In 2023, the Hong Kong government banned "Tiananmen Square, Spring 1989: A Chronology of the Chinese Democracy Movement" by Theodore Han and John Li, citing its political content as the official reason for the prohibition. The action reflects ongoing restrictions on materials related to the pro-democracy movement in China.',
    },
  },
]

const UNLINK: Array<[number, number]> = [
  [6522, 4605],
  [6522, 4607],
]

const ALIASES: Array<{ slug: string; author_id: number }> = [
  { slug: 'theodore', author_id: 4606 },
  { slug: 'john', author_id: 4608 },
]

async function main() {
  const sb = adminClient()
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN (pass --apply to write) ===')

  // image-host gate
  for (const a of AUTHORS) {
    const p = a.patch.photo_url
    if (typeof p === 'string' && !isAllowedImageUrl(p)) throw new Error(`photo_url rejected by isAllowedImageUrl: ${p}`)
  }

  let authorRows = 0
  for (const a of AUTHORS) {
    const cols = Object.keys(a.patch)
    const sel = ['id', 'slug', 'display_name', ...cols].filter((v, i, s) => s.indexOf(v) === i).join(',')
    const { data: before, error: e1 } = await sb.from('authors').select(sel).eq('id', a.id).single()
    if (e1) throw e1
    console.log(`\n--- author ${a.id} — ${a.why}`)
    console.log('BEFORE:', JSON.stringify(before))
    if (!APPLY) { console.log('AFTER : (dry run) would set', JSON.stringify(Object.keys(a.patch))); continue }
    const { data: after, error: e2 } = await sb.from('authors').update({ ...a.patch, updated_at: NOW }).eq('id', a.id).select(sel)
    if (e2) throw e2
    authorRows += after?.length ?? 0
    console.log('AFTER :', JSON.stringify(after?.[0]))
  }

  let bookRows = 0
  for (const b of BOOK_PATCHES) {
    const sel = ['id', 'title', ...Object.keys(b.patch)].join(',')
    const { data: before, error: e1 } = await sb.from('books').select(sel).eq('id', b.id).single()
    if (e1) throw e1
    console.log(`\n--- book ${b.id} — ${b.why}`)
    console.log('BEFORE:', JSON.stringify(before))
    if (!APPLY) { console.log('AFTER : (dry run)'); continue }
    const { data: after, error: e2 } = await sb.from('books').update({ ...b.patch, updated_at: NOW }).eq('id', b.id).select(sel)
    if (e2) throw e2
    bookRows += after?.length ?? 0
    console.log('AFTER :', JSON.stringify(after?.[0]))
  }

  const { data: baBefore } = await sb.from('book_authors').select('book_id,author_id,role').eq('book_id', 6522)
  console.log('\n--- book_authors 6522 BEFORE:', JSON.stringify(baBefore))
  let unlinked = 0
  if (APPLY) {
    for (const [bookId, authorId] of UNLINK) {
      const { data, error } = await sb.from('book_authors').delete().eq('book_id', bookId).eq('author_id', authorId).select()
      if (error) throw error
      unlinked += data?.length ?? 0
    }
    for (const al of ALIASES) {
      const { error } = await sb.from('author_slug_aliases').upsert({ ...al, source: 'merge' }, { onConflict: 'slug' })
      if (error) throw error
    }
    const { data: baAfter } = await sb.from('book_authors').select('book_id,author_id,role').eq('book_id', 6522)
    console.log('--- book_authors 6522 AFTER :', JSON.stringify(baAfter))
  }

  console.log(`\n== rows: authors ${authorRows}, books ${bookRows}, book_authors unlinked ${unlinked}, aliases ${APPLY ? ALIASES.length : 0}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
