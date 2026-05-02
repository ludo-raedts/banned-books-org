'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'

export type StatCard = {
  largeText: string
  label: string
  sub: string
  href: string
  isTitle?: boolean   // true = book title card; false/undefined = number card
  fullTitle?: string  // untruncated title for tooltip
}

export default function RotatingStats({ stats }: { stats: StatCard[] }) {
  const [activeSet, setActiveSet] = useState(0)
  const [fading, setFading] = useState(false)
  const sets = Math.ceil(stats.length / 3)
  const setsRef = useRef(sets)
  setsRef.current = sets
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const advance = useCallback(() => {
    setFading(true)
    timeoutRef.current = setTimeout(() => {
      setActiveSet(prev => (prev + 1) % setsRef.current)
      setFading(false)
    }, 400)
  }, [])

  const resetTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (setsRef.current <= 1) return
    intervalRef.current = setInterval(advance, 8000)
  }, [advance])

  useEffect(() => {
    resetTimer()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [resetTimer])

  function goToSet(i: number) {
    if (i === activeSet || fading) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setFading(true)
    timeoutRef.current = setTimeout(() => {
      setActiveSet(i)
      setFading(false)
    }, 400)
    resetTimer()
  }

  const currentStats = stats.slice(activeSet * 3, activeSet * 3 + 3)

  return (
    <div>
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        style={{ opacity: fading ? 0 : 1, transition: 'opacity 400ms ease' }}
      >
        {currentStats.map((stat, i) => {
          const sizeClass = stat.isTitle
            ? (stat.largeText.length > 35 ? 'text-lg' : 'text-xl')
            : 'text-3xl'
          return (
            <Link
              key={i}
              href={stat.href}
              className="bg-brand-light dark:bg-brand-dark/20 border border-brand/20 dark:border-brand/10 rounded-lg p-5 hover:shadow-sm transition-shadow"
            >
              <p
                title={stat.fullTitle || stat.largeText}
                className={`${sizeClass} font-bold text-brand-dark dark:text-red-300 leading-snug line-clamp-2`}
              >
                {stat.largeText}
              </p>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{stat.sub}</p>
            </Link>
          )
        })}
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
