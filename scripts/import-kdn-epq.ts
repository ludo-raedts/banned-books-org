/**
 * Import Malaysia KDN e-PQ banned-publications register.
 *
 * Source: https://epq.kdn.gov.my/e-pq/index.php?mod=public
 * Maintainer: Kementerian Dalam Negeri (Ministry of Home Affairs), Malaysia
 * Legal basis: Printing Presses and Publications Act 1984 (and predecessor
 *              ordinances dating to 1948).
 *
 * 3,214 ban orders gazetted 1950–2026. The public page renders the full
 * register as one large server-side HTML table — no JS, no pagination — so
 * we parsed it once with /tmp/parse_kdn_epq.py and stored the result as
 * data/kdn-epq-batch1.json. This importer reads that JSON and writes:
 *   - one shared ban_sources row (the public e-PQ URL)
 *   - per-entry: book (if new), book_authors, ban, ban_source_links (with
 *     gazette number stored in `locator`), ban_reason_links ('other')
 *
 * Why one source row + locator:
 *   The KDN register has no per-record permalinks — every entry lives in the
 *   same paged table. The actual primary key of each ban is the gazette
 *   reference (e.g. "L.N. 263" for 1951 Legal Notices, "P.U. (A) 410" for
 *   modern Pemberitahuan Undang-undang). ban_source_links.locator carries
 *   that string, giving us per-row traceability without 3,000+ source rows.
 *
 * Reason: defaults to 'other' for all 3,214 — the public register cites no
 * reason field, only the bare gazette decision. The enrich-reasons pipeline
 * can later classify on title/author heuristics, same pattern as PEN America.
 *
 * Status: 'active' — Malaysian publication-ban orders remain legally in
 * force unless explicitly revoked, and KDN keeps them on the register
 * precisely because they're still enforceable.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-kdn-epq.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-kdn-epq.ts --apply
 *   pnpm tsx --env-file=.env.local scripts/import-kdn-epq.ts --apply --limit=100
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { canonicaliseAuthorName } from '../src/lib/imports/canonicalise-author-name'
import { readFileSync } from 'fs'
import { join } from 'path'

const APPLY = process.argv.includes('--apply')
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || Infinity
const JSON_PATH = join(process.cwd(), 'data/kdn-epq-batch1.json')

const SOURCE_NAME = 'Malaysia Ministry of Home Affairs (KDN) — Senarai Perintah Larangan e-PQ'
const SOURCE_URL  = 'https://epq.kdn.gov.my/e-pq/index.php?mod=public'

const ANONYMOUS_AUTHOR_ID = 33  // existing 'Anonymous' row, confirmed earlier

const BAN_INSERT_BATCH = 100

interface KdnEntry {
  bil: number
  title: string
  author: string | null      // already null for "-", "Tiada", "UNKNOWN" etc.
  publisher: string | null
  printer: string | null
  language_raw: string | null
  language: string | null    // ISO 639-1 if mappable, else null
  gazette_date: string | null
  gazette_year: number       // never null per the parser sanity check
  gazette_number: string | null
}

function fmtErr(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string; hint?: string }
    return [e.code, e.message, e.details, e.hint].filter(Boolean).join(' | ') || JSON.stringify(err)
  }
  return String(err)
}

/** Split "M. Navin/ Saravanan Satianandan" → ["M. Navin", "Saravanan Satianandan"]. */
function splitAuthors(raw: string): string[] {
  return raw.split('/').map(s => s.trim()).filter(s => s.length > 0 && s !== '-')
}

function buildDescription(e: KdnEntry): string {
  const parts: string[] = []
  parts.push(`Banned in Malaysia by the Ministry of Home Affairs (KDN) under the Printing Presses and Publications Act.`)
  if (e.gazette_date && e.gazette_number) {
    parts.push(`Gazetted ${e.gazette_date} (${e.gazette_number}).`)
  } else if (e.gazette_number) {
    parts.push(`Gazette ${e.gazette_number}.`)
  }
  if (e.publisher) parts.push(`Publisher: ${e.publisher}.`)
  if (e.printer) parts.push(`Printer: ${e.printer}.`)
  if (e.language_raw) parts.push(`Language: ${e.language_raw}.`)
  return parts.join(' ')
}

