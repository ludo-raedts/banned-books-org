// ISR: 1h. Driven by ban-count ranking, which only changes on ingestion of
// new bans — slower than view-driven lists.
export const revalidate = 3600

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
import { TopListBookCard } from '@/components/top-list-card'
import {
  TOP_LIST_BOOK_SELECT,
  type TopListBookRow,
  langContext,
  toBookCard,
} from '@/lib/top-list-data'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const metadata: Metadata = {
  title: 'Banned books not written in English',
  description:
    'A ranked list of the most-censored books originally written in languages other than English — French, German, Russian, Arabic, Chinese, Persian, and beyond. The international half of the censorship catalogue.',
  alternates: { canonical: '/non-english-banned-books' },
}

// How many top-ranked titles to render. Hydrate a small buffer above this so a
// rare view/embed count drift can't drop a legitimately top-ranked book.
const SHOW = 50
const HYDRATE = 60

// Rank-then-hydrate (same shape as /banned-classics): the global
// v_top_banned_books view surfaces only ~33 non-English titles in its top 100
// (English-language censorship dominates), too thin for a destination page, so
// we rank the full non-English set ourselves. The old approach embedded bans()
// for an unordered .limit(1000) slice of the ~5k candidates — a heavy join that
// intermittently tripped statement_timeout AND silently ignored 80% of
// candidates (no .order() on a >1000-row table). Now: collect candidate ids
// (light), rank by pre-aggregated v_book_ban_counts, and embed bans only for
// the bounded top set.
async function fetchNonEnglish(timer: ReturnType<typeof newTimer>) {
  const supabase = adminClient()

  // 1. Candidate ids — non-English, public. Light select, fully paginated.
  const ids = await timer.wrap('candidate-ids', async () => {
    const out: number[] = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from('books')
        .select('id')
        .eq('is_gated', false)
        .not('original_language', 'is', null)
        .neq('original_language', 'en')
        .order('id')
        .range(offset, offset + 999)
      if (error) throw error
      if (!data || data.length === 0) break
      out.push(...data.map(r => r.id as number))
      if (data.length < 1000) break
    }
    return out
  })

  // 2. Pre-aggregated ban counts → rank, keep the top HYDRATE ids only.
  const counts = await timer.wrap('ban-counts', async () => {
    const m = new Map<number, number>()
    for (let i = 0; i < ids.length; i += 300) {
      const { data, error } = await supabase
        .from('v_book_ban_counts')
        .select('entity_id, total_bans')
        .in('entity_id', ids.slice(i, i + 300))
      if (error) throw error
      for (const r of (data ?? []) as Array<{ entity_id: number; total_bans: number }>) {
        m.set(r.entity_id, r.total_bans)
      }
    }
    return m
  })
  const keep = ids
    .filter(id => (counts.get(id) ?? 0) > 0)
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, HYDRATE)

  // 3. Hydrate full card detail (bans embed) for the bounded set only.
  const { data: booksRaw } = await timer.wrap('hydrate-top', () =>
    supabase.from('books').select(TOP_LIST_BOOK_SELECT).in('id', keep),
  )
  return (booksRaw ?? []) as unknown as TopListBookRow[]
}

export default async function NonEnglishBannedBooksPage() {
  const timer = newTimer('non-english-destination')

  const candidates = await fetchNonEnglish(timer)

  const books = candidates
    .filter(b => b.bans.length > 0)
    .sort((a, b) => b.bans.length - a.bans.length)
    .slice(0, SHOW)
    .map(b => toBookCard(b, langContext(b)))

  timer.end()

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Banned books not written in English',
    numberOfItems: books.length,
    itemListElement: books.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://www.banned-books.org/books/${b.slug}`,
      name: b.title,
    })),
  }

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, '\\u003c') }}
      />

      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← All books
          </Link>

          <Eyebrow>Top-list · International</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 max-w-[820px]">
            Banned books not written in English.
          </h1>

          <p className="mt-6 max-w-[720px] text-sm md:text-base leading-relaxed text-gray-700">
            The {books.length} most-banned books originally written in languages other than English — French, German, Russian, Arabic, Chinese, Persian, and beyond. Most English-language &ldquo;banned books&rdquo; lists stop at the US school-board frontier. This one keeps going: Solzhenitsyn smuggled out of the USSR, El Saadawi imprisoned in Egypt, Li Hongzhi outlawed in China.
          </p>
        </div>
      </section>

      <SectionShell tone="cream" eyebrow="Ranked by ban count">
        {books.length === 0 ? (
          <p className="text-neutral-500 text-sm">
            No non-English titles in the top-banned ranking yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {books.map(book => (
              <TopListBookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </SectionShell>

      <SectionShell tone="white">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/countries"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">By geography</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Browse countries →
            </p>
          </Link>
          <Link
            href="/top-100-banned-books"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">All-time</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Top 100 banned books →
            </p>
          </Link>
          <Link
            href="/banned-classics"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Historical</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Banned classics →
            </p>
          </Link>
        </div>
      </SectionShell>
    </main>
  )
}
