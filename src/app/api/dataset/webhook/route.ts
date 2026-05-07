import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import crypto from 'crypto'
import { stripe } from '@/lib/stripe'
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

  if (event.type === 'checkout.session.completed') {
    const baseUrl = new URL(req.url).origin
    await handleCheckoutCompleted(event.data.object, baseUrl)
  }

  return Response.json({ received: true })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, baseUrl: string) {
  if (session.payment_status !== 'paid') return

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

  // Unique constraint violation = Stripe retried after we already recorded this session.
  // Anything else is a real error worth surfacing in logs.
  if (error) {
    if (error.code === '23505') return
    console.error('[webhook] failed to insert dataset_order', { sessionId: session.id, error })
    throw new Error(`DB insert failed: ${error.message}`)
  }

  // Email is best-effort: don't fail the webhook (and trigger Stripe retries) if Resend hiccups.
  if (inserted?.email && inserted.download_token && inserted.download_token_expires_at) {
    const downloadUrl = `${baseUrl}/api/dataset/download?token=${encodeURIComponent(inserted.download_token)}`
    const result = await sendDownloadEmail({
      to: inserted.email,
      downloadUrl,
      expiresAt: new Date(inserted.download_token_expires_at),
      orderId: inserted.id,
    })
    if (!result.skipped && 'error' in result && result.error) {
      console.error('[webhook] email send failed', { orderId: inserted.id, error: result.error })
    }
  }
}
