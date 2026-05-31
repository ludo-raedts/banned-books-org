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

  const { data: rows } = await supabase
    .from('mv_ban_counts')
    .select('country_code')

  const entries: SitemapEntry[] = (rows ?? [])
    .map((r) => ({
      // Lowercase to match the page's self-canonical (/countries/us, not /US),
      // so sitemap URLs are self-canonical and don't split crawl signals.
      loc: `${SITEMAP_BASE_URL}/countries/${String(r.country_code).toLowerCase()}`,
      changefreq: 'monthly',
      priority: 0.7,
    }))

  return new Response(renderUrlset(entries), { headers: SITEMAP_RESPONSE_HEADERS })
}
