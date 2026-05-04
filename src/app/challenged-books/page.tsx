export const revalidate = 86400

import type { Metadata } from 'next'
import Image from 'next/image'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import ReasonBadge from '@/components/reason-badge'
import GenreBadge from '@/components/genre-badge'

export const metadata: Metadata = {
  title: 'Challenged Books — Attempted Censorship | Banned Books',
  description: 'A challenged book is one that has been formally objected to and removed or restricted — most often from a school library. Browse books challenged across the United States and beyond.',
  alternates: { canonical: '/challenged-books' },
  openGraph: {
    title: 'Challenged Books — Attempted Censorship | Banned Books',
    description: 'A challenged book is one that has been formally objected to and removed or restricted — most often from a school library.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://www.banned-books.org/challenged-books',
      name: 'Challenged Books — Attempted Censorship',
      description:
        'A catalogue of books formally challenged and removed or restricted from schools and libraries. Most entries originate from PEN America and American Library Association data.',
      url: 'https://www.banned-books.org/challenged-books',
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is a challenged book?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'A challenged book is one that has been the subject of a formal written complaint requesting its removal or restriction from a library, school, or public institution. A challenge becomes a ban when the institution acts on the complaint and removes or restricts access to the book. Not all challenges result in removal — some are rejected — but this catalogue records only those where the book was actually removed or restricted.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is the difference between a challenged book and a banned book?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'A "challenge" is a formal complaint requesting that a book be removed. A "ban" is the result: the book is actually removed or access to it is restricted. Every banned book in a library or school context began as a challenge, but not every challenge leads to a ban. This catalogue records completed actions — removals and restrictions — not merely attempted ones.',
          },
        },
        {
          '@type': 'Question',
          name: 'Why does the United States have so many challenged books?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The United States accounts for most challenged-book data in this catalogue because two organisations — PEN America and the American Library Association — systematically track and publish school and library challenges. No comparable infrastructure exists in most other countries. This reflects reporting capacity, not uniquely American censorship.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does this catalogue define a school ban?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'A school ban in this catalogue is a documented removal or restriction of a book from a school library or curriculum by a school board, district, or government authority. These entries are sourced primarily from PEN America Index of School Book Bans and the American Library Association Banned and Challenged Books reports.',
          },
        },
      ],
    },
  ],
}

type Book = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  description: string | null
  first_published_year: number | null
  genres: string[]
  book_authors: { authors: { display_name: string } | null }[]
  bans: {
    id: number
    scope_id: number
    countries: { name_en: string } | null
    ban_reason_links: { reasons: { slug: string } | null }[]
  }[]
}

function authorName(book: Book): string {
  return book.book_authors.map((ba) => ba.authors?.display_name).filter(Boolean).join(', ')
}

function getReasons(book: Book): string[] {
  return [...new Set(
    book.bans.flatMap((ban) =>
      ban.ban_reason_links.map((l) => l.reasons?.slug).filter((s): s is string => !!s)
    )
  )]
}

function banLabel(bans: Book['bans']): string {
  const n = bans.length
  if (n === 0) return 'No recorded bans'
  if (n === 1) {
    const country = bans[0].countries?.name_en
    return country ? `Challenged in ${country}` : 'Challenged in 1 country'
  }
  return `Challenged in ${n} countries`
}

