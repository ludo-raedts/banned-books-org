export const dynamic = 'force-dynamic'

import { SITEMAP_RESPONSE_HEADERS, renderUrlset } from '@/lib/sitemap-xml'
import { getSitemapStaticEntries } from '@/lib/sitemap-static-entries'

export async function GET() {
  const entries = await getSitemapStaticEntries()
  return new Response(renderUrlset(entries), {
    headers: SITEMAP_RESPONSE_HEADERS,
  })
}
