import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { adminClient } from '@/lib/supabase'
import { getBBWConfig, formatBBWDateRange } from '@/config/banned-books-week'
import { BBWDisclaimer } from '@/components/bbw-disclaimer'
import Eyebrow from '@/components/section/Eyebrow'
import {
  getPublishedFeaturedBooks,
  getAllFeaturedBooksForAdmin,
  getBBWLiveStats,
  type FeaturedBookRow,
} from '@/lib/bbw-data'
import {
  getPublishedBlockMap,
  getPublishedBlockHtml,
  stripOuterParagraph,
  REQUIRED_BLOCKS_BY_PAGE,
  type ContentBlockRow,
} from '@/lib/content-blocks'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Banned Books Week — International Context',
  description:
    'Independent knowledge resource for Banned Books Week. International context, data, and a Reading Club to read banned books together.',
  alternates: { canonical: '/banned-books-week' },
}

const TRACKS = [
  { href: '/reading-club/currently-challenged', label: 'Currently challenged (US)', text: 'The ALA OIF annual list, with discussion questions.' },
  { href: '/reading-club/international',        label: 'International cases',        text: 'Engine-curated set spanning regimes and regions.' },
  { href: '/reading-club/classics',              label: 'Banned classics',            text: 'Books that survived the censors of their era.' },
  { href: '/reading-club/by-theme',               label: 'By theme',                   text: 'LGBTQ+, political dissent, religious censorship, race, sexuality.' },
] as const

