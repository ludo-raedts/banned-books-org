/**
 * Remove the redundant 'other' ban-reason link from bans that ALSO carry a
 * specific reason. 'other' is a last-resort catch-all (copyright / civil suit /
 * unclassifiable) and must never co-tag a specific reason like 'lgbtq'.
 *
 * Root cause: scripts/enrich-reasons.ts let gpt-4o-mini emit e.g. "lgbtq,other"
 * and wrote both verbatim. The forward fix in that script now strips 'other'
 * when a specific slug is present; this script repairs the rows already written.
 *
 * Bans whose ONLY reason is 'other' are left untouched — those are legitimately
 * unclassified.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/cleanup-other-cotag.ts
 *     → dry-run: counts affected bans + shows combo breakdown, no writes
 *   npx tsx --env-file=.env.local scripts/cleanup-other-cotag.ts --apply
 *     → deletes the 'other' link from each affected ban
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

async function main() {
  console.log(`\n── cleanup-other-cotag (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const supabase = adminClient()

  const { data: reasonRows, error: rErr } = await supabase.from('reasons').select('id, slug')
  if (rErr) { console.error('DB error:', rErr.message); process.exit(1) }
  const otherId = (reasonRows ?? []).find(r => r.slug === 'other')?.id as number | undefined
  if (otherId === undefined) { console.error("No 'other' reason slug found"); process.exit(1) }

  type BanRow = {
    id: number
    ban_reason_links: Array<{ reasons: { slug: string } | null }>
  }

  let allBans: BanRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('bans')
      .select('id, ban_reason_links(reasons(slug))')
      .range(offset, offset + 999)
      .order('id')
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    if (!data || data.length === 0) break
    allBans = allBans.concat(data as unknown as BanRow[])
    if (data.length < 1000) break
    offset += 1000
  }

  // Affected = has 'other' AND at least one specific reason.
  const comboCounts = new Map<string, number>()
  const targets = allBans.filter((ban) => {
    const slugs = ban.ban_reason_links.map(l => l.reasons?.slug).filter(Boolean) as string[]
    const hasOther = slugs.includes('other')
    const specific = slugs.filter(s => s !== 'other')
    if (hasOther && specific.length > 0) {
      const combo = [...new Set(slugs)].sort().join('+')
      comboCounts.set(combo, (comboCounts.get(combo) ?? 0) + 1)
      return true
    }
    return false
  })

  console.log(`Total bans                 : ${allBans.length}`)
  console.log(`Bans with 'other'+specific : ${targets.length}\n`)
  ;[...comboCounts.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([combo, n]) => console.log(`  ${String(n).padStart(5)}  ${combo} → ${combo.split('+').filter(s => s !== 'other').join('+')}`))

  if (targets.length === 0) { console.log('\nNothing to clean.'); return }

  if (!APPLY) {
    console.log(`\nWould delete the 'other' link from ${targets.length} bans. Re-run with --apply to write.\n`)
    return
  }

  let cleaned = 0, errored = 0
  for (const ban of targets) {
    const { error } = await supabase
      .from('ban_reason_links')
      .delete()
      .eq('ban_id', ban.id)
      .eq('reason_id', otherId)
    if (error) { console.error(`  error on ban ${ban.id}: ${error.message}`); errored++; continue }
    cleaned++
  }

  console.log(`\n── Done ──`)
  console.log(`Cleaned: ${cleaned}`)
  console.log(`Errors : ${errored}`)
}

main().catch(e => { console.error(e); process.exit(1) })
