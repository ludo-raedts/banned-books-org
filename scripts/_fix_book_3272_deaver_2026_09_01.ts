// _fix_book_3272_deaver_2026_09_01.ts — one-off, by hand, cited.
//
// Book 3272 "The Feeling of Falling in Love" (Mason Deaver, author #1130) was
// carrying another book's identity, found during the 2026-09-01 /botd-week
// pre-flight (Deaver is the 2026-09-08 pick, so this renders on the share hub
// and the Bluesky post as well as /books/the-feeling-of-falling-in-love).
//
// ── What was wrong ──────────────────────────────────────────────────────────
// description_book held the blurb for Peter Wohlleben's *The Hidden Life of
// Trees* ("A visually stunning journey into the diversity and wonders of
// forests…"), stamped description_source_type='openlibrary' with
// description_source_url=https://openlibrary.org/works/OL17711762W — which is
// indeed Wohlleben ("Das geheime Leben der Bäume", author OL7386767A),
// verified via openlibrary.org/works/OL17711762W.json.
//
// isbn13 was 9780670089345, which belongs to the SAME wrong work: an OL search
// on that ISBN returns only /works/OL17711762W (Wohlleben, Allen Lane / Penguin
// Random House India). So the poisoned-guard OpenLibrary contamination (root
// cause fixed 2026-06-04 in src/lib/enrich/descriptions-v2.ts) wrote both the
// blurb AND the ISBN from one wrong work.
//
// That wrong ISBN is also why remediate-ol-contamination.ts spared this row:
// its "binding == search" test treats a present isbn13 as positive evidence
// that the OL work was correctly bound. Here the ISBN was contaminated too, so
// the guard vouched for the very thing that was wrong.
//
// cover_url was NULL with cover_status='rejected_placeholder' (the Google Books
// placeholder was pHash-rejected in June, and rejected_placeholder makes every
// later enrich-covers-v2 run skip the row), so the real cover was never found.
//
// ── The real book ───────────────────────────────────────────────────────────
// Mason Deaver, *The Feeling of Falling in Love*, PUSH (Scholastic imprint),
// hardcover, 16 August 2022, 336pp, ISBN-13 9781338777666.
//   - Google Books volume 7BqTzgEACAAJ (isbn:9781338777666): title "The Feeling
//     of Falling in Love", authors ["Mason Deaver"], publisher PUSH,
//     publishedDate 2022-08-16, pageCount 336.
//   - Independently corroborated at Aug 16 2022 by Goodreads (58719208),
//     Amazon (dp/1338777661), Scholastic's own parent store page for
//     9781338777666, and Whitewhale Bookstore.
//   - 9781338777673 is the LATER PUSH paperback (Google Books gives it a 2023
//     date). The hardcover ISBN is the one Scholastic and Bookshop key on, so
//     that is what goes in isbn13.
//
// => first_published_year 2022 is CORRECT and is left alone. The pre-flight note
//    suspected a 2023 Scholastic/PUSH date; that is the paperback, not the
//    first edition. Verified, not assumed.
//
// Description: the publisher blurb exactly as the Google Books *search*
// endpoint returns it for isbn:9781338777666 — tag-free. (The single-volume
// GET wraps the same text in <p>…</p>; books/[slug]/page.tsx renders
// description_book as plain text, and 0 of the 2,500 stored google_books
// descriptions contain markup, so the search-endpoint shape is the right one.)
// Stamped description_source_type='google_books' with the volume's infoLink —
// i.e. exactly what the fixed pipeline would have written. That is also sticky:
// enrichment guards on `description_source_type IS NULL`, and
// remediate-ol-contamination.ts only targets 'openlibrary' rows.
//
// Cover: OpenLibrary work OL25957641W (author OL7637892A = Mason Deaver), whose
// 2022 edition OL35034570M carries cover id 12917798 — 333×500, and byte-
// identical (md5 83c3a91af43fbfd4c0c45edfaba5ddb4) to the ISBN-direct
// covers.openlibrary.org/b/isbn/9781338777666-L.jpg, so the ISBN, the cover and
// the work all bind to each other. Visually checked before writing: pink ground,
// dumpster fire, "the FEELING of FALLING IN LOVE / MASON DEAVER / author of
// I Wish You All the Best". Pinned as cover_status='manual_override' (the same
// state the admin cover-picker stamps on a human-chosen cover) so a later
// enrich-covers-v2 run cannot downgrade it to the 128×186 Google thumbnail.
//
// openlibrary_work_id is filled in with OL25957641W — it was NULL, and having
// the correct work id lets the cover ladder's step 2 (work-edition covers) work
// for this row instead of falling through to title search.
//
// bookshop_* is reset so the Bookshop pass re-runs against the real ISBN; it
// had recorded not_found against the Wohlleben one. kobo_* and archive_org_*
// are left alone — both of those ladders key on title+author, not ISBN.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/_fix_book_3272_deaver_2026_09_01.ts
//   npx tsx --env-file=.env.local scripts/_fix_book_3272_deaver_2026_09_01.ts --apply

