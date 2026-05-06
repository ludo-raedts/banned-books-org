export const dynamic = 'force-dynamic'

import {
  SITEMAP_BASE_URL,
  SITEMAP_RESPONSE_HEADERS,
  renderSitemapIndex,
} from '@/lib/sitemap-xml'

export async function GET() {
  const now = new Date()
  const xml = renderSitemapIndex([
    { loc: `${SITEMAP_BASE_URL}/sitemap-static.xml`, lastmod: now },
    { loc: `${SITEMAP_BASE_URL}/sitemap-books.xml`, lastmod: now },
    { loc: `${SITEMAP_BASE_URL}/sitemap-authors.xml`, lastmod: now },
    { loc: `${SITEMAP_BASE_URL}/sitemap-countries.xml`, lastmod: now },
    { loc: `${SITEMAP_BASE_URL}/sitemap-reasons.xml`, lastmod: now },
  ])

  return new Response(xml, { headers: SITEMAP_RESPONSE_HEADERS })
}
