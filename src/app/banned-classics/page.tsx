export const revalidate = 86400

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import { coverAlt } from '@/lib/cover-alt'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const metadata: Metadata = {
  title: 'Banned Classic Literature — Works Published Before 1970',
  description: 'Classic books that are still banned or challenged today. Orwell, Nabokov, Lawrence, Flaubert — enduring literature that governments still find threatening.',
  alternates: { canonical: '/banned-classics' },
}

type ClassicBook = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  first_published_year: number
  book_authors: { authors: { display_name: string } | null }[]
  bans: { country_code: string; countries: { name_en: string } | null }[]
}

function topCountry(bans: ClassicBook['bans']): string | null {
  const counts = new Map<string, { name: string; count: number }>()
  for (const ban of bans) {
    const name = ban.countries?.name_en ?? ban.country_code
    const e = counts.get(name) ?? { name, count: 0 }
    e.count++
    counts.set(name, e)
  }
  if (counts.size === 0) return null
  return [...counts.values()].sort((a, b) => b.count - a.count)[0].name
}

function era(year: number): 'pre1900' | '1900to1945' | '1945to1970' {
  if (year < 1900) return 'pre1900'
  if (year < 1945) return '1900to1945'
  return '1945to1970'
}

const ERA_LABELS: Record<string, string> = {
  pre1900: 'Before 1900',
  '1900to1945': '1900 – 1945',
  '1945to1970': '1945 – 1970',
}

// Inclusion threshold. Every catalogue book has ≥1 ban (books only exist if
// banned), so ">=1" admitted all ~4.9k pre-1970 books — including ~3.5k obscure
// single-listing titles from the Nazi-1938 list import, which both bloated the
// page and made the heavy bans-embed time out at prerender. This page is an
// explicit "Top-list" of classics STILL banned, so we require ≥2 documented
// bans (multiple events / countries), which both curates the list and bounds
// the query to ~200 books.
const MIN_BANS = 2

async function fetchClassics(): Promise<ClassicBook[]> {
  const supabase = adminClient()
  const SELECT = 'id, title, slug, cover_url, first_published_year, book_authors(authors(display_name)), bans(country_code, countries(name_en))'

  // 1. Pre-1970 book ids (light; no embed).
  const ids: number[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('books')
      .select('id')
      .lt('first_published_year', 1970)
      .not('first_published_year', 'is', null)
      .order('id')
      .range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    ids.push(...data.map(r => r.id as number))
    if (data.length < 1000) break
  }

  // 2. Ban counts from the materialized view (cheap, pre-aggregated) — used to
  //    identify the multiply-banned subset WITHOUT embedding every ban row.
  const counts = new Map<number, number>()
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await supabase
      .from('v_book_ban_counts')
      .select('entity_id, total_bans')
      .in('entity_id', ids.slice(i, i + 300))
    if (error) throw error
    for (const r of (data ?? []) as Array<{ entity_id: number; total_bans: number }>) {
      counts.set(r.entity_id, r.total_bans)
    }
  }
  const keep = ids.filter(id => (counts.get(id) ?? 0) >= MIN_BANS)

  // 3. Hydrate full detail for the bounded set only. Small batch: the SELECT
  //    embeds every ban row (+ countries join) per book, and heavily-banned
  //    classics carry many bans — a 300-book batch pulled enough rows in one
  //    statement to trip Postgres 57014 (statement timeout) at prerender once
  //    the catalogue grew past ~20k books. 50 keeps each statement well under.
  const out: ClassicBook[] = []
  for (let i = 0; i < keep.length; i += 50) {
    const { data, error } = await supabase.from('books').select(SELECT).in('id', keep.slice(i, i + 50))
    if (error) throw error
    out.push(...(data as unknown as ClassicBook[]))
  }

  return out
    .filter(b => b.bans.length >= 1)
    .sort((a, b) => b.bans.length - a.bans.length)
}

