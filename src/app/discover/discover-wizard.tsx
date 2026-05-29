'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  REGIONS,
  filterAndScore,
  pickFromScored,
  type DiscoverCandidate,
  type FilterInput,
  type ScoredCandidate,
  type SpinPicks,
  type SpinScope,
} from '@/lib/discover-engine'
import SlotMachine, { type WheelPhase } from './slot-machine'

type DiscoverReason = { slug: string; label: string; icon: string }
type DiscoverCountry = { code: string; name: string }
type DiscoverGenre = { slug: string; label: string }

type WizardProps = {
  reasons: DiscoverReason[]
  countries: DiscoverCountry[]
  genres: DiscoverGenre[]
  candidates: DiscoverCandidate[]
  initial?: {
    reasonSlugs: string[]
    genreSlugs: string[]
    scope: SpinScope
    excludeIconic: boolean
    withReadingClubGuide: boolean
  }
}

const MAX_REASONS = 3
const MAX_GENRES = 3

export default function DiscoverWizard({
  reasons,
  countries,
  genres,
  candidates,
  initial,
}: WizardProps) {
  const [reasonSlugs, setReasonSlugs] = useState<string[]>(initial?.reasonSlugs ?? [])
  const [genreSlugs, setGenreSlugs] = useState<string[]>(initial?.genreSlugs ?? [])
  const [scope, setScope] = useState<SpinScope>(initial?.scope ?? { type: 'all' })
  const [excludeIconic, setExcludeIconic] = useState<boolean>(initial?.excludeIconic ?? false)
  const [withReadingClubGuide, setWithReadingClubGuide] = useState<boolean>(
    initial?.withReadingClubGuide ?? false,
  )
  const [phase, setPhase] = useState<WheelPhase>('idle')
  const [picks, setPicks] = useState<SpinPicks>({ primary: null, alternatives: [] })
  const [excludeIds, setExcludeIds] = useState<Set<number>>(() => new Set())
  const autoSpunRef = useRef(false)

  const filter: FilterInput = useMemo(
    () => ({ reasonSlugs, genreSlugs, scope, excludeIconic, withReadingClubGuide }),
    [reasonSlugs, genreSlugs, scope, excludeIconic, withReadingClubGuide],
  )

  const scored: ScoredCandidate[] = useMemo(
    () => filterAndScore(candidates, filter),
    [candidates, filter],
  )

  const anyFilter =
    reasonSlugs.length + genreSlugs.length > 0
    || scope.type !== 'all'
    || excludeIconic
    || withReadingClubGuide

  // When the filter narrows pool to 0, reflect that in the wheel — otherwise
  // revert to idle while keeping the previous pick visible only during the
  // animation itself.
  useEffect(() => {
    if (phase === 'spinning') return
    if (scored.length === 0) setPhase('empty')
    else if (phase === 'empty') setPhase('idle')
  }, [scored.length, phase])

  function toggleReason(slug: string) {
    setReasonSlugs(prev =>
      prev.includes(slug)
        ? prev.filter(s => s !== slug)
        : prev.length >= MAX_REASONS ? prev : [...prev, slug])
  }

  function toggleGenre(slug: string) {
    setGenreSlugs(prev =>
      prev.includes(slug)
        ? prev.filter(s => s !== slug)
        : prev.length >= MAX_GENRES ? prev : [...prev, slug])
  }

  function setScopeType(t: 'all' | 'country' | 'region') {
    if (t === 'all') setScope({ type: 'all' })
    else if (t === 'country') setScope({ type: 'country', code: countries[0]?.code ?? 'US' })
    else setScope({ type: 'region', region: 'europe' })
  }

  function syncShareUrl(currentScope: SpinScope) {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams()
    if (reasonSlugs.length) params.set('r', reasonSlugs.join(','))
    if (genreSlugs.length) params.set('g', genreSlugs.join(','))
    if (currentScope.type === 'country') params.set('c', currentScope.code)
    else if (currentScope.type === 'region') params.set('region', currentScope.region)
    if (excludeIconic) params.set('x', '1')
    if (withReadingClubGuide) params.set('rc', '1')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `/discover?${qs}` : '/discover')
  }

  function performSpin(opts: { keepExcludes?: boolean } = {}) {
    if (scored.length === 0) {
      setPhase('empty')
      return
    }
    const carry = opts.keepExcludes ? excludeIds : new Set<number>()
    const next = pickFromScored(scored, carry)
    if (!next.primary) {
      // Pool exhausted after re-rolls — let the wheel show empty, the
      // exclude set carries on until filters change.
      setPhase('empty')
      setPicks(next)
      return
    }

    setPicks(next)
    setPhase('spinning')

    const seen = new Set(carry)
    seen.add(next.primary.bookId)
    for (const a of next.alternatives) seen.add(a.bookId)
    setExcludeIds(seen)
    syncShareUrl(scope)
  }

  // Auto-spin if the URL carried filter state.
  useEffect(() => {
    if (autoSpunRef.current) return
    if (initial && scored.length > 0) {
      autoSpunRef.current = true
      performSpin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPool = candidates.length
  const isMatch = scored.length > 0
  const canSpin = isMatch && phase !== 'spinning'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-12 items-start">
      {/* ── Wheel column ──────────────────────────────────────────── */}
      <aside className="order-1 lg:order-2 lg:sticky lg:top-6">
        <SlotMachine
          phase={phase}
          primary={picks.primary}
          alternatives={picks.alternatives}
          pool={scored}
          onComplete={() => setPhase('revealed')}
        />

        <PoolCaption
          count={scored.length}
          total={totalPool}
          anyFilter={anyFilter}
          phase={phase}
        />

        <div className="mt-4 flex flex-col sm:flex-row lg:flex-col gap-2.5">
          <button
            type="button"
            onClick={() => performSpin()}
            disabled={!canSpin}
            className={
              'inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-base font-semibold transition-all shadow-sm w-full ' +
              (canSpin
                ? 'bg-oxblood text-white hover:bg-oxblood/90 hover:shadow-md active:translate-y-px'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed')
            }
          >
            <span aria-hidden="true" className="text-lg">🎰</span>
            {phase === 'spinning' ? 'Spinning…'
              : phase === 'revealed' ? 'Spin again'
              : phase === 'empty' ? 'Adjust a filter'
              : 'Spin the wheel'}
          </button>
          {phase === 'revealed' && (
            <button
              type="button"
              onClick={() => performSpin({ keepExcludes: true })}
              disabled={!isMatch}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-full text-xs font-medium text-gray-600 hover:text-oxblood hover:bg-cream/60 transition-colors"
            >
              Try another from the pool
            </button>
          )}
        </div>
      </aside>

      {/* ── Filter column ─────────────────────────────────────────── */}
      <div className="order-2 lg:order-1">
        <Step
          index={1}
          title="What kind of banned book do you want to read?"
          hint={`Pick up to ${MAX_REASONS}. The more, the stronger the match.`}
        >
          <div className="flex flex-wrap gap-2">
            {reasons.map(r => {
              const active = reasonSlugs.includes(r.slug)
              const disabled = !active && reasonSlugs.length >= MAX_REASONS
              return (
                <PillButton
                  key={r.slug}
                  active={active}
                  disabled={disabled}
                  onClick={() => toggleReason(r.slug)}
                  ariaPressed={active}
                  tone="oxblood"
                >
                  <span aria-hidden="true">{r.icon}</span>
                  {r.label}
                </PillButton>
              )
            })}
          </div>
        </Step>

        {genres.length > 0 && (
          <Step
            index={2}
            title="Any genre preference?"
            optional
            hint={`Skip for maximum range. Pick up to ${MAX_GENRES}.`}
          >
            <div className="flex flex-wrap gap-2">
              {genres.map(g => {
                const active = genreSlugs.includes(g.slug)
                const disabled = !active && genreSlugs.length >= MAX_GENRES
                return (
                  <PillButton
                    key={g.slug}
                    active={active}
                    disabled={disabled}
                    onClick={() => toggleGenre(g.slug)}
                    ariaPressed={active}
                    tone="ink"
                  >
                    {g.label}
                  </PillButton>
                )
              })}
            </div>
          </Step>
        )}

        <Step index={3} title="Where should it have been banned?">
          <div className="flex flex-wrap gap-2 mb-3">
            {([
              ['all', 'Anywhere'],
              ['region', 'A region'],
              ['country', 'A specific country'],
            ] as const).map(([t, label]) => (
              <PillButton
                key={t}
                active={scope.type === t}
                onClick={() => setScopeType(t)}
                ariaPressed={scope.type === t}
                tone="ink"
              >
                {label}
              </PillButton>
            ))}
          </div>
          {scope.type === 'region' && (
            <select
              value={scope.region}
              onChange={e => setScope({ type: 'region', region: e.target.value as typeof scope.region })}
              className="w-full sm:w-auto rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-oxblood focus:outline-none"
            >
              {REGIONS.map(r => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
          )}
          {scope.type === 'country' && (
            <select
              value={scope.code}
              onChange={e => setScope({ type: 'country', code: e.target.value })}
              className="w-full sm:w-auto rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-oxblood focus:outline-none"
            >
              {countries.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          )}
        </Step>

        <Step index={4} title="Surprise factor">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeIconic}
              onChange={e => setExcludeIconic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-oxblood focus:ring-oxblood"
            />
            Skip the famous classics (1984, Lolita, The Handmaid&apos;s Tale, …)
          </label>
        </Step>

        <Step
          index={5}
          title="Want a guide with it?"
          optional
          hint="Some of our books come with a free PDF — discussion questions about the story and the censorship case behind it. To grab it after the wheel lands, open the book and tap its “★ Reading Club” badge — the PDF downloads from there. Works solo to think the book through, or as a guide for a classroom or book club."
        >
          <label className="inline-flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer rounded-md border border-gray-200 hover:border-oxblood/40 px-3 py-2.5 transition-colors">
            <input
              type="checkbox"
              checked={withReadingClubGuide}
              onChange={e => setWithReadingClubGuide(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-oxblood focus:ring-oxblood"
            />
            <span>
              <span className="font-medium text-gray-900">Only books with a reading guide</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                Free PDF · 7–10 prompts · grab it from the book page&apos;s ★ Reading Club badge.
              </span>
            </span>
          </label>
        </Step>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────

function Step({
  index,
  title,
  hint,
  optional,
  children,
}: {
  index: number
  title: string
  hint?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mb-7 sm:mb-8">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="font-serif text-2xl font-semibold text-oxblood tabular-nums leading-none">
          {index}
        </span>
        <h2 className="font-serif text-lg sm:text-xl font-semibold text-gray-900 leading-snug">
          {title}{' '}
          {optional && <span className="text-sm font-normal text-gray-500">(optional)</span>}
        </h2>
      </div>
      {hint && <p className="text-sm text-gray-600 mb-3 ml-7">{hint}</p>}
      <div className="ml-7">{children}</div>
    </div>
  )
}

function PillButton({
  active,
  disabled,
  onClick,
  ariaPressed,
  tone,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  ariaPressed: boolean
  tone: 'oxblood' | 'ink'
  children: React.ReactNode
}) {
  const base = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all'
  const activeCls = tone === 'oxblood'
    ? 'bg-oxblood text-white border-oxblood shadow-sm'
    : 'bg-gray-900 text-white border-gray-900 shadow-sm'
  const idleCls = 'bg-white text-gray-700 border-gray-300 hover:border-gray-500 hover:text-gray-900'
  const disabledCls = 'bg-white text-gray-400 border-gray-200 cursor-not-allowed'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ariaPressed}
      className={`${base} ${active ? activeCls : disabled ? disabledCls : idleCls}`}
    >
      {children}
    </button>
  )
}

function PoolCaption({
  count,
  total,
  anyFilter,
  phase,
}: {
  count: number
  total: number
  anyFilter: boolean
  phase: WheelPhase
}) {
  if (phase === 'spinning') return <div className="h-5 mt-3" />
  if (phase === 'empty') {
    return (
      <p className="mt-3 text-center text-sm text-gray-600">
        <span className="font-semibold text-gray-900">0</span> books match this combination
      </p>
    )
  }
  return (
    <p className="mt-3 text-center text-sm text-gray-600">
      <span className="font-semibold text-gray-900 tabular-nums">{count.toLocaleString()}</span>{' '}
      {count === 1 ? 'book' : 'books'} in the wheel
      {anyFilter && (
        <span className="text-gray-400">
          {' '}· narrowed from {total.toLocaleString()}
        </span>
      )}
    </p>
  )
}

