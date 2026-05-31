import Link from 'next/link'
import type { Essay } from '@/lib/essays-data'

export default function EssayCard({ essay, compact = false }: { essay: Essay; compact?: boolean }) {
  return (
    <Link
      href={essay.href}
      className="group block rounded-xl border border-gray-200 p-5 hover:border-brand/40 hover:bg-gray-50/50 transition-colors h-full"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-brand/70 mb-2">
        Essay · {essay.readingTimeMin} min read
      </p>
      <h3 className={`font-bold text-gray-900 leading-tight mb-2 group-hover:text-brand transition-colors ${compact ? 'text-base' : 'text-lg'}`}>
        {essay.title}
      </h3>
      <p className={`text-gray-600 leading-relaxed ${compact ? 'text-xs line-clamp-3' : 'text-sm'}`}>
        {essay.dek}
      </p>
    </Link>
  )
}
