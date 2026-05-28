/**
 * Title-case the mixed-case titels die door `cleanup-kdn-allcaps-titles.ts`
 * worden gemist — dat script vangt alleen titels waar het ALPHABETIC
 * content 100% uppercase is. Mixed-case titels zoals
 *
 *   "Risalah bertajuk \"BERSATULAH KAMU CHINA\""
 *   "HIDUP BAGAIKAN SUNGAI MENGALIR Kisah 16 Orang Wanita …"
 *   "Siri Pengakuan-KEMBARA SEORANG LELAKI"
 *
 * blijven nu staan. Bron: `data/metadata-in-titles-review.md` (categorie
 * ALL_CAPS_RUN, 40 hits per 2026-05-28).
 *
 * Detectie: titel heeft een run van ≥3 opeenvolgende woorden volledig in
 * ALL CAPS (dezelfde heuristiek als `_audit_metadata_in_titles.ts`).
 *
 * Title-cased per token via de bestaande regels:
 *   - First letter cap, rest lower
 *   - Minor words (NL/EN/MS) lowercase tenzij first/last
 *   - Acronyms (period-separated of pure-consonant ≤5 chars) blijven uppercase
 *   - Tokens met digits worden first-cap (NO. → No., MDCCC blijft)
 *   - Single-letter tokens worden NIET aangeraakt (volume markers I/II/l/ll)
 *
 * Read-only by default. Pass `--apply` om door te voeren.
 *
 *   pnpm tsx --env-file=.env.local scripts/cleanup-mixed-allcaps-titles.ts
 *   pnpm tsx --env-file=.env.local scripts/cleanup-mixed-allcaps-titles.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

// Audit detection — same as _audit_metadata_in_titles.ts ALL_CAPS_RUN
const RE_ALL_CAPS_RUN = /(?:[A-Z]{2,}\s+){2,}[A-Z]{2,}/

const MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into',
  'of', 'on', 'onto', 'or', 'the', 'to', 'with', 'nor', 'yet', 'so',
  'di', 'ke', 'dan', 'untuk', 'dari', 'dalam', 'yang', 'serta', 'pada',
  'tapi', 'atau', 'ata',
])

// Roman volume markers — laat staan: I, II, III, IV, V, l, ll, lll
const RE_ROMAN_NUMERAL = /^(?:[Il]+|[IVXivx]{1,4})$/

function looksLikeAcronym(word: string): boolean {
  if (word.length < 2 || word.length > 5) return false
  if (!/^[A-Z]+$/.test(word)) return false
  return !/[AEIOU]/.test(word)
}

function titleCaseWord(word: string, isFirst: boolean, isLast: boolean): string {
  if (RE_ROMAN_NUMERAL.test(word)) return word
  if (looksLikeAcronym(word)) return word.toUpperCase()
  const lower = word.toLowerCase()
  if (!isFirst && !isLast && MINOR_WORDS.has(lower)) return lower
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

// Per alphabetic chunk (Unicode-letters), niet per whitespace-token. Punctuatie
// (quotes, parens, periods, apostrofs) blijft behouden — alleen de letter-
// chunks worden getransformeerd.
function titleCase(raw: string): string {
  const RE_WORD = /[A-Za-zÀ-ÿ]+/g
  const matches: Array<{ word: string; offset: number }> = []
  let m: RegExpExecArray | null
  while ((m = RE_WORD.exec(raw)) !== null) {
    matches.push({ word: m[0], offset: m.index })
  }
  if (matches.length === 0) return raw

  const firstOffset = matches[0].offset
  const lastOffset = matches[matches.length - 1].offset

  return raw.replace(RE_WORD, (word, offset: number) => {
    return titleCaseWord(word, offset === firstOffset, offset === lastOffset)
  })
}

const PAGE = 1000

async function main() {
  const sb = adminClient()
  console.log(`\n── cleanup-mixed-allcaps-titles ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  type Row = { id: number; title: string; slug: string }
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('books')
      .select('id, title, slug')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as Row[]))
    if (data.length < PAGE) break
  }
  console.log(`Books loaded: ${rows.length}`)

  // Filter: titel heeft ALL_CAPS_RUN substring (3+ opeenvolgende ALL CAPS woorden)
  const candidates = rows.filter(r => RE_ALL_CAPS_RUN.test(r.title))
  console.log(`Mixed-allcaps candidates: ${candidates.length}\n`)

  type Update = { id: number; old: string; clean: string; slug: string }
  const updates: Update[] = []
  const unchanged: Row[] = []
  for (const c of candidates) {
    const clean = titleCase(c.title)
    if (clean === c.title) {
      unchanged.push(c)
      continue
    }
    updates.push({ id: c.id, old: c.title, clean, slug: c.slug })
  }

  console.log(`Will update: ${updates.length}`)
  if (unchanged.length > 0) {
    console.log(`Already correct (no change): ${unchanged.length}`)
  }
  console.log('')

  for (const u of updates) {
    console.log(`book_${u.id}  \`${u.slug}\``)
    console.log(`  FROM: ${u.old}`)
    console.log(`  →     ${u.clean}`)
    console.log('')
  }

  if (!APPLY) {
    console.log(`── Dry-run complete. Re-run with --apply om door te voeren. ──\n`)
    return
  }

  console.log(`── Applying ${updates.length} updates ──`)
  let updated = 0, errors = 0
  const CHUNK = 25
  for (let i = 0; i < updates.length; i += CHUNK) {
    const slice = updates.slice(i, i + CHUNK)
    await Promise.all(slice.map(async u => {
      const { error } = await sb.from('books').update({ title: u.clean }).eq('id', u.id)
      if (error) { errors++; console.error(`  ! book_${u.id}: ${error.message}`) }
      else updated++
    }))
  }
  console.log(`\n  updated: ${updated}, errors: ${errors}\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
