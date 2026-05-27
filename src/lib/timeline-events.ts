// Curated landmark events in the history of book banning.
//
// Used by /timeline. Each event is editorial: the spine of the catalogue is
// the bans table, this file is the chosen moments that map the 2,000-year arc.
//
// Sorted chronologically at render time by `year` (negative = BCE) then
// `month`/`day`. Book and author `related` slugs must exist in the live
// `books` / `authors` tables; `countryCode` is a lowercase ISO 3166-1
// alpha-2 code that resolves to `/countries/<code>`. Verify against the DB
// before adding new events — broken slugs render as dead links.

export type TimelineEra =
  | 'ancient'
  | 'medieval-early-modern'
  | 'enlightenment'
  | '19c'
  | '20c'
  | '21c'

export type TimelineEvent = {
  slug: string
  year: number               // negative for BCE; used for sort + grouping
  month?: number             // 1-12, optional
  day?: number               // 1-31, optional
  displayDate: string        // 'c. 213 BCE', '1559', '10 May 1933'
  era: TimelineEra
  title: string
  summary: string
  image?: {
    url: string              // must pass isAllowedImageUrl (Wikimedia-only in practice)
    alt: string
    credit?: string
  }
  related?: {
    bookSlug?: string
    authorSlug?: string
    countryCode?: string     // ISO 3166-1 alpha-2, lowercase (e.g. 'us', 'de'). Resolves to /countries/<code>.
  }
  externalLink?: string      // wikipedia or similar reference
}

export const TIMELINE_ERAS: { id: TimelineEra; label: string; intro: string }[] = [
  {
    id: 'ancient',
    label: 'Ancient',
    intro:
      'Censorship is older than the printing press. Across China, Greece, and Rome, rulers learned early that ideas were as dangerous as armies.',
  },
  {
    id: 'medieval-early-modern',
    label: 'Medieval & Early Modern',
    intro:
      'When religious authority and the printing press collided in the 15th and 16th centuries, censorship moved from improvised decree to bureaucratic system — and stayed that way for four hundred years.',
  },
  {
    id: 'enlightenment',
    label: 'Enlightenment',
    intro:
      'In the 18th century, censorship met organised resistance for the first time. The argument that individuals could decide for themselves what to read was, at the time, genuinely revolutionary.',
  },
  {
    id: '19c',
    label: '19th century',
    intro:
      'The 19th century codified censorship into law. Obscenity replaced heresy as the headline charge, and the courtroom replaced the bonfire.',
  },
  {
    id: '20c',
    label: '20th century',
    intro:
      'The 20th century turned censorship into both a weapon of totalitarianism and a recurring legal question for democracies. Books were burned, banned, smuggled, and acquitted — sometimes within the same decade.',
  },
  {
    id: '21c',
    label: '21st century',
    intro:
      'In the digital era, banning a book no longer removes it from the world. But coordinated school-board campaigns, state-level lists, and platform moderation prove the instinct has not weakened — only changed shape.',
  },
]

