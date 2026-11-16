import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import crypto from 'node:crypto'
import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe'
import { adminClient } from '@/lib/supabase'
import { sendDownloadEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const DOWNLOAD_TTL_DAYS = 30

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return Response.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return Response.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // Stripe webhooks need the *raw* body for signature verification — never JSON-parse here.
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return Response.json({ error: `Signature verification failed: ${message}` }, { status: 400 })
  }

  // `completed` fires with payment_status 'unpaid' for delayed payment methods
  // (bank debits etc.); the money arrives later as `async_payment_succeeded`.
  // handleCheckoutCompleted skips unpaid sessions, so both events are safe to
  // route here, and the unique stripe_session_id keeps fulfilment idempotent.
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const baseUrl = new URL(req.url).origin
    await handleCheckoutCompleted(event.data.object, baseUrl)
  }

  return Response.json({ received: true })
}

// checkout.session.completed events don't carry line_items, so fetch them and
// check whether the dataset price is among them. Returns false (skip fulfilment)
// for support/donation payments or any other product. Lets Stripe API errors
// throw so the webhook 500s and Stripe retries — fulfilment is idempotent.
async function isDatasetCheckout(sessionId: string): Promise<boolean> {
  if (!STRIPE_PRICE_ID) return false
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 })
  return lineItems.data.some((item) => item.price?.id === STRIPE_PRICE_ID)
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, baseUrl: string) {
  if (session.payment_status !== 'paid') return

  // Guard: only fulfil dataset purchases. Support/donation payments (and any
  // future product) emit the same checkout.session.completed event and would
  // otherwise mint a download token + email the paid dataset for free. Positively
  // identify the dataset by its price ID on the line items; skip anything else.
  if (!(await isDatasetCheckout(session.id))) return

  const supabase = adminClient()
  const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_DAYS * 24 * 60 * 60 * 1000)
  const downloadToken = crypto.randomUUID() + '-' + crypto.randomBytes(8).toString('hex')
  const email = session.customer_details?.email ?? session.customer_email ?? null

  const { data: inserted, error } = await supabase
    .from('dataset_orders')
    .insert({
      stripe_session_id: session.id,
      email,
      amount_cents: session.amount_total,
      currency: session.currency,
      paid_at: new Date().toISOString(),
      download_token: downloadToken,
      download_token_expires_at: expiresAt.toISOString(),
    })
    .select('id, download_token, email, download_token_expires_at')
    .single()

  let order: OrderRow | null = inserted
  // Unique constraint violation = Stripe retried after we already recorded this session.
  // Anything else is a real error worth surfacing in logs.
  if (error) {
    if (error.code !== '23505') {
      console.error('[webhook] failed to insert dataset_order', { sessionId: session.id, error })
      throw new Error(`DB insert failed: ${error.message}`)
    }
    // Retry of an order we already stored: the first attempt may have saved the
    // row but failed to deliver the mail. Resend only if it was never marked sent.
    // (email_sent_at is read here only, so the insert path above keeps working
    // even before the 20261116120000 migration is applied.)
    const { data: existing, error: lookupError } = await supabase
      .from('dataset_orders')
      .select('id, download_token, email, download_token_expires_at, email_sent_at')
      .eq('stripe_session_id', session.id)
      .maybeSingle()
    if (lookupError || !existing || existing.email_sent_at) return
    order = existing
  }

  if (!order) return
  if (!order.email) {
    // Paid but no address: nothing to mail. Make it visible instead of silent.
    console.error('[webhook] paid dataset order has no email — send the link manually', {
      orderId: order.id,
      sessionId: session.id,
    })
    return
  }

  // Email stays best-effort: a Resend failure must not 500 the webhook, but it is
  // no longer lost — email_sent_at stays NULL, so the next Stripe retry (or a
  // manual replay of the event) delivers it.
  if (order.download_token && order.download_token_expires_at) {
    const downloadUrl = `${baseUrl}/api/dataset/download?token=${encodeURIComponent(order.download_token)}`
    const result = await sendDownloadEmail({
      to: order.email,
      downloadUrl,
      expiresAt: new Date(order.download_token_expires_at),
      orderId: order.id,
    })
    if (result.skipped || ('error' in result && result.error)) {
      console.error('[webhook] email not sent', {
        orderId: order.id,
        skipped: result.skipped,
        error: 'error' in result ? result.error : undefined,
      })
      // Unsent: answer 500 so Stripe retries (it retries for up to 3 days).
      throw new Error(`Download email not sent for order ${order.id}`)
    }
    const { error: markError } = await supabase
      .from('dataset_orders')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', order.id)
    if (markError) console.error('[webhook] could not stamp email_sent_at', { orderId: order.id, markError })
  }
}

type OrderRow = {
  id: string
  download_token: string | null
  email: string | null
  download_token_expires_at: string | null
  email_sent_at?: string | null
}
