// _fix_bbw_featured_data_2026_08_31.ts — one-off, by hand, cited.
//
// Two hard content errors found during the Banned Books Week 2026 pre-flight.
// Both were rendering live on /banned-books-week (the hub is not behind the
// BBW kill switch) and on the books' own detail pages.
//
// ── Book 641 "The Ukrainian Night" — WRONG AUTHOR ────────────────────────────
// Attributed to "Mychailo Wynnycky" (author id 463, itself a misspelling of the
// real scholar Mychailo Wynnyckyj, who wrote a *different* Maidan book). The
// row's ISBN 9780300231533 is Yale University Press, the cover art prints
// "MARCI SHORE", and the blurb itself says "Marci Shore evokes…". The book is
// Marci Shore, *The Ukrainian Night: An Intimate History of Revolution*,
// Yale UP, 2017.
//   Sources: Slavic Review + Journal of Modern History review citations
//            ("By Marci Shore. New Haven: Yale University Press, 2017"),
//            https://yalebooks.yale.edu / OL work OL19733650W.
// Author 463 is linked to this one book only, so it is an artefact of the bad
// import, not a real author record with other work hanging off it. It is
// deleted rather than aliased: aliasing /authors/mychailo-wynnycky onto Marci
// Shore would actively mislead anyone looking for the real Wynnyckyj.
// first_published_year 2019 (a later printing) is corrected to 2017.
// The blurb's marketing pull-quote paragraph (a Charles Taylor endorsement) is
// dropped — it is the first thing the featured card clamps to, and it reads as
// jacket copy rather than description.
//
// ── Book 1480 "Lexicon" — WRONG DESCRIPTION + WRONG ISBN ─────────────────────
// description_book held the blurb for *The Call of the Wild*, and isbn13
// 9781329820418 resolves to The Call of the Wild, Lulu.com, 2016 (verified via
// openlibrary.org/isbn/9781329820418.json). Sourced from OL work OL14942956W,
// i.e. the enrichment matched an unrelated work. The cover was already correct
// (Penguin paperback of Max Barry's Lexicon).
// Replaced with the publisher's own description and the matching ISBN:
//   https://www.penguinrandomhouse.com/books/313022/lexicon-by-max-barry/
//   Penguin Books paperback, 9780143125426, 416pp, 1 April 2014.
// bookshop_* is reset so the Bookshop pass re-runs against the real ISBN (it
// had recorded not_found against the Call of the Wild one).
//
// Both descriptions are stamped description_source_type='manual' with a cited
// source_url, matching _enrich_fsem_5503_by_hand_2026_08_25.ts. That also makes
// them sticky: the enrichment scripts guard on `description_source_type IS
// NULL`, and remediate-ol-contamination.ts targets 'openlibrary' rows.
//
// Usage:  npx tsx scripts/_fix_bbw_featured_data_2026_08_31.ts [--apply]

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

const APPLY = process.argv.includes('--apply')

const UKR_BOOK_ID = 641
const UKR_BAD_AUTHOR_ID = 463
const LEXICON_BOOK_ID = 1480

const LEXICON_ISBN = '9780143125426'
const LEXICON_SOURCE_URL =
  'https://www.penguinrandomhouse.com/books/313022/lexicon-by-max-barry/'
const LEXICON_DESCRIPTION =
  'Sticks and stones break bones. Words kill. They recruited Emily Ruff from the streets. ' +
  'They said it was because she’s good with words. They’ll live to regret it. They said ' +
  'Wil Parke survived something he shouldn’t have. But he doesn’t remember. Now they’re ' +
  'after him and he doesn’t know why. There’s a word, they say. A word that kills. And ' +
  'they want it back . . .'

