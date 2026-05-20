'use client'

import { Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function HeroSearch({ bookCount }: { bookCount: number }) {
  const router = useRouter()
  const [q, setQ] = useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
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
          placeholder={`Search ${bookCount.toLocaleString('en')} banned books, authors, or countries…`}
          aria-label="Search banned books"
          className="w-full h-12 pl-11 pr-4 rounded-md bg-white border border-[#1a1a1a] text-base text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-oxblood/40 focus:border-oxblood"
        />
      </form>

      <div className="mt-3 text-sm">
        <Link href="/top-100-banned-books" className="text-neutral-600 hover:text-oxblood transition-colors">
          Top 100 banned books →
        </Link>
        <span className="text-neutral-400 mx-2" aria-hidden="true">·</span>
        <Link href="/countries" className="text-neutral-600 hover:text-oxblood transition-colors">
          By country →
        </Link>
        <span className="text-neutral-400 mx-2" aria-hidden="true">·</span>
        <Link href="/reasons" className="text-neutral-600 hover:text-oxblood transition-colors">
          By reason →
        </Link>
      </div>
    </div>
  )
}
