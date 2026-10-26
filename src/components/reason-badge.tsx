const REASONS: Record<string, { label: string; icon: string; classes: string }> = {
  lgbtq:     { label: 'LGBTQ+',    icon: '🏳️‍🌈', classes: 'bg-pink-100 text-pink-700' },
  political: { label: 'Political', icon: '✊',     classes: 'bg-blue-100 text-blue-700' },
  religious: { label: 'Religious', icon: '✝',      classes: 'bg-amber-100 text-amber-800' },
  sexual:    { label: 'Sexual',    icon: '🔞',     classes: 'bg-red-100 text-red-700' },
  violence:  { label: 'Violence',  icon: '⚡',     classes: 'bg-orange-100 text-orange-700' },
  racial:    { label: 'Racial',    icon: '✊🏾',    classes: 'bg-purple-100 text-purple-700' },
  drugs:     { label: 'Drugs',     icon: '💊',     classes: 'bg-green-100 text-green-700' },
  obscenity: { label: 'Obscenity', icon: '🚫',     classes: 'bg-rose-100 text-rose-700' },
  moral:     { label: 'Moral',     icon: '⚖️',     classes: 'bg-teal-100 text-teal-700' },
  language:  { label: 'Language',  icon: '🗣️',     classes: 'bg-indigo-100 text-indigo-700' },
  other:     { label: 'Other',     icon: '•',      classes: 'bg-gray-100 text-gray-600' },
}

export function reasonLabel(slug: string) {
  return REASONS[slug]?.label ?? slug
}

export function reasonIcon(slug: string) {
  return REASONS[slug]?.icon ?? '•'
}

// `inferred`: the reason was classified from the book's themes, not stated by
// the ban's source (ban_reason_links.basis = 'inferred') — rendered as a dashed,
// muted outline so it never reads as the ban's recorded reason.
export default function ReasonBadge({ slug, inferred = false }: { slug: string; inferred?: boolean }) {
  const r = REASONS[slug] ?? REASONS.other
  if (inferred) {
    return (
      <span
        title="Inferred from the book's content — not stated by the source"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-dashed border-gray-300 text-gray-500"
      >
        <span aria-hidden="true" className="opacity-60">{r.icon}</span>
        {r.label}
        <span className="sr-only"> (inferred)</span>
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${r.classes}`}>
      <span aria-hidden="true">{r.icon}</span>
      {r.label}
    </span>
  )
}
