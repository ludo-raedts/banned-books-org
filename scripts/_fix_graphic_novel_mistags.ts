/**
 * _fix_graphic_novel_mistags.ts — targeted correction for comics filed as prose.
 *
 * Applies the hand-verified STRONG tier of scripts/_audit_graphic_novel_mistags.ts:
 * books whose own TITLE declares the form ("The Graphic Novel", "A Graphic
 * Memoir", "Manga Shakespeare", "…: A Graphic Adaptation") yet carry a prose
 * genre. Every row below was checked by hand — the audit's negative guards
 * already removed the prose-about-comics false positives ("Why Comics?", "The Art
 * of Comics", "A Brief History of Manga", the "Manga Dinosaurs" how-to-draw
 * series, "Verona Comics" the novel), and those are NOT in this table.
 *
 * Same class as scripts/_fix_hinds_graphic_novel_genres.ts (commit 6b8e848),
 * which fixed the four Gareth Hinds adaptations and led to this audit. Slugs come
 * from the vocabulary in src/components/genre-badge.tsx and every one is
 * validated against isMappedGenre() before a single write.
 *
 * Editorial rule applied throughout: for a comic the FORM leads, because for a
 * banned comic the form is frequently what got it banned. `literary-fiction` is
 * dropped wherever it was only the import's default stamp; a genuine second
 * dimension (memoir, drama, fantasy, non-fiction, audience) is kept or added, and
 * nothing speculative is invented — 2 slugs where 2 is all that is certain.
 *
 * The remaining 300+ PROBABLE rows (the description names the form, the title
 * doesn't) are deliberately NOT here. They go through the classifier, which now
 * carries an explicit "form beats subject" rule:
 *   npx tsx --env-file=.env.local scripts/enrich-genres-gpt.ts --ids-file=<worklist> --apply
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/_fix_graphic_novel_mistags.ts
 *   npx tsx --env-file=.env.local scripts/_fix_graphic_novel_mistags.ts --apply
 */
import { adminClient } from '../src/lib/supabase'
import { isMappedGenre } from '../src/components/genre-badge'
import { isApply } from './lib/cli'

/** id → { titleStartsWith (drift guard), genres }. */
const FIXES: { id: number; title: string; genres: string[]; why?: string }[] = [
  // ── graphic adaptations / biographies of real events ────────────────────
  { id:  1263, title: "Anne Frank's Diary: The Graphic Adaptation",  genres: ['graphic-novel', 'memoir'] },
  { id:  7816, title: 'Anne Frank: The Anne Frank House Authorized Graphic Biography', genres: ['graphic-novel', 'non-fiction'] },
  { id: 18517, title: 'The Gettysburg Address: A Graphic Adaptation', genres: ['graphic-novel', 'non-fiction'] },
  { id:  4273, title: 'Medicine: A Graphic History',                 genres: ['graphic-novel', 'non-fiction'],
    why: 'was historical-FICTION — it is a history of medicine, i.e. non-fiction' },
  { id: 17798, title: 'Filmish: A Graphic Journey Through Film',      genres: ['graphic-novel', 'non-fiction'] },
  { id: 17707, title: 'Dangerous Woman: The Graphic Biography of Emma Goldman', genres: ['graphic-novel', 'non-fiction', 'political-non-fiction'] },
  { id:  4691, title: 'Shirley Jackson\'s "The Lottery": The Authorized Graphic Adaptation', genres: ['graphic-novel', 'horror'] },

  // ── graphic memoirs ─────────────────────────────────────────────────────
  { id:  1400, title: 'Tomboy: A Graphic Memoir',                    genres: ['graphic-novel', 'memoir', 'coming-of-age'] },
  { id:  3084, title: 'Homebody: A Graphic Memoir of Gender Identity Exploration', genres: ['graphic-novel', 'memoir', 'young-adult'] },
  { id:  4609, title: 'Marbles: Mania, Depression, Michelangelo, and Me: A Graphic Memoir', genres: ['graphic-novel', 'memoir'] },
  { id:  4984, title: "I'm a Wild Seed: My Graphic Memoir on Queerness and Decolonizing", genres: ['graphic-novel', 'memoir'] },
  { id:  5671, title: "Ichi-F: A Worker's Graphic Memoir of the Fukushima Nuclear Power Plant", genres: ['graphic-novel', 'memoir', 'non-fiction'] },
  { id:  7967, title: 'Dancing at the Pity Party: A Dead Mom Graphic Memoir', genres: ['graphic-novel', 'memoir', 'young-adult'] },
  { id: 17429, title: 'Are You My Mother?: A Comic Drama',            genres: ['graphic-novel', 'memoir'],
    why: '"A Comic Drama" is Bechdel\'s subtitle for a graphic memoir, not a play' },

  // ── comics anthologies / journalism ─────────────────────────────────────
  { id:  1744, title: 'Be Gay, Do Comics: Queer History, Memoir, and Satire', genres: ['graphic-novel', 'satire', 'non-fiction'] },
  { id: 17723, title: 'Be Gay, Do Comics: Queer History, Memoir, and Satire from The Nib', genres: ['graphic-novel', 'satire', 'non-fiction'] },
  { id:  8422, title: 'Trickster: Native American Tales, A Graphic Collection', genres: ['graphic-novel', 'fantasy', 'young-adult'] },
  { id: 17490, title: "Alan Moore's America's Best Comics",           genres: ['graphic-novel', 'fantasy'] },
  { id:  7258, title: 'XYZ Comics',                                   genres: ['graphic-novel', 'satire'],
    why: 'Rand Holmes underground comix; genres was empty, so nothing is being overwritten' },
  { id:  2529, title: 'Stuck In Tte Middle: 17 Comics from an Unpleasant Age', genres: ['graphic-novel', 'young-adult', 'coming-of-age'] },

  // ── manga / manga adaptations ───────────────────────────────────────────
  { id:  4605, title: 'Manga Shakespere: The Tempest',                genres: ['graphic-novel', 'drama', 'young-adult'] },
  { id:  8237, title: "Manga Shakespeare: A Midsummer Night's Dream", genres: ['graphic-novel', 'drama', 'young-adult'] },
  { id: 18279, title: "Shakespeare's Hamlet: The Manga Edition",      genres: ['graphic-novel', 'drama', 'young-adult'] },
  { id:  5488, title: 'Cirque du Freak: The Manga, Vol. 1',           genres: ['graphic-novel', 'horror', 'young-adult'] },
  { id:  7632, title: 'Inu-Yasha: Ani-Manga',                         genres: ['graphic-novel', 'fantasy', 'young-adult'] },
  { id:  7649, title: 'RWBY: Official Manga Anthology',               genres: ['graphic-novel', 'fantasy', 'young-adult'] },

  // ── comics non-fiction for teens ────────────────────────────────────────
  { id:  7924, title: 'Wait, What?: A Comic Book Guide to Relationships, Bodies, and Growing Up', genres: ['graphic-novel', 'non-fiction', 'young-adult'] },

  // ── proven by a sibling row ─────────────────────────────────────────────
  { id:   502, title: "Maus 1: A Survivor's Tale: My Father Bleeds History", genres: ['graphic-novel', 'memoir', 'historical-fiction'],
    why: 'the volume-1 row was historical-fiction only; row #122 "Maus" already carries the correct set' },
]

