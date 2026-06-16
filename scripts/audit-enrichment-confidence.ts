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
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-enrichment-confidence.ts \
 *     --since=2026-06-16T10:00:00Z --native-review=data/native-title-enrichment-2026-06-16.json
 *   add --apply to perform reverts, --threshold=0.5 to tune.
 */
import fs from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { isApply, flagValue } from './lib/cli'

const APPLY = isApply()
const SINCE = flagValue('since') ?? null
const THRESHOLD = parseFloat(flagValue('threshold') ?? '0.5')
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

async function main() {
  console.log(`Enrichment confidence audit  (threshold=${THRESHOLD}, apply=${APPLY})`)
  const native = await auditNativeTitles()
  const structural = await verifyIsbnCoverWrites()
  const total = native.reverted + structural.coverReverted + structural.isbnReverted
  console.log(`\nTotal ${APPLY ? 'reverted' : 'would-revert'}: ${total}` +
    `  (native=${native.reverted}, cover=${structural.coverReverted}, isbn=${structural.isbnReverted})\n`)
  // Machine-readable line for the report generator.
  console.log('JSON ' + JSON.stringify({ threshold: THRESHOLD, apply: APPLY, native, structural, total }))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
