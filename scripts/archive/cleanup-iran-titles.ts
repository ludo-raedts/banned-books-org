/**
 * Clean up Iran (IR) book records imported with transliterated Persian as
 * primary title. Apply the project doctrine for non-Latin originals:
 *   - Primary title  = English meaningful translation
 *   - Transliteration moves to books.title_transliterated
 *   - books.title_native_script = 'Arabic' (Persian uses Arabic abjad)
 *   - books.title_english_meaningful mirrors the new title
 *
 * Source of mappings: EN Wikipedia "Book censorship in Iran" table.
 *
 * Three cohorts:
 *   A1 — title already has English in parens, e.g. "khorus (Cockcrow)"
 *        → parse and split.
 *   A2 — pure transliteration, e.g. "majmue ash'ār-e ahmad-e shāmlu"
 *        → use the hardcoded TRANSLATION map.
 *   A3 — duplicates of existing English-titled records.
 *        → SKIPPED by this script; merge separately.
 *
 * Slug collision detection: if the new English slug already exists for a
 * different book, the rename is SKIPPED and logged as a merge candidate.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/cleanup-iran-titles.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/cleanup-iran-titles.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'

const APPLY = process.argv.includes('--apply')

// A2: book_id → { english title, transliteration }
// Translations harvested from EN Wikipedia "Book censorship in Iran" comprehensive table.
const PERSIAN_ONLY_MAP: Record<number, { english: string; translit: string }> = {
  7437: { english: 'A Collection of Poems of Ahmad Shamlu',                       translit: "majmue ash'ār-e ahmad-e shāmlu" },
  7439: { english: 'A Girl with a Silver String',                                  translit: 'dokhtari bā rismān-e noqrei' },
  7440: { english: 'Memories of My Melancholy Whores (Persian translation)',       translit: 'khāterāt-e delbarakān-e qamgin-e man' },
  7441: { english: 'Scorpion on the Railroad Stairways of Andimeshk',              translit: 'aqrab ru-ye pellehāye rāhāhan-e andimeshk' },
  7442: { english: 'The Ceremonies of Impatience',                                 translit: 'ādābe biqarāri' },
  7443: { english: 'Social History of Iran',                                       translit: 'tārikhe-e ejtemāiye irān' },
  7445: { english: 'Gay Relations in Persian Literature',                          translit: 'shāhed bāzi dar adabiyāt-e fārsi' },
  7446: { english: 'The Veiled Women and the Armoured Elite',                      translit: 'zanān-e parde neshin va nokhbegān-e jowshan push' },
  7448: { english: 'The Year Zero',                                                translit: 'sāl-e sefr' },
  7450: { english: 'Poverty and Adultery',                                         translit: 'faqr va fahshā' },
  7452: { english: 'The Book of Genies',                                           translit: 'jen nāme' },
  7453: { english: 'He Learned from Satan and Burnt It',                           translit: 'az shytān āmukht va suzānd' },
  7455: { english: 'The Book of Sadegh Hedayat',                                   translit: 'ketāb-e sādeq-e hedāyat' },
  7456: { english: 'The Last Temptation of Christ (Persian translation)',          translit: 'ākharin vasvasehā-ye masih' },
  7459: { english: 'The Gods Laugh on Mondays',                                    translit: 'khodāyān doshanbehā mikhandand' },
  7464: { english: 'The Mourners of Bayal',                                        translit: 'azādārān-e bayal' },
  7470: { english: 'Her Eyes',                                                     translit: 'chashmhāyash' },
  7472: { english: 'Mourning for Qasem',                                           translit: 'rowze-ye qāsem' },
  7473: { english: 'The Man Lost in Dust',                                         translit: 'mardi ke dar qobār gom shod' },
}

// A3: duplicate IDs to skip (handled separately via merge script)
const DUPLICATE_SKIP = new Set([
  7444,  // ramz-e dāvinchi → already book 11 (The Da Vinci Code)
  7454,  // zanān bedun-e mardān → already book 592 (Women Without Men)
  7457,  // āyāt-e sheytāni → already book 6 (The Satanic Verses)
  7463,  // tubā va ma'nā-ye shab → already book 733 (Touba and the Meaning of Night)
])

const s = adminClient()

function parseEnglishInParens(title: string): { english: string; translit: string } | null {
  // Match "transliteration (English Title)" → split. Tolerant of stray quote chars.
  const m = title.match(/^(.+?)\s*\(([^)]+?)["”]?\)\s*$/)
  if (!m) return null
  return { translit: m[1].trim(), english: m[2].trim() }
}

async function main() {
  console.log(`\n── cleanup-iran-titles ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // Load all IR books with transliterated-looking titles
  const { data: irBans } = await s.from('bans').select('book_id').eq('country_code', 'IR').eq('year_started', 1979).eq('status', 'historical')
  const bookIds = [...new Set(((irBans ?? []) as Array<{ book_id: number }>).map(r => r.book_id))]
  const { data: books } = await s.from('books').select('id, title, slug, title_native_script, title_transliterated, title_english_meaningful').in('id', bookIds)

  const plan: Array<{ id: number; currentTitle: string; english: string; translit: string; newSlug: string; cohort: 'A1' | 'A2' }> = []
  const skipped: Array<{ id: number; reason: string }> = []

  for (const b of (books ?? []) as Array<{ id: number; title: string; slug: string }>) {
    if (DUPLICATE_SKIP.has(b.id)) {
      skipped.push({ id: b.id, reason: 'duplicate (merge separately)' })
      continue
    }

    let english: string | null = null
    let translit: string | null = null
    let cohort: 'A1' | 'A2' | null = null

    // Try A1: English-in-parens
    const parsed = parseEnglishInParens(b.title)
    if (parsed) {
      english = parsed.english
      translit = parsed.translit
      cohort = 'A1'
    } else if (PERSIAN_ONLY_MAP[b.id]) {
      english = PERSIAN_ONLY_MAP[b.id].english
      translit = PERSIAN_ONLY_MAP[b.id].translit
      cohort = 'A2'
    } else {
      skipped.push({ id: b.id, reason: `no mapping; title="${b.title}"` })
      continue
    }

    const newSlug = slugify(english)
    plan.push({ id: b.id, currentTitle: b.title, english, translit, newSlug, cohort: cohort! })
  }

  // Slug-collision check
  const newSlugs = plan.map(p => p.newSlug)
  const { data: collisions } = await s.from('books').select('id, slug, title').in('slug', newSlugs)
  const collisionBySlug = new Map<string, { id: number; title: string }>()
  for (const r of (collisions ?? []) as Array<{ id: number; slug: string; title: string }>) {
    collisionBySlug.set(r.slug, { id: r.id, title: r.title })
  }

  console.log(`── Plan (${plan.length} renames + ${skipped.length} skipped) ──\n`)
  const realPlan = plan.filter(p => {
    const collision = collisionBySlug.get(p.newSlug)
    if (collision && collision.id !== p.id) {
      skipped.push({ id: p.id, reason: `slug collision with book_${collision.id} "${collision.title}" — merge candidate` })
      return false
    }
    return true
  })

  for (const p of realPlan) {
    console.log(`  [${p.cohort}] book_${p.id}: "${p.currentTitle.slice(0, 50)}" → "${p.english.slice(0, 50)}"  slug=${p.newSlug.slice(0, 40)}`)
  }

  if (skipped.length > 0) {
    console.log(`\n── Skipped (${skipped.length}) ──`)
    for (const sk of skipped) console.log(`  book_${sk.id}: ${sk.reason}`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run. Re-run with --apply. ──\n`)
    return
  }

  console.log(`\n── Applying ──`)
  let updated = 0, errors = 0
  for (const p of realPlan) {
    try {
      const { error } = await s.from('books').update({
        title: p.english,
        slug: p.newSlug,
        title_transliterated: p.translit,
        title_native_script: 'Arabic',                  // Persian uses the Arabic abjad
        title_english_meaningful: p.english,
      }).eq('id', p.id)
      if (error) throw error
      updated++
    } catch (err) {
      errors++
      console.error(`  ! book_${p.id}: ${(err as Error).message}`)
    }
  }
  console.log(`\n── Done ── updated: ${updated}  errors: ${errors}\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
