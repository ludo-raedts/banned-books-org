'use client'

import { track } from '@vercel/analytics'
import { SUPPORT_LINK_ONE_OFF } from '@/lib/support-links'

// The one client piece of the support card: the checkout link, with the same
// 'Support Clicked' event the old slide-in sent so the two are comparable.
export default function SupportCheckoutLink({
  placement,
  children,
}: {
  placement: string
  children: React.ReactNode
}) {
  return (
    <a
      href={`${SUPPORT_LINK_ONE_OFF}?client_reference_id=${encodeURIComponent(`card-${placement}`)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('Support Clicked', { type: 'one_off', campaign: `card-${placement}` })}
      className="inline-flex items-center justify-center rounded-lg border border-oxblood px-4 py-2 text-sm font-semibold text-oxblood transition-colors hover:bg-oxblood hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-oxblood/40"
    >
      {children}
    </a>
  )
}
