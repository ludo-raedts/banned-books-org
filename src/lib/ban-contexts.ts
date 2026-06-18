// Ban-context registry.
//
// The problem this solves: thousands of books in the archive belong to a small
// number of named censorship *events* (Nazi withdrawal lists, the Russian
// extremist register, a specific statute). Individually most of these books are
// obscure — a title and one ban row, no description. But we DO know the context:
// the event they were caught up in. Rather than generate per-book prose (heavy,
// and a confabulation risk our QA doctrine forbids), we write the context ONCE
// per event here and attach it by matching the ban's already-loaded source URL.
//
// Cost model: the book-page callout adds ZERO queries and ZERO columns — it
// reads the `ban_source_links` data the page already fetches. The /contexts hub
// pages run one bounded, ISR-cached query each. The prose lives in code.
//
// Matching is OR over the strategies in `match`:
//   - sourceUrlIncludes: case-insensitive substring of a cited ban source_url
//     (the same signal the /sources page tallies by). Primary path.
//   - bookSlugs: an explicit allowlist, for events with no distinct source URL
//     (e.g. the Loi Gayssot books, tagged editorially).

export type BanContext = {
  /** URL segment: /contexts/<slug>. */
  slug: string
  /** Display name of the event/law. */
  title: string
  /** Short kicker shown in the callout, e.g. "German-occupied France · 1940". */
  badge: string
  /**
   * One or two sentences for the on-book callout. Must be accurate about what
   * inclusion means: for Nazi lists the book is a *victim* of censorship;
   * for the Gayssot statute the book was banned for its own content. Never
   * exonerate or endorse — just state the event.
   */
  short: string
  /** When true, /contexts/<slug> renders a full long-form hub page. */
  hasHub: boolean
  match: {
    sourceUrlIncludes?: string[]
    bookSlugs?: string[]
  }
}

export const BAN_CONTEXTS: BanContext[] = [
  {
    slug: 'liste-otto',
    title: 'Liste Otto',
    badge: 'German-occupied France · 1940',
    short:
      'This title appears on the Liste Otto — the list of books the German occupation authorities, with the agreement of French publishers, ordered withdrawn from sale in occupied France from September 1940. Its presence here marks the book as a target of Nazi censorship.',
    hasHub: true,
    match: { sourceUrlIncludes: ['fr.wikisource.org/wiki/ouvrages_litt'] },
  },
  {
    slug: 'berlin-1938-verbannte-buecher',
    title: 'Nazi list of banned books (1938)',
    badge: 'Nazi Germany · 1938',
    short:
      'This title was on the Nazi “Liste des schädlichen und unerwünschten Schrifttums” — the official register of “harmful and undesirable writing” as it stood on 31 December 1938. Its presence here marks the book as a target of Nazi censorship.',
    hasHub: true,
    match: { sourceUrlIncludes: ['berlin.de/verbannte-buecher'] },
  },
  {
    slug: 'russia-federal-extremist-list',
    title: 'Russia’s Federal List of Extremist Materials',
    badge: 'Russia · ongoing',
    short:
      'This title is on Russia’s Federal List of Extremist Materials, maintained by the Ministry of Justice: works that Russian courts have declared “extremist” and that are illegal to distribute in Russia.',
    hasHub: true,
    match: {
      sourceUrlIncludes: ['minjust.gov.ru', 'federal_list_of_extremist_materials'],
    },
  },
  {
    slug: 'loi-gayssot',
    title: 'The Loi Gayssot',
    badge: 'France · 1990 law',
    short:
      'This book was banned or prosecuted in France under the Loi Gayssot, the 1990 law that makes it a criminal offence to deny the Nazi crimes against humanity established at Nuremberg.',
    hasHub: true,
    match: {
      bookSlugs: [
        'lholocauste-au-scanner',
        'rapport-dexpertise-sur-la-formation-et-le-controle-de-la-presence-de-composes-cyanures-dans-les-chambres-a-gaz-dauschwitz',
        'le-massacre-doradour',
        'les-camps-de-concentration-allemands-1941-1945-mythes-propages-realites-occultees',
      ],
    },
  },
]

export function getBanContext(slug: string): BanContext | undefined {
  return BAN_CONTEXTS.find((c) => c.slug === slug)
}

// Minimal shape the matcher needs from a book — a subset of the book page's
// already-fetched data, so the callout costs no extra query.
type MatchableBook = {
  slug: string
  bans: { ban_source_links: { ban_sources: { source_url: string } | null }[] }[]
}

/** Returns every context a book belongs to (usually zero or one). */
export function contextsForBook(book: MatchableBook): BanContext[] {
  const urls = book.bans
    .flatMap((b) => b.ban_source_links.map((l) => l.ban_sources?.source_url ?? ''))
    .filter(Boolean)
    .map((u) => u.toLowerCase())

  return BAN_CONTEXTS.filter((ctx) => {
    if (ctx.match.bookSlugs?.includes(book.slug)) return true
    if (ctx.match.sourceUrlIncludes?.some((sub) => urls.some((u) => u.includes(sub)))) {
      return true
    }
    return false
  })
}
