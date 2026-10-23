/**
 * Mint a fresh, unique, time-limited download link for existing paid-dataset
 * orders (e.g. to hand buyers a courtesy update of the archive).
 *
 * The archive itself (private/dataset.zip) is rebuilt on every deploy, so a
 * new token simply re-opens access to the *current* build for TTL days.
 *
 * Dry-run (default) prints what would change. Nothing is emailed: paste the
 * printed per-customer link into your own follow-up mail.
 *
 *   pnpm tsx --env-file=.env.local scripts/renew-dataset-download-tokens.ts            # all orders, dry-run
 *   pnpm tsx --env-file=.env.local scripts/renew-dataset-download-tokens.ts --apply    # write new tokens
 *   ... --email a@b.c,d@e.f   # restrict to these buyers
 *   ... --ttl-days 14         # default 30
 */
import crypto from 'node:crypto'
import { adminClient } from '@/lib/supabase'
import { flagValue, intFlag, isApply } from './lib/cli'

const ttlDays = intFlag('ttl-days', 30)
const onlyEmails = flagValue('email')?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.banned-books.org'

async function main() {
  const supabase = adminClient()
  let q = supabase
    .from('dataset_orders')
    .select('id, email, paid_at, download_token_expires_at, downloads_count')
    .not('paid_at', 'is', null)
    .order('created_at', { ascending: true })
  if (onlyEmails?.length) q = q.in('email', onlyEmails)
  const { data: orders, error } = await q
  if (error) throw error
  if (!orders?.length) {
    console.log('No matching paid orders.')
    return
  }

  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString()
  const apply = isApply()
  console.log(`${apply ? 'APPLY' : 'DRY-RUN'} — ${orders.length} order(s), new expiry ${expiresAt}\n`)

  let updated = 0
  for (const o of orders) {
    const token = crypto.randomUUID() + '-' + crypto.randomBytes(8).toString('hex')
    const link = `${baseUrl}/api/dataset/download?token=${encodeURIComponent(token)}`
    const wasExpired = o.download_token_expires_at && new Date(o.download_token_expires_at) < new Date()
    console.log(`${o.email}  (paid ${o.paid_at?.slice(0, 10)}, old link ${wasExpired ? 'EXPIRED' : 'still valid'}, downloads ${o.downloads_count})`)
    if (apply) {
      const { error: upErr } = await supabase
        .from('dataset_orders')
        .update({ download_token: token, download_token_expires_at: expiresAt })
        .eq('id', o.id)
      if (upErr) {
        console.error('  !! update failed', upErr.message)
        continue
      }
      updated++
      console.log(`  ${link}`)
    } else {
      console.log(`  (would mint new token; link printed on --apply)`)
    }
  }
  console.log(`\n${apply ? `updated ${updated}/${orders.length}` : 'dry-run, nothing written'}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
