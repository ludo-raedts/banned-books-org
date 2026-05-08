import { adminClient } from '@/lib/supabase'
import { BANNED_BOOKS_WEEK, formatBBWDateRange, isBannedBooksWeekPromoActive } from '@/config/banned-books-week'
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
  const year = sp.year ? Number(sp.year) : BANNED_BOOKS_WEEK.year

  const [current, blocks, { count: bookCount }, tileTagline] = await Promise.all([
    getAllFeaturedBooksForAdmin(year),
    getBlocksForPage('bbw-hub'),
    adminClient().from('books').select('*', { count: 'exact', head: true }),
    getPublishedBlockHtml('bbw-tile-tagline'),
  ])

  return (
    <BannedBooksWeekAdminClient
      year={year}
      currentSelection={current}
      config={{
        enabled: BANNED_BOOKS_WEEK.enabled,
        year: BANNED_BOOKS_WEEK.year,
        startDate: BANNED_BOOKS_WEEK.startDate,
        endDate: BANNED_BOOKS_WEEK.endDate,
        promoStartDate: BANNED_BOOKS_WEEK.promoStartDate ?? null,
        dateRange: formatBBWDateRange(),
        promoActive: isBannedBooksWeekPromoActive(),
      }}
      tilePreview={{
        title: `Banned Books Week ${BANNED_BOOKS_WEEK.year} · ${formatBBWDateRange()}`,
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
