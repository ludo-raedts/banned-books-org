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
          'PEN America\'s Index of School Book Bans tracks book removals across US public schools — the most comprehensive single source of US educational censorship data.',
        match: ['pen.org/book-bans', 'pen.org/banned-books'],
      },
      {
        name: 'American Library Association — Office for Intellectual Freedom',
        url: 'https://www.ala.org/bbooks',
        description:
          'The ALA documents challenged and banned books across the US. Their decade lists and annual "Top 10 Most Challenged Books" provide the canonical historical record of US challenges.',
        match: ['ala.org'],
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
        name: 'Reporters Without Borders (RSF)',
        url: 'https://rsf.org',
        description:
          'RSF\'s World Press Freedom Index contextualises bans within broader media-freedom rankings. Used as country-level background rather than per-title data.',
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
        name: 'Wikipedia — book and author articles (per-title citations)',
        url: 'https://en.wikipedia.org/',
        description:
          'For individually-curated entries, we cite the relevant book\'s Wikipedia article directly (e.g. en.wikipedia.org/wiki/Nineteen_Eighty-Four). These are manual curation, not bulk-imported.',
        match: ['en.wikipedia.org/wiki/'],
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
        name: 'Ukrainian State Committee for Television and Radio Broadcasting',
        url: 'https://comin.kmu.gov.ua',
        description:
          'Ukraine\'s import-ban register for foreign publications (predominantly Russian-language works prohibited from import since 2014, expanded after 2022). Planned adapter — exact URL structure under review.',
        planned: true,
      },
      {
        name: 'Russian Ministry of Justice — Federal List of Extremist Materials',
        url: 'https://minjust.gov.ru/extremist-materials',
        description:
          '5,400+ items prohibited under Federal Law 114-FZ. Planned adapter — filters the master list for book entries (`книга`, `изд.`) and resolves each to its originating court ruling.',
        planned: true,
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
        name: 'Index Librorum Prohibitorum (Catholic Index, 1559–1966)',
        url: 'https://en.wikipedia.org/wiki/Index_Librorum_Prohibitorum',
        description:
          'Holy See\'s catalogue of prohibited books, discontinued in 1966. Imported via the per-author Wikipedia article (above) but cited at the Index level for collective entries.',
        match: ['/Index_Librorum_Prohibitorum'],
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
        name: 'Google News — "banned books" feed',
        url: 'https://news.google.com/rss/search?q=banned+books&hl=en-US&gl=US&ceid=US:en',
        description:
          'Aggregated RSS feed ingested by the news-display pipeline. Surfaces local US reporting on school and library challenges between the structured PEN America updates.',
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
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 max-w-3xl leading-relaxed">
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
                      ? 'border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30'
                      : 'border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
                    <h3 className="text-base font-semibold flex items-center gap-2 min-w-0">
                      <span className={isPlanned ? 'text-gray-500 dark:text-gray-400' : ''}>
                        {source.name}
                      </span>
                      {isPlanned && (
                        <span className="text-[10px] uppercase tracking-wider font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded">
                          planned
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      {banCount > 0 && (
                        <span className="text-gray-500 dark:text-gray-400 font-medium tabular-nums">
                          {banCount.toLocaleString('en-US')} bans
                        </span>
                      )}
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[260px]"
                      >
                        {source.url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
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
        <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex flex-col gap-3">
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
              className="underline hover:text-gray-800 dark:hover:text-gray-200"
            >
              methodology essay
            </a>
            .
          </p>
        </div>
      </div>

      <div className="mt-10 border-l-4 border-brand pl-5 py-2">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Want to work with this data yourself? The full catalogue — every book, every ban, every
          source citation — is available as a{' '}
          <Link
            href="/dataset"
            className="underline font-medium hover:text-gray-900 dark:hover:text-gray-100"
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
