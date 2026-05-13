'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FLAG_BADGE_CLASS, FLAG_TOOLTIPS, STATUS_BADGE_CLASS } from './flag-styles'
import BulkActionModal from './bulk-action-modal'

export type QueueStatus = 'pending_review' | 'approved' | 'rejected' | 'deferred'

export type QueueListItem = {
  id: number
  source_slug: string
  source_url: string | null
  status: QueueStatus
  title: string
  authors: string[]
  year: number | null
  state: string | null
  section_anchor: string
  quality_flags: string[]
  dedup_kind: string | null
  dedup_book_id: number | null
}

export type SlugLabel = { slug: string; label_en: string }

type Props = {
  items: QueueListItem[]
  sourceSlugs: string[]
  flagOptions: Array<{ flag: string; count: number }>
  statusCounts: Record<QueueStatus, number>
  reasons: SlugLabel[]
  scopes: SlugLabel[]
}

const PAGE_SIZE = 50

const STATUS_OPTIONS: Array<{ value: QueueStatus | 'all'; label: string }> = [
  { value: 'pending_review', label: 'Pending' },
  { value: 'approved',       label: 'Approved' },
  { value: 'rejected',       label: 'Rejected' },
  { value: 'deferred',       label: 'Deferred' },
  { value: 'all',            label: 'All' },
]

