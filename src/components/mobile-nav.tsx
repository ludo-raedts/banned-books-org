'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavLink = { href: string; label: string; indented?: boolean }
type NavSection = { heading: string; links: NavLink[] }

const SECTIONS: NavSection[] = [
  {
    heading: 'Browse',
    links: [
      { href: '/search', label: 'Search' },
      { href: '/countries', label: 'Countries' },
      { href: '/most-banned-authors', label: 'Authors' },
      { href: '/reasons', label: 'Reasons' },
    ],
  },
  {
    heading: 'Data',
    links: [
      { href: '/dataset', label: 'Dataset' },
      { href: '/stats', label: 'Stats' },
    ],
  },
  {
    heading: 'Read',
    links: [
      { href: '/film', label: 'Film' },
      { href: '/history', label: 'History' },
      { href: '/essays', label: 'Essays' },
      { href: '/news', label: 'News' },
      { href: '/reading-club', label: 'Reading club' },
      { href: '/discover', label: 'Pick me a banned book', indented: true },
      { href: '/get-banned-books', label: 'Get banned books' },
    ],
  },
]

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    function getFocusables(): HTMLElement[] {
      const items: HTMLElement[] = []
      if (buttonRef.current) items.push(buttonRef.current)
      menuRef.current
        ?.querySelectorAll<HTMLElement>('a[href]')
        .forEach(el => items.push(el))
      return items
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        buttonRef.current?.focus()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = getFocusables()
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && (active === first || !active || !focusables.includes(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null
      if (!target) return
      if (menuRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const first = menuRef.current?.querySelector<HTMLElement>('a[href]')
    first?.focus()
  }, [open])

  return (
    <div className="ml-auto md:hidden flex items-center gap-0.5">
      <Link
        href="/search"
        aria-label="Search"
        className="inline-flex items-center justify-center w-9 h-9 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.65" y2="16.65" />
        </svg>
      </Link>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center justify-center w-9 h-9 -mr-1 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="fixed inset-x-0 top-12 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm animate-fade-in"
        >
          <nav className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-1">
            {SECTIONS.map((section, idx) => (
              <div
                key={section.heading}
                className={idx > 0 ? 'mt-3 pt-3 border-t border-gray-100' : ''}
              >
                <h2 className="px-3 pb-1 text-[11px] uppercase tracking-wider font-semibold text-gray-500">
                  {section.heading}
                </h2>
                {section.links.map(link => {
                  const active =
                    pathname === link.href ||
                    pathname.startsWith(link.href + '/')
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block py-2 rounded-md transition-colors ${
                        link.indented
                          ? 'pl-8 pr-3 text-xs text-gray-500 hover:text-oxblood'
                          : 'px-3 text-sm py-2.5'
                      } ${
                        active
                          ? 'text-brand font-medium'
                          : link.indented
                            ? ''
                            : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {link.indented && (
                        <span aria-hidden="true" className="mr-1.5 text-gray-400">↳</span>
                      )}
                      {link.label}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}
