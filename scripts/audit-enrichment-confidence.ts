/**
 * audit-enrichment-confidence.ts — post-batch confidence scorer + auto-rollback
 * for a parallel-enrichment run. Read-only by default; --apply reverts.
 *
 * WHY THIS EXISTS, and what it can/can't catch (be honest):
 *   The three enrichers PREVENT low-confidence writes at match time:
 *     • ol/gb-harvest gate every isbn/cover write on titleContainment ≥
 *       TITLE_MATCH_THRESHOLD + queryCoverage + authorAgrees BEFORE writing, and
 *       stamp isbn_checked_at / cover_checked_at + *_status on each write.
 *     • native-titles hard-gates on P31=written-work + P50 author-match (incl.
 *       pen-name aliases) — BUT only when the book HAS an author. Authorless
 *       books are matched on title alone, which is exactly the namesake /
 *       leading-article risk this auditor exists to catch.
 *   So the rollback layer's real work is on NATIVE TITLES (semantic re-scoring
 *   from the run's review JSON), plus a cheap STRUCTURAL re-verification of the
 *   run's isbn/cover writes (host-allowlist, dup-collision) that catches
 *   threshold drift / regressions without re-querying any external API.
 *
 * Native-title confidence (0..1), from the review-JSON proposal fields:
 *   start 1.0
 *   − 0.5  no author was available to gate against (title-only Wikidata match)
 *   − 0.2  title begins with a leading article (the/a/an) — the article-stripped
 *          search variant is namesake-prone (see enrich-native-titles searchVariants)
 *   Reverts proposals scoring < --threshold (default 0.5). Only reverts a row
 *   whose CURRENT title_native still equals the proposed value (never clobbers a
 *   later manual edit). Backs up every revert to a CSV first.
 *
 * YEAR cross-source verification (first_published_year):
 *   ol-harvest is the only writer of first_published_year and it is
 *   single-source (OL work.first_publish_date) with no external corroboration —
 *   the thinnest-verified field of the run. This pass cross-checks each written
 *   year against Wikidata (P577 on an author-gated entity) and Google Books
 *   (earliest matching edition year, title+author guarded).
 *   Scoping: the year write carries no *_checked_at stamp, so this-run writes
 *   are recovered from data/ol-harvest-proposals.jsonl (every year proposal is
 *   logged there) + the still-matching guard (current DB value must equal the
 *   proposal — an already-corrected row is never touched). A verdict cache
 *   (data/year-verification-verdicts.jsonl, keyed id:year) makes the pass
 *   incremental: each applied year costs external API calls exactly once.
 *   Confidence (0..1): start 0.5 (no external evidence — kept, not reverted)
 *     +0.35 Wikidata P577 within ±1   − 0.35 Wikidata P577 differs by >1
 *     +0.15 GB earliest within ±1     − 0.25 GB edition PRE-dates year by >1
 *     (a GB edition LATER than the year is a reprint — neutral, no signal)
 *   Score < --threshold → revert to NULL (CSV backup; guarded on current value)
 *   so the row re-enters the normal enrichment funnel. GbQuotaError aborts the
 *   remainder of the pass without caching false verdicts (GbQuotaError doc).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-enrichment-confidence.ts \
 *     --since=2026-06-16T10:00:00Z --native-review=data/native-title-enrichment-2026-06-16.json
 *   add --apply to perform reverts, --threshold=0.5 to tune,
 *   --year-limit=N (default 200) to cap external year lookups per run,
 *   --no-year-verify to skip the year pass entirely.
 */
import fs from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { isApply, flagValue, intFlag, hasFlag } from './lib/cli'
import { gbVolumesByTitleAuthor, GbQuotaError, hasGbKey } from '../src/lib/enrich/google-books'
import { titlesMatch, authorsAgree } from '../src/lib/enrich/title-match'

const APPLY = isApply()
const SINCE = flagValue('since') ?? null
const THRESHOLD = parseFloat(flagValue('threshold') ?? '0.5')
const YEAR_LIMIT = intFlag('year-limit', 200)
const SKIP_YEAR = hasFlag('no-year-verify')
const YEAR_PROPOSALS_FILE = flagValue('year-proposals') ?? 'data/ol-harvest-proposals.jsonl'
const YEAR_VERDICTS_FILE = 'data/year-verification-verdicts.jsonl'
const sb = adminClient()

