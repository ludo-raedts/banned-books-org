import Link from 'next/link'
import AuthorAvatar from '@/components/author-avatar'
import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import type { TopListAuthor } from '@/components/top-list-card'

export default function MostBannedAuthorsSection({ authors }: { authors: TopListAuthor[] }) {
  if (authors.length === 0) return null
  return (
    <SectionShell tone="white" eyebrow="Catalogue-wide">
      <SectionHeader
        title="Most banned authors"
        subtitle="Writers censored across the most jurisdictions."
        viewAllHref="/most-banned-authors"
        viewAllLabel="View top 50"
        accent="black"
      />
      <div className="grid grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-6">
        {authors.slice(0, 10).map((author, i) => (
          <Link
            key={author.id}
            href={`/authors/${author.slug}`}
            className={`group flex flex-col items-center text-center ${i >= 6 ? 'hidden md:flex' : ''}`}
          >
            <div className="hover-avatar rounded-full bg-white" style={{ boxShadow: '0 0 0 1px rgba(92,16,16,0.25)' }}>
              <AuthorAvatar
                name={author.display_name}
                photoUrl={author.photo_url}
                className="w-14 h-14 md:w-[78px] md:h-[78px] rounded-full object-cover ring-2 ring-white"
                initialsClassName="w-14 h-14 md:w-[78px] md:h-[78px] rounded-full ring-2 ring-white bg-oxblood/10 text-oxblood flex items-center justify-center text-base md:text-lg font-semibold tracking-tight"
                sizes="(min-width: 768px) 78px, 56px"
              />
            </div>
            <div className="mt-2 text-xs font-semibold text-gray-900 dark:text-gray-50 line-clamp-2 leading-snug group-hover:text-oxblood transition-colors">
              {author.display_name}
            </div>
            {author.context && (
              <div className="mt-0.5 text-[10px] text-neutral-600 dark:text-gray-400 line-clamp-2 leading-snug">
                {author.context}
              </div>
            )}
          </Link>
        ))}
      </div>
    </SectionShell>
  )
}
