import type { Metadata } from 'next'
import Link from '@/components/link'
import SectionShell from '@/components/section/SectionShell'
import TrackedOutboundLink from '@/components/tracked-outbound-link'
import { SUPPORT_LINK_MONTHLY, SUPPORT_LINK_ONE_OFF } from '@/lib/support-links'
import { getSiteTotals } from '@/lib/site-totals'

// ISR: the page is editorial copy plus three grounding counts. Hourly regen
// keeps the numbers fresh after enrichment cycles without a query per visit.
export const revalidate = 3600

const MONTHLY_GOAL_USD = 200

export const metadata: Metadata = {
  title: 'Support this project',
  description:
    'Banned Books is an independent, ad-free catalogue of book censorship worldwide. Chip in to help cover hosting and the data costs that keep it running and free to use.',
  alternates: { canonical: '/support' },
}

async function getStats() {
  const t = await getSiteTotals()
  return { books: t.books, bans: t.bans, countries: t.countries }
}

export default async function SupportPage() {
  const stats = await getStats()

  return (
    <main>
      <SectionShell eyebrow="Support">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">
          Help keep this project alive
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-gray-700 leading-relaxed">
          Banned Books is an independent catalogue of{' '}
          {stats.bans.toLocaleString('en')} documented bans across{' '}
          {stats.books.toLocaleString('en')} books in{' '}
          {stats.countries.toLocaleString('en')}{' '}countries and territories —
          free to browse, with an open dataset anyone can cite. There&rsquo;s no
          company behind it and no paywall on the catalogue.
        </p>
        <p className="mt-4 max-w-2xl text-gray-700 leading-relaxed">
          Running it still costs money every month: hosting, the database, and
          the Open Library and Google Books lookups that enrich each record. If
          the site is useful to you, a small contribution helps keep it online
          and growing. My modest goal is about{' '}
          <strong>${MONTHLY_GOAL_USD} a month</strong> to cover those costs.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <TrackedOutboundLink
            href={SUPPORT_LINK_MONTHLY}
            target="_blank"
            rel="noopener noreferrer"
            eventName="Support Clicked"
            eventProperties={{ type: 'monthly' }}
            className="inline-flex items-center justify-center rounded-lg bg-oxblood px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-oxblood/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-oxblood/40"
          >
            Support $2.50/month
          </TrackedOutboundLink>
          <TrackedOutboundLink
            href={SUPPORT_LINK_ONE_OFF}
            target="_blank"
            rel="noopener noreferrer"
            eventName="Support Clicked"
            eventProperties={{ type: 'one_off' }}
            className="inline-flex items-center justify-center rounded-lg border border-oxblood/30 px-6 py-3 text-base font-semibold text-oxblood transition-colors hover:bg-oxblood/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-oxblood/40"
          >
            Or give $5 once
          </TrackedOutboundLink>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Secure checkout via Stripe — card &amp; Apple/Google Pay. Cancel a
          monthly contribution anytime.
        </p>

        <p className="mt-8 max-w-2xl text-sm text-gray-500 leading-relaxed">
          Banned Books is run by an individual, not a registered charity, so
          contributions are a personal &ldquo;thank you&rdquo; rather than a
          tax-deductible donation. Prefer to help another way? You can{' '}
          <Link href="/dataset" className="text-oxblood hover:underline">
            buy the full dataset
          </Link>{' '}
          or cite the{' '}
          <Link href="/dataset" className="text-oxblood hover:underline">
            free open dataset
          </Link>{' '}
          in your own work. Or skip me entirely and support the{' '}
          <Link href="/organizations" className="text-oxblood hover:underline">
            organisations that actually fight book bans
          </Link>
          .
        </p>
      </SectionShell>
    </main>
  )
}
