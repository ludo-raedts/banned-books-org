/**
 * Targeted, manual cover + English-title pass for the small recognizable subset
 * of Russia FSEM books — internationally-published works whose covers exist in
 * OpenLibrary (the obscure ~395 regional/self-published tracts stay coverless).
 *
 * Each mapping was verified by hand: OL author match + a real JPEG at the
 * cover_i (HTTP 200, image/jpeg). Covers are English/foreign editions of the
 * same work (the banned Russian edition's own cover is rarely catalogued) —
 * acceptable for a censorship catalogue; these records are flagged
 * limited-verification anyway.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/enrich-russia-recognizable.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/enrich-russia-recognizable.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { slugify } from '../src/lib/imports/slugify'

const APPLY = process.argv.includes('--apply')
const s = adminClient()
const olCover = (id: number) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`

type Item = {
  id: number
  english: string          // title_english_meaningful
  coverI?: number          // OpenLibrary cover id (omit → no cover set)
  retitle?: string         // overwrite canonical title + slug (Latin-titled typo fixes only)
}

const ITEMS: Item[] = [
  { id: 14330, english: 'What Does the Bible Really Teach?',          coverI: 6575026 },
  { id: 14333, english: 'Essentials for Further Advancement',          coverI: 14959064 },
  { id: 14334, english: 'Essentials for Further Advancement',          coverI: 2121366 },
  { id: 14340, english: 'The Satanic Bible',                           coverI: 8717006 },
  { id: 14343, english: 'The Russo-Ukrainian War', retitle: 'The Russo-Ukrainian War' }, // fix source typo "UKRAINAIN"
  { id: 14357, english: 'Siege' },                                                       // already English; no OL cover
  { id: 17059, english: 'A Woman in Berlin',                           coverI: 1029277 }, // German-edition cover (same work)
  { id: 17128, english: "Bearing Thorough Witness About God's Kingdom", coverI: 14881330 },
  { id: 17143, english: "Jehovah's Witnesses" },                                          // ambiguous publication; title only
  { id: 17291, english: 'Draw Close to Jehovah',                       coverI: 6955947 },
  { id: 17296, english: 'Knowledge That Leads to Everlasting Life',    coverI: 6689271 },
]

async function main() {
  console.log(`\n── enrich-russia-recognizable ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const ids = ITEMS.map(i => i.id)
  const { data: books, error } = await s
    .from('books').select('id, slug, title, title_english_meaningful, cover_url').in('id', ids)
  if (error) throw error
  const byId = new Map((books as Array<{ id: number; slug: string; title: string; title_english_meaningful: string | null; cover_url: string | null }>).map(b => [b.id, b]))

  let updated = 0, covers = 0, retitles = 0, skipped = 0, errors = 0

  for (const item of ITEMS) {
    const b = byId.get(item.id)
    if (!b) { console.log(`  ! book_${item.id} not found — skip`); skipped++; continue }

    const patch: Record<string, unknown> = { title_english_meaningful: item.english }

    if (item.retitle) {
      const newSlug = slugify(item.retitle)
      // guard against slug collision with a different book
      const { data: clash } = await s.from('books').select('id').eq('slug', newSlug).maybeSingle()
      if (clash && (clash as { id: number }).id !== item.id) {
        console.log(`  · book_${item.id} retitle skipped — slug "${newSlug}" taken by book_${(clash as { id: number }).id}`)
      } else {
        patch.title = item.retitle
        patch.slug = newSlug
        retitles++
      }
    }

    let coverNote = '—'
    if (item.coverI) {
      const url = olCover(item.coverI)
      if (!isAllowedImageUrl(url)) {
        console.log(`  ! book_${item.id} cover URL rejected by allowlist: ${url}`); errors++
      } else {
        patch.cover_url = url
        patch.cover_status = 'valid'
        patch.cover_checked_at = new Date().toISOString()
        coverNote = url
        covers++
      }
    }

    console.log(`  book_${item.id} "${b.title.slice(0, 36)}"`)
    console.log(`    → english:  ${item.english}`)
    if (patch.title) console.log(`    → retitle:  ${patch.title}  (slug ${patch.slug})`)
    console.log(`    → cover:    ${coverNote}`)

    if (APPLY) {
      const { error: uErr } = await s.from('books').update(patch).eq('id', item.id)
      if (uErr) { console.log(`    ! ${uErr.message}`); errors++; continue }
      updated++
    }
  }

  console.log(`\n── ${APPLY ? 'Done' : 'Dry-run'} ── books: ${updated || ITEMS.length}  covers: ${covers}  retitles: ${retitles}  skipped: ${skipped}  errors: ${errors}`)
  if (!APPLY) console.log(`Re-run with --apply.\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