/** Drop the jacket-copy endorsement paragraph, keep the publisher's own prose. */
function stripPullQuote(desc: string): string {
  const paras = desc
    .split(/\r?\n\s*\r?\n/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const kept = paras.filter(p => !(/^[“"]/.test(p) && /—\s*[A-Z]/.test(p)))
  return kept.join('\n\n')
}

async function main() {
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  // ── BEFORE ────────────────────────────────────────────────────────────────
  const { data: before } = await sb
    .from('books')
    .select('id, title, isbn13, first_published_year, description_book, description_source_type, description_source_url, bookshop_status, bookshop_isbn13')
    .in('id', [UKR_BOOK_ID, LEXICON_BOOK_ID])
    .order('id')
  const { data: beforeAuthors } = await sb
    .from('book_authors')
    .select('book_id, author_id, authors(display_name, slug)')
    .in('book_id', [UKR_BOOK_ID, LEXICON_BOOK_ID])

  console.log('════ BEFORE ════')
  for (const b of (before ?? []) as any[]) {
    const a = ((beforeAuthors ?? []) as any[]).filter(x => x.book_id === b.id)
    console.log(`  book ${b.id} "${b.title}" (${b.first_published_year}) isbn=${b.isbn13}`)
    console.log(`    authors: ${a.map(x => `${x.authors?.display_name} [#${x.author_id}]`).join(', ')}`)
    console.log(`    desc(${b.description_book?.length ?? 0}ch, ${b.description_source_type}): ${(b.description_book ?? '').slice(0, 90)}…`)
  }

  const ukrBefore = ((before ?? []) as any[]).find(b => b.id === UKR_BOOK_ID)
  if (!ukrBefore) throw new Error(`book ${UKR_BOOK_ID} not found`)
  const ukrDesc = stripPullQuote(ukrBefore.description_book ?? '')

  // Guardrails — refuse to run against unexpected state.
  const lexBefore = ((before ?? []) as any[]).find(b => b.id === LEXICON_BOOK_ID)
  if (!lexBefore) throw new Error(`book ${LEXICON_BOOK_ID} not found`)
  if (!/Buck, a mixed breed dog/.test(lexBefore.description_book ?? '')) {
    throw new Error('book 1480 description is no longer the Call of the Wild text — already fixed? aborting')
  }
  if (ukrDesc.length < 400 || /Charles Taylor/.test(ukrDesc)) {
    throw new Error('pull-quote strip produced unexpected output — aborting')
  }
  const { data: isbnClash } = await sb.from('books').select('id').eq('isbn13', LEXICON_ISBN).neq('id', LEXICON_BOOK_ID)
  if ((isbnClash ?? []).length > 0) {
    throw new Error(`ISBN ${LEXICON_ISBN} already used by book(s) ${(isbnClash as any[]).map(r => r.id).join(',')} — books.isbn13 is UNIQUE, aborting`)
  }

  console.log('\n════ PLANNED CHANGES ════')
  console.log(`  book ${UKR_BOOK_ID}: author "Mychailo Wynnycky" [#${UKR_BAD_AUTHOR_ID}] -> "Marci Shore" (new)`)
  console.log(`  book ${UKR_BOOK_ID}: first_published_year ${ukrBefore.first_published_year} -> 2017`)
  console.log(`  book ${UKR_BOOK_ID}: description ${ukrBefore.description_book.length}ch -> ${ukrDesc.length}ch (pull-quote dropped)`)
  console.log(`  author ${UKR_BAD_AUTHOR_ID}: DELETE (orphan after relink, 1 book only)`)
  console.log(`  book ${LEXICON_BOOK_ID}: isbn13 ${lexBefore.isbn13} -> ${LEXICON_ISBN}`)
  console.log(`  book ${LEXICON_BOOK_ID}: description Call-of-the-Wild -> Penguin blurb (${LEXICON_DESCRIPTION.length}ch)`)
  console.log(`  book ${LEXICON_BOOK_ID}: bookshop_* reset so the pass re-runs on the real ISBN`)

  if (!APPLY) {
    console.log('\nDRY RUN — re-run with --apply to write.')
    return
  }

  // ── 1. Marci Shore ────────────────────────────────────────────────────────
  const { data: existingShore } = await sb
    .from('authors').select('id').eq('slug', 'marci-shore').maybeSingle()
  let shoreId = (existingShore as any)?.id as number | undefined
  if (!shoreId) {
    const { data: ins, error: insErr } = await sb
      .from('authors')
      .insert({ display_name: 'Marci Shore', slug: 'marci-shore' })
      .select('id')
      .single()
    if (insErr) throw new Error(`author insert failed: ${insErr.message}`)
    shoreId = (ins as any).id
    console.log(`\n  + created author "Marci Shore" [#${shoreId}]`)
  }

  // ── 2. Relink the book, then drop the bad author ──────────────────────────
  const { error: relinkErr } = await sb
    .from('book_authors')
    .update({ author_id: shoreId })
    .eq('book_id', UKR_BOOK_ID)
    .eq('author_id', UKR_BAD_AUTHOR_ID)
  if (relinkErr) throw new Error(`relink failed: ${relinkErr.message}`)
  console.log(`  ~ book ${UKR_BOOK_ID} relinked to author #${shoreId}`)

  const { data: stillLinked } = await sb
    .from('book_authors').select('book_id').eq('author_id', UKR_BAD_AUTHOR_ID)
  if ((stillLinked ?? []).length === 0) {
    const { error: delErr } = await sb.from('authors').delete().eq('id', UKR_BAD_AUTHOR_ID)
    if (delErr) throw new Error(`author delete failed: ${delErr.message}`)
    console.log(`  - deleted orphan author #${UKR_BAD_AUTHOR_ID}`)
  } else {
    console.log(`  ! author #${UKR_BAD_AUTHOR_ID} still has ${(stillLinked ?? []).length} link(s) — left in place`)
  }

  // ── 3. Book 641 fields ────────────────────────────────────────────────────
  const { error: ukrErr } = await sb
    .from('books')
    .update({
      first_published_year: 2017,
      description_book: ukrDesc,
      description_source_type: 'manual',
      description_source_url: 'https://openlibrary.org/works/OL19733650W',
      updated_at: new Date().toISOString(),
    })
    .eq('id', UKR_BOOK_ID)
  if (ukrErr) throw new Error(`book ${UKR_BOOK_ID} update failed: ${ukrErr.message}`)
  console.log(`  ~ book ${UKR_BOOK_ID} year + description updated`)

  // ── 4. Book 1480 fields ───────────────────────────────────────────────────
  const { error: lexErr } = await sb
    .from('books')
    .update({
      isbn13: LEXICON_ISBN,
      isbn_status: 'valid',
      isbn_checked_at: new Date().toISOString(),
      description_book: LEXICON_DESCRIPTION,
      description_source_type: 'manual',
      description_source_url: LEXICON_SOURCE_URL,
      bookshop_status: null,
      bookshop_isbn13: null,
      bookshop_checked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', LEXICON_BOOK_ID)
  if (lexErr) throw new Error(`book ${LEXICON_BOOK_ID} update failed: ${lexErr.message}`)
  console.log(`  ~ book ${LEXICON_BOOK_ID} isbn + description updated`)

  // ── AFTER ─────────────────────────────────────────────────────────────────
  const { data: after } = await sb
    .from('books')
    .select('id, title, isbn13, first_published_year, description_book, description_source_type, bookshop_status')
    .in('id', [UKR_BOOK_ID, LEXICON_BOOK_ID])
    .order('id')
  const { data: afterAuthors } = await sb
    .from('book_authors')
    .select('book_id, author_id, authors(display_name, slug)')
    .in('book_id', [UKR_BOOK_ID, LEXICON_BOOK_ID])

  console.log('\n════ AFTER ════')
  for (const b of (after ?? []) as any[]) {
    const a = ((afterAuthors ?? []) as any[]).filter(x => x.book_id === b.id)
    console.log(`  book ${b.id} "${b.title}" (${b.first_published_year}) isbn=${b.isbn13}`)
    console.log(`    authors: ${a.map(x => `${x.authors?.display_name} [#${x.author_id}]`).join(', ')}`)
    console.log(`    desc(${b.description_book?.length ?? 0}ch, ${b.description_source_type}): ${(b.description_book ?? '').slice(0, 120)}…`)
  }

  const { data: gone } = await sb.from('authors').select('id').eq('id', UKR_BAD_AUTHOR_ID)
  console.log(`\n  author #${UKR_BAD_AUTHOR_ID} present after run: ${(gone ?? []).length > 0 ? 'YES (unexpected)' : 'no (deleted)'}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
