'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, BarChart3, BookMarked, BookOpen, FileText } from 'lucide-react'

// Each tab carries an optional `shortLabel` shown on small screens, so the
// nav fits roughly 5 tabs in ~360px without horizontal scroll. The full
// label is restored at sm: breakpoints. The wrapper is also overflow-x-auto
// as a safety net — narrower viewports can still scroll the row.

const TABS = [
  { href: '/admin',                    label: 'Overview',       shortLabel: 'Home',  Icon: LayoutGrid },
  { href: '/admin/stats',              label: 'Stats',          shortLabel: 'Stats', Icon: BarChart3 },
  { href: '/admin/banned-books-week',  label: 'BBW',            shortLabel: 'BBW',   Icon: BookMarked },
  { href: '/admin/reading-club',       label: 'Reading Club',   shortLabel: 'Club',  Icon: BookOpen },
  { href: '/admin/content-blocks',     label: 'Content blocks', shortLabel: 'Blocks', Icon: FileText },
] as const

export default function AdminTabs() {
  const pathname = usePathname()

  return (
    <nav
      className="flex gap-0.5 sm:gap-1 border-b border-gray-200 -mt-2 mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Admin sections"
    >
      {TABS.map(({ href, label, shortLabel, Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
              active
                ? 'border-brand text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden />
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
