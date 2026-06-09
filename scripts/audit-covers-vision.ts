#!/usr/bin/env tsx
/**
 * Vision audit + auto-remediation for title-search-contaminated covers.
 *
 * Background: covers sourced via a Google Books *title* search (cover_url on
 * books.google.com) were sometimes matched to the WRONG book (e.g. "The Future
 * of Us" → a 1899 scan of "The Future of the American Negro") or to an interior
 * page (title page / review excerpt) instead of a real cover.
 *
 * For each targeted book:
 *   1. Vision-verify the CURRENT cover with openaiCoverSecondOpinion
 *      (gpt-4o-mini looks at the pixels + metadata).
 *      - looks_right / unsure  → keep (no change).
 *      - wrong_book / not_a_cover / unreadable → remediate:
 *   2. Remediate: OpenLibrary search by title+author → take the matched work's
 *      cover (author must match), vision-verify THAT candidate.
 *      - candidate looks_right → replace cover_url with the OL cover.
 *      - no good candidate → NULL the cover_url and set
 *        cover_status='rejected_placeholder' so the enrich query skips it
 *        (a wrong-book cover is worse than no cover).
 *
 * Read-only unless --apply. Resumable via JSONL checkpoint (the run is long and
 * the app restarts kill background jobs).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-covers-vision.ts --dry-run --limit=30
 *   npx tsx --env-file=.env.local scripts/audit-covers-vision.ts --apply
 *   (default host filter: books.google.com — pass --all to check every cover)
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs'
import { adminClient } from '../src/lib/supabase'
import { openaiCoverSecondOpinion } from '../src/lib/enrich/openai-cover-second-opinion'

const APPLY = process.argv.includes('--apply')
const ALL = process.argv.includes('--all')
const LIMIT = (() => { const a = process.argv.find(x => x.startsWith('--limit=')); return a ? parseInt(a.split('=')[1], 10) : Infinity })()
const CONCURRENCY = 4
const CKPT = 'data/cover-vision-audit.jsonl'

type Book = { id: number; slug: string; title: string; title_native: string | null; year: number | null; cover_url: string; cover_status: string | null; author: string | null }
type Result = Book & {
  verdict: string
  action: 'kept' | 'replaced' | 'nulled' | 'error'
  new_cover: string | null
  note: string
}

async function olCandidate(b: Book): Promise<{ url: string; coverId: number } | null> {
  const params = new URLSearchParams({ title: b.title, fields: 'key,cover_i,author_name', limit: '5' })
  if (b.author) params.set('author', b.author)
  try {
    const r = await fetch(`https://openlibrary.org/search.json?${params}`)
    if (!r.ok) return null
    const j: any = await r.json()
    const docs: { cover_i?: number; author_name?: string[] }[] = j.docs ?? []
    const authorLc = (b.author ?? '').toLowerCase()
    for (const d of docs) {
      if (!d.cover_i) continue
      // require author agreement when we have an author
      if (authorLc) {
        const names = (d.author_name ?? []).map(n => n.toLowerCase())
        const ok = names.some(n => n.includes(authorLc) || authorLc.includes(n))
        if (!ok) continue
      }
      return { url: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`, coverId: d.cover_i }
    }
  } catch { /* ignore */ }
  return null
}

async function processBook(sb: ReturnType<typeof adminClient>, b: Book): Promise<Result> {
  let cur
  try {
    cur = await openaiCoverSecondOpinion({ imageUrl: b.cover_url, title: b.title, titleNative: b.title_native, author: b.author, year: b.year })
  } catch (e) {
    return { ...b, verdict: 'error', action: 'error', new_cover: null, note: e instanceof Error ? e.message : 'vision error' }
  }
  if (cur.verdict === 'looks_right' || cur.verdict === 'unsure') {
    return { ...b, verdict: cur.verdict, action: 'kept', new_cover: null, note: cur.reasoning }
  }

  // contaminated → try to find a correct replacement
  const cand = await olCandidate(b)
  if (cand) {
    let opinion
    try { opinion = await openaiCoverSecondOpinion({ imageUrl: cand.url, title: b.title, titleNative: b.title_native, author: b.author, year: b.year }) }
    catch { opinion = null }
    if (opinion && opinion.verdict === 'looks_right') {
      if (APPLY) {
        const { data: c } = await sb.from('books').select('cover_url').eq('id', b.id).maybeSingle()
        if (c && c.cover_url === b.cover_url) {
          const { error } = await sb.from('books').update({ cover_url: cand.url, cover_status: 'valid', cover_checked_at: new Date().toISOString() }).eq('id', b.id)
          if (error) return { ...b, verdict: cur.verdict, action: 'error', new_cover: cand.url, note: `replace failed: ${error.message}` }
        }
      }
      return { ...b, verdict: cur.verdict, action: 'replaced', new_cover: cand.url, note: `${cur.verdict} → OL cover ${cand.coverId} (vision-confirmed)` }
    }
  }
  // no good replacement → null the bad cover
  if (APPLY) {
    const { data: c } = await sb.from('books').select('cover_url').eq('id', b.id).maybeSingle()
    if (c && c.cover_url === b.cover_url) {
      const { error } = await sb.from('books').update({ cover_url: null, cover_status: 'rejected_placeholder', cover_checked_at: new Date().toISOString() }).eq('id', b.id)
      if (error) return { ...b, verdict: cur.verdict, action: 'error', new_cover: null, note: `null failed: ${error.message}` }
    }
  }
  return { ...b, verdict: cur.verdict, action: 'nulled', new_cover: null, note: `${cur.verdict}; no author-matched OL cover → nulled` }
}