function latestNativeReview(): string | null {
  const explicit = flagValue('native-review')
  if (explicit) return explicit
  if (!fs.existsSync('data')) return null
  const files = fs
    .readdirSync('data')
    .filter((f) => /^native-title-enrichment-.*\.json$/.test(f))
    .sort()
  return files.length ? `data/${files[files.length - 1]}` : null
}

interface NativeProposal {
  id: number
  title: string
  author: string | null
  nativeTitle: string
  script: string
}

function scoreNative(p: NativeProposal): { score: number; reasons: string[] } {
  let score = 1.0
  const reasons: string[] = []
  if (!p.author) {
    score -= 0.5
    reasons.push('no-author-gate (title-only match)')
  }
  if (/^(the|a|an)\s+/i.test(p.title.trim())) {
    score -= 0.2
    reasons.push('leading-article (namesake-prone)')
  }
  return { score: Math.max(0, score), reasons }
}

// Paginate a filtered books select (1000-row-cap safe — needs .order()).
async function paginate(
  cols: string,
  build: (q: any) => any,
): Promise<any[]> {
  const PAGE = 1000
  const out: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(
      sb.from('books').select(cols).order('id', { ascending: true }),
    ).range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

function backupCsv(name: string, rows: string[][]) {
  const path = `data/enrichment-rollback-${name}-backup.csv`
  fs.writeFileSync(path, rows.map((r) => r.map((c) => JSON.stringify(c)).join(',')).join('\n') + '\n')
  console.log(`  backup → ${path}`)
}

async function auditNativeTitles() {
  const reviewPath = latestNativeReview()
  console.log(`\n── Native titles ──`)
  if (!reviewPath || !fs.existsSync(reviewPath)) {
    console.log('  no native-title review JSON found — skipping (source produced no run).')
    return { reverted: 0 }
  }
  const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8')) as {
    applied?: boolean
    proposals?: NativeProposal[]
  }
  const proposals = review.proposals ?? []
  console.log(`  review: ${reviewPath}  (${proposals.length} proposals, applied=${review.applied})`)

  const below = proposals
    .map((p) => ({ p, ...scoreNative(p) }))
    .filter((x) => x.score < THRESHOLD)

  console.log(`  below threshold (${THRESHOLD}): ${below.length}`)
  for (const b of below.slice(0, 20)) {
    console.log(`    #${b.p.id} score=${b.score.toFixed(2)}  "${b.p.title}" → "${b.p.nativeTitle}"  [${b.reasons.join('; ')}]`)
  }
  if (below.length === 0) return { reverted: 0 }

  // Only revert rows whose current title_native STILL equals what we proposed.
  const ids = below.map((b) => b.p.id)
  const current = await paginate('id, title_native, title_native_script', (q) =>
    q.in('id', ids).not('title_native', 'is', null),
  )
  const curById = new Map(current.map((r: any) => [r.id, r]))
  const toRevert = below.filter((b) => {
    const c = curById.get(b.p.id)
    return c && c.title_native === b.p.nativeTitle
  })
  console.log(`  still-matching & revertable: ${toRevert.length}`)
  if (toRevert.length === 0) return { reverted: 0 }

  backupCsv('native-title', [
    ['id', 'title', 'title_native', 'title_native_script', 'score', 'reasons'],
    ...toRevert.map((b) => [
      String(b.p.id), b.p.title, b.p.nativeTitle, b.p.script, b.score.toFixed(2), b.reasons.join('; '),
    ]),
  ])
  if (!APPLY) {
    console.log('  DRY-RUN — would revert above. Re-run with --apply.')
    return { reverted: toRevert.length }
  }
  let reverted = 0
  for (const b of toRevert) {
    const { error } = await sb
      .from('books')
      .update({ title_native: null, title_native_script: null })
      .eq('id', b.p.id)
      .eq('title_native', b.p.nativeTitle)
    if (!error) reverted++
  }
  console.log(`  REVERTED ${reverted} native-title write(s).`)
  return { reverted }
}