export const TIMELINE_EVENTS: TimelineEvent[] = [
  // ── Ancient ────────────────────────────────────────────────────────────
  {
    slug: 'qin-shi-huang-burning-of-books-213-bce',
    year: -213,
    displayDate: 'c. 213 BCE',
    era: 'ancient',
    title: 'Qin Shi Huang orders the burning of books',
    summary:
      'Emperor Qin Shi Huang ordered the destruction of Confucian texts and the burial alive of scholars to consolidate ideological control over a newly unified China. The earliest documented state-organised mass book destruction.',
    related: { countryCode: 'cn' },
    externalLink: 'https://en.wikipedia.org/wiki/Burning_of_books_and_burying_of_scholars',
  },
  {
    slug: 'ovid-banished-ars-amatoria-8',
    year: 8,
    displayDate: '8 CE',
    era: 'ancient',
    title: 'Ovid is banished; Ars Amatoria removed from Roman libraries',
    summary:
      'Augustus exiled Ovid to the Black Sea and ordered his Ars Amatoria pulled from public libraries — one of the first recorded cases of a state suppressing a specific literary work because of its content.',
    related: { bookSlug: 'ars-amatoria', authorSlug: 'ovid' },
    externalLink: 'https://en.wikipedia.org/wiki/Ars_Amatoria',
  },
  {
    slug: 'diocletian-destruction-of-scriptures-303',
    year: 303,
    displayDate: '303 CE',
    era: 'ancient',
    title: 'Diocletian orders Christian scriptures destroyed',
    summary:
      'During the Great Persecution, Roman authorities ordered the surrender and burning of Christian sacred texts across the empire. Targeting a religion through its books, not just its adherents.',
    externalLink: 'https://en.wikipedia.org/wiki/Diocletianic_Persecution',
  },

  // ── Medieval & Early Modern ────────────────────────────────────────────
  {
    slug: 'library-of-alexandria-640',
    year: 640,
    displayDate: '640 CE',
    era: 'medieval-early-modern',
    title: 'The Library of Alexandria is destroyed (final phase)',
    summary:
      'After centuries of partial destruction under Caesar and later emperors, the remnants of the world\'s greatest ancient library are recorded as lost — by tradition, the scrolls used as fuel for Alexandria\'s bathhouses. The most-cited shorthand in any history of suppressed knowledge.',
    related: { countryCode: 'eg' },
    externalLink: 'https://en.wikipedia.org/wiki/Destruction_of_the_Library_of_Alexandria',
  },
  {
    slug: 'savonarola-bonfire-of-the-vanities-1497',
    year: 1497,
    month: 2,
    displayDate: 'February 1497',
    era: 'medieval-early-modern',
    title: 'Savonarola lights the Bonfire of the Vanities in Florence',
    summary:
      'The Dominican friar Girolamo Savonarola directs his followers to burn books, paintings, and manuscripts in the Piazza della Signoria — including works by Boccaccio and Petrarch. A year later, after his fall from power, Savonarola himself is burned in the same square.',
    image: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Hanging_and_burning_of_Girolamo_Savonarola_in_Florence.jpg',
      alt: 'Period engraving of Savonarola hanged and burned on the Piazza della Signoria, Florence, May 1498',
      credit: 'After Francesco Rosselli, c. 1498 / Wikimedia Commons (public domain)',
    },
    related: { countryCode: 'it' },
    externalLink: 'https://en.wikipedia.org/wiki/Bonfire_of_the_vanities',
  },
  {
    slug: 'tyndale-new-testament-burned-1526',
    year: 1526,
    displayDate: '1526',
    era: 'medieval-early-modern',
    title: 'William Tyndale\'s English New Testament is publicly burned',
    summary:
      'Bishop Cuthbert Tunstall orders copies of Tyndale\'s English translation of the New Testament burned at St Paul\'s Cross in London. Ten years later, Tyndale himself is strangled and burned at the stake near Brussels — for the crime of translating the Bible into vernacular English.',
    related: { countryCode: 'gb' },
    externalLink: 'https://en.wikipedia.org/wiki/Tyndale_Bible',
  },
  {
    slug: 'gutenberg-press-1450s',
    year: 1450,
    displayDate: 'c. 1450',
    era: 'medieval-early-modern',
    title: 'Gutenberg builds a movable-type press',
    summary:
      'Johannes Gutenberg\'s press in Mainz makes mass-produced books possible for the first time. Within a century, every major censorship apparatus in Europe would be a response to this single invention.',
    image: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Metal_movable_type.jpg/960px-Metal_movable_type.jpg',
      alt: 'Metal movable type, of the kind used in Gutenberg-era printing presses',
      credit: 'Wikimedia Commons (public domain)',
    },
    externalLink: 'https://en.wikipedia.org/wiki/Printing_press',
  },
  {
    slug: 'luther-works-burned-1521',
    year: 1521,
    month: 5,
    displayDate: 'May 1521',
    era: 'medieval-early-modern',
    title: 'Luther\'s works are publicly burned across Europe',
    summary:
      'After the Diet of Worms, the Edict of Worms declared Martin Luther an outlaw and ordered his writings burned. The Catholic Church\'s reaction to Reformation pamphlets accelerated the move toward systematic book censorship.',
    externalLink: 'https://en.wikipedia.org/wiki/Edict_of_Worms',
  },
  {
    slug: 'index-librorum-prohibitorum-1559',
    year: 1559,
    displayDate: '1559',
    era: 'medieval-early-modern',
    title: 'The Catholic Church publishes the Index Librorum Prohibitorum',
    summary:
      'Pope Paul IV issues the first official Index of forbidden books. Over four centuries it would list works by Galileo, Descartes, Locke, Voltaire, Spinoza, and thousands of others — only formally abolished in 1966.',
    image: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Index_Librorum_Prohibitorum_1.jpg',
      alt: 'Title page of the 1559 Index Librorum Prohibitorum',
      credit: 'Wikimedia Commons (public domain)',
    },
    externalLink: 'https://en.wikipedia.org/wiki/Index_Librorum_Prohibitorum',
  },
  {
    slug: 'galileo-dialogue-banned-1633',
    year: 1633,
    displayDate: '1633',
    era: 'medieval-early-modern',
    title: 'Galileo\'s Dialogue is added to the Index after his Inquisition trial',
    summary:
      'The Roman Inquisition convicts Galileo of heresy for defending heliocentrism. His Dialogue Concerning the Two Chief World Systems is placed on the Index, where it remains until 1835.',
    image: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Galileo_facing_the_Roman_Inquisition.jpg/960px-Galileo_facing_the_Roman_Inquisition.jpg',
      alt: 'Galileo Galilei facing the Roman Inquisition, painting by Cristiano Banti, 1857',
      credit: 'Cristiano Banti, 1857 / Wikimedia Commons (public domain)',
    },
    related: { authorSlug: 'galileo-galilei' },
    externalLink: 'https://en.wikipedia.org/wiki/Galileo_affair',
  },
  {
    slug: 'morton-new-english-canaan-banned-1637',
    year: 1637,
    displayDate: '1637',
    era: 'medieval-early-modern',
    title: 'Thomas Morton\'s New English Canaan is banned in Massachusetts',
    summary:
      'The Puritan authorities of the Massachusetts Bay Colony suppress Thomas Morton\'s satirical account of New England — a book mocking their settlements and defending Indigenous customs. Often cited as the first book banned in what would become the United States.',
    related: { countryCode: 'us' },
    externalLink: 'https://en.wikipedia.org/wiki/New_English_Canaan',
  },
  {
    slug: 'milton-areopagitica-1644',
    year: 1644,
    displayDate: '1644',
    era: 'medieval-early-modern',
    title: 'Milton publishes Areopagitica — the first great anti-censorship argument',
    summary:
      'John Milton\'s pamphlet against pre-publication licensing in England is the foundational philosophical case against book censorship. It would be cited in free-speech rulings for the next three centuries.',
    related: { authorSlug: 'john-milton' },
    externalLink: 'https://en.wikipedia.org/wiki/Areopagitica',
  },
  {
    slug: 'spinoza-theologico-political-treatise-1670',
    year: 1670,
    displayDate: '1670',
    era: 'medieval-early-modern',
    title: 'Spinoza\'s Theologico-Political Treatise is banned in Amsterdam',
    summary:
      'Published anonymously, Spinoza\'s defence of intellectual freedom is banned in the Dutch Republic within four years and placed on the Catholic Index. One of the most important and most suppressed texts of the early Enlightenment.',
    related: { bookSlug: 'theologico-political-treatise', authorSlug: 'baruch-spinoza' },
    externalLink: 'https://en.wikipedia.org/wiki/Theologico-Political_Treatise',
  },

  // ── Enlightenment ──────────────────────────────────────────────────────
  {
    slug: 'montesquieu-spirit-of-the-laws-1751',
    year: 1751,
    displayDate: '1751',
    era: 'enlightenment',
    title: 'Montesquieu\'s Spirit of the Laws placed on the Index',
    summary:
      'The foundational text on the separation of powers — later built into the US Constitution — is condemned by the Catholic Church and banned in parts of France.',
    related: { bookSlug: 'the-spirit-of-the-laws', authorSlug: 'montesquieu', countryCode: 'fr' },
    externalLink: 'https://en.wikipedia.org/wiki/The_Spirit_of_Law',
  },
  {
    slug: 'voltaire-candide-banned-1759',
    year: 1759,
    displayDate: '1759',
    era: 'enlightenment',
    title: 'Voltaire\'s Candide is banned in Paris and Geneva on publication',
    summary:
      'Within weeks of release, Candide is suppressed in France, Geneva, Rome, and across Catholic Europe for blasphemy, sedition, and obscenity. It promptly becomes one of the bestselling books of the 18th century.',
    related: { bookSlug: 'candide', authorSlug: 'voltaire', countryCode: 'fr' },
    externalLink: 'https://en.wikipedia.org/wiki/Candide',
  },
  {
    slug: 'paine-rights-of-man-1792',
    year: 1792,
    displayDate: '1792',
    era: 'enlightenment',
    title: 'Thomas Paine is prosecuted in Britain for Rights of Man',
    summary:
      'Paine is tried in absentia for seditious libel in London. The book becomes one of the most-printed political pamphlets of the era — censorship as advertisement, a pattern that would recur for the next two centuries.',
    related: { bookSlug: 'rights-of-man', authorSlug: 'thomas-paine', countryCode: 'gb' },
    externalLink: 'https://en.wikipedia.org/wiki/Rights_of_Man',
  },

  // ── 19th century ───────────────────────────────────────────────────────
  {
    slug: 'flaubert-madame-bovary-trial-1857',
    year: 1857,
    month: 1,
    displayDate: 'January 1857',
    era: '19c',
    title: 'Flaubert is tried for obscenity over Madame Bovary',
    summary:
      'The French state prosecutes Flaubert for an "outrage to public morality" after serialising Madame Bovary. He is acquitted; sales explode. The same court would convict Baudelaire later that year.',
    related: { bookSlug: 'madame-bovary', authorSlug: 'gustave-flaubert', countryCode: 'fr' },
    externalLink: 'https://en.wikipedia.org/wiki/Madame_Bovary',
  },
  {
    slug: 'baudelaire-fleurs-du-mal-1857',
    year: 1857,
    month: 8,
    displayDate: 'August 1857',
    era: '19c',
    title: 'Baudelaire is convicted for Les Fleurs du Mal',
    summary:
      'Six poems are ordered struck from Les Fleurs du Mal for offending public morality. The ban on those six poems would not be formally lifted in France until 1949 — nearly a century later.',
    related: { bookSlug: 'les-fleurs-du-mal', authorSlug: 'charles-baudelaire', countryCode: 'fr' },
    externalLink: 'https://en.wikipedia.org/wiki/Les_Fleurs_du_mal',
  },
  {
    slug: 'comstock-act-1873',
    year: 1873,
    month: 3,
    day: 3,
    displayDate: '3 March 1873',
    era: '19c',
    title: 'The US Congress passes the Comstock Act',
    summary:
      'The Comstock Act makes it a federal crime to send "obscene, lewd or lascivious" material through the mail. Definitions are left to enforcers — and would, for sixty years, include works by Joyce, Lawrence, and Sanger.',
    related: { countryCode: 'us' },
    externalLink: 'https://en.wikipedia.org/wiki/Comstock_laws',
  },
  {
    slug: 'huckleberry-finn-excluded-concord-1885',
    year: 1885,
    displayDate: '1885',
    era: '19c',
    title: 'Concord Public Library excludes Huckleberry Finn',
    summary:
      'The Concord, Massachusetts library committee removes Mark Twain\'s novel from its collection within weeks of publication, calling it "rough, coarse and inelegant." School-board exclusions of the same book would recur, in identical language, for the next 140 years.',
    related: { bookSlug: 'the-adventures-of-huckleberry-finn', authorSlug: 'mark-twain', countryCode: 'us' },
    externalLink: 'https://en.wikipedia.org/wiki/Adventures_of_Huckleberry_Finn#Controversy',
  },

  // ── 20th century ───────────────────────────────────────────────────────
  {
    slug: 'well-of-loneliness-trial-1928',
    year: 1928,
    month: 11,
    displayDate: 'November 1928',
    era: '20c',
    title: 'The Well of Loneliness is judged obscene in Britain',
    summary:
      'A London magistrate orders all copies of Radclyffe Hall\'s novel destroyed for its sympathetic portrayal of a lesbian relationship. It would not be legally republished in the UK until 1949.',
    related: { bookSlug: 'the-well-of-loneliness', authorSlug: 'radclyffe-hall', countryCode: 'gb' },
    externalLink: 'https://en.wikipedia.org/wiki/The_Well_of_Loneliness',
  },
  {
    slug: 'nazi-book-burnings-1933',
    year: 1933,
    month: 5,
    day: 10,
    displayDate: '10 May 1933',
    era: '20c',
    title: 'Nazi book burnings at the Opernplatz, Berlin',
    summary:
      'Nazi-aligned students publicly burn tens of thousands of books across Berlin and dozens of German cities. The targets — Jewish, socialist, pacifist, and liberal authors — are chosen to erase entire schools of thought from German culture.',
    image: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Bundesarchiv_Bild_102-14597%2C_Berlin%2C_Opernplatz%2C_B%C3%BCcherverbrennung.jpg/1280px-Bundesarchiv_Bild_102-14597%2C_Berlin%2C_Opernplatz%2C_B%C3%BCcherverbrennung.jpg',
      alt: 'Nazi book burning at the Opernplatz in Berlin, May 1933',
      credit: 'Bundesarchiv / Wikimedia Commons (CC-BY-SA 3.0 DE)',
    },
    related: { countryCode: 'de' },
    externalLink: 'https://en.wikipedia.org/wiki/Nazi_book_burnings',
  },
  {
    slug: 'ulysses-cleared-1933',
    year: 1933,
    month: 12,
    day: 6,
    displayDate: '6 December 1933',
    era: '20c',
    title: 'A US federal judge rules Ulysses is not obscene',
    summary:
      'Judge John Woolsey\'s decision in United States v. One Book Called Ulysses ends the eleven-year US import ban on Joyce\'s novel. The ruling reshapes American obscenity law — a book must now be judged as a whole, not on isolated passages.',
    related: { bookSlug: 'ulysses', authorSlug: 'james-joyce', countryCode: 'us' },
    externalLink: 'https://en.wikipedia.org/wiki/United_States_v._One_Book_Called_Ulysses',
  },
  {
    slug: 'quebec-padlock-act-1937',
    year: 1937,
    displayDate: '1937',
    era: '20c',
    title: 'Quebec passes the Padlock Act',
    summary:
      'The Duplessis government empowers the attorney general to padlock buildings and seize any printed material judged to propagate "communism or bolshevism." The law would stand for twenty years before the Supreme Court of Canada struck it down in 1957.',
    related: { countryCode: 'ca' },
    externalLink: 'https://en.wikipedia.org/wiki/Padlock_Law',
  },
  {
    slug: 'lady-chatterley-trial-1960',
    year: 1960,
    month: 11,
    day: 2,
    displayDate: '2 November 1960',
    era: '20c',
    title: 'Penguin Books is acquitted in the Lady Chatterley\'s Lover trial',
    summary:
      'A London jury clears Penguin of obscenity for publishing the unexpurgated Lady Chatterley\'s Lover. Within a year Penguin sells two million copies — the trial that ended Britain\'s old obscenity regime and started the 1960s in earnest.',
    related: { bookSlug: 'lady-chatterleys-lover', authorSlug: 'd-h-lawrence', countryCode: 'gb' },
    externalLink: 'https://en.wikipedia.org/wiki/R_v_Penguin_Books_Ltd',
  },
  {
    slug: 'solzhenitsyn-gulag-archipelago-seized-1973',
    year: 1973,
    month: 9,
    displayDate: 'September 1973',
    era: '20c',
    title: 'The KGB seizes a manuscript of The Gulag Archipelago',
    summary:
      'After the KGB interrogates a typist into revealing a hidden copy, Solzhenitsyn authorises publication abroad. He is stripped of Soviet citizenship and expelled in 1974. The book is banned across the USSR until 1989.',
    image: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Aleksandr_Solzhenitsyn_1974crop.jpg/960px-Aleksandr_Solzhenitsyn_1974crop.jpg',
      alt: 'Aleksandr Solzhenitsyn photographed shortly after his expulsion from the Soviet Union, 1974',
      credit: 'Bert Verhoeff for Anefo, 1974 / Wikimedia Commons (CC0)',
    },
    related: { bookSlug: 'the-gulag-archipelago', authorSlug: 'aleksandr-solzhenitsyn' },
    externalLink: 'https://en.wikipedia.org/wiki/The_Gulag_Archipelago',
  },
  {
    slug: 'drake-school-board-burns-slaughterhouse-five-1973',
    year: 1973,
    month: 11,
    displayDate: 'November 1973',
    era: '20c',
    title: 'A North Dakota school board burns Slaughterhouse-Five',
    summary:
      'The school board of Drake, North Dakota orders 32 copies of Vonnegut\'s Slaughterhouse-Five and 60 copies of Dickey\'s Deliverance burned in the school furnace, citing profanity and homosexual references. The teacher who assigned them, Bruce Severy, is fired.',
    related: { bookSlug: 'slaughterhouse-five', authorSlug: 'kurt-vonnegut', countryCode: 'us' },
    externalLink: 'https://en.wikipedia.org/wiki/Slaughterhouse-Five#Censorship',
  },
  {
    slug: 'island-trees-v-pico-1982',
    year: 1982,
    month: 6,
    day: 25,
    displayDate: '25 June 1982',
    era: '20c',
    title: 'US Supreme Court decides Island Trees v. Pico',
    summary:
      'The Court rules that school boards cannot remove library books simply because they dislike the ideas in them. The decision still anchors most US school-ban litigation — including the wave of cases now filed under state laws written to work around it.',
    related: { countryCode: 'us' },
    externalLink: 'https://en.wikipedia.org/wiki/Island_Trees_School_District_v._Pico',
  },
  {
    slug: 'banned-books-week-launched-1982',
    year: 1982,
    month: 9,
    displayDate: 'September 1982',
    era: '20c',
    title: 'Banned Books Week is launched',
    summary:
      'The American Library Association, the American Booksellers Association, and four other organisations co-found Banned Books Week as a direct response to a sharp rise in school library challenges. Now observed in over 90 countries.',
    related: { countryCode: 'us' },
    externalLink: 'https://www.ala.org/bbooks/banned-books-week',
  },
  {
    slug: 'satanic-verses-fatwa-1989',
    year: 1989,
    month: 2,
    day: 14,
    displayDate: '14 February 1989',
    era: '20c',
    title: 'Ayatollah Khomeini issues a fatwa against Salman Rushdie',
    summary:
      'Iran\'s Supreme Leader calls for the killing of Rushdie over The Satanic Verses, which is banned in over a dozen countries within months. Rushdie spends a decade in hiding; his Japanese translator is murdered in 1991.',
    related: { bookSlug: 'the-satanic-verses', authorSlug: 'salman-rushdie', countryCode: 'ir' },
    externalLink: 'https://en.wikipedia.org/wiki/The_Satanic_Verses_controversy',
  },
  {
    slug: 'sarajevo-national-library-shelled-1992',
    year: 1992,
    month: 8,
    day: 25,
    displayDate: '25 August 1992',
    era: '20c',
    title: 'Serbian forces shell the National Library of Bosnia',
    summary:
      'During the siege of Sarajevo, the Vijećnica is shelled with incendiary rounds. Snipers fire on those trying to rescue books. Between 1.5 and 3 million volumes burn — the largest single book-burning of the 20th century.',
    related: { countryCode: 'ba' },
    externalLink: 'https://en.wikipedia.org/wiki/National_and_University_Library_of_Bosnia_and_Herzegovina#Siege_of_Sarajevo',
  },

  // ── 21st century ───────────────────────────────────────────────────────
  {
    slug: 'taliban-libraries-destroyed-2001',
    year: 2001,
    displayDate: '2001',
    era: '21c',
    title: 'Taliban destroy libraries and manuscripts across Afghanistan',
    summary:
      'The first Taliban regime carries out a campaign of cultural destruction — Buddhist statues at Bamiyan, but also libraries, archives, and historical manuscripts. Documented destruction continues after the 2021 takeover.',
    related: { countryCode: 'af' },
    externalLink: 'https://en.wikipedia.org/wiki/Cultural_destruction_by_the_Taliban',
  },
  {
    slug: 'mein-kampf-bavarian-copyright-expires-2016',
    year: 2016,
    month: 1,
    displayDate: 'January 2016',
    era: '21c',
    title: 'Bavaria\'s Mein Kampf copyright expires; an annotated edition appears',
    summary:
      'Seventy years after Hitler\'s death, Bavaria\'s copyright over Mein Kampf lapses. The first new German edition in over half a century is published with thousands of scholarly annotations — censorship replaced by contextualisation.',
    related: { bookSlug: 'mein-kampf', countryCode: 'de' },
    externalLink: 'https://en.wikipedia.org/wiki/Mein_Kampf#Copyright',
  },
  {
    slug: 'us-school-bans-surge-2021',
    year: 2021,
    displayDate: '2021',
    era: '21c',
    title: 'A coordinated US school-ban campaign begins',
    summary:
      'PEN America and the American Library Association both document a step-change in challenges: organised groups submit lists of hundreds of titles to school boards across multiple states. Books featuring LGBTQ+ characters or addressing race are disproportionately targeted.',
    image: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Moms_for_Liberty_stage_%2853459777751%29.jpg/960px-Moms_for_Liberty_stage_%2853459777751%29.jpg',
      alt: 'Stage at a Moms for Liberty rally at the Iowa State Capitol — one of the organised groups driving the US school-ban surge documented by PEN America and the ALA',
      credit: 'Gage Skidmore / Wikimedia Commons (CC BY-SA 2.0)',
    },
    related: { countryCode: 'us' },
    externalLink: 'https://pen.org/banned-book-list/',
  },
  {
    slug: 'florida-hb-1467-2023',
    year: 2023,
    displayDate: '2023',
    era: '21c',
    title: 'Florida HB 1467 triggers district-wide school pulls',
    summary:
      'Under Florida\'s 2022 review law, several districts respond by pulling thousands of titles for re-evaluation. Photos of empty school library shelves go viral. Similar laws follow in over a dozen US states.',
    related: { countryCode: 'us' },
    externalLink: 'https://www.flsenate.gov/Session/Bill/2022/1467',
  },
  {
    slug: 'pen-america-10000-bans-2024',
    year: 2024,
    displayDate: '2024',
    era: '21c',
    title: 'PEN America records 10,000+ school book bans in a single year',
    summary:
      'PEN America documents 10,046 ban instances across US public schools in the 2023-24 academic year — nearly triple the previous year. Florida and Iowa account for the majority.',
    related: { countryCode: 'us' },
    externalLink: 'https://pen.org/report/banned-2023-2024/',
  },
  {
    slug: 'belarus-extremist-literature-lists-2024',
    year: 2024,
    displayDate: '2024',
    era: '21c',
    title: 'Belarus expands its "extremist materials" list',
    summary:
      'The Lukashenko regime continues to add books, websites, and social-media channels to a state list of "extremist materials" — possession of which is a criminal offence. PEN Belarus documents hundreds of writers and journalists prosecuted under these laws.',
    related: { countryCode: 'by' },
    externalLink: 'https://penbelarus.org/en/',
  },
]

export function sortedTimelineEvents(): TimelineEvent[] {
  return [...TIMELINE_EVENTS].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    if ((a.month ?? 13) !== (b.month ?? 13)) return (a.month ?? 13) - (b.month ?? 13)
    return (a.day ?? 32) - (b.day ?? 32)
  })
}

export function eventsByEra(): { era: typeof TIMELINE_ERAS[number]; events: TimelineEvent[] }[] {
  const sorted = sortedTimelineEvents()
  return TIMELINE_ERAS.map(era => ({
    era,
    events: sorted.filter(e => e.era === era.id),
  })).filter(group => group.events.length > 0)
}
