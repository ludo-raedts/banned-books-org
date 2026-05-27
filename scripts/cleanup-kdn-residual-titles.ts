/**
 * Second-pass cleanup for the 21 KDN titles that the first prefix-stripper
 * left alone (asymmetric / multi-inner-quote cases). Per-case proposed titles
 * come from a manual triage of the gazette text: periodical names extracted
 * from quote-wraps, gazette descriptive-prose suffixes dropped, ALL-CAPS
 * gazette typewriter style normalised to mixed case where appropriate.
 *
 * Notes preserved (per agent triage):
 *   - 11655/11656 end up with same titles as 11652/11653 (variant-spelling
 *     duplicates of "Wide Angle" issue 48 and "The Perspective" issue 76).
 *     Kept as separate rows — different gazette decisions per the
 *     one-book-per-decision rule.
 *   - 11322/11324/11325 all become "Chetusan" — three editions (Malay,
 *     Chinese, Tamil) of the same pamphlet. Language column disambiguates.
 *   - 11589 ("Oui"): title-cased rather than keeping "*OUI" all-caps —
 *     magazine's own masthead used mixed case.
 *
 * Slugs are unchanged (already stripped at insert time by slugify).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/cleanup-kdn-residual-titles.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/cleanup-kdn-residual-titles.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

interface Update { id: number; new_title: string; note?: string }

const UPDATES: Update[] = [
  { id: 11264, new_title: 'Pernjataan & Seruan: Pertemuan Wakil-Wakil Partai-Partai Komunis dan Partai-Partai Buruh', note: 'Pattern E — two-quote join, Indonesian doubling expanded' },
  { id: 11280, new_title: "Firmly Support the Righteous Struggle of the West Coast Fishermen in Their 'No Fishing' One Day Strike", note: 'Pattern C — strip outer + trailing ; inner single quotes preserved' },
  { id: 11297, new_title: 'Bendera Benteng: Suara dan Bichara Partai Rakyat Malaya (Untuk Anggota Saja)', note: 'Pattern C — asymmetric wrap stripped, colon inserted' },
  { id: 11303, new_title: 'Perutusan Khas Hari Raya Haji',                                   note: 'Pattern B — first quoted phrase kept; gazette-prose suffix drop' },
  { id: 11322, new_title: 'Chetusan',                                                        note: 'Pattern B — Chetusan edition 1 of 3 (Malay)' },
  { id: 11324, new_title: 'Chetusan',                                                        note: 'Pattern B — Chetusan edition 2 of 3 (Chinese)' },
  { id: 11325, new_title: 'Chetusan',                                                        note: 'Pattern B — Chetusan edition 3 of 3 (Tamil)' },
  { id: 11589, new_title: 'Oui',                                                             note: 'Pattern D — leading asterisk stripped; title-cased magazine masthead' },
  { id: 11608, new_title: 'China Pictorial No. 1/1975',                                      note: 'Pattern D — leading asterisk stripped' },
  { id: 11618, new_title: 'Suara Rakyat (Bil. 12, Tahun Pertama, 6 December 1975)',          note: 'Pattern A — periodical with normalised issue/date' },
  { id: 11637, new_title: 'Suluh Keadilan — Jadikan Hari Raya Sebagai Hari Mengorbankan Lagi Perjuangan Umat Islam', note: 'Pattern B — full slogan-style title; date prose dropped' },
  { id: 11638, new_title: 'Sokong Dengan Hangat Perjuangan Kemerdekaan Rakyat Pattani',      note: 'Pattern C — strip wrap; trailing gazette-date prose dropped' },
  { id: 11652, new_title: 'Wide Angle (issue 48, 16 September 1976)',                        note: 'Pattern A — Hong Kong Chinese periodical' },
  { id: 11653, new_title: 'The Perspective (issue 76, 16 September 1976)',                   note: 'Pattern A — sister ban of 11652' },
  { id: 11655, new_title: 'Wide Angle (issue 48, 16 September 1976)',                        note: 'Pattern A — variant-spelling sibling of 11652; kept separate per one-book-per-decision rule' },
  { id: 11656, new_title: 'The Perspective (issue 76, 16 September 1976)',                   note: 'Pattern A — variant-spelling sibling of 11653; kept separate' },
  { id: 11722, new_title: 'Nadi Insan (December 1982)',                                      note: 'Pattern A — INSAN Malay-language journal' },
  { id: 11726, new_title: 'Nadi Insan (Bil. 51, July 1983)',                                 note: 'Pattern A — same publication as 11722, later issue' },
  { id: 11988, new_title: 'Super Star Antarabangsa',                                         note: 'Pattern A — periodical masthead, no issue/date in source' },
  { id: 12034, new_title: 'Omaha No. 8',                                                     note: 'Pattern A — Reed Waller underground comic; issue 8' },
  { id: 12493, new_title: 'Hero: Cholikkul Enna Irukku',                                     note: 'Pattern A — Tamil cinema magazine + cover-story title joined with colon' },
]

async function main() {
  const sb = adminClient()
  console.log(`\n── cleanup-kdn-residual-titles ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)
  console.log(`${UPDATES.length} per-case title updates planned.\n`)

  // Pull current state for diff
  const ids = UPDATES.map(u => u.id)
  const { data, error } = await sb
    .from('books')
    .select('id, title')
    .in('id', ids)
  if (error) throw error
  const currentById = new Map<number, string>((data ?? []).map(r => [(r as { id: number }).id, (r as { id: number; title: string }).title]))

  for (const u of UPDATES) {
    const cur = currentById.get(u.id)
    if (cur === undefined) { console.log(`  ⚠ book_${u.id} missing from DB; will skip`); continue }
    if (cur === u.new_title) { console.log(`  · book_${u.id} already matches; no change needed`); continue }
    console.log(`  book_${u.id}`)
    console.log(`    FROM: ${cur}`)
    console.log(`    →     ${u.new_title}`)
    if (u.note) console.log(`    note: ${u.note}`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──\n`)
    return
  }

  console.log(`\n── Applying ──`)
  let updated = 0, errors = 0
  for (const u of UPDATES) {
    const { error: e } = await sb.from('books').update({ title: u.new_title }).eq('id', u.id)
    if (e) { errors++; console.error(`  ! book_${u.id}: ${e.message}`); continue }
    updated++
  }
  console.log(`\n  updated: ${updated}, errors: ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
