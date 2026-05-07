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
              ['Fill everything except Gutenberg (skips slow step)', 'enrich-all.ts --apply --no-gutenberg'],
              ['Fill everything, skip OpenAI cost', 'enrich-all.ts --apply --free-only'],
              ['Add missing ISBNs', 'enrich-isbn.ts --apply'],
              ['Add missing cover images', 'enrich-covers-v2.ts --apply'],
              ['Add missing book descriptions', 'enrich-descriptions.ts --apply'],
              ['Add ban reason descriptions (why banned)', 'enrich-ban-descriptions-gpt.ts --apply'],
              ['Add censorship context per country/book', 'enrich-censorship-context-gpt.ts --apply'],
              ['Classify ban reasons (political, religious…)', 'enrich-reasons.ts --apply'],
              ['Fill author bios from Wikipedia', 'enrich-author-bios.ts --apply'],
              ['Apply the 40-book editorial startset', 'apply-editorial-classification.ts --write'],
              ['Suggest classifications for the rest (GPT)', 'suggest-editorial-classification-gpt.ts --apply'],
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
            what="Fills ISBN, covers (first-pass + v2 retries with pHash placeholder rejection), Gutenberg IDs, descriptions, ban descriptions, censorship context, and ban reason classifications in one pass."
            tags={['free', 'gpt']}
            command={`# Dry-run — shows eligible counts, no writes
npx tsx --env-file=.env.local scripts/enrich-all.ts

# Run all steps
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply

# Update everything EXCEPT Gutenberg (Gutenberg is very slow)
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --no-gutenberg

# Skip OpenAI (no cost)
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --free-only

# Free + skip Gutenberg — fastest "fill the gaps" run
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --free-only --no-gutenberg

# Cap GPT steps at 50 books each (incremental)
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --gpt-limit=50`}
            flags={[
              { flag: '--apply', desc: 'Write to database (omit for dry-run)' },
              { flag: '--free-only', desc: 'Skip all GPT steps, only run free API steps' },
              { flag: '--no-gutenberg', desc: 'Skip the Gutenberg ID lookup step (it is slow; safe to skip on day-to-day runs)' },
              { flag: '--gpt-limit=N', desc: 'Cap each GPT step at N books (default 150)' },
            ]}
            note="Run this after any bulk book import. Use --free-only first to fill what's available for free, then run without it to fill the rest with GPT. Cover step uses the v2 placeholder-rejecting flow on retries — Google Books 'image not available' placeholders are pHash-checked and discarded."
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
            what="Fetches missing cover images using 4 strategies: Google Books (title-only), Open Library (title-only, stripped subtitle), Wikipedia thumbnail. Google Books URLs are perceptual-hash-checked against the official 'image not available' placeholder; matches are rejected and the book is marked cover_status='rejected_placeholder' so future runs skip it."
            tags={['free']}
            command={`npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply
npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --limit=100
npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --reset
npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --force`}
            flags={[
              { flag: '--apply', desc: 'Write cover_url / cover_status to database' },
              { flag: '--limit=N', desc: 'Cap at N books per run' },
              { flag: '--reset', desc: 'Re-try all previously failed books (not just new ones)' },
              { flag: '--force', desc: 'Bypass cover_status skip (re-check rejected_placeholder & manual_override)' },
            ]}
            note="Reference image lives at assets/google-books-placeholder.png. Hamming threshold = 5."
          />

          <Script
            name="mark-cover-override.ts"
            what="Permanently mark a book's cover as a manual override: clears cover_url, sets cover_status='manual_override', cover_checked_at=now(). enrich-covers-v2 will skip the book on every run unless --force."
            tags={['safe']}
            command={`npx tsx --env-file=.env.local scripts/mark-cover-override.ts <id-or-slug>
npx tsx --env-file=.env.local scripts/mark-cover-override.ts <id-or-slug> --apply`}
            flags={[
              { flag: '<id-or-slug>', desc: 'Numeric book id or slug. Required.' },
              { flag: '--apply', desc: 'Write the change. Without it, prints what would change.' },
            ]}
            note="Use this when you've manually deleted a bad cover and want it gone forever."
          />

          <Script
            name="audit-covers-for-placeholders.ts"
            what="Retroactive sweep over existing Google Books cover URLs. Downloads each image, perceptual-hash-checks against the placeholder, and on match clears cover_url + sets cover_status='rejected_placeholder'. Skips manual_override. Non-Google URLs are not scanned (the pHash is the Google placeholder)."
            tags={['free', 'destructive']}
            command={`npx tsx --env-file=.env.local scripts/audit-covers-for-placeholders.ts
npx tsx --env-file=.env.local scripts/audit-covers-for-placeholders.ts --apply
npx tsx --env-file=.env.local scripts/audit-covers-for-placeholders.ts --apply --limit=500
npx tsx --env-file=.env.local scripts/audit-covers-for-placeholders.ts --apply --concurrency=8`}
            flags={[
              { flag: '--apply', desc: 'Write the changes. Without it, only reports what would change.' },
              { flag: '--limit=N', desc: 'Cap at N books per run.' },
              { flag: '--concurrency=N', desc: 'Parallel HTTP fetches (default 4).' },
            ]}
            note="Run a dry-run first to see the placeholder count before applying."
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

          <Script
            name="enrich-author-bios.ts"
            what="Fills missing author bios, birth year, death year, birth country, and photos using Wikipedia as primary source. Only touches authors with no bio — safe to re-run. Does not hallucinate — only writes when Wikipedia returns a relevant article. Use --photos-only to backfill pictures for authors who already have a bio (e.g. when their Wikipedia page now has an infobox image, or when the bio was filled manually)."
            tags={['free']}
            command={`# Dry-run — shows what would be filled, no writes
npx tsx --env-file=.env.local scripts/enrich-author-bios.ts

# Fill up to 50 authors (default batch)
npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --apply

# Fill up to 200 authors
npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --apply --limit=200

# Backfill missing photos for authors who already have a bio
npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --photos-only --apply --limit=500`}
            flags={[
              { flag: '--apply', desc: 'Write bio, birth_year, death_year, birth_country, photo_url to DB' },
              { flag: '--limit=N', desc: 'Cap at N authors per run (default 50)' },
              { flag: '--photos-only', desc: 'Only target authors with bio but no photo; write only photo_url, leave bio/birth/death untouched' },
            ]}
            note="Wikipedia intro extract is used as-is (HTML stripped). Censorship mentions in the full article are appended if not already in the intro. Birth/death years are extracted from Wikipedia categories."
          />
        </div>

        {/* Editorial classification */}
        <div className={cardCls}>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Editorial classification</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            These scripts populate the three editorial-classification fields on books. The framework is
            described in the two essays{' '}
            <a href="/essays/what-we-document" className="text-brand hover:underline">What we document</a>{' '}
            and{' '}
            <a href="/essays/forbidden-knowledge-iceberg" className="text-brand hover:underline">Forbidden knowledge iceberg</a>.
          </p>

          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-lg p-3 leading-relaxed">
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Fields written</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
              <dt className="font-mono">warning_level</dt>
              <dd>
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">none</code> /{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">context</code> /{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">extended</code>.
                Default <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">none</code>.
                Only <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">context</code> and{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">extended</code> render the public &ldquo;Editorial note&rdquo; on{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/books/&lt;slug&gt;</code>.
              </dd>
              <dt className="font-mono">inclusion_rationale</dt>
              <dd>
                1–2 sentences explaining why the book fits our criteria. <strong>Always internal</strong> —
                only visible in admin, never rendered on the public site. Marks a book as classified.
              </dd>
              <dt className="font-mono">extended_context</dt>
              <dd>
                Markdown, only used for <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">extended</code> tier.
                <strong> The only field on a book page that gets a public editorial-essay treatment.</strong>{' '}
                Filled by hand in admin — never auto-generated.
              </dd>
            </dl>
            <p className="mt-2 text-gray-500 dark:text-gray-500">
              Classification does <strong>not</strong> count towards the data-quality score. An unclassified book is not &ldquo;wrong&rdquo;.
            </p>
          </div>

          <Script
            name="apply-editorial-classification.ts"
            what="One-shot seeder for the 40-book editorial startset. Patches 32 existing books (sets warning_level + inclusion_rationale) and creates 5 new ones with associated authors, bans, reasons and sources: Quotations from Chairman Mao, Why I Am Not a Christian, Submission (Hirsi Ali / Van Gogh), Heather Has Two Mommies, Our Bodies Ourselves. Idempotent: skips books that already have warning_level !== 'none' or an inclusion_rationale, so it never overwrites edits made via the admin."
            tags={['safe']}
            command={`# Dry-run — shows the 32 patches + 5 inserts, no writes
npx tsx --env-file=.env.local scripts/apply-editorial-classification.ts

# Apply
npx tsx --env-file=.env.local scripts/apply-editorial-classification.ts --write`}
            flags={[
              { flag: '--write', desc: 'Apply changes (this script uses --write, NOT --apply, matching the existing batch-* import scripts)' },
            ]}
            note="Already run on the catalogue on 2026-05-07. Re-running is safe — it only patches books that haven't been classified yet. The 4 extended-tier books (Mein Kampf, Turner Diaries, Anarchist Cookbook, Hit Man) get warning_level=extended + rationale; their extended_context is left NULL with a TODO for you to fill manually via admin. Three collection placeholders (Russian LGBTQ, Black Books, DPRK dissident lit) are intentionally left as TODO comments — better split per work later."
          />

          <Script
            name="suggest-editorial-classification-gpt.ts"
            what="GPT-powered classifier for the ~4.4k books that aren't yet classified. Sends each book's metadata + ban context to gpt-4o-mini with the editorial framework as the system prompt; gets back warning_level + inclusion_rationale + confidence + reasoning_summary as structured JSON."
            tags={['gpt']}
            command={`# Dry-run — 3 sample books
npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts

# Test on one specific book
npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --slug=lolita

# Apply: small batch first to inspect output quality and cost
npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --apply --limit=50

# Apply at scale
npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --apply --limit=5000

# Override model (default gpt-4o-mini)
npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --apply --model=gpt-5`}
            flags={[
              { flag: '--apply', desc: 'Auto-apply low-risk results to DB; write a review file for high-risk ones' },
              { flag: '--limit=N', desc: 'Cap at N books per run (default 100 in apply mode, 3 in dry-run)' },
              { flag: '--slug=X', desc: 'Test on a single book — bypasses the "already-classified" filter' },
              { flag: '--model=X', desc: 'Override the model (default gpt-4o-mini, also via OPENAI_MODEL env)' },
              { flag: '--delay=N', desc: 'Delay between API calls in ms (default 400)' },
            ]}
            note="Routing is conservative by design. Suggestions of warning_level='none' with confidence ≥ medium auto-apply (the rationale is internal-only — no public change). Suggestions of warning_level='context' or 'extended', exclude=true, or low-confidence anything are written to data/editorial-review-<timestamp>.json for human review and never auto-applied. This protects against unexpected public editorial-note banners. Estimated cost: ~€2–€5 to classify the entire ~4.4k catalogue with gpt-4o-mini."
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
