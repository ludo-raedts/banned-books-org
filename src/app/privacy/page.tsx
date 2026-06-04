import { execSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import type { Metadata } from 'next'
import Link from 'next/link'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'How Banned Books handles visitor data: minimal pageview logging, no advertising trackers, no Google Analytics, no Amazon. We document what we collect, why, and what we do not do.',
  alternates: { canonical: '/privacy' },
}

const SOURCE_PATH = join(process.cwd(), 'src/app/privacy/page.tsx')

function getLastUpdated(): Date {
  try {
    const out = execSync(`git log -1 --format=%cI -- "${SOURCE_PATH}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (out) return new Date(out)
  } catch {}
  try {
    return statSync(SOURCE_PATH).mtime
  } catch {}
  return new Date()
}

const LAST_UPDATED = getLastUpdated().toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function PrivacyPage() {
  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <Eyebrow>Privacy</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            Privacy policy
          </h1>

          <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
            Banned Books is an editorial catalogue. We do not run advertising, we do not sell your personal data, and
            we do not want to know who you are. This page documents the small amount of data we do process, why, and
            the deliberate choices we have made about what <em>not</em> to use.
          </p>

          <p className="mt-4 text-xs text-neutral-500">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <SectionShell tone="cream">
        <article className="max-w-3xl mx-auto prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-oxblood/30 prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900">

          <h2>The short version</h2>
          <ul>
            <li>We log basic, anonymous pageview data so we know which entries are read.</li>
            <li>We do not set tracking cookies, fingerprint visitors, run ads, or load any third-party trackers.</li>
            <li>We do not link to Amazon, on principle.</li>
            <li>Outbound links to news sites and affiliate booksellers may be logged by those third parties when you click — that is outside our control.</li>
            <li>If you contact us, your message is processed by a form provider so we can reply.</li>
            <li>If you buy the dataset, payment is handled by Stripe and we store your email address so we can send (and re-send) the download link.</li>
          </ul>

          <h2>What we collect when you visit a page</h2>
          <p>
            For each pageview on a book or author page we record a small log entry in our database
            (<strong>Supabase</strong>) containing the path
            (e.g. <code>/books/animal-farm</code>), a two-letter country code derived
            from your IP address by our hosting provider, and the hostname of the referring site if you arrived
            from one. We do not store IP addresses, user-agent strings, screen sizes, or any other identifier
            that could be tied back to you.
          </p>
          <p>
            We use this data in aggregate to understand which entries are read and which sources send readers
            to the catalogue. It is not joined to any other data set, it is not shared with third parties, and
            it is not used for advertising or profiling.
          </p>
          <p>
            In addition, our hosting provider (<strong>Vercel</strong>) processes anonymous traffic data for
            performance monitoring and high-level analytics. Vercel Analytics is cookie-free and does not use
            IP addresses for tracking; it only derives a country and device class on the edge before discarding
            the IP.
          </p>

          <h2>Cookies</h2>
          <p>
            We do not set advertising or analytics cookies. We do not use a cookie banner because we do not
            place anything that requires consent under the ePrivacy Directive.
          </p>
          <p>
            The only cookie the site can set is <code>bb_internal</code>, an
            internal flag we use ourselves to exclude our own visits from pageview logs. It is never set on
            ordinary visitors. Third parties whose sites you click through to may set their own cookies — see
            the section on outbound links below.
          </p>

          <h2>Outbound links and affiliate links</h2>
          <p>
            The catalogue links extensively to outside sources: news organisations, government records, civil
            society reports, library associations, and online booksellers. When you click such a link, the
            destination site receives the standard information any web request involves — your IP address,
            user-agent, and the page you came from (the <em>referrer</em>). That is normal web behaviour and
            we cannot prevent it.
          </p>
          <p>
            Some outbound links to booksellers are <strong>affiliate links</strong>. They contain a tag that
            tells the bookseller the click came from us, which lets them pay a small commission on any
            resulting purchase at no extra cost to you. The affiliate platform — and the bookseller — can
            measure clicks, sessions, and purchases attributed to that tag. We use Bookshop.org affiliate
            links (which support independent bookstores) and Kobo affiliate links via the Rakuten
            Advertising network. We do not run our own click tracking on top of these links.
          </p>
          <p>
            <strong>We deliberately do not link to Amazon.</strong> Amazon has itself been involved in book
            removal and de-listing decisions, and we do not want to send readers — or affiliate revenue —
            to a retailer that participates in the very behaviour this catalogue documents.
          </p>
          <p>
            For public-domain works we link to <Link href="https://www.gutenberg.org">Project Gutenberg</Link>,
            which is non-commercial. For news and source citations we link to the original publishers; those
            sites have their own privacy practices and many of them do run advertising trackers. We have
            no influence on what they collect once you leave our domain.
          </p>

          <h2>Embedded media and widgets</h2>
          <p>
            A few pages embed content from third parties. Opening those pages can cause your browser to
            contact those services:
          </p>
          <ul>
            <li>
              <strong>YouTube videos</strong> (on the film and history pages) use a click-to-load facade in
              privacy-enhanced mode (<code>youtube-nocookie.com</code>): no YouTube player or cookie loads
              until you press play. The still thumbnail shown before you click is fetched from YouTube&apos;s
              image CDN, so your IP address does reach Google for that one image.
            </li>
            <li>
              <strong>Bookshop.org reading-list widgets</strong> (on some reason and scope pages) load an
              embedded list from Bookshop.org when they scroll into view, which sends Bookshop the request and
              our affiliate tag. This is the same affiliate relationship described above, delivered as an embed
              rather than a link.
            </li>
          </ul>

          <h2>Contact form</h2>
          <p>
            The contact form on the <Link href="/about">about page</Link> is
            handled by <strong>Formspree</strong>. When you submit the form, your name, optional organisation,
            email address, and message are transmitted to Formspree, which forwards them to us by email. We use
            this data only to respond to your message and to follow up if needed. We do not add you to a
            mailing list — we do not have one.
          </p>
          <p>
            You can ask us at any time to delete the correspondence we hold from you. Formspree&apos;s own
            privacy practices apply to the submission as it transits their service.
          </p>

          <h2>Dataset purchases</h2>
          <p>
            The catalogue is also available as a paid download at{' '}
            <Link href="/dataset">/dataset</Link>.
            When you go through checkout, three third parties are involved alongside our own database:
          </p>
          <ul>
            <li>
              <strong>Stripe</strong> handles the payment. You enter your name, email address, billing
              country, and payment details directly into Stripe&apos;s hosted checkout page. Stripe also
              processes your IP address for fraud prevention and tax determination, and acts as an
              independent controller for that payment data under its own privacy notice.
            </li>
            <li>
              Once Stripe confirms a successful payment, we receive (and store) your{' '}
              <strong>email address</strong>, the Stripe session ID, and the amount and currency paid.
              These are written to a <code>dataset_orders</code> row in our
              database (<strong>Supabase</strong>) together with a random one-time download token that
              expires after 30 days.
            </li>
            <li>
              The download link is delivered to your email through <strong>Resend</strong>, our
              transactional email provider. Resend processes the message only to deliver it.
            </li>
          </ul>
          <p>
            We use this data to deliver the dataset, re-send the link if you lose it, and reconcile sales
            with Stripe. We do not use it for marketing — we do not have a mailing list, and we do not
            share purchaser email addresses with anyone. Order rows are retained as a record of sale
            (needed for tax, refund, and licensing purposes); after the 30-day download window has
            closed you can ask us via the{' '}
            <Link href="/about#get-in-touch">contact form on the about page</Link>{' '}
            to delete your order record.
          </p>

          <h2>What we deliberately do not use</h2>
          <p>
            Privacy matters to this project. The following are <em>not</em> present anywhere on this site:
          </p>
          <ul>
            <li>Google Analytics, Google Tag Manager, or any other Google tracking product.</li>
            <li>Google Fonts loaded from Google&apos;s servers — our fonts are self-hosted at build time.</li>
            <li>Facebook Pixel, Meta tracking, TikTok pixel, LinkedIn Insight, or any advertising network tag.</li>
            <li>Hotjar, FullStory, or any session-replay or heatmap tool.</li>
            <li>Amazon affiliate links, Amazon ads, or any link to amazon.com / amazon.* domains in the catalogue.</li>
            <li>Sponsored content, paid placements, or third-party advertising of any kind.</li>
          </ul>
          <p>
            If you ever see a request from this site to a tracker we have not listed here, that is a bug.
            Please tell us.
          </p>

          <h2>Your rights</h2>
          <p>
            Under the EU General Data Protection Regulation and equivalent laws elsewhere, you have the right
            to ask what personal data we hold about you, to ask us to correct or delete it, and to object to
            its processing. Because we do not log identifiers that map to individual visitors, in practice the
            only data we are likely to hold on you is correspondence you have sent us through the contact form
            and, if you have bought the dataset, your order record (email address, Stripe session ID, amount,
            and timestamp).
          </p>
          <p>
            To exercise any of these rights, or to raise a concern, please use the{' '}
            <Link href="/about#get-in-touch">contact form on the about page</Link>.
            If you are not satisfied with our response you have the right to complain to your local data
            protection authority — for visitors in the Netherlands, the{' '}
            <Link href="https://autoriteitpersoonsgegevens.nl">Autoriteit Persoonsgegevens</Link>.
          </p>

          <h2>Controller and changes to this policy</h2>
          <p>
            Banned Books is a personal project run by Ludo Raedts, based in Groningen, the Netherlands. For the
            purposes of data protection law, the controller of any personal data processed via this site is
            Ludo Raedts. To get in touch, use the{' '}
            <Link href="/about#get-in-touch">contact form on the about page</Link>.
          </p>
          <p>
            We will update this page if our practices change. Material changes will be reflected in the
            &ldquo;last updated&rdquo; date at the top.
          </p>

        </article>
      </SectionShell>
    </main>
  )
}
