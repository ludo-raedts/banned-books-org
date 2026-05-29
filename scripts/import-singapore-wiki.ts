/**
 * Import Singapore book bans curated from EN Wikipedia.
 *
 * Source:
 *   "List of books banned by governments" (EN Wikipedia) — Singapore section.
 *   Cross-referenced against the Wikipedia article on the Undesirable
 *   Publications Act 1967.
 *
 * Two cohorts:
 *   (A) Marxist / anti-colonial books banned under the Internal Security
 *       (Prohibition of Publications) (Consolidation) Order (effective
 *       early-1960s onwards in Singapore). Most were lifted in the 2015
 *       unban of 240 publications. → status='rescinded', year_ended=2015.
 *   (B) Recent Islamic / religious-content bans 2018-2021 under the UPA.
 *       → status='active'.
 *   (C) One photobook (Madonna's "Sex", 1992) which is already in the DB
 *       under title "Madonna Erotica" as book 12249. → existing_book_id
 *       override.
 *
 * Schema:
 *   - 1 ban_sources row → Wikipedia article URL (source_type='wikipedia')
 *   - per author: lookup by slug; create if new. Multi-author entries
 *     ("Cherian George and Sonny Liew") split on ' and '.
 *   - per book: lookup by slug, or by `existing_book_id` override hint
 *   - per ban: country_code='SG', scope='government', action_type='banned',
 *     status per entry, year_started/year_ended per entry, reason per
 *     entry, confidence='reported', verification_status='unverified'
 *   - per-link locator = "Wikipedia table row" (the source has no per-entry
 *     stable URL)
 *
 * Dedup:
 *   - 3 entries already in DB (Value Price Profit, Satanic Verses, What
 *     Islam Is All About) and excluded from JSON. Year-overlap check on
 *     same book + SG + year handled by import-script idempotency.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-singapore-wiki.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-singapore-wiki.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { readFileSync } from 'fs'
import { join } from 'path'

const APPLY = process.argv.includes('--apply')
const JSON_PATH = join(process.cwd(), 'data/singapore-batch1.json')

const VALID_REASONS = new Set(['political', 'religious', 'obscenity', 'racial', 'sexual', 'moral', 'other'])
const VALID_STATUSES = new Set(['active', 'historical', 'rescinded', 'unclear'])

interface Entry {
  title: string
  title_variants?: string[]
  author: string
  existing_book_id?: number
  year_started: number
  year_ended: number | null
  status: 'active' | 'historical' | 'rescinded' | 'unclear'
  reason_slug: string
  description: string
}

interface InputFile {
  source_url: string
  source_name: string
  source_type: string
  entries: Entry[]
}

function fmtErr(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string; hint?: string }
    return [e.code, e.message, e.details, e.hint].filter(Boolean).join(' | ') || JSON.stringify(err)
  }
  return String(err)
}

/** "Cherian George and Sonny Liew" → two authors */
function splitAuthors(raw: string): string[] {
  return raw.split(/\s+and\s+/).map(s => s.trim()).filter(s => s.length > 0)
}

const supabase = adminClient()

