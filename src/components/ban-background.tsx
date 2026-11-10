import Link from '@/components/link'

// One presentation for every piece of sourced background the book page shows
// about a ban: the censorship event a ban belongs to (lib/ban-contexts), the
// institution that carried out a mass removal (lib/institution-contexts) and
// the category-level note on a challenge reason (lib/reason-explainers).
//
// These used to be three different boxes in three places (amber above the
// description, red inside "Why it was banned", slate below it), all labelled
// "context". None of them is about the book as a whole — each is background
// on some of its bans — so each item now says which bans it applies to.
// Pure presentation; matching and the applies-to line are built upstream on
// already-fetched data.
export type BanBackgroundItem = {
  key: string
  /** Small uppercase label, e.g. "Context · Monroe County Schools". */
  kicker: string
  /** Optional serif lead-in (an event's name), rendered before the body. */
  title?: string
  body: string
  /** "Applies to 2 of 15 bans: …" — omitted when it would say nothing. */
  appliesTo?: string | null
  sources?: { name: string; url: string }[]
  /** Reason explainers cite one general reference; keep that link nofollow. */
  nofollowSources?: boolean
  link?: { href: string; label: string }
}

export default function BanBackground({
  items,
  heading,
}: {
  items: BanBackgroundItem[]
  /** Section label, used where the block follows the bans table. */
  heading?: string
}) {
  if (items.length === 0) return null

  return (
    <section className="mb-8">
      {heading && (
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{heading}</h2>
      )}
      <div className="space-y-3">
        {items.map((item) => (
          <aside
            key={item.key}
            className="rounded-r-xl border-l-4 border-amber-500/70 bg-amber-50/70 pl-5 pr-4 py-4"
          >
            <p className="text-[11px] font-medium uppercase tracking-widest text-amber-700/80 mb-1.5">
              {item.kicker}
            </p>
            <p className="text-sm leading-relaxed text-gray-800">
              {item.title && (
                <>
                  <span className="font-serif font-semibold text-gray-900">{item.title}.</span>{' '}
                </>
              )}
              {item.body}
            </p>
            {item.appliesTo && (
              <p className="mt-2 text-xs font-medium text-gray-600">{item.appliesTo}</p>
            )}
            {item.sources && item.sources.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                {item.sources.length === 1 ? 'Source' : 'Sources'}:{' '}
                {item.sources.map((src, i) => (
                  <span key={src.url}>
                    {i > 0 && ', '}
                    <a
                      href={src.url}
                      target="_blank"
                      rel={item.nofollowSources ? 'nofollow noopener' : 'noopener'}
                      className="underline underline-offset-2 hover:text-gray-700"
                    >
                      {src.name}
                    </a>
                  </span>
                ))}
              </p>
            )}
            {item.link && (
              <Link
                href={item.link.href}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-oxblood underline underline-offset-2 decoration-oxblood/30 hover:decoration-oxblood"
              >
                {item.link.label} <span aria-hidden="true">→</span>
              </Link>
            )}
          </aside>
        ))}
      </div>
    </section>
  )
}

type LabelBan = {
  institution: string | null
  region: string | null
  year_started: number | null
  countries: { name_en: string } | null
}

/**
 * "Applies to 2 of 15 bans: New Braunfels ISD (2025), Pilot Point ISD (2025)".
 * Counts are ban rows, the same unit as the hero's "15 documented bans".
 * Null when there is nothing to tell apart: a single-ban book, or no ban the
 * item could be tied to (e.g. an editorial slug match).
 */
export function appliesToLabel(matched: LabelBan[], totalBans: number): string | null {
  if (totalBans <= 1 || matched.length === 0) return null
  if (matched.length === totalBans) return `Applies to all ${totalBans} bans.`
  // One label per place, its years folded together: "Escambia County Public
  // Schools (2023, 2025)", not the same district twice.
  const yearsByPlace = new Map<string, Set<number>>()
  for (const b of matched) {
    const where = b.institution ?? b.countries?.name_en ?? b.region
    if (!where) continue
    const years = yearsByPlace.get(where) ?? new Set<number>()
    if (b.year_started) years.add(b.year_started)
    yearsByPlace.set(where, years)
  }
  const labels = [...yearsByPlace.entries()].map(([where, years]) =>
    years.size > 0 ? `${where} (${[...years].sort((x, y) => x - y).join(', ')})` : where,
  )
  const shown = labels.slice(0, 3).join(', ')
  const rest = labels.length - 3
  const tail = shown ? `: ${shown}${rest > 0 ? ` and ${rest} more` : ''}` : ''
  return `Applies to ${matched.length} of ${totalBans} bans${tail}`
}
