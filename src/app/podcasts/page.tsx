// Static curated listening guide. Unlike /sources this page has no DB
// dependency — it's a hand-picked, editorially-annotated directory of
// podcasts about book bans. Every entry was listened-checked and its link
// verified before shipping; refresh periodically as feeds go dark.
import Link from 'next/link'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const metadata = {
  title: 'Banned books podcasts — a curated listening guide',
  description:
    'A hand-picked, link-verified guide to the best banned-books and censorship podcasts — reported journalism, author-hosted shows, and the case for restriction.',
  alternates: { canonical: '/podcasts' },
}

type Show = {
  name: string
  host: string
  url: string
  description: string
  // Highlighted with a subtle badge — our strongest recommendations.
  flagship?: boolean
  // Link out without passing ranking signal. Used for the "case for
  // restriction" entry: we cite it so readers can hear ban proponents in
  // their own words, without editorially endorsing or boosting it.
  nofollow?: boolean
}

type Category = {
  heading: string
  blurb: string
  shows: Show[]
}

const CATEGORIES: readonly Category[] = [
  {
    heading: 'Journalism & institutions',
    blurb:
      'Reported, produced series from newsrooms and libraries. These are the shows to start with if you want the story of the current wave of school and library bans told with sourcing and context rather than hot takes.',
    shows: [
      {
        name: 'Borrowed and Banned',
        host: 'Brooklyn Public Library',
        url: 'https://www.bklynlibrary.org/podcasts/introducing-borrowed-and',
        description:
          'A ten-part limited series (2023) on America\'s ideological war with its own bookshelves, told through the students, librarians, teachers and authors caught in it. Peabody-nominated and Webby-winning — the single most polished piece of audio journalism on the subject, and a natural companion to our US school-ban data.',
        flagship: true,
      },
      {
        name: 'Banned & Challenged',
        host: 'NPR',
        url: 'https://www.npr.org/series/1142706201/banned-and-challenged-restricting-access-to-books-in-u-s-libraries',
        description:
          'NPR\'s running series of interviews with, and essays by, authors watching their books pulled from US schools and libraries. Short, accessible episodes that work well as a first introduction to the debate.',
      },
      {
        name: 'Velshi Banned Book Club',
        host: 'Ali Velshi (MSNBC)',
        url: 'https://podcasts.apple.com/us/podcast/velshi-banned-book-club/id1702778436',
        description:
          'MSNBC anchor Ali Velshi hosts authors of frequently-targeted books to discuss why their work is being challenged. Explicitly framed as advocacy against book banning — useful for the author\'s-eye view, read with that lens in mind.',
      },
    ],
  },
  {
    heading: 'Authors in their own words',
    blurb:
      'Shows hosted by writers who have themselves been banned. The value here is first-hand: what it is actually like to have your book pulled from a shelf.',
    shows: [
      {
        name: 'Fighting Words with George M. Johnson',
        host: 'George M. Johnson',
        url: 'https://podcasts.apple.com/us/podcast/fighting-words-with-george-m-johnson/id1792902968',
        description:
          'Hosted by the author of All Boys Aren\'t Blue — one of the most-banned books in the United States. Johnson interviews artists and writers resisting censorship and marginalisation. Personal, current, and grounded in the experience of being on a ban list.',
      },
    ],
  },
  {
    heading: 'International & cross-spectrum',
    blurb:
      'Most banned-book podcasts are firmly US-focused. This one is the exception, and the one we point to for a deliberately non-partisan frame — a fit for a catalogue that documents bans in more than a hundred countries.',
    shows: [
      {
        name: 'Banned Voices',
        host: 'Banned Books Museum, Tallinn (Joseph Dunnigan)',
        url: 'https://bannedbooksmuseum.com/category/podcasts/',
        description:
          'The official podcast of the Banned Books Museum in Tallinn, Estonia, which preserves censored and burned books from over a hundred countries. It sets out to be politically neutral, giving authors, editors and publishers from across the political spectrum room to tell their own stories of suppression. The closest thing to a global, non-partisan take.',
        flagship: true,
      },
    ],
  },
  {
    heading: 'Book clubs & conversation',
    blurb:
      'Discussion shows that read a banned title and talk it through — lighter, more personal, good for listeners who want a reading companion rather than reporting. Tone ranges from earnest to comedic; pick by mood.',
    shows: [
      {
        name: 'Burn This Book: A Banned Books Book Club',
        host: 'Nicolle Okoren & Eden Wen',
        url: 'https://podcasts.apple.com/us/podcast/burn-this-book-a-banned-books-book-club/id1646249336',
        description:
          'Twice-monthly deep dives into individual challenged and banned books and the culture-war arguments around them. A solid middle ground between journalism and casual book club.',
      },
      {
        name: 'Rogue Librarians',
        host: 'Three teacher-librarians',
        url: 'https://www.theroguelibrarians.com/',
        description:
          'Teacher-librarians work through recently-banned young-adult titles — often two episodes per book — with a focus on the LGBTQ and BIPOC stories that dominate recent US challenge lists. Practical and library-literate.',
      },
      {
        name: 'The Beautiful and Banned',
        host: 'Christine Renee Miller & Jessica Goudeau',
        url: 'https://www.beautifulandbannedpod.com/',
        description:
          'Weekly conversations spanning banned books, plays and films, historical and contemporary, with an eye on the social themes that get work suppressed in the first place.',
      },
      {
        name: 'Banned Camp',
        host: 'Jennifer Davis & Dan Schulz',
        url: 'https://www.bannedcamppodcast.com/',
        description:
          'A comedy podcast that reads banned books chapter by chapter to work out why anyone objected. Not journalism — but a genuinely disarming way in for listeners who find the topic heavy. Expect jokes.',
      },
    ],
  },
  {
    heading: 'Understanding the case for restriction',
    blurb:
      'Almost every show above opposes book bans, and so does this catalogue\'s framing. But you cannot understand a conflict by listening to one side. We include the entry below so you can hear the reasoning of the parents and groups who push for removals in their own words, rather than only as described by their critics. It is cited, not recommended — the link deliberately passes no ranking signal.',
    shows: [
      {
        name: 'The Fire of Liberty Show',
        host: 'Moms for Liberty',
        url: 'https://portal.momsforliberty.org/podcast/',
        description:
          'The official podcast of Moms for Liberty, the conservative "parental rights" organisation that has been a leading force behind US school-book challenges (and is described by free-expression groups such as PEN America and FIRE as a driver of removals targeting LGBTQ and race-related titles). Listen to understand how ban advocates frame their case — around parental consent, age-appropriateness and sexual content — and where that framing collides with the free-expression arguments made everywhere else on this site.',
        nofollow: true,
      },
    ],
  },
]

