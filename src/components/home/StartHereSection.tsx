import Link from '@/components/link'
import { Search, Database, GraduationCap, BookOpen } from 'lucide-react'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

// Intent-based entry points ("use this catalogue") — signposts the four main
// audiences. Cards 3 and 4 are content CLUSTERS, so each card is a mini-hub:
// a primary CTA plus a few secondary links that surface the real breadth.
// Pure navigation to existing pages; no new content. The hero already links
// countries, the top 100, essays and the reading club directly under the search
// field, so those are not repeated here (UX review 2026-11-11).
type Lnk = { label: string; href: string }
const CARDS: { icon: typeof Search; title: string; blurb: string; primary: Lnk; subs: Lnk[] }[] = [
  {
    icon: Search,
    title: 'Research a book or author',
    blurb: 'Search the catalogue — every entry carries country-by-country bans and source citations.',
    primary: { label: 'Search', href: '/search' },
    subs: [{ label: 'by reason', href: '/reasons' }],
  },
  {
    icon: Database,
    title: 'Use the data',
    blurb: 'A free, citeable CSV/JSON/SQLite dataset of book bans worldwide, with a permanent DOI.',
    primary: { label: 'Open the dataset', href: '/dataset' },
    subs: [
      { label: 'statistics', href: '/stats' },
      { label: 'sources', href: '/sources' },
    ],
  },
  {
    icon: GraduationCap,
    title: 'Teach & understand censorship',
    blurb: 'How we define a ban, what the data covers, and the context.',
    primary: { label: 'Methodology', href: '/methodology' },
    subs: [
      { label: 'podcasts', href: '/podcasts' },
      { label: 'history', href: '/history' },
      { label: 'timeline', href: '/timeline' },
      { label: 'challenged books', href: '/challenged-books' },
    ],
  },
  {
    icon: BookOpen,
    title: 'Find something to read',
    blurb: 'Discover a banned book at random, or follow a curated path.',
    primary: { label: 'Pick a banned book', href: '/discover' },
    subs: [
      { label: 'classics', href: '/banned-classics' },
    ],
  },
]

export default function StartHereSection() {
  return (
    <SectionShell tone="cream" seamless>
      <div className="max-w-6xl mx-auto">
        <Eyebrow>Start here</Eyebrow>
        <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6">
          Use this catalogue
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CARDS.map(({ icon: Icon, title, blurb, primary, subs }) => (
            <div
              key={primary.href}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 md:p-5"
            >
              <Icon className="w-5 h-5 text-oxblood mb-2" aria-hidden="true" />
              <h3 className="font-semibold text-gray-900 leading-snug mb-1.5">{title}</h3>
              <p className="text-sm text-neutral-600 leading-relaxed flex-1">{blurb}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Link href={primary.href} className="font-medium text-oxblood hover:underline">
                  {primary.label} →
                </Link>
                {subs.map((s) => (
                  <span key={s.href} className="flex items-center gap-x-2">
                    <span className="text-neutral-300" aria-hidden="true">·</span>
                    <Link href={s.href} className="text-neutral-500 hover:text-oxblood hover:underline">
                      {s.label}
                    </Link>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  )
}
