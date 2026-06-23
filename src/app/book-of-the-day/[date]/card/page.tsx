// /book-of-the-day/[date]/card — a printable "shelf card" for libraries and
// classrooms. The audience here (librarians, teachers, advocates) displays
// physical material; this is a clean, print-optimised card they can put on a
// shelf or board. On screen it shows the card + a Print button; printing hides
// all site chrome via the @media print rules below.

import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { SITE_URL } from '@/lib/canonical-host'
import {
  getBookForDate, isPublishableBotdDate, publishedBotdDates,
  reasonPhrases, joinHuman, whereClause,
} from '@/lib/book-of-the-day'
import { PrintButton } from '@/components/share-tools'
import { isAllowedImageUrl } from '@/lib/allowed-image-hosts'

export const revalidate = 86400
export const dynamicParams = true

export async function generateStaticParams() {
  return publishedBotdDates().map((date) => ({ date }))
}

function formatLong(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

export const metadata: Metadata = { robots: { index: false } }

export default async function ShelfCardPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  if (!isPublishableBotdDate(date)) notFound()

  const book = await getBookForDate(date)
  if (!book) notFound()

  const long = formatLong(date)
  const reasons = reasonPhrases(book.reasons)
  const where = whereClause(book.countries, book.countryCount)
  const whyLine = reasons.length
    ? `Banned for ${joinHuman(reasons.slice(0, 3))}${where ? ` ${where}` : ''}.`
    : where ? `Banned ${where}.` : 'A banned book.'
  const coverOk = !!book.coverUrl && isAllowedImageUrl(book.coverUrl)
  const shortUrl = `banned-books.org/book-of-the-day/${date}`

  return (
    <>
      {/* Print rules: drop all site chrome, give the card the whole page. */}
      <style>{`@media print {
        header, footer { display: none !important; }
        .no-print { display: none !important; }
        main { padding: 0 !important; }
        @page { margin: 1.5cm; }
      }`}</style>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="no-print flex items-center justify-between mb-6 text-sm">
          <Link href={`/book-of-the-day/${date}`} className="text-neutral-500 hover:text-oxblood transition-colors">
            ← Back
          </Link>
          <PrintButton />
        </div>

        {/* The card itself */}
        <article className="border-2 border-brand rounded-2xl overflow-hidden bg-white">
          <div className="bg-brand text-white px-8 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Banned book of the day</p>
            <p className="text-[11px] uppercase tracking-widest text-white/80 mt-0.5">{long}</p>
          </div>

          <div className="flex gap-7 items-start p-8">
            {coverOk ? (
              <Image src={book.coverUrl!} alt={book.title} width={170} height={255} className="flex-none rounded-md shadow-lg object-cover" />
            ) : (
              <div className="flex-none w-[170px] h-[255px] rounded-md bg-brand-light border border-cream-border" />
            )}
            <div className="min-w-0 pt-1">
              <h1 className="font-serif text-3xl font-semibold tracking-tight leading-tight text-gray-900">
                {book.title}
                {book.year && <span className="text-gray-400 font-normal"> ({book.year})</span>}
              </h1>
              <p className="text-lg text-gray-600 mt-1 mb-5">{book.author}</p>
              <p className="text-sm font-semibold text-oxblood uppercase tracking-wide mb-1">Why it was banned</p>
              <p className="text-base text-gray-700 leading-relaxed">
                {book.descriptionBan?.trim() || whyLine}
              </p>
            </div>
          </div>

          <div className="border-t border-cream-border px-8 py-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">Read the full censorship record:</span>
            <span className="font-serif text-base font-semibold text-brand">{shortUrl}</span>
          </div>
        </article>

        <p className="no-print text-xs text-neutral-400 mt-4 text-center">
          Tip: print to A4/Letter, or save as PDF. Hand it out, pin it up, or set it on the shelf.
          {' '}<Link href={`${SITE_URL}/book-of-the-day`} className="text-oxblood hover:underline">More cards →</Link>
        </p>
      </main>
    </>
  )
}
