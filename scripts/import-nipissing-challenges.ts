/**
 * Import Canadian (and a few US) book challenges surfaced by the Nipissing
 * University "Banned & Challenged Books" research guide, each independently
 * verified against an authoritative primary source (mostly Freedom to Read
 * Canada).
 *
 * Why a dedicated importer (not scripts/import-singapore-wiki.ts):
 *   - the generic importer hardcodes scope='government' + action_type='banned'
 *     and links exactly ONE reason. These cases are school / public_library
 *     CHALLENGES with multiple reasons → needs per-entry scope, action_type,
 *     reason_slugs[], region, institution.
 *   - per-entry source (Freedom to Read page / CBC / Wikipedia), not one
 *     batch-wide source.
 *
 * Schema written:
 *   - ban_sources: one row per distinct source_url (upsert on source_url)
 *   - authors / books: lookup-or-create by slug (entry.slug override wins;
 *     used for "Hold Fast" by Kevin Major to avoid colliding with the existing
 *     Blue Balliett "hold-fast")
 *   - bans: per-entry scope_id, action_type, status, region, institution,
 *     year_started/ended, description, confidence='reported'
 *   - ban_reason_links: one row per reason_slug
 *   - ban_source_links: ban → its source, locator = institution/region (year)
 *
 * Dedup: same book + country + scope + year_started + region + institution.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-nipissing-challenges.ts            # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-nipissing-challenges.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { readFileSync } from 'fs'
import { join } from 'path'

const APPLY = process.argv.includes('--apply')
const INPUT_ARG = process.argv.find(a => a.startsWith('--input='))
const JSON_PATH = INPUT_ARG
  ? join(process.cwd(), INPUT_ARG.slice('--input='.length))
  : join(process.cwd(), 'data/canada-nipissing-batch1.json')

const VALID_STATUSES = new Set(['active', 'rescinded', 'historical', 'unclear'])
const VALID_ACTIONS = new Set(['banned', 'challenged', 'removed', 'restricted', 'blocked'])

interface Entry {
  title: string
  author: string
  slug?: string
  country_code: string
  scope: string
  action_type: string
  status: 'active' | 'rescinded' | 'historical' | 'unclear'
  region: string | null
  institution: string | null
  year_started: number | null
  year_ended: number | null
  reason_slugs: string[]
  description: string
  source_name: string
  source_type: string
  source_url: string
  confidence?: string
}

interface InputFile { entries: Entry[] }

function fmtErr(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string; hint?: string }
    return [e.code, e.message, e.details, e.hint].filter(Boolean).join(' | ') || JSON.stringify(err)
  }
  return String(err)
}

/** "Neil Gaiman and P. Craig Russell" → two authors */
function splitAuthors(raw: string): string[] {
  return raw.split(/\s+and\s+/).map(s => s.trim()).filter(s => s.length > 0)
}

const supabase = adminClient()

