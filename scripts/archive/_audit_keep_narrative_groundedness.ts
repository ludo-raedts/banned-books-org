#!/usr/bin/env tsx
/**
 * Second-pass audit on top of _audit_ban_vs_context_overlap.ts.
 *
 * The first audit (2026-05-29) wiped TEMPLATE_CONFIRMED + REDUCE_TO_BAN_ONLY
 * but kept 6,530 rows as KEEP_NARRATIVE because they had high trigram-newness
 * vs description_ban. A manual 20-row sample showed that ~60% of those
 * "novel" texts are LLM hallucinations: invented school districts (e.g.
 * "Maplewood School District in New Jersey" attributed to two different books),
 * fabricated parent-teacher complaints, and generic boilerplate about
 * "broader trends" that cites nothing.
 *
 * This script classifies each surviving KEEP_NARRATIVE row by GROUNDEDNESS,
 * not by overlap. The trigram metric measures word-overlap; it cannot tell
 * a hallucination from a verified case.
 *
 * Buckets:
 *   GROUNDED       — contains at least one verifiable anchor: named law/bill
 *                    number (HB 1069, SF 496, Senate Bill X), named court
 *                    case (R v., U.S. v., Lady Chatterley trial, fatwa),
 *                    named censorship org (PEN America, Moms for Liberty,
 *                    NCAC), or named statute (National Security Law, Comstock
 *                    Act, Obscene Publications Act, etc.).
 *   THIN           — no grounded anchor, no hallucination tell either; short
 *                    or generic prose. Probably safe to wipe but low signal.
 *   HALLUCINATED   — no grounded anchor AND at least one hallucination tell:
 *                    LLM padding phrases ("broader trend", "this reflects",
 *                    "leading to a heated school board meeting") or invented
 *                    actors ("parent-teacher associations", "conservative
 *                    advocacy groups") that don't appear in description_ban.
 *
 * Plus a cross-cutting flag:
 *   CROSS_BOOK_DUP — censorship_context shares a 12+ word substring with the
 *                    context of ≥3 other books. The HK NSL paragraph is the
 *                    canonical example: real law, but pasted across hundreds
 *                    of HK books, becomes site-wide duplicate content.
 *
 * Read-only. Writes data/keep-narrative-groundedness-<date>.csv. Operator
 * decides what to wipe via _apply_keep_narrative_groundedness.ts.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { groundedSignals, hallucinationTells } from '../src/lib/censorship-context-quality'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
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

// GROUNDED anchors and HALLUCINATION tells live in
// src/lib/censorship-context-quality.ts so the same rules are used both
// here (for after-the-fact auditing) and inside the enrichment scripts
// (as a pre-write quality gate). See that module for the policy.

// ── Cross-book duplicate detection ──────────────────────────────────────
// We hash overlapping 12-word windows across the dataset and flag any
// row whose context shares ≥1 such window with ≥2 other books.
// 12 words is long enough that natural-text collisions are vanishingly
// rare; short enough that LLM-pasted boilerplate gets caught.
const WINDOW_WORDS = 12
const DUP_THRESHOLD = 3 // window must appear in this many books (including self) to flag

function windows(text: string): string[] {
  const toks = text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(t => t.length >= 2)
  const out: string[] = []
  for (let i = 0; i + WINDOW_WORDS <= toks.length; i++) {
    out.push(toks.slice(i, i + WINDOW_WORDS).join(' '))
  }
  return out
}
function shortHash(s: string): string {
  return createHash('md5').update(s).digest('hex').slice(0, 12)
}

// ── main ────────────────────────────────────────────────────────────────
type Book = {
  id: number
  slug: string
  title: string
  description_ban: string | null
  censorship_context: string | null
  censorship_context_status: string | null
}

async function main() {
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  console.log(`# Audit KEEP_NARRATIVE groundedness\n`)

  // Pull every book that still has a censorship_context after the
  // 2026-05-29 wipe — these are the KEEP_NARRATIVE survivors (status
  // pending_review) plus anything edited since.
  const PAGE = 1000
  const books: Book[] = []
  let from = 0
  for (;;) {
    const { data, error } = await sb
      .from('books')
      .select('id, slug, title, description_ban, censorship_context, censorship_context_status')
      .not('censorship_context', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    books.push(...data as Book[])
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`Books with censorship_context still filled: ${books.length}`)

  // ── Pass 1: build window → book-ids index for cross-book duplicate detection
  const winToBooks = new Map<string, Set<number>>()
  for (const b of books) {
    if (!b.censorship_context) continue
    const seen = new Set<string>()
    for (const w of windows(b.censorship_context)) {
      const h = shortHash(w)
      if (seen.has(h)) continue // count each window once per book
      seen.add(h)
      const set = winToBooks.get(h) ?? new Set<number>()
      set.add(b.id)
      winToBooks.set(h, set)
    }
  }
  console.log(`Distinct ${WINDOW_WORDS}-word windows: ${winToBooks.size}`)

  // Which windows are "duplicate" (appear in ≥ DUP_THRESHOLD books)?
  const dupWindows = new Set<string>()
  for (const [h, set] of winToBooks) if (set.size >= DUP_THRESHOLD) dupWindows.add(h)
  console.log(`Duplicate windows (≥${DUP_THRESHOLD} books): ${dupWindows.size}`)

  // For each book: how many duplicate windows does it contain, and what's
  // the worst (max number of other books sharing one of its windows)?
  function dupStatsFor(text: string): { dupCount: number; maxFanout: number } {
    let dupCount = 0
    let maxFanout = 0
    const seen = new Set<string>()
    for (const w of windows(text)) {
      const h = shortHash(w)
      if (seen.has(h)) continue
      seen.add(h)
      if (dupWindows.has(h)) {
        dupCount++
        const fanout = winToBooks.get(h)?.size ?? 0
        if (fanout > maxFanout) maxFanout = fanout
      }
    }
    return { dupCount, maxFanout }
  }

  // ── Pass 2: classify each book
  type Row = {
    id: number
    slug: string
    title: string
    bucket: 'GROUNDED' | 'THIN' | 'HALLUCINATED'
    cross_book_dup: boolean
    grounded_signals: string[]
    hallucination_tells: string[]
    dup_windows: number
    max_fanout: number
    ctx_len: number
    reasoning: string
  }
  const rows: Row[] = []
  const counts = { GROUNDED: 0, THIN: 0, HALLUCINATED: 0 }
  let dupFlagged = 0

  for (const b of books) {
    const ctx = b.censorship_context ?? ''
    const grounded = groundedSignals(ctx)
    const tells = hallucinationTells(ctx)
    const { dupCount, maxFanout } = dupStatsFor(ctx)
    const cross_book_dup = dupCount >= 1 && maxFanout >= DUP_THRESHOLD

    let bucket: Row['bucket']
    let reasoning: string
    if (grounded.length > 0) {
      bucket = 'GROUNDED'
      reasoning = `signals: ${grounded.join(', ')}`
    } else if (tells.length > 0) {
      bucket = 'HALLUCINATED'
      reasoning = `tells: ${tells.slice(0, 3).join(' | ')}`
    } else {
      bucket = 'THIN'
      reasoning = `no signals, no tells (len=${ctx.length})`
    }
    if (cross_book_dup) {
      reasoning += `; cross-book-dup (${dupCount} windows, max fan-out ${maxFanout})`
      dupFlagged++
    }

    rows.push({
      id: b.id,
      slug: b.slug,
      title: b.title,
      bucket,
      cross_book_dup,
      grounded_signals: grounded,
      hallucination_tells: tells,
      dup_windows: dupCount,
      max_fanout: maxFanout,
      ctx_len: ctx.length,
      reasoning,
    })
    counts[bucket]++
  }

  // ── Distribution
  console.log(`\n# Distribution`)
  const total = rows.length
  for (const [k, v] of Object.entries(counts)) {
    const pct = total === 0 ? 0 : (v / total * 100).toFixed(1)
    console.log(`  ${k.padEnd(14)} ${String(v).padStart(5)}   (${pct}%)`)
  }
  console.log(`  cross-book-dup ${String(dupFlagged).padStart(5)}   (${(dupFlagged/total*100).toFixed(1)}%)  [orthogonal flag]`)

  // Cross-tab: bucket × cross_book_dup
  console.log(`\n# Cross-tab (bucket × cross-book-dup)`)
  const groups: Record<string, number> = {}
  for (const r of rows) {
    const key = `${r.bucket}${r.cross_book_dup ? ' + DUP' : ''}`
    groups[key] = (groups[key] ?? 0) + 1
  }
  for (const [k, v] of Object.entries(groups).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(28)} ${v}`)
  }

  // ── Samples per bucket
  for (const bucket of ['GROUNDED', 'THIN', 'HALLUCINATED'] as const) {
    const sample = rows.filter(r => r.bucket === bucket).slice(0, 3)
    if (sample.length === 0) continue
    console.log(`\n# Sample — ${bucket}`)
    for (const s of sample) {
      const b = books.find(x => x.id === s.id)!
      console.log(`  id=${s.id}  ${s.slug}`)
      console.log(`     ${s.reasoning}`)
      console.log(`     ${truncate(b.censorship_context, 180)}`)
    }
  }

  // ── CSV out
  const outPath = `data/keep-narrative-groundedness-${new Date().toISOString().slice(0, 10)}.csv`
  const csv: string[] = [
    'id,slug,bucket,cross_book_dup,grounded_signals,hallucination_tells,dup_windows,max_fanout,ctx_len,reasoning,title',
  ]
  for (const r of rows) {
    csv.push([
      r.id,
      esc(r.slug),
      r.bucket,
      r.cross_book_dup ? 1 : 0,
      esc(r.grounded_signals.join('|')),
      esc(r.hallucination_tells.join(' | ')),
      r.dup_windows,
      r.max_fanout,
      r.ctx_len,
      esc(r.reasoning),
      esc(r.title),
    ].join(','))
  }
  writeFileSync(outPath, csv.join('\n'))
  console.log(`\nReport: ${outPath}`)
}

function truncate(s: string | null | undefined, n: number): string {
  if (s == null) return '—'
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > n ? flat.slice(0, n) + '…' : flat
}
function esc(s: string | null | undefined): string {
  if (s == null) return ''
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

main().catch(e => { console.error(e); process.exit(1) })
