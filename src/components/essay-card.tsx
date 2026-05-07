import Link from 'next/link'
import type { Essay } from '@/lib/essays-data'

export default function EssayCard({ essay, compact = false }: { essay: Essay; compact?: boolean }) {
  return (
    <Link
      href={essay.href}
      className="group block rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-brand/40 dark:hover:border-brand/40 hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-colors h-full"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-brand/70 dark:text-brand/60 mb-2">
        Essay · {essay.readingTimeMin} min read
      </p>
      <h3 className={`font-bold text-gray-900 dark:text-gray-100 leading-tight mb-2 group-hover:text-brand dark:group-hover:text-brand transition-colors ${compact ? 'text-base' : 'text-lg'}`}>
        {essay.title}
      </h3>
      <p className={`text-gray-600 dark:text-gray-400 leading-relaxed ${compact ? 'text-xs line-clamp-3' : 'text-sm'}`}>
        {essay.dek}
      </p>
    </Link>
  )
}
