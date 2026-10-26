// Institution-context registry.
//
// Most US school bans in the archive come from PEN America's index, which
// records the district, the school year and how a removal started — not why.
// A handful of districts account for thousands of those rows (Escambia alone
// ~1,700 titles), and their mass removals have a documented cause: a state
// law, an executive order, a review sweep, a batch of challenges. We write that
// context ONCE per institution here, sourced, and show it on every book page
// with a matching ban — the same pattern as ban-contexts.ts (prose in code,
// zero queries; matched on the ban rows the page already fetched).
//
// Rules for entries (2026-10-26 research pass):
//   - every claim backed by a source we fetched and read; sources listed
//   - neutral and encyclopedic; contested framing attributed
//   - private individuals (e.g. a parent who filed hundreds of challenges) are
//     never named — public officials, agencies and court cases may be
//   - must read correctly on the page of ANY book the institution removed:
//     never names titles, never claims this particular book was part of a
//     specific sweep
//   - `years` limits matching to bans whose year_started falls inside the
//     window the paragraph actually describes (PEN year_started is sometimes
//     the start, sometimes the end of the school year, so windows run +1)

export type InstitutionContext = {
  institution: string
  region: string
  /** Inclusive year_started window this paragraph explains. */
  years: [number, number]
  text: string
  sources: { name: string; url: string }[]
}

