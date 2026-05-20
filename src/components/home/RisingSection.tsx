import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import RisingCard, { type RisingBook } from './RisingCard'

export default function RisingSection({ books }: { books: RisingBook[] }) {
  if (books.length === 0) return null
  return (
    <SectionShell tone="cream" eyebrow="Surfacing now">
      <SectionHeader
        title="Rising this week"
        subtitle="Biggest week-over-week jump in readership."
        viewAllHref="/rising-banned-books"
        viewAllLabel="View top 50"
        accent="oxblood"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {books.slice(0, 6).map(book => (
          <RisingCard key={book.id} book={book} />
        ))}
      </div>
    </SectionShell>
  )
}
