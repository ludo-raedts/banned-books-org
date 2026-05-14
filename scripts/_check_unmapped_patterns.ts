#!/usr/bin/env tsx
// Cluster the unmapped reason-notes across pending queue rows so we can
// extend src/lib/wikipedia/reason-mapper.ts with the right patterns.
//
// Read-only. Strategy:
//   1. Pull all pending_review rows where reason_mapping is unmapped
//      (slug=null OR quality_flags includes 'unmapped_reason').
//   2. For each, take agreement_details.parsed_row.notes_raw — the actual
//      Wikipedia text the mapper saw — and bucket it.
//   3. Report:
//      a. Per-source row counts
//      b. Top exact-duplicate notes (case-insensitive) across all sources
//      c. Per source: top 15 literal notes + top 30 bigrams
//      d. Length distribution (short notes = bare phrases; long = essay-style)
//      e. A handful of mid-length samples per source for eyeballing
//
// Output is designed to make regex extraction easy — copy a literal phrase or
// bigram, paste it into reason-mapper.ts as `/\b<phrase>\b/i → '<slug>'`.
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

type ParsedRow = {
  notes_raw?: string | null
  title?: string | null
  authors?: string[] | null
}

type AgreementDetails = {
  parsed_row?: ParsedRow
  reason_mapping?: { slug?: string | null; confidence?: string | null }
  quality_flags?: string[]
}

type QueueRow = {
  id: number
  source_slug: string
  status: string
  agreement_details: AgreementDetails | null
}

// English stopwords — leave room for domain-specific terms ("ban", "banned",
// "censored") since those usually co-occur with the actual reason word so the
// bigrams stay informative.
const STOPWORDS = new Set([
  'the','a','an','of','to','for','in','on','at','by','with','as','is','was',
  'were','are','be','been','being','have','has','had','it','its','this','that',
  'these','those','and','or','but','not','no','if','then','so','because','from',
  'into','about','after','before','during','his','her','their','they','he','she',
  'we','us','our','i','my','me','you','your','which','who','whom','what','when',
  'where','why','how','will','would','could','should','can','may','might','must',
  'do','does','did','done','also','than','such','any','some','all','one','two',
  'first','second','more','most','very','too','only','own','same','other','out',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t))
}

