import { Terminal, DollarSign, AlertTriangle, CheckCircle, Plus, Wrench, Sparkles, ShieldCheck, RefreshCw, ImageIcon, GitBranch, FileText } from 'lucide-react'
import EnrichRunner from './enrich-runner'

const cardCls = 'border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col gap-4 bg-white dark:bg-gray-900'

function Code({ children }: { children: string }) {
  return (
    <code className="block bg-gray-950 text-green-400 text-xs rounded-lg px-4 py-3 font-mono whitespace-pre overflow-x-auto">
      {children}
    </code>
  )
}

function Tag({ type }: { type: 'free' | 'gpt' | 'claude' | 'destructive' | 'safe' }) {
  const styles = {
    free: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    gpt: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    claude: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    destructive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    safe: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  }
  const labels = {
    free: '✓ free APIs',
    gpt: '$ OpenAI cost',
    claude: '$ Anthropic cost',
    destructive: '⚠ destructive',
    safe: 'read-only',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[type]}`}>
      {labels[type]}
    </span>
  )
}

function Script({
  name,
  what,
  tags,
  command,
  flags,
  writes,
  note,
}: {
  name: string
  what: string
  tags: ('free' | 'gpt' | 'claude' | 'destructive' | 'safe')[]
  command: string
  flags?: { flag: string; desc: string }[]
  writes?: React.ReactNode
  note?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 pt-4 first:pt-0 border-t first:border-0 border-gray-100 dark:border-gray-800">
      <div className="flex flex-wrap items-start gap-2">
        <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</span>
        <div className="flex gap-1.5 flex-wrap">
          {tags.map(t => <Tag key={t} type={t} />)}
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">{what}</p>
      <Code>{command}</Code>
      {flags && flags.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs mt-0.5">
          {flags.map(f => (
            <div key={f.flag} className="contents">
              <dt className="font-mono text-gray-500 dark:text-gray-400 shrink-0">{f.flag}</dt>
              <dd className="text-gray-600 dark:text-gray-400">{f.desc}</dd>
            </div>
          ))}
        </dl>
      )}
      {writes && (
        <p className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2">
          <span className="font-semibold text-gray-800 dark:text-gray-200">Writes:</span> {writes}
        </p>
      )}
      {note && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">{note}</p>
      )}
    </div>
  )
}

function Row({ field, script, tag }: { field: string; script: string; tag?: 'free' | 'gpt' | 'claude' }) {
  return (
    <div className="contents">
      <dt className="text-sm text-gray-700 dark:text-gray-300 self-center">{field}</dt>
      <dd className="font-mono text-xs text-gray-600 dark:text-gray-400 self-center flex items-center gap-2">
        <span>{script}</span>
        {tag && <Tag type={tag} />}
      </dd>
    </div>
  )
}

export default function ScriptsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-4">
        <a
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          ← Admin dashboard
        </a>
      </div>
      <div className="mb-8">
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
          <a href="/admin" className="hover:text-gray-600 dark:hover:text-gray-300">Admin</a> / Enrichment &amp; sources
        </p>
        <h1 className="text-2xl font-bold">Enrichment &amp; sources</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Steps 1, 2, and 4 of the import pipeline — ingest a new source, sweep the review queue,
          then enrich approved books.
          All commands run from the project root; dry-run by default, add{' '}
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">--apply</code>{' '}
          (or <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">--write</code> for add-scripts)
          to commit.
        </p>
      </div>

      {/* Where am I in the pipeline? */}
      <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Where this page fits</h2>
        </div>
        <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 leading-relaxed">
          <li>
            <strong className="text-gray-800 dark:text-gray-200">1. Ingest</strong> — write or adapt a{' '}
            <code className="font-mono text-[11px]">scripts/add-&lt;source&gt;.ts</code> (direct write) or register the
            source in <code className="font-mono text-[11px]">source-registry.ts</code> (review-queue path).{' '}
            <a href="#new-source" className="text-brand hover:underline">Onboarding guide ↓</a>
          </li>
          <li>
            <strong className="text-gray-800 dark:text-gray-200">2. Review</strong> — for queue-path sources, items
            land at <a href="/admin/import-review" className="text-brand hover:underline">/admin/import-review</a>.{' '}
            Triage helpers (e.g. re-map <code className="font-mono text-[11px]">unmapped_reason</code> flags after a
            mapper update) live under{' '}
            <a href="#review-queue-helpers" className="text-brand hover:underline">Queue helpers ↓</a>.
          </li>
          <li>
            <strong className="text-gray-800 dark:text-gray-200">3. Approve</strong> — creates bare{' '}
            <code className="font-mono text-[11px]">books</code> + <code className="font-mono text-[11px]">bans</code>{' '}
            rows. No covers, descriptions, or reason classifications yet.
          </li>
          <li>
            <strong className="text-gray-800 dark:text-gray-200">4. Enrich</strong> — run{' '}
            <code className="font-mono text-[11px]">enrich-all.ts</code> to fill the open fields.{' '}
            <a href="#after-approval" className="text-brand hover:underline">Enrichment guide ↓</a>
          </li>
        </ol>
      </div>

      <div className="flex flex-col gap-6">

        {/* Live runner — triggers enrichment from the browser */}
        <EnrichRunner />

        {/* Prerequisites */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
            <h2 className="font-semibold">Prerequisites</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ensure <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">.env.local</code> exists
            in the project root with <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">SUPABASE_SERVICE_ROLE_KEY</code>,
            (for GPT scripts) <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">OPENAI_API_KEY</code>, and
            (for Claude scripts) <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">ANTHROPIC_API_KEY</code>.
          </p>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              <span className="text-gray-600 dark:text-gray-400">Green = free (Open Library, Google Books, Wikipedia)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-gray-600 dark:text-gray-400">Amber = OpenAI (GPT-4o / 4o-mini)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-gray-600 dark:text-gray-400">Orange = Anthropic (Claude Opus)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-gray-600 dark:text-gray-400">Red = destructive / overwrites existing data</span>
            </span>
          </div>
        </div>

        {/* Daily quick reference */}
        <div className={cardCls}>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">What do you want to do?</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-6 gap-y-3 text-sm">
            {[
              ['Add a new source (PEN list, court ruling, etc.)', 'see "Adding a new source" below'],
              ['Re-map unmapped_reason flags in the review queue', 'remap-unmapped-queue.ts --write'],
              ['Fill all open fields after an import', 'enrich-all.ts --apply'],
              ['Same, fastest cheap pass first', 'enrich-all.ts --apply --free-only --no-gutenberg'],
              ['Refresh public stats / countries', 'refresh-mv.ts'],
              ['Improve weak ban descriptions', 'see "Description quality" below'],
              ['Fix a bad cover permanently', 'mark-cover-override.ts <slug>'],
              ['Backfill author photos', 'enrich-author-bios.ts --photos-only --apply'],
              ['Audit overall data quality', 'audit-db.ts'],
              ['Recompute data-quality classification (confident / default / flagged)', 'score-data-quality.ts --write'],
              ['Generate Reading Club discussion questions', 'generate-discussion-questions.ts --apply'],
            ].map(([task, script]) => (
              <div key={task} className="contents">
                <dt className="text-gray-700 dark:text-gray-300">{task}</dt>
                <dd className="font-mono text-xs text-gray-500 dark:text-gray-400 self-center">{script}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Workflow A — adding a new source */}
        <div id="new-source" className={`${cardCls} scroll-mt-4`}>
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Adding a new source</h2>
          </div>
          <div className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <strong>Two paths exist.</strong> Use <em>add-scripts</em> (below) for trusted Latin-script lists
            that should go straight into <code className="font-mono text-[11px]">books</code> (PEN, ALA, US state lists).
            For non-Latin scripts, court rulings, or government sources, register the source in{' '}
            <code className="font-mono text-[11px]">src/lib/imports/source-registry.ts</code> and use the Wikipedia/
            <code className="font-mono text-[11px]">run-import-job</code> pipeline so items pass through{' '}
            <a href="/admin/import-review" className="underline hover:no-underline">/admin/import-review</a> first.
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Workflow for ingesting a new ban list, court ruling, or curated source. Each step is idempotent,
            so re-runs only touch records that still need work.
          </p>

          <ol className="flex flex-col gap-4 text-sm text-gray-700 dark:text-gray-300 list-decimal list-outside ml-5">
            <li>
              <p className="mb-2">
                <strong>Import the books.</strong> Copy a working template and adapt it — each source has its own
                quirks (which countries to attach, which reasons map cleanly, source URLs).
              </p>
              <Code>{`# Templates that match the source shape
scripts/add-pen-america-books.ts    # large US challenge list
scripts/add-cdhe-colorado.ts        # state-level US bans
scripts/add-ala-2025.ts             # ALA top-10 list
scripts/add-bulk-books.ts           # generic catch-all

# Run after editing
npx tsx --env-file=.env.local scripts/add-<your-source>.ts --write`}</Code>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Add scripts use <code className="font-mono">--write</code>, not <code className="font-mono">--apply</code>.
                They create books, authors, bans, ban-reason links, and source rows in one pass.
              </p>
            </li>

            <li>
              <p className="mb-2">
                <strong>Fill open fields.</strong> The master pipeline runs every per-field step in order,
                only touching records the new books left empty.
              </p>
              <Code>{`# Cheap pass — free APIs only, skips slow Gutenberg lookup
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --free-only --no-gutenberg

# Then GPT pass for what's still missing (descriptions, ban context, reasons)
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --no-gutenberg

# Or run everything in one go (slower because of Gutenberg)
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply`}</Code>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                See <code className="font-mono">enrich-all.ts</code> reference below for all flags.
              </p>
            </li>

            <li>
              <p className="mb-2">
                <strong>Refresh materialized views</strong> so countries / stats / trending pages reflect the new data.
              </p>
              <Code>{`npx tsx --env-file=.env.local scripts/refresh-mv.ts`}</Code>
            </li>

            <li>
              <p className="mb-2">
                <strong>(Optional) Editorial classification.</strong> Suggests warning_level and inclusion_rationale
                for newly-added books that don&apos;t have them yet.
              </p>
              <Code>{`# Small batch first to inspect output
npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --apply --limit=50`}</Code>
            </li>
          </ol>
        </div>

        {/* Step 2 — review-queue helpers */}
        <div id="review-queue-helpers" className={`${cardCls} scroll-mt-4`}>
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              Step 2 — Review-queue helpers
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
            Run these against items in{' '}
            <a href="/admin/import-review" className="text-brand hover:underline">/admin/import-review</a>{' '}
            <em>before</em> you approve — they patch queue rows in place so the operator sees
            a better starting point.
          </p>

          <Script
            name="remap-unmapped-queue.ts"
            what={`Re-runs reason mapping over pending queue rows that still carry the unmapped_reason flag. Two passes: (1) the current strict mapReason() — useful after the wikipedia reason-mapper patterns have been extended; pass-1 hits drop the unmapped_reason flag entirely. (2) Broader keyword heuristic ported from reclassify-other-reasons.ts; pass-2 hits set a low-confidence slug but keep the unmapped_reason flag so the operator recognises the suggestion as a guess.`}
            tags={['safe']}
            command={`# Dry-run — prints every row it would touch
npx tsx --env-file=.env.local scripts/remap-unmapped-queue.ts

# Apply
npx tsx --env-file=.env.local scripts/remap-unmapped-queue.ts --write`}
            flags={[
              { flag: '--write', desc: 'Persist changes to agreement_details (default: dry-run)' },
            ]}
            writes={
              <>
                Updates <code className="font-mono">import_review_queue.agreement_details</code>{' '}
                on rows where <code className="font-mono">status=&apos;pending_review&apos;</code> AND{' '}
                <code className="font-mono">quality_flags</code> contains{' '}
                <code className="font-mono">&apos;unmapped_reason&apos;</code>. Pass-1 hits overwrite{' '}
                <code className="font-mono">reason_mapping</code> with the strict-mapper result and remove{' '}
                <code className="font-mono">unmapped_reason</code> from <code className="font-mono">quality_flags</code>.
                Pass-2 hits write a <code className="font-mono">{`{ slug, confidence: 'low' }`}</code> mapping
                but leave the flag in place. Rows with empty <code className="font-mono">notes_raw</code> or no
                keyword signal are skipped.
              </>
            }
            note="Idempotent. Re-run any time you extend reason-mapper.ts patterns to backfill earlier imports."
          />
        </div>

        {/* Master pipeline reference */}
        <div id="after-approval" className={`${cardCls} scroll-mt-4`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">After approval — enrich-all.ts</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
            Run this after approving items in the{' '}
            <a href="/admin/import-review" className="text-brand hover:underline">review queue</a> (or after a direct-write
            add-script) to fill covers, descriptions, ban context, and reason classifications on the new books.
          </p>
          <Script
            name="enrich-all.ts"
            what="Runs ISBN, covers (first-pass + v2 with placeholder rejection), Gutenberg, descriptions (with GPT fallback for what OL/Google Books missed), ban descriptions, censorship context, and ban reason classifications — in that order. Every step is idempotent. This is what to run after an import."
            tags={['free', 'gpt']}
            command={`# Dry-run — shows eligible counts per step
npx tsx --env-file=.env.local scripts/enrich-all.ts

# Full run (free + GPT)
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply

# Cheapest-first — free APIs, no Gutenberg
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --free-only --no-gutenberg

# Everything except slow Gutenberg lookup
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --no-gutenberg

# Cap GPT steps (incremental run)
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --gpt-limit=50`}
            flags={[
              { flag: '--apply', desc: 'Write to database (omit for dry-run)' },
              { flag: '--free-only', desc: 'Skip all GPT steps' },
              { flag: '--no-gutenberg', desc: 'Skip Gutenberg ID lookup (slow; safe to skip day-to-day)' },
              { flag: '--gpt-limit=N', desc: 'Cap each GPT step at N books (default 150)' },
            ]}
            writes={
              <>
                Each step is <strong>fill-only on its own field</strong> — existing values are never overwritten.{' '}
                <strong>Exception:</strong> the reason-classification step (<code className="font-mono">enrich-reasons.ts</code>)
                replaces <code className="font-mono">ban_reason_links</code> for bans whose reasons are <em>exclusively</em>{' '}
                <code className="font-mono">&apos;other&apos;</code> (DELETE + INSERT). Bans with any specific reason already
                set are never touched.
              </>
            }
            note="Cover step uses pHash to detect Google Books 'image not available' placeholders and rejects them. Books that fail get cover_status='rejected_placeholder' so they're skipped on future runs — pass --force on the cover step to re-check them."
          />
        </div>

        {/* Per-component enrichment */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Enrich a single field</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Use these when only one field type needs filling — otherwise prefer <code className="font-mono">enrich-all.ts</code>{' '}
            which sequences them correctly. All accept <code className="font-mono">--apply</code> and most accept{' '}
            <code className="font-mono">--limit=N</code>.
          </p>

          <dl className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-6 gap-y-2.5 mt-2">
            <Row field="ISBN-13" script="enrich-isbn.ts" tag="free" />
            <Row field="Cover images" script="enrich-covers-v2.ts" tag="free" />
            <Row field="Book descriptions (with GPT fallback)" script="enrich-descriptions.ts" tag="gpt" />
            <Row field="Ban descriptions (why this book in this country)" script="enrich-ban-descriptions-gpt.ts" tag="gpt" />
            <Row field="Censorship context (broader political background)" script="enrich-censorship-context-gpt.ts" tag="gpt" />
            <Row field="Ban reason classification" script="enrich-reasons.ts" tag="gpt" />
            <Row field="Author bios (Wikipedia)" script="enrich-author-bios.ts" tag="free" />
            <Row field="Author photos — second pass (Wikidata + OpenLibrary + author site)" script="enrich-author-photos-v2.ts" tag="free" />
            <Row field="Genres (1–3 slugs from fixed vocabulary)" script="enrich-genres-gpt.ts" tag="gpt" />
            <Row field="Editorial classification suggestions" script="suggest-editorial-classification-gpt.ts" tag="gpt" />
            <Row field="Reading Club discussion questions" script="generate-discussion-questions.ts" tag="claude" />
          </dl>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Detailed reference for each script below.
          </p>

          <Script
            name="enrich-isbn.ts"
            what="Finds missing ISBN-13 via Open Library (title+author across the title ladder: canonical → transliteration → English-meaningful) and Google Books. Excludes '— All works' author-omnibus pseudo-titles (no real ISBN exists for them). Pre-checks the candidate ISBN against the books table — false positives that collide with another row are skipped rather than crashing the run on the books_isbn13_key unique constraint. (The previous OL title-only retry was dropped 2026-05-16 — it surfaced 19th-century-classic ISBNs on modern titles. Author-name mismatches are now handled via the title ladder instead.)"
            tags={['free']}
            command={`npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply
npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply --limit=200`}
            flags={[
              { flag: '--apply', desc: 'Write isbn13 to database' },
              { flag: '--limit=N', desc: 'Cap at N books per run' },
            ]}
            writes={
              <>
                Only fills empty <code className="font-mono">isbn13</code>. Candidate ISBNs already on another
                row are skipped and counted under <code className="font-mono">Skipped (ISBN already on another row)</code>{' '}
                in the summary.
              </>
            }
            note="OL/GB occasionally surface POD/9798-prefix reprints that share an ISBN with an unrelated canonical edition — the pre-write duplicate check catches those. Pseudo-title filter is title ILIKE '%— All works%' at the SELECT level."
          />

          <Script
            name="enrich-covers-v2.ts"
            what="Fetches missing cover images via Google Books (title-only), Open Library (subtitle stripped), Wikipedia thumbnail. Google Books URLs are pHash-checked against the official 'image not available' placeholder; matches are rejected and the book gets cover_status='rejected_placeholder' so future runs skip it."
            tags={['free']}
            command={`npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply
npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --reset
npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --force`}
            flags={[
              { flag: '--apply', desc: 'Write cover_url / cover_status' },
              { flag: '--limit=N', desc: 'Cap at N books per run' },
              { flag: '--reset', desc: 'Re-try previously failed books' },
              { flag: '--force', desc: 'Bypass cover_status skip (re-check rejected_placeholder & manual_override)' },
            ]}
            writes={
              <>
                Only fills empty <code className="font-mono">cover_url</code> (and only on books with{' '}
                <code className="font-mono">cover_status</code> NULL or <code className="font-mono">&apos;valid&apos;</code>).
                With <code className="font-mono">--force</code>, also overwrites books with{' '}
                <code className="font-mono">&apos;rejected_placeholder&apos;</code> or <code className="font-mono">&apos;manual_override&apos;</code>;
                with <code className="font-mono">--reset</code>, retries books that previously failed.
              </>
            }
            note="Reference image lives at assets/google-books-placeholder.png. Hamming threshold = 5."
          />

          <Script
            name="enrich-descriptions.ts"
            what="Fills missing book descriptions. Tries Open Library, then Google Books, then GPT-4o-mini for books neither found. Also fixes truncated descriptions (no sentence-final punctuation). With --slug or --overwrite it re-enriches even books that already have a description_book — useful for replacing earlier GPT-drafted text with OL/GB content after the title-ladder has been improved."
            tags={['free', 'gpt', 'destructive']}
            command={`# Default — only books with empty description_book
npx tsx --env-file=.env.local scripts/enrich-descriptions.ts --apply

# Re-enrich one specific book (overwrites existing)
npx tsx --env-file=.env.local scripts/enrich-descriptions.ts --apply --slug=the-kite-runner

# Re-enrich the first 50 books alphabetically, overwriting existing
npx tsx --env-file=.env.local scripts/enrich-descriptions.ts --apply --overwrite --limit=50`}
            flags={[
              { flag: '--apply', desc: 'Write description_book; sets ai_drafted=true for GPT-generated rows' },
              { flag: '--limit=N', desc: 'Cap at N books per run' },
              { flag: '--slug=<slug>', desc: 'Re-enrich a single book, overwriting any existing description_book' },
              { flag: '--overwrite', desc: 'Process all books (not just NULL ones); overwrites existing description_book' },
            ]}
            writes={
              <>
                <strong>Default mode:</strong> only fills empty <code className="font-mono">description_book</code>. Repairs truncated{' '}
                <code className="font-mono">description</code> strings by writing the repaired version into{' '}
                <code className="font-mono">description_book</code> — the original <code className="font-mono">description</code> field is never modified.{' '}
                <strong>With <code className="font-mono">--slug</code> or <code className="font-mono">--overwrite</code>:</strong>{' '}
                runs Part B (OL → GB → GPT) over the targeted rows and <strong>overwrites</strong>{' '}
                <code className="font-mono">description_book</code> regardless of its current value.{' '}
                <code className="font-mono">ai_drafted</code> is rewritten too (true when GPT was used, false otherwise).
                Part A (truncated-repair) is skipped in overwrite mode.
              </>
            }
            note="No backup is written before overwriting. Sanity-check on a single --slug first; combine --overwrite with --limit for staged rollouts."
          />

          <Script
            name="enrich-ban-descriptions-gpt.ts"
            what="Generates per-ban descriptions — explains why this specific book was banned in this specific country. With --slug or --overwrite it re-generates even when description_ban is already filled."
            tags={['gpt', 'destructive']}
            command={`# Default — only books with empty description_ban
npx tsx --env-file=.env.local scripts/enrich-ban-descriptions-gpt.ts --apply --limit=100

# Re-generate one specific book (overwrites existing)
npx tsx --env-file=.env.local scripts/enrich-ban-descriptions-gpt.ts --apply --slug=the-kite-runner

# Re-generate all books, overwriting existing description_ban
npx tsx --env-file=.env.local scripts/enrich-ban-descriptions-gpt.ts --apply --overwrite --limit=50`}
            flags={[
              { flag: '--apply', desc: 'Write ban descriptions' },
              { flag: '--limit=N', desc: 'Cap at N bans (default 999 in apply mode, 3 in dry-run)' },
              { flag: '--slug=<slug>', desc: 'Re-generate for a single book, overwriting any existing description_ban' },
              { flag: '--overwrite', desc: 'Process all books with bans (not just NULL ones); overwrites existing description_ban' },
              { flag: '--delay=N', desc: 'Milliseconds between calls (default 500)' },
            ]}
            writes={
              <>
                <strong>Default mode:</strong> only fills empty <code className="font-mono">description_ban</code>.{' '}
                <strong>With <code className="font-mono">--slug</code> or <code className="font-mono">--overwrite</code>:</strong>{' '}
                <strong>overwrites</strong> <code className="font-mono">description_ban</code> regardless of current value.
                No backup is written.
              </>
            }
            note="Sanity-check on a single --slug first before running --overwrite."
          />

          <Script
            name="enrich-censorship-context-gpt.ts"
            what="Generates broader censorship context — political/historical background for a country's censorship of a book."
            tags={['gpt']}
            command={`npx tsx --env-file=.env.local scripts/enrich-censorship-context-gpt.ts --apply --limit=50`}
            flags={[
              { flag: '--apply', desc: 'Write censorship context' },
              { flag: '--limit=N', desc: 'Cap at N records (default 150)' },
            ]}
            writes={
              <>
                Only fills empty <code className="font-mono">censorship_context</code>, and only on books that already have a{' '}
                <code className="font-mono">description_book</code>.
              </>
            }
          />

          <Script
            name="enrich-reasons.ts"
            what="Auto-classifies ban reasons (political, religious, sexual content…) via GPT for bans currently tagged as 'other'."
            tags={['gpt']}
            command={`npx tsx --env-file=.env.local scripts/enrich-reasons.ts --apply`}
            flags={[
              { flag: '--apply', desc: 'Update ban reason classifications' },
            ]}
            writes={
              <>
                <strong>Replaces</strong> <code className="font-mono">ban_reason_links</code> for bans whose reasons are{' '}
                <em>exclusively</em> <code className="font-mono">&apos;other&apos;</code> (DELETE + INSERT). Bans with any specific
                reason already attached are never touched.
              </>
            }
          />

          <Script
            name="enrich-author-bios.ts"
            what="Fills missing author bios, birth/death year, birth country, and photos from Wikipedia. Only touches authors with no bio. Use --photos-only to backfill pictures for authors who already have a bio (e.g. when their Wikipedia page now has an infobox image)."
            tags={['free']}
            command={`# Fill bios for up to 50 authors
npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --apply

# Larger batch
npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --apply --limit=200

# Photo-only backfill for already-bio'd authors
npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --photos-only --apply --limit=500`}
            flags={[
              { flag: '--apply', desc: 'Write bio, birth_year, death_year, birth_country, photo_url' },
              { flag: '--limit=N', desc: 'Cap at N authors per run (default 50)' },
              { flag: '--photos-only', desc: 'Only target authors with bio but no photo' },
            ]}
            writes={
              <>
                Default mode: only targets authors with empty <code className="font-mono">bio</code>. For those authors writes{' '}
                <code className="font-mono">bio</code> + (when Wikipedia returns a value){' '}
                <code className="font-mono">birth_year</code> / <code className="font-mono">death_year</code> /{' '}
                <code className="font-mono">birth_country</code> / <code className="font-mono">photo_url</code> —
                so any manual values on those four fields can get overwritten if the author had no bio yet.
                With <code className="font-mono">--photos-only</code>: only fills empty <code className="font-mono">photo_url</code> on
                authors who already have a bio; nothing else is touched.
              </>
            }
          />

          <Script
            name="enrich-author-photos-v2.ts"
            what="Second-pass photo backfill — what enrich-author-bios.ts couldn't find via Wikipedia article search. Three sources tried in order: (1) Wikidata (P31=Q5 human + writer-ish P106 → P18 → Commons thumbnail); (2) OpenLibrary /search/authors fallback, HEAD-checked; (3) author personal site — Wikipedia title → QID (gated on P31=Q5 + P106 writer-ish so fuzzy matches don't wire a stranger's portrait) → candidate sites from Wikidata P856 + Wikipedia External Links section (hostname must contain a name token, aggregators/socials/retailers denylisted) → fetched with a desktop Chrome UA → JSON-LD Person.image, plus <img> tags scored by author-name tokens in alt + URL with a non-portrait keyword denylist (logos, banners, ISBN-named book covers). og:image/twitter:image were tried earlier but 4/4 false positives in a sample run — site templates use them for branding — so the site source is precision-over-recall: lower hit rate, near-zero false positives. Logs every attempt to data/photo-enrichment-{ts}.csv for spot-checking."
            tags={['free']}
            command={`# Apply on 250 authors (~10 min runtime)
npx tsx --env-file=.env.local scripts/enrich-author-photos-v2.ts --apply --limit=250`}
            flags={[
              { flag: '--apply', desc: 'Write photo_url to DB (omit for dry-run)' },
              { flag: '--limit=N', desc: 'Cap at N authors per run (default 50)' },
            ]}
            writes={<>Only fills empty <code className="font-mono">photo_url</code>.</>}
            note="Run AFTER enrich-author-bios.ts --photos-only — that's the cheap easy first sweep. v2 yields a few % more. Heads-up: the `site` source can return URLs on hosts outside src/lib/allowed-image-hosts.ts (any author's personal CDN); those URLs are stored fine but the Next.js image optimizer will refuse them at render time — the AuthorAvatar component falls back to initials via onError, so the user-visible degradation is graceful. Add common hosts (e.g. squarespace-cdn.com, weebly.com) to the whitelist after a v2 run if you notice many initials where photos should be."
          />

          <Script
            name="enrich-genres-gpt.ts"
            what="Picks 1–3 genre slugs from the fixed 21-slug vocabulary (src/components/genre-badge.tsx) using title + author + first_published_year + description_book as signal. Only targets books with an empty genres array; manual edits and seed-genres.ts entries survive re-runs."
            tags={['gpt']}
            command={`# Dry-run on 5 samples
npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts

# Test on one specific book
npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --slug=animal-farm

# Small batch first
npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --apply --limit=100

# Full sweep
npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --apply`}
            flags={[
              { flag: '--apply', desc: 'Write genres to DB (omit for dry-run)' },
              { flag: '--limit=N', desc: 'Cap at N books (default 999 in apply mode, 5 in dry-run)' },
              { flag: '--slug=X', desc: 'Re-classify a single book (works with or without --overwrite)' },
              { flag: '--overwrite', desc: 'Process books that already have genres too' },
              { flag: '--delay=N', desc: 'Milliseconds between calls (default 300)' },
              { flag: '--model=X', desc: 'Override model (default gpt-4o-mini)' },
            ]}
            writes={
              <>
                Only targets books where <code className="font-mono">genres = &apos;{'{}'}&apos;</code> (empty array).
                Writes 1–3 slugs from the fixed vocabulary. Books where GPT returns no slugs or low confidence are
                skipped — they stay in the candidate pool for a later, smarter pass or manual editing via the admin.
              </>
            }
            note="Genre vocabulary lives in src/components/genre-badge.tsx (21 slugs). The script mirrors that list — keep them in sync until the vocabulary moves to a DB table. Estimated cost: ~€1–€3 for the full backlog at gpt-4o-mini pricing."
          />

          <Script
            name="suggest-editorial-classification-gpt.ts"
            what="GPT-powered classifier for unclassified books. Sends metadata + ban context to gpt-4o-mini with the editorial framework as system prompt; gets back warning_level + inclusion_rationale + confidence as structured JSON. Auto-applies low-risk results, flags high-risk for review."
            tags={['gpt']}
            command={`# Test on one book
npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --slug=lolita

# Small batch first
npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --apply --limit=50

# Full catalogue
npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --apply --limit=5000`}
            flags={[
              { flag: '--apply', desc: 'Auto-apply low-risk; write review file for high-risk' },
              { flag: '--limit=N', desc: 'Cap at N books (default 100 in apply mode, 3 in dry-run)' },
              { flag: '--slug=X', desc: 'Test on a single book' },
              { flag: '--model=X', desc: 'Override model (default gpt-4o-mini)' },
            ]}
            writes={
              <>
                Only targets books where <code className="font-mono">warning_level=&apos;none&apos;</code> AND{' '}
                <code className="font-mono">inclusion_rationale IS NULL</code>. Writes <code className="font-mono">warning_level</code>{' '}
                (always <code className="font-mono">&apos;none&apos;</code>; tier upgrades are always manual via admin) +{' '}
                <code className="font-mono">inclusion_rationale</code>. Manual edits via admin survive re-runs.
              </>
            }
            note="Three outcomes: (1) AUTO-APPLY when warning_level='none' at confidence ≥ medium → rationale written. (2) WRITE + FLAG when 'context'/'extended' at confidence ≥ medium → rationale written at none tier AND logged to data/editorial-review-<ts>.json. (3) REVIEW-ONLY when exclude=true or low confidence → no DB write. Tier upgrades are always manual via admin. Estimated cost: ~€2–€5 for the full ~4.4k catalogue."
          />

          <Script
            name="generate-discussion-questions.ts"
            what="Generates 5–10 book-specific discussion questions for every Reading Club row missing them. Auto-detects provider — prefers Claude Opus 4.7 with adaptive thinking when ANTHROPIC_API_KEY is set, falls back to OpenAI gpt-4o."
            tags={['claude', 'gpt']}
            command={`# Generate for all eligible rows
npx tsx --env-file=.env.local scripts/generate-discussion-questions.ts --apply

# Small batch first
npx tsx --env-file=.env.local scripts/generate-discussion-questions.ts --apply --limit=10

# Materialize auto-pull theme books too
npx tsx --env-file=.env.local scripts/generate-discussion-questions.ts --apply --include-auto-themes`}
            flags={[
              { flag: '--apply', desc: 'Call the LLM and write the result' },
              { flag: '--limit=N', desc: 'Cap at N rows per run' },
              { flag: '--include-auto-themes', desc: 'Materialize auto-pull books for empty themes, then process them' },
              { flag: '--provider=X', desc: 'Force claude or openai (default: auto-detect)' },
              { flag: '--force', desc: 'Regenerate even when questions already exist' },
            ]}
            writes={
              <>
                Default: only fills Reading Club rows with empty <code className="font-mono">discussion_questions</code>.
                With <code className="font-mono">--force</code>, <strong>overwrites</strong> existing question arrays.
              </>
            }
            note="Cost (50 rows): ~$1–2 with Claude Opus 4.7, ~$0.10 with gpt-4o. Idempotent by default — only fills empty rows."
          />
        </div>

        {/* Description quality pipeline */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Description quality — three-step pipeline</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            For improving existing weak descriptions (filler-heavy, ungrounded). Run in order; each step writes
            CSV backups to <code className="font-mono">data/</code> so the whole pipeline is reversible.
          </p>

          <Script
            name="1. strip-filler-sentences.ts"
            what="Free, regex-only. Removes whole filler sentences and trailing filler clauses ('reflecting a growing trend of…', 'There are no documented lawsuits…', 'This case illustrates…') from existing description_ban / censorship_context. Preserves named-case content. Outputs three CSVs: backup, log, needs-rewrite (slugs left too short)."
            tags={['safe']}
            command={`# Dry-run — shows samples
npx tsx --env-file=.env.local scripts/strip-filler-sentences.ts

# Apply across the whole catalogue
npx tsx --env-file=.env.local scripts/strip-filler-sentences.ts --apply

# Test on one book
npx tsx --env-file=.env.local scripts/strip-filler-sentences.ts --slug=princess-lessons`}
            flags={[
              { flag: '--apply', desc: 'Write to DB (without it, prints proposed strips)' },
              { flag: '--slug=X', desc: 'Only process one book' },
            ]}
            writes={
              <>
                <strong>Overwrites</strong> <code className="font-mono">description_ban</code> and{' '}
                <code className="font-mono">censorship_context</code> on every book where filler regex matches; backs up old
                values to <code className="font-mono">data/filler-strip-backup-&lt;ts&gt;.csv</code> first. Sets the field to{' '}
                <code className="font-mono">NULL</code> if the stripped result is too short — those slugs are listed in{' '}
                <code className="font-mono">filler-strip-needs-rewrite-&lt;ts&gt;.csv</code> for step 3.
              </>
            }
            note="Output CSVs: data/filler-strip-backup-<ts>.csv (rollback), data/filler-strip-log-<ts>.csv (new values), data/filler-strip-needs-rewrite-<ts>.csv (feed into step 3)."
          />

          <Script
            name="2. score-descriptions.ts"
            what="Scores description_ban + censorship_context across the whole catalogue 0–3 on concreteness (3 = named case/court/district + year+place; 1 = generic; 0 = empty). Writes data/description-audit-<ts>.csv. Cheap (gpt-4o-mini, ~$1–2 for the full library). Filler-detection regex auto-caps at score 1 if the field still contains generic phrases."
            tags={['gpt']}
            command={`# Dry-run on 10 books
npx tsx --env-file=.env.local scripts/score-descriptions.ts

# Score the entire catalogue
npx tsx --env-file=.env.local scripts/score-descriptions.ts --apply`}
            flags={[
              { flag: '--apply', desc: 'Score all and write CSV' },
              { flag: '--limit=N', desc: 'Cap at N books per run' },
              { flag: '--concurrency=N', desc: 'Parallel API calls (default 5)' },
            ]}
            writes={<>No DB writes — only writes the audit CSV.</>}
            note="Faster regex-only alternative: flag-filler-rewrites.ts (no LLM, only catches known filler patterns)."
          />

          <Script
            name="3. rewrite-descriptions-grounded.ts"
            what="Reads an audit CSV and rewrites only weak fields (score ≤1) using OpenAI's Responses API with the built-in web_search tool. Prefers Wikipedia, ALA, NCAC, PEN America, Marshall Libraries. Backs up old values to a CSV before any DB write."
            tags={['gpt']}
            command={`# Dry-run on 5 weak books
npx tsx --env-file=.env.local scripts/rewrite-descriptions-grounded.ts --audit=data/description-audit-<ts>.csv

# Rewrite all weak books
npx tsx --env-file=.env.local scripts/rewrite-descriptions-grounded.ts --audit=data/description-audit-<ts>.csv --apply

# Resume from a previous run
npx tsx --env-file=.env.local scripts/rewrite-descriptions-grounded.ts --audit=<csv> --apply --skip-log=data/description-rewrite-<prev-ts>.csv`}
            flags={[
              { flag: '--audit=<csv>', desc: 'Required. Path to CSV from score-descriptions.ts (or flag-filler-rewrites.ts)' },
              { flag: '--apply', desc: 'Write to DB' },
              { flag: '--limit=N', desc: 'Cap at N books per run' },
              { flag: '--slug=<slug>', desc: 'Only process one book' },
              { flag: '--include-2', desc: 'Also rewrite fields scored 2 (default: only 0–1)' },
              { flag: '--model=<id>', desc: 'OpenAI model (default gpt-4o)' },
              { flag: '--concurrency=N', desc: 'Parallel calls (default 3)' },
              { flag: '--skip-log=<csv>', desc: 'Resume — skip slugs already in this rewrite log' },
            ]}
            writes={
              <>
                <strong>Overwrites</strong> <code className="font-mono">description_ban</code> and/or{' '}
                <code className="font-mono">censorship_context</code> for fields scored ≤1 (or ≤2 with{' '}
                <code className="font-mono">--include-2</code>); backs up old values to{' '}
                <code className="font-mono">data/description-backup-&lt;ts&gt;.csv</code> before any write.
              </>
            }
            note="Backups: data/description-backup-<ts>.csv. Source URLs logged per book in data/description-rewrite-<ts>.csv. Inline citations are auto-stripped from output."
          />

          <Script
            name="flag-filler-rewrites.ts"
            what="Free regex sweep — finds books still containing known filler phrases and writes a fake-audit CSV that step 3 can target. Use this instead of step 2 when you only care about a specific filler regression and don't want to re-score everything."
            tags={['safe']}
            command={`npx tsx --env-file=.env.local scripts/flag-filler-rewrites.ts`}
            writes={<>No DB writes — only writes the flagged-books CSV.</>}
            note="Pairs with step 3: feed the produced CSV via --audit=<flagged.csv>."
          />
        </div>

        {/* Cover maintenance */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Cover maintenance</h2>
          </div>

          <Script
            name="mark-cover-override.ts"
            what="Permanently mark a book's cover as a manual override: clears cover_url, sets cover_status='manual_override'. enrich-covers-v2 will skip the book on every run unless --force."
            tags={['safe']}
            command={`npx tsx --env-file=.env.local scripts/mark-cover-override.ts <id-or-slug> --apply`}
            flags={[
              { flag: '<id-or-slug>', desc: 'Numeric book id or slug. Required.' },
              { flag: '--apply', desc: 'Write the change. Without it, prints what would change.' },
            ]}
            writes={
              <>
                <strong>Always overwrites</strong> for the specified book — clears <code className="font-mono">cover_url</code>{' '}
                and sets <code className="font-mono">cover_status=&apos;manual_override&apos;</code>. Targets exactly one book.
              </>
            }
            note="Use this when you've manually deleted a bad cover and want it gone forever."
          />

          <Script
            name="audit-covers-for-placeholders.ts"
            what="Retroactive sweep over existing Google Books cover URLs. Downloads each image, perceptual-hash-checks against the placeholder; on match clears cover_url + sets cover_status='rejected_placeholder'. Skips manual_override. Non-Google URLs are skipped."
            tags={['free', 'destructive']}
            command={`# Dry-run first to see how many would change
npx tsx --env-file=.env.local scripts/audit-covers-for-placeholders.ts

# Apply
npx tsx --env-file=.env.local scripts/audit-covers-for-placeholders.ts --apply --concurrency=8`}
            flags={[
              { flag: '--apply', desc: 'Write the changes' },
              { flag: '--limit=N', desc: 'Cap at N books per run' },
              { flag: '--concurrency=N', desc: 'Parallel HTTP fetches (default 4)' },
            ]}
            writes={
              <>
                <strong>Overwrites</strong> only for books whose existing <code className="font-mono">cover_url</code> is on
                books.google.com / googleusercontent.com AND matches the placeholder pHash: clears{' '}
                <code className="font-mono">cover_url</code> and sets{' '}
                <code className="font-mono">cover_status=&apos;rejected_placeholder&apos;</code>. Books with{' '}
                <code className="font-mono">cover_status=&apos;manual_override&apos;</code> are skipped. Non-Google URLs are not scanned.
              </>
            }
          />
        </div>

        {/* Audits */}
        <div className={cardCls}>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Audits — read-only</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Safe to run any time.</p>

          <dl className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 mt-2">
            <Row field="audit-db.ts" script="full database audit, missing fields, FK checks" />
            <Row field="check-dupes.ts" script="duplicate books (same title + author)" />
            <Row field="check-no-desc.ts" script="books still missing a description" />
            <Row field="check-coverage.ts" script="ISBN / cover / description / ban-desc coverage %" />
          </dl>
          <Code>{`npx tsx --env-file=.env.local scripts/audit-db.ts
npx tsx --env-file=.env.local scripts/check-dupes.ts
npx tsx --env-file=.env.local scripts/check-no-desc.ts
npx tsx --env-file=.env.local scripts/check-coverage.ts`}</Code>
        </div>

        {/* Data quality classification */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Data quality classification</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Recomputes the <code className="font-mono">data_quality_status</code> column on every book and author
            (<code className="font-mono">confident</code> / <code className="font-mono">default</code> /{' '}
            <code className="font-mono">flagged</code>) based on canonical-id presence, ban evidence, editorial
            completeness, and author legitimacy. Drives the UI indicators on{' '}
            <a href="/data-quality" className="text-brand hover:underline">/data-quality</a> and feeds schema.org
            JSON-LD <code className="font-mono">additionalProperty</code> for AI-citation surfaces. Run after every
            bulk enrichment pass so the labels reflect the latest data.
          </p>

          <Script
            name="score-data-quality.ts"
            what="Paginated reads of books + authors with joins (ban_source_links, book_authors). Classifies into three buckets and writes data/data-quality-report.md with per-bucket counts, top-25 confident sample, flag-frequency tables, and a canary check against well-known titles (1984, Animal Farm, etc.). With --write also updates data_quality_status + data_quality_evaluated_at on every books/authors row via chunked bulk updates."
            tags={['safe']}
            command={`# Dry-run — writes report only, no DB writes
npx tsx --env-file=.env.local scripts/score-data-quality.ts

# Apply — also persists verdicts to books + authors
npx tsx --env-file=.env.local scripts/score-data-quality.ts --write`}
            flags={[
              { flag: '--write', desc: 'Persist data_quality_status to DB (default: dry-run, report-only)' },
            ]}
            writes={
              <>
                <strong>Always</strong> writes{' '}
                <code className="font-mono">data/data-quality-report.md</code>. With{' '}
                <code className="font-mono">--write</code>: bulk-updates{' '}
                <code className="font-mono">books.data_quality_status</code> +{' '}
                <code className="font-mono">authors.data_quality_status</code> +{' '}
                <code className="font-mono">data_quality_evaluated_at</code> on every row. Idempotent — re-running
                with unchanged data produces the same verdicts.
              </>
            }
            note="Heuristics live in the script. Tune by editing the scoring functions, run dry-run, eyeball the canary table, then re-run with --write. Recompute after each enrich-all run, mark-cover-override sweep, or import."
          />
        </div>

        {/* LLM-facing surfaces */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">LLM-facing surfaces (llms.txt + .md exports)</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            <a href="/llms.txt" className="font-mono text-xs underline">/llms.txt</a> is a curated, plain-text entry point for LLM crawlers (GPTBot,
            ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended). It lists the highest-value canonical URLs — methodology,
            data quality, essays, hub pages — so a model has one place to start. The total book count and country count are
            rendered live from the homepage query, and the <code className="font-mono text-xs">/banned-books-week</code> link
            is gated on <code className="font-mono text-xs">bbw_config.enabled</code>, so it disappears out of season.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Each long-form essay plus <code className="font-mono text-xs">/methodology</code>,{' '}
            <code className="font-mono text-xs">/data-quality</code>, and <code className="font-mono text-xs">/about</code>{' '}
            has a parallel <code className="font-mono text-xs">.md</code> URL (e.g.{' '}
            <a href="/methodology.md" className="font-mono text-xs underline">/methodology.md</a>) that serves the same prose
            as clean markdown with YAML frontmatter — no JSX, no nav chrome. The HTML page advertises it via{' '}
            <code className="font-mono text-xs">&lt;link rel=&quot;alternate&quot; type=&quot;text/markdown&quot;&gt;</code>.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            <strong className="text-gray-800 dark:text-gray-200">When to touch them:</strong> edit the essay or reference page
            as usual, then mirror the change in{' '}
            <code className="font-mono text-xs">src/lib/markdown-pages/&lt;slug&gt;.ts</code> so the{' '}
            <code className="font-mono text-xs">.md</code> twin stays in sync. When adding a new essay, also add it to{' '}
            <code className="font-mono text-xs">src/app/llms.txt/route.ts</code> (description map) and add the new{' '}
            <code className="font-mono text-xs">.md</code> URL to{' '}
            <code className="font-mono text-xs">src/lib/sitemap-static-entries.ts</code>.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            <strong className="text-gray-800 dark:text-gray-200">Rule:</strong>{' '}
            <code className="font-mono text-xs">.md</code> exports are for long-form prose only. Do not create per-book or
            per-author <code className="font-mono text-xs">.md</code> pages — book and author detail pages already publish
            structured citation via JSON-LD (Book, Person, FAQPage, ItemList, additionalProperty.dataQualityStatus), which is
            the right channel for AI citation and avoids creating thousands of duplicate canonical surfaces.
          </p>
        </div>

        {/* Maintenance */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Maintenance</h2>
          </div>

          <Script
            name="refresh-mv.ts"
            what="Refreshes all materialized views (mv_ban_counts, mv_country_reason_counts, mv_top_books_rising, mv_top_authors_rising) via the refresh_all_materialized_views RPC — used by countries, stats, and trending pages. Run after any bulk import or enrichment. Also available as a button on the admin dashboard, which calls the same RPC under the hood."
            tags={['safe']}
            command={`npx tsx --env-file=.env.local scripts/refresh-mv.ts`}
          />
        </div>

      </div>
    </main>
  )
}
