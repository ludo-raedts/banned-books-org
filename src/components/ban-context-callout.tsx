import Link from 'next/link'
import type { BanContext } from '@/lib/ban-contexts'

// Surfaces the historical/legal context behind a book's ban, drawn from the
// ban-context registry. For an obscure title with little metadata this is often
// the most substantive thing on the page — and it's grounded, not generated.
// Pure presentation; the matching happens upstream on already-fetched data.
export default function BanContextCallout({ contexts }: { contexts: BanContext[] }) {
  if (contexts.length === 0) return null

  return (
    <div className="mb-8 space-y-3">
      {contexts.map((ctx) => (
        <aside
          key={ctx.slug}
          className="rounded-r-xl border-l-4 border-amber-500/70 bg-amber-50/70 pl-5 pr-4 py-4"
        >
          <p className="text-[11px] font-medium uppercase tracking-widest text-amber-700/80 mb-1.5">
            Part of a known censorship event · {ctx.badge}
          </p>
          <p className="text-sm leading-relaxed text-gray-800">
            <span className="font-serif font-semibold text-gray-900">{ctx.title}.</span>{' '}
            {ctx.short}
          </p>
          {ctx.hasHub && (
            <Link
              href={`/contexts/${ctx.slug}`}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-oxblood underline underline-offset-2 decoration-oxblood/30 hover:decoration-oxblood"
            >
              About {ctx.title} <span aria-hidden="true">→</span>
            </Link>
          )}
        </aside>
      ))}
    </div>
  )
}
