// PDF download endpoint for a single international Reading Club book.
// Renders the React-PDF document on demand. Cached with Next.js's data
// cache for an hour so Bookshop.org's crawl, Pocket-saves, etc. don't hit
// Supabase on every request.

import { notFound } from 'next/navigation'
import { getInternationalEntry } from '@/lib/reading-club-detail'
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
  const detail = await getInternationalEntry(slug)
  if (!detail || !detail.book.slug) notFound()

  const canonicalUrl = `https://www.banned-books.org/reading-club/international/${slug}`
  const filename = `${safeFilename(detail.book.title)}-reading-club.pdf`

  const buffer = await renderReadingClubPdfBuffer(detail, canonicalUrl)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Allow shared caches to keep the PDF for an hour; behind a CDN this
      // turns repeat-downloads into a static asset hit.
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
