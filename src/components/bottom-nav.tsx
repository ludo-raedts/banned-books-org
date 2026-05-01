'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'Books', icon: '📕' },
  { href: '/countries', label: 'Countries', icon: '🌍' },
  { href: '/news', label: 'News', icon: '📰' },
  { href: '/reasons', label: 'Reasons', icon: '⚖️' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 flex pb-safe">
      {NAV_ITEMS.map(item => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
              active
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className={`text-[10px] font-medium tracking-tight ${active ? 'text-gray-900 dark:text-gray-100' : ''}`}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
