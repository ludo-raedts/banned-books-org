import AdminBackLink from '@/components/admin-back-link'
import {
  Terminal,
  AlertTriangle,
  CheckCircle,
  Wrench,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  ImageIcon,
  FileText,
  Crosshair,
  Hammer,
  ClipboardList,
  Database,
  Plus,
} from 'lucide-react'
import EnrichRunner from './enrich-runner'

const cardCls =
  'border border-gray-200 rounded-xl p-6 flex flex-col gap-4 bg-white'

function Code({ children }: { children: string }) {
  return (
    <code className="block bg-gray-950 text-green-400 text-xs rounded-lg px-4 py-3 font-mono whitespace-pre overflow-x-auto">
      {children}
    </code>
  )
}

type TagType = 'free' | 'gpt' | 'claude' | 'destructive' | 'safe'

function Tag({ type }: { type: TagType }) {
  const styles: Record<TagType, string> = {
    free: 'bg-green-100 text-green-700',
    gpt: 'bg-amber-100 text-amber-700',
    claude: 'bg-orange-100 text-orange-700',
    destructive: 'bg-red-100 text-red-700',
    safe: 'bg-gray-100 text-gray-600',
  }
  const labels: Record<TagType, string> = {
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

type ScriptMeta = {
  coverage: React.ReactNode
  cadence: React.ReactNode
  writes: React.ReactNode
  output?: React.ReactNode
  idempotent: React.ReactNode
  cost: React.ReactNode
}

function Meta({ meta }: { meta: ScriptMeta }) {
  const rows: Array<[string, React.ReactNode]> = [
    ['coverage', meta.coverage],
    ['cadence', meta.cadence],
    ['writes', meta.writes],
    ...(meta.output !== undefined ? ([['output', meta.output]] as Array<[string, React.ReactNode]>) : []),
    ['idempotent', meta.idempotent],
    ['cost', meta.cost],
  ]
  return (
    <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-mono text-gray-500 uppercase tracking-wider text-[10px] self-start pt-0.5">
            {label}
          </dt>
          <dd className="text-gray-700 leading-relaxed">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Script({
  name,
  what,
  tags,
  meta,
  command,
  flags,
  note,
}: {
  name: string
  what: string
  tags: TagType[]
  meta: ScriptMeta
  command: string
  flags?: { flag: string; desc: string }[]
  note?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 pt-4 first:pt-0 border-t first:border-0 border-gray-100">
      <div className="flex flex-wrap items-start gap-2">
        <span className="font-mono text-sm font-semibold text-gray-900">
          {name}
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {tags.map((t) => (
            <Tag key={t} type={t} />
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-600">{what}</p>
      <Meta meta={meta} />
      <Code>{command}</Code>
      {flags && flags.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs mt-0.5">
          {flags.map((f) => (
            <div key={f.flag} className="contents">
              <dt className="font-mono text-gray-500 shrink-0">{f.flag}</dt>
              <dd className="text-gray-600">{f.desc}</dd>
            </div>
          ))}
        </dl>
      )}
      {note && (
        <p className="text-xs text-gray-400 italic">{note}</p>
      )}
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  blurb,
  anchor,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  blurb?: React.ReactNode
  anchor?: string
}) {
  return (
    <div className="flex flex-col gap-1.5" id={anchor}>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-gray-400 shrink-0" />
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      {blurb && <p className="text-sm text-gray-500">{blurb}</p>}
    </div>
  )
}

export default function ScriptsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
            <a href="/admin" className="hover:text-gray-600">
              Admin
            </a>{' '}
            / Enrichment &amp; sources
          </p>
          <h1 className="text-2xl font-bold">Enrichment &amp; sources</h1>
        </div>
        <AdminBackLink href="/admin" label="Admin dashboard" />
      </div>

      {/* Status banner — what this page is for now */}
      <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 leading-relaxed">
        <p>
          <strong>Status:</strong> de ingest-pijplijn (ingest → review → approve) is grotendeels afgerond.
          Deze pagina dient nu vooral om bestaande data <strong>door te verrijken</strong>, kwaliteit te{' '}
          <strong>verbeteren</strong>, en losse <strong>fixes</strong> te doen — niet om nieuwe bronnen te onboarden.
          Voor dat laatste, zie{' '}
          <a href="#new-source" className="underline hover:no-underline">
            Adding a new source
          </a>{' '}
          onderaan.
        </p>
      </div>

      {/* Jump-index */}
      <nav className="mb-8 rounded-lg border border-gray-200 bg-gray-50/60 px-4 py-3 text-xs text-gray-600">
        <p className="font-semibold text-gray-800 uppercase tracking-wider text-[10px] mb-2">
          Op deze pagina
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 leading-relaxed">
          <li>
            <a href="#runner" className="hover:underline">→ Live runner</a>
          </li>
          <li>
            <a href="#master" className="hover:underline">→ Master sweep — enrich-all.ts</a>
          </li>
          <li>
            <a href="#harvesters" className="hover:underline">→ Bulk harvesters (OL + Google Books)</a>
          </li>
          <li>
            <a href="#per-field" className="hover:underline">→ Per veld verrijken (boek / ban / auteur)</a>
          </li>
          <li>
            <a href="#wiki" className="hover:underline">→ Wikipedia ban-events (3 stappen)</a>
          </li>
          <li>
            <a href="#quality" className="hover:underline">→ Quality remediation (herschrijven)</a>
          </li>
          <li>
            <a href="#targeted" className="hover:underline">→ Targeted fixes (één boek / auteur)</a>
          </li>
          <li>
            <a href="#derived" className="hover:underline">→ Derived / classification</a>
          </li>
          <li>
            <a href="#audits" className="hover:underline">→ Audits (read-only)</a>
          </li>
          <li>
            <a href="#maintenance" className="hover:underline">→ Maintenance / MV refresh</a>
          </li>
          <li>
            <a href="#llm" className="hover:underline">→ LLM-facing surfaces</a>
          </li>
          <li>
            <a href="#new-source" className="hover:underline">→ Adding a new source (collapsed)</a>
          </li>
          <li>
            <a href="#prereqs" className="hover:underline">→ Prerequisites &amp; tag-legend</a>
          </li>
        </ul>
      </nav>

      <p className="text-xs text-gray-500 mb-6 leading-relaxed">
        Lees het{' '}
        <code className="text-[11px] bg-gray-100 px-1.5 py-0.5 rounded font-mono">
          coverage / cadence / writes / output / idempotent / cost
        </code>{' '}
        blokje boven elk script om te weten of het alle rijen langsloopt of alleen NULL, en waar de output landt. Alle
        commando&apos;s draaien dry-run; voeg{' '}
        <code className="text-[11px] bg-gray-100 px-1.5 py-0.5 rounded font-mono">--apply</code> toe om te
        schrijven (canoniek sinds 2026-06-11 via <code className="text-[11px] bg-gray-100 px-1.5 py-0.5 rounded font-mono">scripts/lib/cli.ts</code>;{' '}
        <code className="text-[11px] bg-gray-100 px-1.5 py-0.5 rounded font-mono">--write</code> werkt in de
        gemigreerde oudere scripts nog als alias).
      </p>

      <div className="flex flex-col gap-6">
        {/* 1 — Live runner */}
        <div id="runner" className="scroll-mt-4">
          <EnrichRunner />
        </div>

        {/* 2 — Master sweep */}
        <div id="master" className={`${cardCls} scroll-mt-4`}>
          <SectionHeader
            icon={Sparkles}
            title="Master sweep — enrich-all.ts"
            blurb={
              <>
                Eén script dat alle per-veld sweeps in de juiste volgorde draait. Dit is wat je draait na een import en
                periodiek als onderhoudssweep — alle stappen zijn fill-only, dus re-runs zijn goedkoop.
              </>
            }
          />
          <Script
            name="enrich-all.ts"
            what="Draait, in volgorde: ISBN → covers v2 (met placeholder-rejection) → Gutenberg IDs → archive.org IDs → descriptions v2 (Wikipedia + OpenLibrary-by-ISBN + Google Books, grounded; LLM alleen voor synthese uit ≥2 cited bronnen — geen free-form GPT-fallback meer) → genres → ban descriptions → censorship context → ban reasons. archive.org wordt eenmalig per boek bevraagd (sticky checked_at). Cover-step rejecteert Google Books placeholders via pHash."
            tags={['free', 'gpt']}
            meta={{
              coverage: <>fill-only per stap (zie elk per-veld script). Uitzondering: reason-step <strong>vervangt</strong> ban_reason_links voor bans die uitsluitend &apos;other&apos; zijn (DELETE + INSERT).</>,
              cadence: 'na elke import + ongoing-sweep (wekelijks/maandelijks)',
              writes: 'zie individuele scripts onder Per veld verrijken',
              idempotent: 'ja — bestaande waarden worden nooit overschreven (uitgezonderd exclusieve-other reasons)',
              cost: 'gratis + GPT-mini (fallbacks); cap met --gpt-limit',
            }}
            command={`# Dry-run — toont per stap hoeveel rijen in aanmerking komen
npx tsx --env-file=.env.local scripts/enrich-all.ts

# Volledige sweep (free + GPT)
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply

# Goedkoopste eerst — alleen gratis APIs, geen Gutenberg / archive.org
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --free-only --no-gutenberg --no-archive

# Alles behalve trage externe lookups
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --no-gutenberg --no-archive

# GPT-stappen begrenzen (incrementele run)
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --gpt-limit=50`}
            flags={[
              { flag: '--apply', desc: 'Schrijf naar DB (anders dry-run)' },
              { flag: '--free-only', desc: 'Skip alle GPT-stappen' },
              { flag: '--no-gutenberg', desc: 'Skip Gutenberg lookup (traag; veilig om dagelijks over te slaan)' },
              { flag: '--no-archive', desc: 'Skip archive.org lookup (traag)' },
              { flag: '--gpt-limit=N', desc: 'Cap elke GPT-stap op N boeken (default 150)' },
            ]}
            note="Cover-step gebruikt pHash om Google Books 'image not available' placeholders te detecteren — boeken die hierop falen krijgen cover_status='rejected_placeholder' en worden voortaan overgeslagen tenzij je --force op de cover-step meegeeft."
          />
        </div>

        {/* 2b — Bulk harvesters */}
        <div id="harvesters" className={`${cardCls} scroll-mt-4`}>
          <SectionHeader
            icon={Database}
            title="Bulk harvesters — OpenLibrary + Google Books"
            blurb={
              <>
                Twee cursor-resumebare sweeps die de hele catalogus langslopen om <code className="font-mono text-xs">isbn13</code> /{' '}
                <code className="font-mono text-xs">cover_url</code> / <code className="font-mono text-xs">first_published_year</code> /{' '}
                <code className="font-mono text-xs">original_language</code> te vullen. Bewust <strong>gesplitst op sleutel</strong>: OL
                pakt alle <em>keybare</em> boeken (work-id óf ISBN) exact en gratis; Google Books pakt alleen de <em>wezen</em> (geen
                sleutel) via title-search, want dat is het enige dat z&apos;n ~1.000/dag-quota nog moet kosten. De selecties zijn exacte
                complementen — ze raken nooit dezelfde rij en mogen gelijktijdig draaien.
              </>
            }
          />

          <Script
            name="enrich-ol-harvest.ts"
            what="Exact-key OpenLibrary harvester voor KEYBARE boeken (openlibrary_work_id óf isbn13). Haalt het OL work/edition-record rechtstreeks op — geen fuzzy title-search — en vult cover (work covers[0]), first_published_year (work first_publish_date — de enige bron hiervoor), en een sibling-ISBN uit de edities (taal-guard + dup-check). Een title-agreement guard tegen de OL work-titel weert vervuilde keys (study-guide works, oude title-search-misser) voordat ze nieuwe velden zaaien. Geen dagcap; alleen beleefdheids-delays."
            tags={['free']}
            meta={{
              coverage: <>keybaar (<code className="font-mono">openlibrary_work_id</code> OF <code className="font-mono">isbn13</code> NOT NULL) AND nog missend (<code className="font-mono">cover_url</code> / <code className="font-mono">first_published_year</code> / <code className="font-mono">isbn13</code> NULL). Cursor-resumebaar via <code className="font-mono">data/ol-harvest-cursor.json</code>.</>,
              cadence: 'bulk-sweep in eigen terminal (lange run; cursor hervat na onderbreking)',
              writes: <><code className="font-mono">books.cover_url</code> + <code className="font-mono">cover_status</code>, <code className="font-mono">books.first_published_year</code>, <code className="font-mono">books.isbn13</code> + <code className="font-mono">isbn_status</code>, <code className="font-mono">books.openlibrary_work_id</code> (isbn-pad backfill) — allemaal NULL-guarded, nooit overschreven</>,
              output: <><code className="font-mono">data/ol-harvest-proposals.jsonl</code> (incl. <code className="font-mono">title_ok:false</code> voor vervuilde keys + subjects voor toekomstige genres) + <code className="font-mono">data/ol-harvest-cursor.json</code></>,
              idempotent: 'ja — NULL-guarded + title-agreement guard; dup-ISBN → dup_collision-stamp',
              cost: 'gratis (géén dagcap — dit is de brede primaire sweep)',
            }}
            command={`# Dry-run — sample 15 (of --limit=N zonder te schrijven)
npx tsx --env-file=.env.local scripts/enrich-ol-harvest.ts --limit=60

# Volledige apply-sweep (lange run; resumebaar)
npx tsx --env-file=.env.local scripts/enrich-ol-harvest.ts --apply

# In stukken (cursor hervat vanzelf)
npx tsx --env-file=.env.local scripts/enrich-ol-harvest.ts --apply --limit=2000`}
            flags={[
              { flag: '--apply', desc: 'Schrijf naar DB (anders dry-run)' },
              { flag: '--limit=N', desc: 'Cap op N boeken (geldt ook voor dry-run sample)' },
              { flag: '--reset-cursor', desc: 'Begin opnieuw vanaf id 0' },
            ]}
            note="Echte residu-waarde zit in first_published_year (geen ander script vult dit) + work-id backfill; covers/ISBN leveren weinig omdat de per-veld-pijplijn OL daar al heeft uitgeput. Disjunct van enrich-gb-harvest.ts → veilig gelijktijdig."
          />

          <Script
            name="enrich-gb-harvest.ts"
            what="Gebundelde Google-Books harvester, WEZEN-ONLY (geen isbn13 én geen openlibrary_work_id). Eén GB-call per boek vult isbn13 + cover_url + original_language tegelijk via title-search — de enige route voor een boek zónder sleutel. GB is hard-gecapt op ~1.000 queries/dag; de client latcht op een 429 en stopt schoon. Draait via launchd."
            tags={['free']}
            meta={{
              coverage: <>wezen-only: <code className="font-mono">isbn13 IS NULL AND openlibrary_work_id IS NULL</code>. Cursor-resumebaar via <code className="font-mono">data/gb-harvest-cursor.json</code>; wrapt naar een nieuwe pass aan het einde.</>,
              cadence: 'dagelijks via launchd (10:00 + 14:00), budget ~900 calls/run',
              writes: <><code className="font-mono">books.isbn13</code> + <code className="font-mono">isbn_status</code>, <code className="font-mono">books.cover_url</code> + <code className="font-mono">cover_status</code>, <code className="font-mono">books.original_language</code> — NULL-guarded</>,
              output: <><code className="font-mono">data/gb-harvest-proposals.jsonl</code> (year/categories/pages/publisher = review-only, niet geschreven) + <code className="font-mono">data/gb-harvest-runs.log</code></>,
              idempotent: 'ja — NULL-guarded + dup-collision-safe; 429 stopt zonder mis-stempel',
              cost: 'gratis maar GB-quota ~1.000/dag (residu ná OL)',
            }}
            command={`# Dry-run — sample 15 GB-calls
npx tsx --env-file=.env.local scripts/enrich-gb-harvest.ts

# Apply, budget 900 (zo draait de launchd-job)
npx tsx --env-file=.env.local scripts/enrich-gb-harvest.ts --apply
npx tsx --env-file=.env.local scripts/enrich-gb-harvest.ts --apply --budget=500`}
            flags={[
              { flag: '--apply', desc: 'Schrijf naar DB (anders dry-run)' },
              { flag: '--budget=N', desc: 'Cap GB-calls per run (default 900, headroom onder 1k)' },
              { flag: '--reset-cursor', desc: 'Begin opnieuw vanaf id 0' },
            ]}
            note="Sinds 2026-06-08 wezen-only: keybare boeken zijn OL's werk (enrich-ol-harvest.ts). Draait via ~/.banned-books-gb-harvest.sh + launchd-plist org.banned-books.gb-harvest; logt naar data/gb-harvest-runs.log."
          />
        </div>

        {/* 3 — Per field */}
        <div id="per-field" className={`${cardCls} scroll-mt-4`}>
          <SectionHeader
            icon={Wrench}
            title="Per veld verrijken"
            blurb={
              <>
                Gebruik deze wanneer maar één veldsoort gevuld hoeft te worden — anders is{' '}
                <code className="font-mono text-xs">enrich-all.ts</code> handiger want die sequenceert ze correct.
                Bijna alle scripts ondersteunen <code className="font-mono text-xs">--apply</code> en{' '}
                <code className="font-mono text-xs">--limit=N</code>.
              </>
            }
          />

          {/* 3a — Books metadata */}
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mt-2">
            Books — metadata
          </h3>

          <Script
            name="enrich-isbn.ts"
            what="Zoekt missende ISBN-13 via Open Library (title+author, titel-ladder: canonical → transliteration → English-meaningful) en Google Books. Skipt '— All works'-pseudo-titles. Pre-check tegen books-tabel voorkomt unique-constraint crashes."
            tags={['free']}
            meta={{
              coverage: 'only-empty: books.isbn13 IS NULL',
              cadence: 'na elke import + ongoing-sweep',
              writes: <><code className="font-mono">books.isbn13</code></>,
              idempotent: 'ja — kandidaat-ISBNs die al op een andere rij staan worden geskipt',
              cost: 'gratis',
            }}
            command={`npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply
npx tsx --env-file=.env.local scripts/enrich-isbn.ts --apply --limit=200`}
            flags={[
              { flag: '--apply', desc: 'Schrijf isbn13 naar DB' },
              { flag: '--limit=N', desc: 'Cap op N boeken per run' },
            ]}
            note="OL/GB surfaceren soms POD/9798-prefix reprints met een gedeeld ISBN — de pre-write duplicate-check vangt die. Pseudo-title filter is title ILIKE '%— All works%' op SELECT-niveau."
          />

          <Script
            name="enrich-covers-v2.ts"
            what="Haalt missende cover images op via Google Books (title-only), Open Library (subtitle gestript), en Wikipedia thumbnail. Google Books URLs worden pHash-gechecked tegen de officiële 'image not available' placeholder; matches worden afgewezen en het boek krijgt cover_status='rejected_placeholder'."
            tags={['free']}
            meta={{
              coverage: <>only-empty: <code className="font-mono">cover_url IS NULL</code> AND <code className="font-mono">cover_status</code> NULL of <code className="font-mono">&apos;valid&apos;</code>. Met <code className="font-mono">--force</code> ook <code className="font-mono">rejected_placeholder</code> + <code className="font-mono">manual_override</code>.</>,
              cadence: 'na elke import + ongoing-sweep',
              writes: <><code className="font-mono">books.cover_url</code>, <code className="font-mono">books.cover_status</code></>,
              idempotent: 'ja — rejected_placeholder is sticky (--force re-checked)',
              cost: 'gratis',
            }}
            command={`npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply
npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --reset
npx tsx --env-file=.env.local scripts/enrich-covers-v2.ts --apply --force`}
            flags={[
              { flag: '--apply', desc: 'Schrijf cover_url / cover_status' },
              { flag: '--limit=N', desc: 'Cap op N boeken' },
              { flag: '--reset', desc: 'Herprobeer eerder gefaalde boeken' },
              { flag: '--force', desc: 'Bypass cover_status-skip (re-check rejected_placeholder + manual_override)' },
            ]}
            note="Referentie-image: assets/google-books-placeholder.png. Hamming-threshold = 5."
          />

          <Script
            name="enrich-gutenberg.ts"
            what="Zoekt elk boek op Project Gutenberg via Gutendex (title+author) en bewaart de ebook-id als de API een copyright=false match teruggeeft. Public-domain only. Sticky: gutenberg_checked_at wordt op beide hit én miss gezet, dus elk boek wordt exact één keer bevraagd. Rate-limited 1 req/sec; auto-pagineert."
            tags={['free']}
            meta={{
              coverage: <>sticky-checked-at: <code className="font-mono">gutenberg_checked_at IS NULL</code></>,
              cadence: 'na elke import + one-off backfill',
              writes: <><code className="font-mono">books.gutenberg_id</code>, <code className="font-mono">gutenberg_status</code>, <code className="font-mono">gutenberg_checked_at</code></>,
              idempotent: <>ja — &apos;not_found&apos; is sticky (catalogus wordt nooit globaal hervraagd). Netwerkfouten laten <code className="font-mono">checked_at</code> NULL.</>,
              cost: 'gratis',
            }}
            command={`# Dry-run — alleen tellen, geen DB-writes
npx tsx --env-file=.env.local scripts/enrich-gutenberg.ts

# Apply over alle nog-niet-gecheckte boeken (auto-pagineert)
npx tsx --env-file=.env.local scripts/enrich-gutenberg.ts --apply

# Twee terminals parallel — niet-overlappende slices
npx tsx --env-file=.env.local scripts/enrich-gutenberg.ts --apply --offset=0    --limit=1000
npx tsx --env-file=.env.local scripts/enrich-gutenberg.ts --apply --offset=1000 --limit=1000`}
            flags={[
              { flag: '--apply', desc: 'Schrijf gutenberg_id / status / checked_at' },
              { flag: '--limit=N', desc: 'Cap op N boeken' },
              { flag: '--offset=N', desc: 'Skip eerste N (disablet auto-pagination — fetcht exact één slice)' },
            ]}
            note="Hits renderen als https://gutenberg.org/ebooks/<id>. Boeken die al een gutenberg_id hadden zijn op status='valid' gezet door migratie 20260519184322."
          />

          <Script
            name="enrich-archive-org.ts"
            what="Zoekt elk boek op archive.org via de Advanced Search API (title + author + mediatype:texts) en bewaart de identifier als de match de title-contains + author-last-name validatie haalt. Sticky checked_at. Rate-limited 1 req/sec; auto-pagineert."
            tags={['free']}
            meta={{
              coverage: <>sticky-checked-at: <code className="font-mono">archive_org_checked_at IS NULL</code></>,
              cadence: 'na elke import + one-off backfill',
              writes: <><code className="font-mono">books.archive_org_id</code>, <code className="font-mono">archive_org_status</code>, <code className="font-mono">archive_org_checked_at</code></>,
              idempotent: 'ja — not_found is sticky',
              cost: 'gratis',
            }}
            command={`npx tsx --env-file=.env.local scripts/enrich-archive-org.ts
npx tsx --env-file=.env.local scripts/enrich-archive-org.ts --apply
npx tsx --env-file=.env.local scripts/enrich-archive-org.ts --apply --offset=0    --limit=1000
npx tsx --env-file=.env.local scripts/enrich-archive-org.ts --apply --offset=1000 --limit=1000`}
            flags={[
              { flag: '--apply', desc: 'Schrijf archive_org_id / status / checked_at' },
              { flag: '--limit=N', desc: 'Cap op N boeken' },
              { flag: '--offset=N', desc: 'Skip eerste N (disablet auto-pagination)' },
            ]}
            note="Hits renderen als https://archive.org/details/<archive_org_id>."
          />

          <Script
            name="enrich-descriptions-v2.ts"
            what="Vult missende book-descriptions met gegronde bronnen: Wikipedia (EN + langlinks) + Open Library (by-ISBN eerst — exacte editie → work, sterkste binding; dan work-id; dan title/author search) + Google Books, met title-fuzz + author-surname cross-check op elke geaccepteerde bron. LLM wordt alleen gebruikt voor 'grounded synthesis' (samenvatten uit aangereikte bron-tekst, nooit free-form generation). Schrijft description_source_url + description_source_type voor provenance. Vervangt de oude enrich-descriptions.ts (v1) — die had GPT free-form fallback, is gedeprecaard 2026-05-28 na een hallucinatie-incident en verwijderd 2026-06-11."
            tags={['free', 'gpt', 'destructive']}
            meta={{
              coverage: <><strong>default:</strong> only-empty <code className="font-mono">description_book</code>. <strong>Met --slug:</strong> single-target. <strong>Met --overwrite:</strong> all-rows. <strong>Met --process-flagged:</strong> ook door judge gewiste rijen meenemen. <strong>Met --reground-ungrounded:</strong> ISBN-rijen waarvan de synopsis nog géén tracked bron heeft (pre-v2 ongegronde tekst) — overschrijft alleen waar een geverifieerde bron resolvet, backup naar <code className="font-mono">data/description-book-reground-backup-&lt;ts&gt;.csv</code>.</>,
              cadence: 'na elke import + na judge-run + one-off reground van pre-v2 tekst',
              writes: <><code className="font-mono">books.description_book</code>, <code className="font-mono">books.description_source_url</code>, <code className="font-mono">books.description_source_type</code>, <code className="font-mono">books.data_quality_status</code> (confident bij ≥2 bronnen, default bij 1, flagged bij geen), <code className="font-mono">books.ai_drafted</code> (alleen true voor llm_grounded_*).</>,
              idempotent: 'default ja (alleen NULLs); met --slug/--overwrite destructief',
              cost: 'gratis + ~$0.001/boek voor LLM synthesis (gpt-4o-mini)',
            }}
            command={`# Default — alleen NULL description_book, geen LLM
npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --apply --concurrency=5

# Met grounded LLM synthesis (samenvattingen uit ≥2 cited bronnen)
npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --apply --allow-llm --concurrency=5

# Ook door judge gewiste rijen meenemen (na judge-run)
npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --apply --allow-llm --process-flagged --concurrency=5

# Eén boek
npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --apply --allow-llm --slug=the-kite-runner

# Eerste 50 boeken herverrijken, met overwrite
npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --apply --allow-llm --overwrite --limit=50

# Pre-v2 ongegronde synopses her-gronden via ISBN (dry-run eerst!)
npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --reground-ungrounded --limit=40 --concurrency=4
npx tsx --env-file=.env.local scripts/enrich-descriptions-v2.ts --reground-ungrounded --apply --allow-llm --concurrency=5`}
            flags={[
              { flag: '--apply', desc: 'Schrijf naar DB' },
              { flag: '--allow-llm', desc: 'Sta grounded LLM synthesis toe (anders alleen letterlijke extracts)' },
              { flag: '--process-flagged', desc: 'Ook rijen met data_quality_status=flagged meenemen' },
              { flag: '--concurrency=N', desc: 'N workers parallel (default 1, max ~5)' },
              { flag: '--limit=N', desc: 'Cap op N boeken' },
              { flag: '--slug=<slug>', desc: 'Eén boek, bypasst alle filters' },
              { flag: '--overwrite', desc: 'Vervangt ook bestaande descriptions' },
              { flag: '--reground-ungrounded', desc: 'Her-gront ISBN-rijen met ongetrackte synopsis; overschrijft alleen bij geverifieerde bron, backupt originelen' },
            ]}
            note="V2 vervangt v1 (enrich-descriptions.ts, verwijderd 2026-06-11 — het /api/admin/enrich/run endpoint draait al sinds 2026-05-28 in-process op v2) én de losse GPT-fallback (enrich-descriptions-gpt.ts, gedeprecaard maar nog aanwezig). Gebruik --slug voor sanity-checks vóór een grote overwrite. --reground-ungrounded laat rijen waar geen bron resolvet ongemoeid (nooit een gevulde synopsis naar 'flagged' degraderen)."
          />

          <Script
            name="enrich-descriptions-consensus.ts"
            what="Derde, zwakkere recovery-tier voor book-descriptions: voor boeken die de v2-ladder niet kon gronden maar die de modellen wél kennen. GPT-4o-mini én Gemini-2.5-flash schrijven elk onafhankelijk een beschrijving met een harde UNKNOWN-escape ('ken je dit exacte boek niet betrouwbaar → UNKNOWN, niet gokken uit de titel'); een derde judge bevestigt overeenstemming op CONCRETE, specifieke feiten (geen generieke thema's, niet titel-afleidbaar); de opgeslagen tekst wordt gesynthetiseerd uit ALLEEN de overeengekomen feiten. UNKNOWN of disagreement → rij blijft ongemoeid (nooit gewist, nooit geconfabuleerd). Vereist GOOGLE_AI_API_KEY + de migratie die 'ai_consensus' aan de source_type-CHECK toevoegt."
            tags={['gpt', 'destructive']}
            meta={{
              coverage: <>ungrounded rijen (<code className="font-mono">description_source_type IS NULL</code>) binnen <code className="font-mono">--lang</code> (default en). Alleen ACCEPT-rijen worden geschreven; REJECT/UNKNOWN blijven ongemoeid.</>,
              cadence: 'one-off per taal-scope (na wipe + reground); ~10% accept op en',
              writes: <><code className="font-mono">books.description_book</code> + <code className="font-mono">description_source_type=&apos;ai_consensus&apos;</code> + <code className="font-mono">ai_drafted=true</code>; backup naar <code className="font-mono">data/consensus-descriptions-backup-&lt;ts&gt;.csv</code></>,
              idempotent: 'ja — source_type IS NULL guard slaat al-geschreven rijen over',
              cost: '~$0.003/boek (gpt-4o-mini + gemini-2.5-flash, 3 calls)',
            }}
            command={`# Dry-run (geen writes) — toont accept / reject / unknown + samples
npx tsx --env-file=.env.local scripts/enrich-descriptions-consensus.ts --limit=200

# Apply op scope en (na 'supabase db push' van de ai_consensus-migratie)
npx tsx --env-file=.env.local scripts/enrich-descriptions-consensus.ts --apply

# Andere taal / klein / één boek
npx tsx --env-file=.env.local scripts/enrich-descriptions-consensus.ts --apply --lang=fr
npx tsx --env-file=.env.local scripts/enrich-descriptions-consensus.ts --apply --slug=the-martian`}
            flags={[
              { flag: '--apply', desc: 'Schrijf ACCEPT-rijen naar DB (default: dry-run)' },
              { flag: '--lang=xx', desc: 'Taal-scope (default en)' },
              { flag: '--limit=N', desc: 'Cap op N kandidaten' },
              { flag: '--slug=<slug>', desc: 'Eén boek' },
              { flag: '--concurrency=N', desc: 'Parallel workers (default 4)' },
              { flag: '--accept-conf=N', desc: 'Min. judge-confidence om te accepteren (default 0.7)' },
            ]}
            note="Aparte, zwakkere tier dan llm_grounded_* — op de boekpagina gelabeld 'AI-generated summary, cross-checked, not from a single cited source' en telt NIET als confident in score-data-quality. Valideer een nieuwe scope eerst met scripts/validate-consensus-descriptions.ts (recall + false-positive rate, geen writes). Gevalideerd 2026-06-05: 0% false-positives."
          />

          <Script
            name="enrich-genres-gpt.ts"
            what="Kiest 1–3 genre-slugs uit de vaste 21-slug vocabulary (src/components/genre-badge.tsx) op basis van title + author + first_published_year + description_book. Alleen boeken met een lege genres-array worden geraakt; handmatige edits overleven re-runs. Pagineert over de hele kandidatenset (.range() per 1000, geordend op id) — niet langer gecapt op de eerste 1000 rijen."
            tags={['gpt']}
            meta={{
              coverage: <>default: <code className="font-mono">genres = &apos;{'{}'}&apos;</code> (lege array). Met --overwrite: all-rows. Bij apply zonder <code className="font-mono">--limit</code> wordt de <strong>volledige</strong> kandidatenset verwerkt (geen 1000-cap meer).</>,
              cadence: 'na elke import + one-off backfill',
              writes: <><code className="font-mono">books.genres</code> (1–3 slugs uit vaste vocabulary)</>,
              idempotent: <>ja — boeken met empty/low-confidence GPT-resultaat worden geskipt (en houden dus <code className="font-mono">genres = &apos;{'{}'}&apos;</code> → zie retry-script hieronder)</>,
              cost: 'GPT-mini (~€1–3 voor volledige backlog)',
            }}
            command={`# Dry-run op 5 samples
npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts

# Eén specifiek boek
npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --slug=animal-farm

# Kleine batch eerst
npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --apply --limit=100

# Volledige sweep (alle kandidaten, gepagineerd)
npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --apply`}
            flags={[
              { flag: '--apply', desc: 'Schrijf genres naar DB' },
              { flag: '--limit=N', desc: 'Cap op N boeken (default: alle kandidaten bij apply, 5 bij dry-run)' },
              { flag: '--slug=X', desc: 'Eén boek (werkt met of zonder --overwrite)' },
              { flag: '--overwrite', desc: 'Process ook boeken die al genres hebben' },
              { flag: '--delay=N', desc: 'Milliseconds tussen calls (default 300)' },
              { flag: '--model=X', desc: 'Override model (default gpt-4o-mini)' },
            ]}
            note={
              <>
                Genre-vocabulary leeft in src/components/genre-badge.tsx (21 slugs). Houd in sync tot vocabulary naar een
                DB-tabel verhuist. Let op: boeken die het model niet kan plaatsen (UNKNOWN / low-confidence) houden{' '}
                <code className="font-mono">genres = &apos;{'{}'}&apos;</code> en komen elke run terug — dat is geen bug.
                Na een mini-sweep zijn de overgebleven kandidaten precies die harde gevallen; ruim ze op met{' '}
                <code className="font-mono">enrich-genres-retry-gpt.ts</code> hieronder.
              </>
            }
          />

          <Script
            name="enrich-genres-retry-gpt.ts"
            what="Tweede-pass genre-enrichment voor de boeken die gpt-4o-mini niet kon plaatsen. Dunne wrapper rond enrich-genres-gpt.ts: zelfde vocabulary, prompt, filter en paginering — maar default-model is gpt-4o (sterker), dat een deel van de obscure / anderstalige / niche titels alsnog herkent. Targets exact dezelfde lege-genres-set, dus draai dit ná de goedkope mini-sweep, niet ervoor."
            tags={['gpt']}
            meta={{
              coverage: <>default: <code className="font-mono">genres = &apos;{'{}'}&apos;</code> — de rest die de mini-sweep liet staan. Met --overwrite: all-rows.</>,
              cadence: 'one-off ná een enrich-genres-gpt.ts sweep',
              writes: <><code className="font-mono">books.genres</code> (1–3 slugs uit vaste vocabulary)</>,
              idempotent: <>ja — empty/low-confidence resultaten worden nog steeds geskipt; echt onclassificeerbare titels (geen training-data) blijven <code className="font-mono">genres = &apos;{'{}'}&apos;</code></>,
              cost: 'GPT-4o (~10–20× mini per call; alleen de rest-set, dus klein totaal)',
            }}
            command={`# Dry-run op 5 samples (gpt-4o)
npx tsx --env-file=.env.local scripts/enrich-genres-retry-gpt.ts

# Ruim de hele rest-set op
npx tsx --env-file=.env.local scripts/enrich-genres-retry-gpt.ts --apply

# Kleine batch / ander model
npx tsx --env-file=.env.local scripts/enrich-genres-retry-gpt.ts --apply --limit=50
npx tsx --env-file=.env.local scripts/enrich-genres-retry-gpt.ts --apply --model=gpt-4.1`}
            flags={[
              { flag: '--apply', desc: 'Schrijf genres naar DB' },
              { flag: '--limit=N', desc: 'Cap op N boeken (default: alle kandidaten bij apply, 5 bij dry-run)' },
              { flag: '--slug=X', desc: 'Eén boek' },
              { flag: '--overwrite', desc: 'Process ook boeken die al genres hebben' },
              { flag: '--delay=N', desc: 'Milliseconds tussen calls (default 300)' },
              { flag: '--model=X', desc: 'Override model (default gpt-4o)' },
            ]}
            note={
              <>
                Wat na deze pass nóg <code className="font-mono">genres = &apos;{'{}'}&apos;</code> houdt, zijn titels die
                geen enkel model kent (lokale publicaties, anonieme/ontbrekende metadata). Die zijn een handmatige
                genre-toewijzing via de admin, geen model-probleem.
              </>
            }
          />

          {/* 3b — Bans */}
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mt-4">
            Bans — events &amp; context
          </h3>

          <Script
            name="enrich-ban-descriptions-gpt.ts"
            what="Genereert per-boek de 'waarom is dit boek verboden'-narrative — concreet incident: jaar, instelling, school district, rechter, uitkomst. 2–3 zinnen (min. 60 char). Met --slug of --overwrite herschrijft het ook bestaande description_ban. Let op: ondanks de naam is dit één tekst per boek (books.description_ban), NIET één per ban-event — voor per-event narratives zie bans.description gevuld door apply-wiki-enrichment.ts."
            tags={['gpt', 'destructive']}
            meta={{
              coverage: <><strong>default:</strong> only-empty <code className="font-mono">books.description_ban</code>. <strong>Met --slug:</strong> single-target. <strong>Met --overwrite:</strong> all-rows.</>,
              cadence: 'na elke import',
              writes: <><code className="font-mono">books.description_ban</code> — één per boek (overschrijft met --slug/--overwrite; geen backup)</>,
              output: <>Verschijnt op de boek-detailpagina als rode card <strong>&quot;Why it was banned&quot;</strong> — zie <a href="/books/the-kite-runner" className="text-brand hover:underline">/books/&lt;slug&gt;</a></>,
              idempotent: 'default ja; --overwrite is destructief',
              cost: 'GPT-mini',
            }}
            command={`# Default — alleen lege description_ban
npx tsx --env-file=.env.local scripts/enrich-ban-descriptions-gpt.ts --apply --limit=100

# Hergenereer één boek
npx tsx --env-file=.env.local scripts/enrich-ban-descriptions-gpt.ts --apply --slug=the-kite-runner

# Hergenereer alles
npx tsx --env-file=.env.local scripts/enrich-ban-descriptions-gpt.ts --apply --overwrite --limit=50`}
            flags={[
              { flag: '--apply', desc: 'Schrijf ban-descriptions' },
              { flag: '--limit=N', desc: 'Cap (default 999 apply, 3 dry-run)' },
              { flag: '--slug=X', desc: 'Eén boek, overschrijft' },
              { flag: '--overwrite', desc: 'Alle bans, overschrijft' },
              { flag: '--delay=N', desc: 'Milliseconds tussen calls (default 500)' },
            ]}
            note="Sanity-check met --slug voor je --overwrite draait."
          />

          <Script
            name="enrich-censorship-context-gpt.ts"
            what="Genereert per-boek de bredere historisch-politieke achtergrond — patroon van censuur, jurisdicties, formele uitkomsten over meerdere landen. 2–4 zinnen (min. 80 char). Complement op description_ban (concreet incident); dit is het bredere plaatje."
            tags={['gpt']}
            meta={{
              coverage: <>only-empty <code className="font-mono">books.censorship_context</code>, alleen op boeken die al een <code className="font-mono">description_book</code> hebben</>,
              cadence: 'na elke import',
              writes: <><code className="font-mono">books.censorship_context</code> — één per boek</>,
              output: <>Verschijnt op de boek-detailpagina als grijze card <strong>&quot;Censorship history&quot;</strong>, direct onder de &quot;Why it was banned&quot;-card</>,
              idempotent: 'ja',
              cost: 'GPT-mini',
            }}
            command={`npx tsx --env-file=.env.local scripts/enrich-censorship-context-gpt.ts --apply --limit=50`}
            flags={[
              { flag: '--apply', desc: 'Schrijf censorship_context' },
              { flag: '--limit=N', desc: 'Cap (default 150)' },
            ]}
          />

          <Script
            name="enrich-reasons.ts"
            what="Auto-classificeert ban reasons (political, religious, sexual content…) via GPT voor bans die nu als 'other' getagd staan."
            tags={['gpt']}
            meta={{
              coverage: <>flag-driven: bans waarvan reasons <em>uitsluitend</em> <code className="font-mono">&apos;other&apos;</code> zijn. Bans met enige specifieke reason worden nooit aangeraakt.</>,
              cadence: 'na elke import',
              writes: <><strong>Vervangt</strong> <code className="font-mono">ban_reason_links</code> (DELETE + INSERT)</>,
              idempotent: 'ja — exclusieve-other rijen krijgen reclassificatie',
              cost: 'GPT-mini',
            }}
            command={`npx tsx --env-file=.env.local scripts/enrich-reasons.ts --apply`}
            flags={[
              { flag: '--apply', desc: 'Update ban reason classifications' },
            ]}
          />

          {/* 3c — Authors */}
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mt-4">
            Authors
          </h3>

          <Script
            name="enrich-author-bios.ts"
            what="Vult missende author bios + birth/death year + birth country (en photos) vanuit Wikipedia. Zoekt de top-6 Wikipedia-resultaten (was: alleen de eerste — de srlimit=1 naamgenoot-bug) en accepteert er één alléén als de auteur het ONDERWERP van de intro is, de pagina als schrijver gecategoriseerd is, én de volledige naam matcht (≥2 tokens). Zo worden boek-blurbs en gelijknamige andere personen (een songwriter/acteur met dezelfde achternaam) geweigerd. --photos-only backfilt alleen foto's voor authors die al een bio hebben."
            tags={['free']}
            meta={{
              coverage: <><strong>default:</strong> only-empty <code className="font-mono">bio</code>. <strong>--photos-only:</strong> only-empty <code className="font-mono">photo_url</code> (alleen auteurs mét bio).</>,
              cadence: 'na elke import + ongoing-sweep',
              writes: <>default: <code className="font-mono">bio</code> + (waar beschikbaar) <code className="font-mono">birth_year</code> / <code className="font-mono">death_year</code> / <code className="font-mono">birth_country</code> / <code className="font-mono">photo_url</code>. --photos-only: alleen <code className="font-mono">photo_url</code>.</>,
              idempotent: 'ja — bestaande bios worden niet overschreven',
              cost: 'gratis',
            }}
            command={`# Vul bios voor maximaal 50 auteurs
npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --apply

# Grotere batch
npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --apply --limit=200

# Photo-only backfill voor auteurs die al een bio hebben
npx tsx --env-file=.env.local scripts/enrich-author-bios.ts --photos-only --apply --limit=500`}
            flags={[
              { flag: '--apply', desc: 'Schrijf bio + birth/death/country/photo_url' },
              { flag: '--limit=N', desc: 'Cap (default 50)' },
              { flag: '--photos-only', desc: 'Alleen auteurs mét bio en zonder foto' },
            ]}
            note="Sinds 2026-06-09: top-6 kandidaten + subject/schrijver-categorie/volledige-naam-gate stoppen de oude naamgenoot-besmetting. Wat het NIET kan: twee personen met exact dezelfde volledige naam scheiden (een historische vs. de auteur) — draai daarom ná een recovery-run remediate-author-bios.ts (LLM-poort) hieronder. Default-mode kan nog manuele birth/death/country overschrijven bij auteurs zónder bio."
          />

          <Script
            name="enrich-author-ol.ts"
            what="Verrijkt auteurs uit de Open Library Authors API — de long-tail-bron voor auteurs die enrich-author-bios.ts niet via Wikipedia vond. Exact-key resolutie: leidt de OL-author-id af uit de OL-work-records van de eigen boeken van de auteur (het gedeelde werk is het bewijs, geen blinde naam-gok), met naam-search + gedeelde-titel-verificatie als fallback. Vult bio, birth_year, death_year en name_native (uit een niet-Latijns alternate_name). Raakt photo_url NIET aan — dat blijft bij enrich-author-photos-v2. birth_country is geen OL-veld en wordt niet gevuld."
            tags={['free']}
            meta={{
              coverage: <>sticky-checked-at + only-empty: <code className="font-mono">ol_checked_at IS NULL</code> AND (<code className="font-mono">bio</code> OF <code className="font-mono">birth_year</code> NULL), excl. <code className="font-mono">is_placeholder</code>. Met --recheck vervalt de sticky-gate.</>,
              cadence: 'one-off long-tail-sweep ná enrich-author-bios.ts (Wikipedia eerst)',
              writes: <><code className="font-mono">authors.bio</code> / <code className="font-mono">birth_year</code> / <code className="font-mono">death_year</code> / <code className="font-mono">name_native</code> (NULL-guarded) + altijd <code className="font-mono">openlibrary_author_id</code> (cache) en <code className="font-mono">ol_checked_at</code> (sticky stamp, ook bij miss)</>,
              idempotent: 'ja — NULL-guarded + misses sticky; bestaande/Wikipedia-waarden worden nooit overschreven',
              cost: 'gratis (geen dagcap)',
            }}
            command={`# Dry-run — sample 15 (of --limit=N zonder te schrijven)
npx tsx --env-file=.env.local scripts/enrich-author-ol.ts --limit=50

# Apply (lange run; resumebaar via ol_checked_at)
npx tsx --env-file=.env.local scripts/enrich-author-ol.ts --apply

# Eén auteur, bypass gates
npx tsx --env-file=.env.local scripts/enrich-author-ol.ts --slug=george-orwell`}
            flags={[
              { flag: '--apply', desc: 'Schrijf naar DB (anders dry-run)' },
              { flag: '--limit=N', desc: 'Cap op N auteurs (geldt ook voor dry-run sample)' },
              { flag: '--recheck', desc: 'Negeer ol_checked_at sticky-gate' },
              { flag: '--slug=X', desc: 'Eén auteur; bypass alle gates' },
            ]}
            note="Draai NA enrich-author-bios.ts (Wikipedia is de sterkere primaire bron). OL vindt het author-record betrouwbaar (~94%), maar birth_date/bio zijn dun voor moderne auteurs — de winst zit in oudere/klassieke/non-Westerse auteurs + name_native voor niet-Latijns schrift."
          />

          <Script
            name="enrich-author-photos-v2.ts"
            what="Tweede-pass photo backfill — wat enrich-author-bios.ts niet via Wikipedia-articlesearch vond. Drie bronnen op volgorde: (1) Wikidata (P31=Q5 human + writer-ish P106 → P18 → Commons thumbnail); (2) OpenLibrary /search/authors fallback (HEAD-gechecked); (3) author personal site (gegate op P31=Q5 + writer-ish P106; JSON-LD Person.image + <img> tags gescoord op author-naam-tokens, met denylist voor logos/banners/book covers). og:image is precision-over-recall geskipt (te veel false positives). Logt elke poging naar data/photo-enrichment-{ts}.csv."
            tags={['free']}
            meta={{
              coverage: <>sticky-checked-at + only-empty: <code className="font-mono">photo_v2_checked_at IS NULL</code> AND <code className="font-mono">photo_url IS NULL</code>. Met --recheck: alleen photo_url-NULL filter blijft.</>,
              cadence: 'one-off + na sources/scoring change (--recheck)',
              writes: <><code className="font-mono">authors.photo_url</code>, <code className="font-mono">photo_v2_checked_at</code>; foto&apos;s buiten <code className="font-mono">ALLOWED_IMAGE_HOSTS</code> worden gemirror&apos;d naar Supabase Storage bucket <code className="font-mono">author-photos</code>.</>,
              output: <><code className="font-mono">data/photo-enrichment-&lt;ts&gt;.csv</code> (per-author log)</>,
              idempotent: 'ja — misses zijn sticky, default-runs maken monotone voortgang',
              cost: 'gratis',
            }}
            command={`# Default: alleen auteurs die V2 nog niet gezien heeft
npx tsx --env-file=.env.local scripts/enrich-author-photos-v2.ts --apply --limit=1000

# Re-check na sources/scoring change
npx tsx --env-file=.env.local scripts/enrich-author-photos-v2.ts --apply --recheck --limit=1000`}
            flags={[
              { flag: '--apply', desc: 'Schrijf photo_url + photo_v2_checked_at; uploadt naar Storage' },
              { flag: '--limit=N', desc: 'Cap (default 50)' },
              { flag: '--recheck', desc: 'Negeer photo_v2_checked_at sticky-gate' },
              { flag: '--slug=X', desc: 'Eén auteur; bypass beide gates' },
            ]}
            note="Draai NA enrich-author-bios.ts --photos-only — dat is de goedkope eerste sweep. V2 levert nog een paar % extra. Mirror is content-type + size + magic-byte gegated (5KB–5MB, jpg/png/webp/gif)."
          />

          <Script
            name="remediate-author-bios.ts"
            what="LLM-poort die besmette author-bio's opruimt — bio's die enrich-author-bios.ts (vóór de gate) uit het verkeerde Wikipedia-artikel haalde. Vier foutklassen die alléén een LLM betrouwbaar scheidt: wrong_person (andere persoon, zelfde naam — bv. de microbioloog Suzanne Walker i.p.v. de comics-auteur), not_a_bio (boek/film/band i.p.v. persoon), own_book_blurb, en llm_artifact. gpt-4o-mini classificeert elke bio tegen naam + onze boektitels (correct / wrong_person / not_a_bio / uncertain). Dit is de verplichte verificatie-stap ná een enrich-author-bios recovery-run."
            tags={['gpt', 'destructive']}
            meta={{
              coverage: <>alle auteurs met een <code className="font-mono">bio</code> (of <code className="font-mono">--slugs=</code> voor gerichte test). Bij <code className="font-mono">--apply</code> zonder <code className="font-mono">--limit</code>: de volledige set.</>,
              cadence: 'ná elke enrich-author-bios recovery-run (recover → verify)',
              writes: <><strong>nullt</strong> <code className="font-mono">bio</code> + verdacht <code className="font-mono">birth_year</code>/<code className="font-mono">death_year</code>/<code className="font-mono">birth_country</code> voor wrong_person + not_a_bio. correct behouden; uncertain naar review-lijst. Backup-CSV vóór elke null.</>,
              output: <><code className="font-mono">data/author-bio-remediation-applied-&lt;ts&gt;.jsonl</code> (alle oordelen) + <code className="font-mono">-backup-&lt;ts&gt;.csv</code> (herstelbron) + <code className="font-mono">-uncertain-&lt;ts&gt;.jsonl</code></>,
              idempotent: 'ja — genullde rijen vallen weg uit de bio-set; classificatie, geen generatie (lage confabulatie)',
              cost: '~$1-2 voor de volledige set (gpt-4o-mini, classificatie)',
            }}
            command={`# Dry-run — verdeling correct/wrong_person/not_a_bio/uncertain (sample 40)
npx tsx --env-file=.env.local scripts/remediate-author-bios.ts

# Valideer op bekende gevallen
npx tsx --env-file=.env.local scripts/remediate-author-bios.ts --slugs=suzanne-walker,george-orwell

# Volledige run — backup-CSV, dan null
npx tsx --env-file=.env.local scripts/remediate-author-bios.ts --apply`}
            flags={[
              { flag: '--apply', desc: 'Schrijf (backup → null voor wrong_person/not_a_bio)' },
              { flag: '--slugs=a,b', desc: 'Gerichte set op slug (validatie)' },
              { flag: '--limit=N', desc: 'Cap op N auteurs' },
              { flag: '--concurrency=N', desc: 'Parallelle LLM-calls (default 6)' },
            ]}
            note="Deterministische naam-matching kan zelfde-vólledige-naam-personen niet scheiden — daarom is dit de poort ná enrich-author-bios.ts. Read-only verkenning vooraf kan met de gitignored scripts/_audit_author_bio_contamination.ts (deterministische pre-filter, geen LLM)."
          />
        </div>

        {/* 4 — Wikipedia 3-step */}
        <div id="wiki" className={`${cardCls} scroll-mt-4`}>
          <SectionHeader
            icon={Sparkles}
            title="Wikipedia ban-events — 3 stappen"
            blurb={
              <>
                Voor elk top-ranked boek: vind het dedicated Wikipedia-artikel, extraheer ban-events met year +
                institution + actor-specifics, en merge ze in de <code className="font-mono text-xs">bans</code>-tabel.
                End-to-end idempotent; dedup op country + scope + year ±1 + institution. Genereert één{' '}
                <code className="font-mono text-xs">ban_sources</code>-rij per boek met Wikipedia-URL.
              </>
            }
          />

          <Script
            name="1. build-wiki-enrichment-worklist.ts"
            what="Selecteert boeken (default: top 50 globaal + top 10 per ban-reason, 'other' uitgesloten) en vindt voor elk het Wikipedia-artikel via opensearch + redirect-following + title-similarity-guard + author-intro-validation. Output: JSON voor stap 2 + een human-reviewable markdown."
            tags={['free', 'safe']}
            meta={{
              coverage: 'flag-driven: top-N globaal + top-N per ban-reason (default 50 + 10)',
              cadence: 'one-off per enrichment-batch',
              writes: '— (geen DB-writes)',
              output: <><code className="font-mono">data/wiki-enrichment-worklist.json</code> + <code className="font-mono">.md</code></>,
              idempotent: <>ja — leest optionele manual overrides uit <code className="font-mono">data/wiki-enrichment-overrides.json</code></>,
              cost: 'gratis',
            }}
            command={`node --env-file=.env.local --import tsx scripts/build-wiki-enrichment-worklist.ts`}
            note="Review de .md voor stap 2. Alles wat niet 'high' confidence is wordt geëxcludeerd — voeg een override toe en run opnieuw."
          />

          <Script
            name="2. stage-wiki-enrichment.ts"
            what="Fetcht per high-confidence boek het Wikipedia-artikel, leest huidige DB-bans, en vraagt GPT-4o-mini om een gestructureerd JSON-voorstel: nieuwe bans (met verplichte Wikipedia-quote), updates aan bestaande rijen, optionele book-level rewrites. Strikte prompt verbiedt vage 'criticised in X' entries en regressies van bestaande descriptions."
            tags={['gpt']}
            meta={{
              coverage: <>high-confidence rijen uit de worklist (met --skip-existing: alleen boeken zonder staging file)</>,
              cadence: 'one-off per enrichment-batch',
              writes: '— (geen DB-writes; alleen staging files)',
              output: <>één JSON per boek in <code className="font-mono">data/wiki-enrichment-staging/&lt;slug&gt;.json</code> + <code className="font-mono">_summary.md</code></>,
              idempotent: 'ja met --skip-existing',
              cost: 'GPT-mini (~$0.003 per boek)',
            }}
            command={`# Stage all high-confidence books
node --env-file=.env.local --import tsx scripts/stage-wiki-enrichment.ts --skip-existing

# Eén boek of batch
node --env-file=.env.local --import tsx scripts/stage-wiki-enrichment.ts --only=793,6
node --env-file=.env.local --import tsx scripts/stage-wiki-enrichment.ts --limit=10
node --env-file=.env.local --import tsx scripts/stage-wiki-enrichment.ts --dry-llm   # plumbing test, no GPT cost`}
            flags={[
              { flag: '--only=<ids>', desc: 'Comma-separated book_ids' },
              { flag: '--limit=N', desc: 'Cap op N boeken' },
              { flag: '--skip-existing', desc: 'Skip boeken met bestaand staging file' },
              { flag: '--dry-llm', desc: 'Placeholder staging files zonder OpenAI call' },
            ]}
            note="Spot-check de _summary.md's biggest-yield rijen voor je apply draait. Edit individuele staging files om slechte voorstellen te droppen."
          />

          <Script
            name="3. apply-wiki-enrichment.ts"
            what="Leest staging files en past voorstellen toe. Dedup op country+scope+year ±1 + institution. 'Bare' bestaande rijen (zonder description) worden gepromoot tot updates; opvolgende matches op dezelfde rij worden als distincte granular events ingevoegd. Description-regression-guard verhindert dat een kortere tekst een langere overschrijft. Voegt missende landen automatisch toe."
            tags={['destructive', 'safe']}
            meta={{
              coverage: <>alle staging files (of --slug voor één)</>,
              cadence: 'one-off per enrichment-batch (na stage stap)',
              writes: <><code className="font-mono">bans</code> (insert/update — incl. <code className="font-mono">bans.description</code> per-event narrative met jaar+institution), <code className="font-mono">ban_sources</code>, <code className="font-mono">ban_source_links</code>, <code className="font-mono">books.description_ban</code> + <code className="font-mono">books.censorship_context</code> (alleen als de nieuwe tekst strikt beter is — regression-guard), <code className="font-mono">countries</code> (auto-insert)</>,
              output: <><code className="font-mono">data/wiki-enrichment-applied.log</code> (full audit)</>,
              idempotent: 'ja — dedup + regression-guard maakt re-runs veilig',
              cost: 'gratis',
            }}
            command={`# Altijd eerst dry-run; check de log
node --env-file=.env.local --import tsx scripts/apply-wiki-enrichment.ts
less data/wiki-enrichment-applied.log

# Apply als de log er goed uitziet
node --env-file=.env.local --import tsx scripts/apply-wiki-enrichment.ts --apply

# Eén boek
node --env-file=.env.local --import tsx scripts/apply-wiki-enrichment.ts --apply --slug=lady-chatterleys-lover`}
            flags={[
              { flag: '--apply', desc: 'Schrijf naar DB (zonder dit: print wat zou veranderen)' },
              { flag: '--only=<slugs>', desc: 'Comma-separated slugs (alias: --slug=)' },
            ]}
          />

          {/* Recept-prompt voor nieuwe Claude-sessie */}
          <details className="mt-2 rounded-md border border-gray-200 bg-gray-50/60">
            <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-gray-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Recept-prompt voor een nieuwe Claude-sessie
              <span className="ml-auto text-xs text-gray-500 font-normal">klik om uit te klappen</span>
            </summary>
            <div className="px-4 pb-4">
              <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                Plak dit in een nieuwe Claude Code-sessie als startprompt. De prompt is zelf-bevattend — Claude vindt
                de scripts op naam en weet welke review-gates jij wilt zien voor er DB-writes plaatsvinden.
              </p>
              <pre className="bg-gray-950 text-gray-100 text-[11px] leading-relaxed rounded-md px-4 py-3 font-mono whitespace-pre-wrap overflow-x-auto">{`Verrijk de top-gerankte boeken via Wikipedia met de 3-fasen pipeline in deze
repo. Volg deze volgorde en wacht na elke fase op mijn akkoord voor je verder
gaat.

1. scripts/build-wiki-enrichment-worklist.ts
   - Selecteert boeken (default: top 50 globaal uit v_top_banned_books +
     top 10 per ban-reason, 'other' uitgesloten).
   - Matcht elk boek tegen zijn Wikipedia-artikel via opensearch +
     redirect-volging + title-similarity-guard + author-intro-validatie.
   - Output: data/wiki-enrichment-worklist.json + .md.
   - Handmatige URL-correcties in data/wiki-enrichment-overrides.json:
       { "<book_id>": { "url": "https://en.wikipedia.org/wiki/...", "note": "..." } }
     of   { "<book_id>": { "url": null, "note": "geen artikel" } } om te skippen.

2. scripts/stage-wiki-enrichment.ts
   - Vereist OPENAI_API_KEY in .env.local. Gebruikt GPT-4o-mini.
   - Fetcht per high-confidence boek het Wikipedia-artikel, leest huidige
     DB-bans, en vraagt om gestructureerd JSON: nieuwe bans, updates,
     book-level rewrites. Elke voorgestelde gebeurtenis MOET een directe
     Wikipedia-quote met specifieke feiten (jaar, instelling of actor)
     bevatten — vage "X criticised the book" is verboden.
   - Output: data/wiki-enrichment-staging/<slug>.json per boek +
     _summary.md.
   - Flags: --only=<book_ids>, --limit=N, --skip-existing, --dry-llm.

3. scripts/apply-wiki-enrichment.ts
   - Dry-run default; --apply schrijft. Idempotent met dedup op
     country + scope + year ±1 + institution.
   - Promote-to-update voor bestaande rijen met description=null.
   - Description-regressie-guard: bestaande tekst wordt nooit ingekort.
   - Voegt ontbrekende landen aan countries-tabel toe.
   - Maakt 1 ban_sources rij per Wikipedia-URL + linkt aan alle aangepaste
     bans. Audit-log: data/wiki-enrichment-applied.log.

Wat ik wil dat je doet:
- Vraag eerst of ik de default-selectie wil (top 50 + top 10 per reason),
  of een andere scope (specifieke book_ids, top-N per land, etc.).
- Draai stap 1 en toon me data/wiki-enrichment-worklist.md. Vul overrides
  aan voor low/none-confidence rijen. Hertest tot alles 'high' of expliciet
  'skip' is.
- Draai stap 2 (kosten ~\$0.003 per boek, ~\$0.30 voor 100 boeken). Toon me
  het _summary.md zodat ik kan zien waar GPT veel/weinig nieuws vond.
- Draai stap 3 eerst zonder --apply. Scan de log op 'insert (not promote)'
  lines en validation-skips. Daarna pas --apply.
- Geen DDL, geen migraties — alleen data-rijen. Eventuele schema-issues
  meld je, niet zelf fixen.
- Verifieer ~5 boeken na apply: open localhost:3000/books/<slug> als dev
  server draait, of doe een directe DB-query op de bans tabel.

Commands:
  node --env-file=.env.local --import tsx scripts/build-wiki-enrichment-worklist.ts
  node --env-file=.env.local --import tsx scripts/stage-wiki-enrichment.ts --skip-existing
  node --env-file=.env.local --import tsx scripts/apply-wiki-enrichment.ts            # dry-run
  node --env-file=.env.local --import tsx scripts/apply-wiki-enrichment.ts --apply`}</pre>
            </div>
          </details>
        </div>

        {/* 5 — Quality remediation */}
        <div id="quality" className={`${cardCls} scroll-mt-4`}>
          <SectionHeader
            icon={ShieldCheck}
            title="Quality remediation — bestaande zwakke descriptions herschrijven"
            blurb={
              <>
                Niet voor het vullen van lege velden (dat doet enrich-all), maar voor het opwaarderen van descriptions
                die wel ingevuld zijn maar filler-heavy of ongegrond. <strong>Lazy mode:</strong> draai{' '}
                <code className="font-mono text-xs">clean-descriptions.ts</code> hieronder — wrapper die strip + rewrite
                automatisch ketent, geen file-paths te plakken. <strong>Handmatig:</strong> draai de sub-scripts
                (strip / score / rewrite) los wanneer je een tussenstap wilt overslaan of extra controle nodig hebt.
                Elke stap schrijft CSV-backups zodat de hele pipeline reversibel is.
              </>
            }
          />

          <Script
            name="clean-descriptions.ts  ← één commando voor de hele pijplijn"
            what="Wrapper. Draait strip-filler-sentences.ts, pakt automatisch het zojuist geproduceerde data/filler-strip-needs-rewrite-<ts>.csv en voert die als audit-input aan rewrite-descriptions-grounded.ts. Zelfde DB-writes, backups en logs als de twee onderliggende scripts los gedraaid — alleen geen copy-paste van filenames tussen stappen."
            tags={['safe', 'gpt', 'destructive']}
            meta={{
              coverage: <>stap 1 scant alle rijen op filler-patterns (of alleen de slug-set bij <code className="font-mono">--top=N</code> / <code className="font-mono">--slug</code>); stap 2 verwerkt alleen rijen die ná stripping te kort zijn (<code className="font-mono">description_ban</code> &lt; 60 chars of <code className="font-mono">censorship_context</code> &lt; 80 chars)</>,
              cadence: 'one-off na content-quality review (richtlijn: per kwartaal of na grote import-batch). Met --top=100 ook als af-en-toe sweep over de meest bezochte boeken zonder volledige catalogus-cost.',
              writes: <>stap 1 overschrijft <code className="font-mono">description_ban</code>/<code className="font-mono">censorship_context</code> waar de regex matcht (of zet NULL als de rest te kort is); stap 2 overschrijft die NULL-gemaakte velden met gegronde copy uit web_search</>,
              output: <>stap 1: <code className="font-mono">data/filler-strip-{'{backup,log,needs-rewrite}'}-&lt;ts&gt;.csv</code>. stap 2: <code className="font-mono">data/description-{'{backup,rewrite}'}-&lt;ts&gt;.csv</code>. Bij <code className="font-mono">--top=N</code> extra: <code className="font-mono">data/clean-descriptions-top-slugs-&lt;ts&gt;.txt</code>.</>,
              idempotent: 'ja — re-runs leveren een nieuwe set timestamped CSVs op; --apply opnieuw draaien is veilig (strip is regex-deterministisch, rewrite is restartable via --skip-log op het sub-script)',
              cost: <>stap 1 gratis. stap 2 ~$0,01–0,02 per boek via <code className="font-mono">gpt-4.1-mini</code> + web_search — ~$8 voor een volledige sweep van ~570 zwakke boeken bij concurrency 3 (~2 uur runtime). Met <code className="font-mono">--top=100</code>: max ~$2, doorgaans veel minder omdat de meeste top-100 boeken al schoon zijn.</>,
            }}
            command={`# Dry-run — toont strip-samples; rewrite-stap wordt geskipt (heeft --apply nodig)
npx tsx --env-file=.env.local scripts/clean-descriptions.ts

# Volledig: strip + rewrite in één run
npx tsx --env-file=.env.local scripts/clean-descriptions.ts --apply

# Alleen strip-filler (geen LLM-cost, geen rewrite)
npx tsx --env-file=.env.local scripts/clean-descriptions.ts --apply --strip-only

# Eén boek door de hele pijplijn
npx tsx --env-file=.env.local scripts/clean-descriptions.ts --apply --slug=defy-me

# Scope tot de 100 meest geklikte /books/-pagina's (GSC pages-snapshot)
# Run eerst scripts/gsc-query.ts om de snapshot te verversen (data lagt ~2-3 dagen).
npx tsx --env-file=.env.local scripts/clean-descriptions.ts --apply --top=100`}
            flags={[
              { flag: '--apply', desc: 'Schrijf naar DB. Zonder dit draait stap 1 als preview en wordt stap 2 overgeslagen' },
              { flag: '--strip-only', desc: 'Skip de LLM-rewrite — alleen de gratis regex-strip' },
              { flag: '--slug=X', desc: 'Eén boek door beide stappen' },
              { flag: '--top=N', desc: 'Scope hele pijplijn tot de N meest geklikte /books/-slugs uit de nieuwste data/gsc/pages-<datum>.json (clicks gesommeerd over www+non-www). Snapshot >14 dagen oud → waarschuwing, run gaat door. Niet combineerbaar met --slug.' },
            ]}
            note={
              <>
                Aanbevolen pad voor 99% van de gevallen. Voor fijn-controle (<code className="font-mono">--include-2</code>,{' '}
                <code className="font-mono">--concurrency=N</code>, alternatieve audit-CSV uit{' '}
                <code className="font-mono">score-descriptions.ts</code>, of hervat-runs met{' '}
                <code className="font-mono">--skip-log</code>) draai je de sub-scripts hieronder los.
              </>
            }
          />

          <Script
            name="1. strip-filler-sentences.ts"
            what="Free, regex-only. Verwijdert hele filler-zinnen en trailing filler-clauses ('reflecting a growing trend of…', 'There are no documented lawsuits…', 'This case illustrates…') uit bestaande description_ban / censorship_context. Preserveert named-case content. Output: drie CSVs (backup, log, needs-rewrite)."
            tags={['safe']}
            meta={{
              coverage: <>all-rows: scant alle <code className="font-mono">description_ban</code> + <code className="font-mono">censorship_context</code></>,
              cadence: 'one-off na content-quality review',
              writes: <><strong>Overschrijft</strong> <code className="font-mono">description_ban</code> en <code className="font-mono">censorship_context</code> op rijen waar filler-regex match; zet NULL als stripped result te kort is</>,
              output: <><code className="font-mono">data/filler-strip-backup-&lt;ts&gt;.csv</code> (rollback), <code className="font-mono">filler-strip-log-&lt;ts&gt;.csv</code> (new values), <code className="font-mono">filler-strip-needs-rewrite-&lt;ts&gt;.csv</code> (feed naar stap 3)</>,
              idempotent: 'ja — regex is deterministisch',
              cost: 'gratis',
            }}
            command={`# Dry-run — toont samples
npx tsx --env-file=.env.local scripts/strip-filler-sentences.ts

# Apply over hele catalogus
npx tsx --env-file=.env.local scripts/strip-filler-sentences.ts --apply

# Test op één boek
npx tsx --env-file=.env.local scripts/strip-filler-sentences.ts --slug=princess-lessons`}
            flags={[
              { flag: '--apply', desc: 'Schrijf naar DB (zonder dit: print proposed strips)' },
              { flag: '--slug=X', desc: 'Eén boek' },
            ]}
          />

          <Script
            name="2. score-descriptions.ts"
            what="Scoort description_ban + censorship_context over de hele catalogus 0–3 op concreetheid (3 = named case/court/district + year+place; 1 = generic; 0 = empty). Filler-detection regex capt automatisch op score 1 als het veld nog generic phrases bevat. Cheap (gpt-4o-mini, ~$1–2 voor volledige library)."
            tags={['gpt']}
            meta={{
              coverage: 'all-rows',
              cadence: 'one-off / periodiek na content-quality review',
              writes: '— (alleen audit CSV)',
              output: <><code className="font-mono">data/description-audit-&lt;ts&gt;.csv</code></>,
              idempotent: 'ja — geen DB-write',
              cost: 'GPT-mini (~$1–2 voor volledige library)',
            }}
            command={`# Dry-run op 10 boeken
npx tsx --env-file=.env.local scripts/score-descriptions.ts

# Scoor hele catalogus
npx tsx --env-file=.env.local scripts/score-descriptions.ts --apply`}
            flags={[
              { flag: '--apply', desc: 'Scoor alles en schrijf CSV' },
              { flag: '--limit=N', desc: 'Cap op N boeken' },
              { flag: '--concurrency=N', desc: 'Parallel API calls (default 5)' },
            ]}
            note="Snellere regex-only alternatief: flag-filler-rewrites.ts (geen LLM, vangt alleen bekende filler-patterns)."
          />

          <Script
            name="3. rewrite-descriptions-grounded.ts"
            what="Leest een audit CSV en herschrijft alleen zwakke velden (score ≤1) met de OpenAI Responses API + built-in web_search tool, output afgedwongen via strict json_schema (vóór die patch viel ~67% van de calls om met 'no JSON in output'). Prefereert Wikipedia, ALA, NCAC, PEN America, Marshall Libraries. Backupt oude waardes voor elke DB-write."
            tags={['gpt']}
            meta={{
              coverage: <>score-driven: rijen met score ≤1 in audit CSV (of ≤2 met --include-2). Accepteert zowel <code className="font-mono">description-audit-&lt;ts&gt;.csv</code> uit score-descriptions als <code className="font-mono">filler-strip-needs-rewrite-&lt;ts&gt;.csv</code> uit strip-filler — zelfde header-schema.</>,
              cadence: 'one-off (na score-run of strip-run)',
              writes: <><strong>Overschrijft</strong> <code className="font-mono">description_ban</code> en/of <code className="font-mono">censorship_context</code></>,
              output: <><code className="font-mono">data/description-backup-&lt;ts&gt;.csv</code> (oude waardes), <code className="font-mono">data/description-rewrite-&lt;ts&gt;.csv</code> (nieuwe + source URLs)</>,
              idempotent: 'ja — --skip-log voor resume',
              cost: <><code className="font-mono">gpt-4.1-mini</code> + web_search, ~$0,01–0,02 per boek</>,
            }}
            command={`# Dry-run op één slug (audit-CSV moet die slug bevatten)
npx tsx --env-file=.env.local scripts/rewrite-descriptions-grounded.ts --audit=data/description-audit-<ts>.csv --slug=the-bluest-eye

# Herschrijf alle zwakke boeken in de audit
npx tsx --env-file=.env.local scripts/rewrite-descriptions-grounded.ts --audit=data/description-audit-<ts>.csv --apply

# Resume na een crash of partial run
npx tsx --env-file=.env.local scripts/rewrite-descriptions-grounded.ts --audit=<csv> --apply --skip-log=data/description-rewrite-<prev-ts>.csv`}
            flags={[
              { flag: '--audit=<csv>', desc: 'Verplicht. Path naar audit-CSV van score-descriptions.ts of strip-filler-sentences.ts (filler-strip-needs-rewrite-<ts>.csv)' },
              { flag: '--apply', desc: 'Schrijf naar DB' },
              { flag: '--limit=N', desc: 'Cap op N boeken' },
              { flag: '--slug=<slug>', desc: 'Eén boek' },
              { flag: '--include-2', desc: 'Ook score 2 (default: 0–1)' },
              { flag: '--model=<id>', desc: 'OpenAI model (default gpt-4.1-mini)' },
              { flag: '--concurrency=N', desc: 'Parallel calls (default 3)' },
              { flag: '--skip-log=<csv>', desc: 'Resume — skip slugs uit eerdere rewrite-log' },
            ]}
            note="Inline citations worden automatisch gestript uit output. Output is gegarandeerd valide JSON dankzij strict json_schema in de Responses-API call (voorheen viel ~67% van de calls om met free-form prose)."
          />

          <Script
            name="flag-filler-rewrites.ts"
            what="Gratis regex-sweep — vindt boeken die nog bekende filler-phrases bevatten en schrijft een fake-audit CSV die stap 3 als input kan gebruiken. Gebruik in plaats van stap 2 als je alleen een specifieke filler-regressie wilt vangen zonder alles te hoeven hercoren."
            tags={['safe']}
            meta={{
              coverage: 'all-rows (regex sweep)',
              cadence: 'one-off (alternatief voor stap 2)',
              writes: '— (alleen fake-audit CSV)',
              output: 'CSV met geflagged boeken — input voor stap 3',
              idempotent: 'ja — geen DB-write',
              cost: 'gratis',
            }}
            command={`npx tsx --env-file=.env.local scripts/flag-filler-rewrites.ts`}
            note="Pairs met stap 3: feed de geproduceerde CSV via --audit=<flagged.csv>."
          />
        </div>

        {/* 6 — Targeted fixes */}
        <div id="targeted" className={`${cardCls} scroll-mt-4`}>
          <SectionHeader
            icon={Crosshair}
            title="Targeted fixes — één boek / één auteur"
            blurb={
              <>
                Voor losse correcties. De meeste per-veld scripts hierboven hebben ook een{' '}
                <code className="font-mono text-xs">--slug=X</code> flag waarmee je één row aanpakt — gebruik die voor
                NULL-vulling of overwrite van één rij. De scripts in deze sectie zijn specifiek voor permanent flagging
                / retroactieve sweeps.
              </>
            }
          />

          <Script
            name="mark-cover-override.ts"
            what="Markeert een book's cover permanent als manuele override: clear cover_url, zet cover_status='manual_override'. enrich-covers-v2 skipt het boek voortaan tenzij --force. Gebruik wanneer je handmatig een slechte cover hebt weggehaald en wilt dat hij nooit meer terugkomt."
            tags={['safe']}
            meta={{
              coverage: 'single-target',
              cadence: 'per-book on demand',
              writes: <>clear <code className="font-mono">cover_url</code>, set <code className="font-mono">cover_status=&apos;manual_override&apos;</code></>,
              idempotent: 'ja',
              cost: 'gratis',
            }}
            command={`npx tsx --env-file=.env.local scripts/mark-cover-override.ts <id-or-slug> --apply`}
            flags={[
              { flag: '<id-or-slug>', desc: 'Numeric book id of slug. Verplicht.' },
              { flag: '--apply', desc: 'Schrijf change' },
            ]}
          />

          <Script
            name="audit-covers-for-placeholders.ts"
            what="Retroactieve sweep over bestaande Google Books cover URLs. Downloadt elke image, perceptual-hash-checkt tegen de placeholder; op match clear cover_url + zet cover_status='rejected_placeholder'. Skipt manual_override. Non-Google URLs worden overgeslagen."
            tags={['free', 'destructive']}
            meta={{
              coverage: 'flag-driven: Google Books / googleusercontent.com URLs, excl. manual_override',
              cadence: 'one-off na placeholder-detection update',
              writes: <>clear <code className="font-mono">cover_url</code>, set <code className="font-mono">cover_status=&apos;rejected_placeholder&apos;</code></>,
              idempotent: 'ja',
              cost: 'gratis',
            }}
            command={`# Dry-run eerst om te zien hoeveel
npx tsx --env-file=.env.local scripts/audit-covers-for-placeholders.ts

# Apply
npx tsx --env-file=.env.local scripts/audit-covers-for-placeholders.ts --apply --concurrency=8`}
            flags={[
              { flag: '--apply', desc: 'Schrijf changes' },
              { flag: '--limit=N', desc: 'Cap op N boeken' },
              { flag: '--concurrency=N', desc: 'Parallel HTTP fetches (default 4)' },
            ]}
          />

          <Script
            name="audit-non-person-authors.ts"
            what="Scant alle authors op display_names die op een organisatie / uitgever / redactie / boektitel lijken in plaats van een persoon. Vijf categorieën: PUBLISHER (Editorial X, Press, Penerbit), ORG_BODY (overheid/partij/comité/instituut), STAFF_TAIL (Editorial Staff, Sidang Pengarang), ANON_GROUP (X et al, and Others), TITLE_LIKE (Atlas/Diccionario/Enciclopedia prefix). Schrijft per-categorie markdown-rapport met book-counts + voorbeelden. Read-only. Heeft een ingebouwde WHITELIST_NAMES set voor false positives (bv. 'Melissa Kantor' — 'Kantor' = office in ID/MS, maar hier achternaam) — voeg toe bij nieuwe false positives."
            tags={['safe']}
            meta={{
              coverage: 'all-rows: alle authors',
              cadence: 'na elke bulk-import + periodieke sweep',
              writes: 'geen — read-only',
              output: <><code className="font-mono">data/non-person-authors-review.md</code> (per-categorie, gesorteerd op book-count)</>,
              idempotent: 'ja',
              cost: 'gratis',
            }}
            command={`# Re-run de scan
npx tsx --env-file=.env.local scripts/audit-non-person-authors.ts`}
            note={<>Pair met <code className="font-mono">cleanup-non-person-authors.ts</code> hieronder voor de daadwerkelijke cleanup. Eerste run (2026-05-28) vond 77 verdachte rijen; cleanup verwijderde 29, hernoemde 11. Patroon van pre-existente <code className="font-mono">enrich-author-bios.ts</code>-mismatches met verkeerde person-bios is de smoking gun.</>}
          />

          <Script
            name="cleanup-non-person-authors.ts"
            what="One-shot cleanup voor non-persoon authors uit het audit-rapport. Drie acties: (1) DELETE — uitgevers, reeks-titels, redactie-staffs, ORG_BODY-titles; (2) RENAME — echte persoon met rank-prefix ('Army Reserve Lt. Col. Anthony Shaffer' → 'Anthony Shaffer'); (3) ANON_GROUP — 'X. et al' → 'X' + verkeerde bio wissen, of merge met bestaande canonical bij slug-collision. IDs zijn hardcoded uit de audit-run; pas DELETE_IDS / RENAME_PLANS / ANON_PLANS aan voor nieuwe runs. Verifieert eerst alle expected display_names voordat het muteert."
            tags={['destructive']}
            meta={{
              coverage: 'flag-driven: hardcoded ID-lijst uit audit-run',
              cadence: 'one-off na audit-review',
              writes: <>verwijder <code className="font-mono">book_authors</code>-links + author-rij, of rename <code className="font-mono">display_name</code> + <code className="font-mono">slug</code> + wis bio-velden</>,
              idempotent: 'nee — IDs verdwijnen na eerste apply (verificatie faalt netjes bij re-run)',
              cost: 'gratis',
            }}
            command={`# Dry-run eerst — toont alle verificatie + samenvatting per actie
npx tsx --env-file=.env.local scripts/cleanup-non-person-authors.ts

# Apply
npx tsx --env-file=.env.local scripts/cleanup-non-person-authors.ts --apply`}
            note={<>Werkwijze bij nieuwe audit-run: kopieer het script, vul de drie lijsten met IDs uit de nieuwste <code className="font-mono">data/non-person-authors-review.md</code>, en draai dry-run → apply. De verificatie-stap aborteert als een display_name niet matcht — beschermt tegen accidentele wijzigingen na een ander script al een rij hernoemde.</>}
          />

          <p className="text-xs text-gray-500 mt-2">
            Voor description / ban-description fixes per boek: gebruik{' '}
            <code className="font-mono">enrich-descriptions-v2.ts --apply --allow-llm --slug=X</code>,{' '}
            <code className="font-mono">enrich-ban-descriptions-gpt.ts --slug=X</code>, of{' '}
            <code className="font-mono">enrich-genres-gpt.ts --slug=X</code> uit{' '}
            <a href="#per-field" className="text-brand hover:underline">Per veld verrijken</a>.
          </p>
        </div>

        {/* 7 — Derived / classification */}
        <div id="derived" className={`${cardCls} scroll-mt-4`}>
          <SectionHeader
            icon={ClipboardList}
            title="Derived data &amp; editorial classification"
            blurb={
              <>
                Scripts die afgeleide kolommen recomputen of editorial decisions voorbereiden. Draai
                {' '}<code className="font-mono text-xs">score-data-quality</code> na elke bulk-enrichment zodat de
                labels actueel zijn.
              </>
            }
          />

          <Script
            name="score-data-quality.ts"
            what="Paginated reads van books + authors met joins (ban_source_links, book_authors). Classificeert in confident / default / flagged op basis van canonical-id presence, ban-evidence, editorial completeness, en author legitimacy. Schrijft data/data-quality-report.md met per-bucket counts, top-25 confident sample, flag-frequency tables, en canary check tegen well-known titles (1984, Animal Farm, etc.)."
            tags={['safe']}
            meta={{
              coverage: 'all-rows: alle books + authors',
              cadence: 'na elke bulk-enrichment, mark-cover-override sweep of import',
              writes: <>met <code className="font-mono">--apply</code>: <code className="font-mono">books.data_quality_status</code>, <code className="font-mono">authors.data_quality_status</code>, <code className="font-mono">data_quality_evaluated_at</code></>,
              output: <><code className="font-mono">data/data-quality-report.md</code> (altijd)</>,
              idempotent: 'ja — re-run met unchanged data geeft zelfde verdicts',
              cost: 'gratis',
            }}
            command={`# Dry-run — alleen report, geen DB-writes
npx tsx --env-file=.env.local scripts/score-data-quality.ts

# Apply — persisteert ook verdicts
npx tsx --env-file=.env.local scripts/score-data-quality.ts --apply`}
            flags={[
              { flag: '--apply', desc: 'Persist data_quality_status naar DB (default: dry-run, report-only); --write werkt nog als alias' },
            ]}
            note="Heuristics leven in het script. Tune door scoring-functions te editen, run dry-run, kijk naar de canary-table, dan --apply."
          />

          <Script
            name="suggest-editorial-classification-gpt.ts"
            what="GPT-powered classifier voor unclassified boeken. Stuurt metadata + ban context naar gpt-4o-mini met het editorial framework als system prompt; krijgt warning_level + inclusion_rationale + confidence terug als structured JSON. Auto-applies low-risk, flagt high-risk voor manuele review."
            tags={['gpt']}
            meta={{
              coverage: <>only-empty: <code className="font-mono">warning_level=&apos;none&apos;</code> AND <code className="font-mono">inclusion_rationale IS NULL</code></>,
              cadence: 'na elke import + one-off backfill',
              writes: <><code className="font-mono">warning_level</code> (altijd &apos;none&apos;, upgrades zijn altijd manueel), <code className="font-mono">inclusion_rationale</code></>,
              output: <><code className="font-mono">data/editorial-review-&lt;ts&gt;.json</code> (high-risk flagged voor review)</>,
              idempotent: 'ja — manuele admin-edits overleven re-runs',
              cost: 'GPT-mini (~€2–5 voor volledige ~4.4k catalogus)',
            }}
            command={`# Test op één boek
npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --slug=lolita

# Kleine batch eerst
npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --apply --limit=50

# Volledige catalogus
npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --apply --limit=5000`}
            flags={[
              { flag: '--apply', desc: 'Auto-apply low-risk; schrijf review file voor high-risk' },
              { flag: '--limit=N', desc: 'Cap (default 100 apply, 3 dry-run)' },
              { flag: '--slug=X', desc: 'Test op één boek' },
              { flag: '--model=X', desc: 'Override model (default gpt-4o-mini)' },
            ]}
            note="Drie outcomes: (1) AUTO-APPLY bij warning_level='none' + confidence ≥ medium → rationale geschreven. (2) WRITE + FLAG bij 'context'/'extended' + confidence ≥ medium → rationale geschreven op none tier én gelogd in editorial-review JSON. (3) REVIEW-ONLY bij exclude=true of lage confidence → geen DB-write. Tier-upgrades zijn altijd manueel via admin. De high-risk wachtrij voor manuele tier-beslissing staat in de editorial-review JSON (zie output), niet in een apart script."
          />

          <Script
            name="generate-discussion-questions.ts"
            what="Genereert 5–10 book-specifieke discussion questions voor elke Reading Club rij die er nog geen heeft. Auto-detect provider — prefereert Claude Opus 4.7 met adaptive thinking als ANTHROPIC_API_KEY gezet is, valt anders terug op OpenAI gpt-4o."
            tags={['claude', 'gpt']}
            meta={{
              coverage: <>only-empty: Reading Club rijen met leeg <code className="font-mono">discussion_questions</code>. Met --force: all-rows.</>,
              cadence: 'na elke import + one-off',
              writes: <><code className="font-mono">reading_club_rows.discussion_questions</code></>,
              idempotent: 'default ja; --force overschrijft',
              cost: '~$1–2 voor 50 rijen met Claude Opus 4.7, ~$0.10 met gpt-4o',
            }}
            command={`# Genereer voor alle eligible rijen
npx tsx --env-file=.env.local scripts/generate-discussion-questions.ts --apply

# Kleine batch eerst
npx tsx --env-file=.env.local scripts/generate-discussion-questions.ts --apply --limit=10

# Materializeer ook auto-pull theme books
npx tsx --env-file=.env.local scripts/generate-discussion-questions.ts --apply --include-auto-themes`}
            flags={[
              { flag: '--apply', desc: 'Call de LLM en schrijf result' },
              { flag: '--limit=N', desc: 'Cap op N rijen' },
              { flag: '--include-auto-themes', desc: 'Materialize auto-pull books voor lege themes' },
              { flag: '--provider=X', desc: 'Force claude of openai (default: auto-detect)' },
              { flag: '--force', desc: 'Regenereer ook bestaande arrays' },
            ]}
          />
        </div>

        {/* 8 — Audits */}
        <div id="audits" className={`${cardCls} scroll-mt-4`}>
          <SectionHeader
            icon={ClipboardList}
            title="Audits — read-only"
            blurb="Altijd veilig om te draaien. Geen DB-writes."
          />

          <dl className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-6 gap-y-2.5">
            <dt className="text-sm font-mono text-gray-700">audit-integrity.ts</dt>
            <dd className="text-sm text-gray-600 self-center">staande integriteits-toets: invarianten (exit 1) + drift-metrics incl. cover/description/landendekking vs baseline — vervangt audit-db.ts en check-coverage.ts (verwijderd: braken op de Supabase 1000-row cap)</dd>
            <dt className="text-sm font-mono text-gray-700">check-dupes.ts</dt>
            <dd className="text-sm text-gray-600 self-center">duplicate books (same title + author)</dd>
            <dt className="text-sm font-mono text-gray-700">check-no-desc.ts</dt>
            <dd className="text-sm text-gray-600 self-center">boeken die nog een description missen</dd>
          </dl>
          <Code>{`npx tsx --env-file=.env.local scripts/audit-integrity.ts
npx tsx --env-file=.env.local scripts/check-dupes.ts
npx tsx --env-file=.env.local scripts/check-no-desc.ts`}</Code>
        </div>

        {/* 9 — Maintenance */}
        <div id="maintenance" className={`${cardCls} scroll-mt-4`}>
          <SectionHeader
            icon={RefreshCw}
            title="Maintenance"
          />
          <Script
            name="refresh-mv.ts"
            what="Refresht alle materialized views (mv_ban_counts, mv_country_reason_counts, mv_top_books_rising, mv_top_authors_rising) via de refresh_all_materialized_views RPC — gebruikt door countries, stats, en trending pages. Draai na elke bulk-import of enrichment."
            tags={['safe']}
            meta={{
              coverage: 'alle MVs',
              cadence: 'na elke bulk-import of enrichment',
              writes: 'refresht alle materialized views',
              idempotent: 'ja',
              cost: 'gratis',
            }}
            command={`npx tsx --env-file=.env.local scripts/refresh-mv.ts`}
            note="Ook beschikbaar als button op de admin dashboard — die roept dezelfde RPC aan."
          />
        </div>

        {/* 10 — LLM surfaces */}
        <div id="llm" className={`${cardCls} scroll-mt-4`}>
          <SectionHeader
            icon={FileText}
            title="LLM-facing surfaces (llms.txt + .md exports)"
          />
          <p className="text-sm text-gray-600 leading-relaxed">
            <a href="/llms.txt" className="font-mono text-xs underline">/llms.txt</a> is een curated plain-text entry
            point voor LLM crawlers (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended). Het lijst
            highest-value canonical URLs — methodology, data quality, essays, hub pages — zodat een model één plek
            heeft om te starten. Total book count + country count worden live gerenderd vanuit de homepage-query, en
            de <code className="font-mono text-xs">/banned-books-week</code> link is gated op{' '}
            <code className="font-mono text-xs">bbw_config.enabled</code>.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Elke long-form essay plus <code className="font-mono text-xs">/methodology</code>,{' '}
            <code className="font-mono text-xs">/data-quality</code>, en <code className="font-mono text-xs">/about</code>{' '}
            heeft een parallel <code className="font-mono text-xs">.md</code> URL (bv.{' '}
            <a href="/methodology.md" className="font-mono text-xs underline">/methodology.md</a>) die dezelfde prose
            serveert als clean markdown met YAML frontmatter — geen JSX, geen nav-chrome. De HTML-page adverteert hem
            via <code className="font-mono text-xs">&lt;link rel=&quot;alternate&quot; type=&quot;text/markdown&quot;&gt;</code>.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            <strong className="text-gray-800">Onderhoud:</strong> edit de essay of reference page
            zoals normaal, en mirror de change in{' '}
            <code className="font-mono text-xs">src/lib/markdown-pages/&lt;slug&gt;.ts</code> zodat de{' '}
            <code className="font-mono text-xs">.md</code>-twin in sync blijft. Bij een nieuwe essay: ook toevoegen aan{' '}
            <code className="font-mono text-xs">src/app/llms.txt/route.ts</code> (description map) en aan{' '}
            <code className="font-mono text-xs">src/lib/sitemap-static-entries.ts</code>.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            <strong className="text-gray-800">Regel:</strong>{' '}
            <code className="font-mono text-xs">.md</code> exports zijn alleen voor long-form prose. Géén per-book of
            per-author <code className="font-mono text-xs">.md</code> pages — book- en author-detail pages publiceren al
            structured citation via JSON-LD (Book, Person, FAQPage, ItemList, additionalProperty.dataQualityStatus).
          </p>
        </div>

        {/* 11 — Adding a new source (collapsed) */}
        <details id="new-source" className={`${cardCls} scroll-mt-4 group`}>
          <summary className="cursor-pointer select-none flex items-center gap-2 list-none">
            <Plus className="w-5 h-5 text-gray-400 shrink-0" />
            <h2 className="font-semibold text-gray-900">Adding a new source</h2>
            <span className="ml-auto text-xs text-gray-500 group-open:hidden">
              klik om uit te klappen
            </span>
            <span className="ml-auto text-xs text-gray-500 hidden group-open:inline">
              klik om in te klappen
            </span>
          </summary>

          <div className="flex flex-col gap-4 mt-4">
            <p className="text-xs text-gray-500">
              Boeken komen in de catalogus via curated direct-import scripts. Pak of schrijf een{' '}
              <code className="font-mono text-[11px]">scripts/import-*.ts</code> (of{' '}
              <code className="font-mono text-[11px]">add-*.ts</code>) voor de bron, check de dry-run, dan{' '}
              <code className="font-mono text-[11px]">--apply</code>. Dat jij de data nakijkt vóór de commit, ís de
              kwaliteitsgate — er is geen aparte review-stap meer.
            </p>

            <div className="rounded-md border border-gray-200 bg-gray-50/60 px-3 py-3 text-xs text-gray-600 leading-relaxed">
              <p className="font-semibold mb-1 text-gray-700">Legacy: de twee-LLM review-queue (idle)</p>
              <p className="mb-2">
                De oude <code className="font-mono text-[11px]">run-import-job</code> → 2× LLM → gate →{' '}
                <a href="/admin/import-review" className="underline hover:no-underline">/admin/import-review</a>{' '}
                pijplijn diende om <em>onbewaakte</em> bulk-ingest (vooral Wikipedia-lijsten) te gaten vóór publicatie.
                Sinds alle nieuwe bronnen handmatig-gecureerd binnenkomen, gebeurt die review al vóór de commit en staat
                de queue stil. Laat 'm collapsed; staat gepland om gedecommissioned te worden.
              </p>
              <p className="opacity-80">
                Queue-only helper (alleen relevant zolang de queue bestaat):{' '}
                <code className="font-mono text-[11px]">remap-unmapped-queue.ts</code> re-runt reason-mapping over pending
                rijen na een vocab-change.
              </p>
            </div>

            <ol className="flex flex-col gap-4 text-sm text-gray-700 list-decimal list-outside ml-5">
              <li>
                <p className="mb-2">
                  <strong>Source &amp; import.</strong> Kopieer een werkend template en adapteer — elke source heeft
                  zijn eigen quirks (welke landen, welke reasons mappen netjes, source URLs). Draai altijd eerst de
                  dry-run, dan pas de write-flag.
                </p>
                <Code>{`# Templates die matchen op source shape
scripts/import-singapore-wiki.ts            # Wikipedia-lijst, curated
scripts/import-africa-criminalization-bans.ts  # multi-country criminalisation
scripts/import-pen.ts                        # large US challenge list
scripts/add-ala-2025.ts                      # ALA top-10 list
scripts/add-bulk-books.ts                    # generic catch-all

# Dry-run eerst, dan schrijven met de write-flag
npx tsx --env-file=.env.local scripts/import-<your-source>.ts
npx tsx --env-file=.env.local scripts/import-<your-source>.ts --apply`}</Code>
                <p className="text-xs text-gray-500 mt-2">
                  Scripts schrijven via <code className="font-mono">commitParsedRow()</code> /{' '}
                  <code className="font-mono">commitNewBanForBook()</code> rechtstreeks naar books, authors, bans,
                  ban-reason links en source rows — in één pass, idempotent waar het kan.{' '}
                  <code className="font-mono">--apply</code> is de canonieke schrijf-flag (helper:{' '}
                  <code className="font-mono">scripts/lib/cli.ts</code>); bij twijfel: check de header van het script.
                </p>
              </li>

              <li>
                <p className="mb-2">
                  <strong>Enrich.</strong> Draai de master sweep om open velden te vullen:
                </p>
                <Code>{`# Goedkoopste eerst
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --free-only --no-gutenberg --no-archive

# Dan GPT pass voor wat nog mist
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply --no-gutenberg --no-archive

# Of alles in één keer (trager)
npx tsx --env-file=.env.local scripts/enrich-all.ts --apply`}</Code>
              </li>

              <li>
                <p className="mb-2">
                  <strong>Refresh materialized views</strong> zodat countries / stats / trending pages de nieuwe data
                  reflecteren.
                </p>
                <Code>{`npx tsx --env-file=.env.local scripts/refresh-mv.ts`}</Code>
              </li>

              <li>
                <p className="mb-2">
                  <strong>(Optioneel) Editorial classification.</strong> Suggereert warning_level + inclusion_rationale
                  voor nieuwe boeken die er nog geen hebben.
                </p>
                <Code>{`# Kleine batch eerst
npx tsx --env-file=.env.local scripts/suggest-editorial-classification-gpt.ts --apply --limit=50`}</Code>
              </li>
            </ol>
          </div>
        </details>

        {/* 12 — Prerequisites */}
        <div id="prereqs" className={`${cardCls} scroll-mt-4`}>
          <SectionHeader icon={Terminal} title="Prerequisites &amp; tag-legend" />
          <p className="text-sm text-gray-600">
            Zorg dat <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">.env.local</code>{' '}
            in de project-root staat met{' '}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">SUPABASE_SERVICE_ROLE_KEY</code>,
            (voor GPT scripts){' '}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">OPENAI_API_KEY</code>, en
            (voor Claude scripts){' '}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">ANTHROPIC_API_KEY</code>.
          </p>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              <span className="text-gray-600">Green = free (Open Library, Google Books, Wikipedia)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Hammer className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-gray-600">Amber = OpenAI (GPT-4o / 4o-mini)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-gray-600">Orange = Anthropic (Claude Opus)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-gray-600">Red = destructive / overschrijft bestaande data</span>
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}
