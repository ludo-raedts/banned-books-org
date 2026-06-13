import { type Award, awardName } from '@/lib/awards'

/**
 * Gold pill for a literary award (Nobel / Pulitzer). Used on book pages
 * (book-level Pulitzer), author pages and the book header (author-level Nobel).
 */
export default function AwardBadge({ award }: { award: Award }) {
  const icon = award.award.startsWith('Nobel') ? '🏅' : '🏆'
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      <span aria-hidden="true">{icon}</span>
      <span>
        {awardName(award)}
        <span className="text-amber-600"> · {award.year}</span>
      </span>
    </span>
  )
}
