'use client'

import { track } from '@vercel/analytics'
import { Search } from 'lucide-react'
import Link from '@/components/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function HeroSearch() {
  const router = useRouter()
  const [q, setQ] = useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    track('Search Submitted', { source: 'home' })
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="relative w-full max-w-[640px]">
        <Search
          aria-hidden="true"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-oxblood pointer-events-none w-[18px] h-[18px]"
        />
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search books or authors"
          aria-label="Search banned books"
          className="w-full h-12 pl-11 pr-4 rounded-md bg-white border border-[#1a1a1a] text-base text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-oxblood/40 focus:border-oxblood"
        />
      </form>

      {/* The field searches books and authors; a country typed here finds no
          books (the reviewer tried "Netherlands" and got zero results), so the
          placeholder promises no more than that and "Explore by country" sits
          directly under it. Routes into the rest of the site: a new visitor should see at once
          that this is more than a catalogue. Wraps to two lines on a phone. */}
      <nav aria-label="Explore the archive" className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {[
          { href: '/countries', label: 'Explore by country' },
          { href: '/top-100-banned-books', label: 'Top 100 banned books' },
          { href: '/essays', label: 'Stories and essays' },
          { href: '/reading-club', label: 'Reading club' },
        ].map(l => (
          <Link
            key={l.href}
            href={l.href}
            className="font-medium text-oxblood underline decoration-oxblood/30 underline-offset-2 hover:decoration-oxblood"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