export default function ImportReviewListClient({
  items,
  sourceSlugs,
  flagOptions,
  statusCounts,
  reasons,
  scopes,
}: Props) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<QueueStatus | 'all'>('pending_review')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [flagFilter, setFlagFilter] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkMode, setBulkMode] = useState<null | 'approve' | 'reject' | 'defer'>(null)

  const filtered = useMemo(() => {
    return items.filter(it => {
      if (statusFilter !== 'all' && it.status !== statusFilter) return false
      if (sourceFilter !== 'all' && it.source_slug !== sourceFilter) return false
      if (flagFilter.size > 0) {
        // AND semantics: a row must carry every selected flag. Operators who
        // want OR can pick one flag at a time and approve in passes.
        for (const f of flagFilter) {
          if (!it.quality_flags.includes(f)) return false
        }
      }
      return true
    })
  }, [items, statusFilter, sourceFilter, flagFilter])

  // Reset pagination + clear out-of-view selections whenever filters change
  function applyFilterChange(fn: () => void) {
    fn()
    setPage(0)
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggleFlag(flag: string) {
    applyFilterChange(() => {
      const next = new Set(flagFilter)
      if (next.has(flag)) next.delete(flag)
      else next.add(flag)
      setFlagFilter(next)
    })
  }

  function toggleSelect(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function selectAllVisible() {
    const next = new Set(selected)
    for (const it of visible) next.add(it.id)
    setSelected(next)
  }

  function clearSelection() {
    setSelected(new Set())
  }

  const allVisibleSelected =
    visible.length > 0 && visible.every(it => selected.has(it.id))

  async function handleBulkComplete(refresh: boolean) {
    setBulkMode(null)
    if (refresh) {
      clearSelection()
      router.refresh()
    }
  }

  return (
    <div>
      {/* Sticky filter bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 -mx-4 px-4 pt-1 pb-3 mb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-wrap items-start gap-3">
          <FilterGroup label="Status">
            {STATUS_OPTIONS.map(opt => {
              const count = opt.value === 'all'
                ? items.length
                : statusCounts[opt.value]
              return (
                <FilterPill
                  key={opt.value}
                  active={statusFilter === opt.value}
                  onClick={() => applyFilterChange(() => setStatusFilter(opt.value))}
                >
                  {opt.label} ({count})
                </FilterPill>
              )
            })}
          </FilterGroup>

          <FilterGroup label="Source">
            <FilterPill
              active={sourceFilter === 'all'}
              onClick={() => applyFilterChange(() => setSourceFilter('all'))}
            >
              All
            </FilterPill>
            {sourceSlugs.map(slug => (
              <FilterPill
                key={slug}
                active={sourceFilter === slug}
                onClick={() => applyFilterChange(() => setSourceFilter(slug))}
              >
                {slug}
              </FilterPill>
            ))}
          </FilterGroup>
        </div>

        {flagOptions.length > 0 && (
          <div className="mt-2">
            <FilterGroup label="Flags">
              {flagOptions.map(({ flag, count }) => (
                <FilterPill
                  key={flag}
                  active={flagFilter.has(flag)}
                  onClick={() => toggleFlag(flag)}
                  title={FLAG_TOOLTIPS[flag] ?? flag}
                >
                  {flag} ({count})
                </FilterPill>
              ))}
              {flagFilter.size > 0 && (
                <button
                  onClick={() => applyFilterChange(() => setFlagFilter(new Set()))}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline self-center"
                >
                  clear
                </button>
              )}
            </FilterGroup>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3 p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <span className="flex-1" />
          <button
            onClick={() => setBulkMode('approve')}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
          >
            Approve {selected.size}
          </button>
          <button
            onClick={() => setBulkMode('reject')}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
          >
            Reject {selected.size}
          </button>
          <button
            onClick={() => setBulkMode('defer')}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Defer {selected.size}
          </button>
          <button
            onClick={clearSelection}
            className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No queue entries match these filters.
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            {filtered.length.toLocaleString('en')} result
            {filtered.length !== 1 ? 's' : ''}
            {totalPages > 1 && ` — page ${page + 1} of ${totalPages}`}
          </p>

          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allVisibleSelected}
                      onChange={() =>
                        allVisibleSelected ? clearSelection() : selectAllVisible()
                      }
                    />
                  </th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Authors</th>
                  <th className="px-3 py-2 hidden sm:table-cell w-16 text-right">Year</th>
                  <th className="px-3 py-2 hidden md:table-cell">Section</th>
                  <th className="px-3 py-2">Flags</th>
                  <th className="px-3 py-2 hidden lg:table-cell">Dup</th>
                  <th className="px-3 py-2 hidden md:table-cell w-24">Status</th>
                  <th className="px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody>
                {visible.map((it, i) => (
                  <tr
                    key={it.id}
                    className={`border-b last:border-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-900/30'}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(it.id)}
                        onChange={() => toggleSelect(it.id)}
                        aria-label={`Select row ${it.id}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium leading-snug max-w-xs">
                      <a
                        href={`/admin/import-review/${it.id}`}
                        className="hover:underline"
                      >
                        {it.title || <em className="text-gray-400">(no title)</em>}
                      </a>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-gray-600 dark:text-gray-400 max-w-[12rem] truncate">
                      {it.authors.length > 0 ? it.authors.join(', ') : '—'}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-gray-500 dark:text-gray-400 text-right tabular-nums">
                      {it.year ?? '—'}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-gray-500 dark:text-gray-400">
                      <span className="text-xs">
                        {it.section_anchor || '—'}
                        {it.state && (
                          <span className="text-gray-400 dark:text-gray-500"> · {it.state}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <FlagBadges flags={it.quality_flags} />
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell text-xs">
                      {it.dedup_kind && it.dedup_book_id ? (
                        <span className="text-amber-700 dark:text-amber-400">
                          {it.dedup_kind === 'possible_duplicate' ? '~' : '='}
                          {' '}#{it.dedup_book_id}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${STATUS_BADGE_CLASS[it.status]}`}>
                        {it.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <a
                        href={`/admin/import-review/${it.id}`}
                        className="inline-block px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {bulkMode && (
        <BulkActionModal
          mode={bulkMode}
          selectedIds={Array.from(selected)}
          reasons={reasons}
          scopes={scopes}
          onClose={() => setBulkMode(null)}
          onComplete={handleBulkComplete}
        />
      )}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 mr-1">
        {label}
      </span>
      {children}
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
        active
          ? 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400'
      }`}
    >
      {children}
    </button>
  )
}

function FlagBadges({ flags }: { flags: string[] }) {
  if (flags.length === 0) {
    return <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
  }
  const visible = flags.slice(0, 3)
  const overflow = flags.length - visible.length
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map(f => (
        <span
          key={f}
          title={FLAG_TOOLTIPS[f] ?? f}
          className={`inline-block px-1.5 py-0.5 rounded text-xs ${FLAG_BADGE_CLASS[f] ?? 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
        >
          {f}
        </span>
      ))}
      {overflow > 0 && (
        <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          +{overflow}
        </span>
      )}
    </div>
  )
}
