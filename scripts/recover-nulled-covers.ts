#!/usr/bin/env tsx
/**
 * Recover covers for books whose contaminated cover was NULLed by
 * scripts/audit-covers-vision.ts (cover_url NULL + cover_status
 * 'rejected_placeholder'). The audit only tried the OL search's work-level
 * cover_i; this pass digs deeper — work cover, then that work's edition covers,
 * then the ISBN cover — and keeps the SAME safety gates so we never re-introduce
 * a wrong cover:
 *   - the OL work must author-match (search doc author overlaps ours), and
 *   - every candidate image is vision-verified (gpt-4o-mini) before use.
 * First looks_right candidate wins → cover_url set, cover_status 'valid'.
 * Nothing found → left as-is (stays nulled).
 *
 * Read-only unless --apply. Resumable via JSONL checkpoint.
 *
 * --scan-rejected targets the LIVE population instead of the frozen audit list:
 * every book with cover_status='rejected_placeholder' + cover_url NULL that has
 * an openlibrary_work_id or isbn13. These were marked by enrich-covers-v2 (which
 * only tries GB-by-ISBN + title-search + Wikipedia and never looks at the stored
 * work-id editions), so their real OL edition cover was never seen. This mode
 * uses the stored openlibrary_work_id to pull edition covers DIRECTLY — no
 * ambiguous title-search — and keeps the same vision gate. Separate checkpoint
 * so it never collides with the audit-based run.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/recover-nulled-covers.ts --dry-run --limit=25
 *   npx tsx --env-file=.env.local scripts/recover-nulled-covers.ts --apply
 *   npx tsx --env-file=.env.local scripts/recover-nulled-covers.ts --scan-rejected --dry-run --limit=25
 *   npx tsx --env-file=.env.local scripts/recover-nulled-covers.ts --scan-rejected --apply
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs'
import { adminClient } from '../src/lib/supabase'
import { openaiCoverSecondOpinion } from '../src/lib/enrich/openai-cover-second-opinion'
import { authorsAgree } from '../src/lib/enrich/title-match'

const APPLY = process.argv.includes('--apply')
const SCAN_REJECTED = process.argv.includes('--scan-rejected')
const LIMIT = (() => { const a = process.argv.find(x => x.startsWith('--limit=')); return a ? parseInt(a.split('=')[1], 10) : Infinity })()
const CONCURRENCY = 4
const CKPT = SCAN_REJECTED ? 'data/cover-recovery-rejected.jsonl' : 'data/cover-recovery.jsonl'
const OUT = SCAN_REJECTED ? 'data/cover-recovery-rejected' : 'data/cover-recovery'
const UA = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }

type Book = { id: number; slug: string; title: string; title_native: string | null; year: number | null; isbn13: string | null; author: string | null; wid: string | null }
type Result = Book & { action: 'recovered' | 'still_none' | 'error'; new_cover: string | null; note: string }

async function imageBig(url: string): Promise<boolean> {
  try { const r = await fetch(url, { method: 'HEAD' }); return r.ok && Number(r.headers.get('content-length') || 0) > 2000 } catch { return false }
}

// All cover ids on a work's editions (the right cover is often not covers[0]).
async function editionCoverIds(workKey: string): Promise<number[]> {
  try {
    const er = await fetch(`https://openlibrary.org${workKey}/editions.json?limit=50`, { headers: UA })
    if (!er.ok) return []
    const ed: any = await er.json()
    const ids: number[] = []
    for (const e of ed.entries ?? []) for (const c of (e.covers ?? [])) if (c && c > 0) ids.push(c)
    return ids
  } catch { return [] }
}

// Ordered candidate cover URLs. The stored openlibrary_work_id is OUR canonical
// link, so its editions are tried first (no title-search ambiguity); the
// title-search-by-author path is the fallback when no work-id is stored.
async function candidates(b: Book): Promise<string[]> {
  const urls: string[] = []
  // (a) ISBN-direct cover (the ISBN binds the edition)
  if (b.isbn13 && await imageBig(`https://covers.openlibrary.org/b/isbn/${b.isbn13}-L.jpg?default=false`)) {
    urls.push(`https://covers.openlibrary.org/b/isbn/${b.isbn13}-L.jpg`)
  }
  // (b) stored work-id → its editions' covers, directly (no title search)
  if (b.wid) {
    for (const c of await editionCoverIds(`/works/${b.wid}`)) urls.push(`https://covers.openlibrary.org/b/id/${c}-L.jpg`)
  }
  // (c) fallback: author-matched work from title search (for books without a wid)
  if (!b.wid) {
    const p = new URLSearchParams({ title: b.title, fields: 'key,cover_i,author_name', limit: '5' })
    if (b.author) p.set('author', b.author)
    try {
      const r = await fetch(`https://openlibrary.org/search.json?${p}`, { headers: UA })
      if (r.ok) {
        const j: any = await r.json()
        const authorLc = (b.author ?? '').toLowerCase()
        const doc = (j.docs ?? []).find((d: any) => {
          if (!authorLc) return true
          return authorsAgree(b.author!, d.author_name ?? [])
        })
        if (doc) {
          if (doc.cover_i) urls.push(`https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`)
          for (const c of await editionCoverIds(doc.key)) urls.push(`https://covers.openlibrary.org/b/id/${c}-L.jpg`)
        }
      }
    } catch { /* ignore */ }
  }
  return [...new Set(urls)].slice(0, 8) // dedupe, cap vision calls
}

