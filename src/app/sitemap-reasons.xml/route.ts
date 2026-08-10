// ISR: regenerate at most every 6h. Was force-dynamic, which made every
// CDN miss a full table scan against Supabase (the biggest hidden egress
// cost in the app). Sitemap freshness within 6h is more than crawlers need.
export const revalidate = 21600

import { adminClient } from '@/lib/supabase'
import {
  SITEMAP_BASE_URL,
  SITEMAP_RESPONSE_HEADERS,
  renderUrlset,
  type SitemapEntry,
} from '@/lib/sitemap-xml'

export async function GET() {
  const supabase = adminClient()

  const { data: reasons } = await supabase.from('reasons').select('slug')

  const entries: SitemapEntry[] = (reasons ?? [])
    .filter((r): r is { slug: string } => Boolean(r.slug))
    .map((r) => ({
      loc: `${SITEMAP_BASE_URL}/reasons/${r.slug}`,
      changefreq: 'monthly',
      priority: 0.7,
    }))

  return new Response(renderUrlset(entries), { headers: SITEMAP_RESPONSE_HEADERS })
}
