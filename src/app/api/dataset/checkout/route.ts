import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Use the request's own origin so localhost stays on localhost during dev.
  // NEXT_PUBLIC_BASE_URL is intentionally ignored here — that env var is for
  // absolute URLs in metadata/sitemaps, not for runtime checkout redirects.
  const baseUrl = new URL(req.url).origin

  // Two callers. The buy button (JS on) fetches with Accept: application/json
  // and navigates itself, so it can show "Opening secure checkout…" and a
  // readable error. The bare <form> POST (JS off) keeps the 303 redirect.
  const wantsJson = (req.headers.get('accept') ?? '').includes('application/json')

  const params: Stripe.Checkout.SessionCreateParams & {
    managed_payments?: { enabled: boolean }
  } = {
    mode: 'payment',
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    managed_payments: { enabled: true },
    success_url: `${baseUrl}/dataset/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/dataset`,
    allow_promotion_codes: true,
  }

  // The Stripe API call can throw (network, rate limit, misconfigured price/key).
  // Without this the buyer hits Next's bare 500; return a clear error instead.
  try {
    const session = await stripe.checkout.sessions.create(params)
    if (!session.url) {
      return Response.json({ error: 'No checkout URL returned' }, { status: 500 })
    }
    if (wantsJson) return Response.json({ url: session.url })
    return Response.redirect(session.url, 303)
  } catch (err) {
    console.error('[api/dataset/checkout]', err)
    const message = err instanceof Error ? err.message : 'Checkout could not be started'
    return Response.json({ error: `Could not start checkout: ${message}` }, { status: 500 })
  }
}
