// Theme hub — books that FEATURE a theme (book_themes), not books banned for a
// stated reason. See src/lib/themes.ts for the framing and PEN sources.
//
// DB cost per (daily) render: one paginated read of book_themes ids for the
// theme (a few thousand rows, book_id only), v_book_ban_counts for those ids in
// chunks (filter on the bans.book_id index), and one hydration of the top 60.
// No full-catalogue sweep.
export const revalidate = 86400

import type { Metadata } from 'next'
import Link from '@/components/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import { THEMES, getTheme } from '@/lib/themes'
import BookCardCompact from '@/components/home/BookCardCompact'
import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import Eyebrow from '@/components/section/Eyebrow'
import BreadcrumbJsonLd from '@/components/breadcrumb-jsonld'
import PageviewTracker from '@/components/pageview-tracker'

const TOP_N = 60

export async function generateStaticParams() {
  return THEMES.map((t) => ({ slug: t.slug }))
}

type ThemeData = {
  bookCount: number
  totalBans: number
  top: { id: number; title: string; slug: string; cover_url: string | null; author: string; bans: number; title_native: string | null; original_language: string | null }[]
}

async function loadTheme(key: string): Promise<ThemeData> {
  const supabase = adminClient()

  const ids: number[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('book_themes')
      .select('book_id')
      .eq('theme', key)
      .order('book_id')
      .range(from, from + 999)
    if (error) throw error
    ids.push(...(data ?? []).map((r) => r.book_id as number))
    if (!data || data.length < 1000) break
  }

  const counts = new Map<number, number>()
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await supabase
      .from('v_book_ban_counts')
      .select('entity_id, total_bans')
      .in('entity_id', ids.slice(i, i + 300))
    if (error) throw error
    for (const r of (data ?? []) as { entity_id: number; total_bans: number }[]) counts.set(r.entity_id, r.total_bans)
  }

  const topIds = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, TOP_N).map(([id]) => id)
  let top: ThemeData['top'] = []
  if (topIds.length > 0) {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, slug, cover_url, title_native, original_language, book_authors(authors(display_name))')
      .in('id', topIds)
    if (error) throw error
    const byId = new Map((data ?? []).map((b) => [b.id as number, b]))
    top = topIds.flatMap((id) => {
      const b = byId.get(id) as unknown as {
        id: number; title: string; slug: string; cover_url: string | null; title_native: string | null; original_language: string | null
        book_authors: { authors: { display_name: string } | null }[]
      } | undefined
      if (!b) return []
      return [{
        id: b.id, title: b.title, slug: b.slug, cover_url: b.cover_url,
        title_native: b.title_native, original_language: b.original_language,
        author: b.book_authors.map((ba) => ba.authors?.display_name).filter(Boolean).join(', '),
        bans: counts.get(id) ?? 0,
      }]
    })
  }

  return {
    bookCount: ids.length,
    totalBans: [...counts.values()].reduce((a, b) => a + b, 0),
    top,
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const theme = getTheme(slug)
  if (!theme) return {}
  const stat = theme.penStats[0]
  return {
    title: `${theme.title} – list and context`,
    description: `Banned and challenged books that feature ${theme.phrase}. PEN America: ${stat.pct}% of titles banned in US schools in ${stat.year} featured ${stat.measure}.`.slice(0, 160),
    alternates: { canonical: `/themes/${slug}` },
  }
}

export default async function ThemePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const theme = getTheme(slug)
  if (!theme) notFound()

  const { bookCount, totalBans, top } = await loadTheme(theme.key)
  const stat = theme.penStats[0]

  const url = `https://www.banned-books.org/themes/${slug}`
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: theme.title,
    url,
    description: `${bookCount.toLocaleString('en')} banned or challenged books in this catalogue feature ${theme.phrase}.`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: bookCount,
      itemListElement: top.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://www.banned-books.org/books/${b.slug}`,
        name: b.title,
      })),
    },
  }
  const ldHtml = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

  return (
    <main>
      <BreadcrumbJsonLd items={[{ label: 'Home', href: '/' }, { label: 'Reasons', href: '/reasons' }, { label: theme.title }]} />
      <PageviewTracker entityType="page" path={`/themes/${slug}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldHtml(collectionJsonLd) }} />

      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/reasons"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← Why books are banned
          </Link>

          <Eyebrow>{theme.eyebrow}</Eyebrow>

          <div className="flex items-center gap-4">
            <span className="text-4xl md:text-5xl leading-none" aria-hidden="true">{theme.icon}</span>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
              {theme.title}
            </h1>
          </div>

          <div className="max-w-[820px]">
            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-black border-b border-neutral-200 py-4">
              <div>
                <div className="font-serif text-3xl md:text-4xl font-semibold tracking-tight text-oxblood tabular-nums">{stat.pct}%</div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-600">
                  of US school bans {stat.year} (PEN America)
                </div>
              </div>
              <div>
                <div className="font-serif text-3xl md:text-4xl font-semibold tracking-tight text-oxblood tabular-nums">{bookCount.toLocaleString('en')}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-600">Books in this catalogue</div>
              </div>
              <div>
                <div className="font-serif text-3xl md:text-4xl font-semibold tracking-tight text-oxblood tabular-nums">{totalBans.toLocaleString('en')}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-600">Documented bans and removals</div>
              </div>
            </div>

            <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
              {stat.pct}% of the {stat.titles} titles banned in US public schools in the {stat.year} school year
              featured {stat.measure}, according to{' '}
              <a href={stat.source.url} target="_blank" rel="noopener" className="underline underline-offset-4 decoration-2 decoration-oxblood/40 hover:decoration-oxblood">
                PEN America
              </a>
              . This catalogue lists {bookCount.toLocaleString('en')} banned or challenged books that feature them.
            </p>

            <div className="mt-6 rounded-r-lg border-l-4 border-slate-300 bg-slate-50 px-4 py-3">
              <h2 className="text-[11px] font-medium uppercase tracking-widest text-slate-500 mb-1.5">A theme, not a stated reason</h2>
              <p className="text-sm leading-relaxed text-gray-800">{theme.explainer}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{theme.method}</p>
              {theme.reasonSlug && (
                <p className="mt-2 text-sm">
                  <Link href={`/reasons/${theme.reasonSlug}`} className="underline underline-offset-2 text-gray-700 hover:text-gray-900">
                    Books where a source records this as the reason →
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {top.length > 0 && (
        <SectionShell tone="cream" eyebrow="Ranked by documented bans">
          <SectionHeader
            title={`Most banned books featuring ${theme.phrase}`}
            subtitle="Ordered by the number of documented bans, removals and challenges in this catalogue."
            accent="oxblood"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {top.map((b) => (
              <BookCardCompact
                key={b.id}
                book={{
                  id: b.id, title: b.title, slug: b.slug, cover_url: b.cover_url, author: b.author,
                  title_native: b.title_native, title_native_lang: b.original_language,
                  context: `${b.bans.toLocaleString('en')} documented ${b.bans === 1 ? 'ban' : 'bans'}`,
                }}
              />
            ))}
          </div>
        </SectionShell>
      )}
    </main>
  )
}
