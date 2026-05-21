import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCurrentlyChallengedEntry } from '@/lib/reading-club-detail'
import ReadingClubDetailView, { buildReadingClubJsonLd } from '@/components/reading-club-detail-view'

export const revalidate = 3600

type Params = Promise<{ year: string; position: string }>

function parseParams(year: string, position: string): { year: number; position: number } | null {
  const y = Number.parseInt(year, 10)
  const p = Number.parseInt(position, 10)
  if (!Number.isInteger(y) || !Number.isInteger(p) || y < 1900 || y > 2100 || p < 1 || p > 999) return null
  return { year: y, position: p }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { year, position } = await params
  const parsed = parseParams(year, position)
  if (!parsed) return {}
  const detail = await getCurrentlyChallengedEntry(parsed.year, parsed.position)
  if (!detail) return {}

  const author = detail.book.authors.join(', ')
  const baseTitle = author ? `${detail.book.title} by ${author}` : detail.book.title
  const title = `${baseTitle} — Book club guide`
  const description = `Book club guide for ${baseTitle}: ALA challenge context, discussion questions, and resources for reading groups.`

  const trimmedDesc = description.length > 160 ? description.slice(0, 157) + '…' : description
  const trimmedTitle = title.length > 70 ? title.slice(0, 67) + '…' : title

  return {
    title: trimmedTitle,
    description: trimmedDesc,
    alternates: { canonical: `/reading-club/currently-challenged/${year}/${position}` },
    openGraph: { title: trimmedTitle, description: trimmedDesc },
  }
}

export default async function CurrentlyChallengedBookPage({ params }: { params: Params }) {
  const { year, position } = await params
  const parsed = parseParams(year, position)
  if (!parsed) notFound()
  const detail = await getCurrentlyChallengedEntry(parsed.year, parsed.position)
  if (!detail) notFound()

  const pageHref = `/reading-club/currently-challenged/${year}/${position}`
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildReadingClubJsonLd(detail)) }}
      />
      <ReadingClubDetailView detail={detail} pageHref={pageHref} />
    </>
  )
}
