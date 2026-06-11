/**
 * One-off cleanup: null out auto-generated `description_ban` text that was
 * produced BEFORE ban reasons were classified.
 *
 * Root cause: enrich-ban-descriptions-gpt.ts ran while the (newly imported PEN
 * 2021-22 / 2022-23) bans still carried only the 'other' fallback reason. The
 * prompt fed "reason: Other" and instructed GPT to "state the official reason",
 * so ~999 descriptions literally read '… the official reason cited as "Other."'
 *
 * Fix sequence:
 *   1. enrich-reasons.ts --apply              (reclassify 'other' → real reasons)
 *   2. THIS script --apply                    (null the contaminated copy)
 *   3. enrich-ban-descriptions-gpt.ts --apply (regenerate from the now-NULL rows
 *                                              with the fixed prompt + reasons)
 *
 * Only touches rows whose text quotes the word "Other" AND whose status is
 * auto-generated (NULL — an earlier run left it unset — or 'auto_accepted').
 * human_curated / auto_rejected_low_quality copy is never touched. Idempotent.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/_cleanup-other-ban-descriptions.ts
 *   pnpm tsx --env-file=.env.local scripts/_cleanup-other-ban-descriptions.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const db = adminClient()

async function main() {
  console.log(`\n── cleanup-other-ban-descriptions (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  // Paginate so we never hit Supabase's 1000-row default cap.
  const rows: Array<{ id: number; slug: string }> = []
  for (let off = 0; ; off += 1000) {
    const { data, error } = await db
      .from('books')
      .select('id, slug')
      .ilike('description_ban', '%"Other"%')
      // NULL (earlier run left status unset) OR auto_accepted. A `NOT IN
      // (human_curated, …)` filter would silently drop the NULL rows in
      // Postgres, so the null case must be spelled out explicitly.
      .or('description_ban_status.is.null,description_ban_status.eq.auto_accepted')
      .order('id')
      .range(off, off + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < 1000) break
  }
  console.log(`Contaminated description_ban rows (auto-generated, quotes "Other"): ${rows.length}`)
  for (const b of rows.slice(0, 10)) console.log(`  - ${b.slug}`)
  if (rows.length > 10) console.log(`  … and ${rows.length - 10} more`)

  if (!APPLY) {
    console.log('\nDRY-RUN — re-run with --apply to null these rows.\n')
    return
  }

  const ids = rows.map(b => b.id)
  let done = 0
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500)
    const { error: e } = await db
      .from('books')
      .update({ description_ban: null, description_ban_status: null })
      .in('id', batch)
    if (e) throw e
    done += batch.length
    console.log(`  nulled ${done}/${ids.length}`)
  }
  console.log(`\n✓ Nulled ${ids.length} contaminated description_ban rows. Now regenerate with enrich-ban-descriptions-gpt.ts --apply\n`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
