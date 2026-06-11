#!/usr/bin/env tsx
/**
 * Sample N rows from the KEEP_NARRATIVE bucket of the
 * ban-vs-context audit so a human can judge whether the "rich
 * signals" heuristic is keeping genuinely distinct narrative or
 * still letting templated/redundant prose through.
 *
 * Read-only. Pulls description_ban + censorship_context per
 * sampled book from Supabase and writes a markdown file with
 * side-by-side text + the audit signals that put it in the bucket.
 *
 * Usage:
 *   npx tsx scripts/_sample_keep_narrative.ts            # 20 samples, random seed
 *   npx tsx scripts/_sample_keep_narrative.ts --n=30 --seed=42
 *   npx tsx scripts/_sample_keep_narrative.ts --csv=data/ban-vs-context-audit-2026-05-29.csv
 */
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

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

// ── args ────────────────────────────────────────────────────────────────
function arg(name: string, fallback?: string): string | undefined {
  const a = process.argv.find(x => x.startsWith(`--${name}=`))
  return a ? a.slice(name.length + 3) : fallback
}
const N = parseInt(arg('n', '20')!, 10)
const SEED = parseInt(arg('seed', String(Date.now() % 1_000_000))!, 10)

function pickCsv(): string {
  const explicit = arg('csv')
  if (explicit) return explicit
  const files = readdirSync('data')
    .filter(f => /^ban-vs-context-audit-\d{4}-\d{2}-\d{2}\.csv$/.test(f))
    .sort()
  if (files.length === 0) throw new Error('no ban-vs-context-audit-*.csv in data/')
  return join('data', files[files.length - 1])
}
const CSV_PATH = pickCsv()

// ── deterministic PRNG (mulberry32) ─────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── minimal CSV parse (audit script quotes commas in free-text cols) ───
type Row = {
  id: number
  slug: string
  bucket: string
  newness: number
  n_countries: number
  n_reasons: number
  n_ban_source_links: number
  has_court_case: number
  has_named_plaintiff: number
  reasoning: string
  title: string
}
function parseCsv(path: string): Row[] {
  const lines = readFileSync(path, 'utf8').split('\n').filter(l => l.length > 0)
  const header = lines.shift()!.split(',')
  const idx = (k: string) => header.indexOf(k)
  const out: Row[] = []
  for (const line of lines) {
    const f: string[] = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (q) {
        if (c === '"' && line[i+1] === '"') { cur += '"'; i++; continue }
        if (c === '"') { q = false; continue }
        cur += c
      } else {
        if (c === '"') { q = true; continue }
        if (c === ',') { f.push(cur); cur = ''; continue }
        cur += c
      }
    }
    f.push(cur)
    out.push({
      id: parseInt(f[idx('id')], 10),
      slug: f[idx('slug')] ?? '',
      bucket: f[idx('bucket')] ?? '',
      newness: parseFloat(f[idx('newness')]) || 0,
      n_countries: parseInt(f[idx('n_countries')], 10) || 0,
      n_reasons: parseInt(f[idx('n_reasons')], 10) || 0,
      n_ban_source_links: parseInt(f[idx('n_ban_source_links')], 10) || 0,
      has_court_case: parseInt(f[idx('has_court_case')], 10) || 0,
      has_named_plaintiff: parseInt(f[idx('has_named_plaintiff')], 10) || 0,
      reasoning: f[idx('reasoning')] ?? '',
      title: f[idx('title')] ?? '',
    })
  }
  return out
}

// ── trigram overlap (mirror of audit) ──────────────────────────────────
function tokenize(s: string): string[] {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2)
}
function trigrams(s: string): Set<string> {
  const toks = tokenize(s)
  const out = new Set<string>()
  for (let i = 0; i + 2 < toks.length; i++) out.add(`${toks[i]} ${toks[i+1]} ${toks[i+2]}`)
  return out
}
function overlapStats(ctx: string, ban: string) {
  const ctxTri = trigrams(ctx)
  const banTri = trigrams(ban)
  if (ctxTri.size === 0) return { newness: 0, sharedFraction: 0, ctxSize: 0 }
  let shared = 0
  for (const t of ctxTri) if (banTri.has(t)) shared++
  return {
    newness: 1 - shared / ctxTri.size,
    sharedFraction: shared / ctxTri.size,
    ctxSize: ctxTri.size,
  }
}

