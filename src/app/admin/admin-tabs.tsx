'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, BarChart3, BookMarked, BookOpen, FileText } from 'lucide-react'

const TABS = [
  { href: '/admin',                    label: 'Overview',       Icon: LayoutGrid },
  { href: '/admin/stats',              label: 'Stats',          Icon: BarChart3 },
  { href: '/admin/banned-books-week',  label: 'BBW',            Icon: BookMarked },
  { href: '/admin/reading-club',       label: 'Reading Club',   Icon: BookOpen },
  { href: '/admin/content-blocks',     label: 'Content blocks', Icon: FileText },
] as const

export default function AdminTabs() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 border-b border-gray-200 dark:border-gray-800 -mt-2 mb-6" aria-label="Admin sections">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? 'border-brand text-gray-900 dark:text-gray-100'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
