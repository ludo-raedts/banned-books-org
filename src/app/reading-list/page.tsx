import type { Metadata } from 'next'
import Link from 'next/link'
import { BOOKS, CATEGORIES } from './books-data'
import ReadingListCover from './reading-list-cover'
import { getBookshopUrl, getBookshopLinkType, BOOKSHOP_REL } from '@/lib/bookshop'
import TrackedOutboundLink from '@/components/tracked-outbound-link'
import SectionShell from '@/components/section/SectionShell'

export const metadata: Metadata = {
  title: 'Reading List — Books About Censorship',
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
      <main>
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
          <div className="max-w-3xl mx-auto">
            <p className="text-sm uppercase tracking-[0.12em] font-semibold text-oxblood mb-3.5">
              Further reading · Curated
            </p>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
              Books about censorship.
            </h1>
            <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
              A curated reading list of books about censorship, free expression, and the history of banned literature.
            </p>
            <div className="mt-6 text-sm text-gray-700 leading-relaxed flex flex-col gap-4">
              <p>
                Book bans rarely begin with a bonfire. More often, they begin with a meeting, a complaint, a policy, a quiet removal, or a claim that certain readers must be protected from certain ideas. This reading list brings together books that help explain the forces behind censorship today: authoritarianism, propaganda, nationalism, empire, race, gender, education, war, and the politics of memory.
              </p>
              <p>
                Some titles on this list have been banned, challenged, restricted, or removed. Others have not, but they help explain why societies become afraid of books.
              </p>
            </div>
          </div>
        </section>

        {/* ── Callouts ─────────────────────────────────────────────── */}
        <SectionShell tone="white">
          <div className="max-w-3xl mx-auto flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border border-neutral-200 bg-white rounded-sm">
              <p className="text-sm text-neutral-600">Looking for Orwell, Nabokov, Flaubert?</p>
              <Link href="/banned-classics" className="shrink-0 text-sm font-medium text-oxblood hover:underline">
                Banned classic literature →
              </Link>
            </div>
            <div className="px-4 py-3 border border-neutral-200 bg-white rounded-sm text-xs text-neutral-500 leading-relaxed">
              <p>
                Inclusion on this list does not mean every book has been officially banned. Some are included because they illuminate the political, cultural, and historical forces behind censorship.
              </p>
              <p className="mt-2">
                Outbound &ldquo;Find on Bookshop.org&rdquo; links are affiliate links. They help support independent bookstores and this project at no extra cost to you.
              </p>
            </div>
          </div>
        </SectionShell>

        {/* ── Categories (alternating tone) ────────────────────────── */}
        {CATEGORIES.map(({ slug, heading }, catIdx) => {
          const books = BOOKS.filter((b) => b.category === slug)
          if (books.length === 0) return null
          const tone: 'cream' | 'white' = catIdx % 2 === 0 ? 'cream' : 'white'
          return (
            <SectionShell key={slug} tone={tone} eyebrow={`Category · ${books.length} ${books.length === 1 ? 'book' : 'books'}`}>
              <div className="max-w-3xl mx-auto">
                <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30">
                  {heading}
                </h2>
                <div>
                  {books.map((book, bookIdx) => {
                    const isLast = bookIdx === books.length - 1
                    return (
                      <article
                        key={`${book.author}-${book.title}`}
                        className={`pb-8 mb-8 ${isLast ? '!mb-0 !pb-0' : 'border-b border-neutral-200'}`}
                      >
                        <div className="flex gap-4 sm:gap-5">
                          {/* Cover thumbnail */}
                          <div className="shrink-0 w-16 sm:w-20">
                            <ReadingListCover isbn={book.isbn} title={book.title} author={book.author} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-2">
                              <h3 className="font-serif text-base font-semibold text-gray-900 leading-snug">
                                {book.internalSlug ? (
                                  <Link
                                    href={`/books/${book.internalSlug}`}
                                    className="hover:text-oxblood transition-colors"
                                  >
                                    {book.title}
                                  </Link>
                                ) : (
                                  book.title
                                )}
                              </h3>
                              <span className="text-neutral-400 text-sm">·</span>
                              <span className="text-sm text-neutral-600">
                                {book.author}
                              </span>
                              {book.isOfficiallyBanned && book.internalSlug && (
                                <Link
                                  href={`/books/${book.internalSlug}`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-oxblood/10 text-oxblood text-[11px] font-medium hover:bg-oxblood/20 transition-colors"
                                >
                                  📚 In our database
                                </Link>
                              )}
                            </div>

                            <p className="text-sm text-neutral-700 leading-relaxed mb-3">
                              {book.description}
                            </p>

                            <div className="flex flex-wrap gap-1.5 mb-4">
                              {book.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>

                            {/* Why we recommend it */}
                            <details className="group/details">
                              <summary className="cursor-pointer list-none select-none inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-oxblood transition-colors">
                                <span className="group-open/details:hidden">▸ Why we recommend it</span>
                                <span className="hidden group-open/details:inline">▾ Why we recommend it</span>
                              </summary>
                              <div className="mt-3 bg-white border-l-2 border-oxblood/40 px-4 py-3 rounded-r-md">
                                <p className="text-sm text-neutral-700 leading-relaxed">
                                  {book.whyWeRecommend}
                                </p>
                              </div>
                            </details>

                            {/* Buy link — Reading-list ISBNs are hand-picked US editions, so we treat
                                them as Bookshop-valid without going through the probe-script. */}
                            <TrackedOutboundLink
                              eventName="Bookshop Click"
                              eventProperties={{ source: 'reading-list', bookSlug: book.internalSlug ?? null, isbn13: book.isbn ?? null, linkType: getBookshopLinkType(getBookshopUrl({ isbn13: book.isbn, bookshopStatus: 'valid' })) }}
                              href={getBookshopUrl({ isbn13: book.isbn, bookshopStatus: 'valid' })}
                              target="_blank"
                              rel={BOOKSHOP_REL}
                              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-oxblood hover:underline"
                            >
                              Find on Bookshop.org →
                            </TrackedOutboundLink>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            </SectionShell>
          )
        })}

        {/* ── Bottom CTAs ──────────────────────────────────────────── */}
        <SectionShell tone="white">
          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/"
              className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
            >
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Catalogue</p>
              <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
                Explore the banned books database →
              </p>
            </Link>
            <Link
              href="/about#get-in-touch"
              className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
            >
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Contribute</p>
              <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
                Suggest a book for this list →
              </p>
            </Link>
          </div>
        </SectionShell>
      </main>
    </>
  )
}
