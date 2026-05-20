import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import BookCardCompact from './BookCardCompact'
import type { TopListBook } from '@/components/top-list-card'

export default function TrendingSection({ books }: { books: TopListBook[] }) {
  if (books.length === 0) return null
  return (
    <SectionShell tone="cream" eyebrow="Top-lists · Updated daily">
      <SectionHeader
        title="Trending this week"
        subtitle="Most-read titles in the last 7 days."
        viewAllHref="/trending-banned-books"
        viewAllLabel="View top 50"
        accent="oxblood"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        {books.slice(0, 6).map(book => (
          <BookCardCompact key={book.id} book={book} />
        ))}
      </div>
    </SectionShell>
  )
}