async function verifyIsbnCoverWrites() {
  console.log(`\n── ISBN / cover structural re-verification ──`)
  if (!SINCE) {
    console.log('  no --since provided — skipping (pass the run start to scope this-run writes).')
    return { coverReverted: 0, isbnReverted: 0 }
  }

  // Covers written this run on a non-allowlisted host (next/image would 500).
  const coverWrites = await paginate('id, slug, cover_url', (q) =>
    q.gte('cover_checked_at', SINCE).eq('cover_status', 'valid').not('cover_url', 'is', null),
  )
  const badCovers = coverWrites.filter((r: any) => !isAllowedImageUrl(r.cover_url))
  console.log(`  cover writes since ${SINCE}: ${coverWrites.length}  | non-allowlisted: ${badCovers.length}`)

  // ISBNs written this run that now collide with another book (dup-collision).
  const isbnWrites = await paginate('id, slug, isbn13', (q) =>
    q.gte('isbn_checked_at', SINCE).eq('isbn_status', 'valid').not('isbn13', 'is', null),
  )
  const seen = new Map<string, number>()
  for (const r of isbnWrites) seen.set(r.isbn13, (seen.get(r.isbn13) ?? 0) + 1)
  // collision against the WHOLE table, not just this run:
  const dupIsbns: any[] = []
  for (const r of isbnWrites) {
    const { count } = await sb
      .from('books')
      .select('*', { count: 'exact', head: true })
      .eq('isbn13', r.isbn13)
      .neq('id', r.id)
    if ((count ?? 0) > 0) dupIsbns.push(r)
  }
  console.log(`  isbn writes since ${SINCE}: ${isbnWrites.length}  | collisions: ${dupIsbns.length}`)

  if (badCovers.length === 0 && dupIsbns.length === 0) {
    console.log('  no structural violations — all this-run isbn/cover writes clear.')
    return { coverReverted: 0, isbnReverted: 0 }
  }

  if (badCovers.length)
    backupCsv('cover', [['id', 'slug', 'cover_url'], ...badCovers.map((r: any) => [String(r.id), r.slug, r.cover_url])])
  if (dupIsbns.length)
    backupCsv('isbn', [['id', 'slug', 'isbn13'], ...dupIsbns.map((r: any) => [String(r.id), r.slug, r.isbn13])])

  if (!APPLY) {
    console.log('  DRY-RUN — would revert above. Re-run with --apply.')
    return { coverReverted: badCovers.length, isbnReverted: dupIsbns.length }
  }
  let coverReverted = 0
  for (const r of badCovers) {
    const { error } = await sb.from('books').update({ cover_url: null, cover_status: 'rolled_back' }).eq('id', r.id)
    if (!error) coverReverted++
  }
  let isbnReverted = 0
  for (const r of dupIsbns) {
    const { error } = await sb.from('books').update({ isbn13: null, isbn_status: 'dup_collision' }).eq('id', r.id)
    if (!error) isbnReverted++
  }
  console.log(`  REVERTED ${coverReverted} cover(s), ${isbnReverted} isbn(s).`)
  return { coverReverted, isbnReverted }
}

// ── Year cross-source verification ─────────────────────────────────────────

const WD_API = 'https://www.wikidata.org/w/api.php'
const WD_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const WD_DELAY_MS = 150
const MIN_YEAR = 1400
const MAX_YEAR = new Date().getFullYear() + 1

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseYear(d: string | undefined | null): number | null {
  if (!d) return null
  const m = d.match(/\b(\d{4})\b/)
  if (!m) return null
  const y = parseInt(m[1], 10)
  return y >= MIN_YEAR && y <= MAX_YEAR ? y : null
}

async function wdFetch<T>(params: Record<string, string>): Promise<T | null> {
  const url = `${WD_API}?${new URLSearchParams({ ...params, format: 'json' })}`
  try {
    const res = await fetch(url, { headers: WD_HEADERS })
    await sleep(WD_DELAY_MS)
    if (!res.ok) return null
    return (await res.json().catch(() => null)) as T | null
  } catch {
    return null
  }
}

function claimYear(claim: any): number | null {
  const t = claim?.mainsnak?.datavalue?.value?.time
  return typeof t === 'string' ? parseYear(t) : null
}

function claimItemIds(claims: any, prop: string): string[] {
  return ((claims?.[prop] ?? []) as any[])
    .map((c) => c?.mainsnak?.datavalue?.value?.id)
    .filter((id): id is string => typeof id === 'string')
}

