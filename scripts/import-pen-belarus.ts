/**
 * Import PEN Belarus modern banned-books lists.
 *
 * Sources (per-list, separate ban_sources rows):
 *   https://bannedbooks.penbelarus.org/en/extremist_list_en/  (Official
 *     "Extremist Materials" list — court-ordered bans, post-2020)
 *   https://bannedbooks.penbelarus.org/en/harmful_list_en/    (Ministry
 *     of Information designation: "Harmful to National Interests")
 *
 * 346 entries total (105 extremist + 241 harmful), ban_year 2021-2026.
 * Maintained by PEN Belarus (operating in exile, funded by Norway + HRH).
 *
 * Licensing: no explicit CC license on site, only "Copyright © 2026". We
 * proceed under NGO-data / fair-use interpretation with full attribution:
 * per-entry back-link via locator (entry number) + prominent source naming.
 *
 * Schema choices:
 *   - country_code: 'BY' (modern Belarus, Lukashenko regime)
 *   - scope: 'government'
 *   - action_type: 'banned' for both lists (both result in legal
 *     prohibition / removal from libraries/schools/distribution)
 *   - ban_status: 'active' (regime in power; bans enforced)
 *   - reason_slug: 'political' (primary regime targeting)
 *   - source_type: 'ngo' (PEN Belarus documents, but it's gov action)
 *   - per-link locator = entry number on its list
 *
 * Anonymous authors: empty `authors` arrays map to existing 'Anonymous' (id=33).
 * Author splits use the parser's already-cleaned per-name list.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-pen-belarus.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-pen-belarus.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { readFileSync } from 'fs'
import { join } from 'path'

const APPLY = process.argv.includes('--apply')
const JSON_PATH = join(process.cwd(), 'data/pen-belarus-batch1.json')

const ANONYMOUS_AUTHOR_ID = 33
const BAN_INSERT_BATCH = 100

interface BelarusEntry {
  list_type: 'extremist' | 'harmful'
  entry_number: number
  title: string
  authors: string[]
  decision_date: string | null
  ban_year: number | null
  country_of_origin: string | null
  needs_review?: boolean
}

interface InputFile {
  sources: { extremist: string; harmful: string }
  entries: BelarusEntry[]
}

function fmtErr(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string; hint?: string }
    return [e.code, e.message, e.details, e.hint].filter(Boolean).join(' | ') || JSON.stringify(err)
  }
  return String(err)
}

function buildDescription(e: BelarusEntry): string {
  const list_label = e.list_type === 'extremist'
    ? 'Official List of Extremist Materials (court-ordered)'
    : 'Official List of Publications Harmful to National Interests (Ministry of Information)'
  const parts: string[] = []
  parts.push(`Banned in Belarus by addition to the ${list_label}.`)
  if (e.decision_date) parts.push(`Decision: ${e.decision_date}.`)
  if (e.country_of_origin) parts.push(`Country of origin: ${e.country_of_origin}.`)
  parts.push('Documented by PEN Belarus.')
  if (e.needs_review) parts.push('[Editor review needed — original entry had non-standard formatting.]')
  return parts.join(' ')
}

const supabase = adminClient()

interface BookRow { id: number; slug: string; title: string }
interface AuthorRow { id: number; slug: string; display_name: string }

const bookBySlug = new Map<string, BookRow>()
const authorBySlug = new Map<string, AuthorRow>()
/** key = `${book_id}|${list_type}|${year}` — used to dedup within run */
const existingByBans = new Set<string>()

