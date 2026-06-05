import { ArrowRight, Download, ClipboardList, Sparkles, Plus } from 'lucide-react'

interface Props {
  pendingReview: number
  // approvedLast7Days is still passed by the dashboard but no longer surfaced:
  // approvals via the review queue are idle (books now arrive via direct-import
  // scripts), so the metric would read 0 indefinitely.
  approvedLast7Days?: number
  needsEnrichment: number
  cardCls: string
}

function PhaseHeader({ Icon, n, label }: { Icon: React.ElementType; n: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 shrink-0">
        <Icon className="w-3.5 h-3.5 text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-gray-400">Step {n}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{label}</p>
      </div>
    </div>
  )
}

function Arrow() {
  return (
    <div className="hidden lg:flex items-center justify-center text-gray-300">
      <ArrowRight className="w-4 h-4" aria-hidden />
    </div>
  )
}

export default function PipelineCard({
  pendingReview,
  needsEnrichment,
  cardCls,
}: Props) {
  return (
    <div className={`${cardCls} col-span-full`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">How books are added</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            How a ban record enters the live catalogue today.
          </p>
        </div>
        <a
          href="/admin/scripts#new-source"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand/90 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden />
          Add new source
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 lg:gap-2 mt-1">
        {/* Step 1 — Source */}
        <div className="flex flex-col gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50/40">
          <PhaseHeader Icon={Download} n={1} label="Source" />
          <p className="text-xs text-gray-500 leading-snug">
            Pick a source — a published list, court ruling, or dataset. Each becomes a curated import script.
          </p>
          <a
            href="/admin/scripts#new-source"
            className="text-xs text-brand font-medium hover:underline mt-auto"
          >
            Onboarding guide →
          </a>
        </div>

        <Arrow />

        {/* Step 2 — Import */}
        <a
          href="/admin/scripts#new-source"
          className="flex flex-col gap-2 p-3 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors bg-white"
        >
          <PhaseHeader Icon={ClipboardList} n={2} label="Import" />
          <p className="text-xs text-gray-500 leading-snug">
            Write &amp; run <code className="font-mono text-[11px]">scripts/import-*.ts</code> — writes{' '}
            <code className="font-mono text-[11px]">books</code> +{' '}
            <code className="font-mono text-[11px]">bans</code> directly. You vet the data before{' '}
            <code className="font-mono text-[11px]">--apply</code>: curation is the quality gate.
          </p>
          <p className="text-xs font-medium text-gray-700 mt-auto">
            Script guide →
          </p>
        </a>

        <Arrow />

        {/* Step 3 — Enrich */}
        <a
          href="/admin/scripts#master"
          className="flex flex-col gap-2 p-3 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors bg-white"
        >
          <PhaseHeader Icon={Sparkles} n={3} label="Enrich" />
          <p className="text-xs text-gray-500 leading-snug">
            Run <code className="font-mono text-[11px]">enrich-all.ts</code> to fill covers, ISBNs, descriptions, ban context, reasons.
          </p>
          <p className="text-xs font-medium text-gray-700 mt-auto">
            {needsEnrichment.toLocaleString('en')} books missing fields →
          </p>
        </a>
      </div>

      <p className="text-xs text-gray-400 mt-1">
        The old two-LLM ingest → review → approve queue is idle — books now arrive via curated direct-import scripts, so
        review happens before commit, not after.{' '}
        <a href="/admin/import-review" className="text-gray-500 hover:underline">
          Manual review queue{pendingReview > 0 ? ` (${pendingReview.toLocaleString('en')} pending)` : ''} →
        </a>
      </p>
    </div>
  )
}
