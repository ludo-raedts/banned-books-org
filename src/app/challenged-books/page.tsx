// ISR: editorial concept page anchored to school-scope school bans. Same
// 24-hour rhythm as the original page — the underlying bans turnover is
// slow and the editorial copy is static.
export const revalidate = 86400

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import BookCardCompact from '@/components/home/BookCardCompact'
import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import Eyebrow from '@/components/section/Eyebrow'
import FaqSection from '@/components/home/FaqSection'
import type { FaqItem } from '@/components/faq-accordion'

// Title omits the "| Banned Books" suffix — the root layout adds it via
// the `%s | Banned Books` template, so duplicating it here produced a
// "… | Banned Books | Banned Books" tag in the rendered HTML.
export const metadata: Metadata = {
  title: 'Challenged Books — Attempted Censorship',
  description:
    'A challenged book is one that has been formally objected to and removed or restricted — most often from a school library. Browse books challenged across the United States and beyond.',
  alternates: { canonical: '/challenged-books' },
  openGraph: {
    title: 'Challenged Books — Attempted Censorship | Banned Books',
    description: 'A challenged book is one that has been formally objected to and removed or restricted — most often from a school library.',
  },
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'What is a challenged book?',
    a: 'A challenged book is one that has been the subject of a formal written complaint requesting its removal or restriction from a library, school, or public institution. A challenge becomes a ban when the institution acts on the complaint and removes or restricts access to the book.',
  },
  {
    q: 'What is the difference between challenged and banned?',
    a: '"Challenged" means a formal complaint was filed. "Banned" means the book was actually removed or restricted. Every library ban began as a challenge, but many challenges are rejected. This catalogue records completed actions — removals and restrictions — not merely attempted ones.',
  },
  {
    q: 'Why does the United States dominate this list?',
    a: 'Because [PEN America](https://pen.org/banned-books) and the [American Library Association](https://www.ala.org/advocacy/bbooks) systematically publish school and library challenge data. Most countries have no equivalent watchdog organisations tracking removals. The U.S. appearing prominently reflects reporting infrastructure, not uniquely American censorship.',
  },
  {
    q: 'How does this catalogue define a school ban?',
    a: 'A school ban here is a documented removal or restriction of a book from a school library or curriculum by a school board, district, or government authority. Entries are sourced primarily from PEN America\'s Index of School Book Bans and the ALA\'s annual challenge reports. See the full [/scope/school](/scope/school) page for the complete dataset with district, state, and timeline breakdowns.',
  },
]

// JSON-LD covers both the WebPage entity and the FAQPage — kept inline so
// the structured data and visible HTML always ship together.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://www.banned-books.org/challenged-books',
      name: 'Challenged Books — Attempted Censorship',
      description:
        'A catalogue of books formally challenged and removed or restricted from schools and libraries. Most entries originate from PEN America and American Library Association data.',
      url: 'https://www.banned-books.org/challenged-books',
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: {
          '@type': 'Answer',
          // Strip markdown links so the structured-data answer is plain prose.
          text: a.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1'),
        },
      })),
    },
  ],
}

type TopExampleRow = {
  id: number
  title: string
  slug: string
  cover_url: string | null
  book_authors: { authors: { display_name: string } | null }[]
}

function authorOf(row: TopExampleRow): string {
  return row.book_authors.map((ba) => ba.authors?.display_name).filter(Boolean).join(', ')
}

