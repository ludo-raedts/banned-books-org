import Link from 'next/link'
import {
  TopListBookCard,
  TopListAuthorCard,
  type TopListBook,
  type TopListAuthor,
} from './top-list-card'

type SectionProps = {
  title: string
  subtitle?: string
  viewAllHref?: string
  viewAllLabel?: string
}

// Grid: mobile 1 col (list rows), tablet 3 col, desktop 5 col. Items beyond
// the 5th are wrapped in a hidden-on-mobile shell so the list shows 5 on
// phones and 10 on >= sm. `hidden sm:contents` keeps the wrapped child as a
// transparent grid item on larger screens.
function GridShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {children}
    </div>
  )
}

function ItemSlot({ index, children }: { index: number; children: React.ReactNode }) {
  if (index < 5) return <>{children}</>
  return <div className="hidden sm:contents">{children}</div>
}

function SectionHeader({ title, subtitle, viewAllHref, viewAllLabel }: SectionProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="shrink-0 text-sm text-gray-500 dark:text-gray-400 hover:text-brand dark:hover:text-brand transition-colors whitespace-nowrap"
        >
          {viewAllLabel ?? 'View all'} →
        </Link>
      )}
    </div>
  )
}

export function TopListBooksSection({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel,
  books,
}: SectionProps & { books: TopListBook[] }) {
  if (books.length === 0) return null
  return (
    <section>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        viewAllHref={viewAllHref}
        viewAllLabel={viewAllLabel}
      />
      <GridShell>
        {books.slice(0, 10).map((book, i) => (
          <ItemSlot key={book.id} index={i}>
            <TopListBookCard book={book} />
          </ItemSlot>
        ))}
      </GridShell>
    </section>
  )
}

export function TopListAuthorsSection({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel,
  authors,
}: SectionProps & { authors: TopListAuthor[] }) {
  if (authors.length === 0) return null
  return (
    <section>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        viewAllHref={viewAllHref}
        viewAllLabel={viewAllLabel}
      />
      <GridShell>
        {authors.slice(0, 10).map((author, i) => (
          <ItemSlot key={author.id} index={i}>
            <TopListAuthorCard author={author} />
          </ItemSlot>
        ))}
      </GridShell>
    </section>
  )
}

// Reason grid: 5 sub-sections (one per reason), each with 3 books. The
// outer grid is single-col through `md` and 5-col at `lg+`. Inside each
// reason, books are laid out as a horizontal 3-card sub-grid on `sm`+
// (matching the vertical card geometry of the Trending/Rising rows above
// at the same breakpoints) and as a vertical stack at `lg+` (since the
// reason column is then narrow). This keeps card width consistent with
// the other top-list sections at every breakpoint — was visibly off on
// iPad when the outer was a 2-col grid.
export function TopListByReasonSection({
  title,
  subtitle,
  blocks,
}: SectionProps & {
  blocks: { reasonSlug: string; reasonLabel: string; books: TopListBook[] }[]
}) {
  if (blocks.every(b => b.books.length === 0)) return null
  return (
    <section>
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-4 gap-y-6">
        {blocks.map(block => (
          <div key={block.reasonSlug} className="min-w-0">
            <Link
              href={`/reasons/${block.reasonSlug}`}
              className="block mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-brand dark:hover:text-brand transition-colors"
            >
              {block.reasonLabel} →
            </Link>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 lg:gap-2">
              {block.books.slice(0, 3).map(book => (
                <TopListBookCard key={book.id} book={book} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