// Earliest Wikidata P577 (publication date) year across search candidates whose
// P50 authors match ours. Author-gated STRICTLY: no author, no P50, or no
// token overlap → no signal (never a title-only namesake match — the exact
// failure mode this auditor exists for).
async function wikidataYear(title: string, author: string | null): Promise<number | null> {
  if (!author) return null
  const search = await wdFetch<{ search?: { id: string }[] }>({
    action: 'wbsearchentities', search: title, language: 'en', type: 'item', limit: '5',
  })
  const ids = (search?.search ?? []).map((s) => s.id)
  if (ids.length === 0) return null
  const entities = await wdFetch<{ entities?: Record<string, any> }>({
    action: 'wbgetentities', ids: ids.join('|'), props: 'claims',
  })
  if (!entities?.entities) return null

  // Batch-resolve the labels of every P50 author QID across all candidates.
  const authorQids = new Set<string>()
  for (const id of ids) for (const q of claimItemIds(entities.entities[id]?.claims, 'P50')) authorQids.add(q)
  if (authorQids.size === 0) return null
  const labelRes = await wdFetch<{ entities?: Record<string, any> }>({
    action: 'wbgetentities', ids: [...authorQids].slice(0, 50).join('|'), props: 'labels', languages: 'en',
  })
  const labelOf = (q: string): string | null =>
    labelRes?.entities?.[q]?.labels?.en?.value ?? null

  let earliest: number | null = null
  for (const id of ids) {
    const claims = entities.entities[id]?.claims
    const authorLabels = claimItemIds(claims, 'P50')
      .map(labelOf)
      .filter((l): l is string => !!l)
    if (authorLabels.length === 0) continue
    if (!authorsAgree(author, authorLabels)) continue
    for (const c of (claims?.P577 ?? []) as any[]) {
      const y = claimYear(c)
      if (y != null && (earliest == null || y < earliest)) earliest = y
    }
  }
  return earliest
}

// Earliest Google Books edition year across volumes that pass the shared
// title-containment + author-agreement guards. Throws GbQuotaError upward.
async function gbEarliestYear(title: string, author: string | null): Promise<number | null> {
  const volumes = await gbVolumesByTitleAuthor(title, author ?? '', {
    maxResults: 10,
    fields: 'items(volumeInfo(title,authors,publishedDate))',
  })
  let earliest: number | null = null
  for (const v of volumes) {
    const info = v.volumeInfo
    if (!info.title || !titlesMatch(title, info.title)) continue
    if (author && !authorsAgree(author, info.authors ?? [])) continue
    const y = parseYear(info.publishedDate)
    if (y != null && (earliest == null || y < earliest)) earliest = y
  }
  return earliest
}

interface YearVerdict {
  id: number
  slug: string
  year: number
  wd: number | null
  gb: number | null
  score: number
  reasons: string[]
  at: string
}

function scoreYear(year: number, wd: number | null, gb: number | null): { score: number; reasons: string[] } {
  let score = 0.5
  const reasons: string[] = []
  if (wd != null) {
    if (Math.abs(wd - year) <= 1) { score += 0.35; reasons.push(`wd-confirms(${wd})`) }
    else { score -= 0.35; reasons.push(`wd-contradicts(${wd})`) }
  } else reasons.push('wd-none')
  if (gb != null) {
    if (Math.abs(gb - year) <= 1) { score += 0.15; reasons.push(`gb-confirms(${gb})`) }
    else if (gb < year - 1) { score -= 0.25; reasons.push(`gb-edition-predates(${gb})`) }
    else reasons.push(`gb-later-reprint(${gb})`) // later edition ≠ evidence against
  } else reasons.push('gb-none')
  return { score: Math.max(0, Math.min(1, score)), reasons }
}