export const INSTITUTION_CONTEXTS: InstitutionContext[] = [
  {
    institution: 'Escambia County Public Schools',
    region: 'Florida',
    years: [2022, 2025],
    text:
      "Escambia County's removals followed hundreds of book challenges, many filed by a single individual, and a district-wide review prompted by Florida's HB 1069 that by late 2023 had pulled more than 1,600 library titles pending review. PEN America, Penguin Random House, authors and parents sued the school board in May 2023; in January 2024 a federal judge allowed their First Amendment claims to proceed.",
    sources: [
      { name: 'WLRN', url: 'https://www.wlrn.org/education/2024-01-12/escambia-county-school-library-book-ban-lawsuit' },
      { name: 'Pensacola News Journal', url: 'https://www.yahoo.com/news/1-600-escambia-school-library-102229612.html' },
    ],
  },
  {
    institution: 'North East Independent School District',
    region: 'Texas',
    years: [2021, 2024],
    text:
      'North East ISD pulled 432 library titles for review in December 2021 after state Rep. Matt Krause asked Texas districts about books on a list of about 850 titles; by March 2022 it had returned 311 and removed or replaced 110. In 2023–24, while setting up review procedures under Texas HB 900, the district evaluated more than 29,000 books and removed over 900.',
    sources: [
      { name: 'San Antonio Report', url: 'https://sanantonioreport.org/north-east-isd-removes-more-than-100-books-review-krause-list/' },
      { name: 'Community Impact', url: 'https://communityimpact.com/san-antonio/education/north-east-isd-approves-process-for-vetting-library-content/' },
    ],
  },
  {
    institution: 'Clay County School District',
    region: 'Florida',
    years: [2022, 2024],
    text:
      'Clay County received more school book objections than any other Florida district: state Department of Education data showed 489 objections and 177 removals in 2022–23, and 287 library removals in 2023–24 — both state highs. The district said about 94% of the challenged titles came from a single community member affiliated with an advocacy organization.',
    sources: [
      { name: 'News4JAX', url: 'https://www.news4jax.com/news/morning-show/2023/09/13/clay-county-leads-state-in-school-book-objections-removals-state-says' },
      { name: 'Jacksonville Today', url: 'https://jaxtoday.org/2024/11/12/clay-county-removed-schoolbooks/' },
    ],
  },
  {
    institution: 'Orange County Public Schools',
    region: 'Florida',
    years: [2023, 2024],
    text:
      "In 2023 Orange County Public Schools rejected 673 titles from teachers' classroom collections after Florida laws HB 1069 and HB 1467 required media specialists to review and approve all books and exclude material depicting “sexual conduct”. Teachers were told to take the books home or store them out of students' reach; the district said the list would be re-reviewed, so some titles could return.",
    sources: [
      { name: 'Orlando Sentinel', url: 'https://www.yahoo.com/news/orange-school-district-pulls-673-140400847.html' },
    ],
  },
  {
    institution: 'Hillsborough County Public Schools',
    region: 'Florida',
    years: [2025, 2025],
    text:
      "In May 2025 Florida's Attorney General and Education Commissioner wrote to Hillsborough's superintendent alleging that school libraries held pornographic material; the district then began reviewing more than 600 titles the state had flagged. PEN America counted 608 titles removed in 2024–25; the district said 59 had been formally removed and the rest were temporarily pulled for review.",
    sources: [
      { name: 'Publishers Weekly', url: 'https://www.publishersweekly.com/pw/by-topic/industrynews/libraries/article/98375-florida-public-schools-remove-library-books-fearing-state-reprisal.html' },
      { name: 'FOX 13 Tampa Bay', url: 'https://www.fox13news.com/news/hillsborough-ranks-first-florida-high-number-books-banned-district-pushes-back' },
    ],
  },
  {
    institution: 'Katy Independent School District',
    region: 'Texas',
    years: [2024, 2025],
    text:
      "In August 2024 Katy ISD's board barred library material “adopting, supporting or promoting gender fluidity” from elementary and junior high schools and made such books in high school libraries available only with a parent's opt-in.",
    sources: [
      { name: 'Community Impact', url: 'https://communityimpact.com/katy-north/education/katy-isd-to-remove-restrict-library-books-about-gender-fluidity/' },
    ],
  },
  {
    institution: 'Department of Defense Education Activity',
    region: 'Nation',
    years: [2025, 2026],
    text:
      "In 2025 the Department of Defense Education Activity, which runs schools for U.S. military families, removed or “quarantined” hundreds of library books for review following presidential executive orders 14168, 14185 and 14190 (“Ending Radical Indoctrination in K-12 Schooling”). In E.K. v. DoDEA, a federal judge in October 2025 ordered books removed under those orders restored at the plaintiffs' five schools.",
    sources: [
      { name: 'Publishers Weekly', url: 'https://www.publishersweekly.com/pw/print/20251027/98912-virginia-district-judge-orders-dodea-to-restore-school-books.html' },
      { name: 'ACLU – E.K. v. DoDEA', url: 'https://www.aclu.org/cases/e-k-v-department-of-defense-education-activity' },
    ],
  },
  {
    institution: 'Monroe County Schools',
    region: 'Tennessee',
    years: [2024, 2025],
    text:
      "Monroe County Schools removed 574 titles from its school libraries during summer 2024 and the 2024–25 school year to comply with 2024 amendments to Tennessee's Age-Appropriate Materials Act, which require removing materials containing nudity, sexual content or excessive violence. In March 2025 the National Coalition Against Censorship urged the school board to reinstate the books.",
    sources: [
      { name: 'WBIR 10News', url: 'https://www.wbir.com/article/news/education/monroe-county-schools-book-bans/51-bd18b5f6-c45a-4568-bbac-7abc2f08561f' },
      { name: 'National Coalition Against Censorship', url: 'https://ncac.org/wp-content/uploads/2025/03/Monroe-County-Schools_NCAC.pdf' },
    ],
  },
  {
    institution: 'Wilson County Schools',
    region: 'Tennessee',
    years: [2024, 2025],
    text:
      "In fall 2024, after Tennessee expanded its 2022 Age-Appropriate Materials Act to bar school library materials containing nudity or sexual or violent content, Wilson County Schools administrators directed librarians to pull roughly 400 titles, most from high school libraries. The district called the review ongoing; its removal list was later circulated among other Tennessee districts.",
    sources: [
      { name: 'Chalkbeat Tennessee', url: 'https://chalkbeat.org/tennessee/2024/11/16/tennessee-school-districts-share-wilson-county-library-book-ban-list' },
      { name: 'The Tennessean', url: 'https://www.aol.com/wilson-county-schools-removes-425-203702562.html' },
    ],
  },
  {
    institution: 'Collier County Public Schools',
    region: 'Florida',
    years: [2023, 2024],
    text:
      "Collier County Public Schools removed or restricted more than 300 library titles in 2023, citing compliance with Florida's HB 1069, which made content that “depicts or describes sexual conduct” grounds for objection. The free-speech group FIRE argued the district relied on state guidance that mischaracterized the law. In August 2025 a federal judge ruled parts of HB 1069 overbroad and unconstitutional.",
    sources: [
      { name: 'PEN America', url: 'https://pen.org/more-than-300-titles-banned-in-collier-county-florida/' },
      { name: 'FIRE', url: 'https://www.fire.org/news/hundreds-books-removed-florida-public-school-libraries-based-constitutionally-suspect-guidance' },
    ],
  },
  {
    institution: 'Conroe Independent School District',
    region: 'Texas',
    years: [2023, 2024],
    text:
      "Conroe ISD removed books through a formal reconsideration process and a separate informal review that anyone could initiate; in 2024 the district's general counsel said most removals came through informal reviews. The board adopted a local book policy in November 2023, after Texas HB 900 took effect, and in February 2024 voted 5–1 to dispose of more than 2,800 removed copies.",
    sources: [
      { name: 'Houston Press', url: 'https://www.houstonpress.com/?p=377298' },
      { name: 'Community Impact', url: 'https://communityimpact.com/conroe-montgomery/education/conroe-isd-trustees-discuss-but-dont-change-book-policy/' },
    ],
  },
  {
    institution: 'Central York School District',
    region: 'Pennsylvania',
    years: [2020, 2021],
    text:
      "In fall 2020 the Central York School Board unanimously froze use of a diversity resource list of books and other materials compiled by the high school's Diversity Committee, following complaints from some parents; district officials said the items were being vetted, while PEN America called the freeze a book ban. After student protests, the board unanimously reinstated the list in September 2021.",
    sources: [
      { name: 'PEN America', url: 'https://pen.org/press-release/book-ban-in-pennsylvania-school-district-sets-troubling-precedent-for-access-to-diverse-literature/' },
      { name: 'CNN', url: 'https://ktvz.com/news/national-world/cnn-national/2021/09/25/pennsylvania-school-district-reverses-ban-on-books-by-authors-of-color-after-students-fought-back/' },
    ],
  },
  {
    institution: 'Frisco Independent School District',
    region: 'Texas',
    years: [2021, 2023],
    text:
      'Frisco ISD said it began reviewing its library catalog in 2021 for obscene or explicit material, adding an expedited review process; by November 2022 it had removed at least 307 titles. In 2022 state Rep. Jared Patterson formally challenged 28 titles, and the board voted for its first permanent removals. The National Coalition Against Censorship objected to the district\'s blanket-removal guidelines.',
    sources: [
      { name: 'WFAA', url: 'https://wfaa.com/article/news/local/frisco-isd-board-votes-remove-books-from-libraries-state-lawmaker-requests/287-6218a195-af6e-47ea-ba37-78cfec8d96e4' },
      { name: 'National Coalition Against Censorship', url: 'https://ncac.org/news/blog/ncac-responds-to-100-titles-removed-from-frisco-independent-school-district-libraries' },
    ],
  },
  {
    institution: 'U.S. Naval Academy (Nimitz Library)',
    region: 'Maryland',
    years: [2025, 2025],
    text:
      "In early April 2025, after Defense Secretary Pete Hegseth's office directed it to review its library for books promoting diversity, equity and inclusion, the U.S. Naval Academy removed 381 books from Nimitz Library, chosen from about 900 titles initially flagged. After a further Pentagon-ordered review, the Associated Press reported in May 2025 that all but a few had been returned to the shelves.",
    sources: [
      { name: 'Associated Press', url: 'https://www.news4jax.com/news/politics/2025/05/21/most-books-pulled-from-naval-academy-library-are-back-on-the-shelves-in-latest-dei-turn/' },
      { name: 'Library Journal infoDOCKET', url: 'https://www.infodocket.com/2025/04/02/ap-report-naval-academy-removes-nearly-400-books-from-library-in-new-dei-purge-ordered-by-hegseths-office/' },
    ],
  },
  {
    institution: 'Elkhorn Area School District',
    region: 'Wisconsin',
    years: [2023, 2024],
    text:
      "In late November 2023 a single parent challenged 444 titles held by Elkhorn's middle and high school libraries. Under district policy, challenged books were pulled from circulation while principals reviewed them, using age ratings from sources such as Common Sense Media. The superintendent said many would be reviewed and returned, possibly with parental-permission requirements.",
    sources: [
      { name: 'Wisconsin Public Radio', url: 'https://www.wpr.org/diversity-and-inclusion/elkhorn-area-school-district-considering-changing-book-policy-after-parent-challenges-more-400' },
    ],
  },
  {
    institution: 'Oak Ridge Schools',
    region: 'Tennessee',
    years: [2024, 2025],
    text:
      "Oak Ridge Schools removed more than 320 titles from its school libraries in 2024–25 after a 2024 amendment to Tennessee's Age-Appropriate Materials Act took effect, which deems materials containing nudity, sexual content or excessive violence inappropriate for all K-12 students. The district said librarians reviewed each book against the law and moved non-compliant titles into storage.",
    sources: [
      { name: 'WBIR', url: 'https://www.wbir.com/article/news/local/oak-ridge-anderson/books-removed-from-shelves-in-oak-ridge-schools-libraries-after-changes-to-state-law/51-db8f413d-d363-44e9-8910-79dff10e8072' },
      { name: 'PEN America', url: 'https://pen.org/magic-tree-house-author-calvin-and-hobbes-among-hundreds-of-tennessee-book-bans/' },
    ],
  },
  {
    institution: 'Collierville Schools',
    region: 'Tennessee',
    years: [2022, 2022],
    text:
      'In spring 2022 Collierville Schools pulled more than 300 library books for review while Tennessee lawmakers considered bills restricting “obscene” material in schools; no law required the removals. The district said the books stayed in its catalog and that librarians were told in April 2022 they could be reshelved once the bills went to summer study. PEN America reported many titles had LGBTQ+ themes.',
    sources: [
      { name: 'ABC24 Memphis', url: 'https://www.localmemphis.com/article/news/education/collierville-tennessee-schools-remove-lgbtq-books/522-3922d267-9637-48ce-9744-4f0861264aca' },
      { name: 'PEN America', url: 'https://pen.org/press-release/removal-of-327-books-with-lgbtq-themes-by-tn-school-district-is-heartbreaking-censorship/' },
    ],
  },
  {
    institution: 'Lamar Consolidated Independent School District',
    region: 'Texas',
    years: [2024, 2025],
    text:
      'Since January 2024 Lamar Consolidated ISD has removed more than 280 library books through an internal review of its collections, according to records obtained by the Texas Freedom to Read Project, with hundreds more placed under review. The district said it had received no formal challenges and was reviewing collections for compliance with its local library policy and Texas House Bill 900 (2023).',
    sources: [
      { name: 'Houston Chronicle', url: 'https://www.houstonchronicle.com/news/houston-texas/education/article/lamar-cisd-book-ban-removal-21057386.php' },
      { name: 'Community Impact', url: 'https://communityimpact.com/houston/katy-south-fulshear/education/2024/11/21/lamar-cisd-restricts-removes-books-about-gender-fluidity-from-libraries/' },
    ],
  },
  {
    institution: 'Duval County Public Schools',
    region: 'Florida',
    years: [2022, 2024],
    text:
      'In January 2022 Duval County Public Schools pulled 176 titles from its newly purchased Essential Voices classroom-library collection for review; PEN America reported they stayed in storage for months. From 2023, after Florida required certified media specialists to approve school books, the district covered or emptied shelves while reviewing its 1.6-million-book collection; this internal review, rather than formal challenges, accounts for most later removals.',
    sources: [
      { name: 'PEN America', url: 'https://pen.org/banned-books-florida/' },
      { name: 'Jacksonville Today', url: 'https://jaxtoday.org/2026/04/23/dozens-books-removed-duval-handmaids-tale-maya-angelou/' },
    ],
  },
  {
    institution: 'Nevada Community School District',
    region: 'Iowa',
    years: [2023, 2024],
    text:
      "In 2023 the Nevada Community School District reviewed its collections to comply with Iowa's Senate File 496, which requires schools to remove books containing descriptions or visual depictions of a sex act. The district initially flagged about 239 titles; by December 2023 it listed 65 removals, saying many initially pulled titles had been returned to circulation.",
    sources: [
      { name: 'Little Village', url: 'https://littlevillagemag.com/every-book-removed-from-iowa-schools-so-far-in-response-to-sf-496/' },
      { name: 'Ames Tribune', url: 'https://www.yahoo.com/news/65-books-removed-nevada-csd-120235199.html' },
    ],
  },
  {
    institution: 'Clear Creek-Amana Community School District',
    region: 'Iowa',
    years: [2023, 2024],
    text:
      "Clear Creek-Amana Community School District pulled about 230 titles to comply with Iowa's Senate File 496 (2023), which requires removal of books containing descriptions or visual depictions of a sex act — one of the highest totals in the state, according to a Des Moines Register survey. After a federal judge enjoined the law in December 2023, the district returned nearly all of the books to its shelves.",
    sources: [
      { name: 'Des Moines Register', url: 'https://www.usatoday.com/story/news/education/2024/06/06/captain-underpants-among-banned-books-under-iowa-law/73996406007/' },
      { name: 'Little Village', url: 'https://littlevillagemag.com/every-book-removed-from-iowa-schools-so-far-in-response-to-sf-496/' },
    ],
  },
]

type MatchableBan = { institution: string | null; region: string | null; year_started: number | null }

/** Contexts for the book's bans, one per institution, registry order. */
export function institutionContextsForBans(bans: MatchableBan[]): InstitutionContext[] {
  return INSTITUTION_CONTEXTS.filter(ctx =>
    bans.some(b =>
      b.institution === ctx.institution &&
      (b.region ?? '') === ctx.region &&
      b.year_started != null &&
      b.year_started >= ctx.years[0] &&
      b.year_started <= ctx.years[1],
    ),
  )
}
