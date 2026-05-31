import Link from 'next/link'
import EssayCard from './essay-card'
import { otherEssays } from '@/lib/essays-data'

export default function MoreEssays({ currentSlug }: { currentSlug: string }) {
  const others = otherEssays(currentSlug, 3)
  if (others.length === 0) return null

  return (
    <section className="mt-16 pt-10 border-t border-gray-200">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-900">More essays</h2>
        <Link
          href="/essays"
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          All essays →
        </Link>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {others.map(essay => (
          <li key={essay.slug}>
            <EssayCard essay={essay} compact />
          </li>
        ))}
      </ul>
    </section>
  )
}
