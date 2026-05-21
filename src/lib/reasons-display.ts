// Reason → hex color map for the v2 design surfaces. Used by the homepage
// Book-of-the-day reason pills, the hero callout, and (eventually) the
// reasons listing surfaces.
//
// The hexes are intentionally muted — they're consumed as small 8px dots
// next to a label, where saturated colors would scream. Keep in sync with
// the reasons table; unknown slugs fall back to `other`.

export const REASON_COLORS: Record<string, string> = {
  political: '#f4d03f',
  racial: '#a085c0',
  sexual: '#e89090',
  religious: '#80a0c0',
  lgbtq: '#d49890',
  language: '#80a0c0',
  violence: '#888888',
  obscenity: '#c08070',
  drugs: '#90a080',
  blasphemy: '#a08070',
  moral: '#90b0a0',
  other: '#a0a0a0',
}

export function reasonColor(slug: string): string {
  return REASON_COLORS[slug] ?? REASON_COLORS.other
}
