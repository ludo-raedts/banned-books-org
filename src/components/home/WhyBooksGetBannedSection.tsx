import Link from 'next/link'
import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import BookCardCompact from './BookCardCompact'
import type { TopListBook } from '@/components/top-list-card'

export type ReasonBlock = {
  reasonSlug: string
  reasonLabel: string
  description: string
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

export default function WhyBooksGetBannedSection({ blocks }: { blocks: ReasonBlock[] }) {
  if (blocks.every(b => b.books.length === 0)) return null
  return (
    <SectionShell tone="white" eyebrow="Editorial breakdown">
      <SectionHeader
        title="Why books get banned"
        subtitle="The five reasons that drive most documented bans."
        viewAllHref="/reasons"
        viewAllLabel="All reasons"
        accent="black"
      />
      <div className="space-y-6">
        {blocks.map(block => {
          if (block.books.length === 0) return null
          return (
            <div key={block.reasonSlug} className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-7">
              <div className="sm:w-[140px] sm:shrink-0">
                <Link
                  href={`/reasons/${block.reasonSlug}`}
                  className="inline-flex items-center px-2 py-1 border border-oxblood text-oxblood bg-white rounded-sm text-[10px] tracking-[0.12em] font-semibold uppercase hover:bg-oxblood hover:text-white transition-colors"
                >
                  {block.reasonLabel}
                </Link>
                {block.description && (
                  <p className="mt-2 text-xs text-neutral-600 leading-snug">
                    {block.description}
                  </p>
                )}
                <Link
                  href={`/reasons/${block.reasonSlug}`}
                  className="mt-2 inline-block text-xs font-medium text-oxblood hover:underline"
                >
                  See all →
                </Link>
              </div>

              <div className="flex-1 grid grid-cols-3 gap-3">
                {block.books.slice(0, 3).map(book => (
                  <BookCardCompact
                    key={book.id}
                    book={book}
                    sizes="(min-width: 1024px) 140px, (min-width: 640px) 22vw, 30vw"
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </SectionShell>
  )
}
