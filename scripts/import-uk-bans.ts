/**
 * Import UK + Ireland book bans, 1727-2025.
 *
 * Input: data/uk-bans-batch1.json — a hand-curated multi-collection
 *   compilation from Index on Censorship, the Royal Literary Fund, the UK
 *   National Archives, Wikipedia (OPA 1959, Section 28, Whitehouse v Lemon,
 *   Spycatcher), and 2024 school-librarian survey reporting. See the file's
 *   _doc field and per-collection source.url for citations.
 *
 * Each entry inherits the collection's ban_defaults (country_code, scope,
 *   action_type, status, year_started, year_ended, institution, confidence)
 *   and overrides per-entry. Reasons are per-entry slug arrays.
 *
 * Behaviour:
 *   - Looks up books by title-slug; existing books get a new ban row attached.
 *   - New books are inserted with `ai_drafted: false` and the entry's
 *     first_published_year / original_language.
 *   - Authors looked up by canonicalised+sanitised name-slug, created if missing.
 *   - Dedup key: (book_id, country_code, scope_id, year_started).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-uk-bans.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-uk-bans.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { canonicaliseAuthorName } from '../src/lib/imports/canonicalise-author-name'
import { sanitiseScrapedAuthor } from '../src/lib/imports/sanitise-scraped-author'
import { readFileSync } from 'fs'
import { join } from 'path'

const APPLY = process.argv.includes('--apply')
const JSON_PATH = join(process.cwd(), 'data/uk-bans-batch1.json')

interface BanDefaults {
  country_code?: string
  scope?: string
  action_type?: 'banned' | 'challenged' | 'removed' | 'restricted' | 'blocked'
  status?: 'active' | 'rescinded' | 'historical' | 'unclear'
  year_started?: number | null
  year_ended?: number | null
  institution?: string | null
  region?: string | null
  confidence?: 'verified' | 'reported' | 'unverified'
}

interface Entry extends BanDefaults {
  title: string
  authors: string[]
  first_published_year?: number | null
  original_language?: string | null
  reasons: string[]
  description_extra?: string
  needs_review?: boolean
}

interface Collection {
  slug: string
  source: { name: string; url: string; type: string }
  ban_defaults: BanDefaults
  description_intro?: string
  entries: Entry[]
}

interface InputFile {
  _doc?: string
  collections: Collection[]
}

function fmtErr(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string; hint?: string }
    return [e.code, e.message, e.details, e.hint].filter(Boolean).join(' | ') || JSON.stringify(err)
  }
  return String(err)
}

function buildDescription(collection: Collection, entry: Entry): string {
  const parts: string[] = []
  if (collection.description_intro) parts.push(collection.description_intro)
  if (entry.description_extra) parts.push(entry.description_extra)
  parts.push(`Source: ${collection.source.name}.`)
  if (entry.needs_review) parts.push('[Editor review needed.]')
  return parts.join(' ')
}

const supabase = adminClient()

interface BookRow { id: number; slug: string; title: string }
interface AuthorRow { id: number; slug: string; display_name: string }

const bookBySlug = new Map<string, BookRow>()
const authorBySlug = new Map<string, AuthorRow>()
const scopeBySlug = new Map<string, number>()
const reasonBySlug = new Map<string, number>()
/** key = `${book_id}|${country}|${scope_id}|${year}` */
const existingBans = new Set<string>()
/** ban_source_id per collection.slug */
const sourceIdByCollection = new Map<string, number>()

