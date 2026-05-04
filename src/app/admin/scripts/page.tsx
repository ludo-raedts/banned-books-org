import { Terminal, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react'

const cardCls = 'border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col gap-4 bg-white dark:bg-gray-900'

function Code({ children }: { children: string }) {
  return (
    <code className="block bg-gray-950 text-green-400 text-xs rounded-lg px-4 py-3 font-mono whitespace-pre overflow-x-auto">
      {children}
    </code>
  )
}

function Tag({ type }: { type: 'free' | 'gpt' | 'destructive' | 'safe' }) {
  const styles = {
    free: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    gpt: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    destructive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    safe: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  }
  const labels = {
    free: '✓ free APIs',
    gpt: '$ OpenAI cost',
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
  note,
}: {
  name: string
  what: string
  tags: ('free' | 'gpt' | 'destructive' | 'safe')[]
  command: string
  flags?: { flag: string; desc: string }[]
  note?: string
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
            <>
              <dt key={`dt-${f.flag}`} className="font-mono text-gray-500 dark:text-gray-400 shrink-0">{f.flag}</dt>
              <dd key={`dd-${f.flag}`} className="text-gray-600 dark:text-gray-400">{f.desc}</dd>
            </>
          ))}
        </dl>
      )}
      {note && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">{note}</p>
      )}
    </div>
  )
}

