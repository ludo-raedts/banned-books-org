/**
 * Title-case the 1,801 KDN-imported books that have ALL-CAPS titles.
 *
 * The Malaysian KDN gazette uses ALL-CAPS for nearly all pre-2010 entries
 * (typewriter-era convention). This breaks:
 *   - cosmetic display ("SUARA RAKYAT" vs "Suara Rakyat")
 *   - enrichment lookups (OpenLibrary/Google Books title-similarity scores
 *     suffer because the canonical record stores mixed case)
 *   - search/SEO ranking
 *
 * Strategy: storage-level title-casing, KDN-sourced books only. Non-KDN
 * all-caps titles (1Q84, AIDS, CAMP, MARS, BZRK, XL, ONE PIECE, Z) are
 * intentionally stylised and NOT touched.
 *
 * Title-casing rules:
 *   - Capitalize first letter of each word
 *   - Minor words (a, an, and, of, the, to, in, on, for, etc.) stay
 *     lowercase UNLESS they're the first or last word
 *   - Tokens that already mix cases or contain digits are left alone
 *     (handles e.g. "P.U." which stays "P.U.", "NO.1" stays "No.1")
 *   - Acronyms detected by length ≤ 4 and pure-consonant pattern stay
 *     all-caps inline (e.g. "DDR", "NSA", "PKM")
 *   - Slugs are NOT regenerated; URLs unchanged
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/cleanup-kdn-allcaps-titles.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/cleanup-kdn-allcaps-titles.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const KDN_SOURCE_ID = 2154

// English-convention minor words that stay lowercase unless first/last.
// Works for Malay/Indonesian too (they overlap on common short connectives,
// and "in/of/the" would just stay as English loanwords or not appear at all).
const MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into',
  'of', 'on', 'onto', 'or', 'the', 'to', 'with', 'nor', 'yet', 'so',
  // Malay/Indonesian function words
  'di', 'ke', 'dan', 'untuk', 'dari', 'dalam', 'yang', 'serta', 'pada',
])

/** True when a short uppercase token looks like an acronym (DDR, NSA, P.U.) */
function looksLikeAcronym(token: string): boolean {
  // Period-separated form: P.U., K.M.T, U.S.A., B.B.C. → always acronym
  if (/^([A-Z]\.){1,}[A-Z]?\.?$/.test(token)) return true
  // Pure consonants of length 2-5 (DDR, NSA, BSSR, PKM)
  // Vowel-containing short words ("THE", "IN", "BIG", "RED", "WIN", "SUN", "HOW")
  // and short non-acronyms ("USA", "EPA") fall through to standard title-case.
  // Trade-off: a few real acronyms get title-cased (Usa) — acceptable cost for
  // not over-capitalising common 2-3-letter English words.
  const stripped = token.replace(/[.\-,;:()\[\]"']/g, '')
  if (stripped.length < 2 || stripped.length > 5) return false
  if (!/^[A-Z]+$/.test(stripped)) return false
  return !/[AEIOU]/.test(stripped)
}

function titleCaseToken(token: string, position: 'first' | 'last' | 'middle'): string {
  if (token.length === 0) return token
  // Don't touch tokens that contain digits — preserve "NO.1", "P.U.(A)", "MDCCC"
  if (/\d/.test(token)) {
    // For tokens like "NO." → "No." — first letter cap, rest lower for the alpha portion
    return token.replace(/[A-Za-z]+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  }
  // Preserve acronyms (DDR, NSA, P.U., U.K., etc.)
  if (looksLikeAcronym(token)) return token.toUpperCase()
  // Minor words stay lowercase unless first or last
  const lower = token.toLowerCase()
  if (position === 'middle' && MINOR_WORDS.has(lower)) {
    return lower
  }
  // Standard title-case: first letter capital, rest lower
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
}

function titleCase(raw: string): string {
  // Split on whitespace, preserving original spacing
  const tokens = raw.split(/(\s+)/)   // captures whitespace runs as separators
  const wordIndices: number[] = []
  tokens.forEach((t, i) => { if (t.trim().length > 0) wordIndices.push(i) })
  if (wordIndices.length === 0) return raw

  const firstIdx = wordIndices[0]
  const lastIdx = wordIndices[wordIndices.length - 1]

  return tokens.map((t, i) => {
    if (t.trim().length === 0) return t   // whitespace, leave as-is
    const pos: 'first' | 'last' | 'middle' =
      i === firstIdx ? 'first' :
      i === lastIdx  ? 'last'  : 'middle'
    return titleCaseToken(t, pos)
  }).join('')
}

async function main() {
  const sb = adminClient()
  console.log(`\n── cleanup-kdn-allcaps-titles ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // Fetch ALL books, filter in JS to KDN-sourced + all-caps
  type Row = { id: number; title: string; slug: string }
  const seen = new Set<number>()
  const candidates: Row[] = []
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('books')
      .select(`
        id, title, slug,
        bans!inner(ban_source_links!inner(source_id))
      `)
      .order('id')
      .range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data as unknown as Array<{
      id: number; title: string; slug: string;
      bans: Array<{ ban_source_links: Array<{ source_id: number }> }>
    }>) {
      if (seen.has(r.id)) continue
      const isKdn = r.bans.some(b => b.ban_source_links.some(l => l.source_id === KDN_SOURCE_ID))
      if (!isKdn) continue
      seen.add(r.id)
      // Test: title is all-caps in its alphabetic content
      const alpha = r.title.replace(/[^A-Za-z]/g, '')
      if (alpha.length > 0 && alpha === alpha.toUpperCase()) {
        candidates.push({ id: r.id, title: r.title, slug: r.slug })
      }
    }
    if (data.length < 1000) break
    offset += 1000
  }

  console.log(`KDN all-caps candidates: ${candidates.length}\n`)

  type Update = { id: number; old: string; clean: string }
  const updates: Update[] = []
  for (const c of candidates) {
    const clean = titleCase(c.title)
    if (clean === c.title) continue
    updates.push({ id: c.id, old: c.title, clean })
  }

  console.log(`Will update ${updates.length} titles. Sample (first 25):\n`)
  for (const u of updates.slice(0, 25)) {
    console.log(`  book_${u.id}`)
    console.log(`    FROM: ${u.old.slice(0, 80)}`)
    console.log(`    →     ${u.clean.slice(0, 80)}`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──\n`)
    return
  }

  console.log(`\n── Applying ${updates.length} updates ──`)
  let updated = 0, errors = 0
  const CHUNK = 50
  for (let i = 0; i < updates.length; i += CHUNK) {
    const slice = updates.slice(i, i + CHUNK)
    await Promise.all(slice.map(async u => {
      const { error } = await sb.from('books').update({ title: u.clean }).eq('id', u.id)
      if (error) { errors++; console.error(`  ! book_${u.id}: ${error.message}`) }
      else updated++
    }))
    if ((i + CHUNK) % 200 === 0) console.log(`  ...${Math.min(i + CHUNK, updates.length)}/${updates.length}`)
  }
  console.log(`\n  updated: ${updated}, errors: ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
