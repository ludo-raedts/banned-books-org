#!/usr/bin/env tsx
/**
 * MEASUREMENT ONLY — no DB writes.
 *
 * Tests an ISBN-first description resolver against two populations of
 * ISBN-bearing books:
 *   A) no synopsis at all (description_book IS NULL AND description IS NULL)
 *   B) ungrounded synopsis (description_book set, description_source_type NULL)
 *
 * For each book it tries:
 *   - OpenLibrary by ISBN:  /isbn/{isbn}.json -> works[0] -> /works/{id}.json
 *   - Google Books by ISBN: volumes?q=isbn:{isbn} -> volumeInfo.description
 *
 * Reports win-rate (≥1 source, ≥2 sources = cross-confirm) per group, plus a
 * reliability sanity check: does the returned text mention the author surname
 * or title head? A miss flags a possibly-wrong isbn13 in OUR data.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/_measure_isbn_description_winrate.ts --sample=150
 */
import { adminClient } from '../src/lib/supabase'

const sampleArg = process.argv.find(a => a.startsWith('--sample='))
const SAMPLE = sampleArg ? parseInt(sampleArg.split('=')[1]) : 150

const UA = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const MIN_DESC_CHARS = 80
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function normalise(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''’`]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}
function lastNameOf(a: string): string {
  const p = a.trim().split(/\s+/).filter(Boolean)
  return p.length ? p[p.length - 1] : ''
}
function titleHead(t: string): string {
  return normalise(t.replace(/\s*\([^)]*\)\s*$/g, '').split(/[,;:]/)[0])
}
/** soft reliability check — true if author surname OR title head appears */
function looksRelevant(text: string, title: string, author: string): boolean {
  const n = normalise(text)
  const sn = normalise(lastNameOf(author))
  const th = titleHead(title)
  if (sn.length >= 3 && n.includes(sn)) return true
  if (th.length >= 4 && n.includes(th)) return true
  return false
}

type Hit = { source: 'openlibrary' | 'google_books'; text: string; url: string }

function extractOlDesc(json: Record<string, unknown>): string | null {
  const raw = json.description
  if (!raw) return null
  if (typeof raw === 'string') return raw.trim() || null
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    const v = (raw as { value: unknown }).value
    return typeof v === 'string' ? v.trim() || null : null
  }
  return null
}

async function olByIsbn(isbn: string): Promise<Hit | null> {
  try {
    const r = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, { headers: UA, redirect: 'follow' })
    if (!r.ok) return null
    const ed = await r.json() as Record<string, unknown>
    // Edition itself sometimes carries a description.
    const edDesc = extractOlDesc(ed)
    if (edDesc && edDesc.length >= MIN_DESC_CHARS) {
      return { source: 'openlibrary', text: edDesc, url: `https://openlibrary.org/isbn/${isbn}` }
    }
    const works = ed.works as Array<{ key?: string }> | undefined
    const workKey = works?.[0]?.key // "/works/OL...W"
    if (!workKey) return null
    await sleep(250)
    const wr = await fetch(`https://openlibrary.org${workKey}.json`, { headers: UA })
    if (!wr.ok) return null
    const work = await wr.json() as Record<string, unknown>
    const wDesc = extractOlDesc(work)
    if (wDesc && wDesc.length >= MIN_DESC_CHARS) {
      return { source: 'openlibrary', text: wDesc, url: `https://openlibrary.org${workKey}` }
    }
    return null
  } catch { return null }
}

async function gbByIsbn(isbn: string): Promise<Hit | null> {
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
    if (!r.ok) return null
    const json = await r.json() as { items?: Array<{ id: string; volumeInfo: { description?: string; infoLink?: string } }> }
    for (const it of json.items ?? []) {
      const d = it.volumeInfo.description
      if (d && d.length >= MIN_DESC_CHARS) {
        return { source: 'google_books', text: d, url: it.volumeInfo.infoLink ?? `https://books.google.com/books?id=${it.id}` }
      }
    }
    return null
  } catch { return null }
}

type Book = {
  id: number; slug: string; title: string; isbn13: string
  book_authors: Array<{ authors: { display_name: string } | null }>
}

async function fetchGroup(which: 'no_synopsis' | 'ungrounded', limit: number): Promise<Book[]> {
  const sb = adminClient()
  const sel = 'id, slug, title, isbn13, description_book, description, description_source_type, book_authors(authors(display_name))'
  const out: Book[] = []
  let from = 0
  for (;;) {
    let q = sb.from('books').select(sel).not('isbn13', 'is', null)
      .eq('is_blanket_works', false).order('id', { ascending: true }).range(from, from + 999)
    const { data, error } = await q
    if (error) throw error
    if (!data || !data.length) break
    for (const b of data as any[]) {
      const hasSyn = (b.description_book && String(b.description_book).trim()) || (b.description && String(b.description).trim())
      if (which === 'no_synopsis' && !hasSyn) out.push(b)
      if (which === 'ungrounded' && hasSyn && !b.description_source_type) out.push(b)
      if (out.length >= limit) return out
    }
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

async function measure(label: string, books: Book[]) {
  let any = 0, both = 0, olOnly = 0, gbOnly = 0, none = 0, irrelevant = 0
  const samples: string[] = []
  let i = 0
  for (const b of books) {
    i++
    const author = b.book_authors?.[0]?.authors?.display_name ?? ''
    const ol = await olByIsbn(b.isbn13)
    await sleep(200)
    const gb = await gbByIsbn(b.isbn13)
    await sleep(150)
    const hits = [ol, gb].filter(Boolean) as Hit[]
    if (hits.length === 0) { none++; continue }
    any++
    if (ol && gb) both++
    else if (ol) olOnly++
    else gbOnly++
    // reliability: at least one hit should look relevant
    const relevant = hits.some(h => looksRelevant(h.text, b.title, author))
    if (!relevant) irrelevant++
    if (samples.length < 8) {
      const h = hits[0]
      samples.push(`  ${relevant ? '✓' : '⚠'} [${b.isbn13}] ${b.title.slice(0, 40)} — ${h.source}: ${h.text.slice(0, 110).replace(/\n/g, ' ')}…`)
    }
    if (i % 25 === 0) process.stdout.write(`    …${i}/${books.length}\n`)
  }
  const n = books.length
  const pct = (x: number) => n ? ((x / n) * 100).toFixed(1) : '0'
  console.log(`\n=== ${label}  (n=${n}) ===`)
  console.log(`  ≥1 source:        ${any} (${pct(any)}%)`)
  console.log(`    both OL+GB:     ${both} (${pct(both)}%)  ← cross-confirm → confident`)
  console.log(`    OL only:        ${olOnly}`)
  console.log(`    GB only:        ${gbOnly}`)
  console.log(`  no source:        ${none} (${pct(none)}%)`)
  console.log(`  ⚠ text didn't mention author/title (suspect isbn?): ${irrelevant}`)
  console.log(`  --- samples ---`)
  for (const s of samples) console.log(s)
}

async function main() {
  console.log(`ISBN-first description win-rate measurement (sample=${SAMPLE} per group)\n`)
  const noSyn = await fetchGroup('no_synopsis', SAMPLE)
  const ungrounded = await fetchGroup('ungrounded', SAMPLE)
  console.log(`Fetched: no_synopsis=${noSyn.length}, ungrounded=${ungrounded.length}`)
  await measure('GROUP A — ISBN books with NO synopsis', noSyn)
  await measure('GROUP B — ISBN books with UNGROUNDED synopsis', ungrounded)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
