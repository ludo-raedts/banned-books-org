/**
 * Title normalization for Russia FSEM (Минюст) books imported with a raw
 * Cyrillic string in the primary `title` column and no structured title fields.
 *
 * What this does (deterministic, NO translation, NO confabulation):
 *   - title_native_script  = 'cyrillic'   (matches detectScript() convention)
 *   - title_transliterated = BGN/PCGN-style romanization of the Cyrillic title
 *   - original_language    = inferLanguage('cyrillic', country) — 'ru' for RU
 *
 * What this deliberately does NOT touch:
 *   - title / slug          — the canonical title stays the real (Cyrillic)
 *     banned title; the public page shows the romanization as an italic aid
 *     under the H1 (see src/app/books/[slug]/page.tsx ~line 1072).
 *   - title_english_meaningful / title_native — English translation is a
 *     separate, optional editorial step; we have no trustworthy source for
 *     ~400 obscure extremist-list titles and refuse to hallucinate them.
 *
 * Scope: books with an RU "Federal List of Extremist Materials" ban whose
 * title is predominantly Cyrillic and that do not already carry a
 * transliteration (idempotent — safe to re-run).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/normalize-russia-titles.ts            # dry-run
 *   pnpm tsx --env-file=.env.local scripts/normalize-russia-titles.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { detectScript, inferLanguage } from '../src/lib/imports/language-inference'

const APPLY = process.argv.includes('--apply')
const s = adminClient()

// BGN/PCGN-style Russian Cyrillic → Latin (ASCII, no diacritics). Matches the
// slug transliteration in scripts/import-russia-bans.ts for consistency, but
// preserves spacing/punctuation/casing for a human-readable display string.
const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ѵ: 'i', ѳ: 'f', і: 'i', ѣ: 'ye',  // pre-1918 Russian
  ї: 'yi', є: 'ye', ґ: 'g',          // Ukrainian (in case a UA-script title slips in)
  ў: 'w',                            // Belarusian
}

const isUpperLetter = (c: string | undefined) => !!c && c !== c.toLowerCase() && c === c.toUpperCase()

function transliterate(text: string): string {
  const chars = [...text]
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const lower = ch.toLowerCase()
    const mapped = MAP[lower]
    if (mapped === undefined) {
      out += ch                     // keep Latin letters, digits, punctuation, spaces as-is
      continue
    }
    if (ch === lower || mapped === '') {
      out += mapped                 // lowercase source, or dropped sign
    } else if (isUpperLetter(chars[i - 1]) || isUpperLetter(chars[i + 1])) {
      out += mapped.toUpperCase()   // inside an ALL-CAPS run → fully upper (СВЯЩ → SVYASHCH)
    } else {
      out += (mapped[0]?.toUpperCase() ?? '') + mapped.slice(1)  // title-case (Х → Kh)
    }
  }
  // Collapse any double spaces introduced by dropped hard/soft signs.
  return out.replace(/\s{2,}/g, ' ').trim()
}

interface BookRow {
  id: number
  title: string
  title_native_script: string | null
  title_transliterated: string | null
  original_language: string | null
}

async function main() {
  console.log(`\n── normalize-russia-titles ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // Collect book_ids from RU FSEM bans.
  const bookIds = new Set<number>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await s
      .from('bans').select('book_id')
      .eq('country_code', 'RU')
      .ilike('description', '%Federal List of Extremist Materials%')
      .order('id').range(from, from + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const b of data as Array<{ book_id: number }>) bookIds.add(b.book_id)
    if (data.length < 1000) break
  }
  console.log(`  RU FSEM books: ${bookIds.size}`)

  const ids = [...bookIds]
  const books: BookRow[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await s
      .from('books')
      .select('id, title, title_native_script, title_transliterated, original_language')
      .in('id', ids.slice(i, i + 200))
    if (error) throw error
    books.push(...(data as BookRow[]))
  }

  type Plan = { id: number; title: string; translit: string; lang: string | null; setLang: boolean }
  const plan: Plan[] = []
  let skipLatin = 0, skipHasTranslit = 0, skipNoTranslit = 0

  for (const b of books) {
    const script = detectScript(b.title)
    if (script !== 'cyrillic') { skipLatin++; continue }          // Mein Kampf etc. — leave Latin titles alone
    if (b.title_transliterated) { skipHasTranslit++; continue }   // idempotent
    const translit = transliterate(b.title)
    if (!translit || translit === b.title) { skipNoTranslit++; continue }
    const lang = inferLanguage('cyrillic', 'RU', null)            // 'ru'
    plan.push({ id: b.id, title: b.title, translit, lang, setLang: b.original_language == null })
  }

  console.log(`\n── Plan: ${plan.length} books to normalize`)
  console.log(`  skip (non-Cyrillic title):     ${skipLatin}`)
  console.log(`  skip (already transliterated): ${skipHasTranslit}`)
  console.log(`  skip (no transliteration):     ${skipNoTranslit}`)
  console.log(`\n── Sample (first 12) ──`)
  for (const p of plan.slice(0, 12)) {
    console.log(`  book_${p.id}`)
    console.log(`    title:      ${p.title.slice(0, 70)}`)
    console.log(`    translit:   ${p.translit.slice(0, 70)}`)
    console.log(`    lang:       ${p.setLang ? p.lang : '(kept existing)'}  script: cyrillic`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──\n`)
    return
  }

  console.log(`\n── Applying ──`)
  let updated = 0, errors = 0
  for (const p of plan) {
    const patch: Record<string, unknown> = {
      title_native_script: 'cyrillic',
      title_transliterated: p.translit,
    }
    if (p.setLang && p.lang) patch.original_language = p.lang
    const { error } = await s.from('books').update(patch).eq('id', p.id)
    if (error) { errors++; console.error(`  ! book_${p.id}: ${error.message}`); continue }
    updated++
    if (updated % 50 === 0) process.stdout.write(`  ${updated}/${plan.length}\r`)
  }
  process.stdout.write('\n')
  console.log(`\n── Done ── updated: ${updated}  errors: ${errors}\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
