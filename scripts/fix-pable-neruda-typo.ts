/**
 * One-shot fix: author id=7452 "Pable Neruda" is een 1-letter OCR-typo van
 * Pablo Neruda (canonical id=81). De rij overleefde de variant-merger omdat
 * token-set {pable, neruda} niet subset is van {pablo, neruda}.
 *
 * Het ene gekoppelde boek (id=10729 "Let the Woodcarver Awake", original_
 * language=zh) is Pablo Neruda's *Que despierte el leñador* (Canto General,
 * 1948). De Chinese vertaling werd in 1951 door KDN Malaysia gebande (L.N.
 * 263, gazetted 1951-04-27, publisher SUN KWAN PUBLISHING CO., language
 * CINA).
 *
 * De bio op id=7452 is van Ignát Herrmann (Czech, 1854-1935) — een Wikipedia-
 * enrichment-snafu (Pable→Jan Neruda→Herrmann, die Jan Neruda's verzamelde
 * werken redigeerde). Dat is niet de moeite om te behouden; we droppen de
 * hele rij.
 *
 * Plan:
 *   KEEP  81    "Pablo Neruda"   (canonical, bio over Neruda, geen books)
 *   DROP  7452  "Pable Neruda"   (typo, Herrmann-bio, birth_year=1854)
 *
 *   Move book 10729 → author 81, dan delete 7452.
 *
 * Safety:
 *   - Pre-flight: verify display_name + birth_year op beide rijen
 *     (1854 op DROP = Herrmann, niet de werkelijke Pablo Neruda 1904).
 *     Als iemand 7452 inmiddels handmatig heeft hernoemd/gefixt, aborten.
 *   - book_authors merge volgens hetzelfde patroon als
 *     scripts/merge-mao-zedong-dupes.ts (re-link met collision check, dan
 *     delete drop-rij).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/fix-pable-neruda-typo.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-pable-neruda-typo.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

const KEEP_ID = 81
const KEEP_NAME = 'Pablo Neruda'
const KEEP_BIRTH = 1904

const DROP_ID = 7452
const DROP_NAME = 'Pable Neruda'
const DROP_BIRTH = 1854 // Herrmann's, not Pablo's — fingerprint of the bad bio

type AuthorRow = { id: number; display_name: string; birth_year: number | null }

async function fetchAuthor(sb: ReturnType<typeof adminClient>, id: number): Promise<AuthorRow | null> {
  const { data, error } = await sb
    .from('authors')
    .select('id, display_name, birth_year')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`fetch author ${id}: ${error.message}`)
  return data as AuthorRow | null
}

async function verifyState(sb: ReturnType<typeof adminClient>): Promise<string | null> {
  const keep = await fetchAuthor(sb, KEEP_ID)
  if (!keep) return `KEEP id=${KEEP_ID} not found`
  if (keep.display_name !== KEEP_NAME) return `KEEP id=${KEEP_ID} name='${keep.display_name}' ≠ '${KEEP_NAME}'`
  if (keep.birth_year !== KEEP_BIRTH) return `KEEP id=${KEEP_ID} birth_year=${keep.birth_year} ≠ ${KEEP_BIRTH}`

  const drop = await fetchAuthor(sb, DROP_ID)
  if (!drop) return `DROP id=${DROP_ID} not found (already merged?)`
  if (drop.display_name !== DROP_NAME) return `DROP id=${DROP_ID} name='${drop.display_name}' ≠ '${DROP_NAME}'`
  if (drop.birth_year !== DROP_BIRTH) {
    return `DROP id=${DROP_ID} birth_year=${drop.birth_year} ≠ ${DROP_BIRTH} (Herrmann-bio fingerprint); rij is mogelijk handmatig gefixt — aborting`
  }
  return null
}

async function merge(sb: ReturnType<typeof adminClient>): Promise<{ moved: number; skipped: number }> {
  const { data: dropLinks, error: le } = await sb
    .from('book_authors')
    .select('book_id, role')
    .eq('author_id', DROP_ID)
  if (le) throw new Error(`fetch links for ${DROP_ID}: ${le.message}`)

  const { data: keepLinks, error: ke } = await sb
    .from('book_authors')
    .select('book_id')
    .eq('author_id', KEEP_ID)
  if (ke) throw new Error(`fetch links for ${KEEP_ID}: ${ke.message}`)

  const keepSet = new Set((keepLinks ?? []).map(r => r.book_id))
  const toLink = (dropLinks ?? []).filter(l => !keepSet.has(l.book_id))
  const skipped = (dropLinks ?? []).length - toLink.length

  if (toLink.length > 0) {
    const payload = toLink.map(l => ({ book_id: l.book_id, author_id: KEEP_ID, role: l.role ?? 'author' }))
    const { error: ie } = await sb.from('book_authors').insert(payload)
    if (ie) throw new Error(`insert links into ${KEEP_ID}: ${ie.message}`)
  }

  const { error: de } = await sb.from('book_authors').delete().eq('author_id', DROP_ID)
  if (de) throw new Error(`delete links for ${DROP_ID}: ${de.message}`)

  const { error: ae } = await sb.from('authors').delete().eq('id', DROP_ID)
  if (ae) throw new Error(`delete author ${DROP_ID}: ${ae.message}`)

  return { moved: toLink.length, skipped }
}

async function main() {
  const sb = adminClient()
  console.log(`── fix-pable-neruda-typo ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const err = await verifyState(sb)
  if (err) {
    console.error(`  ! ${err}`)
    console.error(`\nVerification error — aborting (geen mutaties uitgevoerd).`)
    process.exit(1)
  }

  const { data: dropLinks } = await sb
    .from('book_authors')
    .select('book_id, role, books(id, title, slug)')
    .eq('author_id', DROP_ID)

  console.log(`  ✓ state verified`)
  console.log(`      KEEP id=${KEEP_ID} "${KEEP_NAME}" (b.${KEEP_BIRTH})`)
  console.log(`      DROP id=${DROP_ID} "${DROP_NAME}" (b.${DROP_BIRTH} = Herrmann fingerprint)`)
  console.log(`      Links on DROP: ${(dropLinks ?? []).length}`)
  for (const l of dropLinks ?? []) {
    // @ts-expect-error nested select
    console.log(`        - book ${l.book_id} "${l.books?.title ?? '?'}" (role=${l.role})`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──`)
    return
  }

  const { moved, skipped } = await merge(sb)
  console.log(`\n  ✓ merged ${DROP_ID} → ${KEEP_ID}`)
  console.log(`      links moved:   ${moved}`)
  console.log(`      links skipped: ${skipped} (collision with existing KEEP link)`)
  console.log(`      author ${DROP_ID} deleted`)
}

main().catch(err => { console.error(err); process.exit(1) })