export default function ScriptsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
          <a href="/admin" className="hover:text-gray-600 dark:hover:text-gray-300">Admin</a> / Scripts
        </p>
        <h1 className="text-2xl font-bold">Scripts reference</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Run from the project root. All scripts are dry-run by default — add{' '}
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">--apply</code>{' '}
          to write to the database.
        </p>
      </div>

      <div className="flex flex-col gap-6">

        {/* Prerequisites */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
            <h2 className="font-semibold">Prerequisites</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ensure <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">.env.local</code> exists
            in the project root with <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">SUPABASE_SERVICE_ROLE_KEY</code> and
            (for GPT scripts) <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">OPENAI_API_KEY</code>.
          </p>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              <span className="text-gray-600 dark:text-gray-400">Green = free (Open Library, Google Books)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-gray-600 dark:text-gray-400">Amber = costs OpenAI credits (GPT-4o-mini)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-gray-600 dark:text-gray-400">Red = destructive / modifies existing data</span>
            </span>
          </div>
        </div>

        {/* Common task quick-reference */}
        <div className={cardCls}>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Quick reference — what do you want to do?</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-6 gap-y-3 text-sm">
            {[
              ['Fill everything in one go (new books)', 'enrich-all.ts --apply'],
              ['Fill everything, skip OpenAI cost', 'enrich-all.ts --apply --free-only'],
              ['Add missing ISBNs', 'enrich-isbn.ts --apply'],
              ['Add missing cover images', 'enrich-covers-v2.ts --apply'],
              ['Add missing book descriptions', 'enrich-descriptions.ts --apply'],
              ['Add ban reason descriptions (why banned)', 'enrich-ban-descriptions-gpt.ts --apply'],
              ['Add censorship context per country/book', 'enrich-censorship-context-gpt.ts --apply'],
              ['Classify ban reasons (political, religious…)', 'enrich-reasons.ts --apply'],
              ['Check for duplicate books', 'check-dupes.ts'],
              ['Audit overall data quality', 'audit-db.ts'],
              ['Refresh materialized views after import', 'refresh-mv.ts'],
            ].map(([task, script]) => (
              <>
                <dt key={`dt-${task}`} className="text-gray-700 dark:text-gray-300">{task}</dt>
                <dd key={`dd-${task}`} className="font-mono text-xs text-gray-500 dark:text-gray-400 self-center">{script}</dd>
              </>
            ))}
          </dl>
        </div>

        {/* Master enrichment */}
        <div className={cardCls}>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Master enrichment pipeline</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Runs all steps below in order. Only touches records with empty fields — safe to re-run.
          </p>
          <Script
            name="enrich-all.ts"
            what="Fills ISBN, covers, Gutenberg IDs, descriptions, ban descriptions, censorship context, and ban reason classifications in one pass."
            tags={['free', 'gpt']}
            command={`# Dry-run — shows eligible counts, no writes
npx tsx --env-file=.env.local scripts/enrich-all.ts

# Run all steps
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply

# Skip OpenAI (no cost)
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --free-only

# Cap GPT steps at 50 books each (incremental)
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --gpt-limit=50`}
            flags={[
              { flag: '--apply', desc: 'Write to database (omit for dry-run)' },
              { flag: '--free-only', desc: 'Skip all GPT steps, only run free API steps' },
              { flag: '--gpt-limit=N', desc: 'Cap each GPT step at N books (default 150)' },
            ]}
            note="Run this after any bulk book import. Use --free-only first to fill what's available for free, then run without it to fill the rest with GPT."
          />
        </div>

        {/* Individual enrichment */}
        <div className={cardCls}>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Individual enrichment scripts</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Run these individually when you only need to update one field type.</p>

          <Script
            name="enrich-isbn.ts"
            what="Finds missing ISBN-13 values by querying Open Library (title+author, then title-only) and Google Books."
            tags={['free']}
            command={`npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply
npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply --limit=200`}
            flags={[
              { flag: '--apply', desc: 'Write isbn13 to database' },
              { flag: '--limit=N', desc: 'Cap at N books per run' },
            ]}
          />

          <Script
            name="enrich-covers-v2.ts"
            what="Fetches missing cover images using 4 strategies: Google Books (title-only), Open Library (title-only, stripped subtitle), Wikipedia thumbnail."
            tags={['free']}
            command={`npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply
npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --limit=100
npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --reset`}
            flags={[
              { flag: '--apply', desc: 'Write cover_url to database' },
              { flag: '--limit=N', desc: 'Cap at N books per run' },
              { flag: '--reset', desc: 'Re-try all previously failed books (not just new ones)' },
            ]}
          />

          <Script
            name="enrich-descriptions.ts"
            what="Fills missing book descriptions. Tries Open Library then Google Books; falls back to GPT-4o-mini for books not found in either."
            tags={['free', 'gpt']}
            command={`npx tsx --env-file=.env.local scripts/enrich-descriptions.ts --apply`}
            flags={[
              { flag: '--apply', desc: 'Write description_book; sets ai_drafted=true for GPT-generated ones' },
            ]}
            note="Also fixes truncated descriptions (ones that don't end with sentence-final punctuation)."
          />

          <Script
            name="enrich-descriptions-gpt.ts"
            what="GPT-only fallback for books that Open Library and Google Books couldn't find. Use after enrich-descriptions.ts."
            tags={['gpt']}
            command={`npx tsx --env-file=.env.local scripts/enrich-descriptions-gpt.ts --apply
npx tsx --env-file=.env.local scripts/enrich-descriptions-gpt.ts --apply --limit=50`}
            flags={[
              { flag: '--apply', desc: 'Write GPT-generated descriptions' },
              { flag: '--limit=N', desc: 'Cap at N books (default 150)' },
            ]}
          />

          <Script
            name="enrich-ban-descriptions-gpt.ts"
            what="Generates descriptions for individual bans — explains why this specific book was banned in this specific country."
            tags={['gpt']}
            command={`npx tsx --env-file=.env.local scripts/enrich-ban-descriptions-gpt.ts --apply
npx tsx --env-file=.env.local scripts/enrich-ban-descriptions-gpt.ts --apply --limit=100`}
            flags={[
              { flag: '--apply', desc: 'Write ban descriptions' },
              { flag: '--limit=N', desc: 'Cap at N bans (default 150)' },
            ]}
          />

          <Script
            name="enrich-censorship-context-gpt.ts"
            what="Generates broader censorship context — the political/historical background for a country's censorship of a book."
            tags={['gpt']}
            command={`npx tsx --env-file=.env.local scripts/enrich-censorship-context-gpt.ts --apply --limit=50`}
            flags={[
              { flag: '--apply', desc: 'Write censorship context' },
              { flag: '--limit=N', desc: 'Cap at N records (default 150)' },
            ]}
          />

          <Script
            name="enrich-reasons.ts"
            what="Auto-classifies ban reasons (political, religious, sexual content, etc.) using GPT for bans currently tagged as 'other'."
            tags={['gpt']}
            command={`npx tsx --env-file=.env.local scripts/enrich-reasons.ts --apply`}
            flags={[
              { flag: '--apply', desc: 'Update ban reason classifications' },
            ]}
          />
        </div>

        {/* Data quality & auditing */}
        <div className={cardCls}>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Data quality &amp; auditing</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">All read-only — safe to run any time.</p>

          <Script
            name="audit-db.ts"
            what="Full database audit: counts per table, missing fields, referential integrity checks."
            tags={['safe']}
            command={`npx tsx --env-file=.env.local scripts/audit-db.ts`}
          />

          <Script
            name="check-dupes.ts"
            what="Finds duplicate book entries (same title + author appearing more than once)."
            tags={['safe']}
            command={`npx tsx --env-file=.env.local scripts/check-dupes.ts`}
          />

          <Script
            name="check-no-desc.ts"
            what="Lists all books still missing a description, with their ban counts."
            tags={['safe']}
            command={`npx tsx --env-file=.env.local scripts/check-no-desc.ts`}
          />

          <Script
            name="check-coverage.ts"
            what="Shows coverage percentages for ISBN, cover, description, and ban description fields."
            tags={['safe']}
            command={`npx tsx --env-file=.env.local scripts/check-coverage.ts`}
          />
        </div>

        {/* Materialized views */}
        <div className={cardCls}>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Materialized views</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Refresh after bulk imports or enrichment runs so the countries and stats pages reflect updated data.
            You can also refresh from the{' '}
            <a href="/admin" className="text-brand hover:underline">admin dashboard</a>.
          </p>

          <Script
            name="refresh-mv.ts"
            what="Refreshes all materialized views (country stats, trending, ban counts) used by the public-facing pages."
            tags={['safe']}
            command={`npx tsx --env-file=.env.local scripts/refresh-mv.ts`}
          />
        </div>

      </div>
    </main>
  )
}
