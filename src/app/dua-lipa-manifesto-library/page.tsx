export const revalidate = 86400

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { withDbRetry } from '@/lib/db-retry'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import { coverAlt } from '@/lib/cover-alt'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'
import { SITE_URL } from '@/lib/canonical-host'
import {
  MANIFESTO_LIBRARY,
  MANIFESTO_THEMES,
  type ManifestoTheme,
} from '@/lib/manifesto-library'

const LINKED = MANIFESTO_LIBRARY.filter((e) => e.slug).length

// CollectionPage + ItemList structured data: names every one of the 100 books
// (with an author and, where we hold it, a canonical URL) so search engines and
// AI crawlers can read the full curated list, not just the prose.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: "Dua Lipa's Manifesto Library",
  description:
    "The 100 banned, censored and contested books Dua Lipa curated for the Manifesto Library at Livraria Lello, Porto.",
  url: `${SITE_URL}/dua-lipa-manifesto-library`,
  isPartOf: { '@type': 'WebSite', name: 'Banned Books', url: SITE_URL },
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: MANIFESTO_LIBRARY.length,
    itemListElement: MANIFESTO_LIBRARY.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Book',
        name: e.title,
        author: { '@type': 'Person', name: e.author },
        ...(e.slug ? { url: `${SITE_URL}/books/${e.slug}` } : {}),
      },
    })),
  },
}

export const metadata: Metadata = {
  title: "Dua Lipa's Manifesto Library — 100 Banned & Censored Books",
  description:
    "Every one of the 100 banned, censored and contested books Dua Lipa curated for the Manifesto Library at Livraria Lello in Porto — grouped by Power, Control, Voice and Memory, with links to each title's ban record.",
  alternates: { canonical: '/dua-lipa-manifesto-library' },
  openGraph: {
    title: "Dua Lipa's Manifesto Library — 100 Banned & Censored Books",
    description:
      "The full list of Dua Lipa's 100-book Manifesto Library at Livraria Lello, Porto, with the censorship record behind each title.",
    images: ['/dua-lipa-manifesto.jpg'],
  },
}

type Detail = {
  slug: string
  title: string
  cover_url: string | null
  first_published_year: number | null
  author: string
  bans: number
}

async function fetchDetails(): Promise<Map<string, Detail>> {
  const supabase = adminClient()
  const slugs = MANIFESTO_LIBRARY.map((e) => e.slug).filter((s): s is string => !!s)

  const { data, error } = await withDbRetry(
    () =>
      supabase
        .from('books')
        .select('id, slug, title, cover_url, first_published_year, book_authors(authors(display_name))')
        .in('slug', slugs),
    'manifesto books',
  )
  if (error) throw error
  const books = (data ?? []) as unknown as Array<{
    id: number
    slug: string
    title: string
    cover_url: string | null
    first_published_year: number | null
    book_authors: { authors: { display_name: string } | null }[]
  }>

  // Ban counts from the pre-aggregated view (cheap; avoids embedding every ban row).
  const counts = new Map<number, number>()
  const ids = books.map((b) => b.id)
  for (let i = 0; i < ids.length; i += 300) {
    const { data: cd, error: ce } = await withDbRetry(
      () =>
        supabase
          .from('v_book_ban_counts')
          .select('entity_id, total_bans')
          .in('entity_id', ids.slice(i, i + 300)),
      'manifesto ban-counts',
    )
    if (ce) throw ce
    for (const r of (cd ?? []) as Array<{ entity_id: number; total_bans: number }>) {
      counts.set(r.entity_id, r.total_bans)
    }
  }

  const map = new Map<string, Detail>()
  for (const b of books) {
    map.set(b.slug, {
      slug: b.slug,
      title: b.title,
      cover_url: b.cover_url,
      first_published_year: b.first_published_year,
      author: b.book_authors.map((ba) => ba.authors?.display_name).filter(Boolean).join(', '),
      bans: counts.get(b.id) ?? 0,
    })
  }
  return map
}

