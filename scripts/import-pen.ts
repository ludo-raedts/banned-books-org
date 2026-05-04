/**
 * Import PEN America 2024-25 school ban index.
 * Source: data/pen-2024-25.csv
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-pen.ts
 *     → dry-run: shows counts and 5 sample records, no writes
 *   npx tsx --env-file=.env.local scripts/import-pen.ts --apply
 *     → inserts new books + bans
 *   npx tsx --env-file=.env.local scripts/import-pen.ts --apply --limit=25
 *     → inserts at most 25 new books + bans
 */

import { adminClient } from '../src/lib/supabase'
import { readFileSync } from 'fs'
import { join } from 'path'

const APPLY = process.argv.includes('--apply')
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || Infinity
const CSV_PATH = join(process.cwd(), 'data/pen-2024-25.csv')
const OL_DELAY_MS = 350

// ── CSV parsing ──────────────────────────────────────────────────────────────

function parseRow(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { fields.push(current); current = '' }
      else current += ch
    }
  }
  fields.push(current)
  return fields
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.replace(/\r/g, '').split('\n')
  const headers = parseRow(lines[0].replace(/^﻿/, ''))
  const result: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const values = parseRow(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, j) => { row[h] = (values[j] ?? '').trim() })
    result.push(row)
  }
  return result
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Strip author-initials suffix: "Burned (EH)" → "Burned"
function cleanTitle(title: string): string {
  return title.replace(/\s*\([A-Z]{2,4}\)\s*$/, '').trim()
}

// "Last, First" → "First Last", pass through anything else
function formatAuthor(raw: string): string {
  if (!raw) return ''
  const idx = raw.indexOf(',')
  if (idx === -1) return raw.trim()
  return `${raw.slice(idx + 1).trim()} ${raw.slice(0, idx).trim()}`
}

