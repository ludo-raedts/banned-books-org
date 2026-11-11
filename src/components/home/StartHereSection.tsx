import Link from '@/components/link'
import { BookOpen, Database, Newspaper, Users } from 'lucide-react'
import Eyebrow from '@/components/section/Eyebrow'

// A compact signpost to the four kinds of content the site offers, in the left
// column of the homepage's top band under the book of the day (UX review
// 2026-11-11: a two-column band — book and signpost left, news right — instead
// of one wide band per block). Four tiles, two by two; one clear entry per
// tile, with a small line of secondary links. Those stay because podcasts,
// challenged books, classics and sources are linked from nowhere else on the
// homepage; "statistics" is not repeated, it is in the main navigation. The
// hero offers several of these entries directly under the search field too:
// up there they are a quick route, here they show what the site offers.
type Lnk = { label: string; href: string }
const ENTRIES: { icon: typeof BookOpen; title: string; blurb: string; primary: Lnk; subs: Lnk[] }[] = [
  {
    icon: BookOpen,
    title: 'Explore books',
    blurb: 'Search and browse by title, author, country or reason.',
    primary: { label: 'Explore books', href: '/search' },
    subs: [
      { label: 'by reason', href: '/reasons' },
      { label: 'classics', href: '/banned-classics' },
    ],
  },
  {
    icon: Newspaper,
    title: 'Stories and history',
    blurb: 'Essays, podcasts and the long history of book censorship.',
    primary: { label: 'Stories and history', href: '/essays' },
    subs: [
      { label: 'history', href: '/history' },
      { label: 'timeline', href: '/timeline' },
      { label: 'podcasts', href: '/podcasts' },
    ],
  },
  {
    icon: Database,
    title: 'Data and sources',
    blurb: 'The open dataset, our sources and how we verify them.',
    primary: { label: 'Data and sources', href: '/dataset' },
    subs: [
      { label: 'sources', href: '/sources' },
      { label: 'methodology', href: '/methodology' },
    ],
  },
  {
    icon: Users,
    title: 'Reading club',
    blurb: 'Banned books to read together, with discussion questions.',
    primary: { label: 'Explore the reading club', href: '/reading-club' },
    subs: [
      { label: 'pick a banned book', href: '/discover' },
      { label: 'challenged books', href: '/challenged-books' },
    ],
  },
]

export default function StartHereSection() {
  return (
    <div>
      <Eyebrow>Where to go next</Eyebrow>
      <h2 className="font-serif text-xl md:text-2xl font-semibold tracking-tight text-gray-900 mb-4">
        Explore Banned Books
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {ENTRIES.map(({ icon: Icon, title, blurb, primary, subs }) => (
          <div key={primary.href} className="flex flex-col rounded-lg border border-sage-border bg-sage p-3.5">
            <Icon className="w-5 h-5 text-oxblood mb-1.5" aria-hidden="true" />
            <h3 className="font-semibold leading-snug">
              <Link href={primary.href} className="text-oxblood hover:underline">
                {primary.label} →
              </Link>
            </h3>
            {/* The one-line description is for desktop; a phone shows the title
                and the secondary links only. */}
            <p className="mt-1 hidden text-xs text-neutral-700 leading-snug md:block">{blurb}</p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
              {subs.map(s => (
                <Link key={s.href} href={s.href} className="inline-block py-1 text-neutral-700 hover:text-oxblood hover:underline">
                  {s.label}
                </Link>
              ))}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
