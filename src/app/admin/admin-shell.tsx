'use client'

// Global admin chrome: a persistent top bar with brand, section nav, and Sign
// out, rendered on every /admin/* page via the layout. Replaces the partial
// AdminTabs (which only listed 5 sections and only appeared on a few pages) and
// the dashboard-only Sign out button. The login page renders bare (no chrome).

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { AdminUiProvider } from './admin-ui'

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/books', label: 'Books' },
  { href: '/admin/authors', label: 'Authors' },
  { href: '/admin/import-review', label: 'Import review' },
  { href: '/admin/news', label: 'News' },
  { href: '/admin/reading-club', label: 'Reading Club' },
  { href: '/admin/banned-books-week', label: 'BBW' },
  { href: '/admin/content-blocks', label: 'Content blocks' },
  { href: '/admin/stats', label: 'Stats' },
  { href: '/admin/scripts', label: 'Scripts' },
  { href: '/admin/sitemap', label: 'Sitemap' },
  { href: '/admin/zenodo', label: 'Zenodo' },
] as const

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  // Login page has no session yet — render it without the admin chrome.
  if (pathname === '/admin/login') return <>{children}</>

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    router.push('/admin/login')
  }

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <AdminUiProvider>
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-4 h-12">
          <Link href="/admin" className="text-sm font-semibold whitespace-nowrap shrink-0">
            <span className="text-gray-400">banned-books</span> Admin
          </Link>

          <nav
            aria-label="Admin sections"
            className="flex-1 flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {NAV.map(({ href, label }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          <button
            onClick={handleLogout}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {children}
    </AdminUiProvider>
  )
}
