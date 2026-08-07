// Shared admin-portal primitives. One source of truth for the card/input
// styling, small display components, and helpers that used to be re-declared
// per section (8 cardCls copies, 6 input variants, duplicated ToggleSwitch /
// StatusPill / Code / move() / formatBytes / flagEmoji).
//
// No 'use client' on purpose: everything here is renderable from server pages;
// components with handlers (ToggleSwitch) are only mounted inside client
// components, which makes them part of that client bundle automatically.

import Link from 'next/link'

// ── Styling constants ───────────────────────────────────────────────────────

export const cardCls = 'border border-gray-200 rounded-xl p-6 flex flex-col gap-3 bg-white'

export const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50'

export const textareaCls = `${inputCls} resize-y`

// ── Page header ─────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  backHref = '/admin',
  backLabel = 'Admin dashboard',
  children,
}: {
  title: string
  subtitle?: React.ReactNode
  backHref?: string
  backLabel?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-3">
        {children}
        <Link href={backHref} className="text-sm text-gray-400 hover:text-gray-700 whitespace-nowrap">
          ← {backLabel}
        </Link>
      </div>
    </div>
  )
}

// ── Small display components ────────────────────────────────────────────────

export function StatusPill({ status }: { status: 'placeholder' | 'draft' | 'published' }) {
  const styles = {
    placeholder: 'bg-gray-200 text-gray-700',
    draft:       'bg-amber-100 text-amber-800',
    published:   'bg-green-100 text-green-800',
  } as const
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${styles[status]}`}>
      {status}
    </span>
  )
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="block bg-gray-950 text-green-400 text-xs rounded-lg px-4 py-3 font-mono whitespace-pre overflow-x-auto">
      {children}
    </code>
  )
}

export function ToggleSwitch({
  checked, onChange, disabled, labelOn, labelOff,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  labelOn: string
  labelOff: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 group disabled:opacity-50"
    >
      <span className={`text-xs font-medium ${checked ? 'text-green-700' : 'text-gray-500'}`}>
        {checked ? labelOn : labelOff}
      </span>
      <span className={`relative inline-block w-9 h-5 rounded-full transition-colors ${checked ? 'bg-green-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  )
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/** Immutable reorder: swap index i with its neighbour in direction dir (±1). */
export function arrayMove<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

/** "US" → 🇺🇸 ; anything that isn't a 2-letter code → 🌐 . */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '🌐'
  return code.toUpperCase().split('').map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
}
