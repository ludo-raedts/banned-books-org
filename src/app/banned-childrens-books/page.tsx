export const revalidate = 86400

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { adminClient } from '@/lib/supabase'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import { coverAlt } from '@/lib/cover-alt'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

// Comprehensive directory page sibling to /banned-classics: every book in
// the catalogue tagged as written for readers under 18, sorted by recorded
// ban count, grouped into Young adult (broad teen audience) and Children's
// (picture books and middle grade, treated as one bucket because the DB's
// fine-grained tags are sparsely applied).
//
// Editorial position: this page documents who tried to keep these books
// from young readers. It does not assign ages, recommend audiences, or
// give parenting advice. The curated Reading Club young-readers track is
// the place to go for discussion-group format; this page is the wide
// catalogue for SEO and discovery.

// Three publishing-format buckets. The directory sorts each book into the
// most-specific bucket it qualifies for — picture-book wins over middle-grade
// wins over young-adult — so a book tagged with both `young-adult` (broad)
// and `middle-grade-fiction` (LLM classifier) lands in the middle-grade
// section, not the young-adult one.
const PICTURE_TAGS = ['picture-book'] as const
const MIDDLE_GRADE_TAGS = ['middle-grade-fiction', 'childrens-literature', 'children'] as const
const YA_TAGS = ['young-adult', 'young-adult-fiction'] as const
const ALL_TAGS = [...PICTURE_TAGS, ...MIDDLE_GRADE_TAGS, ...YA_TAGS] as const

export const metadata: Metadata = {
  title: "Banned children's books — picture books, middle grade, young adult",
  description:
    "Books written and published for readers under 18 that adults tried to keep from them. Documented bans and challenges across the catalogue, sorted by number of recorded bans.",
  alternates: { canonical: '/banned-childrens-books' },
}

type ChildBook = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  first_published_year: number | null
  genres: string[] | null
  book_authors: { authors: { display_name: string } | null }[]
  bans: { country_code: string; countries: { name_en: string } | null }[]
}

