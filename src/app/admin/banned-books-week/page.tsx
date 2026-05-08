import { adminClient } from '@/lib/supabase'
import { BANNED_BOOKS_WEEK } from '@/config/banned-books-week'
import { getAllFeaturedBooksForAdmin } from '@/lib/bbw-data'
import { getBlocksForPage, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'
import BannedBooksWeekAdminClient from './banned-books-week-admin-client'

export const dynamic = 'force-dynamic'

export default async function AdminBannedBooksWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const sp = await searchParams
  const year = sp.year ? Number(sp.year) : BANNED_BOOKS_WEEK.year

  const [current, blocks, { count: bookCount }] = await Promise.all([
    getAllFeaturedBooksForAdmin(year),
    getBlocksForPage('bbw-hub'),
    adminClient().from('books').select('*', { count: 'exact', head: true }),
  ])

  return (
    <BannedBooksWeekAdminClient
      year={year}
      configuredYear={BANNED_BOOKS_WEEK.year}
      configuredEnabled={BANNED_BOOKS_WEEK.enabled}
      currentSelection={current}
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