export default async function ChallengedBooksPage() {
  const supabase = adminClient()

  const { data: scope } = await supabase
    .from('scopes').select('id, label_en').eq('slug', 'school').single()

  let books: Book[] = []
  if (scope) {
    // Paginate to avoid 1000-row cap
    let offset = 0
    while (true) {
      const { data } = await supabase
        .from('books')
        .select(`
          id, title, slug, cover_url, description, first_published_year, genres,
          book_authors(authors(display_name)),
          bans!inner(id, scope_id, countries(name_en), ban_reason_links(reasons(slug)))
        `)
        .eq('bans.scope_id', scope.id)
        .order('title')
        .range(offset, offset + 999)
      if (!data || data.length === 0) break
      books = books.concat(data as unknown as Book[])
      if (data.length < 1000) break
      offset += 1000
    }
    // Deduplicate by id (inner join may produce duplicates)
    const seen = new Set<number>()
    books = books.filter(b => {
      if (seen.has(b.id)) return false
      seen.add(b.id)
      return true
    })
  }

  const total = books.length

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="max-w-5xl mx-auto px-4 py-10">

        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-8 transition-colors">
          ← All books
        </Link>

        {/* Header */}
        <div className="bg-brand-light dark:bg-brand-dark/10 border-l-4 border-brand pl-6 pr-4 py-6 rounded-r-xl mb-10">
          <p className="text-xs font-medium uppercase tracking-widest text-brand/70 dark:text-brand/60 mb-3">Challenged books</p>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Challenged Books — Attempted Censorship</h1>
          <p className="text-gray-700 dark:text-gray-300 max-w-2xl leading-relaxed text-sm">
            {total.toLocaleString()} books formally challenged and removed or restricted from schools and libraries.
            Most originate from PEN America and the American Library Association.
          </p>
        </div>

        {/* Editorial intro */}
        <section className="mb-10 max-w-2xl text-sm text-gray-700 dark:text-gray-300 leading-relaxed flex flex-col gap-4">
          <p>
            A <strong>challenge</strong> is a formal written request to remove a book from a school or library.
            A <strong>ban</strong> is what happens when the institution acts on that request: the book is
            removed from shelves, pulled from curricula, or restricted to certain readers. This catalogue
            records completed actions, not attempted ones — every book on this page was actually removed or
            restricted, not merely complained about.
          </p>
          <p>
            The vast majority of entries below are school bans in the United States, drawn from PEN
            America&apos;s Index of School Book Bans and the American Library Association&apos;s annual
            Banned and Challenged Books data. This reflects reporting infrastructure: the US has two
            organisations that systematically track school removals. Most countries have no equivalent.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 italic border-l-2 border-gray-200 dark:border-gray-700 pl-4">
            Note: our database uses scope (school vs. government) rather than a separate &ldquo;challenged&rdquo;
            status. The books below represent the school-scope bans in our catalogue — the closest equivalent
            to the ALA&apos;s definition of a challenged book.{' '}
            <Link href="/methodology" className="underline hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              Read our full methodology →
            </Link>
          </p>
        </section>

        {/* FAQ — visible accordion for UX, structured data above for SEO */}
        <section className="mb-12 max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Frequently asked questions</h2>
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            {[
              {
                q: 'What is a challenged book?',
                a: 'A challenged book is one that has been the subject of a formal written complaint requesting its removal from a library, school, or public institution. A challenge becomes a ban when the institution acts on the complaint and removes or restricts the book. This catalogue records only completed removals — not rejected challenges.',
              },
              {
                q: 'What is the difference between challenged and banned?',
                a: '"Challenged" means a formal complaint was filed. "Banned" means the book was actually removed or restricted. Every library ban began as a challenge, but many challenges are rejected. We document the bans, not the attempts.',
              },
              {
                q: 'Why does the US dominate this list?',
                a: 'Because PEN America and the American Library Association systematically publish this data. Most countries have no equivalent watchdog organisations tracking school removals. The US appearing prominently reflects transparency, not uniquely American censorship.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer select-none list-none font-medium text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                  {q}
                  <span className="shrink-0 text-gray-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="px-5 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Book grid */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {total.toLocaleString()} challenged {total === 1 ? 'book' : 'books'}
          </h2>
          <Link href="/scope/school" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            View as scope page →
          </Link>
        </div>

        {books.length === 0 ? (
          <p className="text-gray-500">No challenged books recorded yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {books.map((book) => (
              <Link key={book.id} href={`/books/${book.slug}`} className="group flex flex-col">
                <div className="mb-2">
                  {book.cover_url ? (
                    <Image
                      src={book.cover_url}
                      alt={`Cover of ${book.title}`}
                      width={160}
                      height={240}
                      className="rounded shadow-sm object-cover w-full"
                      sizes="160px"
                    />
                  ) : (
                    <BookCoverPlaceholder title={book.title} author={authorName(book)} slug={book.slug} />
                  )}
                </div>
                <h3 className="text-sm font-semibold leading-snug group-hover:underline">{book.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{authorName(book)}</p>
                {book.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">{book.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {book.genres.map((g) => <GenreBadge key={g} slug={g} />)}
                  {getReasons(book).map((r) => <ReasonBadge key={r} slug={r} />)}
                </div>
                <p className="text-xs font-medium text-red-500 dark:text-red-400 mt-1.5">
                  {banLabel(book.bans)}
                </p>
              </Link>
            ))}
          </div>
        )}

        {/* Bottom CTAs */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
          <Link
            href="/scope/government"
            className="flex-1 text-center px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            Government bans →
          </Link>
          <Link
            href="/methodology"
            className="flex-1 text-center px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            Our methodology →
          </Link>
          <Link
            href="/"
            className="flex-1 text-center px-4 py-3 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Explore all banned books
          </Link>
        </div>

      </main>
    </>
  )
}
