import type { Metadata } from 'next'
import Link from 'next/link'
import { BOOKS, CATEGORIES } from './books-data'
import ReadingListCover from './reading-list-cover'

export const metadata: Metadata = {
  title: 'Reading List — Books About Censorship | Banned Books',
  description: 'A curated reading list of books about censorship, free expression, and the history of banned literature.',
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
      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="bg-brand-light dark:bg-brand-dark/10 border-l-4 border-brand pl-6 pr-4 py-6 mb-10 rounded-r-xl">
          <p className="text-xs font-medium uppercase tracking-widest text-brand/70 dark:text-brand/60 mb-3">Reading list</p>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Books about censorship</h1>
          <p className="text-gray-700 dark:text-gray-300 max-w-2xl leading-relaxed text-sm">
            A curated reading list of books about censorship, free expression, and the history of banned literature.
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

        {/* Classics callout */}
        <div className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Looking for Orwell, Nabokov, Flaubert?
          </p>
          <Link href="/banned-classics" className="shrink-0 text-sm font-medium text-brand hover:underline transition-colors">
            Banned classic literature →
          </Link>
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
            <section key={slug} className="mb-16 first:mt-0">
              {/* Category heading */}
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {heading}
              </h2>

              {/* Books */}
              <div>
                {books.map((book, bookIdx) => {
                  const isLast = bookIdx === books.length - 1
                  return (
                    <article
                      key={`${book.author}-${book.title}`}
                      className={`pb-8 mb-8 ${isLast ? '' : 'border-b border-gray-100 dark:border-gray-800'}`}
                    >
                      <div className="flex gap-4 sm:gap-5">
                        {/* Cover thumbnail */}
                        <div className="shrink-0 w-16 sm:w-20">
                          <ReadingListCover isbn={book.isbn} title={book.title} author={book.author} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Title + author + database badge */}
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-2">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">
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

                          {/* Tags */}
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
                        </div>
                      </div>
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
