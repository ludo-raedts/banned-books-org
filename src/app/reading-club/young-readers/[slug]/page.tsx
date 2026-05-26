import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getYoungReadersEntry } from '@/lib/reading-club-detail'
import ReadingClubDetailView, { buildReadingClubJsonLd } from '@/components/reading-club-detail-view'

export const revalidate = 3600

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const detail = await getYoungReadersEntry(slug)
  if (!detail) return {}

  const author = detail.book.authors.join(', ')
  const baseTitle = author ? `${detail.book.title} by ${author}` : detail.book.title
  const title = `${baseTitle} — Book club guide`
  const description = detail.banSummary
    ? `${detail.banSummary} Discussion questions + ban context for book clubs.`
    : `Book club guide for ${baseTitle}: context, ban history, and discussion questions.`

  const trimmedDesc = description.length > 160 ? description.slice(0, 157) + '…' : description
  const trimmedTitle = title.length > 70 ? title.slice(0, 67) + '…' : title

  return {
    title: trimmedTitle,
    description: trimmedDesc,
    alternates: { canonical: `/reading-club/young-readers/${slug}` },
    openGraph: { title: trimmedTitle, description: trimmedDesc },
  }
}

export default async function YoungReadersBookPage({ params }: { params: Params }) {
  const { slug } = await params
  const detail = await getYoungReadersEntry(slug)
  if (!detail || !detail.book.slug) notFound()

  const pageHref = `/reading-club/young-readers/${slug}`
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
