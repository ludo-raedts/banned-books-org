// _fix_author_photo_wrong_person_2026_09_07.ts — one-off, by hand, cited.
//
// Nulls two author photos that are pictures of a DIFFERENT human being, found
// by scripts/_audit_author_photo_olid.ts (full sweep 2026-09-07: 475/475 probed,
// 473 OK, 2 flagged, 0 unresolved). The audit report is
// data/author-photo-olid-audit.md; this is its apply side.
//
// ── #12547 troy-andrews ─────────────────────────────────────────────────────
// Carried https://covers.openlibrary.org/a/olid/OL19793A-L.jpg?default=false.
// openlibrary.org/authors/OL19793A.json = "Lauran Paine", personal_name
// "Lauran Paine", birth_date "25 Feb 1916", death_date "1 Dec 2001", photos
// [14655142, -1] — a prolific western pulp writer, and the photo is real.
// Our Troy Andrews is Troy "Trombone Shorty" Andrews, the New Orleans musician
// born 1986, author of the two picture books on this row: "Trombone Shorty"
// (#17641, 2015, OL17198271W) and "The 5 O'Clock Band" (#17640, 2021,
// OL19746208W). Not the same person by ~70 years.
//
// How it got in: Paine wrote under ~80 pseudonyms, and OL lists them all in
// alternate_names — including "Troy Howard (pseud.)". tryOpenLibrary() in
// src/lib/enrich/author-photos.ts queries /search/authors.json?q=<our name> and
// accepts the first doc with work_count>=1 and a HEAD-able photo WITHOUT ever
// comparing doc.name to ours, so "Troy Andrews" retrieved Paine and inherited
// his face. The row's own openlibrary_author_id is OL7537549A, which resolves
// to name "Troy Andrews" — the right record — but it has photos: null, so
// there is NO correct OL photo to swap in. Hence null, not replace.
//
// ── #16901 f-m-t-c ──────────────────────────────────────────────────────────
// Carried https://covers.openlibrary.org/a/olid/OL120259A-L.jpg?default=false.
// openlibrary.org/authors/OL120259A.json = "Maurice Bowra", personal_name
// "C. M. Bowra", birth_date 1898-04-08, death_date 1971-07-04, photos
// [5727563] — Sir Cecil Maurice Bowra, the Oxford classicist.
// Our row is display_name "F. M. T. C", a mangled name fragment from the
// Portugal Estado Novo import, holding one book: "A Ciência, a Paz e a
// Segurança Mundial" (#22659). The OL variant list even contains the source of
// the confusion — "and C. M. Bowra (Editors) Anthology. Higham T. F." — i.e.
// the initials of two editors, which is what "F. M. T. C" is a scramble of.
// The photo is definitely not this row's subject.
//
// NOT fixed here: the display_name / slug themselves. "F. M. T. C" is broken
// author data (Portugal-import residue, same family as the split-authors
// worklist in data/hk-split-authors-review.md) and fixing it means deciding
// who the book's real author is — a separate, sourced decision. This script
// only removes the wrong face.
//
// ── Guards ──────────────────────────────────────────────────────────────────
//   • The UPDATE is conditioned on photo_url still being EXACTLY the URL quoted
//     above, so a later hand-edit or re-enrichment is never clobbered.
//   • barbara-dee (#3446) and michelle-levy (#1515) are permission-managed
//     photos that must never be overwritten (both self-hosted in Supabase
//     storage, so neither is in this population) — asserted, not assumed.
//   • photo_v2_checked_at is deliberately LEFT SET. The enricher's default gate
//     is `photo_url IS NULL AND photo_v2_checked_at IS NULL`, so keeping the
//     stamp keeps both rows out of the default photo pass. A --recheck run
//     would still re-pin the same wrong photos until tryOpenLibrary() gets a
//     name gate (matchNames() in _audit_author_photo_olid.ts is the check it
//     lacks) — that root-cause fix is not in this script.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/archive/_fix_author_photo_wrong_person_2026_09_07.ts
//   npx tsx --env-file=.env.local scripts/archive/_fix_author_photo_wrong_person_2026_09_07.ts --apply
//
// APPLIED 2026-09-07: 2 rows nulled (12547, 16901), verified before/after,
// audit-integrity.ts exit 0, re-sweep clean (473/473 probed, 0 flagged).

