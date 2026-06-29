import { notFound } from 'next/navigation'
import { getClassicsEntry } from '@/lib/reading-club-detail'
import { renderReadingClubPdfBuffer } from '@/components/reading-club-pdf-doc'

export const revalidate = 3600

function safeFilename(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'reading-club'
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const detail = await getClassicsEntry(slug)
  if (!detail || !detail.book.slug) notFound()

  const canonicalUrl = `https://www.banned-books.org/reading-club/classics/${slug}`
  const filename = `${safeFilename(detail.book.title)}-reading-club.pdf`

  const buffer = await renderReadingClubPdfBuffer(detail, canonicalUrl)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      // Downloadable companion of the canonical HTML guide page — keep it out
      // of the search index so it doesn't compete with that page as a duplicate.
      'X-Robots-Tag': 'noindex',
    },
  })
}
