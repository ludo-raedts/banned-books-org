import Link from '@/components/link'
import { BookOpen, Database, Newspaper, Users } from 'lucide-react'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

// A compact signpost to the four kinds of content the site offers. It used to
// be called "Use this catalogue", sat directly under Book of the day as four
// large cards, and described the site as a research instrument (search, data,
// methodology). The external reviewer (2026-11-11) asked for a smaller
// signpost below the news with a broader title and one clear entry per card.
// The hero already links countries, the top 100, essays and the reading club
// under the search field; repeating them here is deliberate — up there they are
// a quick route, here they show what the site offers.
//
// Secondary links stay small: several of these pages (podcasts, challenged
// books, classics, sources) are linked from nowhere else on the homepage.
type Lnk = { label: string; href: string }
const ENTRIES: { icon: typeof BookOpen; title: string; blurb: string; primary: Lnk; subs: Lnk[] }[] = [
  {
    icon: BookOpen,
    title: 'Explore books',
    blurb: 'Search and browse the archive by title, author, country or reason.',
    primary: { label: 'Search the archive', href: '/search' },
    subs: [
      { label: 'by reason', href: '/reasons' },
      { label: 'classics', href: '/banned-classics' },
    ],
  },
  {
    icon: Newspaper,
    title: 'Stories and history',
    blurb: 'Essays, podcasts and the long history of book censorship.',
    primary: { label: 'Read stories and essays', href: '/essays' },
    subs: [
      { label: 'history', href: '/history' },
      { label: 'timeline', href: '/timeline' },
      { label: 'podcasts', href: '/podcasts' },
    ],
  },
  {
    icon: Database,
    title: 'Data and sources',
    blurb: 'The open dataset, where our records come from and how we verify them.',
    primary: { label: 'Open the dataset', href: '/dataset' },
    subs: [
      { label: 'sources', href: '/sources' },
      { label: 'methodology', href: '/methodology' },
      { label: 'statistics', href: '/stats' },
    ],
  },
  {
    icon: Users,
    title: 'Reading club',
    blurb: 'Banned books to read together, with discussion questions.',
    primary: { label: 'Join the reading club', href: '/reading-club' },
    subs: [
      { label: 'pick a banned book', href: '/discover' },
      { label: 'challenged books', href: '/challenged-books' },
    ],
  },
]

export default function StartHereSection() {
  return (
    <SectionShell tone="cream">
      <div className="max-w-6xl mx-auto">
        <Eyebrow>Where to go next</Eyebrow>
        <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-5">
          Explore Banned Books
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ENTRIES.map(({ icon: Icon, title, blurb, primary, subs }) => (
            <div key={primary.href} className="flex flex-col rounded-xl border border-gray-200 bg-white p-3.5 md:p-4">
              <Icon className="w-5 h-5 text-oxblood mb-2" aria-hidden="true" />
              <h3 className="font-semibold text-gray-900 leading-snug">{title}</h3>
              <p className="mt-1 text-xs md:text-sm text-neutral-600 leading-snug flex-1">{blurb}</p>
              <Link href={primary.href} className="mt-2.5 text-sm font-medium text-oxblood hover:underline">
                {primary.label} →
              </Link>
              <p className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs">
                {subs.map(s => (
                  <Link key={s.href} href={s.href} className="text-neutral-600 hover:text-oxblood hover:underline">
                    {s.label}
                  </Link>
                ))}
              </p>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  )
}
