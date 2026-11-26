import Link from '@/components/link'

/**
 * Seasonal hero callout for /christmas-banned-books. Same shape as the Banned
 * Books Week block (a filled panel with a chip, a title, one line and a pill
 * CTA) but in Christmas green with a gold accent. Purely date-driven: it needs
 * no DB config or content block, because the copy is static and every number
 * on the target page is read live there.
 */
export default function ChristmasCallout() {
  return (
    <Link
      href="/christmas-banned-books"
      className="group block rounded-lg border border-[#e9c46a]/60 bg-[#143626] p-5 text-white shadow-[0_1px_3px_rgba(20,54,38,0.25)] transition-shadow hover:shadow-[0_6px_18px_rgba(20,54,38,0.35)]"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e9c46a]/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#e9c46a]">
        <span aria-hidden="true">❄</span> Seasonal list
      </span>

      <p className="mt-3 text-balance font-serif text-xl font-semibold leading-tight">
        Banned Christmas Books
      </p>

      <p className="mt-1.5 text-xs leading-snug text-white/80">
        Christmas was banned in 1647. Now 40 Christmas books have been pulled from school libraries. See the
        list, the history and gift ideas from independent bookshops.
      </p>

      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#e9c46a] px-3 py-1.5 text-xs font-semibold text-[#143626]">
        See the list
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  )
}