async function verifyYearWrites() {
  console.log(`\n── first_published_year cross-source verification ──`)
  if (SKIP_YEAR) {
    console.log('  --no-year-verify — skipping.')
    return { verified: 0, contradicted: 0, reverted: 0 }
  }
  if (!fs.existsSync(YEAR_PROPOSALS_FILE)) {
    console.log(`  ${YEAR_PROPOSALS_FILE} not found — skipping (no ol-harvest run to verify).`)
    return { verified: 0, contradicted: 0, reverted: 0 }
  }

  // Year proposals from the harvest log, last proposal per book id wins.
  const proposed = new Map<number, number>()
  for (const line of fs.readFileSync(YEAR_PROPOSALS_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const row = JSON.parse(line)
      if (typeof row.id === 'number' && typeof row.year === 'number' && row.title_ok !== false) {
        proposed.set(row.id, row.year)
      }
    } catch { /* tolerate torn tail line from an interrupted run */ }
  }

  // Verdict cache: each applied id:year is verified against the APIs only once.
  const cached = new Set<string>()
  if (fs.existsSync(YEAR_VERDICTS_FILE)) {
    for (const line of fs.readFileSync(YEAR_VERDICTS_FILE, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const v = JSON.parse(line)
        cached.add(`${v.id}:${v.year}`)
      } catch { /* ignore */ }
    }
  }
  const todoIds = [...proposed.keys()].filter((id) => !cached.has(`${id}:${proposed.get(id)}`))
  console.log(`  proposals: ${proposed.size}  | already verified: ${proposed.size - todoIds.length}  | to check: ${todoIds.length}`)
  if (todoIds.length === 0) return { verified: 0, contradicted: 0, reverted: 0 }

  // Still-matching guard: only verify rows whose CURRENT value equals the
  // proposal — dry-run leftovers and manually-corrected rows cost nothing.
  const rows = await paginate('id, slug, title, first_published_year, book_authors(authors(display_name))', (q) =>
    q.in('id', todoIds).not('first_published_year', 'is', null),
  )
  const applied = rows.filter((r: any) => r.first_published_year === proposed.get(r.id))
  console.log(`  applied & still-matching: ${applied.length}  (capped at --year-limit=${YEAR_LIMIT})`)

  const verdicts: YearVerdict[] = []
  const out = fs.createWriteStream(YEAR_VERDICTS_FILE, { flags: 'a' })
  let quotaHit = false
  for (const r of applied.slice(0, YEAR_LIMIT)) {
    const year = r.first_published_year as number
    const author: string | null = r.book_authors?.[0]?.authors?.display_name ?? null
    const wd = await wikidataYear(r.title, author)
    let gb: number | null = null
    try {
      gb = hasGbKey() ? await gbEarliestYear(r.title, author) : null
    } catch (e) {
      if (e instanceof GbQuotaError) {
        // Stop mid-pass WITHOUT caching this row: a quota wall must never
        // freeze a wd-only verdict as final (see GbQuotaError doc).
        quotaHit = true
        console.log('  GB quota exhausted — aborting remainder of year pass (resumes next run).')
        break
      }
      throw e
    }
    const { score, reasons } = scoreYear(year, wd, gb)
    const v: YearVerdict = { id: r.id, slug: r.slug, year, wd, gb, score, reasons, at: new Date().toISOString() }
    verdicts.push(v)
    out.write(JSON.stringify(v) + '\n')
    if (score < THRESHOLD) {
      console.log(`    #${v.id} score=${score.toFixed(2)}  "${r.title}" year=${year}  [${reasons.join('; ')}]`)
    }
  }
  out.end()

  const contradicted = verdicts.filter((v) => v.score < THRESHOLD)
  const confirmed = verdicts.filter((v) => v.score > 0.5)
  console.log(`  verified: ${verdicts.length}  | confirmed: ${confirmed.length}  | no-evidence (kept): ${verdicts.length - confirmed.length - contradicted.length}  | below threshold: ${contradicted.length}${quotaHit ? '  (pass incomplete: GB quota)' : ''}`)
  if (contradicted.length === 0) return { verified: verdicts.length, contradicted: 0, reverted: 0 }

  backupCsv('year', [
    ['id', 'slug', 'year', 'wd', 'gb', 'score', 'reasons'],
    ...contradicted.map((v) => [
      String(v.id), v.slug, String(v.year), String(v.wd ?? ''), String(v.gb ?? ''), v.score.toFixed(2), v.reasons.join('; '),
    ]),
  ])
  if (!APPLY) {
    console.log('  DRY-RUN — would revert above to NULL. Re-run with --apply.')
    return { verified: verdicts.length, contradicted: contradicted.length, reverted: contradicted.length }
  }
  let reverted = 0
  for (const v of contradicted) {
    const { error } = await sb
      .from('books')
      .update({ first_published_year: null })
      .eq('id', v.id)
      .eq('first_published_year', v.year)
    if (!error) reverted++
  }
  console.log(`  REVERTED ${reverted} year write(s) to NULL (re-enter the enrichment funnel).`)
  return { verified: verdicts.length, contradicted: contradicted.length, reverted }
}

async function main() {
  console.log(`Enrichment confidence audit  (threshold=${THRESHOLD}, apply=${APPLY})`)
  const native = await auditNativeTitles()
  const structural = await verifyIsbnCoverWrites()
  const year = await verifyYearWrites()
  const total = native.reverted + structural.coverReverted + structural.isbnReverted + year.reverted
  console.log(`\nTotal ${APPLY ? 'reverted' : 'would-revert'}: ${total}` +
    `  (native=${native.reverted}, cover=${structural.coverReverted}, isbn=${structural.isbnReverted}, year=${year.reverted})\n`)
  // Machine-readable line for the report generator.
  console.log('JSON ' + JSON.stringify({ threshold: THRESHOLD, apply: APPLY, native, structural, year, total }))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
