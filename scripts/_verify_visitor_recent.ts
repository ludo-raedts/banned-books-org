import { adminClient } from '../src/lib/supabase'

async function main() {
  const sb = adminClient()
  const { data: countries, error: e1 } = await sb
    .from('v_top_countries_this_week')
    .select('country, views')
  console.log('v_top_countries_this_week:', countries, e1)
  const { data: refs, error: e2 } = await sb
    .from('v_top_referrers_this_week')
    .select('referrer_host, views')
  console.log('v_top_referrers_this_week:', refs, e2)
  const { data: weekly, error: e3 } = await sb
    .from('v_weekly_totals')
    .select('*')
    .single()
  console.log('v_weekly_totals:', weekly, e3)
}
main().catch(e => { console.error(e); process.exit(1) })
