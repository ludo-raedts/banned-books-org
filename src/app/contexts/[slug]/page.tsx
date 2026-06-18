// /contexts/<slug> — long-form hub page for a named censorship event.
//
// Title/badge/matching come from the ban-context registry; the prose, hero and
// sources come from content.tsx; the list of books is data-driven (one bounded,
// ISR-cached query). Only registry entries with hasHub === true render here.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase'
import { buildCitationMeta } from '@/lib/citation-meta'
import { BAN_CONTEXTS, getBanContext, type BanContext } from '@/lib/ban-contexts'
import { CONTEXT_CONTENT, ContextHero } from './content'

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

export function generateStaticParams() {
  return BAN_CONTEXTS.filter((c) => c.hasHub).map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const ctx = getBanContext(slug)
  const content = CONTEXT_CONTENT[slug]
  if (!ctx || !ctx.hasHub || !content) return {}

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
async function fetchContextBooks(ctx: BanContext): Promise<BookRow[]> {
  const sb = adminClient()

  const shape = (
    rows:
      | { slug: string; title: string; book_authors: { authors: { display_name: string } | null }[] }[]
      | null,
  ): BookRow[] =>
    (rows ?? [])
      .map((b) => ({
        slug: b.slug,
        title: b.title,
        author: b.book_authors?.[0]?.authors?.display_name ?? null,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'en'))

  // Strategy A: explicit slug allowlist.
  if (ctx.match.bookSlugs?.length) {
    const { data } = await sb
      .from('books')
      .select('slug, title, book_authors(authors(display_name))')
      .in('slug', ctx.match.bookSlugs)
    return shape(data as never)
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

  const out: BookRow[] = []
  const bIdList = Array.from(bookIds)
  for (let i = 0; i < bIdList.length; i += 500) {
    const { data } = await sb
      .from('books')
      .select('slug, title, book_authors(authors(display_name))')
      .in('id', bIdList.slice(i, i + 500))
    out.push(...shape(data as never))
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, 'en'))
}

export default async function ContextPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ctx = getBanContext(slug)
  const content = CONTEXT_CONTENT[slug]
  if (!ctx || !ctx.hasHub || !content) notFound()

  const books = await fetchContextBooks(ctx)
  // Some events (the 1938 Nazi list) cover thousands of titles. Cap the rendered
  // DOM to keep the page light; the heading still shows the true total and the
  // long tail stays reachable via the sitemap and country/reason pages.
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
              Showing the first {DISPLAY_CAP.toLocaleString('en-US')} titles alphabetically, of{' '}
              {books.length.toLocaleString('en-US')} documented under this event.
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
