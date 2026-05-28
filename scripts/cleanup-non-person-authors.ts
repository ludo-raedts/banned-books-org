/**
 * Cleanup van non-persoon authors uit `audit-non-person-authors.ts` (run
 * 2026-05-28). Drie acties:
 *
 *  1. DELETE (27 rijen)
 *     - 19 PUBLISHER (uitgevers/krantkantoren)
 *     -  1 TITLE_LIKE (boekreeks als author)
 *     -  2 STAFF_TAIL (incl. niet-NYT editorial staffs)
 *     -  5 ORG_BODY-titles (resoluties/title-as-author cases)
 *
 *  2. RENAME (1 rij)
 *     - 4423 "Army Reserve Lt. Col. Anthony Shaffer" → "Anthony Shaffer"
 *       (echte persoon met rank-prefix die er niet hoort)
 *
 *  3. ANON_GROUP cleanup (12 rijen)
 *     - "X. et al" → strip staart, wipe verkeerde bio
 *     - "et al" (alleen) → DELETE want geen herstelbare naam
 *     - "Montedron, Jacques et.al." → "Jacques Montedron" (incl. reverse)
 *     - Bij slug-collision met bestaande canonieke author → MERGE
 *
 * Read-only met --apply flag.
 *
 *   pnpm tsx --env-file=.env.local scripts/cleanup-non-person-authors.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/cleanup-non-person-authors.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'

const APPLY = process.argv.includes('--apply')

// ── DELETE-lijst (27) ──────────────────────────────────────────────────
const DELETE_IDS: { id: number; expected: string; reason: string }[] = [
  // PUBLISHER (19)
  { id: 7318, expected: 'Compiled By Editors of Readers Publishing Co.',                            reason: 'publisher' },
  { id: 3706, expected: 'Susaeta Publishing',                                                       reason: 'publisher' },
  { id: 3781, expected: 'Braun Publishing',                                                         reason: 'publisher' },
  { id: 4578, expected: 'Jugo-Slav Publishing Company',                                             reason: 'publisher' },
  { id: 4679, expected: 'Associated Press',                                                         reason: 'news agency' },
  { id: 4783, expected: 'China International Publishing Group (Publisher)',                         reason: 'publisher' },
  { id: 5219, expected: 'Wai shen za zhi she (Publisher)',                                          reason: 'publisher' },
  { id: 5257, expected: 'Tai wan xing bao gu fen you xian gong si (Publisher)',                     reason: 'publisher' },
  { id: 5280, expected: '內幕雜誌社 (出版社) / "Nei mu" za zhi she (Publisher)',                       reason: 'publisher' },
  { id: 5304, expected: 'Ming jing yue kan za zhi she (Publisher)',                                 reason: 'publisher' },
  { id: 5331, expected: '"中國密報"雜誌社 (出版社) / "Zhongguo mi bao" za zhi she (Publisher)',         reason: 'publisher' },
  { id: 5354, expected: 'Tian xia za zhi she (Publisher)',                                          reason: 'publisher' },
  { id: 5376, expected: 'Zhuo yue quan qiu chuan mei gu fen you xian gong si (Publisher)',          reason: 'publisher' },
  { id: 5392, expected: 'Ping guo ri bao (Publisher)',                                              reason: 'publisher' },
  { id: 6563, expected: 'Saddleback Educational Publishing',                                        reason: 'publisher' },
  { id: 7252, expected: 'Sun Wah Book Co.',                                                         reason: 'publisher' },
  { id: 7557, expected: 'Readers Publishing Co.',                                                   reason: 'publisher' },
  { id: 8186, expected: 'Panitia Penerbitan Buku Dan 70 Tahun Harun NasutionBekerjasama Dengan Lembaga Studi Agama Dan Filsafat', reason: 'committee/publisher' },
  { id: 9206, expected: 'Cucaña Ediciones',                                                         reason: 'publisher' },
  // TITLE_LIKE (1)
  { id: 9520, expected: 'Serie La SS en acción',                                                    reason: 'book series title' },
  // STAFF_TAIL (2, excl. NYT 1244)
  { id: 7511, expected: 'Editorial Staff, Wa Nam Almanac, 1952',                                    reason: 'editorial staff' },
  { id: 7872, expected: 'Sidang Pengarang Knight Publisher',                                        reason: 'editorial board (publisher)' },
  // ORG_BODY-titles (5)
  { id: 9058, expected: 'Academia de Ciencias de la URSS. Instituto de Filosofía',                  reason: 'institute (smushed with title)' },
  { id: 9192, expected: 'Comité Central de Partido Comunista',                                      reason: 'generic body, no specific party' },
  { id: 9430, expected: 'Partido Ba´th',                                                            reason: 'placeholder bio, party-as-author' },
  { id: 9475, expected: 'Resoluciones y declaraciones del Partido Comunista de la Argentina',       reason: 'title-as-author' },
  { id: 7875, expected: 'Chandran Babu & Party',                                                    reason: 'performer + party (already in ampersand-skip)' },
]

// ── RENAME-lijst (1) ───────────────────────────────────────────────────
const RENAME_PLANS: { id: number; from: string; to: string }[] = [
  { id: 4423, from: 'Army Reserve Lt. Col. Anthony Shaffer', to: 'Anthony Shaffer' },
]

// ── ANON_GROUP cleanup (12) ────────────────────────────────────────────
// "X. et al" / "X et al" → "X", wipe verkeerde bio. Bij slug-collision: MERGE.
type AnonAction = { id: number; from: string; to: string | null }
const ANON_PLANS: AnonAction[] = [
  { id: 4632, from: 'Hai. et al',                  to: 'Hai' },
  { id: 4902, from: 'Ziqiang. et al',              to: 'Ziqiang' },
  { id: 5058, from: 'Guowei et al',                to: 'Guowei' },
  { id: 5176, from: 'Liangzhu. et al',             to: 'Liangzhu' },
  { id: 5355, from: 'Zunzi. et al',                to: 'Zunzi' },
  { id: 5378, from: 'Mingxin. et al',              to: 'Mingxin' },
  { id: 5412, from: 'et al',                       to: null },         // geen herstelbare naam → delete
  { id: 5420, from: 'Xiaohua. et al',              to: 'Xiaohua' },
  { id: 5448, from: 'Haihua. et al',               to: 'Haihua' },
  { id: 5469, from: 'Yingshi. et al',              to: 'Yingshi' },
  { id: 5475, from: 'Zhenyu. et al',               to: 'Zhenyu' },
  { id: 9396, from: 'Montedron, Jacques et.al.',   to: 'Jacques Montedron' },
]

async function verifyName(sb: ReturnType<typeof adminClient>, id: number, expected: string): Promise<string | null> {
  const { data } = await sb.from('authors').select('display_name').eq('id', id).maybeSingle()
  if (!data) return `id=${id} mist`
  if (data.display_name !== expected) return `id=${id} naam="${data.display_name}" ≠ "${expected}"`
  return null
}

async function deleteAuthor(sb: ReturnType<typeof adminClient>, id: number) {
  const { error: dle } = await sb.from('book_authors').delete().eq('author_id', id)
  if (dle) throw new Error(`unlink: ${dle.message}`)
  const { error: dae } = await sb.from('authors').delete().eq('id', id)
  if (dae) throw new Error(`delete author: ${dae.message}`)
}

async function mergeAuthor(sb: ReturnType<typeof adminClient>, dropId: number, keepId: number): Promise<number> {
  const { data: dropLinks } = await sb.from('book_authors').select('book_id, role').eq('author_id', dropId)
  const { data: keepLinks } = await sb.from('book_authors').select('book_id').eq('author_id', keepId)
  const keepSet = new Set((keepLinks ?? []).map(r => r.book_id))
  const toLink = (dropLinks ?? []).filter(l => !keepSet.has(l.book_id))
  if (toLink.length > 0) {
    const payload = toLink.map(l => ({ book_id: l.book_id, author_id: keepId, role: l.role ?? 'author' }))
    const { error: ie } = await sb.from('book_authors').insert(payload)
    if (ie) throw new Error(`insert links into ${keepId}: ${ie.message}`)
  }
  const { error: dle } = await sb.from('book_authors').delete().eq('author_id', dropId)
  if (dle) throw new Error(`delete links for ${dropId}: ${dle.message}`)
  const { error: ae } = await sb.from('authors').delete().eq('id', dropId)
  if (ae) throw new Error(`delete author ${dropId}: ${ae.message}`)
  return toLink.length
}

async function main() {
  const sb = adminClient()
  console.log(`── fix non-person authors ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // ── 0. Verificatie ─────────────────────────────────────────────────
  console.log('Verificatie:')
  const errs: string[] = []
  for (const p of DELETE_IDS) { const e = await verifyName(sb, p.id, p.expected); if (e) errs.push(`DELETE: ${e}`) }
  for (const p of RENAME_PLANS) { const e = await verifyName(sb, p.id, p.from); if (e) errs.push(`RENAME: ${e}`) }
  for (const p of ANON_PLANS) { const e = await verifyName(sb, p.id, p.from); if (e) errs.push(`ANON: ${e}`) }
  if (errs.length > 0) {
    console.error('Verificatiefouten — abort:')
    for (const e of errs) console.error(`  ! ${e}`)
    process.exit(1)
  }
  console.log(`  ✓ ${DELETE_IDS.length + RENAME_PLANS.length + ANON_PLANS.length} rijen geverifieerd`)

  if (!APPLY) {
    console.log('\nDRY-RUN — geen mutaties. Sample-output:')
    console.log(`  DELETE (${DELETE_IDS.length}):`)
    for (const p of DELETE_IDS) console.log(`    id=${p.id} "${p.expected.slice(0, 50)}" — ${p.reason}`)
    console.log(`  RENAME (${RENAME_PLANS.length}):`)
    for (const p of RENAME_PLANS) console.log(`    id=${p.id} "${p.from}" → "${p.to}"`)
    console.log(`  ANON (${ANON_PLANS.length}):`)
    for (const p of ANON_PLANS) {
      console.log(`    id=${p.id} "${p.from}" → ${p.to ? `"${p.to}"` : 'DELETE'}`)
    }
    console.log('\n── Dry-run klaar. Re-run met --apply. ──')
    return
  }

  // ── 1. DELETE ──────────────────────────────────────────────────────
  console.log('\n1. DELETE:')
  let deleted = 0, errors = 0
  for (const p of DELETE_IDS) {
    try {
      await deleteAuthor(sb, p.id)
      deleted++
      console.log(`  ✓ id=${p.id} "${p.expected.slice(0, 50)}" — ${p.reason}`)
    } catch (err) {
      errors++
      console.error(`  ! id=${p.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── 2. RENAME ──────────────────────────────────────────────────────
  console.log('\n2. RENAME:')
  let renamed = 0
  for (const p of RENAME_PLANS) {
    try {
      const newSlug = slugify(p.to)
      const { data: collision } = await sb.from('authors').select('id').eq('slug', newSlug).neq('id', p.id).maybeSingle()
      if (collision) {
        // Merge into bestaande canonical
        const moved = await mergeAuthor(sb, p.id, collision.id)
        console.log(`  ✓ id=${p.id} merged into id=${collision.id} (${moved} link(s))`)
      } else {
        const { error } = await sb.from('authors').update({ display_name: p.to, slug: newSlug }).eq('id', p.id)
        if (error) throw new Error(error.message)
        console.log(`  ✓ id=${p.id} renamed → "${p.to}"`)
      }
      renamed++
    } catch (err) {
      errors++
      console.error(`  ! id=${p.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── 3. ANON_GROUP cleanup ──────────────────────────────────────────
  console.log('\n3. ANON_GROUP:')
  let anonRenamed = 0, anonMerged = 0, anonDeleted = 0
  for (const p of ANON_PLANS) {
    try {
      if (p.to === null) {
        await deleteAuthor(sb, p.id)
        anonDeleted++
        console.log(`  ✓ id=${p.id} "${p.from}" DELETED`)
        continue
      }
      const newSlug = slugify(p.to)
      const { data: collision } = await sb.from('authors').select('id, display_name').eq('slug', newSlug).neq('id', p.id).maybeSingle()
      if (collision) {
        const moved = await mergeAuthor(sb, p.id, collision.id)
        anonMerged++
        console.log(`  ✓ id=${p.id} merged → id=${collision.id} "${collision.display_name}" (${moved} link(s))`)
      } else {
        // Rename + wipe verkeerde bio-velden
        const { error } = await sb.from('authors').update({
          display_name: p.to,
          slug: newSlug,
          bio: null,
          birth_year: null,
          death_year: null,
          birth_country: null,
          photo_url: null,
        }).eq('id', p.id)
        if (error) throw new Error(error.message)
        anonRenamed++
        console.log(`  ✓ id=${p.id} renamed → "${p.to}" + bio gewist`)
      }
    } catch (err) {
      errors++
      console.error(`  ! id=${p.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`\n── Samenvatting ──`)
  console.log(`  DELETE : ${deleted}`)
  console.log(`  RENAME : ${renamed}`)
  console.log(`  ANON   : renamed=${anonRenamed}, merged=${anonMerged}, deleted=${anonDeleted}`)
  console.log(`  Errors : ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
