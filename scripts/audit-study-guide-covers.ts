/**
 * Audit OpenLibrary covers for study-guide / SparkNotes-type editions.
 *
 * Background: OpenLibrary sometimes serves a study-guide edition (SparkNotes,
 * CliffsNotes, "Parcours de lecture", Königs Erläuterungen, …) as a work's
 * default cover. Those covers display the guide branding, not the novel.
 *
 * Detection (no LLM, no DB writes): for every book whose cover_url points at
 * covers.openlibrary.org (excluding manual_override), extract the cover id and
 * reverse-look-up the OWNING work via
 *   https://openlibrary.org/search.json?q=cover_i:<id>
 * which returns that work's title + publisher list. We then flag the cover when
 * the title or publisher matches a study-guide marker.
 *
 * Output: a markdown report at data/cover-study-guide-audit-<YYYY-MM-DD>.md with
 * HIGH-confidence and LOW-confidence (publisher-only / unresolved) sections,
 * including a thumbnail URL so you can eyeball each one. Nothing is written to
 * the DB — fixing is a separate manual/pin step.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-study-guide-covers.ts
 *   npx tsx --env-file=.env.local scripts/audit-study-guide-covers.ts --limit=500
 *   npx tsx --env-file=.env.local scripts/audit-study-guide-covers.ts --batch=40 --delay=300
 */

import { adminClient } from '../src/lib/supabase'
import fs from 'node:fs'
import path from 'node:path'

