'use client'

// Global admin chrome: a persistent top bar with brand, grouped section nav,
// and Sign out, rendered on every /admin/* page via the layout.
//
// The 12 sections are grouped into 4 clusters (Overview · Catalogue ·
// Publishing · System). On desktop they render as one bar with group
// separators; below lg a hamburger opens a sheet menu with the groups spelled
// out — the previous single overflow-x-auto strip hid 9 of 12 items on a
// phone with the scrollbar explicitly hidden, with no hint anything was
// off-screen.
//
// The login page renders bare (no chrome). The public site header/footer are
// hidden on /admin via the <style> in layout.tsx — the admin has its own bar.

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogOut, Menu, X } from 'lucide-react'
import { AdminUiProvider } from './admin-ui'

type NavItem = { href: string; label: string }
type NavGroup = { label: string; items: NavItem[] }

const GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Overview' }],
  },
  {
    label: 'Catalogue',
    items: [
      { href: '/admin/books', label: 'Books' },
      { href: '/admin/authors', label: 'Authors' },
    ],
  },
  {
    label: 'Publishing',
    items: [
      { href: '/admin/news', label: 'News' },
      { href: '/admin/bluesky', label: 'Book of the day' },
      { href: '/admin/reading-club', label: 'Reading Club' },
      { href: '/admin/banned-books-week', label: 'BBW' },
      { href: '/admin/content-blocks', label: 'Content blocks' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/stats', label: 'Stats' },
      { href: '/admin/scripts', label: 'Scripts' },
      { href: '/admin/sitemap', label: 'Sitemap' },
      { href: '/admin/zenodo', label: 'Zenodo' },
    ],
  },
]

const ALL_ITEMS = GROUPS.flatMap(g => g.items)

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close the sheet whenever navigation happens (incl. back/forward).
  useEffect(() => setMenuOpen(false), [pathname])

  // Login page has no session yet — render it without the admin chrome.
  if (pathname === '/admin/login') return <>{children}</>

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    router.push('/admin/login')
  }

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const current = ALL_ITEMS.find(i => isActive(i.href))

  return (
    <AdminUiProvider>
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-4 h-12">
          <Link href="/admin" className="text-sm font-semibold whitespace-nowrap shrink-0">
            <span className="text-gray-400">banned-books</span> Admin
          </Link>

          {/* Desktop: one bar, group separators */}
          <nav
            aria-label="Admin sections"
            className="hidden lg:flex flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {GROUPS.map((group, gi) => (
              <div key={group.label} className="flex items-center gap-0.5 shrink-0">
                {gi > 0 && <span aria-hidden className="mx-1.5 h-4 w-px bg-gray-200" />}
                {group.items.map(({ href, label }) => {
                  const active = isActive(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                        active
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      {label}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>

          {/* Mobile: current section + hamburger */}
          <div className="flex lg:hidden flex-1 items-center justify-end gap-2 min-w-0">
            {current && current.href !== '/admin' && (
              <span className="text-xs font-medium text-gray-500 truncate">{current.label}</span>
            )}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open admin menu"
              aria-expanded={menuOpen}
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" aria-hidden />
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="hidden lg:inline-flex shrink-0 items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden />
            Sign out
          </button>
        </div>
      </header>

      {/* Mobile sheet menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button
            aria-label="Close admin menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div className="absolute top-0 inset-x-0 bg-white border-b border-gray-200 shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="px-4 h-12 flex items-center justify-between border-b border-gray-100">
              <span className="text-sm font-semibold"><span className="text-gray-400">banned-books</span> Admin</span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close admin menu"
                className="inline-flex items-center justify-center w-9 h-9 rounded-md text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            <nav aria-label="Admin sections" className="px-2 py-3 flex flex-col gap-4">
              {GROUPS.map(group => (
                <div key={group.label}>
                  <p className="px-3 pb-1 text-[11px] uppercase tracking-widest text-gray-400">{group.label}</p>
                  <ul>
                    {group.items.map(({ href, label }) => {
                      const active = isActive(href)
                      return (
                        <li key={href}>
                          <Link
                            href={href}
                            aria-current={active ? 'page' : undefined}
                            className={`block px-3 py-2.5 rounded-md text-sm font-medium ${
                              active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
              <button
                onClick={handleLogout}
                className="mx-3 mt-1 mb-2 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4" aria-hidden />
                Sign out
              </button>
            </nav>
          </div>
        </div>
      )}

      {children}
    </AdminUiProvider>
  )
}
