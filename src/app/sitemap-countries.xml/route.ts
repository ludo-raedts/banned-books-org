export const dynamic = 'force-dynamic'

import { adminClient } from '@/lib/supabase'
import {
  SITEMAP_BASE_URL,
  SITEMAP_RESPONSE_HEADERS,
  renderUrlset,
  type SitemapEntry,
} from '@/lib/sitemap-xml'

export async function GET() {
  const supabase = adminClient()

  const [{ data: countries }, { data: bans }] = await Promise.all([
    supabase.from('countries').select('code'),
    supabase.from('bans').select('country_code'),
  ])

  const countriesWithBans = new Set((bans ?? []).map((b) => b.country_code))

  const entries: SitemapEntry[] = (countries ?? [])
    .filter((c) => countriesWithBans.has(c.code))
    .map((c) => ({
      loc: `${SITEMAP_BASE_URL}/countries/${c.code}`,
      changefreq: 'monthly',
      priority: 0.7,
    }))

  return new Response(renderUrlset(entries), { headers: SITEMAP_RESPONSE_HEADERS })
}
