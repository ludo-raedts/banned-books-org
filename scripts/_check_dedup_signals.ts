#!/usr/bin/env tsx
// Audit the dedup-flagging behavior of the import-review queue.
// Read-only. Answers four questions:
//   1. How many pending rows are flagged as possible_duplicate?
//   2. What's the similarity-score distribution?
//   3. Top-N source-vs-candidate pairs — are these real dupes or fuzzy noise?
//   4. Which books get pointed at by multiple queue rows (= same book hit repeatedly)?
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvLocal() {
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

type DedupCheck = {
  kind: 'none' | 'duplicate' | 'possible_duplicate' | string
  book_id?: number
  similarity?: number
  match_type?: string
}

type ExtractOutput = { title?: string; authors?: string[]; year?: number | null }
type QueueRow = {
  id: number
  source_slug: string
  status: string
  pass_a_output: ExtractOutput | null
  pass_b_output: ExtractOutput | null
  agreement_details: { dedup_check?: DedupCheck } | null
}

function pickExtract(r: QueueRow): ExtractOutput {
  if (r.pass_b_output && r.pass_b_output.title) return r.pass_b_output
  if (r.pass_a_output && r.pass_a_output.title) return r.pass_a_output
  return {}
}

async function main() {
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  // Paginated read — order required for stable .range() pagination.
  const rows: QueueRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('import_review_queue')
      .select('id, source_slug, status, pass_a_output, pass_b_output, agreement_details')
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as unknown as QueueRow[]))
    if (data.length < 1000) break
    offset += 1000
  }

  console.log(`Total queue rows: ${rows.length}`)

  // ── 1. Status × dedup_kind cross-tab ─────────────────────────────────
  const crosstab = new Map<string, number>()
  for (const r of rows) {
    const kind = r.agreement_details?.dedup_check?.kind ?? '(missing)'
    const key = `${r.status} × ${kind}`
    crosstab.set(key, (crosstab.get(key) ?? 0) + 1)
  }
  console.log('\nStatus × dedup_kind:')
  for (const [k, v] of [...crosstab.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(5)}  ${k}`)
  }

  // ── 2. Similarity-score histogram for pending possible_duplicate ─────
  const pendingPossible = rows.filter(r =>
    r.status === 'pending_review' &&
    r.agreement_details?.dedup_check?.kind === 'possible_duplicate'
  )
  console.log(`\nPending + possible_duplicate: ${pendingPossible.length}`)

  const buckets: Record<string, number> = {
    '0.50-0.55': 0, '0.55-0.60': 0, '0.60-0.65': 0,
    '0.65-0.70': 0, '0.70-0.75': 0, '0.75-0.80': 0,
    '0.80-0.85': 0, '>0.85': 0, '(no score)': 0,
  }
  for (const r of pendingPossible) {
    const s = r.agreement_details?.dedup_check?.similarity
    if (s == null) { buckets['(no score)']++; continue }
    if (s < 0.55) buckets['0.50-0.55']++
    else if (s < 0.60) buckets['0.55-0.60']++
    else if (s < 0.65) buckets['0.60-0.65']++
    else if (s < 0.70) buckets['0.65-0.70']++
    else if (s < 0.75) buckets['0.70-0.75']++
    else if (s < 0.80) buckets['0.75-0.80']++
    else if (s < 0.85) buckets['0.80-0.85']++
    else buckets['>0.85']++
  }
  console.log('\nSimilarity histogram (pending + possible_duplicate):')
  for (const [b, n] of Object.entries(buckets)) {
    const bar = '█'.repeat(Math.min(40, Math.round(n / Math.max(1, pendingPossible.length) * 40)))
    console.log(`  ${b}  ${String(n).padStart(4)}  ${bar}`)
  }

  // ── 3. Multi-hit books: same book_id targeted by N queue rows ────────
  const bookHits = new Map<number, number[]>()
  for (const r of pendingPossible) {
    const bid = r.agreement_details?.dedup_check?.book_id
    if (typeof bid !== 'number') continue
    const arr = bookHits.get(bid) ?? []
    arr.push(r.id)
    bookHits.set(bid, arr)
  }
  const multiHits = [...bookHits.entries()].filter(([, ids]) => ids.length > 1)
  console.log(`\nUnique candidate books pointed at: ${bookHits.size}`)
  console.log(`Books hit by >1 queue row:         ${multiHits.length}`)
  if (multiHits.length > 0) {
    console.log('Top 10:')
    multiHits.sort((a, b) => b[1].length - a[1].length).slice(0, 10).forEach(([bid, ids]) =>
      console.log(`  book #${bid}: ${ids.length} queue rows  ids=[${ids.join(',')}]`)
    )
  }

  // ── 4. Top-20 examples — source vs candidate book ────────────────────
  if (pendingPossible.length === 0) return

  const sampleIds = pendingPossible
    .sort((a, b) =>
      (b.agreement_details?.dedup_check?.similarity ?? 0) -
      (a.agreement_details?.dedup_check?.similarity ?? 0)
    )
    .slice(0, 20)

  const candidateBookIds = [...new Set(
    sampleIds
      .map(r => r.agreement_details?.dedup_check?.book_id)
      .filter((v): v is number => typeof v === 'number')
  )]

  const { data: books, error: be } = await sb
    .from('books')
    .select('id, title, slug, book_authors(authors(display_name))')
    .in('id', candidateBookIds)
  if (be) throw be

  const bookMap = new Map<number, { title: string; slug: string; author: string }>()
  for (const b of (books as unknown as Array<{
    id: number; title: string; slug: string
    book_authors: Array<{ authors: { display_name: string } | null }>
  }>) ?? []) {
    bookMap.set(b.id, {
      title: b.title,
      slug: b.slug,
      author: b.book_authors?.[0]?.authors?.display_name ?? '—',
    })
  }

  console.log('\nTop 20 highest-similarity pending dupes (source ↔ candidate):')
  for (const r of sampleIds) {
    const d = r.agreement_details!.dedup_check!
    const src = pickExtract(r)
    const srcTitle = src.title ?? '—'
    const srcAuthor = src.authors?.[0] ?? '—'
    const cand = d.book_id ? bookMap.get(d.book_id) : null
    const sim = d.similarity?.toFixed(2) ?? '?'
    console.log(`  q#${r.id}  sim=${sim}  src="${srcTitle.slice(0, 45)}" / ${srcAuthor.slice(0, 25)}`)
    console.log(`            cand=#${d.book_id} "${cand?.title?.slice(0, 45) ?? '???'}" / ${cand?.author?.slice(0, 25) ?? '—'}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
