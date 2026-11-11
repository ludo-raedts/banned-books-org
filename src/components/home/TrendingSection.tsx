import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import BookCardCompact from './BookCardCompact'
import type { TopListBook } from '@/components/top-list-card'

// One compact row of covers. The row used to be three large covers per row on
// desktop (~300px each), so six books filled a whole screen. The external UX
// review (2026-11-11) asked for a compact row; five and six per row were both
// put on a preview and five was chosen — the cards keep room for a two-line
// title. Phones show two per row and tablets three, so six books fill those
// grids evenly; the five-wide desktop row drops the sixth rather than leave it
// alone on a line.
//
// The subtitle names the criterion: the count under each cover describes the
// record, it is not what ranks the book here.
export default function TrendingSection({ books }: { books: TopListBook[] }) {
  if (books.length === 0) return null
  return (
    <SectionShell tone="cream" eyebrow="Top-lists · Updated daily">
      <SectionHeader
        title="Trending this week"
        subtitle="Most-read book pages in the last 7 days."
        viewAllHref="/trending-banned-books"
        viewAllLabel="View top 50"
        accent="oxblood"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {books.slice(0, 6).map((book, i) => (
          <div key={book.id} className={i === 5 ? 'lg:hidden' : undefined}>
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
