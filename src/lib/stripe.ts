import Stripe from 'stripe'

// Managed Payments (Stripe as Merchant of Record) is a preview API.
// The version header must be passed explicitly so the managed_payments
// field on Checkout Sessions is accepted.
//
// Lazy initialisation: the SDK is wrapped in a Proxy so module evaluation
// does NOT touch process.env.STRIPE_SECRET_KEY. This matters during
// `next build` — pages that don't actually use Stripe (e.g. preview deploys
// without the secret seeded) used to crash at module-load with
// "Neither apiKey nor config.authenticator provided". Now the secret is
// only read on first real access.
//
// Cast required because the preview API version is not in the SDK's union
// of known versions.
let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  _stripe = new Stripe(key, { apiVersion: '2026-02-25.preview' as never })
  return _stripe
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const inst = getStripe()
    const value = Reflect.get(inst, prop)
    return typeof value === 'function' ? value.bind(inst) : value
  },
})

// PRICE_ID is read at access time too — env-less builds shouldn't crash
// just because the catalogue page is being rendered.
export const STRIPE_PRICE_ID: string = process.env.STRIPE_PRICE_ID ?? ''
