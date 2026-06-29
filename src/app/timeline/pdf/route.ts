import { renderTimelinePdfBuffer } from '@/components/timeline-pdf-doc'

// The timeline data is static (curated TS module), so the rendered buffer is
// safe to cache aggressively at the edge and revalidate hourly.
export const revalidate = 3600

export async function GET() {
  const canonicalUrl = 'https://www.banned-books.org/timeline'
  const buffer = await renderTimelinePdfBuffer(canonicalUrl)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="banned-books-timeline.pdf"',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      // Downloadable companion of the canonical /timeline page — keep it out of
      // the search index so it doesn't compete with that page as a duplicate.
      'X-Robots-Tag': 'noindex',
    },
  })
}
