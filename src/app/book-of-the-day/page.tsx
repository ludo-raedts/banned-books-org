// /book-of-the-day — the archive grid of every published daily pick, newest
// first. An evergreen index that grows by one entry a day and links each dated
// permalink; also the landing for "← Archive" from a dated page.

import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getBotdArchive } from '@/lib/book-of-the-day'
import { isAllowedImageUrl } from '@/lib/allowed-image-hosts'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Banned book of the day — archive',
  description:
    'Every banned book of the day, newest first: a different censored or challenged book each day, with the record of where and why it was banned.',
  alternates: { canonical: '/book-of-the-day' },
  openGraph: {
    title: 'Banned book of the day — archive',
    description: 'A different banned book every day. Browse the full archive.',
    type: 'website',
    url: '/book-of-the-day',
  },
}

function formatShort(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

export default async function BotdArchivePage() {
  const entries = await getBotdArchive(120)

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <p className="text-xs font-medium uppercase tracking-widest text-brand/70 mb-3">Archive</p>
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight leading-tight mb-3">
        Banned book of the day
      </h1>
      <p className="text-base text-gray-600 leading-relaxed mb-8 max-w-2xl">
        A different banned or challenged book every day. Browse the archive below, or{' '}
        <Link href="/share" className="text-oxblood hover:underline">see today&rsquo;s book and subscribe</Link>.
      </p>

      <ul className="grid gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
        {entries.map(({ date, book }) => {
          const coverOk = !!book?.coverUrl && isAllowedImageUrl(book.coverUrl)
          return (
            <li key={date}>
              <Link href={`/book-of-the-day/${date}`} className="group block">
                <div className="aspect-[2/3] rounded-md overflow-hidden bg-brand-light border border-cream-border mb-2">
                  {coverOk ? (
                    <Image
                      src={book!.coverUrl!}
                      alt={book!.title}
                      width={200}
                      height={300}
                      className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs text-neutral-400 font-serif">
                      {book?.title ?? '—'}
                    </div>
                  )}
                </div>
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">{formatShort(date)}</p>
                {book && (
                  <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2 group-hover:text-oxblood transition-colors">
                    {book.title}
                  </p>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
