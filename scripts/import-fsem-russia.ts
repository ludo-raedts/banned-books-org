/**
 * Import Russia's Federal List of Extremist Materials (FSEM) — curated batch
 * from EN Wikipedia's overview of the list.
 *
 * Source:
 *   The FSEM is maintained by the Russian Ministry of Justice
 *   (https://minjust.gov.ru/ru/extremist-materials/) under the 2002 Federal
 *   Law "On Combating Extremist Activity". Started 2007; ~5,500 entries by
 *   2024, of which most are pamphlets/videos/audio. EN Wikipedia summarises
 *   the list with curated book/author/ordinal data:
 *   https://en.wikipedia.org/wiki/Federal_List_of_Extremist_Materials
 *
 *   This batch imports only the entries with identifiable book + author +
 *   FSEM ordinal. ~44 records — small but high-signal.
 *
 * Schema:
 *   - 1 ban_sources row → EN Wikipedia article URL
 *   - per author: lookup by slug; create if new. Multi-author entries
 *     ("Yuri Felshtinsky and Alexander Litvinenko") split on ' and '.
 *   - per book: lookup by slug; create if new
 *   - per ban: country_code='RU', scope='government', action_type='banned',
 *     status='active' (FSEM remains in force), year_started=2007 (FSEM
 *     established), year_ended=null, reason per entry,
 *     confidence='reported', verification_status='unverified'
 *   - per-link locator = "FSEM No. {ordinal}" or "FSEM (no ordinal)"
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-fsem-russia.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-fsem-russia.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { readFileSync } from 'fs'
import { join } from 'path'

const APPLY = process.argv.includes('--apply')
const JSON_PATH = join(process.cwd(), 'data/fsem-russia-batch1.json')

const BAN_YEAR_START = 2007   // FSEM established
const FSEM_REASON_SLUGS = new Set(['political', 'racial', 'religious', 'sexual', 'moral', 'obscenity', 'other'])

interface FsemEntry {
  title: string
  author: string
  fsem_no: string | null
  reason_slug: string
  description: string
  _note?: string
}

interface InputFile {
  source_url: string
  source_name: string
  source_type: string
  entries: FsemEntry[]
}

function fmtErr(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string; hint?: string }
    return [e.code, e.message, e.details, e.hint].filter(Boolean).join(' | ') || JSON.stringify(err)
  }
  return String(err)
}

/** "Yuri Felshtinsky and Alexander Litvinenko" → two authors */
function splitAuthors(raw: string): string[] {
  return raw.split(/\s+and\s+/).map(s => s.trim()).filter(s => s.length > 0)
}

const supabase = adminClient()

async function main() {
  console.log(`\n── import-fsem-russia ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const input: InputFile = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  console.log(`Loaded ${input.entries.length} curated FSEM entries.`)

  // Validate reason slugs
  for (const e of input.entries) {
    if (!FSEM_REASON_SLUGS.has(e.reason_slug)) {
      throw new Error(`Unknown reason_slug "${e.reason_slug}" for "${e.title}"`)
    }
  }

  // Resolve scope + reasons
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const govScopeId = (scopes as Array<{ id: number; slug: string }>).find(s => s.slug === 'government')!.id
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const reasonBySlug = new Map<string, number>()
  for (const r of (reasons as Array<{ id: number; slug: string }>)) {
    reasonBySlug.set(r.slug, r.id)
  }

  // Upsert source row
  const { data: src, error: srcErr } = await supabase.from('ban_sources').upsert({
    source_name: input.source_name,
    source_url: input.source_url,
    source_type: input.source_type,
    verification_status: 'unverified' as const,
  }, { onConflict: 'source_url' }).select('id').single()
  if (srcErr) throw srcErr
  const sourceId = (src as { id: number }).id
  console.log(`  source_id: ${sourceId}`)

  // ── Plan ──
  console.log(`\n── Plan`)
  for (const e of input.entries) {
    const bSlug = slugify(e.title)
    const { data: existingBook } = await supabase.from('books').select('id, title').eq('slug', bSlug).maybeSingle()
    const tag = existingBook ? `existing book_${(existingBook as { id: number }).id}` : 'NEW book'
    console.log(`  [${tag.padEnd(22)}] FSEM #${e.fsem_no ?? '?'}  "${e.title}" by ${e.author}  [${e.reason_slug}]`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──\n`)
    return
  }

  console.log(`\n── Applying ──`)
  let createdBooks = 0, createdAuthors = 0, createdBans = 0, skipped = 0, errors = 0

  for (const e of input.entries) {
    try {
      const bSlug = slugify(e.title)
      const { data: existingBook } = await supabase.from('books').select('id').eq('slug', bSlug).maybeSingle()
      let bookId: number
      if (existingBook) {
        bookId = (existingBook as { id: number }).id
      } else {
        const { data: nb, error: nbErr } = await supabase.from('books').insert({
          title: e.title,
          slug: bSlug,
          ai_drafted: false,
          genres: [],
          cover_url: null,
        }).select('id').single()
        if (nbErr) throw nbErr
        bookId = (nb as { id: number }).id
        createdBooks++

        // Link each author to the new book
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

      // Dedup ban: same book + RU + government + year_started=2007 + region/institution NULL
      const { data: existingBan } = await supabase.from('bans').select('id')
        .eq('book_id', bookId)
        .eq('country_code', 'RU')
        .eq('scope_id', govScopeId)
        .eq('year_started', BAN_YEAR_START)
        .is('region', null).is('institution', null)
        .maybeSingle()
      let banId: number
      if (existingBan) {
        banId = (existingBan as { id: number }).id
        skipped++
      } else {
        const { data: nb, error: bErr } = await supabase.from('bans').insert({
          book_id: bookId,
          country_code: 'RU',
          scope_id: govScopeId,
          action_type: 'banned',
          status: 'active',
          region: null,
          institution: null,
          year_started: BAN_YEAR_START,
          year_ended: null,
          description: e.description,
          confidence: 'reported',
        }).select('id').single()
        if (bErr) throw bErr
        banId = (nb as { id: number }).id
        createdBans++

        // Reason link
        const reasonId = reasonBySlug.get(e.reason_slug)!
        await supabase.from('ban_reason_links').insert({ ban_id: banId, reason_id: reasonId })
      }

      // Source link with locator
      const locator = e.fsem_no ? `FSEM No. ${e.fsem_no}` : 'FSEM (no ordinal)'
      await supabase.from('ban_source_links').insert({
        ban_id: banId,
        source_id: sourceId,
        locator,
      }).then(({ error }) => {
        if (error && !error.message.includes('duplicate')) {
          console.error(`  source link warning for ban_${banId}: ${error.message}`)
        }
      })
    } catch (err) {
      errors++
      console.error(`  ! "${e.title}" (FSEM #${e.fsem_no}): ${fmtErr(err)}`)
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