function topCountry(bans: ChildBook['bans']): string | null {
  const counts = new Map<string, number>()
  for (const ban of bans) {
    const name = ban.countries?.name_en ?? ban.country_code
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

async function fetchChildrensBooks(): Promise<{ picture: ChildBook[]; middle: ChildBook[]; ya: ChildBook[] }> {
  const supabase = adminClient()
  const SELECT =
    'id, title, slug, cover_url, first_published_year, genres, book_authors(authors(display_name)), bans(country_code, countries(name_en))'

  const filter = ALL_TAGS.map(t => `genres.cs.{${t}}`).join(',')

  let all: ChildBook[] = []
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('books')
      .select(SELECT)
      .or(filter)
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    all = all.concat(data as unknown as ChildBook[])
    if (data.length < 1000) break
    offset += 1000
  }

  // Only books with documented bans land on the directory. The
  // /banned-childrens-books page is a banned-books page; if there's no ban
  // it doesn't belong here.
  const withBans = all.filter(b => (b.bans?.length ?? 0) >= 1)

  // Bucket by most-specific tag. A book tagged with `picture-book` lands
  // in the picture-book section even if it also carries `young-adult`
  // (because picture-book is more specific). Same logic for middle-grade
  // over young-adult.
  const picture: ChildBook[] = []
  const middle: ChildBook[] = []
  const ya: ChildBook[] = []
  for (const b of withBans) {
    const g = b.genres ?? []
    if (PICTURE_TAGS.some(t => g.includes(t))) picture.push(b)
    else if (MIDDLE_GRADE_TAGS.some(t => g.includes(t))) middle.push(b)
    else if (YA_TAGS.some(t => g.includes(t))) ya.push(b)
  }

  const byBans = (a: ChildBook, b: ChildBook) => b.bans.length - a.bans.length
  picture.sort(byBans)
  middle.sort(byBans)
  ya.sort(byBans)

  return { picture, middle, ya }
}

export default async function BannedChildrensBooksPage() {
  const { picture, middle, ya } = await fetchChildrensBooks()
  const total = picture.length + middle.length + ya.length

  // JSON-LD: ItemList of both buckets, capped per Google's reasonable
  // page-size guidance for ItemList structured data.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': 'https://www.banned-books.org/banned-childrens-books',
        name: "Banned children's books",
        url: 'https://www.banned-books.org/banned-childrens-books',
        description: metadata.description,
      },
      {
        '@type': 'ItemList',
        name: "Banned children's and young-adult books",
        numberOfItems: total,
        itemListElement: [...picture, ...middle, ...ya].slice(0, 100).map((b, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Book',
            name: b.title,
            ...(b.book_authors[0]?.authors?.display_name
              ? { author: { '@type': 'Person', name: b.book_authors[0].authors.display_name } }
              : {}),
            url: `https://www.banned-books.org/books/${b.slug}`,
            ...(b.first_published_year ? { datePublished: String(b.first_published_year) } : {}),
          },
        })),
      },
    ],
  }

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← All books
          </Link>

          <Eyebrow>Directory · Children&rsquo;s literature</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 max-w-[820px]">
            Banned children&rsquo;s books.
          </h1>

          <p className="mt-6 max-w-[720px] text-sm md:text-base leading-relaxed text-gray-700">
            Every book on this page was published for readers under 18 and has at least one documented ban or challenge in
            our catalogue. {total} books across picture books ({picture.length}), middle grade ({middle.length}), and
            young adult ({ya.length}). The audience categories come from publishers and library catalogs; we don&rsquo;t
            assign age recommendations. We document who tried to keep these books from young readers, where, and on what
            grounds.
          </p>

          <div className="mt-6 inline-flex items-center gap-3 px-4 py-2.5 border border-oxblood/30 rounded-sm bg-cream/40">
            <p className="text-sm text-gray-800">
              Looking for a reading-group format with discussion questions?{' '}
              <Link href="/reading-club/young-readers" className="text-oxblood hover:underline font-medium">
                → For Young Readers reading-club track
              </Link>
            </p>
          </div>

          <nav aria-label="Jump to section" className="mt-6 flex flex-wrap gap-2">
            {picture.length > 0 && (
              <a href="#picture-books" className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-700 hover:border-oxblood hover:text-oxblood transition-colors">
                Picture books <span className="ml-1.5 text-neutral-400 tabular-nums">{picture.length}</span>
              </a>
            )}
            {middle.length > 0 && (
              <a href="#middle-grade" className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-700 hover:border-oxblood hover:text-oxblood transition-colors">
                Middle grade <span className="ml-1.5 text-neutral-400 tabular-nums">{middle.length}</span>
              </a>
            )}
            {ya.length > 0 && (
              <a href="#young-adult" className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-700 hover:border-oxblood hover:text-oxblood transition-colors">
                Young adult <span className="ml-1.5 text-neutral-400 tabular-nums">{ya.length}</span>
              </a>
            )}
          </nav>
        </div>
      </section>

      {/* ── Format preview tiles — three sections at a glance ─────────── */}
      <SectionShell tone="cream" eyebrow="Three sections · click any tile to jump in">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {picture.length > 0 && (
            <FormatTile
              anchor="picture-books"
              label="Picture books"
              count={picture.length}
              description="Illustrated books published for younger readers — ages roughly 4 to 8."
              previewBooks={picture.slice(0, 3)}
            />
          )}
          {middle.length > 0 && (
            <FormatTile
              anchor="middle-grade"
              label="Middle grade"
              count={middle.length}
              description="Longer prose for readers roughly 8 to 12, fewer illustrations, age-appropriate themes."
              previewBooks={middle.slice(0, 3)}
            />
          )}
          {ya.length > 0 && (
            <FormatTile
              anchor="young-adult"
              label="Young adult"
              count={ya.length}
              description="Published for readers 12 and up — complex themes around identity, sex, violence, politics."
              previewBooks={ya.slice(0, 3)}
            />
          )}
        </div>
      </SectionShell>

      {picture.length > 0 && (
        <BookSection
          id="picture-books"
          tone="white"
          heading="Picture books"
          eyebrow={`Section · ${picture.length} ${picture.length === 1 ? 'work' : 'works'}`}
          books={picture}
        />
      )}

      {middle.length > 0 && (
        <BookSection
          id="middle-grade"
          tone="cream"
          heading="Middle grade"
          eyebrow={`Section · ${middle.length} ${middle.length === 1 ? 'work' : 'works'}`}
          books={middle}
        />
      )}

      {ya.length > 0 && (
        <BookSection
          id="young-adult"
          tone="white"
          heading="Young adult"
          eyebrow={`Section · ${ya.length} ${ya.length === 1 ? 'work' : 'works'}`}
          books={ya}
        />
      )}

      <SectionShell tone="white" eyebrow="Related">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/reading-club/young-readers" className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Reading club · Curated</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">For young readers →</p>
            <p className="text-xs text-neutral-600 mt-1.5">15 books with paradox-blurbs and two parallel discussion sets — book + ban.</p>
          </Link>
          <Link href="/banned-classics" className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Directory · Historical</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">Banned classics →</p>
            <p className="text-xs text-neutral-600 mt-1.5">Works published before 1970 with documented bans within living memory.</p>
          </Link>
          <Link href="/methodology" className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">How we work</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">Methodology →</p>
            <p className="text-xs text-neutral-600 mt-1.5">How a documented ban is defined, sourced, and scoped in this catalogue.</p>
          </Link>
        </div>
      </SectionShell>

      <SectionShell tone="cream">
        <p className="text-xs text-neutral-500 leading-relaxed max-w-2xl">
          Includes only works tagged with a children&rsquo;s or young-adult audience genre in our catalogue and with at
          least one documented ban. Format buckets (picture book / middle grade / young adult) are derived from publisher
          metadata and an automated classifier; some books may sit on the boundary between two buckets. Coverage skews
          toward English-language sources.{' '}
          <Link href="/methodology" className="text-oxblood hover:underline">Read the methodology →</Link>
        </p>
      </SectionShell>
    </main>
  )
}

