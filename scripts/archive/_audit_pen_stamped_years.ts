#!/usr/bin/env tsx
/**
 * READ-ONLY audit: verify books whose first_published_year is 2024/2025
 * against OpenLibrary's work-level first_publish_year.
 *
 * Why: import-pen.ts (PEN 2024-25 batch, created 2026-05-02/03) stamped
 * `first_published_year: ol.publishYear ?? ev.year ?? null` — i.e. when the
 * OpenLibrary lookup at import time came up empty, the BAN year was written
 * as the publication year. Forensics (2026-08-07): of 1.297 books with
 * fpy ∈ {2024, 2025}, only 1 was published before its earliest ban — a
 * distribution that's impossible for genuinely recent books. Some of these
 * years ARE real (recent releases get banned a lot), so nothing is assumed:
 * every row is checked externally.
 *
 * Evidence ladder (strong → weak), per book:
 *   A. work  — has openlibrary_work_id: OL title(+author) search, trust only
 *              the doc whose work key matches ours (audit-publication-years
 *              pattern).
 *   B. isbn  — has isbn13: OL search `q=isbn:<isbn13>` returns the WORK that
 *              edition belongs to (work-level first_publish_year, not an
 *              edition date). Guards: bidirectional title match AND author
 *              token overlap (enrich-orphan-years doctrine) — protects
 *              against contaminated isbn13s and namesakes.
 *   C. search— title+author free search, same double guard. Weaker: goes to
 *              the review bucket, never into the high-conf fixes file.
 *
 * Buckets:
 *   confirmed_correct — external year == DB year (genuine recent book; leave)
 *   wrong_highconf    — tier A/B evidence, year differs → fixes file
 *   wrong_review      — tier C evidence, year differs → human review only
 *   unverified        — no guarded external match (stays on watchlist;
 *                       follow-up chain: verify-years-llm.ts →
 *                       resolve-proposed-years.ts)
 *
 * Output:
 *   data/pen-stamped-years-audit.json          — machine-readable, all rows
 *   data/pen-stamped-years-audit.md            — review summary
 *   data/publication-year-fixes-highconf.json  — input for
 *                                                apply-publication-year-fixes.ts
 *   data/pen-stamped-years-checkpoint.jsonl    — resume checkpoint (gitignored)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/_audit_pen_stamped_years.ts
 *   npx tsx --env-file=.env.local scripts/_audit_pen_stamped_years.ts --years=2024,2025 --limit=50
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { adminClient } from '../src/lib/supabase'
import { titlesMatch } from '../src/lib/enrich/title-match'
import { flagValue, intFlag } from './lib/cli'

const YEARS = (flagValue('years') ?? '2024,2025').split(',').map((s) => parseInt(s, 10))
const LIMIT = intFlag('limit', Infinity)
const CONCURRENCY = 5
const UA = 'banned-books.org/1.0 (contact@banned-books.org)'
const CHECKPOINT = 'data/pen-stamped-years-checkpoint.jsonl'

const sb = adminClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Book = {
  id: number
  slug: string
  title: string
  first_published_year: number
  isbn13: string | null
  openlibrary_work_id: string | null
  created_at: string
  authors: string[]
  min_ban_year: number | null
}

type Verdict = {
  id: number
  slug: string
  title: string
  authors: string[]
  db_year: number
  min_ban_year: number | null
  tier: 'work' | 'isbn' | 'search' | null
  ol_year: number | null
  ol_title: string | null
  bucket: 'confirmed_correct' | 'wrong_highconf' | 'wrong_review' | 'unverified'
}

function nameTokens(s: string): Set<string> {
  return new Set(
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((t) => t.length > 1),
  )
}
function authorAgrees(ours: string[], cands: string[]): boolean {
  if (!ours.length) return false
  for (const our of ours) {
    const o = nameTokens(our)
    for (const c of cands) {
      const ct = nameTokens(c)
      for (const t of o) if (ct.has(t)) return true
    }
  }
  return false
}
function biTitleMatch(our: string, cand: string): boolean {
  return titlesMatch(our, cand) || titlesMatch(cand, our)
}

type Doc = { title?: string; author_name?: string[]; first_publish_year?: number; key?: string }

async function olSearch(params: Record<string, string>): Promise<Doc[]> {
  const url = new URL('https://openlibrary.org/search.json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('fields', 'title,author_name,first_publish_year,key')
  url.searchParams.set('limit', '5')
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } })
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * (attempt + 1)); continue }
      if (!r.ok) return []
      const j = (await r.json()) as { docs?: Doc[] }
      return j.docs ?? []
    } catch {
      await sleep(2000 * (attempt + 1))
    }
  }
  return []
}

async function verify(b: Book): Promise<Verdict> {
  const base: Omit<Verdict, 'tier' | 'ol_year' | 'ol_title' | 'bucket'> = {
    id: b.id, slug: b.slug, title: b.title, authors: b.authors,
    db_year: b.first_published_year, min_ban_year: b.min_ban_year,
  }
  const plausible = (y: number) => y >= 1400 && y <= 2026

  // Tier A — work-key match
  if (b.openlibrary_work_id) {
    const docs = await olSearch({ title: b.title, ...(b.authors[0] ? { author: b.authors[0] } : {}) })
    const m = docs.find((d) => (d.key ?? '').endsWith(b.openlibrary_work_id!))
    if (m && typeof m.first_publish_year === 'number' && plausible(m.first_publish_year)) {
      const y = m.first_publish_year
      return { ...base, tier: 'work', ol_year: y, ol_title: m.title ?? null,
        bucket: y === b.first_published_year ? 'confirmed_correct' : 'wrong_highconf' }
    }
  }

  // Tier B — isbn → work (double guard)
  if (b.isbn13) {
    const docs = await olSearch({ q: `isbn:${b.isbn13}` })
    const m = docs.find((d) =>
      d.title != null && biTitleMatch(b.title, d.title) &&
      authorAgrees(b.authors, d.author_name ?? []) &&
      typeof d.first_publish_year === 'number' && plausible(d.first_publish_year))
    if (m) {
      const y = m.first_publish_year!
      return { ...base, tier: 'isbn', ol_year: y, ol_title: m.title ?? null,
        bucket: y === b.first_published_year ? 'confirmed_correct' : 'wrong_highconf' }
    }
  }

  // Tier C — free search (double guard) → review only
  const docs = await olSearch({ q: `${b.title} ${b.authors[0] ?? ''}`.trim() })
  const m = docs.find((d) =>
    d.title != null && biTitleMatch(b.title, d.title) &&
    authorAgrees(b.authors, d.author_name ?? []) &&
    typeof d.first_publish_year === 'number' && plausible(d.first_publish_year))
  if (m) {
    const y = m.first_publish_year!
    return { ...base, tier: 'search', ol_year: y, ol_title: m.title ?? null,
      bucket: y === b.first_published_year ? 'confirmed_correct' : 'wrong_review' }
  }

  return { ...base, tier: null, ol_year: null, ol_title: null, bucket: 'unverified' }
}

async function fetchBooks(): Promise<Book[]> {
  const PAGE = 1000
  const out: Book[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('books')
      .select('id, slug, title, first_published_year, isbn13, openlibrary_work_id, created_at, book_authors(authors(display_name)), bans(year_started)')
      .in('first_published_year', YEARS)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const b of data as any[]) {
      const banYears = (b.bans ?? []).map((x: any) => x.year_started).filter((y: any) => typeof y === 'number')
      out.push({
        id: b.id, slug: b.slug, title: b.title,
        first_published_year: b.first_published_year,
        isbn13: b.isbn13, openlibrary_work_id: b.openlibrary_work_id,
        created_at: b.created_at,
        authors: (b.book_authors ?? []).map((ba: any) => ba.authors?.display_name).filter(Boolean),
        min_ban_year: banYears.length ? Math.min(...banYears) : null,
      })
    }
    if (data.length < PAGE) break
  }
  return out
}

async function main() {
  console.log(`Loading books with first_published_year ∈ {${YEARS.join(', ')}}…`)
  let books = await fetchBooks()
  console.log(`  ${books.length} candidate rows.`)

  // Resume: skip ids already in the checkpoint.
  const done = new Map<number, Verdict>()
  if (existsSync(CHECKPOINT)) {
    for (const line of readFileSync(CHECKPOINT, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try { const v = JSON.parse(line) as Verdict; done.set(v.id, v) } catch { /* skip bad line */ }
    }
    console.log(`  resume: ${done.size} rows already checked (${CHECKPOINT})`)
  }
  books = books.filter((b) => !done.has(b.id)).slice(0, LIMIT)
  console.log(`  checking ${books.length} rows against OpenLibrary (concurrency=${CONCURRENCY})…`)

  for (let i = 0; i < books.length; i += CONCURRENCY) {
    const batch = books.slice(i, i + CONCURRENCY)
    const res = await Promise.all(batch.map(verify))
    for (const v of res) {
      done.set(v.id, v)
      appendFileSync(CHECKPOINT, JSON.stringify(v) + '\n')
    }
    if ((i / CONCURRENCY) % 10 === 0 || i + CONCURRENCY >= books.length) {
      process.stdout.write(`\r  checked ${Math.min(i + CONCURRENCY, books.length)}/${books.length}`)
    }
    await sleep(300)
  }
  process.stdout.write('\n')

  const all = [...done.values()].sort((a, b) => a.id - b.id)
  const by = (bucket: Verdict['bucket']) => all.filter((v) => v.bucket === bucket)
  const correct = by('confirmed_correct')
  const highconf = by('wrong_highconf').sort((a, b) => (a.ol_year! - b.ol_year!))
  const review = by('wrong_review').sort((a, b) => (a.ol_year! - b.ol_year!))
  const unverified = by('unverified')
  const impossible = (v: Verdict) => v.min_ban_year != null && v.min_ban_year < v.db_year

  writeFileSync('data/pen-stamped-years-audit.json', JSON.stringify(all, null, 2))

  const fixes = highconf.map((v) => ({
    id: v.id, slug: v.slug, title: v.title,
    first_published_year: v.db_year, ol_year: v.ol_year,
  }))
  writeFileSync('data/publication-year-fixes-highconf.json', JSON.stringify(fixes, null, 2))

  const md: string[] = []
  md.push(`# PEN stamped-years audit — first_published_year ∈ {${YEARS.join(', ')}} vs OpenLibrary`)
  md.push(``)
  md.push(`Bron van de fout: \`import-pen.ts\` regel 604 — \`first_published_year: ol.publishYear ?? ev.year ?? null\`:`)
  md.push(`bij een lege OpenLibrary-lookup werd het BAN-jaar als publicatiejaar gestempeld (batch 2026-05-02/03).`)
  md.push(``)
  md.push(`- Gecheckt: **${all.length}** rijen`)
  md.push(`- Bevestigd correct (OL == DB): **${correct.length}**`)
  md.push(`- **FOUT, high-conf (work/isbn-tier): ${highconf.length}** → \`data/publication-year-fixes-highconf.json\``)
  md.push(`- Fout, review-tier (vrije zoek): ${review.length}`)
  md.push(`- Onverifieerbaar (watchlist): ${unverified.length} — waarvan ${unverified.filter(impossible).length} intern onmogelijk (ban vóór pub-jaar)`)
  md.push(``)
  const table = (rows: Verdict[]) => {
    md.push(`| id | slug | DB | OL | tier | ban≥ | title | author |`)
    md.push(`|----|------|---:|---:|------|-----:|-------|--------|`)
    for (const v of rows) {
      md.push(`| ${v.id} | ${v.slug} | ${v.db_year} | ${v.ol_year ?? ''} | ${v.tier ?? ''} | ${v.min_ban_year ?? ''} | ${v.title.replace(/\|/g, '\\|')} | ${v.authors.join('; ').replace(/\|/g, '\\|')} |`)
    }
  }
  md.push(`## Fout — high-conf (fix-kandidaten)`)
  md.push(``)
  table(highconf)
  md.push(``)
  md.push(`## Fout — review-tier (niet auto-appliën)`)
  md.push(``)
  table(review)
  md.push(``)
  md.push(`## Onverifieerbaar & intern onmogelijk (ban vóór DB-pubjaar)`)
  md.push(``)
  table(unverified.filter(impossible))
  writeFileSync('data/pen-stamped-years-audit.md', md.join('\n'))

  console.log(`\nSummary:`)
  console.log(`  checked           : ${all.length}`)
  console.log(`  confirmed correct : ${correct.length}`)
  console.log(`  WRONG high-conf   : ${highconf.length}`)
  console.log(`  wrong review-tier : ${review.length}`)
  console.log(`  unverified        : ${unverified.length} (impossible: ${unverified.filter(impossible).length})`)
  console.log(`\nWrote data/pen-stamped-years-audit.{json,md} + data/publication-year-fixes-highconf.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