// ── main ────────────────────────────────────────────────────────────────
async function main() {
  console.log(`# Sample KEEP_NARRATIVE`)
  console.log(`# CSV:  ${CSV_PATH}`)
  console.log(`# N:    ${N}`)
  console.log(`# Seed: ${SEED}\n`)

  const rows = parseCsv(CSV_PATH).filter(r => r.bucket === 'KEEP_NARRATIVE')
  console.log(`KEEP_NARRATIVE rows in CSV: ${rows.length}`)

  // Fisher-Yates with deterministic PRNG, then take first N.
  const rand = mulberry32(SEED)
  const shuf = rows.slice()
  for (let i = shuf.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuf[i], shuf[j]] = [shuf[j], shuf[i]]
  }
  const sample = shuf.slice(0, N)

  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()
  const { data, error } = await sb
    .from('books')
    .select('id, slug, title, description_ban, censorship_context, censorship_context_status')
    .in('id', sample.map(s => s.id))
  if (error) throw error

  const byId = new Map<number, {
    id: number
    slug: string
    title: string
    description_ban: string | null
    censorship_context: string | null
    censorship_context_status: string | null
  }>()
  for (const r of data ?? []) byId.set(r.id, r as never)

  // Build markdown report.
  const md: string[] = []
  md.push(`# KEEP_NARRATIVE sample — ${N} rows`)
  md.push(``)
  md.push(`Source CSV: \`${CSV_PATH}\` · seed: \`${SEED}\``)
  md.push(``)
  md.push(`Per row we show:`)
  md.push(`- **audit signals** that put the book in KEEP_NARRATIVE`)
  md.push(`- **shared/new trigram split** between description_ban and censorship_context`)
  md.push(`- **side-by-side text** so you can eyeball whether censorship_context adds anything`)
  md.push(``)
  md.push(`Mark each as: **KEEP** (genuinely adds info) · **DROP** (still redundant) · **EDIT** (could be much shorter)`)
  md.push(``)
  md.push(`---`)
  md.push(``)

  // Distribution counters
  let stillRedundant = 0  // shared >= 0.5
  let mostlyNew = 0       // shared <= 0.2
  let mixed = 0

  for (const s of sample) {
    const row = byId.get(s.id)
    if (!row) {
      md.push(`## id=${s.id} ${s.slug} — NOT FOUND IN DB`)
      md.push(``)
      continue
    }
    const ctx = row.censorship_context ?? ''
    const ban = row.description_ban ?? ''
    const stats = overlapStats(ctx, ban)
    if (stats.sharedFraction >= 0.5) stillRedundant++
    else if (stats.sharedFraction <= 0.2) mostlyNew++
    else mixed++

    md.push(`## ${row.title}`)
    md.push(`\`id=${row.id}\` · [/books/${row.slug}](https://banned-books.org/books/${row.slug}) · status=\`${row.censorship_context_status ?? '—'}\``)
    md.push(``)
    md.push(`**Audit signals:** ${s.reasoning}`)
    md.push(``)
    md.push(`**Overlap:** shared=${(stats.sharedFraction * 100).toFixed(0)}% · newness=${(stats.newness * 100).toFixed(0)}% · context trigrams=${stats.ctxSize}`)
    md.push(``)
    md.push(`**description_ban** _(${ban.length} chars)_`)
    md.push(`> ${ban.replace(/\n+/g, ' ').trim() || '_(empty)_'}`)
    md.push(``)
    md.push(`**censorship_context** _(${ctx.length} chars)_`)
    md.push(`> ${ctx.replace(/\n+/g, ' ').trim() || '_(empty)_'}`)
    md.push(``)
    md.push(`Verdict: [ ] KEEP · [ ] DROP · [ ] EDIT`)
    md.push(``)
    md.push(`---`)
    md.push(``)
  }

  md.push(`## Sample distribution`)
  md.push(``)
  md.push(`- shared ≥ 50% (likely still redundant): **${stillRedundant}**`)
  md.push(`- shared ≤ 20% (mostly new info):        **${mostlyNew}**`)
  md.push(`- mixed (20–50%):                        **${mixed}**`)
  md.push(``)
  md.push(`If \`stillRedundant\` is high, KEEP_NARRATIVE is letting too much through and the v3 pipeline should tighten the heuristic (or drop the section by default and require manual curation).`)
  md.push(``)

  const outPath = `data/keep-narrative-sample-${new Date().toISOString().slice(0, 10)}.md`
  writeFileSync(outPath, md.join('\n'))
  console.log(`\nReport: ${outPath}`)
  console.log(`Distribution:  shared≥50% = ${stillRedundant} · shared≤20% = ${mostlyNew} · mixed = ${mixed}`)
}

main().catch(e => { console.error(e); process.exit(1) })
