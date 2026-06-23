// /share — the public hub for the "banned book of the day". Shows today's pick
// with real context (the editor "why it was banned" copy), then bundles every
// way to spread or re-use it: one-tap social share, a copy-paste <iframe>
// widget (live-previewed on the page itself), and a hot-linkable image badge.
//
// The pick is the SAME one the Bluesky bot broadcasts (getBookOfTheDay reuses
// pickDailyBook), so a visitor arriving from a Bluesky post sees a matching
// title here. The heavy daily scan is cached once per UTC day.

import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SITE_URL } from '@/lib/canonical-host'
import { getBookOfTheDay, reasonPhrases, joinHuman, whereClause } from '@/lib/book-of-the-day'
import { ShareRow, EmbedSnippets, FeedSubscribe } from '@/components/share-tools'
import { isAllowedImageUrl } from '@/lib/allowed-image-hosts'

export const revalidate = 3600

const META_DESCRIPTION =
  'A different banned or challenged book every day, with the record of where and why it was censored. Share it, subscribe in Slack, Discord or Teams, embed the live widget, or follow the RSS feed.'

export const metadata: Metadata = {
  title: 'Banned book of the day — share, embed & subscribe',
  description: META_DESCRIPTION,
  keywords: [
    'banned book of the day',
    'banned books RSS feed',
    'censored books widget',
    'book ban Slack feed',
    'embed banned books',
  ],
  alternates: {
    canonical: '/share',
    types: {
      'application/rss+xml': [{ url: '/book-of-the-day/feed.xml', title: 'Banned book of the day' }],
    },
  },
  openGraph: {
    title: 'Banned book of the day',
    description: META_DESCRIPTION,
    url: '/share',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Banned book of the day',
    description: 'A different banned book every day — share it, embed it, or subscribe in your tools.',
  },
}