async function main() {
  console.log(`\n── import-nipissing-challenges ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const input: InputFile = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  console.log(`Loaded ${input.entries.length} verified entries.`)

  // ── Vocab ──────────────────────────────────────────────────────────────────
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const scopeBySlug = new Map((scopes as Array<{ id: number; slug: string }>).map(s => [s.slug, s.id]))
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const reasonBySlug = new Map((reasons as Array<{ id: number; slug: string }>).map(r => [r.slug, r.id]))

  // ── Validate up front ────────────────────────────────────────────────────
  for (const e of input.entries) {
    if (!VALID_STATUSES.has(e.status)) throw new Error(`Bad status "${e.status}" for "${e.title}"`)
    if (!VALID_ACTIONS.has(e.action_type)) throw new Error(`Bad action_type "${e.action_type}" for "${e.title}"`)
    if (!scopeBySlug.has(e.scope)) throw new Error(`Unknown scope "${e.scope}" for "${e.title}"`)
    for (const r of e.reason_slugs) {
      if (!reasonBySlug.has(r)) throw new Error(`Unknown reason_slug "${r}" for "${e.title}"`)
    }
    if (!e.reason_slugs.length) throw new Error(`No reasons for "${e.title}"`)
  }
  console.log('Validation passed.\n')

  // ── Plan ───────────────────────────────────────────────────────────────────
  console.log('── Plan')
  for (const e of input.entries) {
    const slug = e.slug ?? slugify(e.title)
    const { data: ex } = await supabase.from('books').select('id, title').eq('slug', slug).maybeSingle()
    const tag = ex ? `EXISTING book_${(ex as { id: number }).id}` : 'NEW book'
    const yr = e.year_started ?? '????'
    const loc = [e.institution, e.region, e.country_code].filter(Boolean).join(', ')
    console.log(`  [${tag.padEnd(18)}] "${e.title}" — ${e.action_type}/${e.status} [${e.reason_slugs.join('+')}] ${yr} · ${loc}`)
    if (ex && (ex as { title: string }).title.toLowerCase() !== e.title.toLowerCase()) {
      console.log(`      ⚠ slug "${slug}" already used by a DIFFERENT title: "${(ex as { title: string }).title}" — set an explicit "slug" in the JSON.`)
    }
  }

  if (!APPLY) {
    console.log('\n── Dry-run complete. Re-run with --apply. ──\n')
    return
  }

  // ── Apply ────────────────────────────────────────────────────────────────
  console.log('\n── Applying ──')
  let createdBooks = 0, createdAuthors = 0, createdBans = 0, skipped = 0, errors = 0

  for (const e of input.entries) {
    try {
      const scopeId = scopeBySlug.get(e.scope)!

      // source (upsert by url)
      const { data: src, error: srcErr } = await supabase.from('ban_sources').upsert({
        source_name: e.source_name,
        source_url: e.source_url,
        source_type: e.source_type,
        verification_status: 'unverified' as const,
      }, { onConflict: 'source_url' }).select('id').single()
      if (srcErr) throw srcErr
      const sourceId = (src as { id: number }).id

      // book
      const slug = e.slug ?? slugify(e.title)
      const { data: existingBook } = await supabase.from('books').select('id').eq('slug', slug).maybeSingle()
      let bookId: number
      if (existingBook) {
        bookId = (existingBook as { id: number }).id
      } else {
        const { data: nb, error: nbErr } = await supabase.from('books').insert({
          title: e.title, slug, ai_drafted: false, genres: [], cover_url: null,
        }).select('id').single()
        if (nbErr) throw nbErr
        bookId = (nb as { id: number }).id
        createdBooks++
        for (const aName of splitAuthors(e.author)) {
          const aSlug = slugify(aName)
          const { data: ea } = await supabase.from('authors').select('id').eq('slug', aSlug).maybeSingle()
          let authorId: number
          if (ea) {
            authorId = (ea as { id: number }).id
          } else {
            const { data: na, error: naErr } = await supabase.from('authors').insert({
              slug: aSlug, display_name: aName, is_placeholder: false,
            }).select('id').single()
            if (naErr) throw naErr
            authorId = (na as { id: number }).id
            createdAuthors++
          }
          await supabase.from('book_authors').insert({ book_id: bookId, author_id: authorId })
        }
      }

      // dedup ban
      let q = supabase.from('bans').select('id')
        .eq('book_id', bookId).eq('country_code', e.country_code).eq('scope_id', scopeId)
      q = e.year_started == null ? q.is('year_started', null) : q.eq('year_started', e.year_started)
      q = e.region == null ? q.is('region', null) : q.eq('region', e.region)
      q = e.institution == null ? q.is('institution', null) : q.eq('institution', e.institution)
      const { data: existingBan } = await q.maybeSingle()

      let banId: number
      if (existingBan) {
        banId = (existingBan as { id: number }).id
        skipped++
      } else {
        const { data: nb, error: bErr } = await supabase.from('bans').insert({
          book_id: bookId,
          country_code: e.country_code,
          scope_id: scopeId,
          action_type: e.action_type,
          status: e.status,
          region: e.region,
          institution: e.institution,
          year_started: e.year_started,
          year_ended: e.year_ended,
          description: e.description,
          confidence: 'reported',
        }).select('id').single()
        if (bErr) throw bErr
        banId = (nb as { id: number }).id
        createdBans++
        for (const rSlug of e.reason_slugs) {
          await supabase.from('ban_reason_links').insert({ ban_id: banId, reason_id: reasonBySlug.get(rSlug)! })
        }
      }

      const locator = [e.institution, e.region].filter(Boolean).join(', ') +
        (e.year_started ? ` (${e.year_started})` : '')
      await supabase.from('ban_source_links').insert({
        ban_id: banId, source_id: sourceId, locator: locator || e.country_code,
      }).then(({ error }) => {
        if (error && !error.message.includes('duplicate')) {
          console.error(`  source-link warning ban_${banId}: ${error.message}`)
        }
      })
    } catch (err) {
      errors++
      console.error(`  ! "${e.title}": ${fmtErr(err)}`)
    }
  }

  console.log('\n── Done ──')
  console.log(`  books created:   ${createdBooks}`)
  console.log(`  authors created: ${createdAuthors}`)
  console.log(`  bans created:    ${createdBans}`)
  console.log(`  bans skipped:    ${skipped}`)
  console.log(`  errors:          ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