import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const APPLY = isApply()

const BOOK_ID = 3272

const BAD_ISBN = '9780670089345'
const NEW_ISBN = '9781338777666'
const NEW_WORK_ID = 'OL25957641W'

const NEW_COVER_URL = 'https://covers.openlibrary.org/b/id/12917798-L.jpg'

const NEW_SOURCE_TYPE = 'google_books'
const NEW_SOURCE_URL =
  'http://books.google.nl/books?id=7BqTzgEACAAJ&dq=isbn:9781338777666&hl=&source=gbs_api'

const NEW_DESCRIPTION =
  'From the bestselling author of I Wish You All the Best, comes a new kind of love story, ' +
  'about the bad decisions we sometimes make... and the people who help get us back on the ' +
  'right path. Perfect for fans of Red, White, and Royal Blue by Casey McQuiston and What ' +
  "If It's Us by Adam Silvera and Becky Albertalli. Just days before spring break, Neil " +
  'Kearney is set to fly across the country with his childhood friend (and current ' +
  "friend-with-benefits) Josh, to attend his brother's wedding--until Josh tells Neil that " +
  "he's in love with him and Neil doesn't return the sentiment. With Josh still attending " +
  'the wedding, Neil needs to find a new date to bring along. And, almost against his will, ' +
  'roommate Wyatt is drafted. At first, Wyatt (correctly) thinks Neil is acting like a jerk. ' +
  "But when they get to LA, Wyatt sees a little more of where it's coming from. Slowly, " +
  'Neil and Wyatt begin to understand one another... and maybe, just maybe, fall in love for ' +
  'the first time...'

const SELECT =
  'id, slug, title, isbn13, isbn_status, first_published_year, openlibrary_work_id, ' +
  'cover_url, cover_status, description_book, description_source_type, ' +
  'description_source_url, bookshop_status, bookshop_isbn13, data_quality_status'

type Row = Record<string, unknown> & {
  id: number
  title: string
  isbn13: string | null
  description_book: string | null
}

function show(label: string, b: Row) {
  console.log(`════ ${label} ════`)
  console.log(`  book ${b.id} "${b.title}" (${b.first_published_year}) isbn=${b.isbn13}  isbn_status=${b.isbn_status}`)
  console.log(`  ol_work_id : ${b.openlibrary_work_id ?? '(null)'}`)
  console.log(`  cover      : ${b.cover_url ?? '(null)'}  [${b.cover_status ?? 'null'}]`)
  console.log(`  desc       : ${(b.description_book ?? '').length}ch  type=${b.description_source_type ?? 'null'}`)
  console.log(`               url=${b.description_source_url ?? '(null)'}`)
  console.log(`               "${(b.description_book ?? '').slice(0, 110)}…"`)
  console.log(`  bookshop   : ${b.bookshop_status ?? '(null)'}  isbn=${b.bookshop_isbn13 ?? '(null)'}`)
  console.log(`  quality    : ${b.data_quality_status}`)
}

