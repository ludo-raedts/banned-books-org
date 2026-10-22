/**
 * _fix_azadi_merge_2026_09_21.ts — pre/post steps around the 6258→6305 Azadi
 * merge (run via merge-paren-suffix-dupes.ts --file=data/azadi-dupe.json).
 *
 * --pre :  ban 4783 (on DROP 6258) has region NULL while ban 4829 (on KEEP
 *          6305) has region 'Jammu and Kashmir'. Both describe the SAME
 *          August 2025 J&K Home Department order. banKey() includes region, so
 *          without this the merge would INSERT a second India ban on KEEP
 *          instead of unioning the source links onto the existing one.
 *
 * --post:  on the surviving ban 4829,
 *            - status 'historical' → 'active'. 'historical' renders as a
 *              "lifted" badge on the book page, and the 2025 J&K order has not
 *              been lifted; ban 4783, which described the same order, said
 *              'active'. Ban 4828 (Kashmir: The Case for Freedom, id 6304)
 *              carries the same order and the same wrong status, so it is
 *              corrected too.
 *            - description: fold the sweep context that ban 4783 carried (the
 *              ~two dozen titles, the criticism from Indian writers'
 *              organisations and PEN) into 4829's verbatim quotation of the
 *              notification, so the merge does not lose it.
 *
 * Read-only by default; pass --apply to write.
 */
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const APPLY = isApply()
const PHASE = process.argv.includes('--post') ? 'post' : 'pre'

const MERGED_DESCRIPTION =
  'In August 2025 the Jammu and Kashmir Home Department, under Principal Secretary Chandraker Bharti, ordered the seizure of literature it said “propagates false narrative and secessionism in Jammu and Kashmir” and “would deeply impact the psyche of youth by promoting (a) culture of grievance, victimhood and terrorist heroism.” The notification covered roughly two dozen titles in the union territory, followed the central government’s reorganisation of the region, and was widely criticised by Indian writers’ organisations and PEN.'

async function show(sb: ReturnType<typeof adminClient>, ids: number[], label: string) {
  const { data, error } = await sb.from('bans').select('id,book_id,country_code,region,status,description').in('id', ids).order('id')
  if (error) throw error
  for (const b of data ?? []) console.log(`  ${label} ban ${b.id} (book ${b.book_id}) region=${b.region} status=${b.status} desc=${String(b.description).slice(0, 80)}…`)
}

async function main() {
  const sb = adminClient()
  console.log(`=== ${PHASE.toUpperCase()} ${APPLY ? '(APPLY)' : '(dry run — pass --apply)'} ===`)

  if (PHASE === 'pre') {
    await show(sb, [4783, 4829], 'BEFORE')
    if (!APPLY) return
    const { data, error } = await sb.from('bans').update({ region: 'Jammu and Kashmir' }).eq('id', 4783).select('id')
    if (error) throw error
    console.log(`rows updated: ${data?.length ?? 0}`)
    await show(sb, [4783, 4829], 'AFTER ')
    return
  }

  await show(sb, [4828, 4829], 'BEFORE')
  if (!APPLY) return
  const { data: a, error: e1 } = await sb
    .from('bans')
    .update({ status: 'active', description: MERGED_DESCRIPTION })
    .eq('id', 4829)
    .select('id')
  if (e1) throw e1
  const { data: b, error: e2 } = await sb.from('bans').update({ status: 'active' }).eq('id', 4828).select('id')
  if (e2) throw e2
  console.log(`rows updated: ${(a?.length ?? 0) + (b?.length ?? 0)}`)
  await show(sb, [4828, 4829], 'AFTER ')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