export default async function BannedBooksWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>
}) {
  const sp = await searchParams
  const isPreview = sp.preview === 'draft' && (await isAdmin())

  const config = await getBBWConfig()
  const year = config.year
  const slugs = REQUIRED_BLOCKS_BY_PAGE['bbw-hub']

  const [blockMap, featured, stats, previewBlocks, dateRange, themeLine] = await Promise.all([
    getPublishedBlockMap(slugs),
    isPreview ? getAllFeaturedBooksForAdmin(year) : getPublishedFeaturedBooks(year),
    getBBWLiveStats(),
    isPreview ? getAllBlocksForPreview(slugs) : Promise.resolve(new Map<string, ContentBlockRow>()),
    formatBBWDateRange(),
    // The campaign line lives in the homepage-callout block; reused here so the
    // official theme is stated once and edited in one place.
    getPublishedBlockHtml('bbw-tile-tagline'),
  ])

  // In preview mode, show every block regardless of status; otherwise only
  // published blocks render and unpublished sections are hidden.
  const html = (slug: string): string | null => {
    if (isPreview) {
      const r = previewBlocks.get(slug)
      if (!r) return null
      return r.body_html ?? `<p class="opacity-50 italic">[brief: ${escapeHtml(r.placeholder_brief)}]</p>`
    }
    return blockMap.get(slug) ?? null
  }

  const heroSubtitle = html('bbw-hero-subtitle')
  const whatIs = html('bbw-what-is')
  const elsewhere = html('bbw-elsewhere')
  const whyMatters = html('bbw-why-matters')
  const otherSide = html('bbw-other-side')
  const readingIntro = html('bbw-reading-intro')
  const whatYouCanDo = html('bbw-what-you-can-do')

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': 'https://www.banned-books.org/banned-books-week',
        name: 'Banned Books Week — International Context',
        description: 'Independent knowledge resource for Banned Books Week. International context, data, and a Reading Club.',
        url: 'https://www.banned-books.org/banned-books-week',
        isPartOf: { '@type': 'WebSite', name: 'banned-books.org', url: 'https://www.banned-books.org' },
      },
      ...(featured.length > 0 ? [{
        '@type': 'ItemList',
        name: `Featured banned books — Banned Books Week ${year}`,
        numberOfItems: featured.length,
        itemListElement: featured.map(f => ({
          '@type': 'ListItem',
          position: f.position,
          item: {
            '@type': 'Book',
            name: f.book.title,
            author: f.book.authors.length > 0 ? { '@type': 'Person', name: f.book.authors[0] } : undefined,
            url: `https://www.banned-books.org/books/${f.book.slug}`,
          },
        })),
      }] : []),
    ],
  }

  // Same article-prose treatment as /methodology, /history and /reading-club so
  // editorial copy across the site reads as one publication. The hub had been
  // the odd one out: sans-serif headings, no section rules, and `brand`
  // (#8B2020) where every other editorial page uses `oxblood` (#5C1010).
  const proseClass =
    'prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-h3:mt-6 prose-h3:mb-2 prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 max-w-none'

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {isPreview && (
        <div className="max-w-3xl mx-auto px-6 md:px-9 pt-6">
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            Preview mode — showing all content (incl. drafts and placeholders).
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <Eyebrow>Banned Books Week · International context</Eyebrow>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            Banned Books Week
          </h1>
          {heroSubtitle && (
            <div
              className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900 prose-p:!my-0 prose-a:text-oxblood"
              dangerouslySetInnerHTML={{ __html: heroSubtitle }}
            />
          )}
          <div className="mt-4">
            <BBWDisclaimer variant="short" />
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 md:px-9 pb-14">
        <FactsPanel
          year={year}
          dateRange={dateRange}
          themeLine={themeLine ? stripOuterParagraph(themeLine) : null}
        />


      {/* What is BBW */}
      {whatIs && (
        <section className="mb-10">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-4 pb-2 border-b border-oxblood/30">What is Banned Books Week</h2>
          <div
            className={proseClass}
            dangerouslySetInnerHTML={{ __html: whatIs }}
          />
        </section>
      )}

      {/* Featured books for the year */}
      {featured.length > 0 && (
        <section id="featured" className="mb-10 scroll-mt-8">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-4 pb-2 border-b border-oxblood/30">Featured books for {year}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featured.map(f => <FeaturedBookCard key={f.bookId} row={f} />)}
          </ul>
        </section>
      )}

      {/* Reading and discussing */}
      {readingIntro && (
        <section id="reading" className="mb-10 scroll-mt-8">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-4 pb-2 border-b border-oxblood/30">Reading and discussing banned books</h2>
          <div
            className={`${proseClass} mb-5`}
            dangerouslySetInnerHTML={{ __html: readingIntro }}
          />
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 not-prose">
            {TRACKS.map(t => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className="group block rounded-lg border border-gray-200 p-4 hover:border-oxblood/40 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="font-semibold text-sm text-gray-900 group-hover:text-oxblood transition-colors">{t.label}</div>
                  <div className="text-xs text-gray-600 mt-1">{t.text}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Why it matters + live stats */}
      {whyMatters && (
        <section className="mb-10">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-4 pb-2 border-b border-oxblood/30">Why it still matters</h2>
          <div
            className={`${proseClass} mb-6`}
            dangerouslySetInnerHTML={{ __html: whyMatters }}
          />
          <div className="grid grid-cols-3 gap-4 not-prose">
            <Stat number={stats.totalBans.toLocaleString('en')} label="Documented bans" />
            <Stat number={stats.countryCount.toLocaleString('en')} label="Countries" />
            <Stat number={stats.recentBans.toLocaleString('en')} label="Bans (last 5 yrs)" />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            <Link href="/stats" className="text-oxblood hover:underline">Full statistics →</Link>
          </p>
        </section>
      )}

      {/* Parallel national weeks — the hub says BBW is a US effort and that
          other countries run their own; this is where that gets specific. */}
      {elsewhere && (
        <section id="elsewhere" className="mb-10 scroll-mt-8">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-4 pb-2 border-b border-oxblood/30">Banned Books Week outside the US</h2>
          <div
            className={proseClass}
            dangerouslySetInnerHTML={{ __html: elsewhere }}
          />
        </section>
      )}

      {/* What you can do */}
      {whatYouCanDo && (
        <section className="mb-10">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-4 pb-2 border-b border-oxblood/30">What you can do</h2>
          <div
            className={proseClass}
            dangerouslySetInnerHTML={{ __html: whatYouCanDo }}
          />
        </section>
      )}

      <ArchiveEntryPoints />

      {/* The other side */}
      {otherSide && (
        <section className="mb-10">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-4 pb-2 border-b border-oxblood/30">The other side</h2>
          <div
            className={proseClass}
            dangerouslySetInnerHTML={{ __html: otherSide }}
          />
        </section>
      )}

        {/* Disclaimer */}
        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Sources &amp; disclaimer</h2>
          <BBWDisclaimer variant="full" />
        </section>
      </div>
    </main>
  )
}

/**
 * The one thing a visitor most often arrives for — when is it, what is it
 * called, who runs it — plus the outbound links to the organisations that
 * actually run the week. Those links previously existed only in the grey
 * disclaimer at the very bottom of the page.
 */
function FactsPanel({
  year,
  dateRange,
  themeLine,
}: {
  year: number
  dateRange: string
  themeLine: string | null
}) {
  return (
    <aside className="mb-12 rounded-r-xl border-l-4 border-brand bg-brand-light py-6 pl-6 pr-5">
      <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-oxblood">
        Banned Books Week {year}
      </p>
      <p className="mt-2 font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
        {dateRange}
      </p>
      {themeLine && (
        <p
          className="mt-1 text-sm text-gray-700"
          dangerouslySetInnerHTML={{ __html: themeLine }}
        />
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-700 mb-1.5">
            The organisers
          </p>
          <ul className="space-y-1 text-gray-700">
            <li>
              <a href="https://bannedbooksweek.org" target="_blank" rel="noopener noreferrer" className="text-oxblood hover:underline">bannedbooksweek.org</a>{' '}
              — the coalition that runs the week
            </li>
            <li>
              <a href="https://www.ala.org/bbooks" target="_blank" rel="noopener noreferrer" className="text-oxblood hover:underline">ALA</a>{' '}
              — the annual most-challenged list
            </li>
            <li>
              <a href="https://pen.org/book-bans/" target="_blank" rel="noopener noreferrer" className="text-oxblood hover:underline">PEN America</a>{' '}
              — the school book-ban index
            </li>
            <li>
              <a href="https://www.indexoncensorship.org/bannedbooksweek/" target="_blank" rel="noopener noreferrer" className="text-oxblood hover:underline">Index on Censorship</a>{' '}
              — runs Banned Books Week UK, same dates
            </li>
          </ul>
          {/* Librarians and booksellers arriving here for materials should be
              sent to the source. We deliberately do not host the campaign
              artwork ourselves: the coalition licenses it for non-monetized
              use, this site carries affiliate links and sells a dataset, and
              reproducing official artwork would undercut the not-affiliated
              statement the rest of the page is careful about. */}
          <p className="mt-2 text-gray-700">
            <a href="https://bannedbooksweek.org/promotional-tools/" target="_blank" rel="noopener noreferrer" className="text-oxblood hover:underline">Posters, graphics and toolkits</a>{' '}
            come from the coalition directly.
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-700 mb-1.5">
            On this page
          </p>
          <ul className="space-y-1 text-gray-700">
            <li><a href="#featured" className="text-oxblood hover:underline">{featuredAnchorLabel(year)}</a></li>
            <li><a href="#reading" className="text-oxblood hover:underline">Four reading paths</a></li>
            <li><a href="#elsewhere" className="text-oxblood hover:underline">The week outside the US</a></li>
          </ul>
        </div>
      </div>
    </aside>
  )
}

function featuredAnchorLabel(year: number): string {
  return `Ten books worth defending in ${year}`
}

/**
 * The site's own material is the reason to be here rather than on the
 * organisers' pages; before this the hub linked to neither the country
 * catalogue nor the top-100.
 */
function ArchiveEntryPoints() {
  const items = [
    { href: '/countries', label: 'Browse by country', text: 'Every country with a documented ban, from national decrees to school districts.' },
    { href: '/top-100-banned-books', label: 'Top 100 banned books', text: 'The most censored titles worldwide, ranked by documented bans.' },
    { href: '/dataset', label: 'The open dataset', text: 'Every row, citable and free to reuse under CC-BY-4.0.' },
  ]
  return (
    <section className="mb-10">
      <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-4 pb-2 border-b border-oxblood/30">
        Look past the week
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 not-prose">
        {items.map(i => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="group block h-full rounded-lg border border-gray-200 p-4 hover:border-oxblood/40 hover:bg-gray-50/50 transition-colors"
            >
              <div className="font-semibold text-sm text-gray-900 group-hover:text-oxblood transition-colors">{i.label}</div>
              <div className="text-xs text-gray-600 mt-1">{i.text}</div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white text-center">
      <div className="font-serif text-2xl font-semibold text-oxblood">{number}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function FeaturedBookCard({ row }: { row: FeaturedBookRow }) {
  const b = row.book
  return (
    <li className="border border-gray-200 rounded-lg p-4 bg-white flex gap-3">
      {b.cover_url ? (
        <Image
          src={b.cover_url}
          alt=""
          width={64}
          height={96}
          className="rounded object-cover w-16 h-24 flex-shrink-0 bg-gray-100"
        />
      ) : (
        <div className="w-16 h-24 flex-shrink-0 rounded bg-gray-100" />
      )}
      <div className="flex-1 min-w-0">
        <Link href={`/books/${b.slug}`} className="font-semibold text-sm hover:text-oxblood transition-colors block">
          {b.title}
        </Link>
        <div className="text-xs text-gray-500 mt-0.5">
          {b.authors.join(', ')}
        </div>
        {row.customBlurb ? (
          <p className="text-xs text-gray-700 mt-2 leading-relaxed">{row.customBlurb}</p>
        ) : b.description_book ? (
          <p className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-3">{b.description_book}</p>
        ) : null}
        {b.reasons.length > 0 && (
          <p className="text-[11px] text-gray-500 mt-2">
            <span className="font-medium">Why on challenge lists:</span>{' '}
            {b.reasons.slice(0, 3).join(', ')}
          </p>
        )}
      </div>
    </li>
  )
}

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  return !!secret && !!session && session === secret
}

async function getAllBlocksForPreview(slugs: readonly string[]): Promise<Map<string, ContentBlockRow>> {
  const out = new Map<string, ContentBlockRow>()
  if (slugs.length === 0) return out
  const { data } = await adminClient()
    .from('content_blocks')
    .select('*')
    .in('slug', slugs as string[])
  for (const r of (data ?? []) as ContentBlockRow[]) out.set(r.slug, r)
  return out
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
