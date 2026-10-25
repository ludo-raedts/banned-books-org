// ISR: regenerate at most every 6h. Was force-dynamic, which made every
// CDN miss a full table scan against Supabase (the biggest hidden egress
// cost in the app). Sitemap freshness within 6h is more than crawlers need.
export const revalidate = 21600

import { buildBookEntries } from '@/lib/sitemap-entities'
import { SITEMAP_RESPONSE_HEADERS, renderUrlset } from '@/lib/sitemap-xml'

// Google-indexable core only (advertised via robots.txt → sitemap.xml). The
// full catalogue lives in sitemap-books-all.xml / sitemap-full.xml for Bing.
export async function GET() {
  return new Response(renderUrlset(await buildBookEntries('core')), { headers: SITEMAP_RESPONSE_HEADERS })
}
