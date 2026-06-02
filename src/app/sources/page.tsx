// Sources page is data-driven but the ban_sources table changes rarely
// (only on import runs, which happen at most a few times per week). Cache
// the rendered output for an hour — far cheaper than re-aggregating join
// counts on every page hit, and the staleness window matches how often
// the underlying data actually changes.
export const revalidate = 3600

import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const metadata = {
  title: 'Sources',
  description:
    'Sources and methodology behind the Banned Books catalogue. Primary ban databases, per-jurisdiction Wikipedia pages, government records, NGO reports, and the enrichment APIs used for covers and bios.',
  alternates: { canonical: '/sources' },
}

type SourceEntry = {
  name: string
  url: string
  description: string
  // Substring matched against ban_sources.source_url (case-insensitive) to
  // pull live ban-count totals from the DB. Multiple substrings are unioned
  // — e.g. matching all per-section URLs of a multi-anchor Wikipedia page.
  // Omit for sources that don't produce bans (enrichment APIs).
  match?: readonly string[]
  // 'planned' renders the entry greyed-out with a "planned" badge — used for
  // adapters we've designed but not yet shipped (Ukrainian gazette, Russian
  // extremism register, etc.).
  planned?: boolean
}

type Category = {
  heading: string
  blurb: string
  entries: SourceEntry[]
}