const supabase = adminClient()

interface BookRow { id: number; slug: string; title: string }
interface AuthorRow { id: number; slug: string; display_name: string }

const bookBySlug = new Map<string, BookRow>()
const authorBySlug = new Map<string, AuthorRow>()
/** key = `${book_id}|${year}` — MY+government+region=NULL+institution=NULL is implicit */
const existingMyBans = new Set<string>()

async function loadDB(): Promise<{ govScopeId: number; otherReasonId: number; sourceId: number }> {
  // books
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('books').select('id, slug, title').order('id').range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const b of data as BookRow[]) bookBySlug.set(b.slug, b)
    if (data.length < 1000) break
    offset += 1000
  }

  // authors
  offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('authors').select('id, slug, display_name').order('id').range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const a of data as AuthorRow[]) authorBySlug.set(a.slug, a)
    if (data.length < 1000) break
    offset += 1000
  }

  // scopes + reasons
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const govScopeId = scopes!.find(s => s.slug === 'government')!.id as number
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const otherReasonId = (reasons as Array<{ id: number; slug: string }>).find(r => r.slug === 'other')!.id

  // existing MY bans for dedup (any region/institution; KDN are all NULL/NULL)
  offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('bans').select('book_id, year_started, region, institution')
      .eq('country_code', 'MY').eq('scope_id', govScopeId)
      .order('id').range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const b of data as { book_id: number; year_started: number | null; region: string | null; institution: string | null }[]) {
      if (b.region === null && b.institution === null) {
        existingMyBans.add(`${b.book_id}|${b.year_started ?? ''}`)
      }
    }
    if (data.length < 1000) break
    offset += 1000
  }

  // Ensure / upsert source row
  const { data: src, error: srcErr } = await supabase
    .from('ban_sources')
    .upsert({
      source_name: SOURCE_NAME,
      source_url: SOURCE_URL,
      source_type: 'government',
      verification_status: 'unverified' as const,
    }, { onConflict: 'source_url' })
    .select('id').single()
  if (srcErr) throw srcErr
  const sourceId = (src as { id: number }).id

  return { govScopeId, otherReasonId, sourceId }
}

async function findOrCreateAuthor(rawName: string): Promise<number | null> {
  const displayName = canonicaliseAuthorName(rawName)
  const slug = slugify(displayName)
  const ex = authorBySlug.get(slug)
  if (ex) return ex.id
  if (!APPLY) return null
  const { data: na, error: naErr } = await supabase.from('authors')
    .insert({ slug, display_name: displayName, is_placeholder: false })
    .select('id, slug, display_name').single()
  if (naErr) {
    const { data: race } = await supabase.from('authors').select('id, slug, display_name').eq('slug', slug).maybeSingle()
    if (race) { authorBySlug.set(slug, race as AuthorRow); return (race as AuthorRow).id }
    return null
  }
  authorBySlug.set(slug, na as AuthorRow)
  return (na as AuthorRow).id
}

interface Plan {
  entry: KdnEntry
  kind: 'new' | 'existing-book-new-ban' | 'dedup-skip'
  existing_book_id?: number
}

