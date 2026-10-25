// ISR: regenerate at most every 6h. Was force-dynamic, which made every
// CDN miss a full table scan against Supabase (the biggest hidden egress
// cost in the app). Sitemap freshness within 6h is more than crawlers need.
export const revalidate = 21600

import { buildBookEntries } from '@/lib/sitemap-entities'
import { SITEMAP_RESPONSE_HEADERS, renderUrlset } from '@/lib/sitemap-xml'

// Every public book page — child of sitemap-full.xml (Bing-only submission;
// not referenced from robots.txt or sitemap.xml). See src/lib/sitemap-entities.ts.
export async function GET() {
  return new Response(renderUrlset(await buildBookEntries('all')), { headers: SITEMAP_RESPONSE_HEADERS })
}
