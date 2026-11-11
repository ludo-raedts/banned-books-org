import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import BookCardCompact from './BookCardCompact'
import type { TopListBook } from '@/components/top-list-card'

// Cover-size trial (UX review 2026-11-11, step 6). The row used to be three
// large covers per row on desktop (~300px each): two rows of three filled a
// whole screen with six books. The reviewer asked for a compact row and to try
// five and six per row at real size. Phones keep two per row, tablets three.
//
// `perRow` picks the desktop grid; `previewLabel` marks a variant on the
// preview branch only — it must not reach main.
export default function TrendingSection({
  books,
  perRow = 6,
  previewLabel,
}: {
  books: TopListBook[]
  perRow?: 5 | 6
  previewLabel?: string
}) {
  if (books.length === 0) return null
  // Tailwind needs the class names spelled out; no string building.
  const grid = perRow === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-6'
  return (
    <SectionShell tone="cream" eyebrow="Top-lists · Updated daily">
      {previewLabel && (
        <p className="mb-3 inline-block rounded-sm border border-dashed border-oxblood/50 bg-white px-2 py-1 text-xs font-medium text-oxblood">
          {previewLabel}
        </p>
      )}
      <SectionHeader
        title="Trending this week"
        subtitle="Most-read book pages in the last 7 days."
        viewAllHref="/trending-banned-books"
        viewAllLabel="View top 50"
        accent="oxblood"
      />
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${grid} gap-3`}>
        {books.slice(0, 6).map((book, i) => (
          // Six books fill two-per-row and three-per-row evenly; the five-wide
          // desktop row drops the sixth rather than leave it alone on a line.
          <div key={book.id} className={perRow === 5 && i === 5 ? 'lg:hidden' : undefined}>
            <BookCardCompact
              book={book}
              dense
              sizes="(min-width: 1024px) 180px, (min-width: 640px) 30vw, 45vw"
            />
          </div>
        ))}
      </div>
    </SectionShell>
  )
}
