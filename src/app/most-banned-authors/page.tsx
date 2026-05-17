// ISR: 1h. The most-banned-authors leaderboard moves slowly (driven by
// catalogue ingestion of new bans, not by reader behaviour).
export const revalidate = 3600

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
import { TopListAuthorCard } from '@/components/top-list-card'
import type { TopListAuthor } from '@/components/top-list-card'

export const metadata: Metadata = {
  title: 'Most banned authors of all time',
  description:
    'A ranked list of the writers censored across the most jurisdictions. From Stephen King to George Orwell — these are the authors authorities most want to silence.',
  alternates: { canonical: '/most-banned-authors' },
}

type AuthorRow = { entity_id: number; total_bans: number; banned_books: number }

export default async function MostBannedAuthorsPage() {
  const timer = newTimer('authors-destination')
  const supabase = adminClient()

  const [{ data: rankedRes }, { data: placeholdersRes }] = await timer.wrap('parallel-2', () =>
    Promise.all([
      supabase
        .from('v_top_banned_authors')
        .select('entity_id, total_bans, banned_books')
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
        supabase.from('authors').select('id, display_name, slug, photo_url').in('id', ids),
      )
    : { data: null }
  const authorById = new Map(
    ((detailsRes ?? []) as { id: number; display_name: string; slug: string; photo_url: string | null }[])
      .map(a => [a.id, a]),
  )

  const authors: TopListAuthor[] = ranked
    .map((r): TopListAuthor | null => {
      const a = authorById.get(Number(r.entity_id))
      if (!a) return null
      const totalBans = Number(r.total_bans)
      const banBooks = Number(r.banned_books)
      return {
        id: a.id,
        display_name: a.display_name,
        slug: a.slug,
        photo_url: a.photo_url,
        context: `${totalBans.toLocaleString('en')} ${totalBans === 1 ? 'ban' : 'bans'} across ${banBooks} ${banBooks === 1 ? 'book' : 'books'}`,
      }
    })
    .filter((a): a is TopListAuthor => a !== null)

  timer.end()

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Most banned authors of all time',
    numberOfItems: authors.length,
    itemListElement: authors.map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://www.banned-books.org/authors/${a.slug}`,
      name: a.display_name,
    })),
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, '\\u003c') }}
      />
      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50 mb-3">
          Most banned authors of all time
        </h1>
        <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
          The {authors.length} writers censored across the most jurisdictions, ranked by total
          documented bans. Each name is a constellation of decisions — sometimes one book in many
          places (Salman Rushdie), sometimes many books in many places (Stephen King). The leaderboard
          is what authorities, school boards, and courts have actually done with their work.
        </p>
      </header>

      {authors.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No author leaderboard data available yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {authors.map(author => (
            <TopListAuthorCard key={author.id} author={author} />
          ))}
        </div>
      )}

      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/" className="text-gray-600 dark:text-gray-400 hover:text-brand dark:hover:text-brand transition-colors">← Home</Link>
        <Link href="/top-100-banned-books" className="text-gray-600 dark:text-gray-400 hover:text-brand dark:hover:text-brand transition-colors">Top 100 banned books →</Link>
        <Link href="/stats" className="text-gray-600 dark:text-gray-400 hover:text-brand dark:hover:text-brand transition-colors">Censorship statistics →</Link>
      </div>
    </main>
  )
}
