// /book-of-the-day/[date] — a permanent, indexable page for one day's banned
// book. Turns the ephemeral daily into a durable artifact: the RSS feed links
// here, the pick stays linkable forever, and the set grows by one evergreen
// long-tail page each day. The rotation is deterministic per UTC date, so any
// published date reproduces the same book.

import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { SITE_URL } from '@/lib/canonical-host'
import {
  getBookForDate, isPublishableBotdDate, publishedBotdDates, todayYmd,
  reasonPhrases, joinHuman, whereClause,
} from '@/lib/book-of-the-day'
import { ShareRow } from '@/components/share-tools'
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

function shiftDate(ymd: string, delta: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10)
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params
  if (!isPublishableBotdDate(date)) return {}
  const book = await getBookForDate(date)
  const long = formatLong(date)
  const title = book
    ? `${book.title} — banned book of the day, ${long}`
    : `Banned book of the day — ${long}`
  const description = book
    ? `${book.title} by ${book.author} was the banned book of the day for ${long} — the record of where and why it was censored.`
    : `The banned book of the day for ${long}.`
  return {
    title,
    description,
    alternates: { canonical: `/book-of-the-day/${date}` },
    openGraph: { title, description, type: 'article', url: `/book-of-the-day/${date}` },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function BookOfTheDayDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  if (!isPublishableBotdDate(date)) notFound()

  const book = await getBookForDate(date)
  const long = formatLong(date)
  const isToday = date === todayYmd()

  const prev = shiftDate(date, -1)
  const next = shiftDate(date, 1)
  const hasPrev = isPublishableBotdDate(prev)
  const hasNext = isPublishableBotdDate(next)

  const bookHref = book ? `/books/${book.slug}` : '/discover'
  const shareUrl = `${SITE_URL}/book-of-the-day/${date}?utm_source=share&utm_medium=referral&utm_campaign=book-of-the-day`
  const reasons = book ? reasonPhrases(book.reasons) : []
  const where = book ? whereClause(book.countries, book.countryCount) : ''
  const shareText = book
    ? `📚 Banned book of the day (${long}): "${book.title}" by ${book.author}${
        reasons.length ? ` — banned for ${joinHuman(reasons.slice(0, 2))}` : ''
      }${where ? ` ${where}` : ''}.`
    : '📚 Banned book of the day'
  const coverOk = !!book?.coverUrl && isAllowedImageUrl(book.coverUrl)

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <nav className="flex items-center justify-between text-sm mb-6">
        <Link href="/book-of-the-day" className="text-neutral-500 hover:text-oxblood transition-colors">
          ← Archive
        </Link>
        {!isToday && (
          <Link href="/share" className="text-neutral-500 hover:text-oxblood transition-colors">
            Today&rsquo;s book →
          </Link>
        )}
      </nav>

      <p className="text-xs font-medium uppercase tracking-widest text-brand/70 mb-3">
        Banned book of the day · {long}
      </p>

      {book ? (
        <>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight leading-tight mb-8">
            {book.title}
            {book.year && <span className="text-gray-400 font-normal"> ({book.year})</span>}
          </h1>

          <section className="bg-brand-light border-l-4 border-brand rounded-r-xl p-6 mb-8">
            <div className="flex gap-5 items-start">
              <Link href={bookHref} className="flex-none">
                {coverOk ? (
                  <Image src={book.coverUrl!} alt={book.title} width={120} height={180} className="rounded-md shadow-md object-cover" />
                ) : (
                  <div className="w-[120px] h-[180px] rounded-md bg-white/60 border border-cream-border" />
                )}
              </Link>
              <div className="min-w-0">
                <p className="text-sm text-gray-600 mb-3">{book.author}</p>
                {book.descriptionBan ? (
                  <p className="text-sm text-gray-700 leading-relaxed">{book.descriptionBan}</p>
                ) : (
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {reasons.length ? `Banned for ${joinHuman(reasons.slice(0, 3))}` : 'Banned'}
                    {where ? ` ${where}` : ''}.
                  </p>
                )}
                <Link href={bookHref} className="inline-block mt-3 text-sm font-medium text-oxblood hover:underline">
                  Read the full censorship record →
                </Link>
              </div>
            </div>
          </section>

          <div className="mb-6">
            <ShareRow url={shareUrl} text={shareText} />
          </div>
          <Link
            href={`/book-of-the-day/${date}/card`}
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-oxblood transition-colors mb-10"
          >
            🖨 Print a shelf card for libraries &amp; classrooms →
          </Link>
        </>
      ) : (
        <p className="text-sm text-neutral-500 mb-10">No book was recorded for this date.</p>
      )}

      <nav className="flex items-center justify-between border-t border-neutral-100 pt-5 text-sm">
        {hasPrev ? (
          <Link href={`/book-of-the-day/${prev}`} className="text-neutral-600 hover:text-oxblood transition-colors">
            ← {formatLong(prev)}
          </Link>
        ) : <span />}
        {hasNext ? (
          <Link href={`/book-of-the-day/${next}`} className="text-neutral-600 hover:text-oxblood transition-colors">
            {formatLong(next)} →
          </Link>
        ) : <span />}
      </nav>
    </main>
  )
}