function bigrams(tokens: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]} ${tokens[i + 1]}`)
  }
  return out
}

function isUnmapped(d: AgreementDetails | null): boolean {
  if (!d) return false
  const flags = d.quality_flags ?? []
  if (flags.includes('unmapped_reason')) return true
  const rm = d.reason_mapping
  if (rm && (!rm.slug || rm.slug === 'other') && rm.confidence !== 'high') return true
  return false
}

function topN<K>(counts: Map<K, number>, n: number): Array<[K, number]> {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

function printPad(label: string, n: number) {
  console.log(`  ${String(n).padStart(5)}  ${label}`)
}

async function main() {
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  const rows: QueueRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('import_review_queue')
      .select('id, source_slug, status, agreement_details')
      .eq('status', 'pending_review')
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as unknown as QueueRow[]))
    if (data.length < 1000) break
    offset += 1000
  }

  const unmapped = rows.filter(r => isUnmapped(r.agreement_details))
  console.log(`Pending review:           ${rows.length}`)
  console.log(`Unmapped reason rows:     ${unmapped.length}`)

  // ── Per source ─────────────────────────────────────────────────────────────
  const perSource = new Map<string, QueueRow[]>()
  for (const r of unmapped) {
    const arr = perSource.get(r.source_slug) ?? []
    arr.push(r)
    perSource.set(r.source_slug, arr)
  }

  console.log('\n── UNMAPPED BY SOURCE ──')
  const sortedSources = [...perSource.entries()].sort((a, b) => b[1].length - a[1].length)
  for (const [src, arr] of sortedSources) {
    printPad(src, arr.length)
  }

  // ── Length distribution ───────────────────────────────────────────────────
  const lenBuckets = { empty: 0, 'short(<30)': 0, 'med(30-100)': 0, 'long(100-300)': 0, 'xlong(300+)': 0 }
  for (const r of unmapped) {
    const text = r.agreement_details?.parsed_row?.notes_raw ?? ''
    const len = text.trim().length
    if (len === 0) lenBuckets.empty++
    else if (len < 30) lenBuckets['short(<30)']++
    else if (len < 100) lenBuckets['med(30-100)']++
    else if (len < 300) lenBuckets['long(100-300)']++
    else lenBuckets['xlong(300+)']++
  }
  console.log('\n── NOTES LENGTH DISTRIBUTION ──')
  for (const [bucket, n] of Object.entries(lenBuckets)) {
    printPad(bucket, n)
  }

  // ── Global top exact-duplicate notes ──────────────────────────────────────
  const globalNotes = new Map<string, number>()
  for (const r of unmapped) {
    const text = (r.agreement_details?.parsed_row?.notes_raw ?? '').trim()
    if (!text) continue
    const norm = text.toLowerCase().replace(/\s+/g, ' ')
    globalNotes.set(norm, (globalNotes.get(norm) ?? 0) + 1)
  }
  console.log('\n── TOP 30 EXACT-DUPLICATE NOTES (across all sources) ──')
  for (const [text, n] of topN(globalNotes, 30)) {
    if (n < 2) continue
    const display = text.length > 110 ? text.slice(0, 107) + '…' : text
    printPad(display, n)
  }

  // ── Per source: top literal notes + top bigrams ───────────────────────────
  for (const [src, arr] of sortedSources) {
    if (arr.length < 10) continue   // ignore tail
    console.log(`\n── SOURCE: ${src} (${arr.length} unmapped) ──`)

    // Top literal notes (case-insensitive, whitespace-normalized)
    const litCount = new Map<string, number>()
    const bigramCount = new Map<string, number>()
    const unigramCount = new Map<string, number>()
    let empties = 0
    for (const r of arr) {
      const text = (r.agreement_details?.parsed_row?.notes_raw ?? '').trim()
      if (!text) { empties++; continue }
      const norm = text.toLowerCase().replace(/\s+/g, ' ')
      litCount.set(norm, (litCount.get(norm) ?? 0) + 1)
      const toks = tokenize(text)
      for (const tok of toks) unigramCount.set(tok, (unigramCount.get(tok) ?? 0) + 1)
      for (const bg of bigrams(toks)) bigramCount.set(bg, (bigramCount.get(bg) ?? 0) + 1)
    }
    if (empties > 0) console.log(`  (${empties} rows have empty notes_raw)`)

    console.log(`  Top 15 literal notes:`)
    for (const [text, n] of topN(litCount, 15)) {
      const display = text.length > 100 ? text.slice(0, 97) + '…' : text
      printPad(display, n)
    }

    console.log(`  Top 20 unigrams:`)
    const unigramLine = topN(unigramCount, 20)
      .map(([t, n]) => `${t}(${n})`).join(' ')
    console.log(`    ${unigramLine}`)

    console.log(`  Top 20 bigrams:`)
    for (const [bg, n] of topN(bigramCount, 20)) {
      if (n < 2) continue
      printPad(bg, n)
    }
  }

  // ── Mid-length samples for eyeballing (best signal-to-noise) ──────────────
  console.log('\n── 20 MID-LENGTH SAMPLES (random subset, 30-200 chars) ──')
  const midLen = unmapped.filter(r => {
    const t = (r.agreement_details?.parsed_row?.notes_raw ?? '').trim()
    return t.length >= 30 && t.length <= 200
  })
  // Deterministic shuffle: sort by id mod 7 then slice
  const samples = midLen.sort((a, b) => (a.id * 31 + 7) % 997 - (b.id * 31 + 7) % 997).slice(0, 20)
  for (const r of samples) {
    const t = r.agreement_details?.parsed_row?.notes_raw ?? ''
    const title = r.agreement_details?.parsed_row?.title ?? '—'
    console.log(`  [${r.source_slug}] q#${r.id} "${title.slice(0, 30)}"`)
    console.log(`     → ${t.replace(/\s+/g, ' ').slice(0, 180)}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