const limitArg = process.argv.find(a => a.startsWith('--limit='))
const batchArg = process.argv.find(a => a.startsWith('--batch='))
const delayArg = process.argv.find(a => a.startsWith('--delay='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity
const BATCH = batchArg ? parseInt(batchArg.split('=')[1], 10) : 40
const DELAY_MS = delayArg ? parseInt(delayArg.split('=')[1], 10) : 250

// High-confidence: these strings, in a TITLE, almost always mean a study guide.
// (Deliberately excludes broad words like "understanding"/"a guide to" that can
// appear in a real book's own title and thus produce false positives.)
const TITLE_MARKERS = [
  'sparknotes', 'spark notes', 'cliffsnotes', "cliff's notes", 'cliffs notes',
  'study guide', 'literature guide', 'parcours de lecture', "profil d'une",
  'fiche de lecture', "analyse de l'oeuvre", "analyse de l'œuvre",
  'lektüreschlüssel', 'königs erläuterungen', 'konigs erlauterungen',
  'erläuterungen', 'summary and analysis', 'summary & analysis',
  'monarch notes', 'maxnotes', 'bright notes', 'gradesaver', 'bookrags',
]

// High-confidence study-guide PUBLISHERS (unambiguous brands).
const PUBLISHER_MARKERS_HIGH = [
  'spark publishing', 'sparknotes', 'cliffs notes', 'cliffsnotes',
  'monarch notes', 'monarch press', 'maxnotes', 'bright notes',
  'research & education association', 'bertrand-lacoste', 'gradesaver',
  'bookrags', 'saddleback educational', 'bright summaries', 'shmoop',
]

// Lower-confidence publishers — also print real editions. Only meaningful when
// the owning work's publisher list is SHORT (a mega-work real novel carries a
// long list where one of these appears incidentally → false positive).
const PUBLISHER_MARKERS_LOW = [
  "barron's", 'hatier', 'königs', 'konigs', 'reclam', 'klett', 'coles notes',
  'éditions ellipses', 'studienhilfe', 'lernhilfe', 'lektürehilfe',
]
const LOW_MAX_PUBLISHERS = 3

type Book = { id: number; slug: string; title: string; cover_url: string }
type WorkMeta = { title: string; publisher: string[] }

function coverIdFromUrl(url: string): string | null {
  const m = url.match(/\/b\/id\/(\d+)/)
  return m ? m[1] : null
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function fetchBatch(ids: string[]): Promise<Map<string, WorkMeta>> {
  const q = ids.map(id => `cover_i:${id}`).join(' OR ')
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=title,publisher,cover_i&limit=${ids.length}`
  const out = new Map<string, WorkMeta>()
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'banned-books.org cover audit (ludo.raedts@voys.nl)' } })
    if (!res.ok) { console.error(`  batch HTTP ${res.status}`); return out }
    const json = await res.json() as { docs?: { cover_i?: number; title?: string; publisher?: string[] }[] }
    for (const d of json.docs ?? []) {
      if (d.cover_i == null) continue
      out.set(String(d.cover_i), { title: d.title ?? '', publisher: d.publisher ?? [] })
    }
  } catch (e) {
    console.error(`  batch error: ${(e as Error).message}`)
  }
  return out
}

function classify(meta: WorkMeta | undefined): { level: 'high' | 'low' | 'clean' | 'unresolved'; reason: string } {
  if (!meta) return { level: 'unresolved', reason: 'cover_i not found on OpenLibrary' }
  const title = meta.title.toLowerCase()
  const pubs = meta.publisher.map(p => p.toLowerCase())

  const titleHit = TITLE_MARKERS.find(m => title.includes(m))
  if (titleHit) return { level: 'high', reason: `title contains "${titleHit}"` }

  const pubHigh = PUBLISHER_MARKERS_HIGH.find(m => pubs.some(p => p.includes(m)))
  if (pubHigh) return { level: 'high', reason: `publisher "${pubHigh}"` }

  const pubLow = PUBLISHER_MARKERS_LOW.find(m => pubs.some(p => p.includes(m)))
  if (pubLow && pubs.length <= LOW_MAX_PUBLISHERS) {
    return { level: 'low', reason: `publisher "${pubLow}" (only ${pubs.length} publisher(s) on owning work)` }
  }

  return { level: 'clean', reason: '' }
}

async function main() {
  const supabase = adminClient()

  // Page through all OL-hosted covers (excluding manual_override).
  const PAGE = 1000
  const books: Book[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, cover_url, cover_status')
      .not('cover_url', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data || data.length === 0) break
    for (const b of data) {
      // NB: filter manual_override in JS — a PostgREST .neq() would also drop
      // the many cover_status=NULL rows (NULL <> 'x' is NULL, not TRUE).
      if (b.cover_status === 'manual_override') continue
      if (b.cover_url && /covers\.openlibrary\.org/.test(b.cover_url)) {
        books.push({ id: b.id, slug: b.slug, title: b.title, cover_url: b.cover_url })
      }
    }
    if (data.length < PAGE) break
  }

  const scoped = books.slice(0, LIMIT)
  console.log(`\n── audit-study-guide-covers ──`)
  console.log(`OpenLibrary covers to check: ${scoped.length} (batch=${BATCH}, delay=${DELAY_MS}ms)`)

  // Map book → cover id; skip URLs we can't parse a cover id from.
  const withId = scoped.map(b => ({ b, coverId: coverIdFromUrl(b.cover_url) })).filter(x => x.coverId) as { b: Book; coverId: string }[]
  const uniqueIds = [...new Set(withId.map(x => x.coverId))]
  console.log(`Unique cover ids: ${uniqueIds.length}`)

  const meta = new Map<string, WorkMeta>()
  const totalBatches = Math.ceil(uniqueIds.length / BATCH)
  for (let i = 0; i < uniqueIds.length; i += BATCH) {
    const slice = uniqueIds.slice(i, i + BATCH)
    const got = await fetchBatch(slice)
    for (const [k, v] of got) meta.set(k, v)
    const n = Math.floor(i / BATCH) + 1
    if (n % 10 === 0 || n === totalBatches) console.log(`  batch ${n}/${totalBatches} (resolved ${meta.size}/${uniqueIds.length})`)
    await sleep(DELAY_MS)
  }

  const high: { b: Book; coverId: string; m: WorkMeta; reason: string }[] = []
  const low: { b: Book; coverId: string; m: WorkMeta; reason: string }[] = []
  const unresolved: { b: Book; coverId: string }[] = []

  for (const { b, coverId } of withId) {
    const m = meta.get(coverId)
    const c = classify(m)
    if (c.level === 'high') high.push({ b, coverId, m: m!, reason: c.reason })
    else if (c.level === 'low') low.push({ b, coverId, m: m!, reason: c.reason })
    else if (c.level === 'unresolved') unresolved.push({ b, coverId })
  }

  high.sort((a, z) => a.b.title.localeCompare(z.b.title))
  low.sort((a, z) => a.b.title.localeCompare(z.b.title))

  const today = new Date().toISOString().slice(0, 10)
  const outPath = path.join('data', `cover-study-guide-audit-${today}.md`)
  const L: string[] = []
  L.push(`# Study-guide cover audit — ${today}`)
  L.push('')
  L.push(`Checked **${withId.length}** OpenLibrary covers. Reverse-looked-up the owning work's title + publisher via OpenLibrary search.`)
  L.push('')
  L.push(`- 🔴 HIGH confidence (likely study-guide cover): **${high.length}**`)
  L.push(`- 🟡 LOW confidence (suspicious publisher, also prints real editions — eyeball): **${low.length}**`)
  L.push(`- ⚪ Unresolved cover ids (not on OpenLibrary search): **${unresolved.length}**`)
  L.push('')
  L.push(`Fix a flagged book by pinning a proper cover (same flow as The Handmaid's Tale): set cover_url + cover_status='manual_override'.`)
  L.push('')

  const row = (x: { b: Book; coverId: string; m: WorkMeta; reason: string }) =>
    `| [${x.b.title}](https://banned-books.org/books/${x.b.slug}) | \`${x.b.slug}\` | ${x.coverId} | ${x.reason} | ${x.m.title.replace(/\|/g, '\\|')} | ${(x.m.publisher.slice(0, 3).join('; ') || '—').replace(/\|/g, '\\|')} | [img](https://covers.openlibrary.org/b/id/${x.coverId}-M.jpg) |`

  L.push(`## 🔴 HIGH confidence (${high.length})`)
  L.push('')
  if (high.length) {
    L.push('| Book | slug | cover_i | reason | owning-work title | publisher | thumb |')
    L.push('|------|------|---------|--------|-------------------|-----------|-------|')
    for (const x of high) L.push(row(x))
  } else L.push('_none_')
  L.push('')

  L.push(`## 🟡 LOW confidence (${low.length})`)
  L.push('')
  if (low.length) {
    L.push('| Book | slug | cover_i | reason | owning-work title | publisher | thumb |')
    L.push('|------|------|---------|--------|-------------------|-----------|-------|')
    for (const x of low) L.push(row(x))
  } else L.push('_none_')
  L.push('')

  L.push(`## ⚪ Unresolved (${unresolved.length})`)
  L.push('')
  L.push('_cover id returned no work on OpenLibrary search — could be deleted/merged; not necessarily a study guide._')
  L.push('')
  if (unresolved.length) {
    L.push('| Book | slug | cover_i |')
    L.push('|------|------|---------|')
    for (const x of unresolved.slice(0, 200)) L.push(`| ${x.b.title} | \`${x.b.slug}\` | ${x.coverId} |`)
    if (unresolved.length > 200) L.push(`| … +${unresolved.length - 200} more | | |`)
  }
  L.push('')

  fs.mkdirSync('data', { recursive: true })
  fs.writeFileSync(outPath, L.join('\n'))

  console.log(`\n── results ──`)
  console.log(`  🔴 HIGH: ${high.length}`)
  console.log(`  🟡 LOW:  ${low.length}`)
  console.log(`  ⚪ unresolved: ${unresolved.length}`)
  console.log(`\nReport: ${outPath}`)
  if (high.length) {
    console.log(`\nTop HIGH-confidence hits:`)
    for (const x of high.slice(0, 25)) {
      console.log(`  • ${x.b.title}  (${x.b.slug})  — ${x.reason}  [${x.m.title}]`)
    }
  }
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
