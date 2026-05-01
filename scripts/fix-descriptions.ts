/**
 * Fix missing and non-English book descriptions.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/fix-descriptions.ts
 *         # dry-run: shows first 3 translations, no writes
 *   npx tsx --env-file=.env.local scripts/fix-descriptions.ts --apply
 *         # translates all non-English + writes clean Part A fetches
 *
 * Part A: books with no description_book but with openlibrary_work_id
 *         → fetch from Open Library, skip non-English and known mismatches
 * Part B: books with non-English description_book
 *         → translate to English with gpt-4o-mini, verify with franc-min
 *         → store translated text, set ai_drafted = true
 */

import { adminClient } from '../src/lib/supabase'
import { franc } from 'franc-min'
import OpenAI from 'openai'

const APPLY        = process.argv.includes('--apply')
const RATE_LIMIT_MS = 400

// Part A: OL work IDs that returned clearly wrong descriptions (wrong book matched)
const OL_MISMATCH_SLUGS = new Set([
  'aku-malaysia',      // got Huckleberry Finn description
  'more-joy-of-sex',   // got a book-banning journal article
  'over-lifes-edge',   // got American Film magazine description
  'six-women',         // got American Film magazine description
  'the-tale-of-steven', // got The Secret Agent (Conrad) description
])

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function detectLang(text: string): string {
  if (text.length < 20) return 'und'
  return franc(text)
}

async function fetchOLDescription(workId: string): Promise<string | null> {
  const url = `https://openlibrary.org/works/${workId}.json`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' },
    })
    if (!res.ok) return null
    const data = await res.json() as Record<string, unknown>
    const raw = data.description
    if (!raw) return null
    if (typeof raw === 'string') return raw.trim() || null
    if (typeof raw === 'object' && raw !== null && 'value' in raw) {
      const v = (raw as { value: unknown }).value
      return typeof v === 'string' ? v.trim() || null : null
    }
    return null
  } catch { return null }
}

async function translateToEnglish(openai: OpenAI, text: string): Promise<string | null> {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content: 'You are a translator. Translate the following book description to English. Keep the same tone and style. Output only the translated text, nothing else.',
      },
      { role: 'user', content: text },
    ],
  })
  return res.choices[0]?.message?.content?.trim() ?? null
}

