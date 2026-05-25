/**
 * Import Indian Kanoon court-judgment data for India book bans.
 *
 * Each entry in `data/india-kanoon-batch1.json` is a single court case
 * (Section 95 CrPC forfeiture review or Customs Act import-ban challenge).
 * One `books[]` entry within a case becomes one `bans` row keyed on
 * (book × IN × government × ban_year × state). All books in the same case
 * share one `ban_sources` row (the Indian Kanoon URL).
 *
 * Discovery + extraction was done in ChatGPT against indiankanoon.org;
 * direct WebFetch validation of URLs returned 403 (Indian Kanoon's bot
 * filter), so each ban lands as `verification_status='unverified'` per
 * Sprint A doctrine — editor opens the case-URL in a browser to verify.
 *
 * Dedup: per-book `existing_book_id` override hints which entries should
 * attach to an already-present book rather than creating a new row. Two
 * known matches with current DB:
 *   - book_id 6282 "Islam: A Concept of Political World Invasion" (Bhasin 2007 MH)
 *   - book_id 6325 "Meendezhum Pandiyar Varalaru" (Senthil Mallar 2013 TN)
 *
 * For each ban: status mapping from ruling_outcome:
 *   forfeiture_upheld     → 'historical' (ban stands)
 *   forfeiture_set_aside  → 'rescinded'  + year_ended = ruling_date year
 *   partially_upheld      → use per_book_outcome (book-level) if present, else 'historical'
 *   unclear               → 'unclear'
 *
 * Reason slug from IPC sections cited in legal_basis (prefer narrower):
 *   295A → 'religious'   (deliberate religious offence)
 *   153A → 'racial'      (enmity between groups — covers caste, communal)
 *   124A → 'political'   (sedition)
 *   292/293 → 'obscenity'
 * If multiple cited, prefer in this order: religious > obscenity > political > racial.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-india-kanoon-json.ts            # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-india-kanoon-json.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { readFileSync } from 'fs'
import { join } from 'path'

const APPLY = process.argv.includes('--apply')
const JSON_PATH = join(process.cwd(), 'data/india-kanoon-batch1.json')

type Outcome = 'forfeiture_upheld' | 'forfeiture_set_aside' | 'partially_upheld' | 'unclear'
type BanStatus = 'active' | 'historical' | 'rescinded' | 'unclear'

interface KanoonBook {
  title: string
  author: string | null
  publisher: string | null
  language: string | null
  ban_year: number | null
  state: string
  existing_book_id?: number      // dedup override
  per_book_outcome?: Outcome     // overrides case-level for partially_upheld cases
}

interface KanoonCase {
  case_id: string
  url: string
  case_title: string
  ruling_date: string            // ISO yyyy-mm-dd
  court: string
  legal_basis: string
  ruling_outcome: Outcome
  books: KanoonBook[]
  motif: string
  uncertainty: string | null
}

function reasonSlugFromLegalBasis(s: string): 'religious' | 'racial' | 'political' | 'obscenity' | 'other' {
  const lc = s.toLowerCase()
  if (/295\s?a/.test(lc)) return 'religious'
  if (/29[23]/.test(lc)) return 'obscenity'
  if (/124\s?a|sedition/.test(lc)) return 'political'
  if (/153\s?a|enmity|hatred between/.test(lc)) return 'racial'
  return 'other'
}

function statusFromOutcome(c: KanoonCase, b: KanoonBook): { status: BanStatus; year_ended: number | null } {
  const o = b.per_book_outcome ?? c.ruling_outcome
  if (o === 'forfeiture_set_aside') {
    return { status: 'rescinded', year_ended: parseInt(c.ruling_date.slice(0, 4)) }
  }
  if (o === 'forfeiture_upheld') return { status: 'historical', year_ended: null }
  if (o === 'partially_upheld') return { status: 'historical', year_ended: null }   // shouldn't reach here with per_book_outcome set
  return { status: 'unclear', year_ended: null }
}

function buildDescription(c: KanoonCase, b: KanoonBook): string {
  const lang = b.language ? ` (${b.language})` : ''
  const pub = b.publisher ? ` Published by ${b.publisher}.` : ''
  const outcome = b.per_book_outcome ?? c.ruling_outcome
  const outcomePhrase = outcome === 'forfeiture_set_aside'
    ? `Forfeiture set aside by the ${c.court} on ${c.ruling_date}`
    : outcome === 'forfeiture_upheld'
      ? `Forfeiture upheld by the ${c.court} on ${c.ruling_date}`
      : outcome === 'partially_upheld'
        ? `Case had mixed outcome before the ${c.court} on ${c.ruling_date}`
        : `Case outcome unclear from available ${c.court} text (ruled ${c.ruling_date})`
  const yearPart = b.ban_year ? `Forfeited ${b.ban_year}` : `Forfeiture order (year not documented)`
  const langTitle = `«${b.title}»${lang}`
  return `${yearPart} by the ${b.state} government under ${c.legal_basis}.${pub} Motif: «${c.motif}». ${outcomePhrase}. Case: ${c.case_title}. Subject: ${langTitle}.`
}

interface BanRow {
  id: number; book_id: number; year_started: number | null; region: string | null
  status: BanStatus
}

async function main() {
  console.log(`\n── import-india-kanoon — ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)

  const cases: KanoonCase[] = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  const totalBooks = cases.reduce((n, c) => n + c.books.length, 0)
  console.log(`Cases:        ${cases.length}`)
  console.log(`Book entries: ${totalBooks}`)

  const supabase = adminClient()

  // Resolve school+scope ids; reasons; existing-book sanity
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const govScopeId = scopes!.find(s => s.slug === 'government')!.id as number

  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  type ReasonRow = { id: number; slug: string }
  const reasonBySlug = new Map<string, number>((reasons as ReasonRow[]).map(r => [r.slug, r.id]))

  // Verify any existing_book_id overrides resolve
  const overrideIds = cases.flatMap(c => c.books.map(b => b.existing_book_id).filter(Boolean) as number[])
  if (overrideIds.length) {
    const { data: existing } = await supabase.from('books').select('id, title, slug').in('id', overrideIds)
    const resolved = new Set((existing ?? []).map(b => (b as { id: number }).id))
    const missing = overrideIds.filter(id => !resolved.has(id))
    if (missing.length) {
      console.error(`Pre-check fail: existing_book_id not in DB: ${missing.join(', ')}`)
      process.exit(1)
    }
    console.log(`Override book IDs all present: ${overrideIds.join(', ')}`)
  }

  // For each existing-override, also fetch its current IN ban (year+state match) for ban-attach
  const overrideBanMap = new Map<string, BanRow>() // key = `${book_id}|${year}|${state}`
  if (overrideIds.length) {
    const { data: bd } = await supabase
      .from('bans')
      .select('id, book_id, year_started, region, status')
      .in('book_id', overrideIds)
      .eq('country_code', 'IN')
    for (const r of (bd ?? []) as BanRow[]) {
      const key = `${r.book_id}|${r.year_started ?? ''}|${r.region ?? ''}`
      overrideBanMap.set(key, r)
    }
  }

  // Plan
  type Plan = {
    case_idx: number
    book_idx: number
    kind: 'new_book' | 'add_source_to_existing_ban' | 'add_source_with_region_fix'
    existing_ban_id?: number
    existing_book_id?: number
    book: KanoonBook
    case_: KanoonCase
    status: BanStatus
    year_ended: number | null
    reason_slug: string
  }
  const plans: Plan[] = []

  for (let ci = 0; ci < cases.length; ci++) {
    const c = cases[ci]
    const reasonSlug = reasonSlugFromLegalBasis(c.legal_basis)
    for (let bi = 0; bi < c.books.length; bi++) {
      const b = c.books[bi]
      const { status, year_ended } = statusFromOutcome(c, b)

      if (b.existing_book_id) {
        // Match an existing ban (book × year × state); if year is in DB but region NULL, plan a region fix
        const exactKey = `${b.existing_book_id}|${b.ban_year ?? ''}|${b.state}`
        const nullRegionKey = `${b.existing_book_id}|${b.ban_year ?? ''}|`
        const exact = overrideBanMap.get(exactKey)
        const nullRegion = overrideBanMap.get(nullRegionKey)
        if (exact) {
          plans.push({ case_idx: ci, book_idx: bi, kind: 'add_source_to_existing_ban',
                       existing_ban_id: exact.id, existing_book_id: b.existing_book_id,
                       book: b, case_: c, status, year_ended, reason_slug: reasonSlug })
          continue
        }
        if (nullRegion) {
          plans.push({ case_idx: ci, book_idx: bi, kind: 'add_source_with_region_fix',
                       existing_ban_id: nullRegion.id, existing_book_id: b.existing_book_id,
                       book: b, case_: c, status, year_ended, reason_slug: reasonSlug })
          continue
        }
        // existing_book_id given but no matching ban → treat as new ban on existing book
        // (Schema-wise: create new ban with book_id = existing_book_id)
        plans.push({ case_idx: ci, book_idx: bi, kind: 'new_book',
                     existing_book_id: b.existing_book_id,
                     book: b, case_: c, status, year_ended, reason_slug: reasonSlug })
        continue
      }

      plans.push({ case_idx: ci, book_idx: bi, kind: 'new_book',
                   book: b, case_: c, status, year_ended, reason_slug: reasonSlug })
    }
  }

  const newBookCount = plans.filter(p => p.kind === 'new_book' && !p.existing_book_id).length
  const newBanOnExistingBook = plans.filter(p => p.kind === 'new_book' && p.existing_book_id).length
  const addSourceCount = plans.filter(p => p.kind === 'add_source_to_existing_ban').length
  const regionFixCount = plans.filter(p => p.kind === 'add_source_with_region_fix').length

  console.log(`\n── Plan summary`)
  console.log(`  new book + new ban:               ${newBookCount}`)
  console.log(`  new ban on existing book:         ${newBanOnExistingBook}`)
  console.log(`  add source to existing ban:       ${addSourceCount}`)
  console.log(`  add source + fix region on ban:   ${regionFixCount}`)

  console.log(`\n── Per-entry plan`)
  for (const p of plans) {
    const tag = p.kind === 'new_book' ? (p.existing_book_id ? 'new-ban-existing-book' : 'new-book+ban')
              : p.kind === 'add_source_to_existing_ban' ? 'add-src'
              : 'add-src+region'
    console.log(`  ${tag.padEnd(22)} | ${p.book.state.padEnd(18)} | ${p.book.ban_year ?? '????'} | ${p.status.padEnd(10)} | ${p.book.author?.slice(0, 28).padEnd(28) ?? '(no author)              '} | ${p.book.title.slice(0, 55)}`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply to write. ──\n`)
    return
  }

  // ── APPLY ──
  console.log(`\n── Applying writes ──`)
  let createdBooks = 0, createdBans = 0, createdAuthors = 0, addedSources = 0, regionFixes = 0, errors = 0

  // Group plans by case so we share one ban_source per case
  const byCase = new Map<number, Plan[]>()
  for (const p of plans) {
    if (!byCase.has(p.case_idx)) byCase.set(p.case_idx, [])
    byCase.get(p.case_idx)!.push(p)
  }

  for (const [caseIdx, casePlans] of byCase) {
    const c = cases[caseIdx]
    // Upsert source row
    const { data: src, error: srcErr } = await supabase
      .from('ban_sources')
      .upsert({
        source_name: c.case_title,
        source_url: c.url,
        source_type: 'government',
        verification_status: 'unverified' as const,
      }, { onConflict: 'source_url' })
      .select('id').single()
    if (srcErr) { console.error(`! source ${c.case_title}: ${srcErr.message}`); errors++; continue }
    const sourceId = (src as { id: number }).id

    for (const p of casePlans) {
      try {
        let banId: number

        if (p.kind === 'add_source_to_existing_ban' && p.existing_ban_id) {
          banId = p.existing_ban_id
        } else if (p.kind === 'add_source_with_region_fix' && p.existing_ban_id) {
          banId = p.existing_ban_id
          // Region fix
          const { error: rfErr } = await supabase.from('bans')
            .update({ region: p.book.state }).eq('id', banId)
          if (rfErr) throw rfErr
          regionFixes++
        } else {
          // new_book or new ban on existing book
          let bookId: number
          if (p.existing_book_id) {
            bookId = p.existing_book_id
          } else {
            // Create book
            const slug = slugify(p.book.title)
            // Race-safe: re-check existing
            const { data: ex } = await supabase.from('books').select('id').eq('slug', slug).maybeSingle()
            if (ex) {
              bookId = (ex as { id: number }).id
            } else {
              const { data: nb, error: nbErr } = await supabase.from('books').insert({
                title: p.book.title,
                slug,
                original_language: p.book.language,
                first_published_year: null,
                ai_drafted: false,
                genres: [],
                cover_url: null,
              }).select('id').single()
              if (nbErr) throw nbErr
              bookId = (nb as { id: number }).id
              createdBooks++
            }

            // Author handling
            if (p.book.author) {
              const aSlug = slugify(p.book.author)
              const { data: ea } = await supabase.from('authors').select('id').eq('slug', aSlug).maybeSingle()
              let authorId: number
              if (ea) {
                authorId = (ea as { id: number }).id
              } else {
                const { data: na, error: naErr } = await supabase.from('authors').insert({
                  slug: aSlug, display_name: p.book.author, is_placeholder: false,
                }).select('id').single()
                if (naErr) throw naErr
                authorId = (na as { id: number }).id
                createdAuthors++
              }
              await supabase.from('book_authors').insert({ book_id: bookId, author_id: authorId })
            }
          }

          // Create ban
          const { data: nbAn, error: nbAnErr } = await supabase.from('bans').insert({
            book_id: bookId,
            country_code: 'IN',
            scope_id: govScopeId,
            action_type: 'banned',
            status: p.status,
            region: p.book.state,
            institution: null,
            year_started: p.book.ban_year,
            year_ended: p.year_ended,
            description: buildDescription(p.case_, p.book),
            confidence: 'reported',
          }).select('id').single()
          if (nbAnErr) throw nbAnErr
          banId = (nbAn as { id: number }).id
          createdBans++

          // Reason link
          const reasonId = reasonBySlug.get(p.reason_slug) ?? reasonBySlug.get('other')
          if (reasonId) {
            await supabase.from('ban_reason_links').insert({ ban_id: banId, reason_id: reasonId })
          }
        }

        // Source link (idempotent — composite PK on (ban_id, source_id))
        const { error: linkErr } = await supabase
          .from('ban_source_links')
          .insert({ ban_id: banId, source_id: sourceId })
        if (linkErr && !linkErr.message.includes('duplicate key')) throw linkErr
        addedSources++

      } catch (err) {
        errors++
        const msg = err instanceof Error ? err.message : JSON.stringify(err)
        console.error(`  ! "${p.book.title}" (${p.case_.case_title}): ${msg}`)
      }
    }
  }

  console.log(`\n── Done ──`)
  console.log(`  books created:        ${createdBooks}`)
  console.log(`  authors created:      ${createdAuthors}`)
  console.log(`  bans created:         ${createdBans}`)
  console.log(`  ban_source_links:     ${addedSources}`)
  console.log(`  region fixes:         ${regionFixes}`)
  console.log(`  errors:               ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
