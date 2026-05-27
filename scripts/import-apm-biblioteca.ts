/**
 * Import Argentina's APM (Archivo Provincial de la Memoria, Córdoba) catalog
 * of books prohibited by the Argentine military dictatorship (1976-1983).
 *
 * Source:
 *   "Biblioteca de Libros Prohibidos" (Comisión Provincial de la Memoria,
 *   Córdoba, 1st ed. March 2012, 1.000 ejemplares, distribución gratuita).
 *   PDF: https://apm.gov.ar/sites/default/files/biblioteca_libros_prohibidos_0_0.pdf
 *
 * License:
 *   "Se permite su reproducción parcial o total, sin fines comerciales,
 *   citando la fuente y enviando dos ejemplares a los editores." (PDF p.2)
 *   — non-commercial reproduction explicitly permitted with attribution.
 *
 * Historical context (PDF p.6-7):
 *   - 2 April 1976: Lt. Manuel Carmelo Barceló orders a book seizure +
 *     burning at Escuela Superior de Comercio Manuel Belgrano (Córdoba)
 *   - 19 April 1976: official order to deposit all "subversive" books
 *   - 29 April 1976: General Luciano Benjamín Menéndez (Tercer Cuerpo de
 *     Ejército, Córdoba) orders a collective burning of Proust, García
 *     Márquez, Cortázar, Neruda, Vargas Llosa, Saint-Exupéry, Galeano…
 *   - Authors targeted: Haroldo Conti (detained-disappeared 5 May 1976),
 *     Rodolfo Walsh (ambushed and killed 25 March 1977), and many others.
 *
 * Schema:
 *   - 1 ban_sources row → the APM PDF URL
 *   - per author: lookup by slug; create if new (Spanish "Surname, Firstname"
 *     style); editorial bodies (Editorial Anteo, Eudeba, …) and book-as-author
 *     entries (Atlas Marín, Diccionario enciclopédico) are stored as authors
 *     with is_placeholder=false — they represent the publication's source
 *   - multi-author entries ("Marx, Karl – Engels, Frederich"): split on ' – '
 *     and link each split author to the book
 *   - per title: lookup book by slug; create if new (Spanish title)
 *   - per book: 1 ban row with country_code='AR', scope='government',
 *     action_type='banned', status='historical', year_started=1976,
 *     year_ended=1983, reason='political', confidence='reported',
 *     verification_status='unverified' (Sprint A doctrine)
 *   - per-link locator = "p.{page} entry"
 *
 * Dedup:
 *   - 15 existing AR bans use English titles (The Trial, The Metamorphosis)
 *     while APM uses Spanish (El proceso, La metamorfosis). Slug collisions
 *     are unlikely; translation-dedup is a separate concern (see
 *     project_author_multilingualism in MEMORY).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/import-apm-biblioteca.ts            # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-apm-biblioteca.ts --apply
 *   pnpm tsx --env-file=.env.local scripts/import-apm-biblioteca.ts --apply --limit=20
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { readFileSync } from 'fs'
import { join } from 'path'

const APPLY = process.argv.includes('--apply')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))?.split('=')[1]
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG) : Infinity
const JSON_PATH = join(process.cwd(), 'data/apm-biblioteca-batch1.json')

const SOURCE_NAME = "Argentina — APM Córdoba: Biblioteca de Libros Prohibidos"
const SOURCE_URL  = "https://apm.gov.ar/sites/default/files/biblioteca_libros_prohibidos_0_0.pdf"
const SOURCE_TYPE = 'ngo' as const   // provincial HR-archive; closest match

const BAN_YEAR_START = 1976
const BAN_YEAR_END   = 1983

interface ApmEntry {
  author: string
  titles: string[]
  page: number
}

function fmtErr(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string; hint?: string }
    return [e.code, e.message, e.details, e.hint].filter(Boolean).join(' | ') || JSON.stringify(err)
  }
  return String(err)
}

/** Split "Marx, Karl – Engels, Frederich" → ["Marx, Karl", "Engels, Frederich"].
 *  Conservative: only splits on em-dash with spaces (' – ') since hyphenated
 *  surnames like "Procopio-Boselli" must remain intact. */
function splitAuthors(raw: string): string[] {
  return raw.split(/\s+–\s+|\s+-\s+/).map(s => s.trim()).filter(s => s.length > 0)
}

const supabase = adminClient()

