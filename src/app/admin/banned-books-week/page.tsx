import { adminClient } from '@/lib/supabase'
import {
  getBBWConfig,
  formatBBWDateRange,
  isBannedBooksWeekPromoActive,
  isBannedBooksWeekActive,
} from '@/config/banned-books-week'
import { getAllFeaturedBooksForAdmin } from '@/lib/bbw-data'
import {
  getBlocksForPage,
  REQUIRED_BLOCKS_BY_PAGE,
  getPublishedBlockHtml,
  stripOuterParagraph,
} from '@/lib/content-blocks'
import BannedBooksWeekAdminClient from './banned-books-week-admin-client'

export const dynamic = 'force-dynamic'

export default async function AdminBannedBooksWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const sp = await searchParams
  const config = await getBBWConfig()
  const year = sp.year ? Number(sp.year) : config.year

  const [current, blocks, { count: bookCount }, tagline, dateRange, promoActive, isLive] =
    await Promise.all([
      getAllFeaturedBooksForAdmin(year),
      getBlocksForPage('bbw-hub'),
      adminClient().from('books').select('*', { count: 'exact', head: true }),
      getPublishedBlockHtml('bbw-tile-tagline'),
      formatBBWDateRange(),
      isBannedBooksWeekPromoActive(),
      isBannedBooksWeekActive(),
    ])

  return (
    <BannedBooksWeekAdminClient
      year={year}
      currentSelection={current}
      config={{
        enabled: config.enabled,
        year: config.year,
        startDate: config.startDate,
        endDate: config.endDate,
        promoStartDate: config.promoStartDate,
        dateRange,
        promoActive,
      }}
      calloutPreview={{
        year: config.year,
        dateRange,
        isLive,
        // Rendered HTML; strip the surrounding <p> so it sits inline exactly
        // as the homepage callout renders it.
        tagline: tagline ? stripOuterParagraph(tagline) : null,
      }}
      requiredBlocks={blocks.map(b => ({
        slug: b.slug,
        title: b.title,
        status: b.status,
      }))}
      requiredBlockCount={REQUIRED_BLOCKS_BY_PAGE['bbw-hub'].length}
      totalBooksInDataset={bookCount ?? 0}
    />
  )
}
