import Link from '@/components/link'
import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import BookCardCompact from './BookCardCompact'
import type { TopListBook } from '@/components/top-list-card'

export type ReasonBlock = {
  reasonSlug: string
  reasonLabel: string
  description: string
  /** Only the featured reason carries books; the others are links. */
  books: TopListBook[]
}

const REASON_DESCRIPTIONS: Record<string, string> = {
  lgbtq: 'Identity, queerness, family.',
  sexual: 'Explicit content and obscenity claims.',
  political: 'Dissent, regime criticism, ideology.',
  religious: 'Heresy, blasphemy, doctrinal challenge.',
  racial: 'Race, slavery, civil-rights history.',
}

export function withReasonDescriptions(
  blocks: { reasonSlug: string; reasonLabel: string; books: TopListBook[] }[],
): ReasonBlock[] {
  return blocks.map(b => ({
    ...b,
    description: REASON_DESCRIPTIONS[b.reasonSlug] ?? '',
  }))
}

// Five reasons as one compact overview, and ONE row of covers for the reason
// featured this week. It used to be five rows of three large covers, which made
// this the longest block on the page (UX review 2026-11-11). Every reason keeps
// its own link; the featured one rotates weekly (see page.tsx).
export default function WhyBooksGetBannedSection({
  blocks,
  featuredSlug,
}: {
  blocks: ReasonBlock[]
  featuredSlug: string
}) {
  if (blocks.length === 0) return null
  const featured = blocks.find(b => b.reasonSlug === featuredSlug)
  return (
    <SectionShell tone="white" eyebrow="Editorial breakdown">
      <SectionHeader
        title="Why books get banned"
        // "Recorded or assigned": a source states some reasons; most are our
        // reading of the book's content. A title that said the reasons "drive"
        // bans claimed more than the data records.
        subtitle="Reasons named by sources or assigned from a book's content. Each opens its own list."
        viewAllHref="/reasons"
        viewAllLabel="All reasons"
        accent="black"
      />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {blocks.map(block => {
          const isFeatured = block.reasonSlug === featuredSlug
          return (
            <li
              key={block.reasonSlug}
              className={`rounded-sm border p-3 ${isFeatured ? 'border-oxblood bg-brand-light/40' : 'border-neutral-200'}`}
            >
              <Link
                href={`/reasons/${block.reasonSlug}`}
                className="inline-flex items-center px-2 py-1 border border-oxblood text-oxblood bg-white rounded-sm text-[10px] tracking-[0.12em] font-semibold uppercase hover:bg-oxblood hover:text-white transition-colors"
              >
                {block.reasonLabel}
              </Link>
              {block.description && (
                <p className="mt-2 text-xs text-neutral-700 leading-snug">{block.description}</p>
              )}
              <Link
                href={`/reasons/${block.reasonSlug}`}
                className="mt-2 inline-block text-xs font-medium text-oxblood hover:underline"
              >
                See all →
              </Link>
            </li>
          )
        })}
      </ul>

      {featured && featured.books.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-neutral-700">
            <span className="font-medium text-neutral-900">Featured this week: {featured.reasonLabel}.</span>{' '}
            A selection of the most documented titles.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {featured.books.slice(0, 6).map((book, i) => (
              // Phones show four (two rows of two), tablets six, desktop five.
              <div key={book.id} className={i === 4 ? 'hidden sm:block' : i === 5 ? 'hidden sm:block lg:hidden' : undefined}>
                <BookCardCompact
                  book={book}
                  dense
                  sizes="(min-width: 1024px) 180px, (min-width: 640px) 30vw, 45vw"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionShell>
  )
}
