/**
 * One-shot fix: author id=4758 "Maulana Muhammad Sadiq Hussain Sahab Sadiq
 * Siddiqui Sardanvi" is een Wikipedia-import (India 2026-05-14) waar de
 * honorific-titels (Maulana = islamitische geleerde, Sahab = "meneer") en de
 * dubbele 'Sadiq' (takhallus + voornaam-fragment) mee zijn gescraped als
 * onderdeel van de display_name.
 *
 * Bron: https://en.wikipedia.org/wiki/List_of_books_banned_in_India  →
 *   _Marka-e-Somnath_ (1952, Urdu, Pakistani treatise on Somnath).
 *
 * Canonieke vorm (gekozen door user): "Sadiq Siddiqui Sardanvi" — de
 * takhallus (Urdu-pennenaam) + familienaam + nisba (afkomst uit Sardhana,
 * Uttar Pradesh).
 *
 * Side-fixes:
 *   - bio is junk: bevat de inleidende zin van de Wikipedia-LIJSTPAGINA
 *     ("This is a list of books or any specific textual material..."), niet
 *     iets over deze persoon. Wordt NULL gezet.
 *   - book 6620 "Marka-e-Somnath" heeft description_book / description_ban /
 *     censorship_context met de vervuilde naam in de tekst. Wordt NULL gezet
 *     zodat de enrich-pipeline opnieuw drafte met de juiste auteursnaam.
 *
 * Plan:
 *   UPDATE authors SET
 *     display_name = 'Sadiq Siddiqui Sardanvi',
 *     slug         = 'sadiq-siddiqui-sardanvi',
 *     bio          = NULL
 *   WHERE id = 4758
 *
 *   UPDATE books SET
 *     description_book       = NULL,
 *     description_ban        = NULL,
 *     censorship_context     = NULL,
 *     data_quality_status    = 'default',
 *     data_quality_evaluated_at = NULL
 *   WHERE id = 6620
 *
 * Safety:
 *   - Pre-flight: verifieer dat author 4758 nog steeds de vervuilde naam
 *     heeft (anders heeft iemand 'm al gefixt — aborten).
 *   - Pre-flight: verifieer dat slug 'sadiq-siddiqui-sardanvi' nog vrij is.
 *   - Pre-flight: verifieer dat book 6620 nog steeds "Marka-e-Somnath" heet
 *     en gekoppeld is aan author 4758.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/fix-sardanvi-honorifics.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-sardanvi-honorifics.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

const AUTHOR_ID = 4758
const OLD_NAME = 'Maulana Muhammad Sadiq Hussain Sahab Sadiq Siddiqui Sardanvi'
const OLD_SLUG = 'maulana-muhammad-sadiq-hussain-sahab-sadiq-siddiqui-sardanvi'
const NEW_NAME = 'Sadiq Siddiqui Sardanvi'
const NEW_SLUG = 'sadiq-siddiqui-sardanvi'

const BOOK_ID = 6620
const BOOK_TITLE = 'Marka-e-Somnath'

async function main() {
  const sb = adminClient()
  console.log(`── fix-sardanvi-honorifics ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // Pre-flight: author state
  const { data: author, error: ae } = await sb
    .from('authors')
    .select('id, display_name, slug, bio')
    .eq('id', AUTHOR_ID)
    .maybeSingle()
  if (ae) throw new Error(`fetch author: ${ae.message}`)
  if (!author) { console.error(`  ! author ${AUTHOR_ID} not found`); process.exit(1) }
  if (author.display_name !== OLD_NAME) {
    console.error(`  ! author ${AUTHOR_ID} display_name='${author.display_name}' ≠ expected; iemand heeft 'm al gefixt — aborting`)
    process.exit(1)
  }
  if (author.slug !== OLD_SLUG) {
    console.error(`  ! author ${AUTHOR_ID} slug='${author.slug}' ≠ expected — aborting`)
    process.exit(1)
  }

  // Pre-flight: new slug must be free
  const { data: clash } = await sb
    .from('authors')
    .select('id, display_name')
    .eq('slug', NEW_SLUG)
    .maybeSingle()
  if (clash) {
    console.error(`  ! slug '${NEW_SLUG}' already used by author ${clash.id} "${clash.display_name}" — aborting`)
    process.exit(1)
  }

  // Pre-flight: book state
  const { data: bookRows, error: be } = await sb
    .from('books')
    .select('id, title')
    .eq('id', BOOK_ID)
  if (be) throw new Error(`fetch book: ${be.message}`)
  const book = bookRows?.[0]
  if (!book) { console.error(`  ! book ${BOOK_ID} not found`); process.exit(1) }
  if (book.title !== BOOK_TITLE) {
    console.error(`  ! book ${BOOK_ID} title='${book.title}' ≠ '${BOOK_TITLE}' — aborting`)
    process.exit(1)
  }

  // Pre-flight: link still in place
  const { data: link, error: le } = await sb
    .from('book_authors')
    .select('book_id, author_id')
    .eq('author_id', AUTHOR_ID)
    .eq('book_id', BOOK_ID)
    .maybeSingle()
  if (le) throw new Error(`fetch link: ${le.message}`)
  if (!link) {
    console.error(`  ! link author ${AUTHOR_ID} ↔ book ${BOOK_ID} not found — aborting`)
    process.exit(1)
  }

  console.log(`  ✓ state verified`)
  console.log(`      author ${AUTHOR_ID} "${author.display_name}"`)
  console.log(`      bio: ${author.bio ? `"${author.bio.slice(0, 80)}…"` : 'NULL'}`)
  console.log(`      book ${BOOK_ID} "${book.title}" still linked`)
  console.log(``)
  console.log(`  Will rename → "${NEW_NAME}" (slug=${NEW_SLUG})`)
  console.log(`  Will null bio + description_book + description_ban + censorship_context`)
  console.log(`  Will reset data_quality_status → 'default' (re-eval)`)

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──`)
    return
  }

  // 1) Rename author + clear bio
  const { error: ue1 } = await sb
    .from('authors')
    .update({
      display_name: NEW_NAME,
      slug: NEW_SLUG,
      bio: null,
    })
    .eq('id', AUTHOR_ID)
    .eq('display_name', OLD_NAME) // optimistic guard
  if (ue1) throw new Error(`update author: ${ue1.message}`)

  // 2) Clear book descriptions so enrich pipeline re-drafts them
  const { error: ue2 } = await sb
    .from('books')
    .update({
      description_book: null,
      description_ban: null,
      censorship_context: null,
      data_quality_status: 'default',
      data_quality_evaluated_at: null,
    })
    .eq('id', BOOK_ID)
  if (ue2) throw new Error(`update book: ${ue2.message}`)

  console.log(`\n  ✓ author ${AUTHOR_ID} renamed → "${NEW_NAME}"`)
  console.log(`  ✓ book ${BOOK_ID} descriptions cleared, queued for re-draft`)
  console.log(`\nNew URL: /authors/${NEW_SLUG}`)
  console.log(`Old URL /authors/${OLD_SLUG} will 404 (no SEO weight — May 2026 import).`)
}

main().catch(err => { console.error(err); process.exit(1) })
