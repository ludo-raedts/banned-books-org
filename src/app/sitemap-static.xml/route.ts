// ISR: regenerate at most every 6h. Was force-dynamic, which made every
// CDN miss a full table scan against Supabase (the biggest hidden egress
// cost in the app). Sitemap freshness within 6h is more than crawlers need.
export const revalidate = 21600

import { SITEMAP_RESPONSE_HEADERS, renderUrlset } from '@/lib/sitemap-xml'
import { getSitemapStaticEntries } from '@/lib/sitemap-static-entries'

export async function GET() {
  const entries = await getSitemapStaticEntries()
  return new Response(renderUrlset(entries), {
    headers: SITEMAP_RESPONSE_HEADERS,
  })
}
