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
        {CATEGORIES.map(({ slug, heading }, catIdx) => {
          const books = BOOKS.filter((b) => b.category === slug)
          if (books.length === 0) return null
          const letter = String.fromCharCode(65 + catIdx)
          return (
            <section key={slug} className="mt-16 first:mt-0">
              {/* Category label + heading */}
              <div className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 mb-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
                  {letter}
                </p>
                <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 leading-snug">
                  {heading}
                </h2>
              </div>

              {/* Books */}
              <div>
                {books.map((book, bookIdx) => {
                  const isLast = bookIdx === books.length - 1
                  return (
                    <article
                      key={`${book.author}-${book.title}`}
                      className={`pb-8 mb-8 ${isLast ? '' : 'border-b border-gray-100 dark:border-gray-800'}`}
                    >
                      {/* Title + author + database badge */}
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                          {book.internalSlug ? (
                            <Link
                              href={`/books/${book.internalSlug}`}
                              className="hover:underline underline-offset-2"
                            >
                              {book.title}
                            </Link>
                          ) : (
                            book.title
                          )}
                        </h3>
                        <span className="text-gray-400 dark:text-gray-500 text-sm font-normal">·</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-normal">
                          {book.author}
                        </span>
                        {book.isOfficiallyBanned && book.internalSlug && (
                          <Link
                            href={`/books/${book.internalSlug}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900 transition-colors"
                          >
                            📚 In our database
                          </Link>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                        {book.description}
                      </p>

                      {/* Tags — below description */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {book.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Why we recommend it */}
                      <details className="group/details">
                        <summary className="cursor-pointer list-none select-none inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                          <span className="group-open/details:hidden">▸ Why we recommend it</span>
                          <span className="hidden group-open/details:inline">▾ Why we recommend it</span>
                        </summary>
                        <div className="mt-3 bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-300 dark:border-amber-700 px-4 py-3 rounded-r-md">
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {book.whyWeRecommend}
                          </p>
                        </div>
                      </details>
                    </article>
                  )
                })}
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