async function main() {
  const supabase = adminClient()
  const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const mode     = APPLY ? 'APPLY' : 'DRY-RUN (first 3 translations shown)'
  console.log(`\n── fix-descriptions (${mode}) ──\n`)

  // ── PART A: fetch missing descriptions from Open Library ─────────────────
  const { data: missingAll, error: e1 } = await supabase
    .from('books')
    .select('id, slug, title, openlibrary_work_id')
    .or('description_book.is.null,description_book.eq.')
    .order('title')
  if (e1) { console.error('DB error:', e1.message); process.exit(1) }

  const withOL = (missingAll ?? []).filter(b => b.openlibrary_work_id)
  console.log(`Part A — missing descriptions`)
  console.log(`  Books with no description       : ${(missingAll ?? []).length}`)
  console.log(`  Of those, have openlibrary_work_id: ${withOL.length}`)
  console.log(`  Known OL mismatches (skipped)   : ${OL_MISMATCH_SLUGS.size}`)

  let partAWritten = 0, partASkippedMismatch = 0, partASkippedEmpty = 0, partASkippedLang = 0

  for (const book of withOL) {
    await sleep(RATE_LIMIT_MS)

    if (OL_MISMATCH_SLUGS.has(book.slug)) {
      partASkippedMismatch++
      continue
    }

    const raw = await fetchOLDescription(book.openlibrary_work_id as string)
    if (!raw || raw.length < 40) { partASkippedEmpty++; continue }

    const lang = detectLang(raw)
    if (lang !== 'eng' && lang !== 'und') {
      partASkippedLang++
      console.log(`  SKIP (lang=${lang}) ${book.slug}`)
      continue
    }

    console.log(`  FETCH OK [${lang}] ${book.slug}: "${raw.slice(0, 80)}…"`)

    if (APPLY) {
      const { error } = await supabase
        .from('books')
        .update({ description_book: raw, ai_drafted: false })
        .eq('id', book.id)
      if (error) console.error(`  DB error for ${book.slug}:`, error.message)
      else partAWritten++
    }
  }

  console.log(`\n  Part A summary:`)
  console.log(`    Skipped — known OL mismatch    : ${partASkippedMismatch}`)
  console.log(`    Skipped — empty / too short    : ${partASkippedEmpty}`)
  console.log(`    Skipped — non-English from OL  : ${partASkippedLang}`)
  if (APPLY) console.log(`    Written to DB                  : ${partAWritten}`)
  else       console.log(`    Would write (--apply to confirm): ${withOL.length - partASkippedMismatch - partASkippedEmpty - partASkippedLang}`)

  // ── PART B: translate non-English existing descriptions ───────────────────
  const { data: hasDesc, error: e2 } = await supabase
    .from('books')
    .select('id, slug, title, description_book')
    .not('description_book', 'is', null)
    .neq('description_book', '')
    .order('title')
  if (e2) { console.error('DB error:', e2.message); process.exit(1) }

  const nonEnglish = (hasDesc ?? []).filter(b => {
    const lang = detectLang(b.description_book as string)
    return lang !== 'eng' && lang !== 'und'
  })

  console.log(`\nPart B — non-English descriptions to translate`)
  console.log(`  Books with a description        : ${(hasDesc ?? []).length}`)
  console.log(`  Non-English detected            : ${nonEnglish.length}`)

  if (nonEnglish.length === 0) {
    console.log(`  Nothing to do.`)
  } else {
    let translated = 0, translationErrors = 0, verifyFailed = 0
    const limit = APPLY ? nonEnglish.length : 3  // dry-run shows first 3

    console.log(APPLY
      ? `\n  Translating all ${nonEnglish.length} books…\n`
      : `\n  DRY-RUN — showing translations for first ${limit} books:\n`
    )

    for (let i = 0; i < limit; i++) {
      const book = nonEnglish[i]
      const srcLang = detectLang(book.description_book as string)
      console.log(`  [${i + 1}/${limit}] ${book.slug} (detected: ${srcLang})`)
      console.log(`    Original : "${(book.description_book as string).slice(0, 120)}…"`)

      let translation: string | null = null
      try {
        translation = await translateToEnglish(openai, book.description_book as string)
      } catch (err) {
        console.log(`    ERROR    : ${err instanceof Error ? err.message : String(err)}`)
        translationErrors++
        continue
      }

      if (!translation) {
        console.log(`    ERROR    : empty response from OpenAI`)
        translationErrors++
        continue
      }

      const outLang = detectLang(translation)
      if (outLang !== 'eng' && outLang !== 'und') {
        console.log(`    SKIP     : translation detected as ${outLang}, not English`)
        console.log(`    Translation was: "${translation.slice(0, 120)}…"`)
        verifyFailed++
        continue
      }

      console.log(`    Translated [${outLang}]: "${translation.slice(0, 120)}…"`)

      if (APPLY) {
        const { error } = await supabase
          .from('books')
          .update({ description_book: translation, ai_drafted: true })
          .eq('id', book.id)
        if (error) {
          console.log(`    DB error: ${error.message}`)
          translationErrors++
        } else {
          translated++
          console.log(`    ✓ Written`)
        }
      }
      console.log()
    }

    console.log(`  Part B summary:`)
    if (APPLY) {
      console.log(`    Translated & written : ${translated}`)
      console.log(`    Translation errors   : ${translationErrors}`)
      console.log(`    Verify failed (skipped): ${verifyFailed}`)
    } else {
      console.log(`    (dry-run — ${nonEnglish.length - limit} more books would be translated with --apply)`)
    }
  }

  console.log(`\n── Done ──`)
  if (!APPLY) console.log('\nRe-run with --apply to write all changes.\n')
}

main().catch(e => { console.error(e); process.exit(1) })
