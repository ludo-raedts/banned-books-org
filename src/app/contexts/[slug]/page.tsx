// /contexts/<slug> — long-form hub page for a named censorship event.
//
// Title/badge/matching come from the ban-context registry; the prose, hero and
// sources come from content.tsx; the list of books is data-driven (one bounded,
// ISR-cached query). Only registry entries with hasHub === true render here.

import type { Metadata } from 'next'
import BreadcrumbJsonLd from '@/components/breadcrumb-jsonld'
import Link from '@/components/link'
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { adminClient } from '@/lib/supabase'
import { buildCitationMeta } from '@/lib/citation-meta'
import { getBanContext, type BanContext } from '@/lib/ban-contexts'
import { getRegisterList } from '@/lib/registers'
import { CONTEXT_CONTENT, ContextHero } from './content'

// Hubs whose event also has a register list (/registers/<slug>): titles from the
// same source that have no catalogue page. Linked below the book list.
const CONTEXT_REGISTER: Record<string, string> = {
  'index-librorum-prohibitorum': 'index-1877',
}

// Hub content is fully static apart from the book list, which changes only when
// imports land. Daily ISR keeps it fresh without per-request DB load.
export const revalidate = 86400

const BASE = 'https://www.banned-books.org'

// Max book links rendered on a hub. Large events (the 1938 Nazi list ≈ 3,600
// titles) would otherwise produce an enormous DOM; the heading shows the real
// total and a note discloses the truncation.
const DISPLAY_CAP = 500

const proseClasses =
  'prose prose-gray max-w-none ' +
  'prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight ' +
  'prose-a:text-oxblood prose-a:underline prose-a:underline-offset-2 ' +
  'prose-a:decoration-oxblood/30 hover:prose-a:decoration-oxblood ' +
  'prose-p:leading-relaxed'

type BookRow = { slug: string; title: string; author: string | null }
type RankedRow = BookRow & { id: number; documented: number }

// Not prerendered at build: the big hubs (Index 1877 ≈ 4,700 books, Nazi 1938,
// Malaysia) take ~40 sequential reads each and blew the 60 s per-page build
// limit whenever the database was busy, failing the whole deploy. They render
// on first request (300 s function limit) and then serve from ISR.
export function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const ctx = getBanContext(slug)
  const content = CONTEXT_CONTENT[slug]
  if (!ctx?.hasHub || !content) return {}

  const href = `/contexts/${slug}`
  return {
    title: ctx.title,
    description: content.dek,
    openGraph: { title: ctx.title, description: content.dek, type: 'article' },
    alternates: { canonical: href },
    other: buildCitationMeta({
      entityType: 'essay',
      title: ctx.title,
      url: `${BASE}${href}`,
      publicationYear: 2026,
    }),
  }
}

// Resolves the books that belong to a context. Two strategies, mirroring the
// registry matcher: an explicit slug allowlist, or a citation-source substring
// (the signal the /sources page tallies by). Author is the first credited name.
async function fetchContextBooksUncached(ctx: BanContext): Promise<BookRow[]> {
  const sb = adminClient()
  const SELECT = 'id, slug, title, cover_url, description_book, book_authors(authors(display_name))'

  const shape = (
    rows:
      | {
          id: number
          slug: string
          title: string
          cover_url: string | null
          description_book: string | null
          book_authors: { authors: { display_name: string } | null }[]
        }[]
      | null,
  ): RankedRow[] =>
    (rows ?? []).map((b) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      author: b.book_authors?.[0]?.authors?.display_name ?? null,
      documented: (b.cover_url ? 1 : 0) + (b.description_book ? 1 : 0),
    }))

  // Known works first: a large event (Index 1877 ≈ 4,700 titles, Nazi 1938
  // ≈ 3,600) only shows DISPLAY_CAP rows, and alphabetical order filled that
  // window with obscure Latin tracts. Rank by countries banning the book
  // (Voltaire/Rousseau are banned elsewhere too), then by how documented the
  // page is (cover, description), then title. v_book_ban_counts is queried
  // with a literal id list so it stays an index scan (see its migration).
  const rank = async (rows: RankedRow[]): Promise<BookRow[]> => {
    const countries = new Map<number, number>()
    for (let i = 0; i < rows.length; i += 300) {
      const { data } = await sb
        .from('v_book_ban_counts')
        .select('entity_id, distinct_countries')
        .in('entity_id', rows.slice(i, i + 300).map((r) => r.id))
      for (const c of data ?? []) countries.set(c.entity_id as number, Number(c.distinct_countries))
    }
    return rows
      .sort(
        (a, b) =>
          (countries.get(b.id) ?? 0) - (countries.get(a.id) ?? 0) ||
          b.documented - a.documented ||
          a.title.localeCompare(b.title, 'en'),
      )
      .map(({ slug, title, author }) => ({ slug, title, author }))
  }

  // Strategy A: explicit slug allowlist.
  if (ctx.match.bookSlugs?.length) {
    const { data } = await sb
      .from('books')
      .select(SELECT)
      .in('slug', ctx.match.bookSlugs)
    return rank(shape(data as never))
  }

  // Strategy B: citation-source substring.
  const subs = ctx.match.sourceUrlIncludes ?? []
  if (subs.length === 0) return []

  const orExpr = subs.map((s) => `source_url.ilike.%${s}%`).join(',')
  const { data: srcs } = await sb.from('ban_sources').select('id').or(orExpr)
  const srcIds = (srcs ?? []).map((s) => s.id as number)
  if (srcIds.length === 0) return []

  // ban_source_links can exceed the 1000-row cap — paginate with an explicit
  // order so .range() doesn't repeat rows.
  const banIds = new Set<number>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data: links } = await sb
      .from('ban_source_links')
      .select('ban_id')
      .in('source_id', srcIds)
      .order('ban_id', { ascending: true })
      .range(from, from + PAGE - 1)
    const batch = links ?? []
    for (const l of batch) banIds.add(l.ban_id as number)
    if (batch.length < PAGE) break
  }
  if (banIds.size === 0) return []

  const bookIds = new Set<number>()
  const idList = Array.from(banIds)
  for (let i = 0; i < idList.length; i += 500) {
    const { data: bans } = await sb
      .from('bans')
      .select('book_id')
      .in('id', idList.slice(i, i + 500))
    for (const b of bans ?? []) bookIds.add(b.book_id as number)
  }
  if (bookIds.size === 0) return []

  const out: RankedRow[] = []
  const bIdList = Array.from(bookIds)
  for (let i = 0; i < bIdList.length; i += 500) {
    const { data } = await sb
      .from('books')
      .select(SELECT)
      .in('id', bIdList.slice(i, i + 500))
    out.push(...shape(data as never))
  }
  return rank(out)
}