export default async function SharePage() {
  const book = await getBookOfTheDay()

  const bookHref = book ? `/books/${book.slug}` : '/discover'
  const shareUrl = `${SITE_URL}${bookHref}?utm_source=share&utm_medium=referral&utm_campaign=book-of-the-day`

  const reasons = book ? reasonPhrases(book.reasons) : []
  const where = book ? whereClause(book.countries, book.countryCount) : ''
  const shareText = book
    ? `📚 Banned book of the day: "${book.title}" by ${book.author}${
        reasons.length ? ` — banned for ${joinHuman(reasons.slice(0, 2))}` : ''
      }${where ? ` ${where}` : ''}.`
    : '📚 Banned book of the day'

  // Embed snippets. The iframe points at the chrome-free widget route; the badge
  // is the live PNG wrapped in a link back to this hub.
  const feedUrl = `${SITE_URL}/book-of-the-day/feed.xml`
  const iframeSnippet = `<iframe src="${SITE_URL}/embed/book-of-the-day" width="520" height="240" style="border:0;max-width:100%" title="Banned book of the day" loading="lazy"></iframe>`
  const badgeSnippet = `[![Banned book of the day](${SITE_URL}/book-of-the-day/image)](${SITE_URL}/share)`

  const coverOk = !!book?.coverUrl && isAllowedImageUrl(book.coverUrl)

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <p className="text-xs font-medium uppercase tracking-widest text-brand/70 mb-3">
        Banned book of the day
      </p>
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight leading-tight mb-3">
        Share today&rsquo;s banned book
      </h1>
      <p className="text-base text-gray-600 leading-relaxed mb-10 max-w-2xl">
        Every day we surface a different banned or challenged book, with the record of where and
        why it was censored. Pass it on, follow it, or drop the live widget onto your own site.
      </p>

      {/* Today's pick */}
      {book ? (
        <section className="bg-brand-light border-l-4 border-brand rounded-r-xl p-6 mb-10">
          <div className="flex gap-5 items-start">
            <Link href={bookHref} className="flex-none">
              {coverOk ? (
                <Image
                  src={book.coverUrl!}
                  alt={book.title}
                  width={110}
                  height={165}
                  className="rounded-md shadow-md object-cover"
                />
              ) : (
                <div className="w-[110px] h-[165px] rounded-md bg-white/60 border border-cream-border" />
              )}
            </Link>
            <div className="min-w-0">
              <Link href={bookHref} className="group block">
                <h2 className="font-serif text-2xl font-semibold tracking-tight leading-tight text-gray-900 group-hover:text-oxblood transition-colors">
                  {book.title}
                  {book.year && <span className="text-gray-400 font-normal"> ({book.year})</span>}
                </h2>
              </Link>
              <p className="text-sm text-gray-600 mt-1 mb-3">{book.author}</p>
              {book.descriptionBan ? (
                <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">{book.descriptionBan}</p>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed">
                  {reasons.length ? `Banned for ${joinHuman(reasons.slice(0, 3))}` : 'Banned'}
                  {where ? ` ${where}` : ''}.
                </p>
              )}
              <Link
                href={bookHref}
                className="inline-block mt-3 text-sm font-medium text-oxblood hover:underline"
              >
                Read the full censorship record →
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="border border-neutral-200 rounded-xl p-6 mb-10 text-sm text-neutral-500">
          Today&rsquo;s pick is being prepared. Meanwhile, explore the{' '}
          <Link href="/discover" className="text-oxblood hover:underline">full archive</Link>.
        </section>
      )}

      {/* Share */}
      <section className="mb-12">
        <h2 className="font-serif text-xl font-semibold tracking-tight text-gray-900 mb-1">Share it</h2>
        <p className="text-sm text-neutral-500 mb-4">Post today&rsquo;s book to your network.</p>
        <ShareRow url={shareUrl} text={shareText} />
      </section>

      {/* Follow */}
      <section className="mb-12">
        <h2 className="font-serif text-xl font-semibold tracking-tight text-gray-900 mb-1">Follow it</h2>
        <p className="text-sm text-neutral-500 mb-4">Get the banned book of the day in your feed.</p>
        <a
          href="https://bsky.app/profile/banned-books.org"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md bg-brand text-white hover:bg-brand-dark transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 600 530" fill="currentColor" aria-hidden="true">
            <path d="M135.72 44.03C202.216 93.951 273.74 195.17 300 249.49c26.262-54.316 97.782-155.54 164.28-205.46C512.26 8.009 590-19.862 590 68.825c0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.38-3.69-10.832-3.708-7.896-.017-2.936-1.193.516-3.707 7.896-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.449-163.25-81.433C20.15 217.613 9.997 86.535 9.997 68.825c0-88.687 77.742-60.816 125.72-24.795z" />
          </svg>
          Follow on Bluesky
        </a>
      </section>

      {/* Embed */}
      <section className="mb-12">
        <h2 className="font-serif text-xl font-semibold tracking-tight text-gray-900 mb-1">Put it on your site</h2>
        <p className="text-sm text-neutral-500 mb-5">
          A live widget that updates itself every day. No script, no tracking — just an iframe or an image.
        </p>

        <div className="grid gap-8 sm:grid-cols-2 items-start">
          {/* Live preview of the actual embed */}
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500 block mb-2">
              Live preview
            </span>
            <iframe
              src="/embed/book-of-the-day"
              width={520}
              height={240}
              style={{ border: 0, maxWidth: '100%' }}
              title="Banned book of the day preview"
              loading="lazy"
            />
          </div>
          <EmbedSnippets iframe={iframeSnippet} badge={badgeSnippet} />
        </div>
      </section>

      {/* Subscribe / automate — one feed, every chat tool & reader */}
      <section className="mb-4">
        <h2 className="font-serif text-xl font-semibold tracking-tight text-gray-900 mb-1">Get it in your tools</h2>
        <p className="text-sm text-neutral-500 mb-5 max-w-2xl">
          One feed drops the daily book straight into Slack, Discord, Teams or any reader — no account,
          no setup on our end. The platform polls the feed and posts each new day for you.
        </p>
        <FeedSubscribe feedUrl={feedUrl} />
      </section>
    </main>
  )
}
