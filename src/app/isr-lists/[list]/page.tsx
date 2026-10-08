// ISR host for heavy pages (lists + /stats) that must not run in the build-time
// prerender (see the header of each module in src/lib/list-pages/). Public
// URLs are /banned-classics, /banned-childrens-books, /non-english-banned-books and /stats;
// next.config.ts rewrites them to /isr-lists/<slug>. generateStaticParams
// returns [] so nothing renders at build; the first request renders and the
// result is edge-cached and revalidated hourly (same pattern as /book-of-the-day/[date]).
// Each module's metadata keeps its own canonical, so /isr-lists/* never competes.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BannedClassicsPage, { metadata as classicsMeta } from '@/lib/list-pages/banned-classics'
import BannedChildrensBooksPage, { metadata as childrensMeta } from '@/lib/list-pages/banned-childrens-books'
import StatsPage, { generateStatsMetadata } from '@/lib/list-pages/stats'
import NonEnglishBannedBooksPage, { metadata as nonEnglishMeta } from '@/lib/list-pages/non-english-banned-books'

export const revalidate = 3600
export const dynamicParams = true

export async function generateStaticParams() {
  return [] as { list: string }[]
}

const PAGES: Record<string, { Page: () => Promise<React.JSX.Element>; metadata?: Metadata; generateMetadata?: () => Promise<Metadata> }> = {
  stats: { Page: StatsPage, generateMetadata: generateStatsMetadata },
  'banned-classics': { Page: BannedClassicsPage, metadata: classicsMeta },
  'banned-childrens-books': { Page: BannedChildrensBooksPage, metadata: childrensMeta },
  'non-english-banned-books': { Page: NonEnglishBannedBooksPage, metadata: nonEnglishMeta },
}

export async function generateMetadata({ params }: { params: Promise<{ list: string }> }): Promise<Metadata> {
  const { list } = await params
  const entry = PAGES[list]
  if (!entry) return {}
  return entry.generateMetadata ? entry.generateMetadata() : (entry.metadata ?? {})
}

export default async function IsrListPage({ params }: { params: Promise<{ list: string }> }) {
  const { list } = await params
  const entry = PAGES[list]
  if (!entry) notFound()
  return <entry.Page />
}
