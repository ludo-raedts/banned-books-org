/**
 * Wrapper voor de quality-remediation pijplijn: één commando, twee stappen.
 *
 *   1. strip-filler-sentences.ts — free, regex. Schrapt filler-zinnen en
 *      filler-clauses uit description_ban + censorship_context, NULLt
 *      velden die ná stripping te kort zijn, en schrijft een
 *      filler-strip-needs-rewrite-<ts>.csv met de slugs die hertekend
 *      moeten worden.
 *
 *   2. rewrite-descriptions-grounded.ts — gpt-4.1-mini + web_search.
 *      Pikt vanzelf de net-geproduceerde needs-rewrite CSV op en herschrijft
 *      de zwakke velden met gegronde, named-case copy.
 *
 * Backups + logs landen in data/ (filler-strip-* en description-*).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/clean-descriptions.ts                 # dry-run preview
 *   npx tsx --env-file=.env.local scripts/clean-descriptions.ts --apply
 *   npx tsx --env-file=.env.local scripts/clean-descriptions.ts --apply --strip-only
 *   npx tsx --env-file=.env.local scripts/clean-descriptions.ts --apply --slug=defy-me
 *   npx tsx --env-file=.env.local scripts/clean-descriptions.ts --apply --top=100
 *     ↳ Scope hele pijplijn tot de 100 meest geklikte /books/ pagina's uit
 *       de nieuwste data/gsc/pages-<datum>.json. Run scripts/gsc-query.ts om
 *       de snapshot te verversen (data lagt ~2-3 dagen). Bij snapshot >14
 *       dagen oud: waarschuwing, ga toch door.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const APPLY      = process.argv.includes('--apply')
const STRIP_ONLY = process.argv.includes('--strip-only')
const slugArg    = process.argv.find(a => a.startsWith('--slug='))
const topArg     = process.argv.find(a => a.startsWith('--top='))
const SLUG       = slugArg?.split('=')[1] ?? null
const TOP        = topArg ? parseInt(topArg.split('=')[1], 10) : null

if (TOP !== null && (!Number.isFinite(TOP) || TOP <= 0)) {
  console.error(`--top must be a positive integer (got "${topArg}")`)
  process.exit(1)
}
if (TOP !== null && SLUG) {
  console.error('--top and --slug are mutually exclusive')
  process.exit(1)
}

const DATA = path.resolve(process.cwd(), 'data')
const GSC_DIR = path.join(DATA, 'gsc')
const STALE_DAYS = 14

function run(label: string, scriptPath: string, args: string[]) {
  console.log(`\n══ ${label} ══`)
  const cmd = ['tsx', '--env-file=.env.local', scriptPath, ...args]
  console.log(`   npx ${cmd.join(' ')}\n`)
  const result = spawnSync('npx', cmd, { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`\n✗ ${label} exited with code ${result.status}`)
    process.exit(result.status ?? 1)
  }
}

function newestNeedsRewriteCsv(): string | null {
  if (!fs.existsSync(DATA)) return null
  const files = fs.readdirSync(DATA)
    .filter(f => f.startsWith('filler-strip-needs-rewrite-') && f.endsWith('.csv'))
    .map(f => ({ f, mtime: fs.statSync(path.join(DATA, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  return files[0] ? path.join(DATA, files[0].f) : null
}

function csvHasDataRows(p: string): boolean {
  const content = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)
  return content.length > 1
}

type GscPagesSnapshot = {
  site?: string
  startDate?: string
  endDate?: string
  rows?: { keys?: string[]; clicks?: number; impressions?: number }[]
}

function newestGscPagesSnapshot(): { file: string; endDate: string | null } | null {
  if (!fs.existsSync(GSC_DIR)) return null
  const files = fs.readdirSync(GSC_DIR)
    .filter(f => f.startsWith('pages-') && f.endsWith('.json'))
    .map(f => ({ f, mtime: fs.statSync(path.join(GSC_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  if (!files[0]) return null
  const file = path.join(GSC_DIR, files[0].f)
  const m = files[0].f.match(/pages-(\d{4}-\d{2}-\d{2})\.json$/)
  return { file, endDate: m?.[1] ?? null }
}

function extractBookSlug(url: string): string | null {
  // Accept both www and non-www, trailing slash, query strings.
  // Example: https://www.banned-books.org/books/the-bluest-eye?utm=x → the-bluest-eye
  const m = url.match(/banned-books\.org\/books\/([^\/?#]+)/i)
  if (!m) return null
  return decodeURIComponent(m[1]).toLowerCase()
}

function resolveTopBookSlugs(n: number): { slugs: string[]; snapshot: string; endDate: string | null } {
  const snap = newestGscPagesSnapshot()
  if (!snap) {
    console.error(`No GSC pages snapshot found in ${path.relative(process.cwd(), GSC_DIR)}/.`)
    console.error('Run: npx tsx --env-file=.env.local scripts/gsc-query.ts')
    process.exit(1)
  }
  // Stale check (>STALE_DAYS old) — warn, don't block.
  if (snap.endDate) {
    const endMs = Date.parse(snap.endDate + 'T00:00:00Z')
    if (Number.isFinite(endMs)) {
      const ageDays = Math.floor((Date.now() - endMs) / 86_400_000)
      if (ageDays > STALE_DAYS) {
        console.warn(`\n⚠  GSC snapshot is ${ageDays} days old (endDate=${snap.endDate}).`)
        console.warn('   Consider refreshing: npx tsx --env-file=.env.local scripts/gsc-query.ts')
      }
    }
  }
  const raw = fs.readFileSync(snap.file, 'utf8')
  const parsed = JSON.parse(raw) as GscPagesSnapshot
  const rows = parsed.rows ?? []

  // Sum clicks per slug across www / non-www variants.
  const clicksBySlug = new Map<string, number>()
  for (const row of rows) {
    const url = row.keys?.[0]
    if (!url) continue
    const slug = extractBookSlug(url)
    if (!slug) continue
    clicksBySlug.set(slug, (clicksBySlug.get(slug) ?? 0) + (row.clicks ?? 0))
  }

  const ranked = [...clicksBySlug.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)

  if (!ranked.length) {
    console.error(`No /books/<slug>/ URLs found in ${path.relative(process.cwd(), snap.file)}.`)
    process.exit(1)
  }
  if (ranked.length < n) {
    console.warn(`⚠  Only ${ranked.length} unique book slugs in snapshot (asked for top ${n}).`)
  }

  // Print top 5 for visibility.
  console.log(`  GSC snapshot: ${path.relative(process.cwd(), snap.file)}  (endDate=${snap.endDate ?? '?'})`)
  console.log(`  Top ${ranked.length} books by clicks (showing first 5):`)
  for (const [slug, clicks] of ranked.slice(0, 5)) {
    console.log(`    ${String(clicks).padStart(5)}c  ${slug}`)
  }

  return { slugs: ranked.map(([s]) => s), snapshot: snap.file, endDate: snap.endDate }
}

function writeSlugsFile(slugs: string[], stamp: string): string {
  const p = path.join(DATA, `clean-descriptions-top-slugs-${stamp}.txt`)
  fs.writeFileSync(p, slugs.join('\n') + '\n')
  return p
}

function main() {
  console.log(`── clean-descriptions (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  if (STRIP_ONLY) console.log('  Mode: strip-only — LLM-stap wordt overgeslagen')
  if (SLUG)       console.log(`  Filter: --slug=${SLUG}`)
  if (TOP)        console.log(`  Filter: --top=${TOP} (meest geklikte /books/ uit GSC)`)

  // Track the latest needs-rewrite CSV that existed BEFORE strip ran, so we
  // can tell whether strip produced a new one.
  const preExistingCsv = newestNeedsRewriteCsv()

  // Resolve --top → temp slug-file shared by strip (and implicitly by rewrite
  // via the needs-rewrite CSV).
  let slugsFile: string | null = null
  if (TOP) {
    const { slugs } = resolveTopBookSlugs(TOP)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    slugsFile = writeSlugsFile(slugs, stamp)
    console.log(`  Slug-lijst weggeschreven: ${path.relative(process.cwd(), slugsFile)}\n`)
  }

  // ── Stap 1 — strip-filler-sentences
  const stripArgs: string[] = []
  if (APPLY)     stripArgs.push('--apply')
  if (SLUG)      stripArgs.push(`--slug=${SLUG}`)
  if (slugsFile) stripArgs.push(`--slugs-file=${slugsFile}`)
  run('Stap 1/2  strip-filler-sentences.ts (free, regex)', 'scripts/strip-filler-sentences.ts', stripArgs)

  if (!APPLY) {
    console.log('\n──')
    console.log('DRY-RUN — strip-filler heeft samples gepreviewd. De rewrite-stap')
    console.log('vereist het CSV-bestand dat strip alleen in --apply mode produceert,')
    console.log('dus voer dit commando met --apply uit om beide stappen te draaien.')
    return
  }

  if (STRIP_ONLY) {
    console.log('\n--strip-only: rewrite-stap overgeslagen. Klaar.')
    return
  }

  // ── Stap 2 — rewrite-descriptions-grounded op de needs-rewrite CSV
  const csv = newestNeedsRewriteCsv()
  if (!csv || csv === preExistingCsv) {
    console.log('\nGeen nieuwe needs-rewrite CSV gevonden — niets te herschrijven. Klaar.')
    return
  }
  if (!csvHasDataRows(csv)) {
    console.log(`\n${csv} bevat alleen een header — niets te herschrijven. Klaar.`)
    return
  }
  console.log(`\nNeeds-rewrite CSV opgepakt: ${path.relative(process.cwd(), csv)}`)

  const rewriteArgs = [`--audit=${csv}`, '--apply']
  if (SLUG) rewriteArgs.push(`--slug=${SLUG}`)
  run('Stap 2/2  rewrite-descriptions-grounded.ts (gpt-4.1-mini + web_search)',
    'scripts/rewrite-descriptions-grounded.ts', rewriteArgs)

  console.log('\n══ klaar ══')
  console.log('Backups + logs: data/filler-strip-* en data/description-*')
}

main()
