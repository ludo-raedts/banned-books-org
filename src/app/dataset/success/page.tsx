import type { Metadata } from 'next'
import Link from 'next/link'
import { stripe } from '@/lib/stripe'
import { adminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Thank you — your dataset is on its way',
  description: 'Your purchase is confirmed. The Banned Books dataset is being prepared.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/dataset/success' },
}

type SearchParams = Promise<{ session_id?: string }>

async function loadSession(sessionId: string | undefined) {
  if (!sessionId) return null
  try {
    return await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    return null
  }
}

async function loadOrder(sessionId: string | undefined) {
  if (!sessionId) return null
  const supabase = adminClient()
  const { data } = await supabase
    .from('dataset_orders')
    .select('download_token')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()
  return data
}

export default async function DatasetSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { session_id } = await searchParams
  const [session, order] = await Promise.all([
    loadSession(session_id),
    loadOrder(session_id),
  ])

  const paid = session?.payment_status === 'paid'
  const email = session?.customer_details?.email ?? null
  const downloadHref = order?.download_token
    ? `/api/dataset/download?token=${encodeURIComponent(order.download_token)}`
    : null

  return (
    <main className="max-w-2xl mx-auto px-6 py-16 flex flex-col gap-8">

      <div className="bg-brand-light dark:bg-brand-dark/10 border-l-4 border-brand pl-6 pr-4 py-6 rounded-r-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-brand/70 dark:text-brand/60 mb-3">Order confirmed</p>
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          {paid ? 'Thank you — payment received' : 'Order received'}
        </h1>
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
          {paid
            ? 'Your purchase is confirmed. Your download is ready below.'
            : 'Your order is being processed. This page will update once payment clears.'}
        </p>
      </div>

      {downloadHref ? (
        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-6 sm:p-8 flex flex-col gap-4 items-start">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            Your dataset is ready to download. The link below stays valid for 30 days
            and can be used multiple times.
          </p>
          <a
            href={downloadHref}
            className="bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-6 py-3 text-sm transition-colors"
          >
            Download the dataset →
          </a>
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-6 sm:p-8 flex flex-col gap-3">
          <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
            <strong>Preparing your download…</strong> Stripe is confirming the payment
            (usually a few seconds). Refresh this page if the download link doesn&rsquo;t
            appear within a minute.
          </p>
          <form>
            <button
              type="submit"
              className="text-sm font-medium underline text-amber-900 dark:text-amber-200 hover:no-underline"
            >
              Refresh
            </button>
          </form>
        </section>
      )}

      <section className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed flex flex-col gap-4">
        {email ? (
          <p>
            We&rsquo;ve also emailed the download link to <strong>{email}</strong>{' '}so you
            can return to it later. If it doesn&rsquo;t arrive, check your spam folder.
          </p>
        ) : (
          <p>
            We&rsquo;ve also emailed the download link to the address you used at checkout
            so you can return to it later. If it doesn&rsquo;t arrive, check your spam folder.
          </p>
        )}

        <p>
          If anything goes wrong, reply to the email — or reach out via the{' '}
          <Link href="/about#get-in-touch" className="underline hover:text-gray-900 dark:hover:text-gray-100">
            contact form
          </Link>{' '}
          and we&rsquo;ll sort it out.
        </p>
      </section>

      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          ← Back to the catalogue
        </Link>
      </div>
    </main>
  )
}