// The ranked list in the data cache, so an ISR regeneration of a hub (or a
// metadata pass) does not redo the ~40 reads. Same TTL as the route.
const fetchContextBooks = unstable_cache(
  async (slug: string): Promise<BookRow[]> => {
    const ctx = getBanContext(slug)
    return ctx ? fetchContextBooksUncached(ctx) : []
  },
  ['context-books'],
  { revalidate: 86400, tags: ['context-books'] },
)

export default async function ContextPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ctx = getBanContext(slug)
  const content = CONTEXT_CONTENT[slug]
  if (!ctx?.hasHub || !content) notFound()

  const registerSlug = CONTEXT_REGISTER[ctx.slug]
  const [books, register] = await Promise.all([
    fetchContextBooks(ctx.slug),
    // optional extra: a failed lookup only drops the register link, never the hub
    registerSlug ? getRegisterList(registerSlug).catch(() => null) : null,
  ])
  // Some events (the 1938 Nazi list) cover thousands of titles. Cap the rendered
  // DOM to keep the page light; the list is ranked best-known first, the heading
  // still shows the true total and the long tail stays reachable via the sitemap
  // and country/reason pages.
  const shownBooks = books.slice(0, DISPLAY_CAP)

  const href = `/contexts/${slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: ctx.title,
    description: content.dek,
    ...(content.jsonLdAbout ? { about: content.jsonLdAbout } : {}),
    ...(content.datePublished ? { datePublished: content.datePublished } : {}),
    ...(content.dateModified ? { dateModified: content.dateModified } : {}),
    author: { '@type': 'Organization', name: 'banned-books.org' },
    publisher: {
      '@type': 'Organization',
      name: 'banned-books.org',
      logo: {
        '@type': 'ImageObject',
        url: `${BASE}/brand/compact-bb.png`,
      },
    },
    mainEntityOfPage: `${BASE}${href}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <BreadcrumbJsonLd items={[{ label: 'Home', href: '/' }, { label: ctx.title }]} />
        <Link
          href={content.backLink.href}
          className="inline-block text-sm text-neutral-400 hover:text-oxblood mb-8 transition-colors"
        >
          ← {content.backLink.label}
        </Link>

        <header className="bg-brand-light border-l-4 border-brand pl-6 pr-4 py-6 mb-10 rounded-r-xl">
          <p className="text-xs font-medium uppercase tracking-widest text-brand/70 mb-3">
            Censorship event · {ctx.badge}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight leading-tight mb-4">
            {ctx.title}
          </h1>
          <p className="text-base text-gray-700 leading-relaxed">{content.dek}</p>
        </header>

        {content.hero && <ContextHero hero={content.hero} />}

        <article className={proseClasses}>{content.body}</article>

        {/* Data-driven list of matching books. */}
        <section className="mt-12 border-t border-neutral-200 pt-6">
          <h2 className="font-serif text-xl font-semibold tracking-tight text-gray-900 mb-1">
            {content.listHeading}
            {books.length > 0 && (
              <span className="ml-2 text-sm font-normal text-neutral-400">
                ({books.length.toLocaleString('en-US')})
              </span>
            )}
          </h2>
          <p className="text-sm text-neutral-500 mb-5">{content.listIntro}</p>
          {books.length === 0 ? (
            <p className="text-sm text-neutral-400 italic">
              No matching titles are currently documented.
            </p>
          ) : (
            <ul className="space-y-2">
              {shownBooks.map((b) => (
                <li key={b.slug}>
                  <Link
                    href={`/books/${b.slug}`}
                    className="group flex flex-col px-4 py-3 bg-white border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
                  >
                    <span className="font-serif text-base font-medium text-gray-900 group-hover:text-oxblood transition-colors">
                      {b.title}
                    </span>
                    {b.author && (
                      <span className="text-xs text-neutral-500">{b.author}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {books.length > DISPLAY_CAP && (
            <p className="mt-5 text-xs text-neutral-400 italic">
              Showing the {DISPLAY_CAP.toLocaleString('en-US')} best-known titles, of{' '}
              {books.length.toLocaleString('en-US')} documented under this event.
            </p>
          )}
          {register && register.entry_count > 0 && (
            <p className="mt-5 text-sm text-neutral-600">
              Another {register.entry_count.toLocaleString('en-US')} titles from this list have
              no page of their own here. They are listed as printed, with a link to the
              original, in the{' '}
              <Link href={`/registers/${register.slug}`} className="text-oxblood underline underline-offset-2">
                {register.title_en ?? register.title} register
              </Link>.
            </p>
          )}
        </section>

        {/* Sources */}
        <section className="mt-10 text-xs text-neutral-500 leading-relaxed">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            Sources
          </h2>
          {content.sources}
        </section>
      </main>
    </>
  )
}
