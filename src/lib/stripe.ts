import Stripe from 'stripe'

// Managed Payments (Stripe as Merchant of Record) is a preview API.
// The version header must be passed explicitly so the managed_payments
// field on Checkout Sessions is accepted.
// Cast required because the preview API version is not in the SDK's union of known versions.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.preview' as never,
})

export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID!
