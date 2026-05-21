import { notFound } from 'next/navigation'
import { getCurrentlyChallengedEntry } from '@/lib/reading-club-detail'
import { renderReadingClubPdfBuffer } from '@/components/reading-club-pdf-doc'

export const revalidate = 3600

function safeFilename(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'reading-club'
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ year: string; position: string }> },
) {
  const { year, position } = await ctx.params
  const y = Number.parseInt(year, 10)
  const p = Number.parseInt(position, 10)
  if (!Number.isInteger(y) || !Number.isInteger(p)) notFound()
  const detail = await getCurrentlyChallengedEntry(y, p)
  if (!detail) notFound()

  const canonicalUrl = `https://www.banned-books.org/reading-club/currently-challenged/${y}/${p}`
  const filename = `${safeFilename(detail.book.title)}-reading-club.pdf`

  const buffer = await renderReadingClubPdfBuffer(detail, canonicalUrl)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