async function loadDB(): Promise<{
  govScopeId: number; politicalReasonId: number;
  extremistSourceId: number; harmfulSourceId: number;
}> {
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

  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const govScopeId = scopes!.find(s => s.slug === 'government')!.id as number
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const politicalReasonId = (reasons as Array<{ id: number; slug: string }>).find(r => r.slug === 'political')!.id

  // Existing BY-government bans for dedup
  offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('bans').select('book_id, year_started')
      .eq('country_code', 'BY').eq('scope_id', govScopeId)
      .order('id').range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const b of data as { book_id: number; year_started: number | null }[]) {
      // BY bans don't distinguish list_type yet, so a same-book-same-year ban
      // collides regardless. We'll skip duplicates.
      existingByBans.add(`${b.book_id}|${b.year_started ?? ''}`)
    }
    if (data.length < 1000) break
    offset += 1000
  }

  // Upsert the two source rows
  const { data: input } = await supabase  // we'll need the source URLs from JSON
    .from('ban_sources').select('id').eq('source_url', 'https://bannedbooks.penbelarus.org/en/extremist_list_en/').maybeSingle()

  async function upsertSource(name: string, url: string): Promise<number> {
    const { data: src, error: srcErr } = await supabase
      .from('ban_sources').upsert({
        source_name: name, source_url: url, source_type: 'ngo',
        verification_status: 'unverified' as const,
      }, { onConflict: 'source_url' }).select('id').single()
    if (srcErr) throw srcErr
    return (src as { id: number }).id
  }
  void input  // unused; structure of pre-check left for symmetry

  const extremistSourceId = await upsertSource(
    'PEN Belarus — Official List of "Extremist Materials"',
    'https://bannedbooks.penbelarus.org/en/extremist_list_en/',
  )
  const harmfulSourceId = await upsertSource(
    'PEN Belarus — Official List of Publications "Harmful to National Interests"',
    'https://bannedbooks.penbelarus.org/en/harmful_list_en/',
  )

  return { govScopeId, politicalReasonId, extremistSourceId, harmfulSourceId }
}

async function findOrCreateAuthor(displayName: string): Promise<number | null> {
  const slug = slugify(displayName)
  const ex = authorBySlug.get(slug)
  if (ex) return ex.id
  if (!APPLY) return null
  const { data: na, error } = await supabase.from('authors')
    .insert({ slug, display_name: displayName, is_placeholder: false })
    .select('id, slug, display_name').single()
  if (error) {
    const { data: race } = await supabase.from('authors').select('id, slug, display_name').eq('slug', slug).maybeSingle()
    if (race) { authorBySlug.set(slug, race as AuthorRow); return (race as AuthorRow).id }
    return null
  }
  authorBySlug.set(slug, na as AuthorRow)
  return (na as AuthorRow).id
}

