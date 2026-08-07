'use client'

// Debounced search box that syncs the `q` URL param, so the server component
// re-queries with server-side pagination (the lists no longer ship the whole
// catalogue to the browser). Used by the Books and Authors admin lists.

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState } from 'react'

export default function ListSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onChange(v: string) {
    setValue(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      const q = v.trim()
      if (q) next.set('q', q)
      else next.delete('q')
      next.delete('page')
      router.replace(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false })
    }, 300)
  }

  return (
    <input
      type="search"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 mb-3"
    />
  )
}