function loadProcessed(): { ids: Set<number>; rows: Result[] } {
  const ids = new Set<number>(); const rows: Result[] = []
  if (!existsSync(CKPT)) return { ids, rows }
  for (const line of readFileSync(CKPT, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { const r = JSON.parse(line) as Result; ids.add(r.id); rows.push(r) } catch { /* partial */ }
  }
  return { ids, rows }
}

async function fetchTargets(skip: Set<number>): Promise<Book[]> {
  const sb = adminClient(); const PAGE = 1000; const out: Book[] = []
  for (let from = 0; ; from += PAGE) {
    let q = sb.from('books')
      .select('id, slug, title, title_native, first_published_year, cover_url, cover_status, book_authors(authors(display_name))')
      .not('cover_url', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (!ALL) q = q.ilike('cover_url', '%books.google.com%')
    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const b of data as any[]) {
      if (skip.has(b.id)) continue
      out.push({ id: b.id, slug: b.slug, title: b.title, title_native: b.title_native, year: b.first_published_year, cover_url: b.cover_url, cover_status: b.cover_status, author: b.book_authors?.[0]?.authors?.display_name ?? null })
    }
    if (data.length < PAGE) break
  }
  return out
}

async function main() {
  const sb = adminClient()
  const { ids: processedIds, rows: priorRows } = APPLY ? loadProcessed() : { ids: new Set<number>(), rows: [] as Result[] }
  let targets = await fetchTargets(processedIds)
  console.log(`Host filter: ${ALL ? 'ALL covers' : 'books.google.com only'}`)
  console.log(`Already checkpointed: ${processedIds.size}  Remaining targets: ${targets.length}`)
  if (LIMIT !== Infinity) { targets = targets.slice(0, LIMIT); console.log(`--limit ${LIMIT} → ${targets.length}`) }
  console.log(`Mode: ${APPLY ? 'APPLY (replaces/nulls bad covers)' : 'DRY-RUN'}\n`)

  const fresh: Result[] = []; let done = 0
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const res = await Promise.all(batch.map(b => processBook(sb, b)))
    fresh.push(...res)
    if (APPLY) appendFileSync(CKPT, res.map(r => JSON.stringify(r)).join('\n') + '\n')
    done += batch.length
    for (const r of res) if (r.action === 'replaced' || r.action === 'nulled') console.log(`  ${APPLY ? '✓' : '•'} [${r.action}] #${r.id} ${r.title} — ${r.note}`)
    if (done % 100 === 0 || done === targets.length) process.stdout.write(`\r  processed ${done}/${targets.length}\n`)
  }

  const results = [...priorRows, ...fresh]
  const by = (a: Result['action']) => results.filter(r => r.action === a)
  writeFileSync('data/cover-vision-audit.json', JSON.stringify(results, null, 2))
  const md: string[] = [`# Cover vision audit`, ``,
    `- Checked: ${results.length}`,
    `- Kept (looks_right/unsure): ${by('kept').length}`,
    `- **Replaced (bad → OL cover, vision-confirmed): ${by('replaced').length}**`,
    `- **Nulled (bad, no good replacement): ${by('nulled').length}**`,
    `- Errors: ${by('error').length}`, ``]
  for (const [label, key] of [['Replaced', 'replaced'], ['Nulled', 'nulled']] as const) {
    const rows = by(key as Result['action']); if (!rows.length) continue
    md.push(`## ${label} (${rows.length})`, ``, `| id | slug | verdict | title | author | note |`, `|----|------|---------|-------|--------|------|`)
    for (const r of rows) md.push(`| ${r.id} | ${r.slug} | ${r.verdict} | ${r.title.replace(/\|/g, '\\|')} | ${(r.author ?? '').replace(/\|/g, '\\|')} | ${r.note.replace(/\|/g, '\\|')} |`)
    md.push(``)
  }
  writeFileSync('data/cover-vision-audit.md', md.join('\n'))
  console.log(`\nSummary: kept=${by('kept').length} replaced=${by('replaced').length} nulled=${by('nulled').length} error=${by('error').length}`)
  console.log(`Wrote data/cover-vision-audit.json and .md`)
}

main().catch(e => { console.error(e); process.exit(1) })
