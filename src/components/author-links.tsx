import { Globe } from 'lucide-react'

// Visible link row for the author hero. Renders the author's official website
// and human-facing social profiles (X / Instagram / Facebook). VIAF and the
// Wikidata entity are deliberately NOT shown here — they live only in the
// Person JSON-LD `sameAs` (authority signals for crawlers, not buttons for
// readers). Data is sourced from Wikidata (CC-0); see
// scripts/enrich-author-links.ts.
//
// lucide-react dropped brand icons (trademark), so X/Instagram/Facebook use
// small inline SVG marks. Outbound links are noopener/noreferrer; no nofollow —
// these are legitimate authoritative links to the author's own presence.

const VISIBLE_SOCIAL: Array<{ key: string; label: string }> = [
  { key: 'twitter', label: 'X' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'substack', label: 'Substack' },
]

function SocialGlyph({ platform }: { platform: string }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false } as const
  if (platform === 'twitter') {
    return (
      <svg {...common} fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )
  }
  if (platform === 'instagram') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    )
  }
  if (platform === 'youtube') {
    return (
      <svg {...common} fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    )
  }
  if (platform === 'substack') {
    return (
      <svg {...common} fill="currentColor">
        <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
      </svg>
    )
  }
  // facebook
  return (
    <svg {...common} fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

export default function AuthorLinks({
  websiteUrl,
  socialLinks,
}: {
  websiteUrl: string | null
  socialLinks: Record<string, string> | null
}) {
  const social = VISIBLE_SOCIAL
    .map(s => ({ ...s, url: socialLinks?.[s.key] }))
    .filter((s): s is { key: string; label: string; url: string } => !!s.url)

  if (!websiteUrl && social.length === 0) return null

  const linkClass =
    'inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors'

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
      {websiteUrl && (
        <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <Globe className="w-4 h-4" aria-hidden />
          Website
        </a>
      )}
      {social.map(s => (
        <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label} className={linkClass}>
          <SocialGlyph platform={s.key} />
          {s.label}
        </a>
      ))}
    </div>
  )
}
