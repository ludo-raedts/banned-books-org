import { adminClient } from '@/lib/supabase'
import { getBBWConfig, formatBBWDateRange, isBannedBooksWeekPromoActive } from '@/config/banned-books-week'
import { getAllFeaturedBooksForAdmin } from '@/lib/bbw-data'
import { getBlocksForPage, REQUIRED_BLOCKS_BY_PAGE, getPublishedBlockHtml } from '@/lib/content-blocks'
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

  const [current, blocks, { count: bookCount }, tileTagline, dateRange, promoActive] = await Promise.all([
    getAllFeaturedBooksForAdmin(year),
    getBlocksForPage('bbw-hub'),
    adminClient().from('books').select('*', { count: 'exact', head: true }),
    getPublishedBlockHtml('bbw-tile-tagline'),
    formatBBWDateRange(),
    isBannedBooksWeekPromoActive(),
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
      tilePreview={{
        title: `Banned Books Week ${config.year} · ${dateRange}`,
        // tagline content block is rendered HTML; strip the surrounding <p>
        // tag for inline display in the preview card.
        tagline: tileTagline ? tileTagline.replace(/^<p>|<\/p>$/g, '').trim() : null,
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