// ItemList of the shows for structured data. We list every entry, including
// the restriction one — structured data is a neutral inventory, and the
// nofollow / editorial framing lives in the page itself.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Banned books podcasts — a curated listening guide',
  url: 'https://www.banned-books.org/podcasts',
  description:
    'A curated, annotated guide to podcasts about banned books and censorship.',
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: CATEGORIES.flatMap(c => c.shows).map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'PodcastSeries',
        name: s.name,
        url: s.url,
      },
    })),
  },
}

export default function PodcastsPage() {
  const total = CATEGORIES.reduce((n, c) => n + c.shows.length, 0)

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-4xl mx-auto">
          <Eyebrow>Reference · Listen</Eyebrow>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            Banned books, out loud.
          </h1>
          <p className="mt-6 max-w-[720px] font-serif text-lg md:text-xl leading-relaxed text-gray-900">
            Podcasts are one of the liveliest places the book-ban debate is
            actually happening. This is a hand-picked guide to the ones worth
            your time.
          </p>
          <p className="mt-3 max-w-[720px] text-sm md:text-base leading-relaxed text-gray-700">
            Every one of the {total} shows below was checked and its link
            verified by hand — no auto-generated feed dumps, and nothing hosted
            by an AI. They range from Peabody-nominated audio journalism to
            author-hosted conversations and one deliberately non-partisan
            international show. We also point, honestly, to the other side of
            the argument. Grouped by what you are in the mood for.
          </p>
        </div>
      </section>

      <SectionShell tone="cream">
        <div className="max-w-4xl mx-auto">
          {CATEGORIES.map(category => (
            <section key={category.heading} className="mb-12">
              <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2 pb-3 border-b border-oxblood/30">
                {category.heading}
              </h2>
              <p className="text-sm text-gray-600 mb-5 max-w-3xl leading-relaxed">
                {category.blurb}
              </p>
              <div className="flex flex-col gap-4">
                {category.shows.map(show => (
                  <div
                    key={show.name}
                    className={`border rounded-xl p-5 ${
                      show.nofollow
                        ? 'border-dashed border-gray-300 bg-gray-50/50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
                      <h3 className="text-base font-semibold flex items-center gap-2 min-w-0">
                        <span>{show.name}</span>
                        {show.flagship && (
                          <span className="text-[10px] uppercase tracking-wider font-medium bg-brand-light text-brand px-1.5 py-0.5 rounded">
                            start here
                          </span>
                        )}
                        {show.nofollow && (
                          <span className="text-[10px] uppercase tracking-wider font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            other side
                          </span>
                        )}
                      </h3>
                      <a
                        href={show.url}
                        target="_blank"
                        rel={
                          show.nofollow
                            ? 'noopener noreferrer nofollow'
                            : 'noopener noreferrer'
                        }
                        className="text-blue-600 hover:underline truncate max-w-[260px] text-xs shrink-0"
                      >
                        {show.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{show.host}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {show.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SectionShell>

      <SectionShell tone="white">
        <div className="max-w-4xl mx-auto">
          <div className="border-l-4 border-brand pl-5 py-2">
            <p className="text-sm text-gray-700 leading-relaxed">
              Prefer reading to listening? Browse our{' '}
              <Link href="/essays" className="underline font-medium hover:text-gray-900">
                essays
              </Link>
              , pick a book from the{' '}
              <Link href="/reading-club" className="underline font-medium hover:text-gray-900">
                reading club
              </Link>
              , or see{' '}
              <Link href="/get-banned-books" className="underline font-medium hover:text-gray-900">
                where to buy or borrow banned books
              </Link>
              .
            </p>
          </div>

          <p className="mt-10 text-xs text-neutral-500 leading-relaxed">
            Know a podcast that belongs here, or found a dead link? Please{' '}
            <a
              href="https://github.com/ludo-raedts/banned-books-org/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-oxblood hover:underline"
            >
              open an issue on GitHub
            </a>
            . This guide is curated by hand and updated periodically.
          </p>
        </div>
      </SectionShell>
    </main>
  )
}
