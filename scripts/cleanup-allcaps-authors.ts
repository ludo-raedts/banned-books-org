/**
 * Title-case ALL-CAPS author display_name values.
 *
 * The Malaysian KDN ban gazette (and a few other batches) imported authors
 * in ALL-CAPS, the same typewriter-era convention that produced the 1,805
 * ALL-CAPS KDN book titles cleaned up in 794bf5b. We fix display names here
 * for cosmetic readability and to give the bio-enrichment script a fairer
 * Wikipedia query (case is a non-issue for `srsearch`, but title-similarity
 * scoring downstream and any LLM ladders care).
 *
 * Slugs are already lowercased at insert time, so no slug regeneration is
 * needed and URLs stay stable.
 *
 * Title-casing rules:
 *   - Token-by-token: first letter cap, rest lower
 *   - Initials with periods stay capped (A.I., U.K., M.A., P.U.)
 *   - Hyphenated and period-glued segments get a cap after the separator
 *     ("AL-MANDILI" → "Al-Mandili", "ABD.HAMID" → "Abd.Hamid")
 *   - Name-connector particles stay lowercase in the middle:
 *     bin, binti, bt, ibn, al, el, de, da, du, van, von, der, den, of
 *   - Tokens with digits get only their alpha portion case-folded
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/cleanup-allcaps-authors.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/cleanup-allcaps-authors.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

// Name-connector particles that stay lowercase in the middle of a name.
// Includes Malay (bin/binti/bt), Arabic article variants (al/el/ibn),
// the common European nobility/patronymic particles, and English articles.
// Deliberately omits la/le/lo/do — those collide with Chinese/Vietnamese
// surnames in this dataset (KAM LO, LO WEI, DO TRANG), and the cost of
// missing a Spanish/French "la/le" is lower than mis-lowercasing a surname.
const PARTICLES = new Set([
  'bin', 'binti', 'bt', 'bte',
  'ibn', 'bint',
  'al', 'el',
  'de', 'da', 'di', 'du',
  'van', 'von', 'der', 'den', 'des',
  'of', 'the', 'a', 'an', 'and', '&',
])

/** Acronym detector: only matches initials-with-periods like A.I., M.A., U.S.A. */
function isInitialism(token: string): boolean {
  return /^([A-Z]\.){1,}[A-Z]?\.?$/.test(token)
}

/** Cap-first, lower-rest, with caps after hyphens, parens, commas, and inside-name periods. */
function smartCap(word: string): string {
  return word.toLowerCase().replace(/(^|[\-.(,])([a-z])/g, (_m, sep, ch) => sep + ch.toUpperCase())
}

function caseToken(token: string, position: 'first' | 'last' | 'middle'): string {
  if (token.length === 0) return token
  // Preserve initials with periods
  if (isInitialism(token)) return token.toUpperCase()
  // Tokens with digits: case-fold only alpha runs
  if (/\d/.test(token)) {
    return token.replace(/[A-Za-z]+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  }
  // Strip surrounding punctuation/brackets to test the particle rule on the inner word
  const inner = token.replace(/^[^A-Za-z]+/, '').replace(/[^A-Za-z]+$/, '').toLowerCase()
  if (position === 'middle' && PARTICLES.has(inner)) {
    // Lowercase the alphabetic portion, keep any bracket/punct around it
    return token.toLowerCase()
  }
  return smartCap(token)
}

function titleCaseName(raw: string): string {
  const tokens = raw.split(/(\s+)/)
  const wordIndices: number[] = []
  tokens.forEach((t, i) => { if (t.trim().length > 0) wordIndices.push(i) })
  if (wordIndices.length === 0) return raw
  const firstIdx = wordIndices[0]
  const lastIdx = wordIndices[wordIndices.length - 1]
  return tokens.map((t, i) => {
    if (t.trim().length === 0) return t
    const pos: 'first' | 'last' | 'middle' =
      i === firstIdx ? 'first' :
      i === lastIdx  ? 'last'  : 'middle'
    return caseToken(t, pos)
  }).join('')
}

async function main() {
  const sb = adminClient()
  console.log(`\n── cleanup-allcaps-authors ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const PAGE = 1000
  let offset = 0
  type Row = { id: number; display_name: string }
  const candidates: Row[] = []
  while (true) {
    const { data, error } = await sb
      .from('authors')
      .select('id, display_name')
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data) {
      const alpha = r.display_name.replace(/[^A-Za-z]/g, '')
      if (alpha.length >= 3 && alpha === alpha.toUpperCase()) {
        candidates.push({ id: r.id, display_name: r.display_name })
      }
    }
    if (data.length < PAGE) break
    offset += PAGE
  }
  console.log(`ALL-CAPS author candidates: ${candidates.length}\n`)

  type Update = { id: number; old: string; clean: string }
  const updates: Update[] = []
  for (const c of candidates) {
    const clean = titleCaseName(c.display_name)
    if (clean === c.display_name) continue
    updates.push({ id: c.id, old: c.display_name, clean })
  }
  console.log(`Will update ${updates.length} display_name values.\n`)
  const DUMP = process.argv.includes('--dump-all')
  if (DUMP) {
    for (const u of updates) {
      console.log(`id=${u.id}\tFROM: ${u.old}\tTO: ${u.clean}`)
    }
  } else {
    console.log(`Sample (first 40):\n`)
    for (const u of updates.slice(0, 40)) {
      console.log(`  id=${u.id}`)
      console.log(`    FROM: ${u.old}`)
      console.log(`    →     ${u.clean}`)
    }
    console.log(`\nSample (last 20):\n`)
    for (const u of updates.slice(-20)) {
      console.log(`  id=${u.id}`)
      console.log(`    FROM: ${u.old}`)
      console.log(`    →     ${u.clean}`)
    }
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
      const { error } = await sb.from('authors').update({ display_name: u.clean }).eq('id', u.id)
      if (error) { errors++; console.error(`  ! author_${u.id}: ${error.message}`) }
      else updated++
    }))
    if ((i + CHUNK) % 200 === 0) console.log(`  ...${Math.min(i + CHUNK, updates.length)}/${updates.length}`)
  }
  console.log(`\n  updated: ${updated}, errors: ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
