/**
 * _botd_week_2026_08_31.ts — one-off pre-flight fixes for the book-of-the-day
 * picks 2026-08-31 … 2026-09-07, produced by the /botd-week skill.
 *
 * Every bio below is written from ONE fetched source (recorded in
 * bio_source_url); every link comes from the author's Wikidata entity (probed
 * 2026-09-01) or their own verified site; every closing censorship sentence is
 * grounded in our own bans rows for that author.
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
    id: 469,
    why: 'Donald (Serrell) Thomas — bio MISSING, no wikidata_id, no birth data. Identified via en.wikipedia (biographies incl. the Marquis de Sade) + exact ISBN match 0-8212-0653-2 → our book 647. VIAF deliberately omitted (two competing clusters, see report).',
    patch: {
      bio: [
        'Donald Serrell Thomas (18 July 1934 – 20 January 2022) was a British writer. His fiction was chiefly Victorian-era historical crime and detective writing, and alongside it he published books of factual crime and criminals — several of them academic studies of the history of crime in London — seven biographies, two volumes of poetry, and edited editions of John Dryden and the Pre-Raphaelites. Some of his earlier novels appeared under the pseudonym Francis Selwyn, and he also wrote as Richard Manton.',
        'Thomas was born in Weston-super-Mare, Somerset, was educated at Queen’s College, Taunton, completed his National Service in the Royal Air Force between 1953 and 1955, and went up to Balliol College, Oxford in 1955. He held a personal chair as Professor Emeritus of English Literature at Cardiff University and, after retiring, stayed on there as an associate research professor; in 2005 he gave the university’s Special Collections a selection of the research papers behind his books on the Victorian and wartime underworld. He won the Eric Gregory Award in 1962 for the poetry collection Points of Contact; his Robert Browning biography A Life Within Life was a runner-up for the Whitbread Prize and The Victorian Underworld was shortlisted for the Gold Dagger. He is perhaps best known now for the Sherlock Holmes pastiches that began with The Secret Cases of Sherlock Holmes in 1997. He died on 20 January 2022, aged 87.',
        'Censorship was one of Thomas’s own subjects: his 1969 study A Long Time Burning: The History of Literary Censorship in England was followed almost forty years later by Freedom’s Frontier: Censorship in Modern Britain (2007). His biography of the Marquis de Sade, published in 1976 as The Marquis de Sade: A New Biography, is recorded in this database as banned in Australia that same year.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/Donald_Serrell_Thomas',
      wikidata_id: 'Q5295131',
      birth_year: 1934,
      birth_month: 7,
      birth_day: 18,
      death_year: 2022,
      birth_country: 'United Kingdom',
      links_checked_at: NOW,
    },
  },
  {
    id: 55,
    why: 'Bret Easton Ellis — bio UNSTAMPED and a near-verbatim Wikipedia lead; rewritten and stamped. Wikidata Q241583 (P569 1964-03-07 matches our birth_year 1964): website (verified official, title "Bret Easton Ellis - Official"), X/Instagram/Facebook, VIAF, birthday.',
    patch: {
      bio: [
        'Bret Easton Ellis (born March 7, 1964) is an American novelist and screenwriter, one of the writers labelled the Literary Brat Pack and a self-described satirist whose trademark is the expression of extreme acts and opinions in an affectless style. He was born in Los Angeles and raised in Sherman Oaks, in the San Fernando Valley; his father was a property developer, his mother a homemaker, and they divorced in 1982. He graduated from the Buckley School and went on to Bennington College in Vermont, where he studied music before gravitating to writing and became friends with Donna Tartt and Jonathan Lethem.',
        'He finished his first novel at Bennington, and Simon & Schuster published Less than Zero in 1985, when he was twenty-one; the story of disaffected, wealthy Los Angeles teenagers sold 50,000 copies in its first year. The Rules of Attraction followed in 1987. His third novel, American Psycho (1991), narrated by the Wall Street mergers-and-acquisitions specialist and serial killer Patrick Bateman, is his most controversial and most successful book: Simon & Schuster withdrew it after protests from the National Organization for Women and others, it appeared instead from Vintage, and the literary establishment condemned it on publication as overly violent and misogynistic before it grew into a cult and critical success. Ellis went on to publish the story collection The Informers (1994), Glamorama (1998), the pseudo-memoir and ghost story Lunar Park (2005), Imperial Bedrooms (2010), the essay collection White (2019) and the fictionalised memoir The Shards (2023); he wrote the screenplay for The Canyons (2013) and has hosted The Bret Easton Ellis Podcast since 2013. He publicly identified as a gay man in a 2012 op-ed for The Daily Beast.',
        'Three of Ellis’s books appear in this database, and American Psycho carries almost all of the record: national bans in Australia and New Zealand in 1991 and in Germany in 1995, plus bans or restrictions in twelve American school districts between 2023 and 2025, across Florida, Georgia, Pennsylvania, Texas and Utah. Less than Zero and The Rules of Attraction are recorded as challenged in the United States shortly after publication.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/Bret_Easton_Ellis',
      wikidata_id: 'Q241583',
      website_url: 'https://www.breteastonellis.com/',
      social_links: {
        twitter: 'https://x.com/BretEastonEllis',
        instagram: 'https://www.instagram.com/breteastonellis/',
        facebook: 'https://www.facebook.com/BretEastonEllis',
        viaf: 'https://viaf.org/viaf/49243962',
      },
      birth_month: 3,
      birth_day: 7,
      links_checked_at: NOW,
    },
  },
  {
    id: 2535,
    why: 'William Shakespeare — bio carried the importer TEMPLATE tail; extended from the en.wikipedia lead and stamped. Wikidata Q692 (P569 1564, P570 1616 match our row) + VIAF; birth_month/day = the traditional 23 April (Wikipedia "c. 23 April 1564").',
    patch: {
      bio: [
        'William Shakespeare (c. 23 April 1564 – 23 April 1616) was an English playwright, poet and actor. He is widely regarded as the greatest writer in the English language and the world’s pre-eminent dramatist, and is often called England’s national poet and the “Bard of Avon”. His extant works, including collaborations, consist of some 39 plays, 154 sonnets, three long narrative poems and a few other verses, some of uncertain authorship. His plays have been translated into every major living language and are performed more often than those of any other playwright.',
        'Shakespeare was born and raised in Stratford-upon-Avon, Warwickshire. At eighteen he married Anne Hathaway, with whom he had three children: Susanna, and the twins Hamnet and Judith. Sometime between 1585 and 1592 he began a successful career in London as an actor, writer and part-owner of the playing company known as the Lord Chamberlain’s Men, later the King’s Men. He produced most of his known work between 1589 and 1613 — first comedies and histories, then, until 1608, mainly tragedies, among them Hamlet, Othello, King Lear and Macbeth, and finally the late tragicomedies including The Winter’s Tale and The Tempest. Around 1613 he appears to have retired to Stratford, where he died three years later. Few records of his private life survive. In 1623 his fellow actors John Heminges and Henry Condell published the First Folio, the posthumous collected edition containing 36 of his plays.',
        'Eight Shakespeare titles carry censorship records in this database, four centuries apart. The oldest two are English: the deposition scene is absent from the 1597 quarto of Richard II, traditionally attributed to Elizabethan censorship, and King Lear was kept off the English stage from 1788 to 1820, apparently in deference to the insanity of George III. The rest are recent and American — Romeo and Juliet restricted in Keller Independent School District in Texas in 2023, The Merchant of Venice and The Taming of the Shrew restricted in Lee County Schools in Florida in 2024, and manga adaptations of Hamlet and The Tempest removed in Wentzville, Missouri in 2022 and Wilson County, Tennessee in 2024 — alongside a report of Hamlet being prohibited to detainees at Ketziot prison in Israel.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/William_Shakespeare',
      wikidata_id: 'Q692',
      social_links: { viaf: 'https://viaf.org/viaf/96994048' },
      birth_month: 4,
      birth_day: 23,
      links_checked_at: NOW,
    },
  },
  {
    id: 7982,
    why: 'author "Mr." was an importer truncation of the pseudonym Mr. "J" (OpenLibrary work OL8024958W for our exact ISBN 9780207147302). Renamed + slug; short catalogue-grounded note. No Wikidata entity exists for the pseudonym (searched 2026-09-01); bio/photo/birth_year are unfindable by nature.',
    patch: {
      display_name: 'Mr. "J"',
      slug: 'mr-j',
      bio: [
        'Mr. “J” is the pseudonym under which The World’s Best Dirty Jokes and its sequels were compiled. The anthologies appeared from 1977 onwards, in the United States from Citadel Press, Ballantine Books and Castle Books, and in Britain from Fontana and Angus & Robertson; library catalogues record the credit only as the pseudonym, and no biographical information about the compiler has been published.',
        'Still More of the World’s Best Dirty Jokes, first published in 1981 and reissued by Angus & Robertson in 1985, is recorded in this database as banned in Malaysia in 1990, gazetted by the Ministry of Home Affairs under the Printing Presses and Publications Act.',
      ].join('\n\n'),
      bio_source_type: 'manual',
      bio_source_url: 'https://openlibrary.org/works/OL8024958W',
      links_checked_at: NOW,
    },
  },
  {
    id: 222,
    why: 'Colleen Hoover — bio UNSTAMPED and ungrounded/editorialising; rewritten from en.wikipedia and stamped. Wikidata Q18348293 already stored (P569 1979-12-11 matches our row); website upgraded to the working https origin.',
    patch: {
      bio: [
        'Margaret Colleen Hoover (née Fennell; born December 11, 1979) is an American author who writes mainly romance and young adult fiction. She was born in Sulphur Springs, Texas, grew up in Saltillo and graduated from Saltillo High School in 1998, then took a degree in social work at Texas A&M University–Commerce. She married Heath Hoover in 2000; they have three sons. She worked in social work and teaching before writing full time.',
        'Hoover began her first novel, Slammed, in November 2011 with no intention of publishing it, taking its title and threading its lyrics from the Avett Brothers song “Head Full of Doubt/Road Full of Promise”; she self-published it in January 2012 so that her mother, who had just been given a Kindle, could read it. A book blogger’s five-star review sent sales climbing, Slammed and its sequel Point of Retreat reached the New York Times bestseller list that August, and Atria Books picked both up. Hopeless, self-published in December 2012, became the first self-published novel ever to top that list. It Ends with Us (2016) — which Hoover has called the hardest book she ever wrote, and which draws on the domestic violence she witnessed as a child — was carried to number one in January 2022 by BookTok, was filmed in 2024 with Blake Lively and grossed over $350 million, and gained a sequel, It Starts with Us, in 2022. She had sold roughly 20 million books by October 2022, held six of the top ten places on the New York Times paperback fiction list that year, and was named one of Time magazine’s 100 most influential people in 2023.',
        'Twenty-four Hoover titles appear in this database, with 205 recorded bans and restrictions — every one of them in the United States, naming 57 school districts across sixteen states, from Alaska and Iowa to Florida and Texas. It Ends with Us accounts for thirty-four of those records on its own. Maybe Not, the 2014 novella in the Maybe Someday series, is recorded five times: banned in Central Lyon and Ridge View in Iowa, in Granite School District in Utah and in Chippewa Valley Schools in Michigan, and restricted in Cedar Falls, Iowa.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/Colleen_Hoover',
      website_url: 'https://www.colleenhoover.com/',
      links_checked_at: NOW,
    },
  },
  {
    id: 311,
    why: 'Gayle Forman — bio was one Wikipedia sentence plus the importer TEMPLATE tail; rewritten from en.wikipedia and stamped. Wikidata Q3099660 already stored (P569 1970-06-05 matches our row); website upgraded to https.',
    patch: {
      bio: [
        'Gayle Forman (born June 5, 1970) is an American author of young adult and adult fiction. She began her career writing for Seventeen, most of her articles focusing on young people and social concerns, and went on to freelance for Details, Jane, Glamour, The Nation, Elle and Cosmopolitan. In 2002 she and her husband Nick took a trip around the world, which became her first book, the travelogue You Can’t Get There From Here: A Year on the Fringes of a Shrinking World. Her first young adult novel, Sisters in Sanity (2007), grew out of an article she had written for Seventeen.',
        'If I Stay (2009), about a seventeen-year-old girl named Mia who lies in a coma after a car crash, fully aware of what is going on around her, won the NAIBA Book of the Year Award and an Indies Choice Book Award, topped the New York Times young adult bestseller list, and was filmed in 2014 with Chloë Grace Moretz. Where She Went (2011) is its sequel, told from the point of view of Mia’s former boyfriend Adam a few years after the accident. Forman followed it with the paired novels Just One Day and Just One Year (both 2013) and the novella Just One Night (2014), I Was Here (2015), her first adult novel Leave Me (2016), I Have Lost My Way (2018), We Are Inevitable and Frankie & Bug (both 2021), Not Nothing (2024) and After Life (2025). She lives in Brooklyn with her husband and daughter.',
        'Eight Forman titles appear in this database, with 42 recorded bans and restrictions, all of them in the United States: twenty named school districts across eight states, plus the Department of Defense Education Activity’s schools. Where She Went is recorded five times — restricted in Escambia County and Clay County in Florida and in Nevada Community School District in Iowa, and banned in West Burlington in Iowa and in North East Independent School District in Texas.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/Gayle_Forman',
      website_url: 'https://www.gayleforman.com/',
      links_checked_at: NOW,
    },
  },
  {
    id: 267,
    why: 'David Levithan (2026-09-07 birthday pick) — bio was one Wikipedia sentence plus the importer TEMPLATE tail; rewritten from en.wikipedia and stamped. Wikidata Q368263 already stored (P569 1972-09-07 matches our row). website_url http://davidlevithan.com/ serves a dead 2008 "Temporarily Disabled" placeholder over http and does not answer on https → nulled rather than shipped as an official link.',
    patch: {
      bio: [
        'David Levithan (born September 7, 1972) is an American young adult author and editor. He was born and raised in the Short Hills section of Millburn, New Jersey, into a family of Jewish background, and graduated from Millburn High School in 1990. At nineteen he took an internship at Scholastic, where he began working on The Baby-Sitters Club series; he is still an editorial director there and is the founding editor of PUSH, Scholastic’s young-adult imprint for new voices, which gave Patricia McCormick her start with Cut in 2002. He has said he loves editing just as much as writing, if not more.',
        'His own novels frequently centre gay characters, most notably Boy Meets Boy (2003) and Naomi and Ely’s No Kiss List (2007). Six of his books have won or been finalists for the Lambda Literary Award for Children’s and Young Adult Literature, more than any other author in that category, and in 2016 he received the Margaret A. Edwards Award for The Realm of Possibility, Boy Meets Boy, Love Is the Higher Law, How They Met and Other Stories, Wide Awake and Nick and Norah’s Infinite Playlist. He writes often with others — Will Grayson, Will Grayson (2010) with John Green, the Dash & Lily books with Rachel Cohn — and three of his novels have been filmed: Nick and Norah’s Infinite Playlist (2008), Naomi and Ely’s No Kiss List (2015) and Every Day (2018). Two Boys Kissing appeared in 2013. Recent work includes Answers in the Pages (2022), Ryan and Avery (2023) and Songs for Other People’s Weddings (2025), written in tandem with Jens Lekman’s concept album of the same name. He has been a resident of Hoboken, New Jersey.',
        'Nineteen Levithan titles appear in this database, with 95 recorded bans and restrictions, all of them in the United States: 44 named school districts across fourteen states, plus the Department of Defense Education Activity’s schools. Two Boys Kissing carries 23 of those records on its own — most of them Florida districts, along with Iowa, Kentucky, Georgia, Pennsylvania, Tennessee and Texas.',
      ].join('\n\n'),
      bio_source_type: 'wikipedia',
      bio_source_url: 'https://en.wikipedia.org/wiki/David_Levithan',
      website_url: null,
      links_checked_at: NOW,
    },
  },
]

// ── books ──────────────────────────────────────────────────────────────────
const BOOK_PATCHES: Patch[] = [
  {
    id: 7721,
    why: 'book 7721 "Maybe Not" carried the ISBN (9781501118678), cover and blurb of the 832-page 3-in-1 ebook bundle "Ugly Love, Maybe Someday, and Maybe Not". Repointed to the actual 148-page novella (OL work OL20018781W, Atria 2014, ISBN 9781476799841); cover verified visually (front reads "Maybe Not · A Novella · Colleen Hoover").',
    patch: {
      first_published_year: 2014,
      isbn13: '9781476799841',
      cover_url: 'https://covers.openlibrary.org/b/id/12856716-L.jpg',
      description_book:
        'When Warren has the opportunity to live with a female roommate, he instantly agrees — it could be an exciting change. Or maybe not, especially when that roommate is the cold and seemingly calculating Bridgette. Tensions run high and tempers flare as the two can hardly stand to be in the same room together. But Warren has a theory about Bridgette: anyone who can hate with that much passion should also be able to love with that much passion. Maybe Not is a novella in the Maybe Someday series, told from Warren’s point of view.',
      description_source_type: 'openlibrary',
      description_source_url: 'https://openlibrary.org/works/OL20018781W',
    },
  },
  {
    id: 12026,
    why: 'first_published_year NULL. OpenLibrary records "Still More of the World’s Best Dirty Jokes" first published 1981 (Citadel/Castle Books); our copy is the Angus & Robertson 1985 UK reissue, ISBN 9780207147302 (OL work OL8024958W).',
    patch: { first_published_year: 1981 },
  },
  {
    id: 16402,
    why: 'description_ban stated Elizabethan censorship as established fact and named the wrong quarto ("third quarto in 1608"). en.wikipedia: the first THREE quartos (1597, 1598) lack the scene, Q4 of 1608 carries a shorter version, and there is no external evidence for the censorship hypothesis.',
    patch: {
      description_ban:
        'The deposition scene, in which Richard surrenders the throne to Bolingbroke, is missing from the first three quartos of Richard II, printed in 1597 and 1598; a shorter version appears in the fourth quarto of 1608 and the fuller text in the First Folio of 1623. Elizabethan censorship — by the playhouse itself or by Edmund Tylney, the Master of the Revels — has traditionally been assumed to be the reason, though there is no external evidence for it, and the 1608 quarto claims to print the play as it had been publicly acted. The play’s political charge was real enough: on 7 February 1601, on the eve of their rising, supporters of the Earl of Essex paid the Chamberlain’s Men forty shillings above the usual rate to stage it at the Globe.',
    },
  },
  {
    id: 1332,
    why: 'description_ban said "banned at a school in the United States" in 2025 and speculated about the objections; our own rows name five Florida districts across 2023-2025.',
    patch: {
      description_ban:
        'Stronger, Faster, and More Beautiful has been pulled from five Florida school districts: banned in Collier County Public Schools in 2023, in Clay County School District in 2024 and in Union County School District in 2025, and restricted in Hillsborough County Public Schools and Volusia County Schools in 2025. Its six linked stories turn on genetic engineering and how far people will go in pursuit of physical perfection.',
    },
  },
]

// ── ban-row description fix ────────────────────────────────────────────────
const BAN_PATCHES: Patch[] = [
  {
    id: 29079,
    why: 'same quarto error as book 16402: the scene is absent from Q1-Q3 (1597, 1598) and returns in Q4 (1608), not "the 1608 third quarto"; censorship is the traditional assumption, not documented fact.',
    patch: {
      description:
        'The deposition scene (Richard surrendering the throne to Bolingbroke) is absent from the first three quartos of 1597 and 1598; a shorter version first appears in the fourth quarto of 1608. Elizabethan censorship, by the playhouse or by the Master of the Revels, is the traditional explanation, but there is no external evidence for it.',
    },
  },
]

const ALIASES: Array<{ slug: string; author_id: number }> = [{ slug: 'mr', author_id: 7982 }]

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