export default async function ManifestoLibraryPage() {
  const details = await fetchDetails()

  const byTheme = (t: ManifestoTheme) => MANIFESTO_LIBRARY.filter((e) => e.theme === t)

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← All books
          </Link>

          <div className="max-w-[720px]">
            <Eyebrow>Curated collection · Service95 × Livraria Lello</Eyebrow>

            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
              Dua Lipa&apos;s Manifesto Library.
            </h1>

            <p className="mt-6 text-sm md:text-base leading-relaxed text-gray-700">
              In June 2026 the singer opened the Manifesto Library — a permanent home for
              100 banned, censored and contested books — inside Livraria Lello in Porto,
              an extension of the Service95 Book Club she founded in 2021. The shelves are
              organised around four themes: <strong>Power</strong>, <strong>Control</strong>,{' '}
              <strong>Voice</strong> and <strong>Memory</strong>. Below is the complete list,
              with the censorship record behind each title we hold — {LINKED} of the 100 are
              already in our catalogue.
            </p>

            <blockquote className="mt-6 border-l-2 border-oxblood/40 pl-4 font-serif text-lg md:text-xl italic leading-snug text-gray-800">
              “A sanctuary for books that have disappeared, for authors whose courage exposes
              the structures of power and control, and for readers who refuse to be told which
              books they are allowed to read.”
              <cite className="mt-2 block not-italic text-xs uppercase tracking-wider text-neutral-500">
                — Dua Lipa, on the Manifesto Library
              </cite>
            </blockquote>
          </div>

          <figure className="mt-8 max-w-2xl">
            <Image
              src="/dua-lipa-manifesto.jpg"
              alt="Dua Lipa performing at Eurosonic Noorderslag, Groningen, January 2016"
              width={1600}
              height={1200}
              className="rounded-sm w-full h-auto shadow-sm"
              sizes="(max-width: 768px) 100vw, 672px"
              priority
            />
            <figcaption className="mt-2 text-[11px] leading-tight text-neutral-400">
              Dua Lipa performing at Eurosonic Noorderslag, Vera, Groningen — January 2016.
            </figcaption>
          </figure>

          <nav aria-label="Jump to theme" className="mt-8 flex flex-wrap gap-2">
            {MANIFESTO_THEMES.map((t) => {
              const group = byTheme(t.key)
              return (
                <a
                  key={t.key}
                  href={`#${t.key.toLowerCase()}`}
                  className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-700 hover:border-oxblood hover:text-oxblood transition-colors"
                >
                  {t.key}
                  <span className="ml-1.5 text-neutral-400 tabular-nums">{group.length}</span>
                </a>
              )
            })}
          </nav>

          <p className="mt-5 text-xs text-neutral-500">
            Read Dua Lipa&apos;s own announcement at{' '}
            <a
              href="https://www.service95.com/manifesto-library-launch"
              className="text-oxblood hover:underline"
              rel="nofollow noopener"
            >
              Service95
            </a>
            .
          </p>
        </div>
      </section>

      {/* ── Themes ─────────────────────────────────────────────────────── */}
      {MANIFESTO_THEMES.map((theme, idx) => {
        const group = byTheme(theme.key)
        const linked = group.filter((e) => e.slug).length
        const tone = idx % 2 === 0 ? 'cream' : 'white'
        return (
          <SectionShell
            key={theme.key}
            tone={tone}
            id={theme.key.toLowerCase()}
            eyebrow={`Theme · ${linked} of ${group.length} in our catalogue`}
          >
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2">
              {theme.key}
            </h2>
            <p className="max-w-[680px] text-sm leading-relaxed text-neutral-600 mb-6">
              {theme.blurb}
            </p>

            <ul className="divide-y divide-neutral-200 bg-white border border-neutral-200 rounded-sm">
              {group.map((entry) => {
                const d = entry.slug ? details.get(entry.slug) : undefined
                if (entry.slug && d) {
                  return (
                    <li key={entry.title}>
                      <Link
                        href={`/books/${entry.slug}`}
                        className="group flex items-center gap-4 px-4 py-3 hover:bg-cream/50 transition-colors"
                      >
                        <div className="shrink-0 w-10 h-14 rounded overflow-hidden bg-neutral-100">
                          {d.cover_url ? (
                            <Image
                              src={d.cover_url}
                              alt={coverAlt(d.title, d.author, d.first_published_year)}
                              width={40}
                              height={56}
                              className="w-full h-full object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <BookCoverPlaceholder title={d.title} slug={entry.slug} className="h-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-serif text-base font-medium text-gray-900 leading-snug group-hover:text-oxblood transition-colors truncate">
                            {entry.title}
                          </p>
                          <p className="text-xs text-neutral-600 truncate">{entry.author}</p>
                        </div>
                        {d.bans > 0 && (
                          <div className="shrink-0 text-right">
                            <span className="font-serif text-lg font-semibold tabular-nums text-oxblood">
                              {d.bans}
                            </span>
                            <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                              {d.bans === 1 ? 'ban' : 'bans'}
                            </p>
                          </div>
                        )}
                      </Link>
                    </li>
                  )
                }
                // On the Manifesto list but not (yet) a documented ban in our database.
                return (
                  <li
                    key={entry.title}
                    className="flex items-center gap-4 px-4 py-3 opacity-70"
                  >
                    <div className="shrink-0 w-10 h-14 rounded bg-neutral-100 border border-dashed border-neutral-300" />
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-base font-medium text-neutral-700 leading-snug truncate">
                        {entry.title}
                      </p>
                      <p className="text-xs text-neutral-500 truncate">{entry.author}</p>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-neutral-400 text-right leading-tight max-w-[120px]">
                      On the list · not yet documented here
                    </span>
                  </li>
                )
              })}
            </ul>
          </SectionShell>
        )
      })}

      {/* ── Footer note ───────────────────────────────────────────────── */}
      <SectionShell tone={MANIFESTO_THEMES.length % 2 === 0 ? 'cream' : 'white'}>
        <p className="text-xs text-neutral-500 leading-relaxed max-w-2xl">
          Titles marked “not yet documented here” appear in Dua Lipa&apos;s Manifesto Library but
          do not yet have a verified ban record in our catalogue — several were contested through
          litigation or a banned adaptation rather than a formal book ban. Where we could source a
          documented ban, we added the title: Han Kang&apos;s{' '}
          <Link href="/books/the-vegetarian" className="text-oxblood hover:underline">
            The Vegetarian
          </Link>{' '}
          was removed from school libraries in Gyeonggi Province, South Korea, in 2024. For how we
          define a ban, see our{' '}
          <Link href="/methodology" className="text-oxblood hover:underline">
            methodology
          </Link>
          .
        </p>
      </SectionShell>
    </main>
  )
}
