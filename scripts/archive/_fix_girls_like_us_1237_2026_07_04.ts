// _fix_girls_like_us_1237_2026_07_04.ts — one-off: fix wrong ISBN + year on
// book #1237 girls-like-us-2015 "Girls Like Us" by Gail Giles.
//
// Verified 2026-07-04:
// - isbn13 9781558291225 is the *Dake Annotated Reference Bible* (OL8604812M,
//   Dake Publishing) — wrong book entirely. Correct edition: Candlewick Press
//   hardcover 2014, ISBN 9780763662677 (OL26294727M, author OL541790A =
//   Gail Giles). No other row holds that ISBN (UNIQUE safe).
// - first_published_year 2024 is the ban year, not the publication year → 2014.
// - Cover (GB volume eQI6AwAAQBAJ = Candlewick 2014), description_book
//   (Quincy & Biddy, OL work OL17692154W), archive_org_id
//   (girlslikeus0000gail) and kobo_url (girls-like-us-3 = Gail Giles per
//   Kobo product page) are all the CORRECT book — no namesake contamination
//   (namesakes: #9840 Cristina Alger 2019; Rachel Lloyd non-fiction not in DB).
// - title_native "Girls Like Us (2015)" is import junk on an en-language book
//   (source of the "-2015" slug suffix) → NULL. Slug itself kept (indexed URL).
// - openlibrary_work_id was NULL while description_source_url already cites
//   OL17692154W → backfilled.
//
// Dry-run by default; write with --apply.
// Run: pnpm tsx --env-file=.env.local scripts/_fix_girls_like_us_1237_2026_07_04.ts [--apply]

import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const APPLY = isApply()
const s = adminClient()

async function main() {
  const { data: before, error: e1 } = await s.from('books')
    .select('id, slug, isbn13, first_published_year, title_native, title_native_script, openlibrary_work_id')
    .eq('id', 1237).single()
  if (e1 || !before) throw new Error(`read failed: ${e1?.message}`)
  console.log('BEFORE:', JSON.stringify(before))

  if (before.isbn13 !== '9781558291225' || before.first_published_year !== 2024) {
    console.log('Row no longer matches expected bad state — aborting.')
    return
  }

  const patch = {
    isbn13: '9780763662677',
    first_published_year: 2014,
    openlibrary_work_id: 'OL17692154W',
    title_native: null,
    title_native_script: null,
  }
  if (!APPLY) {
    console.log('[dry-run] would update book 1237 with:', JSON.stringify(patch))
    return
  }
  const { error: e2 } = await s.from('books').update(patch).eq('id', 1237)
  if (e2) throw new Error(`update failed: ${e2.message}`)

  const { data: after } = await s.from('books')
    .select('id, slug, isbn13, first_published_year, title_native, title_native_script, openlibrary_work_id')
    .eq('id', 1237).single()
  console.log('AFTER: ', JSON.stringify(after))
  console.log('Updated 1 row (book #1237).')
}

main().catch((e) => { console.error(e); process.exit(1) })