async function main() {
  console.log(`\n── import-singapore-wiki ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const input: InputFile = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  console.log(`Loaded ${input.entries.length} curated Singapore entries.`)

  // Validate
  for (const e of input.entries) {
    if (!VALID_REASONS.has(e.reason_slug)) throw new Error(`Unknown reason_slug "${e.reason_slug}" for "${e.title}"`)
    if (!VALID_STATUSES.has(e.status)) throw new Error(`Unknown status "${e.status}" for "${e.title}"`)
  }

  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const govScopeId = (scopes as Array<{ id: number; slug: string }>).find(s => s.slug === 'government')!.id
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const reasonBySlug = new Map<string, number>()
  for (const r of (reasons as Array<{ id: number; slug: string }>)) reasonBySlug.set(r.slug, r.id)

  const { data: src, error: srcErr } = await supabase.from('ban_sources').upsert({
    source_name: input.source_name,
    source_url: input.source_url,
    source_type: input.source_type,
    verification_status: 'unverified' as const,
  }, { onConflict: 'source_url' }).select('id').single()
  if (srcErr) throw srcErr
  const sourceId = (src as { id: number }).id
  console.log(`  source_id: ${sourceId}`)

  console.log(`\n── Plan`)
  for (const e of input.entries) {
    const slug = slugify(e.title)
    const lookup = e.existing_book_id
      ? await supabase.from('books').select('id, title').eq('id', e.existing_book_id).maybeSingle()
      : await supabase.from('books').select('id, title').eq('slug', slug).maybeSingle()
    const ex = lookup.data
    const tag = ex ? `existing book_${(ex as { id: number }).id}` : 'NEW book'
    console.log(`  [${tag.padEnd(22)}] "${e.title}" by ${e.author}  [${e.status}/${e.reason_slug}, ${e.year_started}${e.year_ended ? `-${e.year_ended}` : ''}]`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──\n`)
    return
  }

  console.log(`\n── Applying ──`)
  let createdBooks = 0, createdAuthors = 0, createdBans = 0, skipped = 0, errors = 0

  for (const e of input.entries) {
    try {
      const slug = slugify(e.title)
      const lookup = e.existing_book_id
        ? await supabase.from('books').select('id').eq('id', e.existing_book_id).maybeSingle()
        : await supabase.from('books').select('id').eq('slug', slug).maybeSingle()
      let bookId: number
      const existingBook = lookup.data
      if (existingBook) {
        bookId = (existingBook as { id: number }).id
      } else {
        const { data: nb, error: nbErr } = await supabase.from('books').insert({
          title: e.title,
          slug,
          ai_drafted: false,
          genres: [],
          cover_url: null,
        }).select('id').single()
        if (nbErr) throw nbErr
        bookId = (nb as { id: number }).id
        createdBooks++

        // Link authors
        const authorNames = splitAuthors(e.author)
        for (const aName of authorNames) {
          const aSlug = slugify(aName)
          const { data: ea } = await supabase.from('authors').select('id').eq('slug', aSlug).maybeSingle()
          let authorId: number
          if (ea) {
            authorId = (ea as { id: number }).id
          } else {
            const { data: na, error: naErr } = await supabase.from('authors').insert({
              slug: aSlug,
              display_name: aName,
              is_placeholder: false,
            }).select('id').single()
            if (naErr) throw naErr
            authorId = (na as { id: number }).id
            createdAuthors++
          }
          await supabase.from('book_authors').insert({ book_id: bookId, author_id: authorId })
        }
      }

      // Dedup ban: same book + SG + government + year_started + region/institution NULL
      const { data: existingBan } = await supabase.from('bans').select('id')
        .eq('book_id', bookId).eq('country_code', 'SG').eq('scope_id', govScopeId)
        .eq('year_started', e.year_started).is('region', null).is('institution', null)
        .maybeSingle()
      let banId: number
      if (existingBan) {
        banId = (existingBan as { id: number }).id
        skipped++
      } else {
        const { data: nb, error: bErr } = await supabase.from('bans').insert({
          book_id: bookId,
          country_code: 'SG',
          scope_id: govScopeId,
          action_type: 'banned',
          status: e.status,
          region: null,
          institution: null,
          year_started: e.year_started,
          year_ended: e.year_ended,
          description: e.description,
          confidence: 'reported',
        }).select('id').single()
        if (bErr) throw bErr
        banId = (nb as { id: number }).id
        createdBans++

        const reasonId = reasonBySlug.get(e.reason_slug)!
        await supabase.from('ban_reason_links').insert({ ban_id: banId, reason_id: reasonId })
      }

      await supabase.from('ban_source_links').insert({
        ban_id: banId,
        source_id: sourceId,
        locator: `Wikipedia: ${e.author} / ${e.title}`,
      }).then(({ error }) => {
        if (error && !error.message.includes('duplicate')) {
          console.error(`  source link warning for ban_${banId}: ${error.message}`)
        }
      })
    } catch (err) {
      errors++
      console.error(`  ! "${e.title}" by ${e.author}: ${fmtErr(err)}`)
    }
  }

  console.log(`\n── Done ──`)
  console.log(`  books created:        ${createdBooks}`)
  console.log(`  authors created:      ${createdAuthors}`)
  console.log(`  bans created:         ${createdBans}`)
  console.log(`  bans skipped (dup):   ${skipped}`)
  console.log(`  errors:               ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