import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const APPLY = isApply()

/** Exactly what each row must still hold for the null to be safe. */
const TARGETS = [
  {
    id: 12547,
    slug: 'troy-andrews',
    photo_url: 'https://covers.openlibrary.org/a/olid/OL19793A-L.jpg?default=false',
    wrong_person: 'Lauran Paine (OL19793A, 1916–2001)',
  },
  {
    id: 16901,
    slug: 'f-m-t-c',
    photo_url: 'https://covers.openlibrary.org/a/olid/OL120259A-L.jpg?default=false',
    wrong_person: 'Maurice Bowra (OL120259A, 1898–1971)',
  },
] as const

const PERMISSION_MANAGED_SLUGS = new Set(['barbara-dee', 'michelle-levy'])

async function main() {
  const db = adminClient()

  // Guard: never touch a permission-managed photo, even by accident.
  for (const t of TARGETS) {
    if (PERMISSION_MANAGED_SLUGS.has(t.slug)) {
      throw new Error(`refusing to touch permission-managed photo: ${t.slug}`)
    }
  }

  console.log(`\n── _fix_author_photo_wrong_person (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  // ── read-only count BEFORE ────────────────────────────────────────────
  const { data: before, error: beforeErr } = await db
    .from('authors')
    .select('id,slug,display_name,photo_url,photo_v2_checked_at')
    .in(
      'id',
      TARGETS.map((t) => t.id),
    )
    .order('id')
  if (beforeErr) throw new Error(`before-read failed: ${beforeErr.message}`)

  let ready = 0
  for (const t of TARGETS) {
    const row = (before ?? []).find((r) => r.id === t.id)
    if (!row) {
      console.log(`  #${t.id} ${t.slug}: ROW MISSING — skipped`)
      continue
    }
    const matches = row.photo_url === t.photo_url
    console.log(
      `  #${t.id} ${row.slug} "${row.display_name}"\n` +
        `      photo_url: ${row.photo_url ?? 'NULL'}\n` +
        `      is a photo of: ${t.wrong_person}\n` +
        `      ${matches ? '→ will be set to NULL' : '→ SKIP: photo_url no longer matches the audited value'}`,
    )
    if (matches) ready++
  }
  console.log(`\n  ${ready} of ${TARGETS.length} row(s) match the audited photo_url.`)

  if (!APPLY) {
    console.log('\n  Dry-run — nothing written. Re-run with --apply.\n')
    return
  }

  // ── write ─────────────────────────────────────────────────────────────
  let nulled = 0
  for (const t of TARGETS) {
    const { data, error } = await db
      .from('authors')
      .update({ photo_url: null, updated_at: new Date().toISOString() })
      .eq('id', t.id)
      .eq('photo_url', t.photo_url) // no-op if it changed under us
      .select('id')
    if (error) throw new Error(`update #${t.id} failed: ${error.message}`)
    const hit = (data ?? []).length
    nulled += hit
    console.log(`  #${t.id} ${t.slug}: ${hit === 1 ? 'nulled' : 'no-op (guard held)'}`)
  }

  // ── read-only count AFTER ─────────────────────────────────────────────
  const { data: after, error: afterErr } = await db
    .from('authors')
    .select('id,slug,photo_url,photo_v2_checked_at')
    .in(
      'id',
      TARGETS.map((t) => t.id),
    )
    .order('id')
  if (afterErr) throw new Error(`after-read failed: ${afterErr.message}`)

  console.log('')
  for (const row of after ?? []) {
    console.log(
      `  #${row.id} ${row.slug}: photo_url=${row.photo_url ?? 'NULL'} ` +
        `photo_v2_checked_at=${row.photo_v2_checked_at ?? 'NULL'} (kept: enricher default gate)`,
    )
  }

  const { count: remaining, error: popErr } = await db
    .from('authors')
    .select('id', { count: 'exact', head: true })
    .ilike('photo_url', '%covers.openlibrary.org/a/olid/%')
  if (popErr) throw new Error(`population re-count failed: ${popErr.message}`)

  console.log(`\n  nulled: ${nulled}`)
  console.log(`  OLID-photo population now: ${remaining} (was 475)\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
