import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Use the request's own origin so localhost stays on localhost during dev.
  // NEXT_PUBLIC_BASE_URL is intentionally ignored here — that env var is for
  // absolute URLs in metadata/sitemaps, not for runtime checkout redirects.
  const baseUrl = new URL(req.url).origin

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

  const session = await stripe.checkout.sessions.create(params)

  if (!session.url) {
    return Response.json({ error: 'No checkout URL returned' }, { status: 500 })
  }

  return Response.redirect(session.url, 303)
}