async function processBook(sb: ReturnType<typeof adminClient>, b: Book): Promise<Result> {
  let cands: string[]
  try { cands = await candidates(b) } catch (e) { return { ...b, action: 'error', new_cover: null, note: e instanceof Error ? e.message : 'candidate error' } }
  for (const url of cands) {
    let op
    try { op = await openaiCoverSecondOpinion({ imageUrl: url, title: b.title, titleNative: b.title_native, author: b.author, year: b.year }) }
    catch { continue }
    if (op.verdict === 'looks_right') {
      if (APPLY) {
        const { data: c } = await sb.from('books').select('cover_url').eq('id', b.id).maybeSingle()
        if (c && c.cover_url === null) {
          const { error } = await sb.from('books').update({ cover_url: url, cover_status: 'valid', cover_checked_at: new Date().toISOString() }).eq('id', b.id)
          if (error) return { ...b, action: 'error', new_cover: url, note: `update failed: ${error.message}` }
        } else {
          return { ...b, action: 'still_none', new_cover: url, note: 'cover no longer null; skipped' }
        }
      }
      return { ...b, action: 'recovered', new_cover: url, note: `vision-confirmed ${url.includes('/isbn/') ? 'ISBN' : 'OL'} cover` }
    }
  }
  return { ...b, action: 'still_none', new_cover: null, note: `${cands.length} candidate(s), none vision-confirmed` }
}

function loadProcessed(): { ids: Set<number>; rows: Result[] } {
  const ids = new Set<number>(); const rows: Result[] = []
  if (!existsSync(CKPT)) return { ids, rows }
  for (const line of readFileSync(CKPT, 'utf8').split('\n')) { if (!line.trim()) continue; try { const r = JSON.parse(line) as Result; ids.add(r.id); rows.push(r) } catch { /**/ } }
  return { ids, rows }
}

// Page through every rejected_placeholder book with a recoverable key
// (work-id or isbn13) and a null cover. Ordered by id so .range() never
// duplicates rows once the table exceeds the page size.
async function liveRejectedIds(sb: ReturnType<typeof adminClient>): Promise<number[]> {
  const ids: number[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('books')
      .select('id')
      .eq('cover_status', 'rejected_placeholder')
      .is('cover_url', null)
      .or('openlibrary_work_id.not.is.null,isbn13.not.is.null')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    ids.push(...data.map(r => r.id))
    if (data.length < PAGE) break
  }
  return ids
}

async function main() {
  const sb = adminClient()
  // target = live rejected_placeholder population, or the frozen audit list
  const sourceIds: number[] = SCAN_REJECTED
    ? await liveRejectedIds(sb)
    : (existsSync('data/cover-vision-audit.json')
        ? (JSON.parse(readFileSync('data/cover-vision-audit.json', 'utf8')) as any[]).filter(r => r.action === 'nulled').map(r => r.id)
        : [])
  const { ids: processedIds, rows: priorRows } = APPLY ? loadProcessed() : { ids: new Set<number>(), rows: [] as Result[] }
  const toFetch = sourceIds.filter(id => !processedIds.has(id))
  console.log(`Source (${SCAN_REJECTED ? 'live rejected_placeholder' : 'nulled-by-audit'}): ${sourceIds.length}  already-checkpointed: ${processedIds.size}  remaining: ${toFetch.length}`)

  // hydrate book rows
  const books: Book[] = []
  for (let i = 0; i < toFetch.length; i += 300) {
    const slice = toFetch.slice(i, i + 300)
    const { data } = await sb.from('books').select('id, slug, title, title_native, first_published_year, isbn13, openlibrary_work_id, cover_url, book_authors(authors(display_name))').in('id', slice)
    for (const b of (data ?? []) as any[]) {
      if (b.cover_url !== null) continue // already has a cover again — skip
      books.push({ id: b.id, slug: b.slug, title: b.title, title_native: b.title_native, year: b.first_published_year, isbn13: b.isbn13, wid: b.openlibrary_work_id ?? null, author: b.book_authors?.[0]?.authors?.display_name ?? null })
    }
  }
  let targets = books
  if (LIMIT !== Infinity) { targets = targets.slice(0, LIMIT); console.log(`--limit ${LIMIT}`) }
  console.log(`Processing ${targets.length}. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)

  const fresh: Result[] = []; let done = 0
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const res = await Promise.all(targets.slice(i, i + CONCURRENCY).map(b => processBook(sb, b)))
    fresh.push(...res)
    if (APPLY) appendFileSync(CKPT, res.map(r => JSON.stringify(r)).join('\n') + '\n')
    done += res.length
    for (const r of res) if (r.action === 'recovered') console.log(`  ${APPLY ? '✓' : '•'} #${r.id} ${r.title} — ${r.note}`)
    if (done % 80 === 0 || done === targets.length) process.stdout.write(`\r  processed ${done}/${targets.length}\n`)
  }

  const results = [...priorRows, ...fresh]
  const by = (a: Result['action']) => results.filter(r => r.action === a)
  writeFileSync(`${OUT}.json`, JSON.stringify(results, null, 2))
  const md = [`# Nulled-cover recovery (OL deep search + vision)`, ``,
    `- Processed: ${results.length}`, `- **Recovered: ${by('recovered').length}**`,
    `- Still none: ${by('still_none').length}`, `- Errors: ${by('error').length}`, ``,
    `## Recovered (${by('recovered').length})`, ``, `| id | slug | title | author | new_cover |`, `|----|------|-------|--------|-----------|`,
    ...by('recovered').map(r => `| ${r.id} | ${r.slug} | ${r.title.replace(/\|/g, '\\|')} | ${(r.author ?? '').replace(/\|/g, '\\|')} | ${r.new_cover} |`)]
  writeFileSync(`${OUT}.md`, md.join('\n'))
  console.log(`\nSummary: recovered=${by('recovered').length} still_none=${by('still_none').length} error=${by('error').length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
