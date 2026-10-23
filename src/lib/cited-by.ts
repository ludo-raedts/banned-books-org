// "Cited by" registry — third-party publications that used banned-books.org
// as a source. Rendered in the "Recent coverage" section of /press.
//
// Hand-curated on purpose. The 2026-10-23 backlink audit
// (data/backlink-audit-2026-10-23.md) showed that half of all candidate
// mentions were false positives (the unrelated 2011 campaign site
// banned-books.org.uk, forum posts, our own syndicated press release), so
// automatic detection would list junk. Adding a new entry is one line here.
//
// Inclusion bar: the page must demonstrably USE the catalogue as a source —
// a citation, footnote, quoted figure or reproduced record — on an editorial
// or educational page. Not enough: a passing mention, a forum post, a social
// post, anything we published or syndicated ourselves. Same doctrine as
// `featured-videos.ts` and `organization-authors.ts`: a code registry, not a
// DB table, because the list will stay small.

export type CitedByKind = 'research' | 'press'

export type CitedBy = {
  /** Publisher / outlet name shown as the lead. */
  outlet: string
  /** Page or article title. */
  title: string
  /** Canonical URL of the citing page. */
  href: string
  kind: CitedByKind
  /** Publication month as YYYY-MM, when the page states one. */
  date?: string
  /** One factual line on what they took from the catalogue. */
  note: string
}

export const CITED_BY: CitedBy[] = [
  // ── Research & education ────────────────────────────────────────────
  {
    outlet: 'The Blue Route — Widener University',
    title: 'Ban Banning Books',
    href: 'https://widenerblueroute.org/2026/10/08/ban-banning-books/',
    kind: 'research',
    date: '2026-10',
    note: 'Undergraduate literary journal; cites the reading-club guide for I Know Why the Caged Bird Sings alongside ALA sources.',
  },
  {
    outlet: 'NCClinked — North Central College',
    title: 'Cultural events and what’s coming next',
    href: 'https://ncclinked.com/2026/10/02/cultural-events-and-whats-coming-next/',
    kind: 'research',
    date: '2026-10',
    note: 'Student newspaper; quotes the catalogue’s ban record for J Is for Justice: An Activism Alphabet.',
  },
  {
    outlet: 'Rijksuniversiteit Groningen — Faculteit der Letteren',
    title: 'Fyona en Bregje ontdekken het werkveld (2)',
    href: 'https://www.rug.nl/let/studentenblog-nederlands/fyona-en-bregje-ontdekken-het-werkveld-2',
    kind: 'research',
    note: 'Dutch-studies student blog; recommends the catalogue as the place to browse banned books.',
  },
  {
    outlet: 'Секретно — Documenting Soviet secrets',
    title: 'Books',
    href: 'https://xn--e1aaonfjem.com/books',
    kind: 'research',
    note: 'Footnotes the Soviet Union country record as its source on withdrawn and spetskhran-restricted books.',
  },
  {
    outlet: 'Wikipedia',
    title: 'Cited on seven articles across three language editions',
    href: 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments',
    kind: 'research',
    note: 'Including List of books banned by governments, Banned Books Week and The Anarchist Cookbook (English), plus the Portuguese and Hebrew editions.',
  },

  // ── Press & commentary ──────────────────────────────────────────────
  {
    outlet: 'The Educators Room',
    title: 'Before We Debate What Students Read, We Need to Talk About Whether They Can',
    href: 'https://theeducatorsroom.com/before-we-debate-what-students-read-we-need-to-talk-about-whether-they-can/',
    kind: 'press',
    date: '2026-08',
    note: 'Kamye Hugley cites the catalogue for The Odyssey’s removal by two Tennessee school districts.',
  },
  {
    outlet: 'Pennsylvanians for Welcoming and Inclusive Schools',
    title: 'Book Bans',
    href: 'https://pawins.org/news/bookbans/',
    kind: 'press',
    note: 'Draws on the catalogue’s count of censored Nobel and Pulitzer laureates and its 119-country scope.',
  },
  {
    outlet: 'Phil Garber — Medium',
    title: 'Book Banning Getting Worse In US and Around The World',
    href: 'https://philgarber.medium.com/book-banning-getting-worse-in-us-and-around-the-world-d45b80aa9767',
    kind: 'press',
    note: 'Cites the catalogue’s finding that the United States has the highest number of distinct banned titles.',
  },
  {
    outlet: 'The Second Half of Life — William Tucker',
    title: 'Concrete Rose',
    href: 'https://williamtucker.substack.com/p/concrete-rose',
    kind: 'press',
    date: '2026-10',
    note: 'Reproduces the catalogue’s ban record for Angie Thomas’s Concrete Rose.',
  },
  {
    outlet: 'TBR Books, O’Fallon IL',
    title: 'Featured Banned Book for 10/4',
    href: 'https://tbrbooksofallon.com/2026/10/04/featured-banned-book-for-10-4/',
    kind: 'press',
    date: '2026-10',
    note: 'Independent bookstore’s Banned Books Week series; cites the catalogue on The Giver.',
  },
]

/** Entries of one kind, newest dated first, undated last. */
export function citedBy(kind: CitedByKind): CitedBy[] {
  return CITED_BY.filter((c) => c.kind === kind).sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date)
    if (a.date) return -1
    if (b.date) return 1
    return 0
  })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10" → "Oct 2026". */
export function formatCitedDate(date: string): string {
  const [y, m] = date.split('-')
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`
}
