'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type StatCard = {
  largeText: string
  label: string
  sub: string
  href: string
  isTitle?: boolean
  fullTitle?: string
}

export default function RotatingStats({ stats }: { stats: StatCard[] }) {
  const [activeSet, setActiveSet] = useState(0)
  const [fading, setFading] = useState(false)
  const sets = Math.ceil(stats.length / 3)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function goToSet(i: number) {
    const next = ((i % sets) + sets) % sets
    if (next === activeSet || fading) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setFading(true)
    timeoutRef.current = setTimeout(() => {
      setActiveSet(next)
      setFading(false)
    }, 400)
  }

  const currentStats = stats.slice(activeSet * 3, activeSet * 3 + 3)

  return (
    <div>
      <div className="flex items-center gap-3">
        {sets > 1 && (
          <button
            onClick={() => goToSet(activeSet - 1)}
            disabled={fading}
            className="hidden sm:flex shrink-0 items-center justify-center w-6 h-6 text-gray-400 hover:text-brand transition-colors disabled:opacity-30"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div
          className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4"
          style={{ opacity: fading ? 0 : 1, transition: 'opacity 400ms ease' }}
        >
          {currentStats.map((stat, i) => (
            <Link
              key={i}
              href={stat.href}
              className="min-h-[120px] flex flex-col bg-brand-light dark:bg-brand-dark/20 border border-brand/20 dark:border-brand/10 rounded-lg p-5 hover:shadow-sm transition-shadow"
            >
              <p
                title={stat.fullTitle || stat.largeText}
                className="text-lg font-bold text-brand-dark dark:text-red-300 leading-snug line-clamp-2"
              >
                {stat.largeText}
              </p>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{stat.sub}</p>
            </Link>
          ))}
        </div>
        {sets > 1 && (
          <button
            onClick={() => goToSet(activeSet + 1)}
            disabled={fading}
            className="hidden sm:flex shrink-0 items-center justify-center w-6 h-6 text-gray-400 hover:text-brand transition-colors disabled:opacity-30"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
      {sets > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: sets }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToSet(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === activeSet ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              aria-label={`Show stats set ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
