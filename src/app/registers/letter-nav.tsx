import Link from '@/components/link'
import { REGISTER_LETTERS, REGISTER_PAGE_SIZE, letterToSegment, pageSegment } from '@/lib/registers'

// A–Z strip for a register list. Letters without entries render muted, not as
// links. `current` highlights the open letter; `counts` drives the sub-pages.
export function LetterNav({
  slug,
  counts,
  current,
}: {
  slug: string
  counts: Map<string, number>
  current?: string
}) {
  return (
    <nav aria-label="Browse by letter" className="flex flex-wrap gap-1">
      {REGISTER_LETTERS.map((l) => {
        const n = counts.get(l) ?? 0
        const label = l === '#' ? '0–9' : l
        if (n === 0) {
          return (
            <span
              key={l}
              className="inline-flex h-9 min-w-9 items-center justify-center rounded-sm px-2 text-sm text-neutral-300"
              aria-hidden="true"
            >
              {label}
            </span>
          )
        }
        const active = current === l
        return (
          <Link
            key={l}
            href={`/registers/${slug}/${letterToSegment(l)}`}
            aria-current={active ? 'page' : undefined}
            title={`${n.toLocaleString('en-US')} entries`}
            className={`inline-flex h-9 min-w-9 items-center justify-center rounded-sm border px-2 text-sm font-medium tabular-nums transition-colors ${
              active
                ? 'border-oxblood bg-oxblood text-white'
                : 'border-neutral-200 bg-white text-gray-900 hover:border-oxblood hover:text-oxblood'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

/** "Page 1 · 2 · 3" within a letter that has more than REGISTER_PAGE_SIZE entries. */
export function PageNav({ slug, letter, total, page }: { slug: string; letter: string; total: number; page: number }) {
  const pages = Math.ceil(total / REGISTER_PAGE_SIZE)
  if (pages <= 1) return null
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-neutral-500">Part</span>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) =>
        p === page ? (
          <span key={p} aria-current="page" className="rounded-sm bg-gray-900 px-2.5 py-1 font-medium text-white tabular-nums">
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={`/registers/${slug}/${pageSegment(letter, p)}`}
            className="rounded-sm border border-neutral-200 px-2.5 py-1 tabular-nums text-gray-900 hover:border-oxblood hover:text-oxblood"
          >
            {p}
          </Link>
        ),
      )}
    </nav>
  )
}
