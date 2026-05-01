import type { Metadata } from 'next'
import Link from 'next/link'
import { BOOKS, CATEGORIES } from './books-data'

export const metadata: Metadata = {
  title: 'Contemporary books about censorship, power, and banned books',
  description:
    'A curated reading list of contemporary and classic books that explain censorship, book banning, authoritarianism, propaganda, education, empire, war, and the freedom to read.',
  alternates: { canonical: '/reading-list' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://www.banned-books.org/reading-list',
      name: 'Contemporary books about censorship, power, and banned books',
      description:
        'A curated reading list of contemporary and classic books that explain censorship, book banning, authoritarianism, propaganda, education, empire, war, and the freedom to read.',
      url: 'https://www.banned-books.org/reading-list',
    },
    {
      '@type': 'ItemList',
      name: 'Reading list: censorship, power, and the freedom to read',
      numberOfItems: BOOKS.length,
      itemListElement: BOOKS.map((book, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Book',
          name: book.title,
          author: { '@type': 'Person', name: book.author },
          description: book.description,
          ...(book.internalSlug
            ? { url: `https://www.banned-books.org/books/${book.internalSlug}` }
            : {}),
        },
      })),
    },
  ],
}

export default function ReadingListPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Reading list</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed font-light">
            Contemporary books about censorship, power, and the freedom to read
          </p>
        </div>

        {/* Intro */}
        <div className="mb-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-4">
          <p>
            Book bans rarely begin with a bonfire. More often, they begin with a meeting, a
            complaint, a policy, a quiet removal, or a claim that certain readers must be protected
            from certain ideas. This reading list brings together books that help explain the forces
            behind censorship today: authoritarianism, propaganda, nationalism, empire, race,
            gender, education, war, and the politics of memory.
          </p>
          <p>
            Some titles on this list have been banned, challenged, restricted, or removed. Others
            have not, but they help explain why societies become afraid of books.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="mb-10 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          Inclusion on this list does not mean every book has been officially banned. Some are
          included because they illuminate the political, cultural, and historical forces behind
          censorship.
        </div>

        {/* Categories */}
        {CATEGORIES.map(({ slug, heading }) => {
          const books = BOOKS.filter((b) => b.category === slug)
          if (books.length === 0) return null
          return (
            <section key={slug} className="mb-14">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-6 pb-2 border-b border-gray-200 dark:border-gray-800">
                {heading}
              </h2>
              <div className="flex flex-col gap-8">
                {books.map((book) => (
                  <article key={`${book.author}-${book.title}`} className="group">
                    {/* Title + author */}
                    <div className="mb-2">
                      {book.internalSlug ? (
                        <Link
                          href={`/books/${book.internalSlug}`}
                          className="font-semibold text-gray-900 dark:text-gray-100 hover:underline underline-offset-2"
                        >
                          {book.title}
                        </Link>
                      ) : (
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {book.title}
                        </span>
                      )}
                      <span className="text-gray-500 dark:text-gray-400 ml-2 text-sm">
                        {book.author}
                      </span>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {book.isOfficiallyBanned && book.internalSlug && (
                        <Link
                          href={`/books/${book.internalSlug}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                        >
                          📚 In our database
                        </Link>
                      )}
                      {book.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                      {book.description}
                    </p>

                    {/* Why we recommend it — collapsible via native details */}
                    <details className="group/details">
                      <summary className="cursor-pointer text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 select-none list-none flex items-center gap-1 transition-colors">
                        <span className="group-open/details:hidden">▸ Why we recommend it</span>
                        <span className="hidden group-open/details:inline">▾ Why we recommend it</span>
                      </summary>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed pl-3 border-l-2 border-gray-200 dark:border-gray-700">
                        {book.whyWeRecommend}
                      </p>
                    </details>
                  </article>
                ))}
              </div>
            </section>
          )
        })}

        {/* Bottom CTAs */}
        <div className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="flex-1 text-center px-4 py-3 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Explore the banned books database
          </Link>
          <Link
            href="/about"
            className="flex-1 text-center px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            Suggest a book for this list
          </Link>
        </div>
      </main>
    </>
  )
}