// Compact format-bucket teaser shown above the full sections. Three of these
// render as a row on desktop, stacking on mobile, so a visitor scanning the
// page sees that the directory has three distinct format sections rather
// than mistaking the first long list for the whole page. Clicking the tile
// anchors to the corresponding full-list section below.
function FormatTile({
  anchor, label, count, description, previewBooks,
}: {
  anchor: string
  label: string
  count: number
  description: string
  previewBooks: ChildBook[]
}): ReactNode {
  return (
    <a
      href={`#${anchor}`}
      className="group block bg-white border border-neutral-200 hover:border-oxblood rounded-sm p-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-oxblood/40"
    >
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{count} {count === 1 ? 'work' : 'works'}</p>
      <h3 className="font-serif text-xl font-semibold text-gray-900 group-hover:text-oxblood transition-colors leading-tight">
        {label}
      </h3>
      <p className="mt-2 text-xs text-neutral-600 leading-relaxed">{description}</p>

      {previewBooks.length > 0 && (
        <div className="mt-4 flex gap-2 items-end">
          {previewBooks.map(b => (
            <div key={b.id} className="flex-1 aspect-[2/3] relative bg-neutral-100 rounded-sm overflow-hidden ring-1 ring-neutral-200">
              {b.cover_url ? (
                <Image
                  src={b.cover_url}
                  alt={coverAlt(b.title, b.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', '), b.first_published_year ?? undefined)}
                  fill
                  sizes="(min-width: 768px) 10vw, 25vw"
                  className="object-cover"
                />
              ) : (
                <BookCoverPlaceholder title={b.title} slug={b.slug} className="h-full" />
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-sm font-medium text-oxblood group-hover:underline">
        See all {count} {label.toLowerCase()} →
      </p>
    </a>
  )
}

function BookSection({
  id, tone, heading, eyebrow, books,
}: {
  id: string
  tone: 'cream' | 'white'
  heading: string
  eyebrow: string
  books: ChildBook[]
}) {
  return (
    <SectionShell tone={tone} id={id} eyebrow={eyebrow}>
      <h2
        className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30"
        dangerouslySetInnerHTML={{ __html: heading }}
      />
      <ol className="divide-y divide-neutral-200 bg-white border border-neutral-200 rounded-sm">
        {books.map((book, i) => {
          const author = book.book_authors.map(ba => ba.authors?.display_name).filter(Boolean).join(', ')
          const top = topCountry(book.bans)
          return (
            <li key={book.id}>
              <Link href={`/books/${book.slug}`} className="group flex items-center gap-4 px-4 py-3 hover:bg-cream/50 transition-colors">
                <span className="w-8 shrink-0 text-right font-serif text-base tabular-nums text-oxblood font-semibold">
                  {i + 1}
                </span>
                <div className="shrink-0 w-10 h-14 rounded overflow-hidden bg-neutral-100">
                  {book.cover_url ? (
                    <Image
                      src={book.cover_url}
                      alt={coverAlt(book.title, author, book.first_published_year ?? undefined)}
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
                    {author || '—'}
                    {book.first_published_year && (
                      <span className="text-neutral-400"> · {book.first_published_year}</span>
                    )}
                  </p>
                  {top && <p className="text-[11px] text-neutral-500 truncate mt-0.5">{top}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-serif text-lg font-semibold tabular-nums text-oxblood">{book.bans.length}</span>
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
}