async function main() {
  console.log(`\n── import-kdn-epq ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const entries: KdnEntry[] = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  console.log(`Loaded ${entries.length} entries from ${JSON_PATH}`)

  console.log(`Loading DB state...`)
  const { govScopeId, otherReasonId, sourceId } = await loadDB()
  console.log(`  books in DB:           ${bookBySlug.size}`)
  console.log(`  authors in DB:         ${authorBySlug.size}`)
  console.log(`  existing MY-govt-bans: ${existingMyBans.size}`)
  console.log(`  source_id:             ${sourceId}`)

  // Plan
  // In-run dedup: track (slug, gazette_year) tuples we've already queued so two
  // KDN entries for the same book in the same year don't collide on the
  // bans_unique_per_scope constraint. The earlier run hit 14 such genuine
  // in-KDN duplicates and the batch-failure cascade dropped 1,386 collateral
  // valid rows. With this guard, the first failure of a batch can't happen.
  const plans: Plan[] = []
  const queuedSlugYear = new Set<string>()
  let newBooks = 0, existingBookMatches = 0, dedupSkips = 0, inRunDupSkips = 0
  for (const e of entries) {
    const slug = slugify(e.title)
    const slugYearKey = `${slug}|${e.gazette_year}`
    const existing = bookBySlug.get(slug)
    if (existing) {
      const dedupKey = `${existing.id}|${e.gazette_year}`
      if (existingMyBans.has(dedupKey)) {
        plans.push({ entry: e, kind: 'dedup-skip', existing_book_id: existing.id })
        dedupSkips++
        continue
      }
      if (queuedSlugYear.has(slugYearKey)) {
        plans.push({ entry: e, kind: 'dedup-skip', existing_book_id: existing.id })
        inRunDupSkips++
        continue
      }
      plans.push({ entry: e, kind: 'existing-book-new-ban', existing_book_id: existing.id })
      existingBookMatches++
      queuedSlugYear.add(slugYearKey)
    } else {
      if (queuedSlugYear.has(slugYearKey)) {
        plans.push({ entry: e, kind: 'dedup-skip' })
        inRunDupSkips++
        continue
      }
      plans.push({ entry: e, kind: 'new' })
      newBooks++
      queuedSlugYear.add(slugYearKey)
    }
  }

  console.log(`\n── Plan summary`)
  console.log(`  new book + new ban:           ${newBooks}`)
  console.log(`  new ban on existing book:     ${existingBookMatches}`)
  console.log(`  dedup skip (DB already has):  ${dedupSkips}`)
  console.log(`  dedup skip (in-KDN dup):      ${inRunDupSkips}`)
  console.log(`  TOTAL new bans expected:      ${newBooks + existingBookMatches}`)

  console.log(`\n── Year distribution`)
  const yearCounts = new Map<number, number>()
  for (const p of plans) {
    if (p.kind === 'dedup-skip') continue
    const decade = Math.floor(p.entry.gazette_year / 10) * 10
    yearCounts.set(decade, (yearCounts.get(decade) ?? 0) + 1)
  }
  for (const decade of [...yearCounts.keys()].sort((a, b) => a - b)) {
    console.log(`  ${decade}s: ${yearCounts.get(decade)}`)
  }

  console.log(`\n── Language distribution`)
  const langCounts = new Map<string, number>()
  for (const p of plans) {
    if (p.kind === 'dedup-skip') continue
    const k = p.entry.language ?? '(null)'
    langCounts.set(k, (langCounts.get(k) ?? 0) + 1)
  }
  for (const [k, v] of [...langCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(5)}  ${k}`)
  }

  console.log(`\n── Sample existing-book matches (first 10)`)
  for (const p of plans.filter(p => p.kind === 'existing-book-new-ban').slice(0, 10)) {
    const ex = bookBySlug.get(slugify(p.entry.title))
    console.log(`  book_${ex?.id}  "${ex?.title}"  ←  KDN ${p.entry.gazette_year} (bil=${p.entry.bil})`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──\n`)
    return
  }

  // ── APPLY ──────────────────────────────────────────────────────────────
  console.log(`\n── Applying writes ──`)
  let createdBooks = 0, createdAuthors = 0, createdBans = 0, errors = 0

  // Phase A: create new books + authors + ban for each plan in order.
  // We don't batch books because each may have a different new author.
  // Bans are inserted in batches to keep round-trips low.

  type BanPrep = { book_id: number; entry: KdnEntry }
  const banQueue: BanPrep[] = []

  let progress = 0
  const target = Math.min(plans.length, LIMIT < Infinity ? LIMIT : plans.length)
  for (const p of plans) {
    if (progress >= target) break
    if (p.kind === 'dedup-skip') { progress++; continue }
    progress++

    try {
      let bookId: number
      if (p.kind === 'existing-book-new-ban' && p.existing_book_id) {
        bookId = p.existing_book_id
      } else {
        // Create book
        const slug = slugify(p.entry.title)
        const { data: ex } = await supabase.from('books').select('id').eq('slug', slug).maybeSingle()
        if (ex) {
          bookId = (ex as { id: number }).id
        } else {
          const { data: nb, error: nbErr } = await supabase.from('books').insert({
            title: p.entry.title,
            slug,
            original_language: p.entry.language,
            first_published_year: null,
            ai_drafted: false,
            genres: [],
            cover_url: null,
          }).select('id, slug, title').single()
          if (nbErr) throw nbErr
          bookId = (nb as { id: number }).id
          bookBySlug.set(slug, nb as BookRow)
          createdBooks++
        }

        // Authors
        const authorNames = p.entry.author ? splitAuthors(p.entry.author) : []
        if (authorNames.length === 0) {
          await supabase.from('book_authors').insert({ book_id: bookId, author_id: ANONYMOUS_AUTHOR_ID })
        } else {
          for (const name of authorNames) {
            const beforeSize = authorBySlug.size
            const aId = await findOrCreateAuthor(name)
            if (aId && authorBySlug.size > beforeSize) createdAuthors++
            if (aId) {
              await supabase.from('book_authors').insert({ book_id: bookId, author_id: aId })
            }
          }
        }
      }

      banQueue.push({ book_id: bookId, entry: p.entry })

      if (progress % 500 === 0) {
        console.log(`  ...${progress}/${target} (books +${createdBooks}, authors +${createdAuthors})`)
      }
    } catch (err) {
      errors++
      console.error(`  ! "${p.entry.title}" (bil=${p.entry.bil}): ${fmtErr(err)}`)
    }
  }

  console.log(`\n  Books+authors phase done. Bans to insert: ${banQueue.length}`)

  // Phase B: batched ban inserts + per-batch source_link + reason_link writes
  console.log(`\n  Inserting bans in batches of ${BAN_INSERT_BATCH}...`)
  for (let i = 0; i < banQueue.length; i += BAN_INSERT_BATCH) {
    const chunk = banQueue.slice(i, i + BAN_INSERT_BATCH)
    const rows = chunk.map(b => ({
      book_id: b.book_id,
      country_code: 'MY',
      scope_id: govScopeId,
      action_type: 'banned',
      status: 'active',
      region: null,
      institution: null,
      year_started: b.entry.gazette_year,
      year_ended: null,
      description: buildDescription(b.entry),
      confidence: 'reported' as const,
    }))
    try {
      const { data: inserted, error } = await supabase.from('bans').insert(rows).select('id')
      if (error) throw error
      const ids = (inserted as Array<{ id: number }>).map(r => r.id)

      // Source links with locator
      const linkRows = ids.map((id, idx) => ({
        ban_id: id,
        source_id: sourceId,
        locator: chunk[idx].entry.gazette_number ?? null,
      }))
      const { error: linkErr } = await supabase.from('ban_source_links').insert(linkRows)
      if (linkErr) throw linkErr

      // Reason links — all 'other'
      const reasonRows = ids.map(id => ({ ban_id: id, reason_id: otherReasonId }))
      const { error: reasonErr } = await supabase.from('ban_reason_links').insert(reasonRows)
      if (reasonErr) throw reasonErr

      createdBans += ids.length
      process.stdout.write(`  bans ${createdBans}/${banQueue.length}\r`)
    } catch (err) {
      errors += chunk.length
      console.error(`\n  ! batch ${i}-${i + chunk.length}: ${fmtErr(err)}`)
    }
  }
  process.stdout.write('\n')

  console.log(`\n── Done ──`)
  console.log(`  books created:    ${createdBooks}`)
  console.log(`  authors created:  ${createdAuthors}`)
  console.log(`  bans created:     ${createdBans}`)
  console.log(`  errors:           ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