async function main() {
  const sb = adminClient()

  const { data: before, error: beforeErr } = await sb
    .from('books').select(SELECT).eq('id', BOOK_ID).maybeSingle()
  if (beforeErr) throw new Error(`before-read failed: ${beforeErr.message}`)
  if (!before) throw new Error(`book ${BOOK_ID} not found`)
  const b = before as unknown as Row
  show('BEFORE', b)

  // ── Guardrails: refuse to run against unexpected state ────────────────────
  if (!/Wohlleben/i.test(b.description_book ?? '')) {
    throw new Error('description_book no longer holds the Wohlleben blurb — already fixed? aborting')
  }
  if (b.isbn13 !== BAD_ISBN) {
    throw new Error(`isbn13 is ${b.isbn13}, expected the contaminated ${BAD_ISBN} — aborting`)
  }
  if (b.title !== 'The Feeling of Falling in Love') {
    throw new Error(`unexpected title "${b.title}" — aborting`)
  }
  // books.isbn13 is UNIQUE — the target must be free.
  const { data: clash, error: clashErr } = await sb
    .from('books').select('id, slug').eq('isbn13', NEW_ISBN).neq('id', BOOK_ID)
  if (clashErr) throw new Error(`isbn clash check failed: ${clashErr.message}`)
  if ((clash ?? []).length > 0) {
    throw new Error(
      `ISBN ${NEW_ISBN} already held by book(s) ${(clash as { id: number }[]).map(r => r.id).join(',')} — books.isbn13 is UNIQUE, aborting`,
    )
  }
  // The blurb must not be shared with another row (it would mean we are about
  // to create the very contamination this script repairs).
  const { data: descClash, error: descErr } = await sb
    .from('books').select('id, slug').eq('description_book', NEW_DESCRIPTION).neq('id', BOOK_ID)
  if (descErr) throw new Error(`description clash check failed: ${descErr.message}`)
  if ((descClash ?? []).length > 0) {
    throw new Error(
      `blurb already stored on book(s) ${(descClash as { id: number }[]).map(r => r.id).join(',')} — aborting`,
    )
  }

  console.log('\n════ PLANNED CHANGES ════')
  console.log(`  isbn13                 ${b.isbn13} -> ${NEW_ISBN}  (Wohlleben -> Deaver hardcover)`)
  console.log(`  isbn_checked_at        -> now()`)
  console.log(`  openlibrary_work_id    ${b.openlibrary_work_id ?? '(null)'} -> ${NEW_WORK_ID}`)
  console.log(`  description_book       Hidden-Life-of-Trees blurb -> PUSH blurb (${NEW_DESCRIPTION.length}ch)`)
  console.log(`  description_source_*   openlibrary/OL17711762W -> ${NEW_SOURCE_TYPE}/7BqTzgEACAAJ`)
  console.log(`  cover_url              (null) -> ${NEW_COVER_URL}`)
  console.log(`  cover_status           ${b.cover_status} -> manual_override`)
  console.log(`  bookshop_*             reset (re-probe against the real ISBN)`)
  console.log(`  first_published_year   ${b.first_published_year} -> UNCHANGED (2022 verified correct)`)

  if (!APPLY) {
    console.log('\nDRY RUN — re-run with --apply to write.')
    return
  }

  const now = new Date().toISOString()
  const { error: updErr, count } = await sb
    .from('books')
    .update(
      {
        isbn13: NEW_ISBN,
        isbn_status: 'valid',
        isbn_checked_at: now,
        openlibrary_work_id: NEW_WORK_ID,
        description_book: NEW_DESCRIPTION,
        description_source_type: NEW_SOURCE_TYPE,
        description_source_url: NEW_SOURCE_URL,
        cover_url: NEW_COVER_URL,
        cover_status: 'manual_override',
        cover_checked_at: now,
        bookshop_status: null,
        bookshop_isbn13: null,
        bookshop_checked_at: null,
        updated_at: now,
      },
      { count: 'exact' },
    )
    .eq('id', BOOK_ID)
  if (updErr) throw new Error(`update failed: ${updErr.message}`)
  console.log(`\n  ~ books rows updated: ${count ?? '(unreported)'}`)

  const { data: after, error: afterErr } = await sb
    .from('books').select(SELECT).eq('id', BOOK_ID).maybeSingle()
  if (afterErr) throw new Error(`after-read failed: ${afterErr.message}`)
  console.log('')
  show('AFTER', after as unknown as Row)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
