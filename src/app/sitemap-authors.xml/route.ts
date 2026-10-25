// ISR: regenerate at most every 6h. Was force-dynamic, which made every
// CDN miss a full table scan against Supabase (the biggest hidden egress
// cost in the app). Sitemap freshness within 6h is more than crawlers need.
export const revalidate = 21600

import { buildAuthorEntries } from '@/lib/sitemap-entities'
import { SITEMAP_RESPONSE_HEADERS, renderUrlset } from '@/lib/sitemap-xml'

// Bio-carrying (Google-indexable) authors only — mirrors the noindex rule in
// authors/[slug]/page.tsx. All authors: sitemap-authors-all.xml (Bing).
export async function GET() {
  return new Response(renderUrlset(await buildAuthorEntries('core')), { headers: SITEMAP_RESPONSE_HEADERS })
}