function toSlug(s: string): string {
  return s.toLowerCase()
    .replace(/['''`]/g, '')   // strip curly + ASCII apostrophes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Extract earliest year from "August 2024" or "January 2025 - June 2025"
function extractYear(dateStr: string): number | null {
  const m = dateStr.match(/20\d{2}/)
  return m ? parseInt(m[0]) : null
}

function mapStatus(banStatus: string): string {
  // All PEN America entries represent active restrictions
  return 'active'
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── OpenLibrary ───────────────────────────────────────────────────────────────

interface OLResult { coverUrl: string | null; workId: string | null; publishYear: number | null }

async function fetchOL(title: string, author: string): Promise<OLResult> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key,cover_i,first_publish_year&limit=1`, {
      headers: { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' },
    })
    if (!res.ok) return { coverUrl: null, workId: null, publishYear: null }
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number; first_publish_year?: number }> }
    const doc = json.docs?.[0]
    return {
      coverUrl:    doc?.cover_i            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      workId:      doc?.key?.replace('/works/', '') ?? null,
      publishYear: doc?.first_publish_year ?? null,
    }
  } catch { return { coverUrl: null, workId: null, publishYear: null } }
}

// ── Genre guesser (lightweight) ──────────────────────────────────────────────

function guessGenres(title: string, author: string): string[] {
  const t = title.toLowerCase(); const a = author.toLowerCase()
  if (/memoir|diary|autobiography|my life|i am|boy|girl who/.test(t)) return ['memoir']
  if (/graphic novel|illustrated/.test(t)) return ['graphic-novel']
  if (/queer|transgender|gay|lesbian|bisexual|pride|lgbtq/.test(t)) return ['young-adult']
  if (/dragon|throne|court|kingdom|realm|crown|magic|fae|blood and/.test(t)) return ['fantasy']
  if (/dystopia|hunger|divergent|maze/.test(t)) return ['dystopian', 'young-adult']
  if (/murder|kill|dark|horror|dead|blood/.test(t)) return ['thriller']
  if (/history|war|slavery|civil rights|jim crow/.test(t)) return ['historical-fiction']
  if (/poems?|poetry|verse/.test(t)) return ['literary-fiction']
  if (/green|anderson|blume|hinton|crutcher|paulsen|lowry|pilkey|dahl|alexie/.test(a)) return ['young-adult']
  return ['literary-fiction']
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface BookRecord {
  title: string        // cleaned title
  rawTitle: string     // original CSV title
  slug: string
  author: string       // "First Last"
  authorSlug: string
  year: number | null  // from ban date
  status: string
  state: string
  district: string
  banCount: number     // how many CSV rows reference this title
}

async function main() {
  console.log(`\n── import-pen (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  // 1. Parse CSV
  const raw = parseCSV(readFileSync(CSV_PATH, 'utf-8'))
  console.log(`CSV rows: ${raw.length}`)

  // 2. Aggregate by cleaned title (one book per unique title)
  const byTitle = new Map<string, BookRecord>()
  for (const row of raw) {
    const title = cleanTitle(row['Title'])
    if (!title) continue
    const slug = toSlug(title)
    const existing = byTitle.get(slug)
    if (existing) {
      existing.banCount++
    } else {
      byTitle.set(slug, {
        title,
        rawTitle: row['Title'],
        slug,
        author: formatAuthor(row['Author']),
        authorSlug: toSlug(formatAuthor(row['Author'])),
        year: extractYear(row['Date of Challenge/Removal']),
        status: mapStatus(row['Ban Status']),
        state: row['State'],
        district: row['District'],
        banCount: 1,
      })
    }
  }

  const allBooks = [...byTitle.values()].sort((a, b) => b.banCount - a.banCount)
  console.log(`Unique titles in CSV: ${allBooks.length}`)

  // 3. Load ALL existing DB books (paginated — Supabase caps at 1000/request)
  const supabase = adminClient()
  let allExisting: { slug: string; title: string }[] = []
  let offset = 0
  while (true) {
    const { data } = await supabase.from('books').select('slug, title').range(offset, offset + 999)
    if (!data || data.length === 0) break
    allExisting = allExisting.concat(data)
    if (data.length < 1000) break
    offset += 1000
  }
  console.log(`Books in DB:     ${allExisting.length}`)
  const existingSlugs = new Set(allExisting.map(b => b.slug))
  const existingTitlesLower = new Set(allExisting.map(b => b.title.toLowerCase()))

  // 4. Split into new vs existing
  const toInsert: BookRecord[] = []
  const alreadyExists: BookRecord[] = []

  for (const book of allBooks) {
    const inDB = existingSlugs.has(book.slug) || existingTitlesLower.has(book.title.toLowerCase())
    if (inDB) alreadyExists.push(book)
    else toInsert.push(book)
  }

  console.log(`Already in DB:   ${alreadyExists.length}`)
  console.log(`New to insert:   ${toInsert.length}`)
  console.log(`\nTop 5 already-in-DB (by ban count):`)
  alreadyExists.slice(0, 5).forEach(b =>
    console.log(`  [${b.banCount}x] ${b.title} — ${b.author}`)
  )

  console.log(`\n5 sample records that WOULD be inserted (sorted by ban count):`)
  toInsert.slice(0, 5).forEach((b, i) => {
    console.log(`\n  ${i + 1}. "${b.title}"`)
    console.log(`     Author:   ${b.author}`)
    console.log(`     Slug:     ${b.slug}`)
    console.log(`     Ban year: ${b.year ?? 'unknown'}`)
    console.log(`     Status:   ${b.status}`)
    console.log(`     CSV rows: ${b.banCount} (${b.state})`)
  })

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply to insert. ──\n`)
    return
  }

  // ── APPLY MODE ──────────────────────────────────────────────────────────────

  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const { data: existingAuthors } = await supabase.from('authors').select('id, slug')

  const schoolScopeId = scopes!.find(s => s.slug === 'school')!.id
  const reasonOtherId = reasons!.find(r => r.slug === 'other')?.id
  const authorMap = new Map((existingAuthors ?? []).map(a => [a.slug, a.id as number]))

  // Upsert PEN source once
  const { data: penSource } = await supabase.from('ban_sources').upsert({
    source_name: 'PEN America',
    source_url: 'https://pen.org/book-bans/',
    source_type: 'web',
  }, { onConflict: 'source_url' }).select('id').single()
  const penSourceId = penSource?.id ?? null

  let inserted = 0, skipped = 0, errored = 0

  const insertLimit = Math.min(toInsert.length, LIMIT)
  for (let i = 0; i < insertLimit; i++) {
    const b = toInsert[i]

    // Re-check (previous run may have added it)
    if (existingSlugs.has(b.slug)) { skipped++; continue }

    try {
      process.stdout.write(`[${i + 1}/${insertLimit}] ${b.title} — OL... `)
      const ol = await fetchOL(b.title, b.author)
      await sleep(OL_DELAY_MS)

      const publishYear = ol.publishYear ?? b.year ?? 2020
      console.log(ol.coverUrl ? `cover ok (${publishYear})` : `no cover (${publishYear})`)

      // Author
      let authorId = authorMap.get(b.authorSlug)
      if (!authorId && b.author) {
        const { data: newAuthor, error: ae } = await supabase
          .from('authors')
          .insert({ slug: b.authorSlug, display_name: b.author, birth_year: null, death_year: null })
          .select('id').single()
        if (ae) {
          const { data: ex } = await supabase.from('authors').select('id').eq('slug', b.authorSlug).single()
          if (ex) { authorId = ex.id; authorMap.set(b.authorSlug, ex.id) }
          else console.warn(`  [warn] author: ${ae.message}`)
        } else {
          authorId = newAuthor.id
          authorMap.set(b.authorSlug, newAuthor.id)
        }
      }

      // Book
      const { data: newBook, error: be } = await supabase.from('books').insert({
        title: b.title,
        slug: b.slug,
        original_language: 'en',
        first_published_year: publishYear,
        ai_drafted: false,
        genres: guessGenres(b.title, b.author),
        cover_url: ol.coverUrl,
        openlibrary_work_id: ol.workId,
      }).select('id').single()
      if (be) throw be
      const bookId = newBook.id
      existingSlugs.add(b.slug)

      if (authorId) {
        await supabase.from('book_authors').insert({ book_id: bookId, author_id: authorId })
      }

      // Ban
      const { data: newBan, error: bane } = await supabase.from('bans').insert({
        book_id: bookId,
        country_code: 'US',
        scope_id: schoolScopeId,
        action_type: 'banned',
        status: b.status,
        year_started: b.year ?? publishYear,
      }).select('id').single()
      if (bane) throw bane

      if (reasonOtherId) {
        await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: reasonOtherId })
      }
      if (penSourceId) {
        await supabase.from('ban_source_links').insert({ ban_id: newBan.id, source_id: penSourceId })
      }

      inserted++
    } catch (err) {
      console.error(`  [error] ${b.title}: ${err instanceof Error ? err.message : String(err)}`)
      errored++
    }
  }

  console.log(`\n── Done ──`)
  console.log(`Inserted: ${inserted}  Skipped: ${skipped}  Errors: ${errored}`)
  console.log(`\nNext: run scripts/fix-descriptions.ts --apply to fill in descriptions.`)
}

main().catch(e => { console.error(e); process.exit(1) })
