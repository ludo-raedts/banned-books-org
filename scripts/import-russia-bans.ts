/**
 * Import Russia banned-books from two complementary sources:
 *
 *   1. data/russia-articles-batch1.json — hand-curated, well-attested cases
 *      from independent Russian-press reporting 2024-2026 (Meduza, The
 *      Insider, Moscow Times). ~9 entries covering Prosecutor-General bans
 *      (Springfield, Mouse), LGBT-register restrictions (Netochka Nezvanova,
 *      Different Seasons), and publisher-fining cases (Beartown, Everybody).
 *
 *   2. data/russia-minjust-batch1.json — Federal List of Extremist Materials
 *      (Минюст RSS, public registry). ~498 book-like entries, court-ordered.
 *      Many auto-tagged needs_review=true; description carries an editor flag.
 *
 * Source rows:
 *   - Federal List of Extremist Materials (Минюст) — source_type='government'
 *   - Independent Russian-press reporting on 2024-2026 book restrictions
 *     — source_type='news', verification_status='reviewed'
 *
 * All entries land under country_code='RU', scope='government'. Dedup is by
 * (book_slug, year_started) — matches the PEN-Belarus convention. The Минюст
 * feed and the article batch overlap minimally: any same-book-same-year hit
 * is dropped with a 'skip-dedup' marker in the dry-run summary.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-russia-bans.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-russia-bans.ts --apply
 *   pnpm tsx --env-file=.env.local scripts/import-russia-bans.ts --only=articles
 *   pnpm tsx --env-file=.env.local scripts/import-russia-bans.ts --only=minjust
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { canonicaliseAuthorName } from '../src/lib/imports/canonicalise-author-name'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// BGN/PCGN-style Cyrillic → ASCII map (no diacritics) used to generate slugs
// for Russian-script titles and author names. The original Cyrillic stays in
// the title / display_name columns; this only feeds slugify().
const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ѵ: 'i', ѳ: 'f', і: 'i', ѣ: 'ye',  // pre-1918 Russian
  ў: 'w', ў̆: 'w',                     // Belarusian
  ї: 'yi', є: 'ye', ґ: 'g',          // Ukrainian
}
function transliterateCyrillic(s: string): string {
  let out = ''
  for (const ch of s) {
    const lower = ch.toLowerCase()
    if (CYRILLIC_MAP[lower] !== undefined) {
      const mapped = CYRILLIC_MAP[lower]
      out += ch === lower ? mapped : (mapped[0]?.toUpperCase() ?? '') + mapped.slice(1)
    } else {
      out += ch
    }
  }
  return out
}

function slugifyMaybeCyrillic(s: string): string {
  // Always transliterate Cyrillic first so the full title contributes to the
  // slug. (Plain slugify() would otherwise return a useless leftover-token
  // slug like "iii" or "1941-1945" when the Cyrillic body is stripped but a
  // Latin/numeric tail survives.)
  return slugify(transliterateCyrillic(s))
}

const APPLY = process.argv.includes('--apply')
const ONLY_ARG = process.argv.find(a => a.startsWith('--only='))
const ONLY = ONLY_ARG ? ONLY_ARG.slice(7) : 'both'   // articles | minjust | both
const MIN_YEAR_ARG = process.argv.find(a => a.startsWith('--min-year='))
const MIN_YEAR = MIN_YEAR_ARG ? parseInt(MIN_YEAR_ARG.slice(11), 10) : null  // applies to Минюст entries only

const ARTICLES_PATH = join(process.cwd(), 'data/russia-articles-batch1.json')
const MINJUST_PATH = join(process.cwd(), 'data/russia-minjust-batch1.json')

const ANONYMOUS_AUTHOR_ID = 33
const BAN_INSERT_BATCH = 100

type SourceLabel = 'articles' | 'minjust'
type ReasonSlug = 'political' | 'religious' | 'racial' | 'lgbtq' | 'other'
type ActionType = 'banned' | 'restricted' | 'removed' | 'challenged' | 'blocked'

interface ArticleEntry {
  title: string
  authors: string[]
  original_language: string | null
  first_published_year: number | null
  ban_year: number
  action_type: ActionType
  reason_slug: ReasonSlug
  authority: string
  description: string
  primary_source_url: string
}

interface MinjustEntry {
  list_number: number
  list_url: string
  title: string | null
  authors: string[]
  first_published_year: number | null
  isbn: string | null
  publisher: string | null
  court_decision: string | null
  decision_date: string | null
  inclusion_date: string
  ban_year: number | null
  reason_slug: ReasonSlug
  needs_review: boolean
  raw_description: string
}

interface UnifiedEntry {
  source: SourceLabel
  title: string
  authors: string[]
  original_language: string | null
  first_published_year: number | null
  ban_year: number | null
  action_type: ActionType
  reason_slug: ReasonSlug
  description: string
  locator: string                  // e.g. "Минюст entry #5499" or "Article: theins.press 291910"
  needs_review: boolean
}

const supabase = adminClient()

interface BookRow { id: number; slug: string; title: string }
interface AuthorRow { id: number; slug: string; display_name: string }

const bookBySlug = new Map<string, BookRow>()
const authorBySlug = new Map<string, AuthorRow>()
const existingRuBans = new Set<string>()  // key = `${book_id}|${year_started}`

function fmtErr(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string; hint?: string }
    return [e.code, e.message, e.details, e.hint].filter(Boolean).join(' | ') || JSON.stringify(err)
  }
  return String(err)
}

function loadArticleEntries(): UnifiedEntry[] {
  const raw = JSON.parse(readFileSync(ARTICLES_PATH, 'utf-8')) as {
    entries: ArticleEntry[]
  }
  return raw.entries.map(e => ({
    source: 'articles',
    title: e.title,
    authors: e.authors,
    original_language: e.original_language,
    first_published_year: e.first_published_year,
    ban_year: e.ban_year,
    action_type: e.action_type,
    reason_slug: e.reason_slug,
    description: `${e.description} Authority: ${e.authority}.`,
    locator: e.primary_source_url,
    needs_review: false,
  }))
}

function loadMinjustEntries(): UnifiedEntry[] {
  const raw = JSON.parse(readFileSync(MINJUST_PATH, 'utf-8')) as {
    entries: MinjustEntry[]
  }
  const out: UnifiedEntry[] = []
  for (const e of raw.entries) {
    if (!e.title) continue        // can't import without a title
    if (e.title.length < 3) continue
    if (MIN_YEAR !== null && (e.ban_year ?? 0) < MIN_YEAR) continue
    const descParts: string[] = []
    descParts.push(`Listed on Russia's Federal List of Extremist Materials (Минюст) as entry #${e.list_number}.`)
    if (e.publisher) descParts.push(`Publisher: ${e.publisher}.`)
    if (e.first_published_year) descParts.push(`First published: ${e.first_published_year}.`)
    if (e.court_decision) descParts.push(`Court decision: ${e.court_decision}.`)
    if (e.inclusion_date) descParts.push(`Added to list: ${e.inclusion_date}.`)
    if (e.isbn) descParts.push(`ISBN: ${e.isbn}.`)
    if (e.needs_review) descParts.push(`[Editor review needed — auto-parsed from Минюст RSS, bibliographic fields may be incomplete.]`)
    out.push({
      source: 'minjust',
      title: e.title,
      authors: e.authors,
      original_language: null,
      first_published_year: e.first_published_year,
      ban_year: e.ban_year,
      action_type: 'banned',
      reason_slug: e.reason_slug,
      description: descParts.join(' '),
      locator: `Минюст entry #${e.list_number}`,
      needs_review: e.needs_review,
    })
  }
  return out
}

async function loadDB(): Promise<{
  govScopeId: number
  reasonIds: Record<ReasonSlug, number>
  minjustSourceId: number
  articlesSourceId: number
}> {
  // Books
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

  // Authors
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

  // Vocab
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const govScopeId = (scopes as Array<{ id: number; slug: string }>).find(s => s.slug === 'government')!.id

  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const reasonsList = reasons as Array<{ id: number; slug: string }>
  const findReason = (slug: string) => reasonsList.find(r => r.slug === slug)!.id
  const reasonIds: Record<ReasonSlug, number> = {
    political: findReason('political'),
    religious: findReason('religious'),
    racial: findReason('racial'),
    lgbtq: findReason('lgbtq'),
    other: findReason('other'),
  }

  // Existing RU bans for dedup — pull all (not just government scope) so we
  // don't double-add against the prior wikipedia-list import.
  offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('bans').select('book_id, year_started')
      .eq('country_code', 'RU').order('id').range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const b of data as { book_id: number; year_started: number | null }[]) {
      existingRuBans.add(`${b.book_id}|${b.year_started ?? ''}`)
    }
    if (data.length < 1000) break
    offset += 1000
  }

  // Upsert ban_sources
  async function upsertSource(
    name: string, url: string, source_type: 'government' | 'news',
    verification: 'verified' | 'pending' | 'unverified' | 'broken',
  ): Promise<number> {
    const { data: src, error: srcErr } = await supabase
      .from('ban_sources').upsert({
        source_name: name, source_url: url, source_type,
        verification_status: verification,
      }, { onConflict: 'source_url' }).select('id').single()
    if (srcErr) throw srcErr
    return (src as { id: number }).id
  }

  const minjustSourceId = await upsertSource(
    'Russian Ministry of Justice — Federal List of Extremist Materials',
    'https://minjust.gov.ru/ru/extremist-materials/',
    'government', 'verified',
  )
  const articlesSourceId = await upsertSource(
    'Independent Russian-press reporting on 2024-2026 book restrictions',
    'https://theins.press/en/society/291910',
    'news', 'verified',
  )

  return { govScopeId, reasonIds, minjustSourceId, articlesSourceId }
}

async function findOrCreateAuthor(rawName: string): Promise<number | null> {
  const displayName = canonicaliseAuthorName(rawName)
  const slug = slugifyMaybeCyrillic(displayName)
  if (!slug) return null
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

type Plan = { entry: UnifiedEntry; kind: 'new' | 'existing-book' | 'skip-dedup' | 'skip-bad'; existing_book_id?: number; skip_reason?: string }

async function main() {
  console.log(`\n── import-russia-bans ── (${APPLY ? 'APPLY' : 'DRY-RUN'}) only=${ONLY}${MIN_YEAR !== null ? ` min-year=${MIN_YEAR}` : ''}\n`)

  let entries: UnifiedEntry[] = []
  if (ONLY === 'both' || ONLY === 'articles') entries = entries.concat(loadArticleEntries())
  if (ONLY === 'both' || ONLY === 'minjust') entries = entries.concat(loadMinjustEntries())
  console.log(`  loaded ${entries.length} entries (articles=${entries.filter(e => e.source === 'articles').length} minjust=${entries.filter(e => e.source === 'minjust').length})`)

  const { govScopeId, reasonIds, minjustSourceId, articlesSourceId } = await loadDB()
  console.log(`  books in DB:           ${bookBySlug.size}`)
  console.log(`  authors in DB:         ${authorBySlug.size}`)
  console.log(`  existing RU bans:      ${existingRuBans.size}`)
  console.log(`  source IDs:            articles=${articlesSourceId} minjust=${minjustSourceId}`)

  // Plan phase
  const plans: Plan[] = []
  const queuedSlugYear = new Set<string>()
  let newBooks = 0, existingBookMatches = 0, dedupSkips = 0, inRunDupSkips = 0, badSkips = 0
  for (const e of entries) {
    const slug = slugifyMaybeCyrillic(e.title)
    if (!slug || slug.length < 2) {
      plans.push({ entry: e, kind: 'skip-bad', skip_reason: 'empty/too-short slug' })
      badSkips++
      continue
    }
    const slugYearKey = `${slug}|${e.ban_year ?? ''}`
    const existing = bookBySlug.get(slug)
    if (existing) {
      const dedupKey = `${existing.id}|${e.ban_year ?? ''}`
      if (existingRuBans.has(dedupKey)) {
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

  const reasonDist: Record<string, number> = {}
  const actionDist: Record<string, number> = {}
  for (const p of plans) {
    if (p.kind === 'new' || p.kind === 'existing-book') {
      reasonDist[p.entry.reason_slug] = (reasonDist[p.entry.reason_slug] ?? 0) + 1
      actionDist[p.entry.action_type] = (actionDist[p.entry.action_type] ?? 0) + 1
    }
  }

  console.log(`\n── Plan summary`)
  console.log(`  new book + new ban:      ${newBooks}`)
  console.log(`  new ban on existing book: ${existingBookMatches}`)
  console.log(`  dedup skip (DB):          ${dedupSkips}`)
  console.log(`  dedup skip (in-run):      ${inRunDupSkips}`)
  console.log(`  bad-slug skip:            ${badSkips}`)
  console.log(`  TOTAL new bans expected:  ${newBooks + existingBookMatches}`)
  console.log(`  reason mix:               ${Object.entries(reasonDist).map(([k, v]) => `${k}=${v}`).join(' ')}`)
  console.log(`  action mix:               ${Object.entries(actionDist).map(([k, v]) => `${k}=${v}`).join(' ')}`)

  if (existingBookMatches > 0) {
    console.log(`\n── Sample existing-book hits (first 15)`)
    for (const p of plans.filter(p => p.kind === 'existing-book').slice(0, 15)) {
      const ex = bookBySlug.get(slugifyMaybeCyrillic(p.entry.title))
      console.log(`  book_${ex?.id} "${ex?.title}" ← ${p.entry.source} (${p.entry.ban_year})`)
    }
  }

  if (dedupSkips > 0) {
    console.log(`\n── Sample dedup skips (DB already has, first 10)`)
    for (const p of plans.filter(p => p.kind === 'skip-dedup' && p.existing_book_id).slice(0, 10)) {
      const ex = bookBySlug.get(slugifyMaybeCyrillic(p.entry.title))
      console.log(`  book_${ex?.id} "${ex?.title}" ← ${p.entry.source} (${p.entry.ban_year}) — already in DB`)
    }
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──\n`)
    return
  }

  console.log(`\n── Applying writes ──`)
  let createdBooks = 0, createdAuthors = 0, createdBans = 0, errors = 0
  type BanPrep = { book_id: number; entry: UnifiedEntry }
  const banQueue: BanPrep[] = []

  for (const p of plans) {
    if (p.kind === 'skip-dedup' || p.kind === 'skip-bad') continue
    try {
      let bookId: number
      if (p.kind === 'existing-book' && p.existing_book_id) {
        bookId = p.existing_book_id
      } else {
        const slug = slugifyMaybeCyrillic(p.entry.title)
        // Race-safety: re-check on insert
        const { data: ex } = await supabase.from('books').select('id').eq('slug', slug).maybeSingle()
        if (ex) {
          bookId = (ex as { id: number }).id
        } else {
          const { data: nb, error: nbErr } = await supabase.from('books').insert({
            title: p.entry.title,
            slug,
            original_language: p.entry.original_language,
            first_published_year: p.entry.first_published_year,
            ai_drafted: false,
            genres: [],
            cover_url: null,
          }).select('id').single()
          if (nbErr) throw nbErr
          bookId = (nb as { id: number }).id
          bookBySlug.set(slug, { id: bookId, slug, title: p.entry.title })
          createdBooks++
        }

        // Authors
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
      banQueue.push({ book_id: bookId, entry: p.entry })
    } catch (err) {
      errors++
      console.error(`  ! "${p.entry.title.slice(0, 60)}" (${p.entry.source}): ${fmtErr(err)}`)
    }
  }

  console.log(`  ${banQueue.length} bans queued (books created: ${createdBooks}, authors created: ${createdAuthors})`)

  for (let i = 0; i < banQueue.length; i += BAN_INSERT_BATCH) {
    const chunk = banQueue.slice(i, i + BAN_INSERT_BATCH)
    const rows = chunk.map(b => ({
      book_id: b.book_id,
      country_code: 'RU',
      scope_id: govScopeId,
      action_type: b.entry.action_type,
      status: 'active',
      region: null,
      institution: null,
      year_started: b.entry.ban_year,
      year_ended: null,
      description: b.entry.description,
      confidence: 'reported' as const,
    }))
    try {
      const { data: inserted, error } = await supabase.from('bans').insert(rows).select('id')
      if (error) throw error
      const ids = (inserted as Array<{ id: number }>).map(r => r.id)
      const linkRows = ids.map((id, idx) => ({
        ban_id: id,
        source_id: chunk[idx].entry.source === 'articles' ? articlesSourceId : minjustSourceId,
        locator: chunk[idx].entry.locator,
      }))
      const { error: linkErr } = await supabase.from('ban_source_links').insert(linkRows)
      if (linkErr) throw linkErr
      const reasonRows = ids.map((id, idx) => ({ ban_id: id, reason_id: reasonIds[chunk[idx].entry.reason_slug] }))
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
