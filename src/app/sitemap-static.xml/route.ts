export const dynamic = 'force-dynamic'

import { SITEMAP_RESPONSE_HEADERS, renderUrlset } from '@/lib/sitemap-xml'
import { SITEMAP_STATIC_ENTRIES } from '@/lib/sitemap-static-entries'

export async function GET() {
  return new Response(renderUrlset(SITEMAP_STATIC_ENTRIES), {
    headers: SITEMAP_RESPONSE_HEADERS,
  })
}
