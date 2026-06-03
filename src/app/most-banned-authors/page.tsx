// ISR: 1h. The most-banned-authors leaderboard moves slowly (driven by
// catalogue ingestion of new bans, not by reader behaviour).
export const revalidate = 3600

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
import { TopListAuthorCard } from '@/components/top-list-card'
import type { TopListAuthor } from '@/components/top-list-card'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const metadata: Metadata = {
  title: 'Most banned authors of all time',
  description:
    'A ranked list of the writers censored across the most jurisdictions. From Stephen King to George Orwell — these are the authors authorities most want to silence.',
  alternates: { canonical: '/most-banned-authors' },
}

type AuthorRow = {
  entity_id: number
  total_bans: number
  banned_books: number
  granular_events: number
  aggregate_events: number
}

export default async function MostBannedAuthorsPage() {
  const timer = newTimer('authors-destination')
  const supabase = adminClient()

  const [{ data: rankedRes }, { data: placeholdersRes }] = await timer.wrap('parallel-2', () =>
    Promise.all([
      supabase
        .from('v_top_banned_authors')
        .select('entity_id, total_bans, banned_books, granular_events, aggregate_events')
        .limit(100),
      supabase.from('authors').select('id').eq('is_placeholder', true),
    ]),
  )

  const placeholderIds = new Set(((placeholdersRes ?? []) as { id: number }[]).map(a => a.id))
  const ranked = ((rankedRes ?? []) as AuthorRow[])
    .filter(r => !placeholderIds.has(Number(r.entity_id)))
    .slice(0, 50)
  const ids = ranked.map(r => Number(r.entity_id))

  const { data: detailsRes } = ids.length > 0
    ? await timer.wrap('author-details', () =>
        supabase.from('authors').select('id, display_name, slug, photo_url, updated_at').in('id', ids),
      )
    : { data: null }
  const details = (detailsRes ?? []) as {
    id: number; display_name: string; slug: string; photo_url: string | null; updated_at: string | null
  }[]
  const authorById = new Map(details.map(a => [a.id, a]))

  // Real freshness signal: the most recent record change among the listed
  // authors. Driven by actual data (enrichment, photos, re-ranking inputs),
  // not a synthetic render timestamp — Google reads invented churn as spam.
  const lastModified = details.reduce<string | null>(
    (max, a) => (a.updated_at && (!max || a.updated_at > max) ? a.updated_at : max),
    null,
  )

  const authors: TopListAuthor[] = ranked
    .map((r): TopListAuthor | null => {
      const a = authorById.get(Number(r.entity_id))
      if (!a) return null
      const banBooks = Number(r.banned_books)
      // Use granular_events (PEN per-district + region) for the "events" tail.
      // total_bans would inflate this by including Wikipedia/ALA aggregate rows
      // that represent "documented historically" rather than discrete events.
      const granular = Number(r.granular_events ?? 0)
      const eventsTail = granular > 0
        ? ` (${granular.toLocaleString('en')} documented ${granular === 1 ? 'event' : 'events'})`
        : ''
      return {
        id: a.id,
        display_name: a.display_name,
        slug: a.slug,
        photo_url: a.photo_url,
        context: `${banBooks} ${banBooks === 1 ? 'book' : 'books'} banned${eventsTail}`,
      }
    })
    .filter((a): a is TopListAuthor => a !== null)

  timer.end()

  const itemListJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Most banned authors of all time',
    url: 'https://www.banned-books.org/most-banned-authors',
    description:
      'A ranked list of the writers censored across the most jurisdictions, by number of distinct books banned.',
    ...(lastModified ? { dateModified: lastModified } : {}),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: authors.length,
      itemListElement: authors.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://www.banned-books.org/authors/${a.slug}`,
        name: a.display_name,
      })),
    },
  }

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, '\\u003c') }}
      />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← All books
          </Link>

          <Eyebrow>Top-list · Ranked by distinct titles banned</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 max-w-[820px]">
            Most banned authors of all time.
          </h1>

          <p className="mt-6 max-w-[720px] text-sm md:text-base leading-relaxed text-gray-700">
            The {authors.length} writers censored across the most titles, ranked by the number of distinct books that have been banned somewhere. Each name is a constellation of decisions — sometimes one book in many places (Salman Rushdie), sometimes many books in many places (Stephen King). The leaderboard is what authorities, school boards, and courts have actually done with their work.
          </p>
        </div>
      </section>

      {/* ── The list ──────────────────────────────────────────────────── */}
      <SectionShell tone="cream" eyebrow={`The ${authors.length} most-banned authors · worldwide`}>
        {authors.length === 0 ? (
          <p className="text-neutral-500 text-sm">No author leaderboard data available yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {authors.map(author => (
              <TopListAuthorCard key={author.id} author={author} />
            ))}
          </div>
        )}
      </SectionShell>

      {/* ── Footer nav ────────────────────────────────────────────────── */}
      <SectionShell tone="white">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/top-100-banned-books"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Companion list</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Top 100 banned books →
            </p>
          </Link>
          <Link
            href="/trending-banned-books"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">This week</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Trending banned books →
            </p>
          </Link>
          <Link
            href="/stats"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">By the numbers</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Censorship statistics →
            </p>
          </Link>
        </div>
      </SectionShell>
    </main>
  )
}
