// Curated directory of organisations that defend the freedom to read —
// rendered on /organizations. This is an editorial "who does the work, and
// how to support them" list, deliberately distinct from /sources (which
// documents where our *ban data* comes from). Some organisations appear on
// both pages because they both publish censorship data AND campaign against
// it; here we surface the advocacy/donate/join angle, not the data feed.
//
// Links are plain dofollow anchors on purpose: these are trusted, on-topic
// non-profits, and linking to them is a genuine relevance signal — the
// opposite of the affiliate links we nofollow. Homepage URLs only (they rot
// far less often than deep links), each verified to resolve.

export type Ally = {
  name: string
  url: string
  // One sentence: what they do and, where relevant, how a reader can help.
  blurb: string
}

export type AllyGroup = {
  heading: string
  blurb: string
  allies: readonly Ally[]
}

export const ALLY_GROUPS: readonly AllyGroup[] = [
  {
    heading: 'International',
    blurb:
      'Beyond any single country, these groups document censorship, defend jailed and exiled writers, and press governments on the right to read and write freely.',
    allies: [
      {
        name: 'PEN International',
        url: 'https://www.pen-international.org',
        blurb:
          'A global association of writers whose Writers in Prison Committee campaigns for authors detained, exiled, or killed for their work.',
      },
      {
        name: 'Article 19',
        url: 'https://www.article19.org',
        blurb:
          'Named after the free-expression article of the Universal Declaration of Human Rights, it works globally for the right to speak, publish, and read.',
      },
      {
        name: 'Amnesty International',
        url: 'https://www.amnesty.org',
        blurb:
          'The global human-rights movement, campaigning for prisoners of conscience — including writers jailed for what they published.',
      },
      {
        name: 'Human Rights Watch',
        url: 'https://www.hrw.org',
        blurb:
          'Investigates and reports on censorship and other rights abuses, holding governments to account with rigorous documentation.',
      },
      {
        name: 'Reporters Without Borders',
        url: 'https://rsf.org',
        blurb:
          'Defends press freedom worldwide and tracks the imprisonment and killing of journalists and writers.',
      },
    ],
  },
  {
    heading: 'United States',
    blurb:
      'Where most documented book challenges happen today, a dense network of library, writer, and legal groups fights removals school board by school board.',
    allies: [
      {
        name: 'American Library Association — Office for Intellectual Freedom',
        url: 'https://www.ala.org/bbooks',
        blurb:
          'The ALA tracks challenges nationwide, runs Banned Books Week, and supports the librarians on the receiving end of removal campaigns.',
      },
      {
        name: 'Unite Against Book Bans',
        url: 'https://uniteagainstbookbans.org',
        blurb:
          'The ALA’s public campaign, with practical toolkits for anyone who wants to defend a book at their own local library or school board.',
      },
      {
        name: 'PEN America',
        url: 'https://pen.org',
        blurb:
          'A writers’ organisation whose Index of School Book Bans is the most comprehensive count of US classroom removals; also campaigns for imprisoned writers worldwide.',
      },
      {
        name: 'National Coalition Against Censorship',
        url: 'https://ncac.org',
        blurb:
          'A coalition of more than fifty national groups that intervenes directly in local censorship disputes, from libraries to classrooms to art galleries.',
      },
      {
        name: 'Freedom to Read Foundation',
        url: 'https://www.ftrf.org',
        blurb:
          'The ALA’s legal-defence arm, funding First Amendment litigation and supporting librarians and readers sued or fired over book access.',
      },
      {
        name: 'EveryLibrary',
        url: 'https://www.everylibrary.org',
        blurb:
          'A political action committee for libraries — it fights book-ban legislation and helps communities win the funding votes that keep libraries open.',
      },
      {
        name: 'Comic Book Legal Defense Fund',
        url: 'https://cbldf.org',
        blurb:
          'Defends the freedom to read comics and graphic novels — among the most frequently challenged formats in US schools.',
      },
      {
        name: 'Authors Guild',
        url: 'https://authorsguild.org',
        blurb:
          'The largest US professional organisation for writers, advocating against book bans and for authors’ rights.',
      },
      {
        name: 'FIRE — Foundation for Individual Rights and Expression',
        url: 'https://www.thefire.org',
        blurb:
          'Litigates and campaigns for free expression in schools, universities, and public institutions across the political spectrum.',
      },
    ],
  },
  {
    heading: 'United Kingdom',
    blurb:
      'Britain’s PEN centre and its oldest censorship watchdog campaign for the freedom to read at home and for writers under threat abroad.',
    allies: [
      {
        name: 'English PEN',
        url: 'https://www.englishpen.org',
        blurb:
          'The founding centre of the PEN network, defending freedom of expression in the UK and championing translated and at-risk literature.',
      },
      {
        name: 'Index on Censorship',
        url: 'https://www.indexoncensorship.org',
        blurb:
          'A UK charity that has reported on censorship worldwide since 1972 through its magazine, campaigns, and support for persecuted writers.',
      },
    ],
  },
  {
    heading: 'Continental Europe',
    blurb:
      'National PEN centres in Germany, France, and Belarus — three of the countries most heavily represented in this catalogue, spanning Nazi- and Soviet-era bans and Belarus’s present-day repression.',
    allies: [
      {
        name: 'PEN Zentrum Deutschland',
        url: 'https://www.pen-deutschland.de',
        blurb:
          'The German PEN centre, defending persecuted writers and running a long-standing Writers-in-Exile programme.',
      },
      {
        name: 'PEN Club français',
        url: 'https://penclub.fr',
        blurb:
          'The French PEN centre, campaigning for freedom of expression and for writers imprisoned around the world.',
      },
      {
        name: 'PEN Belarus',
        url: 'https://penbelarus.org',
        blurb:
          'The Belarusian PEN centre, liquidated by the regime and now working in exile, which documents cultural repression and catalogues books banned in Belarus.',
      },
    ],
  },
  {
    heading: 'Asia-Pacific',
    blurb:
      'From Malaysia’s publication bans to post-National-Security-Law Hong Kong and mainland China, these groups — several working in exile — defend writers and the freedom to read across the region.',
    allies: [
      {
        name: 'Centre for Independent Journalism (Malaysia)',
        url: 'https://cijmalaysia.net',
        blurb:
          'A Malaysian non-profit promoting freedom of expression and media independence in a country with a long record of banning books and publications.',
      },
      {
        name: 'Hong Kong Watch',
        url: 'https://www.hongkongwatch.org',
        blurb:
          'Monitors and campaigns on the erosion of freedoms in Hong Kong, including the removal of books from public libraries since the National Security Law.',
      },
      {
        name: 'Independent Chinese PEN Center',
        url: 'https://www.chinesepen.org',
        blurb:
          'A PEN International centre for Chinese writers, many of them in exile, defending free expression and imprisoned authors — once led by the late Nobel laureate Liu Xiaobo.',
      },
      {
        name: 'New Zealand Society of Authors (PEN NZ)',
        url: 'https://authors.org.nz',
        blurb:
          'New Zealand’s PEN centre, representing authors and defending the freedom to write and read across Aotearoa.',
      },
    ],
  },
  {
    heading: 'Canada',
    blurb:
      'Library associations and free-expression centres keep the freedom to read on the public agenda north of the border.',
    allies: [
      {
        name: 'Freedom to Read (Book and Periodical Council)',
        url: 'https://www.freedomtoread.ca',
        blurb:
          'Runs Canada’s annual Freedom to Read Week and publishes the country’s record of challenged books and periodicals.',
      },
      {
        name: 'Canadian Federation of Library Associations',
        url: 'https://cfla-fcab.ca',
        blurb:
          'The national voice of Canada’s libraries, whose Intellectual Freedom Committee defends open access to information against challenges.',
      },
      {
        name: 'Centre for Free Expression',
        url: 'https://cfe.torontomu.ca',
        blurb:
          'A research and advocacy hub at Toronto Metropolitan University that supports librarians and educators facing censorship pressure.',
      },
    ],
  },
] as const

export const ALLY_COUNT = ALLY_GROUPS.reduce((n, g) => n + g.allies.length, 0)
