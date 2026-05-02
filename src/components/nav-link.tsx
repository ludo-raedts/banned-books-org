'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/' && pathname.startsWith(href))
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
        active
          ? 'text-brand font-medium underline decoration-brand decoration-2 underline-offset-4'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </Link>
  )
}
