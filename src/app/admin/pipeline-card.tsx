import { ArrowRight, Download, ClipboardList, CheckCircle2, Sparkles, Plus } from 'lucide-react'

interface Props {
  pendingReview: number
  approvedLast7Days: number
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
  approvedLast7Days,
  needsEnrichment,
  cardCls,
}: Props) {
  return (
    <div className={`${cardCls} col-span-full`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">Import pipeline</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            How a ban record flows from a source into the live catalogue.
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-3 lg:gap-2 mt-1">
        {/* Step 1 — Ingest */}
        <div className="flex flex-col gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50/40">
          <PhaseHeader Icon={Download} n={1} label="Ingest" />
          <p className="text-xs text-gray-500 leading-snug">
            Source fetcher → 2× LLM verify (Gemini + GPT-4o) → gate decision.
          </p>
          <a
            href="/admin/scripts#new-source"
            className="text-xs text-brand font-medium hover:underline mt-auto"
          >
            Onboarding guide →
          </a>
        </div>

        <Arrow />

        {/* Step 2 — Review */}
        <a
          href="/admin/import-review"
          className="flex flex-col gap-2 p-3 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors bg-white relative"
        >
          {pendingReview > 0 && (
            <span className="absolute top-2 right-2 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
              {pendingReview}
            </span>
          )}
          <PhaseHeader Icon={ClipboardList} n={2} label="Review" />
          <p className="text-xs text-gray-500 leading-snug">
            Items the gate flagged (non-Latin, fuzzy match, disagreement, high-stakes source).
          </p>
          <p className="text-xs font-medium text-gray-700 mt-auto">
            {pendingReview.toLocaleString('en')} pending →
          </p>
        </a>

        <Arrow />

        {/* Step 3 — Approve & commit */}
        <div className="flex flex-col gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50/40">
          <PhaseHeader Icon={CheckCircle2} n={3} label="Approve" />
          <p className="text-xs text-gray-500 leading-snug">
            Creates <code className="font-mono text-[11px]">books</code> +{' '}
            <code className="font-mono text-[11px]">bans</code> rows. No GPT enrichment yet — only verified metadata.
          </p>
          <p className="text-xs text-gray-500 mt-auto">
            <span className="font-medium text-gray-700 tabular-nums">
              {approvedLast7Days.toLocaleString('en')}
            </span>{' '}
            approved last 7 days
          </p>
        </div>

        <Arrow />

        {/* Step 4 — Enrich */}
        <a
          href="/admin/scripts#after-approval"
          className="flex flex-col gap-2 p-3 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors bg-white"
        >
          <PhaseHeader Icon={Sparkles} n={4} label="Enrich" />
          <p className="text-xs text-gray-500 leading-snug">
            Run <code className="font-mono text-[11px]">enrich-all.ts</code> to fill covers, ISBNs, descriptions, ban context, reasons.
          </p>
          <p className="text-xs font-medium text-gray-700 mt-auto">
            {needsEnrichment.toLocaleString('en')} books missing fields →
          </p>
        </a>
      </div>

      <p className="text-xs text-gray-400 mt-1">
        Items in the review queue have already been verified by two LLMs (gating only) — descriptions, covers, and
        reason classifications are filled in step 4, after you approve.
      </p>
    </div>
  )
}
