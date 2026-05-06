import Link from 'next/link'
import { BookOpen, Globe, Search as SearchIcon, BarChart3 } from 'lucide-react'

const ITEMS = [
  { Icon: BookOpen,   title: 'Top 100 banned books', text: 'The most censored books worldwide, ranked by documented bans.', href: '/top-100-banned-books' },
  { Icon: Globe,      title: 'Countries',            text: 'See where books have been banned, restricted, or removed.',     href: '/countries' },
  { Icon: SearchIcon, title: 'Reasons',              text: 'Understand the patterns behind censorship.',                    href: '/reasons' },
  { Icon: BarChart3,  title: 'Statistics',           text: 'Trends, growth, and the global picture in numbers.',            href: '/stats' },
]

export default function CatalogueNav() {
  return (
    <nav aria-label="Explore the catalogue" className="hidden sm:block">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ITEMS.map(({ Icon, title, text, href }) => (
          <Link
            key={title}
            href={href}
            className="group flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all"
          >
            <Icon className="w-5 h-5 text-brand mb-2" />
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{title}</span>
            <span className="text-xs text-gray-600 dark:text-gray-400 leading-snug mt-1">{text}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