async function main() {
  console.log(`\n── import-apm-biblioteca ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const entries: ApmEntry[] = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  console.log(`Loaded ${entries.length} authors from APM catalog.`)
  const totalTitles = entries.reduce((sum, e) => sum + e.titles.length, 0)
  console.log(`Total titles: ${totalTitles}`)

  // Resolve scope + reason
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const govScopeId = (scopes as Array<{ id: number; slug: string }>).find(s => s.slug === 'government')!.id
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const politicalReasonId = (reasons as Array<{ id: number; slug: string }>).find(r => r.slug === 'political')!.id

  // Upsert source row
  const { data: src, error: srcErr } = await supabase.from('ban_sources').upsert({
    source_name: SOURCE_NAME,
    source_url: SOURCE_URL,
    source_type: SOURCE_TYPE,
    verification_status: 'unverified' as const,
  }, { onConflict: 'source_url' }).select('id').single()
  if (srcErr) throw srcErr
  const sourceId = (src as { id: number }).id
  console.log(`  source_id: ${sourceId}`)

  // ── Plan ──
  let plannedBooks = 0
  let plannedNewBooks = 0
  let plannedAuthorsNew = 0
  const knownAuthorSlugs = new Set<string>()
  // Pre-load existing author slugs for fast counting (paginated)
  let off = 0
  while (true) {
    const { data, error } = await supabase.from('authors').select('slug').range(off, off + 999)
    if (error) throw error
    const rows = (data as Array<{ slug: string }>) ?? []
    for (const r of rows) knownAuthorSlugs.add(r.slug)
    if (rows.length < 1000) break
    off += 1000
  }
  console.log(`  Preloaded ${knownAuthorSlugs.size} existing author slugs.`)

  // Pre-load existing book slugs
  const knownBookSlugs = new Set<string>()
  off = 0
  while (true) {
    const { data, error } = await supabase.from('books').select('slug').range(off, off + 999)
    if (error) throw error
    const rows = (data as Array<{ slug: string }>) ?? []
    for (const r of rows) knownBookSlugs.add(r.slug)
    if (rows.length < 1000) break
    off += 1000
  }
  console.log(`  Preloaded ${knownBookSlugs.size} existing book slugs.`)

  const newAuthorSlugs = new Set<string>()
  for (const e of entries.slice(0, LIMIT)) {
    const authorNames = splitAuthors(e.author)
    for (const a of authorNames) {
      const aSlug = slugify(a)
      if (!knownAuthorSlugs.has(aSlug) && !newAuthorSlugs.has(aSlug)) {
        plannedAuthorsNew++
        newAuthorSlugs.add(aSlug)
      }
    }
    for (const t of e.titles) {
      plannedBooks++
      const bSlug = slugify(t)
      if (!knownBookSlugs.has(bSlug)) plannedNewBooks++
    }
  }
  console.log(`\n── Plan`)
  console.log(`  Authors to consider:     ${entries.slice(0, LIMIT).length}`)
  console.log(`  New author rows:         ${plannedAuthorsNew}`)
  console.log(`  Books (= ban events):    ${plannedBooks}`)
  console.log(`  New book rows:           ${plannedNewBooks}`)
  console.log(`  Existing book overlap:   ${plannedBooks - plannedNewBooks}`)

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──\n`)
    return
  }

  console.log(`\n── Applying ──`)
  let createdBooks = 0, createdAuthors = 0, createdBans = 0, errors = 0, skipped = 0

  for (const e of entries.slice(0, LIMIT)) {
    try {
      // Resolve / create each author in the entry
      const authorNames = splitAuthors(e.author)
      const authorIds: number[] = []
      for (const aName of authorNames) {
        const aSlug = slugify(aName)
        const { data: ea } = await supabase.from('authors').select('id').eq('slug', aSlug).maybeSingle()
        if (ea) {
          authorIds.push((ea as { id: number }).id)
        } else {
          const { data: na, error: naErr } = await supabase.from('authors').insert({
            slug: aSlug,
            display_name: aName,
            is_placeholder: false,
          }).select('id').single()
          if (naErr) throw naErr
          authorIds.push((na as { id: number }).id)
          createdAuthors++
        }
      }

      // Process each title
      for (const title of e.titles) {
        const bSlug = slugify(title)
        const { data: existingBook } = await supabase.from('books').select('id').eq('slug', bSlug).maybeSingle()
        let bookId: number
        if (existingBook) {
          bookId = (existingBook as { id: number }).id
        } else {
          const { data: nb, error: nbErr } = await supabase.from('books').insert({
            title,
            slug: bSlug,
            ai_drafted: false,
            genres: [],
            cover_url: null,
          }).select('id').single()
          if (nbErr) throw nbErr
          bookId = (nb as { id: number }).id
          createdBooks++

          // Link each author to the new book
          const linkRows = authorIds.map(aid => ({ book_id: bookId, author_id: aid }))
          const { error: laErr } = await supabase.from('book_authors').insert(linkRows)
          if (laErr) console.error(`  book_authors warning: ${fmtErr(laErr)}`)
        }

        // Dedup ban: same book + AR + government + year_started=1976 + region/institution NULL
        const { data: existingBan } = await supabase.from('bans').select('id')
          .eq('book_id', bookId)
          .eq('country_code', 'AR')
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
            country_code: 'AR',
            scope_id: govScopeId,
            action_type: 'banned',
            status: 'historical',
            region: null,
            institution: null,
            year_started: BAN_YEAR_START,
            year_ended: BAN_YEAR_END,
            description: `Banned during the Argentine military dictatorship "Proceso de Reorganización Nacional" (1976-1983). Cataloged by the Comisión Provincial de la Memoria, Córdoba, in their "Biblioteca de Libros Prohibidos" (2012). Author: ${e.author}.`,
            confidence: 'reported',
          }).select('id').single()
          if (bErr) throw bErr
          banId = (nb as { id: number }).id
          createdBans++

          // Reason link — 'political'
          await supabase.from('ban_reason_links').insert({ ban_id: banId, reason_id: politicalReasonId })
        }

        // Source link with locator "p.{page} entry"
        await supabase.from('ban_source_links').insert({
          ban_id: banId,
          source_id: sourceId,
          locator: `p.${e.page} entry`,
        }).then(({ error }) => {
          if (error && !error.message.includes('duplicate')) {
            console.error(`  source link warning for ban_${banId}: ${error.message}`)
          }
        })
      }
    } catch (err) {
      errors++
      console.error(`  ! "${e.author}" (page ${e.page}): ${fmtErr(err)}`)
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
