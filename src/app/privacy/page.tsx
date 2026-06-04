import { execSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import type { Metadata } from 'next'
import Link from 'next/link'

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
    <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-14">

      {/* Header */}
      <div className="bg-brand-light border-l-4 border-brand pl-6 pr-4 py-6 rounded-r-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-brand/70 mb-3">Privacy</p>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy policy</h1>
        <p className="text-gray-700 max-w-2xl leading-relaxed text-sm">
          Banned Books is an editorial catalogue. We do not run advertising, we do not sell your personal data, and
          we do not want to know who you are. This page documents the small amount of data we do process, why, and the
          deliberate choices we have made about what <em>not</em> to use.
        </p>
        <p className="text-xs text-gray-500 mt-4">Last updated: {LAST_UPDATED}</p>
      </div>

      {/* 1. The short version */}
      <section>
        <h2 className="text-xl font-semibold mb-4">The short version</h2>
        <ul className="flex flex-col gap-3 text-sm text-gray-700 leading-relaxed">
          <li>• We log basic, anonymous pageview data so we know which entries are read.</li>
          <li>• We do not set tracking cookies, fingerprint visitors, run ads, or load any third-party trackers.</li>
          <li>• We do not link to Amazon, on principle.</li>
          <li>• Outbound links to news sites and affiliate booksellers may be logged by those third parties when you click — that is outside our control.</li>
          <li>• If you contact us, your message is processed by a form provider so we can reply.</li>
          <li>• If you buy the dataset, payment is handled by Stripe and we store your email address so we can send (and re-send) the download link.</li>
        </ul>
      </section>

      {/* 2. What we collect when you visit */}
      <section>
        <h2 className="text-xl font-semibold mb-4">What we collect when you visit a page</h2>
        <div className="text-gray-700 leading-relaxed flex flex-col gap-4 text-sm">
          <p>
            For each pageview on a book or author page we record a small log entry in our database
            (<strong>Supabase</strong>) containing the path
            (e.g. <code className="font-mono text-xs">/books/animal-farm</code>), a two-letter country code derived
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
        </div>
      </section>

      {/* 3. Cookies */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Cookies</h2>
        <div className="text-gray-700 leading-relaxed flex flex-col gap-4 text-sm">
          <p>
            We do not set advertising or analytics cookies. We do not use a cookie banner because we do not
            place anything that requires consent under the ePrivacy Directive.
          </p>
          <p>
            The only cookie the site can set is <code className="font-mono text-xs">bb_internal</code>, an
            internal flag we use ourselves to exclude our own visits from pageview logs. It is never set on
            ordinary visitors. Third parties whose sites you click through to may set their own cookies — see
            the section on outbound links below.
          </p>
        </div>
      </section>

      {/* 4. Outbound links */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Outbound links and affiliate links</h2>
        <div className="text-gray-700 leading-relaxed flex flex-col gap-4 text-sm">
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
            For public-domain works we link to <Link href="https://www.gutenberg.org" className="underline hover:text-gray-900">Project Gutenberg</Link>,
            which is non-commercial. For news and source citations we link to the original publishers; those
            sites have their own privacy practices and many of them do run advertising trackers. We have
            no influence on what they collect once you leave our domain.
          </p>
        </div>
      </section>

      {/* 5. Contact form */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Contact form</h2>
        <div className="text-gray-700 leading-relaxed flex flex-col gap-4 text-sm">
          <p>
            The contact form on the <Link href="/about" className="underline hover:text-gray-900">about page</Link> is
            handled by <strong>Formspree</strong>. When you submit the form, your name, optional organisation,
            email address, and message are transmitted to Formspree, which forwards them to us by email. We use
            this data only to respond to your message and to follow up if needed. We do not add you to a
            mailing list — we do not have one.
          </p>
          <p>
            You can ask us at any time to delete the correspondence we hold from you. Formspree&apos;s own
            privacy practices apply to the submission as it transits their service.
          </p>
        </div>
      </section>

      {/* 6. Dataset purchases */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Dataset purchases</h2>
        <div className="text-gray-700 leading-relaxed flex flex-col gap-4 text-sm">
          <p>
            The catalogue is also available as a paid download at{' '}
            <Link href="/dataset" className="underline hover:text-gray-900">/dataset</Link>.
            When you go through checkout, three third parties are involved alongside our own database:
          </p>
          <ul className="flex flex-col gap-2">
            <li>
              • <strong>Stripe</strong> handles the payment. You enter your name, email address, billing
              country, and payment details directly into Stripe&apos;s hosted checkout page. Stripe also
              processes your IP address for fraud prevention and tax determination, and acts as an
              independent controller for that payment data under its own privacy notice.
            </li>
            <li>
              • Once Stripe confirms a successful payment, we receive (and store) your{' '}
              <strong>email address</strong>, the Stripe session ID, and the amount and currency paid.
              These are written to a <code className="font-mono text-xs">dataset_orders</code> row in our
              database (<strong>Supabase</strong>) together with a random one-time download token that
              expires after 30 days.
            </li>
            <li>
              • The download link is delivered to your email through <strong>Resend</strong>, our
              transactional email provider. Resend processes the message only to deliver it.
            </li>
          </ul>
          <p>
            We use this data to deliver the dataset, re-send the link if you lose it, and reconcile sales
            with Stripe. We do not use it for marketing — we do not have a mailing list, and we do not
            share purchaser email addresses with anyone. Order rows are retained as a record of sale
            (needed for tax, refund, and licensing purposes); after the 30-day download window has
            closed you can ask us via the{' '}
            <Link href="/about#get-in-touch" className="underline hover:text-gray-900">contact form on the about page</Link>{' '}
            to delete your order record.
          </p>
        </div>
      </section>

      {/* 7. What we do not use */}
      <section>
        <h2 className="text-xl font-semibold mb-4">What we deliberately do not use</h2>
        <div className="text-gray-700 leading-relaxed flex flex-col gap-4 text-sm">
          <p>
            Privacy matters to this project. The following are <em>not</em> present anywhere on this site:
          </p>
          <ul className="flex flex-col gap-2">
            <li>• Google Analytics, Google Tag Manager, or any other Google tracking product.</li>
            <li>• Google Fonts loaded from Google&apos;s servers — our fonts are self-hosted at build time.</li>
            <li>• Facebook Pixel, Meta tracking, TikTok pixel, LinkedIn Insight, or any advertising network tag.</li>
            <li>• Hotjar, FullStory, or any session-replay or heatmap tool.</li>
            <li>• Amazon affiliate links, Amazon ads, or any link to amazon.com / amazon.* domains in the catalogue.</li>
            <li>• Sponsored content, paid placements, or third-party advertising of any kind.</li>
          </ul>
          <p>
            If you ever see a request from this site to a tracker we have not listed here, that is a bug.
            Please tell us.
          </p>
        </div>
      </section>

      {/* 8. Your rights */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Your rights</h2>
        <div className="text-gray-700 leading-relaxed flex flex-col gap-4 text-sm">
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
            <Link href="/about#get-in-touch" className="underline hover:text-gray-900">contact form on the about page</Link>.
            If you are not satisfied with our response you have the right to complain to your local data
            protection authority — for visitors in the Netherlands, the{' '}
            <Link href="https://autoriteitpersoonsgegevens.nl" className="underline hover:text-gray-900">
              Autoriteit Persoonsgegevens
            </Link>.
          </p>
        </div>
      </section>

      {/* 9. Controller & changes */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Controller and changes to this policy</h2>
        <div className="text-gray-700 leading-relaxed flex flex-col gap-4 text-sm">
          <p>
            Banned Books is a personal project run by Ludo Raedts, based in Groningen, the Netherlands. For the
            purposes of data protection law, the controller of any personal data processed via this site is
            Ludo Raedts. To get in touch, use the{' '}
            <Link href="/about#get-in-touch" className="underline hover:text-gray-900">contact form on the about page</Link>.
          </p>
          <p>
            We will update this page if our practices change. Material changes will be reflected in the
            &ldquo;last updated&rdquo; date at the top.
          </p>
        </div>
      </section>

    </main>
  )
}
