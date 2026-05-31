import Link from 'next/link'
import type { Metadata } from 'next'

// Root 404 boundary. Catches every notFound() call across the app (book,
// author, country, reason, scope slug misses) and renders inside the root
// layout, so the header, footer and branding are all present — instead of
// Next's bare default 404. Gives crawlers and shared deep links a real
// recovery path (search + popular pages) rather than a dead end.
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
}

const POPULAR = [
  { href: '/top-100-banned-books', label: 'Top 100 banned books' },
  { href: '/countries', label: 'Browse by country' },
  { href: '/reasons', label: 'Browse by reason' },
  { href: '/most-banned-authors', label: 'Most banned authors' },
  { href: '/timeline', label: 'History of book bans' },
  { href: '/dataset', label: 'Download the dataset' },
]

export default function NotFound() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-20 sm:py-28 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">404</p>
      <h1 className="mt-3 text-3xl sm:text-4xl font-serif font-semibold text-gray-900">
        We couldn&rsquo;t find that page
      </h1>
      <p className="mt-4 text-gray-600">
        The page may have moved or the link may be broken. Search the catalogue of
        banned books, or jump to one of the pages below.
      </p>

      <form action="/search" method="get" className="mt-8 flex gap-2 max-w-md mx-auto">
        <label htmlFor="nf-q" className="sr-only">Search banned books</label>
        <input
          id="nf-q"
          name="q"
          type="search"
          placeholder="Search titles, authors, countries…"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Search
        </button>
      </form>

      <div className="mt-12">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-gray-500">
          Popular pages
        </h2>
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {POPULAR.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                className="inline-block rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-700 hover:border-brand hover:text-brand transition-colors"
              >
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
