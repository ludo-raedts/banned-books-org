import AdminBackLink from '@/components/admin-back-link'
import { ZENODO_CONCEPT_DOI, ZENODO_DOI_URL } from '@/lib/zenodo'
import { Archive, AlertTriangle, CheckCircle, XCircle, Clock, HardDriveDownload } from 'lucide-react'

const cardCls = 'border border-gray-200 rounded-xl p-6 flex flex-col gap-4 bg-white'

const CONCEPT_DOI = ZENODO_CONCEPT_DOI ?? '10.5281/zenodo.20511553'
const RECORD_URL = ZENODO_DOI_URL ?? 'https://doi.org/10.5281/zenodo.20511553'
// The version-DOI record page (for "New version" / editing). The version DOI
// increments per release; the management record id stays the v1 record.
const RECORD_MANAGE_URL = 'https://zenodo.org/records/20511554'

function Code({ children }: { children: string }) {
  return (
    <code className="block bg-gray-950 text-green-400 text-xs rounded-lg px-4 py-3 font-mono whitespace-pre overflow-x-auto">
      {children}
    </code>
  )
}

export default function ZenodoAdminPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
            <a href="/admin" className="hover:text-gray-600">Admin</a> / Zenodo open dataset
          </p>
          <h1 className="text-2xl font-bold">Zenodo open dataset — re-deposit guide</h1>
        </div>
        <AdminBackLink href="/admin" label="Admin dashboard" />
      </div>

      <p className="text-sm text-gray-500 mb-8 leading-relaxed">
        The open CC-BY-4.0 censorship core is deposited on Zenodo as a citeable research dataset.
        Concept DOI{' '}
        <a href={RECORD_URL} target="_blank" rel="noopener noreferrer" className="font-mono text-brand hover:underline">{CONCEPT_DOI}</a>{' '}
        (version-independent — always resolves to the latest version). This page is the decision guide and checklist
        for after large DB changes. Read the decision rule first: re-deposit is <strong>deliberate</strong>, not automatic.
      </p>

      <div className="flex flex-col gap-6">

        {/* ── Decision rule ─────────────────────────────────────────── */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-gray-400 shrink-0" />
            <h2 className="font-semibold text-gray-900">When does a DB change warrant a new Zenodo version?</h2>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            The open export contains <strong>only the censorship core</strong> — the structured facts and their source
            citations. It does <strong>not</strong> contain any commercial-only fields. So whether to re-deposit depends
            entirely on <em>which</em> fields a change touched.
          </p>

          {/* NO new version */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-5">
            <p className="flex items-center gap-2 font-semibold text-emerald-800 mb-2">
              <XCircle className="w-4 h-4 shrink-0" /> No new version needed
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              Enrichment that touches <strong>commercial-only fields</strong> changes nothing in the open CSVs, because
              those fields aren&rsquo;t exported at all:
            </p>
            <ul className="mt-2 text-sm text-gray-700 leading-relaxed list-disc pl-5 flex flex-col gap-0.5">
              <li>cover images, ISBN-13, edition data</li>
              <li>book / ban descriptions, censorship context (editorial prose)</li>
              <li>author bios &amp; photos</li>
            </ul>
            <p className="mt-2 text-sm text-gray-700 leading-relaxed">
              A full <code className="font-mono text-xs bg-white/70 px-1 rounded">enrich-all.ts</code> sweep, a covers
              backfill, a descriptions rewrite — none of these justify a new DOI.
            </p>
          </div>

          {/* New version warranted */}
          <div className="rounded-lg border-l-4 border-brand bg-amber-50/40 p-5">
            <p className="flex items-center gap-2 font-semibold text-amber-900 mb-2">
              <CheckCircle className="w-4 h-4 shrink-0" /> A new version IS warranted
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              Only when the <strong>open censorship core</strong> grows or is corrected substantially:
            </p>
            <ul className="mt-2 text-sm text-gray-700 leading-relaxed list-disc pl-5 flex flex-col gap-0.5">
              <li>new bans, new countries, new sources</li>
              <li>a new source-batch (e.g. France complete, the next jurisdiction)</li>
              <li>enum / taxonomy changes (action_type, status, reason slugs, scopes)</li>
              <li>fixes to open fields (corrections to facts, citations, verification status)</li>
            </ul>
          </div>

          {/* Cadence */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
            <p className="flex items-center gap-2 font-semibold text-gray-800 mb-1.5">
              <Clock className="w-4 h-4 shrink-0" /> Cadence
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              Re-deposit on a <strong>deliberate rhythm</strong> — roughly per quarter, or per significant source-batch —
              <strong> not per enrichment run</strong>. Batch several core changes into one version. The goal is a small
              number of meaningful versions, not dozens of near-identical DOIs.
            </p>
          </div>
        </div>

        {/* ── Quantify first ────────────────────────────────────────── */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-gray-400 shrink-0" />
            <h2 className="font-semibold text-gray-900">First: quantify the change since the last deposit</h2>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Don&rsquo;t eyeball it — run the diff tool. It rebuilds the open export in-memory and compares it to the
            last deposited baseline, then prints per-table row deltas, new countries, taxonomy/enum changes, and a
            recommendation. It reads only the open core, so commercial-only enrichment never shows up here (by design).
          </p>
          <Code>{`# How much has the open core changed since the last deposit?
pnpm tsx scripts/zenodo-deposit-diff.ts`}</Code>
          <p className="text-sm text-gray-600 leading-relaxed">
            The baseline lives in <code className="font-mono text-xs bg-gray-100 px-1 rounded">docs/zenodo/deposited-manifest.json</code> (committed).
            <strong> Right after you publish a new Zenodo version</strong>, re-anchor it so the next diff measures drift from that release:
          </p>
          <Code>{`pnpm tsx scripts/zenodo-deposit-diff.ts --mark-deposited --note="France batch"
# then commit docs/zenodo/deposited-manifest.json`}</Code>
          <p className="text-xs text-gray-400 italic">
            Compact baseline: per-table row count + content hash + enum value-sets. It tells you <em>that</em> a table
            changed and by how many rows, not the exact per-row count — enough to decide.
          </p>
        </div>

        {/* ── Re-deposit procedure ──────────────────────────────────── */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-gray-400 shrink-0" />
            <h2 className="font-semibold text-gray-900">Re-deposit procedure (when warranted)</h2>
          </div>

          <ol className="flex flex-col gap-5 text-sm text-gray-700 leading-relaxed list-decimal pl-5 marker:font-semibold marker:text-gray-400">
            <li>
              <strong>Regenerate the open export.</strong> Re-runs the export against current production and rewrites{' '}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">private/zenodo/</code>. Then zip its contents
              into <code className="font-mono text-xs bg-gray-100 px-1 rounded">banned-books-open-core.zip</code>.
              <div className="mt-2">
                <Code>{`pnpm tsx scripts/build-zenodo-dataset.ts --apply
cd private/zenodo && zip -r ../banned-books-open-core.zip . && cd -`}</Code>
              </div>
            </li>
            <li>
              <strong>Update the data descriptor.</strong> In{' '}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">docs/zenodo/data-descriptor.md</code>:
              <ul className="mt-1.5 list-disc pl-5 flex flex-col gap-0.5">
                <li>refresh the §1 snapshot coverage figures (book / ban / country counts)</li>
                <li>check the withheld-rows count (<code className="font-mono text-xs bg-gray-100 px-1 rounded">status=&apos;unclear&apos;</code>) is still accurate</li>
                <li>review the §4 <code className="font-mono text-xs bg-gray-100 px-1 rounded">verification_status</code> distribution if it changed</li>
              </ul>
            </li>
            <li>
              <strong>Re-render the PDF.</strong>
              <div className="mt-2">
                <Code>{`pnpm tsx scripts/zenodo-descriptor-to-pdf.tsx`}</Code>
              </div>
            </li>
            <li>
              <strong>Publish a new version on Zenodo.</strong> Open the existing{' '}
              <a href={RECORD_MANAGE_URL} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">record</a>{' '}
              → <em>New version</em> → upload the new zip + new PDF → update the publication date → publish.
            </li>
            <li>
              <strong>Do NOT change the concept DOI.</strong> See the critical note below.
            </li>
          </ol>
        </div>

        {/* ── Concept-DOI critical note ─────────────────────────────── */}
        <div className="rounded-xl border-l-4 border-red-500 bg-red-50/60 p-6">
          <p className="flex items-center gap-2 font-semibold text-red-800 mb-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> Critical: the concept DOI never changes
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            The <strong>concept DOI</strong>{' '}
            <code className="font-mono text-xs bg-white/70 px-1 rounded">{CONCEPT_DOI}</code> is version-independent and
            stays the same forever. Do <strong>not</strong> edit{' '}
            <code className="font-mono text-xs bg-white/70 px-1 rounded">ZENODO_CONCEPT_DOI</code> in{' '}
            <code className="font-mono text-xs bg-white/70 px-1 rounded">src/lib/zenodo.ts</code>. Each new version mints a
            new <em>version DOI</em> (it increments), but the concept DOI referenced in the descriptor and across the site
            is the one to cite — leave it untouched.
          </p>
        </div>

        {/* ── 30-day file-edit window ───────────────────────────────── */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400 shrink-0" />
            <h2 className="font-semibold text-gray-900">File-edit window</h2>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Files on a published Zenodo version are editable for <strong>30 days</strong> after publish. After that,
            changing a file requires yet another version. So fix any upload mistake (wrong zip, stale PDF) within that
            window rather than minting a fresh version.
          </p>
        </div>

        {/* ── DB backups ────────────────────────────────────────────── */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <HardDriveDownload className="w-5 h-5 text-gray-400 shrink-0" />
            <h2 className="font-semibold text-gray-900">Before risky bulk operations: back up</h2>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            The Supabase Free plan has no managed backups. Before any risky bulk DB operation, dump the data to{' '}
            <code className="font-mono text-xs bg-gray-100 px-1 rounded">~/Documents/banned-books-backups/</code>:
          </p>
          <Code>{`supabase db dump --data-only -f ~/Documents/banned-books-backups/backup-$(date +%Y%m%d).sql`}</Code>
        </div>

      </div>
    </main>
  )
}