async function loadDB(input: InputFile): Promise<void> {
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

  const { data: scopes, error: scopeErr } = await supabase.from('scopes').select('id, slug')
  if (scopeErr) throw scopeErr
  for (const s of scopes as Array<{ id: number; slug: string }>) scopeBySlug.set(s.slug, s.id)

  const { data: reasons, error: reasonErr } = await supabase.from('reasons').select('id, slug')
  if (reasonErr) throw reasonErr
  for (const r of reasons as Array<{ id: number; slug: string }>) reasonBySlug.set(r.slug, r.id)

  // Existing bans (UK / Ireland / US / South Africa — the four jurisdictions in this batch)
  const countries = Array.from(new Set(
    input.collections.flatMap(c =>
      c.entries.map(e => e.country_code ?? c.ban_defaults.country_code).filter(Boolean) as string[]
    )
  ))
  offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('bans').select('book_id, country_code, scope_id, year_started')
      .in('country_code', countries)
      .order('id').range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const b of data as { book_id: number; country_code: string; scope_id: number; year_started: number | null }[]) {
      existingBans.add(`${b.book_id}|${b.country_code}|${b.scope_id}|${b.year_started ?? ''}`)
    }
    if (data.length < 1000) break
    offset += 1000
  }

  // Upsert one ban_source per collection
  for (const c of input.collections) {
    const { data: existing } = await supabase
      .from('ban_sources').select('id').eq('source_url', c.source.url).maybeSingle()
    if (existing) {
      sourceIdByCollection.set(c.slug, (existing as { id: number }).id)
      continue
    }
    if (!APPLY) {
      sourceIdByCollection.set(c.slug, -1)
      continue
    }
    const { data: src, error: srcErr } = await supabase
      .from('ban_sources').insert({
        source_name: c.source.name, source_url: c.source.url, source_type: c.source.type,
      }).select('id').single()
    if (srcErr) throw srcErr
    sourceIdByCollection.set(c.slug, (src as { id: number }).id)
  }
}

const sanitiserStats: Record<string, number> = {}

async function findOrCreateAuthor(rawName: string): Promise<number | null> {
  const { cleanName: sanitised, reason } = sanitiseScrapedAuthor(rawName)
  if (reason) sanitiserStats[reason] = (sanitiserStats[reason] ?? 0) + 1
  if (sanitised === null) {
    console.warn(`  ! skipped author '${rawName.slice(0, 80)}' (sanitiser: ${reason})`)
    return null
  }
  const displayName = canonicaliseAuthorName(sanitised)
  const slug = slugify(displayName)
  if (!slug) {
    console.warn(`  ! skipped author '${rawName.slice(0, 80)}' (empty slug)`)
    return null
  }
  const ex = authorBySlug.get(slug)
  if (ex) return ex.id
  if (!APPLY) return null
  const { data: na, error } = await supabase.from('authors')
    .insert({ slug, display_name: displayName })
    .select('id, slug, display_name').single()
  if (error) {
    const { data: race } = await supabase.from('authors').select('id, slug, display_name').eq('slug', slug).maybeSingle()
    if (race) { authorBySlug.set(slug, race as AuthorRow); return (race as AuthorRow).id }
    return null
  }
  authorBySlug.set(slug, na as AuthorRow)
  return (na as AuthorRow).id
}

interface MergedEntry extends Entry {
  _collection: Collection
  _country: string
  _scope_slug: string
  _scope_id: number
  _action_type: 'banned' | 'challenged' | 'removed' | 'restricted' | 'blocked'
  _status: 'active' | 'rescinded' | 'historical' | 'unclear'
  _year_started: number | null
  _year_ended: number | null
  _institution: string | null
  _region: string | null
  _confidence: 'verified' | 'reported' | 'unverified'
}

function merge(collection: Collection, e: Entry): MergedEntry {
  const d = collection.ban_defaults
  const country = e.country_code ?? d.country_code
  const scope_slug = e.scope ?? d.scope
  if (!country) throw new Error(`Missing country_code for "${e.title}" in ${collection.slug}`)
  if (!scope_slug) throw new Error(`Missing scope for "${e.title}" in ${collection.slug}`)
  const scope_id = scopeBySlug.get(scope_slug)
  if (!scope_id) throw new Error(`Unknown scope '${scope_slug}' for "${e.title}"`)
  return {
    ...e,
    _collection: collection,
    _country: country,
    _scope_slug: scope_slug,
    _scope_id: scope_id,
    _action_type: e.action_type ?? d.action_type ?? 'banned',
    _status: e.status ?? d.status ?? 'active',
    _year_started: e.year_started ?? d.year_started ?? null,
    _year_ended: e.year_ended ?? d.year_ended ?? null,
    _institution: e.institution ?? d.institution ?? null,
    _region: e.region ?? d.region ?? null,
    _confidence: e.confidence ?? d.confidence ?? 'reported',
  }
}

