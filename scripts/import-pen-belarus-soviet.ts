/**
 * Import the 3 Glavlit Order No. 33 (1937) historical book bans documented
 * on PEN Belarus's Soviet-period 1917-1991 page. Hand-curated from the
 * page's "Voices of books" section (only 9 profiles total; 6 overlap with
 * the modern Extremist/Harmful imports, 3 carry explicit Glavlit-Order-33
 * historical attribution).
 *
 * Source: https://bannedbooks.penbelarus.org/en/soviet-period-1917-1991-en/
 *
 * The PEN Belarus page profiles books, not the full 421-entry Order No. 33
 * list. To document the 1937 historical mass-ban in full would require a
 * different upstream (likely Belarusian National Archives or scholarly
 * compilations); for now we import what PEN Belarus exposes.
 *
 * Schema:
 *   - country_code='BY', scope='government', action_type='banned'
 *   - status='historical' for 1937 events (Soviet regime ended 1991);
 *     'active' for modern overlapping events
 *   - year_started=1937 for Glavlit events, year_started=modern-year otherwise
 *   - reason_slug='political' (Stalin-era purge of Belarusian national identity)
 *   - source_type='ngo' (PEN Belarus documents the historical govt action)
 *   - locator='Order No. 33 #N' carrying the ordinal position on the 421-list
 *
 * Plus: for all 3 entries, set books.description_book with the "Voice of
 * the Book" paragraph (rich editorial context).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-pen-belarus-soviet.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-pen-belarus-soviet.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { readFileSync } from 'fs'
import { join } from 'path'

const APPLY = process.argv.includes('--apply')
const INPUT_ARG = process.argv.find(a => a.startsWith('--input='))
const JSON_PATH = INPUT_ARG
  ? join(process.cwd(), INPUT_ARG.slice('--input='.length))
  : join(process.cwd(), 'data/pen-belarus-soviet-batch1.json')

interface BanEvent {
  year: number
  date?: string                                              // optional for tsarist-era estimates
  type: 'glavlit_order_33' | 'extremist_list' | 'harmful_list' | 'tsarist_suppression'
  ordinal?: number
  scope?: string
  status: 'historical' | 'active'
  note?: string
}

interface Entry {
  title: string
  title_variants?: string[]
  author: string
  author_birth?: number
  author_death?: number
  author_status?: 'killed' | 'executed' | null
  publisher?: string
  publication_year?: number
  existing_book_id?: number          // dedup override hint
  ban_events: BanEvent[]
  voice_of_book: string
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

function buildDescription(e: Entry, ev: BanEvent): string {
  if (ev.type === 'glavlit_order_33') {
    return `Banned by Order No. 33 of the BSSR Glavlit (3 June 1937), listed as #${ev.ordinal} of 421 entries, marked "${ev.scope ?? 'All books'}". Stalin-era systematic purge of Belarusian national literature; preceded the "Night of the Executed Poets" (29-30 October 1937). Author ${e.author} ${e.author_status === 'executed' ? 'was executed' : e.author_status === 'killed' ? 'was killed' : 'lived'} ${e.author_birth}-${e.author_death}.`
  }
  if (ev.type === 'extremist_list') {
    return `Added to the National List of Extremist Materials by Lukashenko-era authorities${ev.note ? '. ' + ev.note : '.'}`
  }
  if (ev.type === 'tsarist_suppression') {
    const authorClause = e.author_status === 'executed'
      ? ` ${e.author} (${e.author_birth}-${e.author_death}) was executed.`
      : ''
    return `Suppressed by Russian Imperial authorities (Tsarist censorship), c. ${ev.year}.${ev.note ? ' ' + ev.note : ''}${authorClause}`
  }
  return `Banned ${ev.date ?? `c. ${ev.year}`}.`
}

const supabase = adminClient()

async function main() {
  console.log(`\n── import-pen-belarus-soviet ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const input: InputFile = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  console.log(`Loaded ${input.entries.length} curated entries from Soviet-period page.`)

  // Resolve gov scope + political reason
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const govScopeId = scopes!.find(s => s.slug === 'government')!.id as number
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const politicalReasonId = (reasons as Array<{ id: number; slug: string }>).find(r => r.slug === 'political')!.id

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

  console.log(`\n── Plan`)
  for (const e of input.entries) {
    const slug = slugify(e.title)
    const lookup = e.existing_book_id
      ? await supabase.from('books').select('id, title').eq('id', e.existing_book_id).maybeSingle()
      : await supabase.from('books').select('id, title').eq('slug', slug).maybeSingle()
    const ex = lookup.data
    const tag = ex ? `existing book_${(ex as { id: number }).id}` : 'NEW book'
    const banList = e.ban_events.map(b => `${b.year}/${b.type}`).join(', ')
    console.log(`  [${tag.padEnd(22)}] "${e.title}" by ${e.author}  → bans: ${banList}`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──\n`)
    return
  }

  console.log(`\n── Applying ──`)
  let createdBooks = 0, createdAuthors = 0, createdBans = 0, descriptionsUpdated = 0, errors = 0

  for (const e of input.entries) {
    try {
      const slug = slugify(e.title)
      const lookup = e.existing_book_id
        ? await supabase.from('books').select('id, description_book').eq('id', e.existing_book_id).maybeSingle()
        : await supabase.from('books').select('id, description_book').eq('slug', slug).maybeSingle()
      const ex = lookup.data
      let bookId: number
      if (ex) {
        bookId = (ex as { id: number }).id
      } else {
        const { data: nb, error: nbErr } = await supabase.from('books').insert({
          title: e.title,
          slug,
          first_published_year: e.publication_year ?? null,
          ai_drafted: false,
          genres: [],
          cover_url: null,
        }).select('id').single()
        if (nbErr) throw nbErr
        bookId = (nb as { id: number }).id
        createdBooks++

        // Author
        const aSlug = slugify(e.author)
        const { data: ea } = await supabase.from('authors').select('id').eq('slug', aSlug).maybeSingle()
        let authorId: number
        if (ea) {
          authorId = (ea as { id: number }).id
        } else {
          const { data: na, error: naErr } = await supabase.from('authors').insert({
            slug: aSlug,
            display_name: e.author,
            is_placeholder: false,
            birth_year: e.author_birth ?? null,
            death_year: e.author_death ?? null,
          }).select('id').single()
          if (naErr) throw naErr
          authorId = (na as { id: number }).id
          createdAuthors++
        }
        await supabase.from('book_authors').insert({ book_id: bookId, author_id: authorId })
      }

      // Update description_book if empty
      const hasDesc = ex && (ex as { description_book?: string }).description_book
      if (!hasDesc) {
        await supabase.from('books').update({ description_book: e.voice_of_book }).eq('id', bookId)
        descriptionsUpdated++
      }

      // Insert each ban event
      for (const ev of e.ban_events) {
        // Dedup: same book + year + region NULL + institution NULL — collision check
        const { data: existingBan } = await supabase.from('bans').select('id')
          .eq('book_id', bookId).eq('country_code', 'BY').eq('scope_id', govScopeId)
          .eq('year_started', ev.year).is('region', null).is('institution', null).maybeSingle()
        let banId: number
        if (existingBan) {
          banId = (existingBan as { id: number }).id
          // Append our description if the existing description is shorter
          // (the modern import had basic descriptions; ours adds Glavlit context)
          if (ev.type === 'glavlit_order_33') {
            await supabase.from('bans').update({ description: buildDescription(e, ev) }).eq('id', banId)
          }
        } else {
          const { data: nb, error: bErr } = await supabase.from('bans').insert({
            book_id: bookId,
            country_code: 'BY',
            scope_id: govScopeId,
            action_type: 'banned',
            status: ev.status,
            region: null,
            institution: null,
            year_started: ev.year,
            year_ended: null,
            description: buildDescription(e, ev),
            confidence: 'reported',
          }).select('id').single()
          if (bErr) throw bErr
          banId = (nb as { id: number }).id
          createdBans++

          await supabase.from('ban_reason_links').insert({ ban_id: banId, reason_id: politicalReasonId })
        }

        // Link to Soviet-page source
        const locator = ev.type === 'glavlit_order_33'
          ? `Order No. 33 #${ev.ordinal}`
          : `${ev.type} ${ev.date}`
        await supabase.from('ban_source_links').insert({
          ban_id: banId, source_id: sourceId, locator,
        }).then(({ error }) => {
          if (error && !error.message.includes('duplicate')) console.error(`  source link warning: ${error.message}`)
        })
      }
    } catch (err) {
      errors++
      console.error(`  ! "${e.title}": ${fmtErr(err)}`)
    }
  }

  console.log(`\n── Done ──`)
  console.log(`  books created:        ${createdBooks}`)
  console.log(`  authors created:      ${createdAuthors}`)
  console.log(`  bans created:         ${createdBans}`)
  console.log(`  descriptions added:   ${descriptionsUpdated}`)
  console.log(`  errors:               ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