async function main() {
  console.log(`\n── import-pen-belarus ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const input: InputFile = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  console.log(`Loaded ${input.entries.length} entries (${input.entries.filter(e => e.list_type === 'extremist').length} ext, ${input.entries.filter(e => e.list_type === 'harmful').length} har)`)

  const { govScopeId, politicalReasonId, extremistSourceId, harmfulSourceId } = await loadDB()
  console.log(`  books in DB:           ${bookBySlug.size}`)
  console.log(`  authors in DB:         ${authorBySlug.size}`)
  console.log(`  existing BY-gov bans:  ${existingByBans.size}`)
  console.log(`  source IDs:            extremist=${extremistSourceId} harmful=${harmfulSourceId}`)

  // Plan
  type Plan = { entry: BelarusEntry; kind: 'new' | 'existing-book' | 'skip-dedup'; existing_book_id?: number }
  const plans: Plan[] = []
  const queuedSlugYear = new Set<string>()
  let newBooks = 0, existingBookMatches = 0, dedupSkips = 0, inRunDupSkips = 0
  for (const e of input.entries) {
    const slug = slugify(e.title)
    const slugYearKey = `${slug}|${e.ban_year ?? ''}`
    const existing = bookBySlug.get(slug)
    if (existing) {
      const dedupKey = `${existing.id}|${e.ban_year ?? ''}`
      if (existingByBans.has(dedupKey)) {
        plans.push({ entry: e, kind: 'skip-dedup', existing_book_id: existing.id })
        dedupSkips++
        continue
      }
      if (queuedSlugYear.has(slugYearKey)) {
        plans.push({ entry: e, kind: 'skip-dedup', existing_book_id: existing.id })
        inRunDupSkips++
        continue
      }
      plans.push({ entry: e, kind: 'existing-book', existing_book_id: existing.id })
      existingBookMatches++
      queuedSlugYear.add(slugYearKey)
    } else {
      if (queuedSlugYear.has(slugYearKey)) {
        plans.push({ entry: e, kind: 'skip-dedup' })
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
  console.log(`  dedup skip (DB already):      ${dedupSkips}`)
  console.log(`  dedup skip (in-run dup):      ${inRunDupSkips}`)
  console.log(`  TOTAL new bans expected:      ${newBooks + existingBookMatches}`)

  if (existingBookMatches > 0) {
    console.log(`\n── Sample existing-book hits (first 10)`)
    for (const p of plans.filter(p => p.kind === 'existing-book').slice(0, 10)) {
      const ex = bookBySlug.get(slugify(p.entry.title))
      console.log(`  book_${ex?.id} "${ex?.title}"  ←  PEN-BY ${p.entry.list_type} #${p.entry.entry_number} (${p.entry.ban_year})`)
    }
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──\n`)
    return
  }

  console.log(`\n── Applying writes ──`)
  let createdBooks = 0, createdAuthors = 0, createdBans = 0, errors = 0

  type BanPrep = { book_id: number; entry: BelarusEntry; source_id: number }
  const banQueue: BanPrep[] = []

  for (const p of plans) {
    if (p.kind === 'skip-dedup') continue
    try {
      let bookId: number
      if (p.kind === 'existing-book' && p.existing_book_id) {
        bookId = p.existing_book_id
      } else {
        const slug = slugify(p.entry.title)
        const { data: ex } = await supabase.from('books').select('id').eq('slug', slug).maybeSingle()
        if (ex) {
          bookId = (ex as { id: number }).id
        } else {
          const { data: nb, error: nbErr } = await supabase.from('books').insert({
            title: p.entry.title,
            slug,
            original_language: null,
            first_published_year: null,
            ai_drafted: false,
            genres: [],
            cover_url: null,
          }).select('id').single()
          if (nbErr) throw nbErr
          bookId = (nb as { id: number }).id
          bookBySlug.set(slug, nb as BookRow)
          createdBooks++
        }
        // Authors — use existing Anonymous (id=33) if entry has no authors
        if (p.entry.authors.length === 0) {
          await supabase.from('book_authors').insert({ book_id: bookId, author_id: ANONYMOUS_AUTHOR_ID })
        } else {
          for (const name of p.entry.authors) {
            const beforeSize = authorBySlug.size
            const aId = await findOrCreateAuthor(name)
            if (aId && authorBySlug.size > beforeSize) createdAuthors++
            if (aId) await supabase.from('book_authors').insert({ book_id: bookId, author_id: aId })
          }
        }
      }
      const source_id = p.entry.list_type === 'extremist' ? extremistSourceId : harmfulSourceId
      banQueue.push({ book_id: bookId, entry: p.entry, source_id })
    } catch (err) {
      errors++
      console.error(`  ! "${p.entry.title.slice(0, 60)}" (#${p.entry.entry_number} ${p.entry.list_type}): ${fmtErr(err)}`)
    }
  }

  console.log(`  books-authors phase: ${banQueue.length} bans queued`)

  // Batched ban inserts
  for (let i = 0; i < banQueue.length; i += BAN_INSERT_BATCH) {
    const chunk = banQueue.slice(i, i + BAN_INSERT_BATCH)
    const rows = chunk.map(b => ({
      book_id: b.book_id,
      country_code: 'BY',
      scope_id: govScopeId,
      action_type: 'banned',
      status: 'active',
      region: null,
      institution: null,
      year_started: b.entry.ban_year,
      year_ended: null,
      description: buildDescription(b.entry),
      confidence: 'reported' as const,
    }))
    try {
      const { data: inserted, error } = await supabase.from('bans').insert(rows).select('id')
      if (error) throw error
      const ids = (inserted as Array<{ id: number }>).map(r => r.id)
      const linkRows = ids.map((id, idx) => ({
        ban_id: id,
        source_id: chunk[idx].source_id,
        locator: `entry #${chunk[idx].entry.entry_number}`,
      }))
      const { error: linkErr } = await supabase.from('ban_source_links').insert(linkRows)
      if (linkErr) throw linkErr
      const reasonRows = ids.map(id => ({ ban_id: id, reason_id: politicalReasonId }))
      const { error: rErr } = await supabase.from('ban_reason_links').insert(reasonRows)
      if (rErr) throw rErr
      createdBans += ids.length
      process.stdout.write(`  bans ${createdBans}/${banQueue.length}\r`)
    } catch (err) {
      errors += chunk.length
      console.error(`\n  ! batch ${i}: ${fmtErr(err)}`)
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