const CATEGORIES: readonly Category[] = [
  {
    heading: 'Primary ban databases',
    blurb:
      'Large structured catalogues maintained by free-speech organisations. Most of our US data comes from PEN America and the ALA; international coverage relies heavily on Index on Censorship, Article 19, and PEN International.',
    entries: [
      {
        name: 'PEN America',
        url: 'https://pen.org',
        description:
          'PEN America\'s Index of School Book Bans tracks book removals across US public schools — the most comprehensive single source of US educational censorship data. Per-author and per-case pages (pen.org/individual-case/…, pen.org/press-release/…) document detained writers internationally (Ahmed Naji Egypt, etc.).',
        match: ['pen.org'],
      },
      {
        name: 'American Library Association — Office for Intellectual Freedom',
        url: 'https://www.ala.org/bbooks',
        description:
          'The ALA documents challenged and banned books across the US. Their decade lists and annual "Top 10 Most Challenged Books" provide the canonical historical record of US challenges.',
        match: ['ala.org'],
      },
      {
        name: 'Freedom to Read (Canada)',
        url: 'https://www.freedomtoread.ca/challenged-works/',
        description:
          'The Book and Periodical Council of Canada\'s Freedom to Read project maintains the canonical record of Canadian book challenges — a per-title "challenged works" database plus annual surveys (run with the CFLA) documenting school-board, public-library and government cases with location, year, reason and outcome. The Canadian counterpart to the ALA, and the basis of our Canadian challenge coverage.',
        match: ['freedomtoread.ca'],
      },
      {
        name: 'Index on Censorship',
        url: 'https://www.indexoncensorship.org',
        description:
          'UK-based publication documenting censorship cases and case studies worldwide, including literary suppression in authoritarian regimes.',
        match: ['indexoncensorship.org'],
      },
      {
        name: 'Article 19',
        url: 'https://www.article19.org',
        description:
          'Global free-expression organisation. Their reports cite specific banned titles in Malaysia, Pakistan, the Gulf states, and other restrictive jurisdictions where structured ban registers don\'t exist publicly.',
        match: ['article19.org'],
      },
      {
        name: 'PEN International',
        url: 'https://pen-international.org',
        description:
          'PEN International\'s Writers in Prison Committee documents authors imprisoned and works banned worldwide. Distinct from PEN America\'s US-focused data.',
        match: ['pen-international.org'],
      },
      {
        name: 'PEN Belarus',
        url: 'https://bannedbooks.penbelarus.org',
        description:
          'Belarusian PEN centre (operating in exile, funded by Norway and the Human Rights House Foundation) maintains the public catalogue of Lukashenko-era book bans: the Ministry of Information\'s "Extremist Materials" list, the "Harmful to National Interests" list, plus curated profiles for Tsarist-era (1800s), Stalin-era (Glavlit Order No. 33, 1937), and international authors hit by modern bans. Separate organisation from PEN International.',
        match: ['penbelarus.org'],
      },
      {
        name: 'Reporters Without Borders (RSF)',
        url: 'https://rsf.org',
        description:
          'RSF\'s World Press Freedom Index contextualises bans within broader media-freedom rankings. Used as country-level background rather than per-title data.',
      },
      {
        name: 'Human Rights Watch',
        url: 'https://www.hrw.org',
        description:
          'HRW\'s annual World Report and country-specific reports document book bans, author imprisonments, and publishing restrictions across jurisdictions where structured ban registers don\'t exist publicly. Cited per-country-chapter (e.g. /world-report/2024/country-chapters/russia).',
        match: ['hrw.org'],
      },
      {
        name: 'Amnesty International',
        url: 'https://www.amnesty.org',
        description:
          'Amnesty country pages and Urgent Action releases document specific cases of authors and publishers detained or prosecuted for prohibited works — used as cite-of-record for individual ban events in restrictive jurisdictions.',
        match: ['amnesty.org'],
      },
      {
        name: 'IFEX',
        url: 'https://ifex.org',
        description:
          'Global network of free-expression organisations. Member alerts document specific banned/seized titles and prosecuted authors — cited e.g. for the Algiers Book Fair bans of Mohamed Benchicou\'s books.',
        match: ['ifex.org'],
      },
      {
        name: 'Forum 18',
        url: 'https://www.forum18.org',
        description:
          'Norwegian religious-freedom watchdog; the cite-of-record for title-level court bans of specific religious books in Central Asia and the Caucasus (Kazakhstan, etc.), often with case dates and court names.',
        match: ['forum18.org'],
      },
    ],
  },
  {
    heading: 'Wikipedia — per-jurisdiction catalogues',
    blurb:
      'Wikipedia maintains a small number of structured book-ban tables that are imported in bulk via our Wikipedia parser. Each per-row source URL points at the section anchor on the relevant Wikipedia article.',
    entries: [
      {
        name: 'Wikipedia — List of books banned by governments',
        url: 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments',
        description:
          'Master aggregator covering 56 country sections from Albania to Yugoslavia. Each `== Country ==` section maps to its own ISO country code at import time.',
        match: ['List_of_books_banned_by_governments'],
      },
      {
        name: 'Wikipedia — Book censorship in Hong Kong',
        url: 'https://en.wikipedia.org/wiki/Book_censorship_in_Hong_Kong',
        description:
          'Post-2020 NSL-era list of books removed from Hong Kong public libraries, school libraries, ebook databases, and seized by Customs (CSD). Bilingual Han/Latin titles preserved natively.',
        match: ['Book_censorship_in_Hong_Kong'],
      },
      {
        name: 'Wikipedia — List of books banned in New Zealand',
        url: 'https://en.wikipedia.org/wiki/List_of_books_banned_in_New_Zealand',
        description:
          'Three-era catalogue: pre-1963 customs bans (incl. WWI/WWII wartime decrees), the 1963–1994 Indecent Publications Tribunal, and the 1994-present Office of Film and Literature Classification.',
        match: ['List_of_books_banned_in_New_Zealand'],
      },
      {
        name: 'Wikipedia — List of books banned in India',
        url: 'https://en.wikipedia.org/wiki/List_of_books_banned_in_India',
        description:
          'Combined Nationwide + Statewide + Other-Challenged tables covering colonial-era bans through to present-day Maharashtra/Tamil Nadu/Gujarat state bans.',
        match: ['List_of_books_banned_in_India'],
      },
      {
        name: 'Wikipedia — Book censorship in China',
        url: 'https://en.wikipedia.org/wiki/Book_censorship_in_China',
        description:
          'PRC-era bans on mainland Chinese publications and import-prohibited foreign works. Companion to the Hong Kong dataset.',
        match: ['Book_censorship_in_China'],
      },
      {
        name: 'Wikipedia — Book censorship in Iran',
        url: 'https://en.wikipedia.org/wiki/Book_censorship_in_Iran',
        description:
          'Iranian Ministry of Culture and Islamic Guidance permit revocations. Titles are transliterated Persian with English meanings preserved as subtitles.',
        match: ['Book_censorship_in_Iran'],
      },
      {
        name: 'Wikipedia — List of most commonly challenged books in the United States',
        url: 'https://en.wikipedia.org/wiki/List_of_most_commonly_challenged_books_in_the_United_States',
        description:
          'ALA cumulative challenge corpus with rank-by-decade columns. Distinct from the ALA OIF "Top 10" annual lists — this is the long-tail comprehensive register.',
        match: ['List_of_most_commonly_challenged_books'],
      },
      {
        name: 'Wikipedia — List of authors and works on the Index Librorum Prohibitorum',
        url: 'https://en.wikipedia.org/wiki/List_of_authors_and_works_on_the_Index_Librorum_Prohibitorum',
        description:
          'Holy See\'s Index of Prohibited Books (1559–1966). Each row is one author with one or more banned works split out into individual entries (Machiavelli, Bruno, Hobbes, Descartes, etc.).',
        match: ['List_of_authors_and_works_on_the_Index_Librorum'],
      },
      {
        name: 'Wikipedia — Federal List of Extremist Materials (Russia)',
        url: 'https://en.wikipedia.org/wiki/Federal_List_of_Extremist_Materials',
        description:
          'Wikipedia overview of Russia\'s FSEM (maintained by the Ministry of Justice under the 2002 anti-extremism law, ~5,500 entries by 2024 — mostly pamphlets/videos/audio). Curated subset of identifiable books with authors and FSEM ordinals imported as RU bans (Hitler, Mussolini, Rosenberg, Dugin, Ford, Drumont, Wagner, Klimov, Platonov ×7, Yemelyanov, Khomeini, Hubbard, etc.).',
        match: ['Federal_List_of_Extremist_Materials'],
      },
      {
        name: 'Wikipedia — Russian book ban in Ukraine',
        url: 'https://en.wikipedia.org/wiki/Russian_book_ban_in_Ukraine',
        description:
          'Wikipedia article documenting Ukraine\'s 2015 ban of 38 Russian-nationalist titles (Dugin, Limonov, Glazyev) and subsequent expansions through 2022-2023 (complete ban on Russian + Belarusian book imports). Cited for the 2015 ban-wave entries.',
        match: ['Russian_book_ban_in_Ukraine'],
      },
      {
        name: 'Wikipedia — Undesirable Publications Act (Singapore)',
        url: 'https://en.wikipedia.org/wiki/Undesirable_Publications_Act',
        description:
          'Wikipedia article on Singapore\'s UPA 1967 — the statutory basis for Section 5 prohibition orders. Cross-referenced against the main "List of books banned by governments" Singapore section for the 31-entry batch.',
        match: ['Undesirable_Publications_Act'],
      },
      {
        name: 'Wikipedia — book and author articles (per-title citations)',
        url: 'https://en.wikipedia.org/',
        description:
          'For individually-curated entries, we cite the relevant book or author\'s Wikipedia article directly (e.g. en.wikipedia.org/wiki/Nineteen_Eighty-Four, en.wikipedia.org/wiki/Bohumil_Hrabal). Also includes non-English Wikipedias where the English article doesn\'t exist — Italian (it.wikipedia.org) for Fascist-era bans, Spanish/Romanian (es./ro.wikipedia.org) for Latin American and Romanian titles, Korean (ko.wikipedia.org), etc. These are manual curation, not bulk-imported.',
        match: ['en.wikipedia.org/wiki/', 'ko.wikipedia.org/wiki/', 'it.wikipedia.org/wiki/', 'es.wikipedia.org/wiki/', 'ro.wikipedia.org/wiki/'],
      },
      {
        name: 'Wikisource — Liste Otto (Nazi-era France, 1940–1944)',
        url: 'https://fr.wikisource.org/wiki/Ouvrages_litt%C3%A9raires_non_d%C3%A9sirables_en_France',
        description:
          'Full transcription on French Wikisource of the Liste Otto — the list of books "unwanted in France" issued by the German occupation\'s Propaganda-Staffel beginning September 1940 and revised through 1943. The 3rd edition (May 1943) contains roughly 1,000 named titles and entire bibliographies (Jewish authors, anti-Nazi authors, Communists, dissidents). Imported as the canonical FR-1940-1944 ban list.',
        match: ['fr.wikisource.org/wiki/ouvrages_litt'],
      },
      {
        name: 'French Wikipedia — Liste de livres censurés en France',
        url: 'https://fr.wikipedia.org/wiki/Liste_de_livres_censurés_en_France',
        description:
          'French Wikipedia\'s catalogue of books censored in France, including the Bibliothèque rose age-restriction decisions, Loi 1949 arrêtés against publications for minors, and the Liste Otto Nazi-occupation entries. Used alongside Légifrance for per-arrêté metadata.',
        match: ['fr.wikipedia.org/wiki/liste_de_livres'],
      },
    ],
  },
  {
    heading: 'Government & classification bodies',
    blurb:
      'Statutory censorship authorities and customs registers. Where the original gazette is available, we cite it directly so the legal basis for each ban is transparent.',
    entries: [
      {
        name: 'New Zealand Office of Film and Literature Classification',
        url: 'https://www.classificationoffice.govt.nz',
        description:
          'Statutory body that classifies publications as restricted, objectionable, or unrestricted under the Films, Videos, and Publications Classification Act 1993.',
        match: ['classificationoffice.govt.nz'],
      },
      {
        name: 'Australian Classification Board — Refused Classification',
        url: 'https://www.classification.gov.au',
        description:
          'Australian government registry of publications refused classification (effectively banned). Used as primary source for post-1970 Australian bans.',
        match: ['classification.gov.au'],
      },
      {
        name: 'Irish Censorship of Publications Act 1929 (Wikipedia)',
        url: 'https://en.wikipedia.org/wiki/Censorship_of_Publications_Act_1929',
        description:
          'The statute under which thousands of books were banned in Ireland between 1929 and the 1990s. Cited for the legal basis of historical Irish bans.',
        match: ['Censorship_of_Publications_Act_1929'],
      },
      {
        name: 'Légifrance — Journal officiel (France)',
        url: 'https://www.legifrance.gouv.fr',
        description:
          'French government legal database indexing the Journal officiel de la République française. Source for arrêtés issued by the Ministry of Interior under Article 14 of the Loi n° 49-956 du 16 juillet 1949 sur les publications destinées à la jeunesse, restricting publications from sale to minors. Each ban cites its JORFTEXT identifier.',
        match: ['legifrance.gouv.fr'],
      },
      {
        name: 'Malaysian Ministry of Home Affairs — KDN e-PQ register',
        url: 'https://epq.kdn.gov.my/e-pq/index.php?mod=public',
        description:
          'Senarai Perintah Larangan — the official public register of publication-ban orders issued by the Ministry of Home Affairs (Kementerian Dalam Negeri) under the Printing Presses and Publications Act 1984 and its predecessors. ~3,200 entries 1950–present; each ban\'s gazette legal-notice ("L.N. 263", "P.U. (A) 410", etc.) is preserved as the per-row locator.',
        match: ['epq.kdn.gov.my'],
      },
      {
        name: 'Indian Kanoon — court judgments',
        url: 'https://indiankanoon.org',
        description:
          'Open searchable database of Indian Supreme Court, High Court, and tribunal judgments. Used to source court rulings underlying nationwide and state-level book bans — each citation is a per-document permalink (indiankanoon.org/doc/NNNNN/).',
        match: ['indiankanoon.org'],
      },
      {
        name: 'UK National Archives',
        url: 'https://www.nationalarchives.gov.uk',
        description:
          'The UK government\'s public records archive. Cited for the legal-history paper trail behind statutory censorship instruments — most prominently the Section 28 origin documents (1986–2003).',
        match: ['nationalarchives.gov.uk'],
      },
      {
        name: 'FYI.org.nz — New Zealand Official Information requests',
        url: 'https://fyi.org.nz',
        description:
          'Crowd-sourced OIA-request archive. The specific request `list-of-banned-books` yielded the modern OFLC ban register.',
        match: ['fyi.org.nz'],
      },
      {
        name: 'Colorado Department of Higher Education',
        url: 'https://cdhe.colorado.gov/banned-book-list',
        description:
          'State-level US registry of books challenged or removed from Colorado public-school libraries.',
        match: ['cdhe.colorado.gov'],
      },
      {
        name: 'Singapore Ministry of Digital Development and Information (MDDI)',
        url: 'https://www.mddi.gov.sg',
        description:
          'Singapore\'s communications and information ministry (formerly Ministry of Communications and Information; the regulatory parent of IMDA). Cited via parliamentary-question responses and press releases for specific Undesirable Publications Act prohibition orders (2020 Understanding the Evil of Innovation, 2021 Menyingkap Rahsia Tentera Elit Briged Izzuddin Al-Qassam).',
        match: ['mddi.gov.sg'],
      },
      {
        name: 'French Senate — Compte rendu de séance',
        url: 'https://www.senat.fr',
        description:
          'Sénat de la République française parliamentary records. Cited for the legal-history paper trail behind the Loi n° 49-956 du 16 juillet 1949 sur les publications destinées à la jeunesse — the statutory basis for French Interior Ministry book-ban arrêtés.',
        match: ['senat.fr'],
      },
      {
        name: 'Oireachtas — Houses of the Oireachtas',
        url: 'https://www.oireachtas.ie',
        description:
          'Ireland\'s parliamentary records (Dáil + Seanad). Cited for the legislative history of the Censorship of Publications Act 1929 and modern Parliamentary Questions about its remaining provisions.',
        match: ['oireachtas.ie'],
      },
      {
        name: 'Nigerian Legal Information Institute (NigeriaLII)',
        url: 'https://nigerialii.org',
        description:
          'Open access database of Nigerian court judgments (Supreme Court, Court of Appeal). Cited for landmark seditious-publication cases (Nwankwo v State 1985, and earlier 1961 colonial-era judgments).',
        match: ['nigerialii.org'],
      },
      {
        name: 'Russian Ministry of Justice — Federal List of Extremist Materials (direct)',
        url: 'https://minjust.gov.ru/ru/extremist-materials/',
        description:
          'Direct citations to Russia\'s official FSEM register (Federal Law 114-FZ). Used selectively per-entry where Wikipedia coverage was incomplete. The full ~5,500-entry crawl remains a future scale-up (most entries are pamphlets/audio rather than books).',
        match: ['minjust.gov.ru'],
      },
      {
        name: 'Plano Nacional de Leitura — Lista de Livros Censurados (Portugal)',
        url: 'https://pnl2027.gov.pt',
        description:
          'Portugal\'s government National Reading Plan publishes a list of books censored under the Estado Novo dictatorship (1933–1974) — the cite-of-record for Salazar/Caetano-era Portuguese title bans.',
        match: ['pnl2027.gov.pt'],
      },
    ],
  },
  {
    heading: 'Historical & academic sources',
    blurb:
      'Institutional archives and academic catalogues that document bans the originating governments never published in structured form.',
    entries: [
      {
        name: 'United States Holocaust Memorial Museum — Book Burnings',
        url: 'https://www.ushmm.org/collections/bibliography/book-burnings',
        description:
          'USHMM bibliography of Nazi-era book burnings (May 1933 onward) and authors targeted by the Reichsschrifttumskammer.',
        match: ['ushmm.org'],
      },
      {
        name: 'South African History Archive — Banned books in South Africa',
        url: 'https://www.sahistory.org.za/article/banned-books-south-africa',
        description:
          'Apartheid-era catalogue under the Publications Act 1974 (~26,000 titles 1950–1990). Curated by SAHA from Department of Internal Affairs records.',
        match: ['sahistory.org.za'],
      },
      {
        name: 'The Literature Police — apartheid censor reports',
        url: 'https://theliteraturepolice.com',
        description:
          'Prof. Peter D. McDonald (University of Oxford) curated collection of original censor reports from the Western Cape Provincial Archives. PDF scans of decisions by the Publications Control Board and Publications Appeal Board on works by Coetzee, Gordimer, Brink, Breytenbach, La Guma, Modisane, Rive, and other South African writers (1958–1983).',
        match: ['theliteraturepolice.com'],
      },
      {
        name: 'Memoria Abierta — Argentina',
        url: 'https://www.memoriaabierta.org.ar',
        description:
          'Argentine human-rights archive consortium. Cited for books prohibited under the 1976–1983 military dictatorship.',
        match: ['memoriaabierta'],
      },
      {
        name: 'Comisión Provincial de la Memoria — Córdoba (APM)',
        url: 'https://apm.gov.ar',
        description:
          'Provincial human-rights archive in Córdoba, Argentina. Publishes the "Biblioteca de Libros Prohibidos" PDF catalogue (1st ed. March 2012) documenting 630+ titles prohibited under the military dictatorship\'s Proceso de Reorganización Nacional (1976–1983). PDF colophon explicitly permits non-commercial reproduction with attribution.',
        match: ['apm.gov.ar'],
      },
      {
        name: 'Václav Havel Library — dissident archive',
        url: 'https://www.vaclavhavel.cz',
        description:
          'Knihovna Václava Havla maintains the curated archive of Czechoslovak dissident publishing under normalization (1968–1989) — Charter 77, Edice Petlice samizdat, Power of the Powerless. Cited for Havel-era Czech bans (Kundera, Hrabal, Vaculík, Havel himself).',
        match: ['vaclavhavel.cz'],
      },
      {
        name: 'Władysław Szpilman estate',
        url: 'https://www.szpilman.net/',
        description:
          'Official archive of Władysław Szpilman (1911–2000) maintained by his family. Documents the Stalinist suppression of his 1946 Warsaw Ghetto memoir Death of a City and its 1998 restored republication.',
        match: ['szpilman.net'],
      },
      {
        name: 'The New York Review of Books',
        url: 'https://www.nybooks.com',
        description:
          'NYRB\'s essay archive (1963–present) and the NYRB Classics imprint together form a key source on Cold War-era dissident publishing — first English translations of Michnik, Kundera, Havel, and the historical record of their suppression.',
        match: ['nybooks.com'],
      },
      {
        name: 'Yale University Press',
        url: 'https://yalebooks.yale.edu',
        description:
          'Yale UP\'s introductions and catalogue pages document the censorship histories of works it republishes in English — used as primary citation for Nasr Hamid Abu Zayd\'s Critique of Religious Discourse (Egypt apostasy ruling 1995) and similar academic-press editions.',
        match: ['yalebooks.yale.edu'],
      },
      {
        name: 'LA Review of Books',
        url: 'https://lareviewofbooks.org',
        description:
          'Long-form literary essays covering author and book censorship cases — including detailed treatments of Rushdie\'s Shame (banned in Pakistan 1983 by Zia-ul-Haq), Vasyl Stus\'s gulag-written poetry, and other dissident-era works.',
        match: ['lareviewofbooks.org'],
      },
      {
        name: 'Max Lane — Indonesia studies',
        url: 'https://maxlaneonline.com',
        description:
          'Australian academic specialising in Indonesian politics. Cited for the March 2010 Attorney General book-banning wave (Roosa\'s Pretext for Mass Murder, Lekra Tak Membakar Buku, three religious titles) and its October 2010 nullification by the Indonesian Constitutional Court.',
        match: ['maxlaneonline.com'],
      },
      {
        name: 'Hungarian Conservative',
        url: 'https://www.hungarianconservative.com',
        description:
          'Hungarian English-language magazine. Used selectively for non-political historical reference (Béla Hamvas\'s communist-era silentium 1948–1989); for contemporary Hungarian press-freedom developments we triangulate against international sources.',
        match: ['hungarianconservative.com'],
      },
      {
        name: 'Masaryk University — Czechoslovak samizdat studies',
        url: 'https://is.muni.cz',
        description:
          'Brno-based Masaryk University publishes the canonical study materials on Czechoslovak samizdat-era publishing, including the dissident translation work of Tom Stoppard and the Petlice / Edice Expedice editions used for Vaculík, Havel, and Klíma works.',
        match: ['muni.cz'],
      },
      {
        name: 'Royal Literary Fund — Banned Books Week feature',
        url: 'https://www.rlf.org.uk',
        description:
          'UK writers\' benevolent fund (founded 1790). Their "Banned Books Week" feature profiles RLF-supported writers who faced censorship — used as citation of record for historical UK/Ireland bans on authors like D. H. Lawrence and Angus Wilson where the original gazette is no longer accessible.',
        match: ['rlf.org.uk'],
      },
      {
        name: 'Universität Innsbruck — Germanistik (DDR-Aufsatz)',
        url: 'https://webapp.uibk.ac.at/germanistik/histrom/docs/ddraufsatz.html',
        description:
          'Academic essay on East-German literature and the Druckgenehmigungsverfahren — the state-level pre-publication permit system that effectively functioned as censorship. Cited for DDR-era ban records alongside Wikipedia "Censorship in East Germany" and archived petersell.de pages.',
        match: ['uibk.ac.at'],
      },
      {
        name: 'Index Librorum Prohibitorum (Catholic Index, 1559–1966)',
        url: 'https://en.wikipedia.org/wiki/Index_Librorum_Prohibitorum',
        description:
          'Holy See\'s catalogue of prohibited books, discontinued in 1966. Imported via the per-author Wikipedia article (above) but cited at the Index level for collective entries.',
        match: ['/Index_Librorum_Prohibitorum'],
      },
      {
        name: 'University of Kansas — Spencer Research Library banned-books exhibition (1955, via Wayback)',
        url: 'https://wayback.archive-it.org/3577/20170328173200id_/http://liblamp.vm.ku.edu/spencer/exhibits/bannedbooks/bannedbooks.html',
        description:
          'KU Libraries\' 1955 historical exhibition He who destroyes a good Booke, kills reason it selfe — covering books that survived Fire, Sword and Censors. Per-country pages (England, Germany, Russia, France, Spain, US, Various) captured via Wayback Machine snapshots since the original liblamp.vm.ku.edu URL is no longer live.',
        match: ['wayback.archive-it.org/3577/'],
      },
      {
        name: 'European Proceedings — academic open-access',
        url: 'https://www.europeanproceedings.com',
        description:
          'Open-access social-sciences conference proceedings (Future Academy). Cited for academic studies on book-censorship history in specific jurisdictions where peer-reviewed coverage is otherwise paywalled.',
        match: ['europeanproceedings.com'],
      },
      {
        name: 'AFTE — Association for Freedom of Thought and Expression (Egypt)',
        url: 'https://afteegypt.org',
        description:
          'Cairo-based legal NGO defending freedom of expression. AFTE\'s English-language research arm documents Egyptian book confiscations under the Undesirable Publications Act, blasphemy prosecutions, and Cairo Book Fair customs seizures. The 2023 AFTE field report (afteegypt.org/research-en/2023/03/19/33849) catalogues confiscations across multiple Cairo Book Fair editions and individual prosecution cases.',
        match: ['afteegypt.org'],
      },
      {
        name: 'The File Room — Article 19 / Index on Censorship archive',
        url: 'https://www.ntticc.or.jp/en/feature/1995/The_Museum_Inside_The_Network/file.html',
        description:
          'Antoni Muntadas\'s 1994 net.art project The File Room — an online crowd-sourced censorship archive originally hosted by Chicago\'s Randolph Street Gallery and now preserved by NTT InterCommunication Center (Tokyo, Japan) and at thefileroom.org. Curated in cooperation with Article 19 and Index on Censorship. Cited as historical-archive source for late-20th-century censorship cases that pre-date modern HRW / PEN databases (e.g. Ethiopia\'s 1921 ban of Tekle Hawariat\'s Fabula).',
        match: ['ntticc.or.jp', 'thefileroom.org'],
      },
      {
        name: 'Mushakavanhu — None but Ourselves (Rhodesia history)',
        url: 'https://tinsmush.medium.com/books-rhodesia-forbade-my-parents-to-read-472c6',
        description:
          'Zimbabwean writer Tinashe Mushakavanhu\'s essay drawing on Julie Frederikse\'s book "None but Ourselves: Masses vs Media in the Making of Zimbabwe" — cataloguing books banned under the Ian Smith / Rhodesian Front white-minority regime (1965–1980). Used as the per-title cite-of-record for Rhodesia/Zimbabwe ban entries given the very limited primary-source documentation that survives from Salisbury archives.',
        match: ['tinsmush.medium.com'],
      },
      {
        name: 'Karapatan (Philippines)',
        url: 'https://www.karapatan.org',
        description:
          'Karapatan (Alliance for the Advancement of People\'s Rights) is the Philippines\' main human-rights NGO. Cited for the August 2022 KWF / NTF-ELCAC red-tagging incident in which the Komisyon sa Wikang Filipino halted publication and distribution of five titles by Filipino authors (Jacob, Rodriguez, Cayanes, Pagusara, Aguila). Karapatan\'s press releases and case files document Marcos-Duterte era attacks on academic freedom.',
        match: ['karapatan.org'],
      },
      {
        name: 'Eiga9 — Japanese cinema + Article 175 obscenity history',
        url: 'http://eiga9.altervista.org/articulos/obscenity.html',
        description:
          'Academic site documenting Japanese cinema censorship under Article 175 of the Penal Code. Cited for the landmark postwar obscenity trials: Lady Chatterley\'s Lover (Sei Ito translation, 1950-1957 Supreme Court), Marquis de Sade\'s Histoire de Juliette (Tatsuhiko Shibusawa translation, 1959-1969 Supreme Court), and Nagisa Oshima\'s In the Realm of the Senses book (1976).',
        match: ['eiga9.altervista.org'],
      },
      {
        name: 'Centre for Global Education — Open Veins of Latin America: A Re-appraisal 50 Years On',
        url: 'https://www.centreforglobaleducation.com/open-veins-latin-america-re-appraisal-50-years',
        description:
          'Belfast-based NGO Centre for Global Education\'s 2021 essay on the 50th anniversary of Eduardo Galeano\'s Open Veins of Latin America (1971). Documents the book\'s ban under the military dictatorships in Argentina, Chile, and Uruguay, and Galeano\'s 11-year exile from Uruguay after his imprisonment there.',
        match: ['centreforglobaleducation.com'],
      },
      {
        name: 'US Congressional Tom Lantos Human Rights Commission',
        url: 'https://humanrightscommission.house.gov',
        description:
          'Bipartisan US Congressional caucus that profiles defenders of free expression detained internationally — used as cite-of-record for Vietnam (Pham Doan Trang), and other Asia/MENA cases where the originating government doesn\'t publish prosecution details.',
        match: ['humanrightscommission.house.gov'],
      },
      {
        name: 'The Conversation',
        url: 'https://theconversation.com',
        description:
          'Academic-authored journalism. Archie Dick\'s pieces on apartheid-era South African censorship are cited of record for Publications Control Board title bans such as Alex La Guma\'s In the Fog of the Seasons’ End.',
        match: ['theconversation.com'],
      },
      {
        name: 'The Johannesburg Review of Books',
        url: 'https://johannesburgreviewofbooks.com',
        description:
          'South African literary review, cited for apartheid-era bans of works such as Lauretta Ngcobo\'s Cross of Gold.',
        match: ['johannesburgreviewofbooks.com'],
      },
      {
        name: 'Africa in Words',
        url: 'https://africainwords.com',
        description:
          'Academic blog on African literature, cited for the banning and appeal of Sipho Sepamla\'s A Ride on the Whirlwind.',
        match: ['africainwords.com'],
      },
      {
        name: 'Image & Text (SciELO South Africa)',
        url: 'https://scielo.org.za',
        description:
          'Peer-reviewed South African journal on SciELO. Documents the Government Gazette banning (10 May 1968) of Ernest Cole\'s photo-book House of Bondage.',
        match: ['scielo.org.za'],
      },
      {
        name: 'Taylor & Francis — academic journals',
        url: 'https://www.tandfonline.com',
        description:
          'Scholarly journals (e.g. English Studies in Africa) cited for title-level censorship histories such as the banning of Lewis Nkosi\'s Home and Exile.',
        match: ['tandfonline.com'],
      },
      {
        name: 'California State University — ScholarWorks',
        url: 'https://scholarworks.calstate.edu',
        description:
          'Open-access theses and dissertations, cited for apartheid literary-censorship scholarship (e.g. the ban on Gordimer\'s Occasion for Loving).',
        match: ['scholarworks.calstate.edu'],
      },
      {
        name: 'Encyclopaedia Britannica',
        url: 'https://www.britannica.com',
        description:
          'Reference biographies cited for title-level bans where primary records are offline — e.g. Alex La Guma\'s and Jack Cope\'s works prohibited under apartheid.',
        match: ['britannica.com'],
      },
      {
        name: 'Encyclopedia.com',
        url: 'https://www.encyclopedia.com',
        description:
          'Aggregated reference biographies, cited for apartheid-era title bans such as Sheila Roberts’ He’s My Brother.',
        match: ['encyclopedia.com'],
      },
      {
        name: 'Helen Suzman Foundation',
        url: 'https://hsf.org.za',
        description:
          'South African liberal think-tank, cited for the apartheid ban on Brian Bunting\'s The Rise of the South African Reich.',
        match: ['hsf.org.za'],
      },
      {
        name: 'Trevor Huddleston Memorial Centre',
        url: 'https://www.trevorhuddleston.net',
        description:
          'Archive of the anti-apartheid priest Trevor Huddleston, cited for the South African ban on his memoir Naught for Your Comfort (1956).',
        match: ['trevorhuddleston.net'],
      },
      {
        name: 'National Museum of Taiwan Literature',
        url: 'https://tlvm.nmtl.gov.tw',
        description:
          'The NMTL\'s virtual-museum exhibitions on White Terror–era censorship name specific titles banned under KMT martial law (works by Lu Xun, Ba Jin, Mao Dun, Chen Yingzhen and others).',
        match: ['tlvm.nmtl.gov.tw'],
      },
      {
        name: 'The Asia-Pacific Journal: Japan Focus',
        url: 'https://apjjf.org',
        description:
          'Peer-reviewed journal on East Asia, cited for the South Korean ban on Bruce Cumings\'s The Origins of the Korean War under Chun Doo-hwan.',
        match: ['apjjf.org'],
      },
      {
        name: 'Right Livelihood Foundation',
        url: 'https://rightlivelihood.org',
        description:
          'Laureate profiles document free-expression cases, cited for the lèse-majesté suppression of Sulak Sivaraksa\'s Unmasking Thai Society.',
        match: ['rightlivelihood.org'],
      },
      {
        name: 'Spanish Wikipedia — censorship catalogues',
        url: 'https://es.wikipedia.org',
        description:
          'Spanish-language Wikipedia articles (e.g. Censura durante el franquismo) cited for Franco-era and Latin American title bans where English coverage is thin.',
        match: ['es.wikipedia.org'],
      },
      {
        name: 'Global Literature in Libraries Initiative (GLLI)',
        url: 'https://glli-us.org',
        description:
          'Translators/librarians initiative profiling world literature; cited for title-level censorship histories of translated and banned works.',
        match: ['glli-us.org'],
      },
      {
        name: 'Văn Việt',
        url: 'https://vanviet.info',
        description:
          'Independent Vietnamese literary site (Ban Vận động Văn đoàn Độc lập) documenting censored and unpublished Vietnamese writing; cited for title-level suppression in Vietnam.',
        match: ['vanviet.info'],
      },
      {
        name: 'SciELO Brazil',
        url: 'https://www.scielo.br',
        description:
          'Open-access Brazilian academic journals. A recurring cite-of-record for Latin American censorship scholarship — e.g. Reimão\'s study of military-dictatorship (DCDP) book bans in Estudos Avançados, and the censorship of Luandino Vieira\'s Luuanda in Revista Brasileira de História.',
        match: ['scielo.br'],
      },
      {
        name: 'Libros Prohibidos (Chile)',
        url: 'https://www.librosprohibidos.cl',
        description:
          'Chilean documentation project cataloguing books prohibited, seized or destroyed under the Pinochet dictatorship (1973–90), with per-title records.',
        match: ['librosprohibidos.cl'],
      },
      {
        name: 'Hungarian Literature Online (HLO)',
        url: 'https://hlo.hu',
        description:
          'English-language site of the literary institution Petőfi Literary Museum; its survey of Kádár-era censorship is a recurring cite-of-record for specific Hungarian book bans (Haraszti, Zilahy\'s razored Dukays, recalled foreign titles).',
        match: ['hlo.hu'],
      },
      {
        name: 'The Metaxas Project',
        url: 'https://metaxas-project.com',
        description:
          'Research site on Greece\'s 1936–41 Metaxas regime; documents the 1936 book-burnings and the school-text bans of specific titles (Sophocles\' Antigone, Plato\'s Republic, Myrivilis, Papantoniou).',
        match: ['metaxas-project.com'],
      },
      {
        name: 'University of Kansas — Banned Books in Communist Poland',
        url: 'https://guides.lib.ku.edu/c.php?g=95123&p=618653',
        description:
          'KU Libraries research guide cataloguing PRL-era (1945–89) banned and samizdat Polish titles with per-title detail (Hłasko, Tyrmand, Miłosz, Konwicki).',
        match: ['guides.lib.ku.edu'],
      },
    ],
  },
  {
    heading: 'News & journalistic',
    blurb:
      'Reporting on bans in jurisdictions without a public register. Used as the citation of record when the originating ministry hasn\'t published the title list itself.',
    entries: [
      {
        name: 'Hong Kong Free Press',
        url: 'https://hongkongfp.com',
        description:
          'English-language journalism on Hong Kong post-2020 NSL-era library removals and CSD seizures. Cited where official disclosure is absent.',
        match: ['hongkongfp.com'],
      },
      {
        name: 'The Guardian',
        url: 'https://www.theguardian.com',
        description:
          'Used across multiple jurisdictions for book-ban reporting where the original gazette or court ruling isn\'t accessible directly: 2015 Venice mayor children\'s book removals (Italy), Hungary\'s 2021 Wonderland Is for Everyone disclaimer order, Hong Kong 2020 library purges, Poland Mein Kampf publisher case, Ireland Censorship of Publications appeals.',
        match: ['theguardian.com'],
      },
      {
        name: 'BBC News',
        url: 'https://www.bbc.com/news',
        description:
          'BBC reporting across the global press-freedom beat. Cited for Ukraine\'s 2015 38-book ban of Russian-nationalist titles, Singapore\'s 2015 lifting of 240 publications, and various individual cases across South Asia and the Middle East.',
        match: ['bbc.com'],
      },
      {
        name: 'The Straits Times (Singapore)',
        url: 'https://www.straitstimes.com',
        description:
          'Singapore\'s flagship English daily. Cited for the Undesirable Publications Act ban cases: 2017 four-book extremist-content ban (Book of Tawheed series, Encyclopaedia for Fiqh, Islamic Guidance for a Muslim) and 2018 three-book ban (Wisdom of Jihad, Things that Nullify One\'s Islaam, What Islam Is All About).',
        match: ['straitstimes.com'],
      },
      {
        name: 'Channel News Asia (CNA)',
        url: 'https://www.channelnewsasia.com',
        description:
          'Singapore-based regional broadcaster (Mediacorp). Cited for Singapore book bans (Red Lines / Cherian George 2021) and the 2015 MDA lift of 240 previously-prohibited titles.',
        match: ['channelnewsasia.com'],
      },
      {
        name: 'Daily News Egypt',
        url: 'https://www.dailynewsegypt.com',
        description:
          'Cairo-based English daily. Cited for the assassination of secularist author Faraj Foda (8 June 1992) by Al-Jamaa al-Islamiya and the burning of his books in the lead-up.',
        match: ['dailynewsegypt.com'],
      },
      {
        name: 'United Press International (UPI)',
        url: 'https://www.upi.com',
        description:
          'UPI archives covering 20th-century international book-ban events. Primary source for the Indonesian Constitutional Court\'s 13 October 2010 ruling (Decision 6-7/PUU-VIII/2010) striking down the Attorney General\'s 1963 PNPS book-banning authority, plus 1994 Kenya opposition-book bans.',
        match: ['upi.com'],
      },
      {
        name: 'Associated Press',
        url: 'https://apnews.com',
        description:
          'AP wire reports cited as primary source where the originating jurisdiction\'s register is not publicly accessible.',
        match: ['apnews.com'],
      },
      {
        name: 'The Independent (UK)',
        url: 'https://www.independent.co.uk',
        description:
          'UK national daily; cited for Pope Francis\'s public defence of Piccolo Uovo after Venice\'s 2015 children\'s book ban (Italy) and similar cross-border culture-war stories.',
        match: ['independent.co.uk'],
      },
      {
        name: 'The New York Times',
        url: 'https://www.nytimes.com',
        description:
          'NYT cultural-affairs reporting cited for high-profile international book-ban cases (Brugnaro Venice 2015, Singapore UPA prosecutions, Russian crackdowns) where the originating gazette is not public.',
        match: ['nytimes.com'],
      },
      {
        name: 'The Hindu',
        url: 'https://www.thehindu.com',
        description:
          'Chennai-based English daily. Cited for Indian Supreme Court and state-level High Court rulings on book bans not yet indexed by Indian Kanoon.',
        match: ['thehindu.com'],
      },
      {
        name: 'Korea Times',
        url: 'https://www.koreatimes.co.kr',
        description:
          'South Korean English daily. Cited for the 2008 Ministry of National Defense\'s 23-book military-distribution ban and its 2011 expansion.',
        match: ['koreatimes.co.kr'],
      },
      {
        name: 'Irish Times',
        url: 'https://www.irishtimes.com',
        description:
          'Cited for historical Irish Censorship of Publications Act cases (Edna O\'Brien, Lee Dunne) and the modern reissue of Ireland\'s first banned book.',
        match: ['irishtimes.com'],
      },
      {
        name: 'Rediff.com (India)',
        url: 'https://www.rediff.com',
        description:
          'Indian English-language news portal. Cited for Ayesha Siddiqa\'s Military Inc. (Pakistan 2007 launch-suppression case) which Indian press covered when Pakistani outlets were under government pressure.',
        match: ['rediff.com'],
      },
      {
        name: 'Notes from Poland',
        url: 'https://notesfrompoland.com',
        description:
          'English-language news on Polish politics and culture. Cited for PiS-era curriculum reforms and 2024 reversals affecting school reading lists.',
        match: ['notesfrompoland.com'],
      },
      {
        name: 'Mada Masr (Egypt)',
        url: 'https://www.madamasr.com',
        description:
          'Independent Cairo-based news outlet (English + Arabic). Cited for the Ahmed Naji court case (The Use of Life, 2015-2018) and other contemporary Egyptian press-freedom developments.',
        match: ['madamasr.com'],
      },
      {
        name: 'Radio Free Asia',
        url: 'https://www.rfa.org',
        description:
          'US-funded broadcasting service covering Asian countries with restricted press. Cited for Vietnam, China, and Tibet book-ban events not documented in domestic media.',
        match: ['rfa.org'],
      },
      {
        name: 'Voice of America (regional services)',
        url: 'https://www.voanews.com',
        description:
          'VOA\'s country services (VOA Zimbabwe, VOA Persian, VOA Africa) document book-related press-freedom incidents in jurisdictions with limited independent media. Cited per regional outlet (e.g. voazimbabwe.com).',
        match: ['voanews.com', 'voazimbabwe.com'],
      },
      {
        name: 'Africanews / AllAfrica / Daily Nation (Kenya) / Daily Monitor (Uganda) / The Punch (Nigeria)',
        url: 'https://www.africanews.com',
        description:
          'Pan-African and per-country English-language reporting. Cited across Kenya, Uganda, Tanzania, Nigeria, Morocco, Zimbabwe, and South Africa ban cases — particularly important where the originating ministry\'s register is not published publicly.',
        match: ['africanews.com', 'allafrica.com', 'nation.africa', 'monitor.co.ug', 'punchng.com'],
      },
      {
        name: 'Regional press — Middle East & North Africa',
        url: 'https://raseef22.net',
        description:
          'Raseef22 (Arab independent journalism), Morocco World News, The New Arab, The Markaz Review (US-based MENA literary review), ArabLit (Arabic literature in translation), France 24 Observers (citizen-journalism) — cited collectively for MENA book-ban cases where the originating authority hasn\'t published the list itself. Particular use for Libya, Morocco, Lebanon cases.',
        match: ['raseef22.net', 'moroccoworldnews.com', 'newarab.com', 'themarkaz.org', 'arablit.org', 'observers.france24.com'],
      },
      {
        name: 'Russian independent press in exile',
        url: 'https://meduza.io/en',
        description:
          'Meduza (Latvia-based), The Moscow Times (in exile since 2022), and The Insider (theins.press) collectively cover post-2022 Russian book bans, school-curriculum reforms targeting LGBT and anti-war content, and the contemporary expansion of the FSEM. All three are designated "undesirable" or "foreign agent" by Russia and operate from outside the country.',
        match: ['meduza.io', 'themoscowtimes.com', 'theins.press'],
      },
      {
        name: 'The EastAfrican',
        url: 'https://www.theeastafrican.co.ke',
        description:
          'Nairobi-based pan-East-African weekly. Cited for Tanzania, Uganda, and Kenya book-ban events — particularly the 2023 Tanzanian children\'s book restrictions on sex-education content.',
        match: ['theeastafrican.co.ke'],
      },
      {
        name: 'Uganda / Zimbabwe regional press & NGOs',
        url: 'https://acme-ug.org',
        description:
          'African Centre for Media Excellence (Uganda), Chapter Four Uganda, The Independent (Uganda), Daily Monitor, The Standard (Zimbabwe), VOA Zimbabwe, Brittle Paper (African lit blog), Making Queer History — cluster of regional sources cited per individual case where domestic gazettes don\'t document the ban itself.',
        match: ['acme-ug.org', 'chapterfouruganda.org', 'independent.co.ug', 'thestandard.co.zw', 'brittlepaper.com', 'makingqueerhistory.com'],
      },
      {
        name: 'Malaysian + South-East Asian press',
        url: 'https://www.malaymail.com',
        description:
          'Malay Mail and Focus Malaysia — cited for Malaysian KDN ban orders where the gazette legal-notice citation is insufficient (modern post-2020 cases with court-of-appeal context).',
        match: ['malaymail.com', 'focusmalaysia.my'],
      },
      {
        name: 'Tanzanian Affairs / scholarly journals',
        url: 'https://www.tzaffairs.org',
        description:
          'Tanzanian Affairs (UK-based scholarly newsletter), Emerald journals, SJSU ScholarWorks, UNISA Press — academic citations for African and Asian book-censorship history.',
        match: ['tzaffairs.org', 'emerald.com', 'scholarworks.sjsu.edu', 'unisapressjournals.co.za'],
      },
      {
        name: 'Comic Book Legal Defense Fund (CBLDF)',
        url: 'https://cbldf.org',
        description:
          'US NGO documenting comics/graphic-novel censorship internationally. Cited for the 2015 Venice mayor children\'s book ban (Italy) including the full 49-title list.',
        match: ['cbldf.org'],
      },
      {
        name: 'Google News — "banned books" feed',
        url: 'https://news.google.com/rss/search?q=banned+books&hl=en-US&gl=US&ceid=US:en',
        description:
          'Aggregated RSS feed ingested by the news-display pipeline. Surfaces local US reporting on school and library challenges between the structured PEN America updates.',
      },
      {
        name: 'The Washington Post',
        url: 'https://www.washingtonpost.com',
        description:
          'Cited for apartheid-era literary bans, including the Publications Appeal Board ban on Etienne Leroux\'s Magersfontein, O Magersfontein!.',
        match: ['washingtonpost.com'],
      },
      {
        name: 'Los Angeles Times',
        url: 'https://www.latimes.com',
        description:
          'Cited for Egyptian Al-Azhar book bans (Mohamed Emara\'s The Scientific Report) and the apartheid ban on Mary Benson\'s Mandela biography.',
        match: ['latimes.com'],
      },
      {
        name: 'Daily Maverick',
        url: 'https://www.dailymaverick.co.za',
        description:
          'South African outlet. Anthony Akerman\'s reporting is cited for the first Afrikaans literary bans — Brink\'s Kennis van die Aand and Breytenbach\'s Skryt — with Government Gazette references.',
        match: ['dailymaverick.co.za'],
      },
      {
        name: 'Sunday Times (South Africa)',
        url: 'https://www.timeslive.co.za',
        description:
          'South African paper whose books pages are cited for previously-banned titles reissued post-apartheid, e.g. Helen Joseph\'s If This Be Treason.',
        match: ['sundaytimes.timeslive.co.za'],
      },
      {
        name: 'Christian Science Monitor',
        url: 'https://www.csmonitor.com',
        description:
          'Cited for Al-Azhar / Islamic Research Council book bans in Egypt, such as Gamal al-Banna\'s Responsibility for the Failure of the Islamic State.',
        match: ['csmonitor.com'],
      },
      {
        name: 'The New Inquiry',
        url: 'https://thenewinquiry.com',
        description:
          'Literary and cultural magazine, cited for the 1966 Egyptian seizure and ban of Sonallah Ibrahim\'s That Smell (Tilka al-Ra’iha).',
        match: ['thenewinquiry.com'],
      },
      {
        name: 'South China Morning Post',
        url: 'https://www.scmp.com',
        description:
          'Hong Kong daily, cited for East Asian book bans including Li Ao\'s prohibited works in Taiwan and the South Korean obscenity case over Ma Kwang-su\'s Happy Sara.',
        match: ['scmp.com'],
      },
      {
        name: 'Taipei Times',
        url: 'https://www.taipeitimes.com',
        description:
          'Taiwanese English-language daily, cited for White Terror–era book bans (Jin Yong\'s Condor Heroes, Kuo Liang-hui\'s The Locked Heart, and others).',
        match: ['taipeitimes.com'],
      },
      {
        name: 'The National (UAE)',
        url: 'https://www.thenationalnews.com',
        description:
          'Abu Dhabi-based outlet, cited for Saudi Arabian book-fair confiscations such as Wael Ghonim\'s Revolution 2.0 at the Riyadh International Book Fair.',
        match: ['thenationalnews.com'],
      },
      {
        name: 'Global Voices',
        url: 'https://globalvoices.org',
        description:
          'International citizen-media network, cited for the 2008 South Korean Ministry of National Defense list of books banned from military barracks.',
        match: ['globalvoices.org'],
      },
      {
        name: 'Bianet',
        url: 'https://bianet.org',
        description:
          'Turkish independent news outlet, cited for obscenity prosecutions of Turkish editions (Burroughs\'s The Soft Machine, Palahniuk\'s Snuff) and the Satanic Verses translation ban.',
        match: ['bianet.org'],
      },
      {
        name: 'EurasiaNet',
        url: 'https://eurasianet.org',
        description:
          'Cited for the Turkish obscenity trial of William Burroughs\'s The Soft Machine (Sel Publishing).',
        match: ['eurasianet.org'],
      },
      {
        name: 'Prachatai English',
        url: 'https://prachataienglish.com',
        description:
          'Thai independent news site, cited for the Royal Gazette ban on Andrew MacGregor Marshall\'s A Kingdom in Crisis.',
        match: ['prachataienglish.com'],
      },
      {
        name: 'Al-Fanar Media',
        url: 'https://al-fanarmedia.org',
        description:
          'Coverage of Arab higher education and culture, cited for Kuwait\'s language-dependent book bans (Arabic editions of The Forty Rules of Love and 1984).',
        match: ['al-fanarmedia.org'],
      },
      {
        name: 'Hyperallergic',
        url: 'https://hyperallergic.com',
        description:
          'Arts publication, cited for Kuwait\'s ~4,000-title ban wave (Victor Hugo, Maya Angelou) and the artist installation memorialising it.',
        match: ['hyperallergic.com'],
      },
      {
        name: 'Document Journal',
        url: 'https://www.documentjournal.com',
        description:
          'Cited for Kuwait\'s ban on a Disney adaptation of The Little Mermaid — the case that drew international attention to Kuwaiti book censorship.',
        match: ['documentjournal.com'],
      },
      {
        name: 'The New Publishing Standard',
        url: 'https://thenewpublishingstandard.com',
        description:
          'Publishing-industry outlet, cited for the ~1,000 titles barred from the 2018 Kuwait International Book Fair, including Dostoevsky\'s The Brothers Karamazov.',
        match: ['thenewpublishingstandard.com'],
      },
      {
        name: 'Radio Dabanga',
        url: 'https://www.dabangasudan.org',
        description:
          'Sudan-focused outlet; the cite-of-record for Khartoum International Book Fair confiscations (Baraka Sakin\'s The Messiah of Darfur, Kazantzakis, and more).',
        match: ['dabangasudan.org'],
      },
      {
        name: 'NPR',
        url: 'https://www.npr.org',
        description:
          'US public radio; cited for international book-ban reporting, e.g. the most-requested banned books in Jordan (2010).',
        match: ['npr.org'],
      },
      {
        name: 'Dawn',
        url: 'https://www.dawn.com',
        description:
          'Pakistan\'s leading English daily; cited for Pakistani book bans and seizures.',
        match: ['dawn.com'],
      },
      {
        name: 'The Friday Times',
        url: 'https://thefridaytimes.com',
        description:
          'Pakistani weekly; cited for Pakistani title bans and censorship cases.',
        match: ['thefridaytimes.com'],
      },
      {
        name: 'Minute Mirror',
        url: 'https://minutemirror.com.pk',
        description:
          'Pakistani daily; cited (with PEIRA) for textbook and title bans in Pakistan.',
        match: ['minutemirror.com.pk'],
      },
      {
        name: 'RFE/RL (Gandhara)',
        url: 'https://www.rferl.org',
        description:
          'Radio Free Europe/Radio Liberty\'s Gandhara service; cited for book bans in Pakistan, Afghanistan and Central Asia.',
        match: ['rferl.org'],
      },
      {
        name: 'The Jakarta Post',
        url: 'https://www.thejakartapost.com',
        description:
          'Indonesia\'s main English daily; cited for Indonesian book bans and Attorney-General confiscations.',
        match: ['thejakartapost.com'],
      },
      {
        name: 'Tuổi Trẻ',
        url: 'https://tuoitre.vn',
        description:
          'Major Vietnamese daily; cited for Vietnamese title withdrawals and bans.',
        match: ['tuoitre.vn'],
      },
      {
        name: 'Havana Times',
        url: 'https://havanatimes.org',
        description:
          'English-language outlet on Cuba; cited for Cuban book censorship cases.',
        match: ['havanatimes.org'],
      },
      {
        name: 'The Arab Weekly',
        url: 'https://thearabweekly.com',
        description:
          'Pan-Arab weekly; cited for Algerian and other Arab-world book bans (e.g. Benchicou\'s Bouteflika biography).',
        match: ['thearabweekly.com'],
      },
      {
        name: 'Ammon News',
        url: 'https://en.ammonnews.net',
        description:
          'Jordanian news agency; cited for Department of Press and Publications book withdrawals.',
        match: ['ammonnews.net'],
      },
      {
        name: 'Doha News',
        url: 'https://dohanews.co',
        description:
          'Qatar-focused outlet; cited for the Ministry of Culture ban on Mohanalakshmi Rajakumar\'s Love Comes Later.',
        match: ['dohanews.co'],
      },
      {
        name: 'Euronews',
        url: 'https://www.euronews.com',
        description:
          'European broadcaster; cited for the Algiers Book Fair ban on Kamel Daoud\'s Houris.',
        match: ['euronews.com'],
      },
      {
        name: 'Publishing Perspectives',
        url: 'https://publishingperspectives.com',
        description:
          'International publishing-industry outlet; cited for UAE confiscations and Gulf book-clearance bottlenecks.',
        match: ['publishingperspectives.com'],
      },
      {
        name: 'Publishers Weekly',
        url: 'https://www.publishersweekly.com',
        description:
          'US publishing trade magazine; cited for international ban and censorship reporting.',
        match: ['publishersweekly.com'],
      },
      {
        name: 'Literary Hub',
        url: 'https://lithub.com',
        description:
          'Literary news site; cited for title-level censorship and banned-book reporting.',
        match: ['lithub.com'],
      },
      {
        name: 'London Review of Books',
        url: 'https://www.lrb.co.uk',
        description:
          'UK literary review; cited for essays documenting specific title bans.',
        match: ['lrb.co.uk'],
      },
      {
        name: 'Zenda',
        url: 'https://www.zendalibros.com',
        description:
          'Spanish-language literary site; cited for Franco-era and Latin American book-censorship histories.',
        match: ['zendalibros.com'],
      },
      {
        name: 'Scroll.in',
        url: 'https://scroll.in',
        description:
          'Indian news site; a recurring cite-of-record for Indian book bans, publisher withdrawals and court restraints (e.g. the Punjab textbook bans and the Ramdev biography injunction).',
        match: ['scroll.in'],
      },
      {
        name: 'Asia-Plus',
        url: 'https://asiaplustj.info',
        description:
          'Tajik news agency; the cite-of-record for Tajikistan\'s Interior Ministry list of banned Salafi titles and other Central Asian book restrictions.',
        match: ['asiaplustj.info', 'asiaplus.news'],
      },
      {
        name: 'Al Jazeera',
        url: 'https://www.aljazeera.com',
        description:
          'Qatari international broadcaster; cited for book bans across the Middle East and South/Central Asia (e.g. the Taliban\'s university-curriculum bans in Afghanistan).',
        match: ['aljazeera.com'],
      },
      {
        name: 'CIVICUS Monitor',
        url: 'https://monitor.civicus.org',
        description:
          'Global civil-society alliance tracking civic-space violations; cited for title-level book-fair seizures such as Oman\'s Muscat International Book Fair confiscations.',
        match: ['civicus.org'],
      },
      {
        name: 'International Anthony Burgess Foundation',
        url: 'https://www.anthonyburgess.org',
        description:
          'Archive of the novelist Anthony Burgess; its banned-books pages document the 1968 Malta confiscation and destruction of dozens of titles from Burgess\'s personal library.',
        match: ['anthonyburgess.org'],
      },
      {
        name: 'El Día (Dominican Republic)',
        url: 'https://eldia.com.do',
        description:
          'Dominican daily; cited for its roster of books prohibited under the Trujillo dictatorship (Galíndez, Requena and others).',
        match: ['eldia.com.do'],
      },
    ],
  },
  {
    heading: 'Enrichment APIs — covers, descriptions, bios',
    blurb:
      'These services don\'t document bans; they supply metadata layered on top of each ban record — cover images, book descriptions, ISBNs, author photos, and author biographies. Each title and author is queried through a name-variant ladder (English meaning → canonical → transliteration → native script) so non-Latin works get reasonable hit rates against Anglo-indexed catalogues.',
    entries: [
      {
        name: 'Open Library (Internet Archive)',
        url: 'https://openlibrary.org',
        description:
          'Cover images via the OL Covers API, descriptions via Open Library Works, and author photos via Open Library Authors. Open Library data is published under a CC0 public domain dedication.',
      },
      {
        name: 'Google Books',
        url: 'https://books.google.com',
        description:
          'Fallback cover images, ISBN-13 lookup via industryIdentifiers, and book descriptions for titles missing from Open Library. Used via the Google Books API.',
      },
      {
        name: 'Wikidata',
        url: 'https://www.wikidata.org',
        description:
          'Author photo lookup via Wikidata Q-IDs (P18 image property), filtered to human writers via occupation labels. Provides the highest-quality author headshots where available.',
      },
      {
        name: 'Wikimedia Commons',
        url: 'https://commons.wikimedia.org',
        description:
          'Image hosting backing both Wikidata P18 results and Wikipedia infobox thumbnails. Permitted on this site via the allowed-image-hosts whitelist.',
      },
      {
        name: 'Wikipedia (author bios)',
        url: 'https://en.wikipedia.org',
        description:
          'Author bio extracts pulled via the Wikipedia REST summary API. Walked through the author-name ladder so non-Latin authors like 阎连科 (Yan Lianke) match via either English form or native script.',
      },
      {
        name: 'OpenAI GPT (fallback description generator)',
        url: 'https://openai.com',
        description:
          'GPT-4o-mini is used as a last-resort description writer for books missing both Open Library and Google Books entries. Generated descriptions are flagged `ai_drafted=true` so editors can distinguish them from sourced text.',
      },
    ],
  },
]

