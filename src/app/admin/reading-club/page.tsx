import Link from 'next/link'
import {
  getCurrentlyChallenged,
  getInternationalTrack,
  getClassicsTrack,
  getYoungReadersTrack,
  getThemes,
  getThemeBooks,
} from '@/lib/reading-club-data'
import { getBlocksForPage, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'
import { countReadingClubRowsMissingQuestions } from '@/lib/reading-club-questions'
import ReadingClubAdminClient from './reading-club-admin-client'

export const dynamic = 'force-dynamic'

export default async function AdminReadingClubPage() {
  const currentYear = new Date().getFullYear()

  const [currentlyChallenged, international, classics, youngReaders, themes, ccBlocks, intlBlocks, clBlocks, yrBlocks, themesBlocks, missingQuestionCount] = await Promise.all([
    getCurrentlyChallenged(currentYear, { admin: true }),
    getInternationalTrack({ admin: true }),
    getClassicsTrack({ admin: true }),
    getYoungReadersTrack({ admin: true }),
    getThemes(),
    getBlocksForPage('reading-club-currently-challenged'),
    getBlocksForPage('reading-club-international'),
    getBlocksForPage('reading-club-classics'),
    getBlocksForPage('reading-club-young-readers'),
    getBlocksForPage('reading-club-themes'),
    countReadingClubRowsMissingQuestions(),
  ])

  // Per-theme books and per-theme block status, fetched in parallel.
  const themeData = await Promise.all(themes.map(async t => {
    const [books, blocks] = await Promise.all([
      getThemeBooks(t.slug, { admin: true }),
      getBlocksForPage(`theme-${t.slug}`),
    ])
    return { theme: t, books, blocks }
  }))

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reading Club</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Five tracks: Currently Challenged, International, Classics, Young Readers, By Theme.</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">← Admin dashboard</Link>
      </div>

      <ReadingClubAdminClient
        currentYear={currentYear}
        missingQuestionCount={missingQuestionCount}
        currentlyChallenged={currentlyChallenged}
        international={international}
        classics={classics}
        youngReaders={youngReaders}
        themes={themeData.map(({ theme, books, blocks }) => ({
          slug: theme.slug,
          displayName: theme.display_name,
          books,
          blocks: blocks.map(b => ({ slug: b.slug, status: b.status })),
        }))}
        blockStatus={{
          currentlyChallenged: { ready: ccBlocks.every(b => b.status === 'published') && ccBlocks.length === REQUIRED_BLOCKS_BY_PAGE['reading-club-currently-challenged'].length, total: REQUIRED_BLOCKS_BY_PAGE['reading-club-currently-challenged'].length, published: ccBlocks.filter(b => b.status === 'published').length },
          international:        { ready: intlBlocks.every(b => b.status === 'published') && intlBlocks.length === REQUIRED_BLOCKS_BY_PAGE['reading-club-international'].length, total: REQUIRED_BLOCKS_BY_PAGE['reading-club-international'].length, published: intlBlocks.filter(b => b.status === 'published').length },
          classics:             { ready: clBlocks.every(b => b.status === 'published') && clBlocks.length === REQUIRED_BLOCKS_BY_PAGE['reading-club-classics'].length, total: REQUIRED_BLOCKS_BY_PAGE['reading-club-classics'].length, published: clBlocks.filter(b => b.status === 'published').length },
          youngReaders:         { ready: yrBlocks.every(b => b.status === 'published') && yrBlocks.length === REQUIRED_BLOCKS_BY_PAGE['reading-club-young-readers'].length, total: REQUIRED_BLOCKS_BY_PAGE['reading-club-young-readers'].length, published: yrBlocks.filter(b => b.status === 'published').length },
          themesIntro:          { ready: themesBlocks.every(b => b.status === 'published') && themesBlocks.length === REQUIRED_BLOCKS_BY_PAGE['reading-club-themes'].length, total: REQUIRED_BLOCKS_BY_PAGE['reading-club-themes'].length, published: themesBlocks.filter(b => b.status === 'published').length },
        }}
      />
    </main>
  )
}
