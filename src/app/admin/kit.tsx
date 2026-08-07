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

export const cardCls = 'border border-gray-200 rounded-xl p-6 flex flex-col gap-4 bg-white'

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

export function StatusPill({ status }: { status: 'published' | 'draft' | string }) {
  const cls =
    status === 'published'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-amber-100 text-amber-700'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  )
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs whitespace-pre overflow-x-auto">
      {children}
    </pre>
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

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes
  let u = -1
  do {
    v /= 1024
    u++
  } while (v >= 1024 && u < units.length - 1)
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[u]}`
}

/** "US" → 🇺🇸 . Returns the raw code when it isn't a 2-letter country code. */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return code ?? ''
  const base = 0x1f1e6
  const a = code.toUpperCase().charCodeAt(0) - 65
  const b = code.toUpperCase().charCodeAt(1) - 65
  if (a < 0 || a > 25 || b < 0 || b > 25) return code
  return String.fromCodePoint(base + a, base + b)
}
