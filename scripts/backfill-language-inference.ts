#!/usr/bin/env tsx
/**
 * Backfill original_language + title_native_script for books, using the
 * deterministic Unicode-block detector in src/lib/imports/language-inference.ts.
 *
 * Five categories, processed in this priority order (a book in an earlier
 * category is excluded from later categories):
 *
 *   A. title_native is NON-LATIN but title_native_script is NULL or wrong
 *      → set title_native_script to the detected script.
 *   B. title_native IS NULL and `title` itself contains non-Latin chars
 *      → set title_native = title; title_native_script = detected script.
 *   C. original_language IS NULL and we have a non-Latin script + a
 *      country_code from this book's bans
 *      → infer language from (script, country) and set it.
 *   D. original_language IS NULL and title_native_script = 'latin' (or null)
 *      → leave alone. Too ambiguous to guess without source-text context.
 *   E. original_language IS NOT NULL, language uses Latin script, and
 *      title_native IS NULL. SUBTLETY: we only copy title→title_native when
 *      the title actually looks like it's in the target language — i.e.
 *      contains a non-ASCII Latin diacritic such as á/ñ/é/ü/ç. A title like
 *      "The Trial" with original_language=de is almost certainly the English
 *      translation in the `title` cell (Kafka's actual title is "Der Process");
 *      copying it would create a wrong title_native. The en/fr migration B
 *      didn't have this problem because en titles ARE English and most fr
 *      titles in the corpus ARE French. For everything else, require evidence.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/backfill-language-inference.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/backfill-language-inference.ts --apply     # write
 *   pnpm tsx --env-file=.env.local scripts/backfill-language-inference.ts --only=A,C  # subset
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvLocal() {
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

const APPLY = process.argv.includes('--apply')
const ONLY_ARG = process.argv.find(a => a.startsWith('--only='))
const ONLY = ONLY_ARG
  ? new Set(ONLY_ARG.slice('--only='.length).split(',').map(s => s.trim().toUpperCase()))
  : new Set(['A', 'B', 'C', 'E'])

// Languages whose canonical written form uses Latin script. Used by
// category E to backfill title_native = title where the importer left
// it null (Sprint A migration B did this for en/fr only).
const LATIN_LANGUAGES = new Set([
  'en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi',
  'pl', 'cs', 'hu', 'ro', 'hr', 'sk', 'sl', 'ca', 'eu', 'gl', 'cy',
  'ga', 'is', 'lt', 'lv', 'et', 'tr', 'sq', 'mt', 'af', 'sw',
  // Latin-script non-European: Malay (ms), Vietnamese (vi), Indonesian (id),
  // Latin itself (la). Found in the existing corpus during dry-run.
  'la', 'ms', 'vi', 'id',
])

// Latin-script diacritic test for category E. Any non-ASCII letter (or
// curly apostrophe) is treated as evidence that the title is in its native
// foreign-language form rather than an English translation. Plain ASCII
// titles like "The Trial" fail this and are left untouched.
function hasLatinDiacritic(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    // ASCII letters/digits/whitespace/punctuation pass through; only flag
    // when we see something OUTSIDE the basic ASCII range.
    if (cp > 0x007F) return true
  }
  return false
}

type Book = {
  id: number
  title: string
  title_native: string | null
  title_native_script: string | null
  original_language: string | null
}

async function main() {
  const { adminClient } = await import('../src/lib/supabase')
  const { detectScript, inferLanguage } = await import(
    '../src/lib/imports/language-inference'
  )
  const sb = adminClient()

  console.log(
    `\n── backfill-language-inference (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`,
  )
  console.log(`Categories: ${[...ONLY].sort().join(', ')}\n`)

  // Page through all books; .order('id') keeps .range() stable per
  // feedback_supabase_pagination memory.
  const PAGE = 1000
  const books: Book[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb
      .from('books')
      .select('id, title, title_native, title_native_script, original_language')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    books.push(...(data as Book[]))
    if (data.length < PAGE) break
  }
  console.log(`Loaded ${books.length} books.\n`)

  // Per-book first ban's country, used by category C. Page through the bans
  // table — Supabase caps responses at 1000 rows, so we need .range() with
  // an explicit ordering (per feedback_supabase_pagination memory).
  const countryByBook = new Map<number, string>()
  for (let offset = 0; ; offset += PAGE) {
    const { data, error: bansErr } = await sb
      .from('bans')
      .select('book_id, country_code, year_started')
      .order('year_started', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (bansErr) throw bansErr
    if (!data || data.length === 0) break
    for (const b of data as Array<{ book_id: number; country_code: string }>) {
      if (!countryByBook.has(b.book_id)) countryByBook.set(b.book_id, b.country_code)
    }
    if (data.length < PAGE) break
  }
  console.log(`Joined ${countryByBook.size} books with ≥1 ban for country lookup.\n`)

  type Plan = {
    book: Book
    cat: 'A' | 'B' | 'C' | 'E'
    set: Partial<Pick<Book, 'title_native' | 'title_native_script' | 'original_language'>>
    why: string
  }
  const plans: Plan[] = []

  for (const b of books) {
    // Category A: title_native non-Latin, title_native_script null/wrong.
    if (b.title_native) {
      const s = detectScript(b.title_native)
      if (s && s !== 'latin' && s !== 'mixed') {
        if (b.title_native_script !== s && ONLY.has('A')) {
          plans.push({
            book: b,
            cat: 'A',
            set: { title_native_script: s },
            why: `script(${b.title_native}) = ${s}, was ${b.title_native_script ?? 'NULL'}`,
          })
          continue
        }
      }
    }

    // Category B: title_native NULL but title itself is non-Latin.
    if (!b.title_native) {
      const s = detectScript(b.title)
      if (s && s !== 'latin' && s !== 'mixed') {
        if (ONLY.has('B')) {
          plans.push({
            book: b,
            cat: 'B',
            set: { title_native: b.title, title_native_script: s },
            why: `title is non-Latin (${s}), copy to title_native + tag script`,
          })
          continue
        }
      }
    }

    // Category C: original_language NULL but script is non-Latin → infer.
    if (!b.original_language) {
      const s = b.title_native_script ?? detectScript(b.title_native ?? b.title)
      if (s && s !== 'latin' && s !== 'mixed') {
        const cc = countryByBook.get(b.id) ?? null
        const lang = inferLanguage(s as never, cc, null)
        if (lang && ONLY.has('C')) {
          plans.push({
            book: b,
            cat: 'C',
            set: { original_language: lang },
            why: `script=${s} + country=${cc ?? 'NULL'} → ${lang}`,
          })
          continue
        }
      }
    }

    // Category E: known Latin-script language but title_native NULL.
    // Safety filter — only copy when the title actually looks like the
    // target language (contains a non-ASCII Latin diacritic). Otherwise
    // skip: the title is probably the English translation and copying it
    // would produce a wrong title_native.
    if (b.original_language && LATIN_LANGUAGES.has(b.original_language) && !b.title_native) {
      if (ONLY.has('E') && hasLatinDiacritic(b.title)) {
        plans.push({
          book: b,
          cat: 'E',
          set: { title_native: b.title, title_native_script: 'latin' },
          why: `lang=${b.original_language} + diacritics in title — likely already native form`,
        })
        continue
      }
    }
  }

  // Summary
  const byCat = new Map<string, number>()
  for (const p of plans) byCat.set(p.cat, (byCat.get(p.cat) ?? 0) + 1)
  console.log('── Plan counts ──')
  for (const cat of ['A', 'B', 'C', 'E']) {
    const n = byCat.get(cat) ?? 0
    if (n > 0) console.log(`  ${cat}: ${n}`)
  }
  console.log(`  total: ${plans.length}\n`)

  // Show 5 samples per category
  for (const cat of ['A', 'B', 'C', 'E'] as const) {
    const subset = plans.filter(p => p.cat === cat).slice(0, 5)
    if (subset.length === 0) continue
    console.log(`── Sample category ${cat} ──`)
    for (const p of subset) {
      const changes = Object.entries(p.set)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ')
      console.log(
        `  [${p.book.id}] '${p.book.title}' → { ${changes} }  // ${p.why}`,
      )
    }
    console.log()
  }

  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply to write.\n')
    return
  }

  console.log('── Applying ──')
  let ok = 0
  for (const p of plans) {
    const { error: uerr } = await sb.from('books').update(p.set).eq('id', p.book.id)
    if (uerr) {
      console.error(`  [${p.book.id}] FAIL: ${uerr.message}`)
      continue
    }
    ok++
  }
  console.log(`Updated ${ok}/${plans.length} books.\n`)
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
