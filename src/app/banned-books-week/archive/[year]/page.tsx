import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBBWConfig } from '@/config/banned-books-week'
import { getPublishedFeaturedBooks } from '@/lib/bbw-data'
import { BBWDisclaimer } from '@/components/bbw-disclaimer'

export const dynamic = 'force-dynamic'

// Archive route: only renders for years that are strictly in the past relative
// to the configured year. Current and future years redirect to the live hub.
// (Current-year archive is meaningless; future is impossible.)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>
}): Promise<Metadata> {
  const { year } = await params
  return {
    title: `Banned Books Week ${year} — Archive`,
    description: `Archived featured picks from Banned Books Week ${year}.`,
    alternates: { canonical: `/banned-books-week/archive/${year}` },
  }
}

export default async function BannedBooksWeekArchivePage({
  params,
}: {
  params: Promise<{ year: string }>
}) {
  const { year: yearStr } = await params
  const year = Number(yearStr)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) notFound()
  const config = await getBBWConfig()
  if (year >= config.year) notFound()

  const featured = await getPublishedFeaturedBooks(year)
  if (featured.length === 0) notFound()

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/banned-books-week" className="text-sm text-gray-500 hover:underline">
        ← Banned Books Week
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-2">Banned Books Week {year}</h1>
      <p className="text-sm text-gray-500 mb-8">Archive — featured picks from {year}.</p>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {featured.map(f => (
          <li key={f.bookId} className="border border-gray-200 rounded-lg p-4 bg-white">
            <Link href={`/books/${f.book.slug}`} className="font-semibold text-sm hover:text-brand transition-colors block">
              {f.book.title}
            </Link>
            <div className="text-xs text-gray-500 mt-0.5">{f.book.authors.join(', ')}</div>
            {f.customBlurb && (
              <p className="text-xs text-gray-700 mt-2 leading-relaxed">{f.customBlurb}</p>
            )}
          </li>
        ))}
      </ul>

      <BBWDisclaimer variant="full" />
    </main>
  )
}
