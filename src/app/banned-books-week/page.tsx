import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { adminClient } from '@/lib/supabase'
import { getBBWConfig } from '@/config/banned-books-week'
import { BBWDisclaimer } from '@/components/bbw-disclaimer'
import {
  getPublishedFeaturedBooks,
  getAllFeaturedBooksForAdmin,
  getBBWLiveStats,
  type FeaturedBookRow,
} from '@/lib/bbw-data'
import {
  getPublishedBlockMap,
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

  const [blockMap, featured, stats, previewBlocks] = await Promise.all([
    getPublishedBlockMap(slugs),
    isPreview ? getAllFeaturedBooksForAdmin(year) : getPublishedFeaturedBooks(year),
    getBBWLiveStats(),
    isPreview ? getAllBlocksForPreview(slugs) : Promise.resolve(new Map<string, ContentBlockRow>()),
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

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {isPreview && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Preview mode — showing all content (incl. drafts and placeholders).
        </div>
      )}

      {/* Hero */}
      <header className="mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">Banned Books Week</h1>
        {heroSubtitle && (
          <div
            className="text-lg text-gray-600 leading-relaxed prose prose-gray max-w-none"
            dangerouslySetInnerHTML={{ __html: heroSubtitle }}
          />
        )}
        <div className="mt-3">
          <BBWDisclaimer variant="short" />
        </div>
      </header>

      {/* What is BBW */}
      {whatIs && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">What is Banned Books Week</h2>
          <div
            className="prose prose-gray max-w-none"
            dangerouslySetInnerHTML={{ __html: whatIs }}
          />
        </section>
      )}

      {/* Why it matters + live stats */}
      {whyMatters && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Why it still matters</h2>
          <div
            className="prose prose-gray max-w-none mb-6"
            dangerouslySetInnerHTML={{ __html: whyMatters }}
          />
          <div className="grid grid-cols-3 gap-4 not-prose">
            <Stat number={stats.totalBans.toLocaleString('en')} label="Documented bans" />
            <Stat number={stats.countryCount.toLocaleString('en')} label="Countries" />
            <Stat number={stats.recentBans.toLocaleString('en')} label="Bans (last 5 yrs)" />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            <Link href="/stats" className="hover:underline">Full statistics →</Link>
          </p>
        </section>
      )}

      {/* The other side */}
      {otherSide && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">The other side</h2>
          <div
            className="prose prose-gray max-w-none"
            dangerouslySetInnerHTML={{ __html: otherSide }}
          />
        </section>
      )}

      {/* Featured books for the year */}
      {featured.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Featured books for {year}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featured.map(f => <FeaturedBookCard key={f.bookId} row={f} />)}
          </ul>
        </section>
      )}

      {/* Reading and discussing */}
      {readingIntro && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Reading and discussing banned books</h2>
          <div
            className="prose prose-gray max-w-none mb-5"
            dangerouslySetInnerHTML={{ __html: readingIntro }}
          />
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 not-prose">
            {TRACKS.map(t => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className="group block rounded-lg border border-gray-200 p-4 hover:border-brand/40 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="font-semibold text-sm text-gray-900 group-hover:text-brand transition-colors">{t.label}</div>
                  <div className="text-xs text-gray-600 mt-1">{t.text}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* What you can do */}
      {whatYouCanDo && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">What you can do</h2>
          <div
            className="prose prose-gray max-w-none"
            dangerouslySetInnerHTML={{ __html: whatYouCanDo }}
          />
        </section>
      )}

      {/* Disclaimer */}
      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Sources & disclaimer</h2>
        <BBWDisclaimer variant="full" />
      </section>
    </main>
  )
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white text-center">
      <div className="text-xl font-bold text-brand">{number}</div>
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
        <Link href={`/books/${b.slug}`} className="font-semibold text-sm hover:text-brand transition-colors block">
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