type Row = { id: number; title: string; genres: string[] }
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

async function main() {
  const apply = isApply()
  const sb = adminClient()

  // Refuse to write anything the canonical vocabulary does not contain.
  for (const f of FIXES) {
    const bad = f.genres.filter((g) => !isMappedGenre(g))
    if (bad.length) throw new Error(`#${f.id}: slug not in vocabulary: ${bad.join(', ')}`)
    if (f.genres.length > 3) throw new Error(`#${f.id}: ${f.genres.length} slugs, the vocabulary allows 3`)
    if (f.genres[0] !== 'graphic-novel') throw new Error(`#${f.id}: form leads — graphic-novel must be first`)
  }
  const dupes = FIXES.map((f) => f.id).filter((id, i, a) => a.indexOf(id) !== i)
  if (dupes.length) throw new Error(`duplicate ids in FIXES: ${dupes.join(', ')}`)

  const ids = FIXES.map((f) => f.id)
  const { data, error } = await sb.from('books').select('id, title, genres').in('id', ids).order('id')
  if (error) throw new Error(error.message)
  const byId = new Map(((data ?? []) as unknown as Row[]).map((b) => [b.id, b]))

  console.log(`\n── _fix_graphic_novel_mistags (${apply ? 'APPLY' : 'DRY-RUN'}) — ${FIXES.length} books ──\n`)

  let changed = 0
  let alreadyOk = 0
  for (const f of FIXES) {
    const row = byId.get(f.id)
    if (!row) throw new Error(`#${f.id} not found`)
    // Title drift guard: refuse to write if the row is no longer the book this
    // table was hand-verified against (a merge could have reassigned the id).
    const head = f.title.slice(0, 18).toLowerCase()
    if (!row.title.toLowerCase().startsWith(head)) {
      throw new Error(`#${f.id} title drift: expected "${f.title}", found "${row.title}"`)
    }
    if (same(row.genres ?? [], f.genres)) { alreadyOk++; continue }
    changed++
    console.log(`#${f.id} ${row.title.slice(0, 66)}`)
    console.log(`   before: ${JSON.stringify(row.genres)}`)
    console.log(`   after:  ${JSON.stringify(f.genres)}`)
    if (f.why) console.log(`   why:    ${f.why}`)
    if (apply) {
      const { error: e } = await sb.from('books').update({ genres: f.genres }).eq('id', f.id)
      if (e) throw new Error(`#${f.id}: ${e.message}`)
    }
  }

  console.log(`\n  to change: ${changed}   already correct: ${alreadyOk}`)
  if (!apply) {
    console.log('\nDRY-RUN — no writes. Re-run with --apply.')
    return
  }

  const { data: after } = await sb.from('books').select('id, title, genres').in('id', ids).order('id')
  const afterById = new Map(((after ?? []) as unknown as Row[]).map((b) => [b.id, b]))
  const bad = FIXES.filter((f) => !same(afterById.get(f.id)?.genres ?? [], f.genres))
  console.log('\nVERIFY (re-read from DB):')
  console.log(`  rows matching their target: ${FIXES.length - bad.length}/${FIXES.length}`)
  for (const f of bad) console.log(`  ✗ #${f.id} expected ${JSON.stringify(f.genres)} got ${JSON.stringify(afterById.get(f.id)?.genres)}`)
  if (bad.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