async function fetchBansBySource(): Promise<Map<string, number>> {
  const sb = adminClient()
  const counts = new Map<string, number>()
  // PostgREST's `count` aggregate on a related table returns
  // `[{ count: N }]` per parent row instead of materialising every
  // ban_source_links row. Cuts the response from ~3000 join rows to ~70
  // parent rows × a single integer each. Combined with the 1-hour ISR
  // cache above, this page is effectively free under normal traffic.
  const { data } = await sb
    .from('ban_sources')
    .select('source_url, ban_source_links(count)')
  for (const row of (data ?? []) as Array<{
    source_url: string | null
    ban_source_links: Array<{ count: number }> | null
  }>) {
    const url = (row.source_url ?? '').toLowerCase()
    const n = row.ban_source_links?.[0]?.count ?? 0
    if (!n) continue
    counts.set(url, (counts.get(url) ?? 0) + n)
  }
  return counts
}

function countMatching(
  counts: Map<string, number>,
  matchers: readonly string[] | undefined,
): number {
  if (!matchers || matchers.length === 0) return 0
  let total = 0
  for (const [url, n] of counts) {
    if (matchers.some(m => url.includes(m.toLowerCase()))) {
      total += n
    }
  }
  return total
}

export default async function SourcesPage() {
  const counts = await fetchBansBySource()
  const totalBans = [...counts.values()].reduce((a, n) => a + n, 0)

  return (
    <main>
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-4xl mx-auto">
          <Eyebrow>Reference · Sources and citations</Eyebrow>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            Where the data comes from.
          </h1>
          <p className="mt-6 max-w-[720px] font-serif text-lg md:text-xl leading-relaxed text-gray-900">
            Every ban in this catalogue links back to its originating source — a public register, an NGO report, an academic archive, or a news article.
          </p>
          <p className="mt-3 max-w-[720px] text-sm md:text-base leading-relaxed text-gray-700">
            The list below shows every source family currently in use, the count of ban records attributed to it, and where the data comes from. The catalogue currently aggregates <strong>{totalBans.toLocaleString('en-US')}</strong> source citations across <strong>{counts.size}</strong> distinct source URLs.
          </p>
        </div>
      </section>

      <SectionShell tone="cream">
        <div className="max-w-4xl mx-auto">
      {CATEGORIES.map(category => (
        <section key={category.heading} className="mb-12">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2 pb-3 border-b border-oxblood/30">{category.heading}</h2>
          <p className="text-sm text-gray-600 mb-5 max-w-3xl leading-relaxed">
            {category.blurb}
          </p>
          <div className="flex flex-col gap-4">
            {category.entries.map(source => {
              const banCount = countMatching(counts, source.match)
              const isPlanned = !!source.planned
              return (
                <div
                  key={source.name}
                  className={`border rounded-xl p-5 ${
                    isPlanned
                      ? 'border-dashed border-gray-300 bg-gray-50/50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
                    <h3 className="text-base font-semibold flex items-center gap-2 min-w-0">
                      <span className={isPlanned ? 'text-gray-500' : ''}>
                        {source.name}
                      </span>
                      {isPlanned && (
                        <span className="text-[10px] uppercase tracking-wider font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                          planned
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      {banCount > 0 && (
                        <span className="text-gray-500 font-medium tabular-nums">
                          {banCount.toLocaleString('en-US')} bans
                        </span>
                      )}
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate max-w-[260px]"
                      >
                        {source.url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {source.description}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      ))}
        </div>
      </SectionShell>

      <SectionShell tone="white">
        <div className="max-w-4xl mx-auto">

      <div className="mt-2 border rounded-xl p-6 bg-white">
        <h2 className="font-serif text-lg md:text-xl font-semibold mb-3 text-gray-900">Data limitations</h2>
        <div className="text-sm text-gray-600 leading-relaxed flex flex-col gap-3">
          <p>
            This catalogue is not a neutral global census of book bans — it is a record of what has
            been documented. Coverage is strongest for the United States, where PEN America and the
            ALA provide structured, annual data. It is weakest for closed authoritarian states,
            where censorship is pervasive but rarely reported through accessible channels.
          </p>
          <p>
            US bans are also structurally different: most are school-district removals — local
            administrative decisions — rather than national prohibitions. Each removal is counted
            separately, which inflates the US total relative to countries where a single government
            decree bans a book everywhere at once.
          </p>
          <p>
            Read the full explanation in our{' '}
            <a
              href="/methodology"
              className="underline hover:text-gray-800"
            >
              methodology essay
            </a>
            .
          </p>
        </div>
      </div>

      <div className="mt-10 border-l-4 border-brand pl-5 py-2">
        <p className="text-sm text-gray-700 leading-relaxed">
          Want to work with this data yourself? The full catalogue — every book, every ban, every
          source citation — is available as a{' '}
          <Link
            href="/dataset"
            className="underline font-medium hover:text-gray-900"
          >
            downloadable dataset
          </Link>{' '}
          in CSV, JSON, and SQLite.
        </p>
      </div>

      <p className="mt-10 text-xs text-neutral-500 leading-relaxed">
        If you spot an error or want to suggest a source, please{' '}
        <a
          href="https://github.com/ludo-raedts/banned-books-org/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="text-oxblood hover:underline"
        >
          open an issue on GitHub
        </a>
        .
      </p>
        </div>
      </SectionShell>
    </main>
  )
}
