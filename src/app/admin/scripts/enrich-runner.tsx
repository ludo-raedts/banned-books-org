'use client'

import { useMemo, useState } from 'react'
import { Play, Cloud, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'

// Steps that map 1:1 to scripts/enrich-*.ts. Order matches enrich-all.ts so
// the user picks roughly the same sequence the orchestrator would.
type StepKey =
  | 'isbn' | 'covers' | 'descriptions' | 'ban_descriptions'
  | 'censorship_context' | 'reasons' | 'author_bios' | 'author_photos'
  | 'classification'

type StepDef = {
  key: StepKey
  label: string
  paid: boolean
  description: string
  // True if there's an in-process /api/admin/enrich/run handler. Otherwise the
  // step is GitHub-Actions-only.
  inProcess: boolean
}

const STEPS: StepDef[] = [
  { key: 'isbn',                label: 'ISBN-13 lookup',              paid: false, description: 'Open Library + Google Books. Free, fast.', inProcess: true },
  { key: 'covers',              label: 'Cover images',                paid: false, description: 'Google Books, Open Library, Wikipedia + placeholder rejection.', inProcess: false },
  { key: 'descriptions',        label: 'Book descriptions',           paid: true,  description: 'OL/Google Books first; GPT-4o-mini fallback.', inProcess: false },
  { key: 'ban_descriptions',    label: 'Ban descriptions',            paid: true,  description: 'GPT — why this book was banned in this country.', inProcess: false },
  { key: 'censorship_context',  label: 'Censorship context',          paid: true,  description: 'GPT — political/historical background.', inProcess: false },
  { key: 'reasons',             label: 'Ban reason classification',   paid: true,  description: 'GPT — re-classifies bans currently tagged "other".', inProcess: false },
  { key: 'author_bios',         label: 'Author bios (Wikipedia)',     paid: false, description: 'Wikipedia article + infobox.', inProcess: false },
  { key: 'author_photos',       label: 'Author photos (v2)',          paid: false, description: 'Wikidata + OpenLibrary photo backfill.', inProcess: false },
  { key: 'classification',      label: 'Editorial classification',    paid: true,  description: 'GPT-4o-mini suggests warning_level + inclusion_rationale.', inProcess: false },
]

type DispatchResponse = {
  message: string
  actionsUrl: string
  config: { steps: string; freeOnly: boolean; gptLimit: number; dryRun: boolean }
}

type RunResponse = {
  step: string
  apply: boolean
  durationMs: number
  summary: Record<string, number>
  samples: Array<{ title: string; isbn: string | null; source: string }>
  log: string[]
}

export default function EnrichRunner() {
  const [selectedSteps, setSelectedSteps] = useState<Set<StepKey>>(new Set(['isbn']))
  const [freeOnly, setFreeOnly] = useState(false)
  const [gptLimit, setGptLimit] = useState(50)
  const [dryRun, setDryRun] = useState(true)

  const [busy, setBusy] = useState<null | 'github' | 'inprocess'>(null)
  const [error, setError] = useState<string | null>(null)
  const [dispatchResult, setDispatchResult] = useState<DispatchResponse | null>(null)
  const [runResult, setRunResult] = useState<RunResponse | null>(null)

  function toggle(key: StepKey) {
    setSelectedSteps(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Which selected steps can actually run in-process (Pad 1) on Vercel.
  const inProcessReady = useMemo(
    () => STEPS.filter(s => selectedSteps.has(s.key) && s.inProcess),
    [selectedSteps],
  )

  const onlyOneInProcessStep = inProcessReady.length === 1 && selectedSteps.size === 1
  const hasPaidStep = STEPS.some(s => selectedSteps.has(s.key) && s.paid)

  async function handleDispatchToGitHub() {
    setBusy('github'); setError(null); setDispatchResult(null); setRunResult(null)
    try {
      const res = await fetch('/api/admin/enrich/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          steps: Array.from(selectedSteps),
          freeOnly,
          gptLimit,
          dryRun,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setDispatchResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dispatch failed')
    } finally {
      setBusy(null)
    }
  }

  async function handleRunInBrowser() {
    if (inProcessReady.length === 0) return
    setBusy('inprocess'); setError(null); setDispatchResult(null); setRunResult(null)
    try {
      // For now only one step at a time; the route accepts a single step.
      const step = inProcessReady[0].key
      const res = await fetch('/api/admin/enrich/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          step,
          apply: !dryRun,
          limit: gptLimit,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setRunResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col gap-5 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Run enrichment</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Trigger scripts from the browser. GitHub Actions is the workhorse; in-browser runs are bounded by the
            300s function timeout and only available for steps that have been refactored as importable modules.
          </p>
        </div>
      </div>

      <details className="text-xs text-gray-500 dark:text-gray-400">
        <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
          One-time setup for production (Vercel + GitHub)
        </summary>
        <div className="mt-2 pl-4 space-y-1 leading-relaxed">
          <p>
            <strong>Vercel env (Settings → Environment Variables):</strong>
          </p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>
              <code className="font-mono">GITHUB_DISPATCH_TOKEN</code> — fine-grained PAT with{' '}
              <code className="font-mono">actions: read &amp; write</code> on this repo
            </li>
            <li>
              <code className="font-mono">GITHUB_REPO</code> — e.g.{' '}
              <code className="font-mono">ludo-raedts/banned-books-org</code>
            </li>
          </ul>
          <p className="mt-1.5">
            <strong>GitHub repo secrets (Settings → Secrets and variables → Actions):</strong>
          </p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li><code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code></li>
            <li><code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
            <li><code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code></li>
            <li><code className="font-mono">OPENAI_API_KEY</code> (for GPT steps)</li>
            <li><code className="font-mono">GOOGLE_AI_API_KEY</code> (for Gemini, used by the import-job verifier)</li>
            <li><code className="font-mono">ANTHROPIC_API_KEY</code> <em>(optional — falls back to gpt-4o if absent)</em></li>
            <li><code className="font-mono">DATABASE_URL</code> (for scripts using direct pg client)</li>
          </ul>
        </div>
      </details>

      {/* Steps */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">
          Steps
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5">
          {STEPS.map(s => {
            const disabledByFree = freeOnly && s.paid
            return (
              <label
                key={s.key}
                className={`flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                  disabledByFree
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedSteps.has(s.key)}
                  disabled={disabledByFree}
                  onChange={() => toggle(s.key)}
                  className="mt-0.5 shrink-0"
                />
                <span className="text-sm min-w-0 flex-1">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{s.label}</span>
                  {s.paid && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
                      $
                    </span>
                  )}
                  {s.inProcess && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                      browser-ready
                    </span>
                  )}
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.description}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {/* Flags */}
      <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">Mode</span>
          <span className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={e => setDryRun(e.target.checked)}
            />
            Dry-run (no DB writes)
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">Cost guard</span>
          <span className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={freeOnly}
              onChange={e => setFreeOnly(e.target.checked)}
            />
            Free-only (skip GPT/Claude)
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
            GPT limit ({gptLimit})
          </span>
          <input
            type="range"
            min={10}
            max={500}
            step={10}
            value={gptLimit}
            disabled={freeOnly && !hasPaidStep}
            onChange={e => setGptLimit(parseInt(e.target.value, 10))}
            className="accent-brand"
          />
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            Caps each GPT-using step at N books.
          </span>
        </label>
      </fieldset>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={handleRunInBrowser}
          disabled={busy !== null || inProcessReady.length === 0 || !onlyOneInProcessStep}
          title={
            inProcessReady.length === 0
              ? 'Select one browser-ready step (only ISBN today).'
              : !onlyOneInProcessStep
              ? 'In-browser run supports one step at a time. Use GitHub for multi-step.'
              : ''
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy === 'inprocess'
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Play className="w-4 h-4" />}
          Run in browser
        </button>

        <button
          type="button"
          onClick={handleDispatchToGitHub}
          disabled={busy !== null || selectedSteps.size === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy === 'github'
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Cloud className="w-4 h-4" />}
          Dispatch to GitHub Actions
        </button>

        <p className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {selectedSteps.size === 0
            ? 'Select at least one step.'
            : `${selectedSteps.size} step${selectedSteps.size === 1 ? '' : 's'} selected.`}
        </p>
      </div>

      {/* Result */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/30 text-sm text-red-800 dark:text-red-300">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {dispatchResult && (
        <div className="flex flex-col gap-2 px-4 py-3 rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 text-sm text-emerald-900 dark:text-emerald-200">
          <p className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-medium">{dispatchResult.message}</span>
          </p>
          <p className="text-xs leading-relaxed">
            Steps: <code className="font-mono">{dispatchResult.config.steps}</code> ·
            free_only=<code className="font-mono">{String(dispatchResult.config.freeOnly)}</code> ·
            gpt_limit=<code className="font-mono">{dispatchResult.config.gptLimit}</code> ·
            dry_run=<code className="font-mono">{String(dispatchResult.config.dryRun)}</code>
          </p>
          <a
            href={dispatchResult.actionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium underline hover:no-underline w-fit"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open on GitHub Actions
          </a>
        </div>
      )}

      {runResult && (
        <div className="flex flex-col gap-3 px-4 py-3 rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 text-sm text-emerald-900 dark:text-emerald-200">
          <p className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-medium">
              {runResult.step} {runResult.apply ? '(applied)' : '(dry-run)'} — {(runResult.durationMs / 1000).toFixed(1)}s
            </span>
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {Object.entries(runResult.summary).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-emerald-800/80 dark:text-emerald-300/80">{k}</dt>
                <dd className="tabular-nums font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {runResult.log.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer hover:underline">Log ({runResult.log.length} lines)</summary>
              <pre className="mt-1 max-h-64 overflow-auto bg-emerald-100/50 dark:bg-emerald-950/40 rounded p-2 font-mono text-[11px] leading-relaxed">
                {runResult.log.join('\n')}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