export default async function ChallengedBooksPage() {
  const supabase = adminClient()

  // ── Hero stats: total + scope coverage  ─────────────────────────────────
  // school-scope is the canonical "challenged" surface (PEN/ALA data), so
  // the headline counts mirror /scope/school for visual consistency. We
  // do one sweep for the distinct-book count plus event total.
  const { data: scope } = await supabase
    .from('scopes').select('id, label_en').eq('slug', 'school').single()

  let distinctBooks = 0
  let totalEvents = 0
  const bookCounts = new Map<number, number>()
  if (scope) {
    let page = 0
    while (true) {
      const { data } = await supabase
        .from('bans')
        .select('book_id')
        .eq('scope_id', scope.id)
        .order('id')
        .range(page * 1000, page * 1000 + 999)
      if (!data || data.length === 0) break
      for (const r of data as { book_id: number }[]) {
        totalEvents++
        bookCounts.set(r.book_id, (bookCounts.get(r.book_id) ?? 0) + 1)
      }
      if (data.length < 1000) break
      page++
    }
    distinctBooks = bookCounts.size
  }

  // ── Top 12 most-challenged examples ─────────────────────────────────────
  // Ranked by event count (same logic as /scope/school's "Most banned").
  const topIds = [...bookCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
  let topBooks: Array<{ id: number; title: string; slug: string; cover_url: string | null; author: string; context: string }> = []
  if (topIds.length > 0) {
    const { data: rows } = await supabase
      .from('books')
      .select(`
        id, title, slug, cover_url,
        book_authors(authors(display_name))
      `)
      .in('id', topIds.map(([id]) => id))
    const rowMap = new Map(((rows ?? []) as unknown as TopExampleRow[]).map((r) => [r.id, r]))
    topBooks = topIds
      .map(([id, count]) => {
        const r = rowMap.get(id)
        return r
          ? {
              id: r.id,
              title: r.title,
              slug: r.slug,
              cover_url: r.cover_url,
              author: authorOf(r),
              context: `${count.toLocaleString('en')} documented ${count === 1 ? 'event' : 'events'}`,
            }
          : null
      })
      .filter((b): b is NonNullable<typeof b> => b !== null)
  }

  // Hero stats — same shape as /scope/school for cross-page consistency.
  const heroStats = [
    { value: distinctBooks.toLocaleString('en'), label: 'Challenged books' },
    { value: totalEvents.toLocaleString('en'), label: 'Documented events' },
    { value: 'PEN + ALA', label: 'Primary sources' },
  ]

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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

          <Eyebrow>Definition · Challenged books</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 max-w-[820px]">
            Challenged books, and the bans they become.
          </h1>

          <div className="max-w-[820px]">
            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-black border-b border-neutral-200 py-4">
              {heroStats.map((s) => (
                <div key={s.label}>
                  <div className="not-italic font-serif text-3xl md:text-4xl font-semibold tracking-tight text-oxblood tabular-nums">
                    {s.value}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-600">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
              {distinctBooks.toLocaleString('en')} books have been formally challenged and removed or restricted from U.S. schools and libraries — most documented by PEN America and the American Library Association.
            </p>

            <p className="mt-5 text-sm md:text-base leading-relaxed text-gray-700">
              A challenge is a formal written request to remove a book. A ban is what happens when the institution acts on that request. This catalogue records completed actions — removals and restrictions — not the attempts that were rejected.
            </p>
          </div>
        </div>
      </section>

      {/* ── Definition: challenged vs banned ─────────────────────────── */}
      <SectionShell tone="cream" eyebrow="Terminology">
        <SectionHeader
          title="What a challenge actually means"
          subtitle="Two terms that get conflated in the press but mean different things in library and school policy."
          accent="oxblood"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase text-neutral-500 mb-2">Challenge</p>
            <p className="font-serif text-lg leading-snug text-gray-900 mb-2">
              A formal written complaint to remove a book.
            </p>
            <p className="text-sm leading-relaxed text-neutral-700">
              Anyone — a parent, a board member, an advocacy group — files a request asking an institution to pull a title from circulation. The institution then reviews it. Many challenges are rejected.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase text-neutral-500 mb-2">Ban</p>
            <p className="font-serif text-lg leading-snug text-gray-900 mb-2">
              The institution acts on the complaint.
            </p>
            <p className="text-sm leading-relaxed text-neutral-700">
              The book is removed from shelves, pulled from the curriculum, restricted to certain grade levels, or moved behind the librarian&apos;s desk. Every entry on this page documents a completed action — not a rejected attempt.
            </p>
          </div>
        </div>

        <p className="mt-8 text-xs text-neutral-500 italic leading-relaxed border-l-2 border-neutral-300 pl-4 max-w-2xl">
          Our database uses <em>scope</em> (school vs. government) rather than a separate &ldquo;challenged&rdquo; status. The titles below represent the school-scope bans in our catalogue — the closest equivalent to the ALA&apos;s definition of a challenged book.{' '}
          <Link href="/methodology" className="text-oxblood hover:underline">Read the full methodology →</Link>
        </p>
      </SectionShell>

      {/* ── Top 12 most-challenged examples ──────────────────────────── */}
      {topBooks.length > 0 && (
        <SectionShell tone="white" eyebrow="Most affected titles">
          <SectionHeader
            title="The books that get challenged most"
            subtitle="Ranked by the number of documented removal or restriction events across U.S. schools."
            viewAllHref="/scope/school"
            viewAllLabel="View all 3,933 →"
            accent="oxblood"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {topBooks.map((b) => (
              <BookCardCompact key={b.id} book={b} />
            ))}
          </div>
        </SectionShell>
      )}

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <FaqSection
        items={FAQ_ITEMS}
        tone="cream"
        eyebrow="Questions readers ask"
        title="Frequently asked."
      />

      {/* ── Bottom CTAs ──────────────────────────────────────────────── */}
      <SectionShell tone="white">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/scope/school"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Full dataset</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              U.S. school bans →
            </p>
          </Link>
          <Link
            href="/scope/government"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Compare</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Government bans →
            </p>
          </Link>
          <Link
            href="/methodology"
            className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">How we built it</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Methodology →
            </p>
          </Link>
        </div>
      </SectionShell>
    </main>
  )
}
