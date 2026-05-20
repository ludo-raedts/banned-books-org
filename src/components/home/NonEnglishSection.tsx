import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import BookCardCompact from './BookCardCompact'
import type { TopListBook } from '@/components/top-list-card'

export default function NonEnglishSection({ books }: { books: TopListBook[] }) {
  if (books.length === 0) return null
  return (
    <SectionShell tone="cream" eyebrow="The international half">
      <SectionHeader
        title="Banned books not written in English"
        subtitle="Translated, transliterated, suppressed."
        viewAllHref="/non-english-banned-books"
        viewAllLabel="View top 50"
        accent="oxblood"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {books.slice(0, 3).map(book => (
          <BookCardCompact key={book.id} book={book} />
        ))}
      </div>
    </SectionShell>
  )
}
