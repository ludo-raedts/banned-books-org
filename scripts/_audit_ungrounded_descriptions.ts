/**
 * READ-ONLY dry run. Sizes the impact of re-grounding the highest-risk
 * ungrounded description_book rows (ai_drafted = true, no ISBN, no
 * description_source_type). For each, runs the same source ladder the v2
 * enrich pipeline uses (OpenLibrary search + English Wikipedia) and a
 * filler-tell heuristic, then classifies:
 *
 *   RESOLVES   — a real external source matches title+author → re-ground candidate
 *   NO-SOURCE  — nothing resolved → wipe candidate (set description_book = NULL)
 *   ERROR      — fetch failed after retries → unknown, excluded from decisions
 *
 * Writes a full per-book report to data/ungrounded-desc-dryrun.{md,jsonl}.
 * Does NOT modify the database.
 *
 * Run: npx tsx scripts/_audit_ungrounded_descriptions.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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

const UA = { headers: { 'User-Agent': 'banned-books.org desc-audit (ludo.raedts@voys.nl)' } }
const CONCURRENCY = 6

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[''’`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
const lastName = (a: string) => { const p = a.trim().split(/\s+/).filter(Boolean); return p.length ? p[p.length - 1] : '' }
function titleMatch(text: string, title: string, author: string): boolean {
  const n = norm(text), sur = norm(lastName(author))
  if (sur.length >= 3 && !n.includes(sur)) return false
  const ct = norm(title.replace(/\s*\([^)]*\)\s*$/, '').split(/[,;:]/)[0])
  if (ct.length >= 4 && n.includes(ct)) return true
  const fw = ct.split(/\s+/).find((w) => w.length >= 5)
  return !!(fw && n.includes(fw))
}
const FILLERS = ['navigating the complexities', 'explores themes of', 'delves into themes', 'its significance lies', 'a poignant', 'coming-of-age', 'the human condition', 'love, loss', 'tells the story of a', 'set against the backdrop', 'rich tapestry', 'powerful narrative', 'resonates with readers', 'thought-provoking', 'intricacies of', 'societal expectations', 'self-discovery', 'the pursuit of', 'moral ambiguity', 'vivid portrayal', 'timeless', 'captivating', 'the complexities of']
const fillerHits = (d: string) => { const dl = d.toLowerCase(); return FILLERS.filter((f) => dl.includes(f)).length }

async function fetchRetry(url: string, tries = 3): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController()
      const to = setTimeout(() => ctrl.abort(), 12000)
      const r = await fetch(url, { ...UA, signal: ctrl.signal })
      clearTimeout(to)
      if (r.status === 429) { await new Promise((res) => setTimeout(res, 1500 * (i + 1))); continue }
      return r
    } catch { await new Promise((res) => setTimeout(res, 600 * (i + 1))) }
  }
  return null
}
async function olSearch(title: string, author: string): Promise<boolean | null> {
  const r = await fetchRetry(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=5&fields=title,author_name`)
  if (!r) return null
  if (!r.ok) return false
  try {
    const j: any = await r.json()
    for (const d of j.docs || []) {
      if (titleMatch(`${d.title} ${(d.author_name || []).join(' ')}`, title, author)) return true
    }
    return false
  } catch { return null }
}
async function wiki(title: string, author: string): Promise<boolean | null> {
  const r = await fetchRetry(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
  if (!r) return null
  if (!r.ok) return false
  try {
    const j: any = await r.json()
    if (j.type === 'disambiguation') return false
    return titleMatch(`${j.title} ${j.extract || ''}`, title, author)
  } catch { return null }
}

type Row = { id: number; title: string; description_book: string; first_published_year: number | null; author: string }
type Result = Row & { resolves: boolean; via: string; filler: number; error: boolean }

async function pool<T, R>(items: T[], n: number, fn: (it: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length) as R[]
  let idx = 0
  async function worker() {
    while (true) {
      const i = idx++
      if (i >= items.length) return
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: n }, worker))
  return out
}

async function main() {
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  // Page through the high-risk bucket, pulling author via embed.
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('books')
      .select('id, title, description_book, first_published_year, book_authors(authors(display_name))')
      .eq('ai_drafted', true)
      .is('isbn13', null)
      .is('description_source_type', null)
      .not('description_book', 'is', null)
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    if (!data || !data.length) break
    for (const b of data as any[]) {
      rows.push({
        id: b.id,
        title: b.title,
        description_book: b.description_book,
        first_published_year: b.first_published_year,
        author: b.book_authors?.[0]?.authors?.display_name || '',
      })
    }
    if (data.length < 1000) break
  }
  console.log(`high-risk bucket: ${rows.length} rows. resolving sources (concurrency ${CONCURRENCY})...`)

  let done = 0
  const results = await pool<Row, Result>(rows, CONCURRENCY, async (r) => {
    let resolves = false, via = '', error = false
    const a = await olSearch(r.title, r.author)
    if (a === true) { resolves = true; via = 'OL-search' }
    else if (a === null) error = true
    if (!resolves && r.author) {
      const w = await wiki(r.title, r.author)
      if (w === true) { resolves = true; via = 'wiki' }
      else if (w === null && a !== false) error = true
    }
    done++
    if (done % 250 === 0) console.log(`  ...${done}/${rows.length}`)
    return { ...r, resolves, via, filler: fillerHits(r.description_book), error }
  })

  const resolved = results.filter((r) => r.resolves)
  const errored = results.filter((r) => !r.resolves && r.error)
  const noSource = results.filter((r) => !r.resolves && !r.error)
  const noSrcHeavyFiller = noSource.filter((r) => r.filler >= 2)

  // Full report
  const jsonl = results.map((r) => JSON.stringify({
    id: r.id, title: r.title, author: r.author, year: r.first_published_year,
    decision: r.resolves ? 'REGROUND' : r.error ? 'ERROR' : 'WIPE',
    via: r.via, filler: r.filler,
  })).join('\n')
  writeFileSync(join(process.cwd(), 'data/ungrounded-desc-dryrun.jsonl'), jsonl + '\n')

  const md: string[] = []
  md.push('# Ungrounded description_book dry-run')
  md.push('')
  md.push(`Scope: ai_drafted = true, no ISBN, no description_source_type, description_book not null.`)
  md.push('')
  md.push(`- Total high-risk rows: **${results.length}**`)
  md.push(`- RESOLVES (re-ground candidate): **${resolved.length}**`)
  md.push(`- NO-SOURCE (wipe candidate): **${noSource.length}**`)
  md.push(`  - of which heavy filler (≥2 tells): **${noSrcHeavyFiller.length}**`)
  md.push(`- ERROR (fetch failed, excluded): **${errored.length}**`)
  md.push('')
  md.push('## Sample of WIPE candidates (first 40)')
  md.push('')
  for (const r of noSource.slice(0, 40)) {
    md.push(`- #${r.id} **${r.title}**${r.author ? ' — ' + r.author : ''} (filler:${r.filler})`)
    md.push(`  > ${r.description_book.slice(0, 160).replace(/\n/g, ' ')}`)
  }
  writeFileSync(join(process.cwd(), 'data/ungrounded-desc-dryrun.md'), md.join('\n') + '\n')

  console.log('\n=== DRY RUN SUMMARY ===')
  console.log(`total high-risk:                ${results.length}`)
  console.log(`RESOLVES (re-ground):           ${resolved.length}`)
  console.log(`NO-SOURCE (wipe candidate):     ${noSource.length}`)
  console.log(`  of which heavy filler:        ${noSrcHeavyFiller.length}`)
  console.log(`ERROR (excluded):               ${errored.length}`)
  console.log(`\nReport: data/ungrounded-desc-dryrun.md  +  .jsonl`)
}

main().catch((e) => { console.error(e); process.exit(1) })
