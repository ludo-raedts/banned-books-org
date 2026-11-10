'use client'

// Matches on official ban lists that we keep as registers (no book page).
// /search shows this when the catalogue itself has few or no matches, so a
// title we only hold on a list is not a dead end. Fetches lazily and renders
// nothing when there are no hits.
import { useEffect, useState } from 'react'
import Link from '@/components/link'
import type { RegisterHit } from '@/lib/registers'

export default function RegisterHits({ q }: { q: string }) {
  const [hits, setHits] = useState<RegisterHit[]>([])

  useEffect(() => {
    const query = q.trim()
    if (query.length < 3) {
      setHits([])
      return
    }
    let cancelled = false
    fetch(`/api/registers/search?q=${encodeURIComponent(query)}`)
      .then((r) => (r.ok ? r.json() : { hits: [] }))
      .then(({ hits: h }) => {
        if (!cancelled) setHits(h ?? [])
      })
      .catch(() => {
        if (!cancelled) setHits([])
      })
    return () => {
      cancelled = true
    }
  }, [q])

  if (hits.length === 0) return null

  return (
    <section aria-labelledby="register-hits-heading" className="mt-8 rounded-xl border border-dashed border-gray-300 p-4 sm:p-5">
      <h2 id="register-hits-heading" className="text-sm font-semibold text-gray-900">
        On official ban lists
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Listed on a ban list we keep as a register. These titles have no book page here; each links to
        the list and to the original source.
      </p>
      <ul className="mt-3 divide-y divide-gray-200">
        {hits.map((h) => (
          <li key={h.id} className="py-2.5 text-sm leading-relaxed">
            <p className="text-gray-900">
              {h.printed_author && <span className="font-semibold">{h.printed_author}: </span>}
              <Link href={h.href} className="font-serif italic underline decoration-gray-300 underline-offset-2 hover:decoration-gray-600">
                {h.title}
              </Link>
              {h.imprint && <span className="text-gray-600">. {h.imprint}</span>}
            </p>
            <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
              <span>
                {h.list.name} · {h.edition}
                {h.kind === 'blanket' ? ' · all works' : ''}
              </span>
              <a href={h.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-600 hover:underline">
                Source ↗
              </a>
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-gray-500">
        <Link href="/registers" className="underline underline-offset-2 hover:text-gray-800">
          Browse the registers →
        </Link>
      </p>
    </section>
  )
}
