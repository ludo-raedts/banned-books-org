import { adminClient } from '../src/lib/supabase'

async function main() {
  const sb = adminClient()

  // ── 1. Schema sanity ────────────────────────────────────────────────────────
  const { data: schemaCol } = await sb
    .from('pageviews')
    .select('visitor_hash')
    .limit(1)
  console.log('Column visitor_hash present:', schemaCol !== null ? 'yes' : 'no')

  // ── 2. Population rate over last 24h ────────────────────────────────────────
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: total24 } = await sb
    .from('pageviews')
    .select('*', { count: 'exact', head: true })
    .gte('viewed_at', dayAgo)
  const { count: hashed24 } = await sb
    .from('pageviews')
    .select('*', { count: 'exact', head: true })
    .gte('viewed_at', dayAgo)
    .not('visitor_hash', 'is', null)
  const pct24 = total24 ? Math.round((hashed24! / total24) * 100) : 0
  console.log(`Last 24h rows : ${total24}  (${hashed24} with visitor_hash, ${pct24}%)`)

  // ── 3. Latest 5 rows with full detail ──────────────────────────────────────
  const { data: latest } = await sb
    .from('pageviews')
    .select('viewed_at, entity_type, entity_id, country, referrer_host, visitor_hash')
    .order('viewed_at', { ascending: false })
    .limit(5)
  console.log('\nLatest 5 pageviews:')
  for (const r of latest ?? []) {
    const h = r.visitor_hash ? `${r.visitor_hash.slice(0, 12)}…` : 'NULL'
    const ref = r.referrer_host ?? 'direct'
    console.log(`  ${r.viewed_at}  ${r.entity_type}/${r.entity_id}  ${r.country ?? '??'}  ${ref.padEnd(20)}  hash=${h}`)
  }

  // ── 4. View health ──────────────────────────────────────────────────────────
  const { data: weekly } = await sb
    .from('v_weekly_totals')
    .select('views_this_week, views_last_week, pageviews_this_week, pageviews_last_week')
    .single()
  console.log('\nv_weekly_totals (this week):')
  console.log(`  visitors  : ${weekly?.views_this_week ?? 0}`)
  console.log(`  pageviews : ${weekly?.pageviews_this_week ?? 0}`)

  const { data: countries } = await sb
    .from('v_top_countries_this_week')
    .select('country, views')
    .limit(5)
  console.log('\nTop 5 countries this week:')
  for (const c of countries ?? []) console.log(`  ${c.country ?? '??'}  ${c.views}`)

  const { data: refs } = await sb
    .from('v_top_referrers_this_week')
    .select('referrer_host, views')
    .limit(5)
  console.log('\nTop 5 referrers this week:')
  for (const r of refs ?? []) console.log(`  ${r.referrer_host}  ${r.views}`)
}

main().catch(e => { console.error(e); process.exit(1) })
