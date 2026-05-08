import Link from 'next/link'
import { BookOpen, Globe, Search as SearchIcon, BarChart3, BookMarked } from 'lucide-react'
import { BANNED_BOOKS_WEEK, isBannedBooksWeekActive } from '@/config/banned-books-week'
import { getPublishedBlockHtml } from '@/lib/content-blocks'

const DEFAULT_ITEMS = [
  { Icon: BookOpen,   title: 'Top 100 banned books', text: 'The most censored books worldwide, ranked by documented bans.', href: '/top-100-banned-books' },
  { Icon: Globe,      title: 'Countries',            text: 'See where books have been banned, restricted, or removed.',     href: '/countries' },
  { Icon: SearchIcon, title: 'Reasons',              text: 'Understand the patterns behind censorship.',                    href: '/reasons' },
  { Icon: BarChart3,  title: 'Statistics',           text: 'Trends, growth, and the global picture in numbers.',            href: '/stats' },
]

// Server component — runs once per homepage render. Swaps the Top-100 tile for
// a Banned Books Week tile when the config window is active AND the tile
// tagline content block is published.
export default async function CatalogueNav() {
  const items = [...DEFAULT_ITEMS]

  if (isBannedBooksWeekActive()) {
    const tagline = await getPublishedBlockHtml('bbw-tile-tagline')
    if (tagline) {
      // Strip outer <p> wrap from the rendered tagline so it sits in the tile
      // text slot without nested block elements.
      const text = stripOuterParagraph(tagline)
      items[0] = {
        Icon: BookMarked,
        title: `Banned Books Week ${BANNED_BOOKS_WEEK.year}`,
        text,
        href: '/banned-books-week',
      }
    }
  }

  return (
    <nav aria-label="Explore the catalogue" className="hidden sm:block">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(({ Icon, title, text, href }) => {
          const isBBW = href === '/banned-books-week'
          return (
            <Link
              key={title}
              href={href}
              className={`group flex flex-col bg-white dark:bg-gray-900 border rounded-lg p-4 hover:shadow-sm transition-all ${
                isBBW
                  ? 'border-brand/40 hover:border-brand/70'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Icon className="w-5 h-5 text-brand mb-2" />
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{title}</span>
              <span className="text-xs text-gray-600 dark:text-gray-400 leading-snug mt-1">{text}</span>
              {isBBW && (
                <span className="text-[11px] text-brand mt-2 group-hover:underline">Learn more →</span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// Strip a single outer <p>...</p> wrap so the tagline can sit inline in the
// tile copy slot. The tagline brief asks for plain prose; this is a defensive
// fallback for editors who write a single paragraph.
function stripOuterParagraph(html: string): string {
  const trimmed = html.trim()
  const m = /^<p>([\s\S]*?)<\/p>$/i.exec(trimmed)
  return m ? m[1] : trimmed
}