async function main() {
  console.log(`\n── import-uk-bans ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const input: InputFile = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  const totalEntries = input.collections.reduce((n, c) => n + c.entries.length, 0)
  console.log(`Loaded ${totalEntries} entries across ${input.collections.length} collections:`)
  for (const c of input.collections) console.log(`  - ${c.slug.padEnd(38)} ${c.entries.length} entries`)

  await loadDB(input)
  console.log(`\n  books in DB:           ${bookBySlug.size}`)
  console.log(`  authors in DB:         ${authorBySlug.size}`)
  console.log(`  existing bans (scope): ${existingBans.size}`)
  console.log(`  source IDs:`)
  for (const [slug, id] of sourceIdByCollection) console.log(`    ${slug.padEnd(38)} ${id}`)

  // Validate every reason slug up-front
  const unknownReasons = new Set<string>()
  for (const c of input.collections) for (const e of c.entries) for (const r of e.reasons) {
    if (!reasonBySlug.has(r)) unknownReasons.add(r)
  }
  if (unknownReasons.size > 0) {
    console.error(`\n  ! Unknown reason slugs: ${Array.from(unknownReasons).join(', ')}`)
    console.error(`    Allowed: ${Array.from(reasonBySlug.keys()).join(', ')}`)
    process.exit(1)
  }

  type Plan = { merged: MergedEntry; kind: 'new' | 'existing-book' | 'skip-dedup'; existing_book_id?: number }
  const plans: Plan[] = []
  const queuedDedup = new Set<string>()
  let newBooks = 0, existingBookMatches = 0, dedupSkips = 0, inRunDupSkips = 0
  for (const c of input.collections) {
    for (const e of c.entries) {
      const merged = merge(c, e)
      const slug = slugify(merged.title)
      const dedupKey = (book_id: number) => `${book_id}|${merged._country}|${merged._scope_id}|${merged._year_started ?? ''}`
      const existing = bookBySlug.get(slug)
      if (existing) {
        const key = dedupKey(existing.id)
        if (existingBans.has(key)) {
          plans.push({ merged, kind: 'skip-dedup', existing_book_id: existing.id })
          dedupSkips++
          continue
        }
        if (queuedDedup.has(key)) {
          plans.push({ merged, kind: 'skip-dedup', existing_book_id: existing.id })
          inRunDupSkips++
          continue
        }
        plans.push({ merged, kind: 'existing-book', existing_book_id: existing.id })
        existingBookMatches++
        queuedDedup.add(key)
      } else {
        const newKey = `NEW:${slug}|${merged._country}|${merged._scope_id}|${merged._year_started ?? ''}`
        if (queuedDedup.has(newKey)) {
          plans.push({ merged, kind: 'skip-dedup' })
          inRunDupSkips++
          continue
        }
        plans.push({ merged, kind: 'new' })
        newBooks++
        queuedDedup.add(newKey)
      }
    }
  }

  console.log(`\n── Plan summary`)
  console.log(`  new book + new ban:           ${newBooks}`)
  console.log(`  new ban on existing book:     ${existingBookMatches}`)
  console.log(`  dedup skip (DB already):      ${dedupSkips}`)
  console.log(`  dedup skip (in-run dup):      ${inRunDupSkips}`)
  console.log(`  TOTAL new bans expected:      ${newBooks + existingBookMatches}`)

  if (existingBookMatches > 0) {
    console.log(`\n── Existing-book hits (will be enriched with a new ban row)`)
    for (const p of plans.filter(p => p.kind === 'existing-book')) {
      const ex = bookBySlug.get(slugify(p.merged.title))
      console.log(`  book_${ex?.id?.toString().padStart(5)} "${ex?.title?.slice(0, 60)}"  ←  ${p.merged._collection.slug} (${p.merged._country}/${p.merged._scope_slug}/${p.merged._year_started})`)
    }
  }

  if (dedupSkips > 0) {
    console.log(`\n── Already in DB (will be skipped)`)
    for (const p of plans.filter(p => p.kind === 'skip-dedup' && p.existing_book_id)) {
      const ex = bookBySlug.get(slugify(p.merged.title))
      console.log(`  book_${ex?.id?.toString().padStart(5)} "${ex?.title?.slice(0, 60)}"  (${p.merged._country}/${p.merged._scope_slug}/${p.merged._year_started})`)
    }
  }

  if (newBooks > 0) {
    console.log(`\n── New books to create`)
    for (const p of plans.filter(p => p.kind === 'new')) {
      console.log(`  + "${p.merged.title.slice(0, 60)}" — ${p.merged.authors.join(', ').slice(0, 60)} (${p.merged._collection.slug})`)
    }
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──\n`)
    return
  }

  console.log(`\n── Applying writes ──`)
  let createdBooks = 0, createdAuthors = 0, createdBans = 0, errors = 0

  for (const p of plans) {
    if (p.kind === 'skip-dedup') continue
    const m = p.merged
    try {
      let bookId: number
      if (p.kind === 'existing-book' && p.existing_book_id) {
        bookId = p.existing_book_id
      } else {
        const slug = slugify(m.title)
        const { data: ex } = await supabase.from('books').select('id').eq('slug', slug).maybeSingle()
        if (ex) {
          bookId = (ex as { id: number }).id
        } else {
          const insertRow: Record<string, unknown> = {
            title: m.title,
            slug,
            ai_drafted: false,
            genres: [],
            cover_url: null,
          }
          if (m.first_published_year != null) insertRow.first_published_year = m.first_published_year
          if (m.original_language) insertRow.original_language = m.original_language
          const { data: nb, error: nbErr } = await supabase.from('books').insert(insertRow)
            .select('id, slug, title').single()
          if (nbErr) throw nbErr
          bookId = (nb as BookRow).id
          bookBySlug.set(slug, nb as BookRow)
          createdBooks++
        }
        // Authors
        for (const name of m.authors) {
          const beforeSize = authorBySlug.size
          const aId = await findOrCreateAuthor(name)
          if (aId && authorBySlug.size > beforeSize) createdAuthors++
          if (aId) {
            const { error: linkErr } = await supabase.from('book_authors')
              .upsert({ book_id: bookId, author_id: aId }, { onConflict: 'book_id,author_id' })
            if (linkErr && !linkErr.message.includes('duplicate')) {
              console.warn(`    ! book_authors link: ${fmtErr(linkErr)}`)
            }
          }
        }
      }

      const banRow = {
        book_id: bookId,
        country_code: m._country,
        scope_id: m._scope_id,
        action_type: m._action_type,
        status: m._status,
        region: m._region,
        institution: m._institution,
        year_started: m._year_started,
        year_ended: m._year_ended,
        description: buildDescription(m._collection, m),
        confidence: m._confidence,
      }
      const { data: bIns, error: bErr } = await supabase.from('bans').insert(banRow).select('id').single()
      if (bErr) throw bErr
      const banId = (bIns as { id: number }).id

      const sourceId = sourceIdByCollection.get(m._collection.slug)!
      const { error: linkErr } = await supabase.from('ban_source_links')
        .insert({ ban_id: banId, source_id: sourceId, locator: null })
      if (linkErr) throw linkErr

      const reasonRows = m.reasons.map(slug => ({ ban_id: banId, reason_id: reasonBySlug.get(slug)! }))
      if (reasonRows.length > 0) {
        const { error: rErr } = await supabase.from('ban_reason_links').insert(reasonRows)
        if (rErr) throw rErr
      }

      createdBans++
      process.stdout.write(`  bans ${createdBans}/${newBooks + existingBookMatches}\r`)
    } catch (err) {
      errors++
      console.error(`\n  ! "${m.title.slice(0, 60)}" (${m._collection.slug}): ${fmtErr(err)}`)
    }
  }
  process.stdout.write('\n')

  console.log(`\n── Done ──`)
  console.log(`  books created:    ${createdBooks}`)
  console.log(`  authors created:  ${createdAuthors}`)
  console.log(`  bans created:     ${createdBans}`)
  console.log(`  errors:           ${errors}`)
  const sanitiserEntries = Object.entries(sanitiserStats)
  if (sanitiserEntries.length > 0) {
    console.log(`  sanitiser fires:`)
    for (const [reason, n] of sanitiserEntries.sort((a, b) => b[1] - a[1])) {
      console.log(`    ${reason.padEnd(28)} ${n}`)
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
