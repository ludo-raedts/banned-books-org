export const revalidate = 86400

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { coverAlt } from '@/lib/cover-alt'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'
import AwardBadge from '@/components/award-badge'
import { parseAwards, awardName, type Award } from '@/lib/awards'

const CANONICAL = 'https://www.banned-books.org/award-winning-banned-books'

export const metadata: Metadata = {
  title: 'Award-Winning Banned Books: Nobel & Pulitzer Winners',
  description:
    'The Nobel Prize and Pulitzer Prize winners whose books have been banned or challenged — from Toni Morrison and John Steinbeck to Maus and The Color Purple, with the year and citation for each prize.',
  alternates: { canonical: '/award-winning-banned-books' },
}

type NobelAuthor = {
  slug: string
  display_name: string
  award: Award
  books: { slug: string; title: string }[]
}

type PulitzerBook = {
  slug: string
  title: string
  cover_url: string | null
  first_published_year: number | null
  award: Award
  author: { display_name: string; slug: string | null } | null
  distinct_countries: number
}

async function fetchData(): Promise<{ nobel: NobelAuthor[]; pulitzer: PulitzerBook[] }> {
  const db = adminClient()

  // Award-bearing rows only. `.not('awards','eq','[]')` rides the partial GIN
  // index (idx_authors_awards / idx_books_awards), so these stay bounded reads
  // (~46 authors, ~27 books) rather than full-table scans.
  const [{ data: authorRows, error: aErr }, { data: bookRows, error: bErr }] = await Promise.all([
    db
      .from('authors')
      .select('slug, display_name, awards, book_authors(books(slug, title, is_blanket_works))')
      .not('awards', 'eq', '[]'),
    db
      .from('books')
      .select('slug, title, cover_url, first_published_year, awards, book_authors(authors(display_name, slug)), bans(country_code)')
      .not('awards', 'eq', '[]'),
  ])
  if (aErr) throw aErr
  if (bErr) throw bErr

  const nobel: NobelAuthor[] = ((authorRows ?? []) as unknown as {
    slug: string
    display_name: string
    awards: unknown
    book_authors: { books: { slug: string; title: string; is_blanket_works: boolean } | null }[]
  }[])
    .flatMap((a) => {
      const nobelAward = parseAwards(a.awards).find((aw) => aw.award.startsWith('Nobel'))
      if (!nobelAward) return []
      const books = a.book_authors
        .map((ba) => ba.books)
        .filter((b): b is { slug: string; title: string; is_blanket_works: boolean } => !!b && !b.is_blanket_works)
        .map((b) => ({ slug: b.slug, title: b.title }))
        .sort((x, y) => x.title.localeCompare(y.title))
      return [{ slug: a.slug, display_name: a.display_name, award: nobelAward, books }]
    })
    .sort((x, y) => x.award.year - y.award.year)

  const pulitzer: PulitzerBook[] = ((bookRows ?? []) as unknown as {
    slug: string
    title: string
    cover_url: string | null
    first_published_year: number | null
    awards: unknown
    book_authors: { authors: { display_name: string; slug: string | null } | null }[]
    bans: { country_code: string }[]
  }[])
    .flatMap((b) => {
      const pul = parseAwards(b.awards).find((aw) => aw.award.startsWith('Pulitzer'))
      if (!pul) return []
      return [
        {
          slug: b.slug,
          title: b.title,
          cover_url: b.cover_url,
          first_published_year: b.first_published_year,
          award: pul,
          author: b.book_authors[0]?.authors ?? null,
          distinct_countries: new Set(b.bans.map((x) => x.country_code)).size,
        },
      ]
    })
    .sort((x, y) => x.award.year - y.award.year)

  return { nobel, pulitzer }
}

