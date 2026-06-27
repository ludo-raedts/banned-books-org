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
import { getBookOfTheDay, reasonPhrases, joinHuman, whereClause, todayYmd } from '@/lib/book-of-the-day'
import { ShareRow, CopySnippet, FeedSubscribe } from '@/components/share-tools'
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
  const svgBadgeSnippet = `<a href="${SITE_URL}/share"><picture><source media="(prefers-color-scheme: dark)" srcset="${SITE_URL}/book-of-the-day/badge.svg?theme=dark"><img alt="Banned book of the day" src="${SITE_URL}/book-of-the-day/badge.svg"></picture></a>`

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
        <Link
          href={`/book-of-the-day/${todayYmd()}/card`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-oxblood transition-colors mt-4"
        >
          🖨 Print a shelf card for libraries &amp; classrooms →
        </Link>
      </section>

      {/* Follow */}
      <section className="mb-12">
        <h2 className="font-serif text-xl font-semibold tracking-tight text-gray-900 mb-1">Follow it</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Get the banned book of the day in your feed — every day, automatically.
        </p>
        <div className="flex flex-wrap gap-3">
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
          <a
            href="https://www.linkedin.com/company/banned-books-org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md bg-brand text-white hover:bg-brand-dark transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
            </svg>
            Follow on LinkedIn
          </a>
          <a
            href="https://www.instagram.com/bannedbooksarchive"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md bg-brand text-white hover:bg-brand-dark transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 3.68a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z" />
            </svg>
            Follow on Instagram
          </a>
          <a
            href="https://www.facebook.com/bannedbooks.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md bg-brand text-white hover:bg-brand-dark transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.03 4.39 11.03 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8v8.44C19.61 23.1 24 18.1 24 12.07z" />
            </svg>
            Follow on Facebook
          </a>
        </div>
      </section>

      {/* Embed */}
      <section className="mb-12">
        <h2 className="font-serif text-xl font-semibold tracking-tight text-gray-900 mb-1">Put it on your site</h2>
        <p className="text-sm text-neutral-500 mb-6">
          Three ways to show today&rsquo;s banned book — each updates itself every day, no script and no tracking.
          Here&rsquo;s exactly what each one looks like.
        </p>

        <div className="space-y-10">
          {/* 1 — Live widget (iframe) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Live widget</h3>
            <p className="text-sm text-neutral-500 mb-3">An interactive panel with the cover, the censorship context and a link through to the record.</p>
            <div className="grid gap-6 sm:grid-cols-2 items-start">
              <iframe
                src="/embed/book-of-the-day"
                width={520}
                height={240}
                style={{ border: 0, maxWidth: '100%' }}
                title="Banned book of the day preview"
                loading="lazy"
              />
              <CopySnippet label="Embed (iframe)" code={iframeSnippet} />
            </div>
          </div>

          {/* 2 — Image badge (PNG card) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Image badge</h3>
            <p className="text-sm text-neutral-500 mb-3">A 1200×630 card — ideal as a blog-post or newsletter image, or a README hero. Updates daily.</p>
            <div className="grid gap-6 sm:grid-cols-2 items-start">
              <a href="/book-of-the-day/image" target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/book-of-the-day/image"
                  alt="Banned book of the day — image badge"
                  width={1200}
                  height={630}
                  className="w-full rounded-lg border border-cream-border shadow-sm"
                />
              </a>
              <CopySnippet label="Image badge (Markdown)" code={badgeSnippet} />
            </div>
          </div>

          {/* 3 — SVG badge (auto light/dark) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">SVG badge</h3>
            <p className="text-sm text-neutral-500 mb-3">A small, crisp badge that auto-switches between light and dark. Perfect for a README or sidebar.</p>
            <div className="grid gap-6 sm:grid-cols-2 items-start">
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/book-of-the-day/badge.svg"
                  alt="Banned book of the day — SVG badge, light"
                  width={360}
                  height={84}
                  className="max-w-full rounded-xl"
                />
                <div className="inline-flex rounded-xl bg-[#1a1414] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/book-of-the-day/badge.svg?theme=dark"
                    alt="Banned book of the day — SVG badge, dark"
                    width={360}
                    height={84}
                    className="max-w-full"
                  />
                </div>
                <p className="text-xs text-neutral-400">Light &amp; dark shown — the snippet picks the right one automatically.</p>
              </div>
              <CopySnippet label="SVG badge — auto dark/light (HTML)" code={svgBadgeSnippet} />
            </div>
          </div>
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
