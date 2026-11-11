import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import BookCardCompact from './BookCardCompact'
import type { TopListBook } from '@/components/top-list-card'

// The selection is by the language a work was ORIGINALLY written in. The old title,
// "Banned books not written in English", read as being about the edition on
// the cover, and an English translation on a cover looked like a mistake
// (UX review 2026-11-11). Same compact row as Trending.
export default function NonEnglishSection({ books }: { books: TopListBook[] }) {
  if (books.length === 0) return null
  return (
    <SectionShell tone="cream" eyebrow="Beyond English">
      <SectionHeader
        title="Banned books originally written in other languages"
        subtitle="Originally written in a language other than English. Covers and titles may show translations."
        viewAllHref="/non-english-banned-books"
        viewAllLabel="View top 50"
        accent="oxblood"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {books.slice(0, 6).map((book, i) => (
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
    </SectionShell>
  )
}
