import Link from '@/components/link'
import SupportCheckoutLink from '@/components/support-checkout-link'

// A quiet, in-page ask for the one-off $5 contribution, shown at the END of a
// book page, after the reader has had the answer and the next steps. It replaces
// the end-of-year slide-in (a fixed card that covered a large part of a phone
// screen on the second page view or after 45 s). Nothing floats, nothing
// opens by itself, and the page works the same without it: the "Support this
// project" link stays in the footer (UX review 2026-11-11, step 10).
export default function SupportCard({ placement }: { placement: string }) {
  return (
    <aside
      aria-labelledby="support-card-title"
      className="mb-10 rounded-xl border border-gray-200 bg-white px-5 py-5"
    >
      <h2 id="support-card-title" className="font-serif text-xl font-semibold text-gray-900">
        Help keep this archive open
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-gray-700">
        Banned Books is maintained by one person, with no ads or paywall. If you find it useful,
        a one-time contribution helps cover hosting and data costs.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <SupportCheckoutLink placement={placement}>Give $5 once</SupportCheckoutLink>
        <Link href="/support" className="text-sm font-medium text-oxblood underline underline-offset-2 decoration-oxblood/30 hover:decoration-oxblood">
          Other ways to support<span aria-hidden="true">{' '}→</span>
        </Link>
      </div>
      <p className="mt-2.5 text-xs text-gray-500">Secure checkout via Stripe. Opens in a new tab.</p>
    </aside>
  )
}
