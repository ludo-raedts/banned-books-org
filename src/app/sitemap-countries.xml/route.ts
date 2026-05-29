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
      loc: `${SITEMAP_BASE_URL}/countries/${r.country_code}`,
      changefreq: 'monthly',
      priority: 0.7,
    }))

  return new Response(renderUrlset(entries), { headers: SITEMAP_RESPONSE_HEADERS })
}