export default async function BannedClassicsPage() {
  const books = await fetchClassics()

  const grouped: Record<string, ClassicBook[]> = { pre1900: [], '1900to1945': [], '1945to1970': [] }
  for (const book of books) {
    grouped[era(book.first_published_year)].push(book)
  }

  const erasInOrder = (['pre1900', '1900to1945', '1945to1970'] as const).filter(k => grouped[k].length > 0)

  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← All books
          </Link>

          <Eyebrow>Top-list · Published before 1970</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 max-w-[820px]">
            Banned classic literature.
          </h1>

          <p className="mt-6 max-w-[720px] text-sm md:text-base leading-relaxed text-gray-700">
            A common assumption is that book banning is a relic of less enlightened times. The titles below prove otherwise. Every work on this page was first published before 1970 — and every one has been formally banned, challenged, or removed from shelves within living memory. Orwell wrote <em>1984</em> in 1948; it is still removed from school curricula today. Nabokov&apos;s <em>Lolita</em> was prosecuted in multiple countries in the 1950s; it still appears on challenge lists. The books that threaten power tend to keep threatening it. For how we define a ban, see our{' '}
            <Link href="/methodology" className="text-oxblood hover:underline">methodology</Link>.
          </p>

          <nav aria-label="Jump to era" className="mt-6 flex flex-wrap gap-2">
            {erasInOrder.map(eraKey => (
              <a
                key={eraKey}
                href={`#${eraKey}`}
                className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-700 hover:border-oxblood hover:text-oxblood transition-colors"
              >
                {ERA_LABELS[eraKey]}
                <span className="ml-1.5 text-neutral-400 tabular-nums">{grouped[eraKey].length}</span>
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* ── Eras (alternating cream / white) ──────────────────────────── */}
      {erasInOrder.map((eraKey, idx) => {
        const group = grouped[eraKey]
        const tone = idx % 2 === 0 ? 'cream' : 'white'
        return (
          <SectionShell key={eraKey} tone={tone} id={eraKey} eyebrow={`Era · ${group.length} ${group.length === 1 ? 'work' : 'works'}`}>
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30">
              {ERA_LABELS[eraKey]}
            </h2>

            <ol className="divide-y divide-neutral-200 bg-white border border-neutral-200 rounded-sm">
              {group.map((book, i) => {
                const author = book.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', ')
                const top = topCountry(book.bans)
                return (
                  <li key={book.id}>
                    <Link
                      href={`/books/${book.slug}`}
                      className="group flex items-center gap-4 px-4 py-3 hover:bg-cream/50 transition-colors"
                    >
                      <span className="w-8 shrink-0 text-right font-serif text-base tabular-nums text-oxblood font-semibold">
                        {i + 1}
                      </span>

                      <div className="shrink-0 w-10 h-14 rounded overflow-hidden bg-neutral-100">
                        {book.cover_url ? (
                          <Image
                            src={book.cover_url}
                            alt={coverAlt(book.title, author, book.first_published_year)}
                            width={40}
                            height={56}
                            className="w-full h-full object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <BookCoverPlaceholder title={book.title} slug={book.slug} className="h-full" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-base font-medium text-gray-900 leading-snug group-hover:text-oxblood transition-colors truncate">
                          {book.title}
                        </p>
                        <p className="text-xs text-neutral-600 truncate">
                          {author}
                          {book.first_published_year && (
                            <span className="text-neutral-400"> · {book.first_published_year}</span>
                          )}
                        </p>
                        {top && (
                          <p className="text-[11px] text-neutral-500 truncate mt-0.5">{top}</p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="font-serif text-lg font-semibold tabular-nums text-oxblood">
                          {book.bans.length}
                        </span>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                          {book.bans.length === 1 ? 'ban' : 'bans'}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </SectionShell>
        )
      })}

      {/* ── Footer note ───────────────────────────────────────────────── */}
      <SectionShell tone={erasInOrder.length % 2 === 0 ? 'cream' : 'white'}>
        <p className="text-xs text-neutral-500 leading-relaxed max-w-2xl">
          Includes only works with at least one documented ban in our catalogue. Coverage skews toward English-language sources.{' '}
          <Link href="/methodology" className="text-oxblood hover:underline">Read the methodology →</Link>
        </p>
      </SectionShell>
    </main>
  )
}
