const REASONS: Record<string, { label: string; icon: string; classes: string }> = {
  lgbtq:     { label: 'LGBTQ+',    icon: '🏳️‍🌈', classes: 'bg-pink-100 text-pink-700' },
  political: { label: 'Political', icon: '✊',     classes: 'bg-blue-100 text-blue-700' },
  religious: { label: 'Religious', icon: '✝',      classes: 'bg-amber-100 text-amber-800' },
  sexual:    { label: 'Sexual',    icon: '🔞',     classes: 'bg-red-100 text-red-700' },
  violence:  { label: 'Violence',  icon: '⚡',     classes: 'bg-orange-100 text-orange-700' },
  racial:    { label: 'Racial',    icon: '✊🏾',    classes: 'bg-purple-100 text-purple-700' },
  drugs:     { label: 'Drugs',     icon: '💊',     classes: 'bg-green-100 text-green-700' },
  other:     { label: 'Other',     icon: '•',      classes: 'bg-gray-100 text-gray-600' },
}

export function reasonLabel(slug: string) {
  return REASONS[slug]?.label ?? slug
}

export function reasonIcon(slug: string) {
  return REASONS[slug]?.icon ?? '•'
}

export default function ReasonBadge({ slug }: { slug: string }) {
  const r = REASONS[slug] ?? REASONS.other
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${r.classes}`}>
      <span aria-hidden="true">{r.icon}</span>
      {r.label}
    </span>
  )
}