export default async function AwardWinningBannedBooksPage() {
  const { nobel, pulitzer } = await fetchData()

  const nobelBookCount = new Set(nobel.flatMap((a) => a.books.map((b) => b.slug))).size
  const heroStats = [
    { value: String(nobel.length), label: 'Nobel laureates banned' },
    { value: String(pulitzer.length), label: 'Pulitzer winners banned' },
    { value: `${nobelBookCount}+`, label: 'Acclaimed titles censored' },
  ]

  // JSON-LD: a CollectionPage wrapping one ItemList of the banned award winners
  // (books + the laureate authors), each linking back to its detail page.
  const itemListEl = [
    ...pulitzer.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://www.banned-books.org/books/${b.slug}`,
      name: b.title,
    })),
    ...nobel.map((a, i) => ({
      '@type': 'ListItem',
      position: pulitzer.length + i + 1,
      url: `https://www.banned-books.org/authors/${a.slug}`,
      name: a.display_name,
    })),
  ]
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${CANONICAL}#page`,
    url: CANONICAL,
    name: 'Award-Winning Banned Books: Nobel & Pulitzer Winners',
    description: metadata.description,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: itemListEl.length,
      itemListElement: itemListEl,
    },
  }

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← All books
          </Link>

          <Eyebrow>Prestige meets censorship</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 max-w-[820px]">
            Award-winning banned books.
          </h1>

          <div className="max-w-[820px]">
            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-black border-b border-neutral-200 py-4">
              {heroStats.map((s) => (
                <div key={s.label}>
                  <div className="not-italic font-serif text-3xl md:text-4xl font-semibold tracking-tight text-oxblood tabular-nums">
                    {s.value}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-600">{s.label}</div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-sm md:text-base leading-relaxed text-gray-700">
              The world&apos;s two most celebrated literary honours are no shield against the censor. Every author and book
              below has won a <strong>Nobel Prize in Literature</strong> or a <strong>Pulitzer Prize</strong> — and every one
              has also been banned, removed, or challenged somewhere. The scale varies enormously: for a few, like Toni
              Morrison or John Steinbeck, that means hundreds of challenges across many countries; for many it is a single
              removal in one school district, sometimes decades ago. The point isn&apos;t a worldwide suppression of great
              literature — it is something quieter and, in its way, more telling: even literature&apos;s highest honours are no
              guarantee against a censor. The Nobel honours a writer&apos;s whole body of work, so it appears here at the
              author level; the Pulitzer is awarded to a single book. Each entry shows when the prize was awarded and, where
              available, the committee&apos;s own citation.
            </p>
          </div>
        </div>
      </section>

      {/* ── About the prizes ──────────────────────────────────────────── */}
      <SectionShell tone="cream" eyebrow="About the prizes">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white border border-neutral-200 rounded-sm p-5">
            <h2 className="font-serif text-xl font-semibold text-gray-900 mb-2">🏅 The Nobel Prize in Literature</h2>
            <p className="text-sm leading-relaxed text-gray-700">
              Established by the 1895 will of the Swedish chemist Alfred Nobel and first awarded in 1901, it is given each year
              by the Swedish Academy to an author whose body of work represents, in Nobel&apos;s words, &ldquo;the most outstanding
              work in an idealistic direction.&rdquo; Because it honours an entire œuvre rather than a single title, it appears
              here as an author-level distinction.{' '}
              <a href="https://www.nobelprize.org/prizes/literature/" rel="nofollow noopener" target="_blank" className="text-oxblood hover:underline">
                nobelprize.org
              </a>
            </p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-sm p-5">
            <h2 className="font-serif text-xl font-semibold text-gray-900 mb-2">🏆 The Pulitzer Prize</h2>
            <p className="text-sm leading-relaxed text-gray-700">
              Endowed by the newspaper publisher Joseph Pulitzer and first awarded in 1917 through Columbia University, the
              Pulitzer Prize for Fiction — called the Prize for the Novel until 1948 — honours distinguished fiction by an
              American author, preferably dealing with American life. It is awarded to a specific book. Art Spiegelman&apos;s
              graphic memoir <em>Maus</em> received a one-off Special Citation in 1992.{' '}
              <a href="https://www.pulitzer.org/prize-winners-by-category/219" rel="nofollow noopener" target="_blank" className="text-oxblood hover:underline">
                pulitzer.org
              </a>
            </p>
          </div>
        </div>
      </SectionShell>

      {/* ── Nobel laureates ───────────────────────────────────────────── */}
      <SectionShell eyebrow={`Nobel laureates · ${nobel.length} banned`}>
        <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-1">
          Nobel laureates whose books were banned
        </h2>
        <p className="text-sm text-gray-600 mb-6 max-w-[760px]">
          Listed by the year the prize was awarded. The quoted line is the Swedish Academy&apos;s citation.
        </p>
        <ul className="divide-y divide-neutral-200 bg-white border border-neutral-200 rounded-sm">
          {nobel.map((a) => (
            <li key={a.slug} className="px-4 py-4 md:px-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link href={`/authors/${a.slug}`} className="font-serif text-lg font-semibold text-gray-900 hover:text-oxblood transition-colors">
                  {a.display_name}
                </Link>
                <AwardBadge award={a.award} />
              </div>
              {a.award.motivation && (
                <p className="mt-1.5 text-sm italic text-gray-600 leading-snug max-w-[760px]">
                  &ldquo;{a.award.motivation}&rdquo;
                </p>
              )}
              {a.books.length > 0 && (
                <p className="mt-2 text-sm text-gray-700">
                  <span className="text-neutral-500">Banned titles: </span>
                  {a.books.map((b, i) => (
                    <span key={b.slug}>
                      {i > 0 && ', '}
                      <Link href={`/books/${b.slug}`} className="text-oxblood hover:underline">
                        {b.title}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* ── Pulitzer winners ──────────────────────────────────────────── */}
      <SectionShell tone="cream" eyebrow={`Pulitzer winners · ${pulitzer.length} banned`}>
        <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-1">
          Pulitzer-winning books that were banned
        </h2>
        <p className="text-sm text-gray-600 mb-6 max-w-[760px]">Listed by the year the prize was awarded.</p>
        <ul className="divide-y divide-neutral-200 bg-white border border-neutral-200 rounded-sm">
          {pulitzer.map((b) => (
            <li key={b.slug}>
              <Link href={`/books/${b.slug}`} className="group flex items-center gap-4 px-4 py-3 hover:bg-cream/50 transition-colors">
                <div className="shrink-0 w-10 h-14 rounded overflow-hidden bg-neutral-100">
                  {b.cover_url && (
                    <Image
                      src={b.cover_url}
                      alt={coverAlt(b.title, b.author?.display_name ?? undefined)}
                      width={40}
                      height={56}
                      className="w-full h-full object-cover"
                      sizes="40px"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors truncate">
                    {b.title}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {b.author?.display_name}
                    {b.first_published_year ? <span className="text-gray-400"> · {b.first_published_year}</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-amber-800">
                    🏆 {awardName(b.award)}, {b.award.year}
                    {b.distinct_countries > 0 && (
                      <span className="text-neutral-500">
                        {' · '}banned in {b.distinct_countries} {b.distinct_countries === 1 ? 'country' : 'countries'}
                      </span>
                    )}
                  </div>
                  {b.award.motivation && (
                    <p className="mt-1 text-xs italic text-gray-600 leading-snug">&ldquo;{b.award.motivation}&rdquo;</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </SectionShell>
    </main>
  )
}
