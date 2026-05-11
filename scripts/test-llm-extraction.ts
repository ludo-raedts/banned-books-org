#!/usr/bin/env tsx
/**
 * Two-pass extraction test harness.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/test-llm-extraction.ts
 *   pnpm tsx --env-file=.env.local scripts/test-llm-extraction.ts --high-stakes
 */
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import {
  extractBothPasses,
  compareExtractions,
  type ModelTier,
  type BothPassesResult,
} from '../src/lib/imports/llm-extraction'
import type { AgreementResult, Extraction } from '../src/lib/imports/extraction-types'

interface TestRow {
  id: string
  raw_text: string
  expected_is_book: string
  expected_language: string
  expected_script: string
  notes: string
}

interface ResultRow {
  id: string
  notes: string
  agreement: AgreementResult
  gemini: Extraction | null
  openai: Extraction | null
  errors: BothPassesResult['errors']
  usage: BothPassesResult['usage']
  elapsed: number
}

// USD per 1M tokens. Public list prices as of 2025-2026; update if pricing changes.
const PRICING: Record<ModelTier, { input: number; output: number }> = {
  // gpt-4o-mini ($0.15/$0.60) + gemini-2.5-flash ($0.30/$2.50) per 1M tokens.
  // We add both passes since we make two calls per entry.
  'high-volume': { input: 0.15 + 0.30, output: 0.60 + 2.50 },
  // gpt-4o ($2.50/$10) + gemini-2.5-pro ($1.25/$10) per 1M tokens.
  'high-stakes': { input: 2.50 + 1.25, output: 10.0 + 10.0 },
}

async function main() {
  const csvPath = path.join('data/sources/test-fixture-extraction.csv')
  const csvText = fs.readFileSync(csvPath, 'utf-8')
  const rows: TestRow[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
  })

  const tier: ModelTier = process.argv.includes('--high-stakes')
    ? 'high-stakes'
    : 'high-volume'

  console.log(
    `\nRunning two-pass extraction on ${rows.length} fixture entries (tier=${tier})\n`,
  )
  console.log('═'.repeat(80))

  const results: ResultRow[] = []
  const agreementCounts: Record<AgreementResult['agreement'], number> = {
    full: 0,
    partial: 0,
    conflict: 0,
    'single-pass-only': 0,
  }
  const totalUsage = { input_tokens: 0, output_tokens: 0 }
  const warnings: string[] = []

  for (const row of rows) {
    console.log(`\n▶ ${row.id}: ${row.notes}`)
    console.log(
      `  Input: ${row.raw_text.slice(0, 90)}${row.raw_text.length > 90 ? '...' : ''}`,
    )

    const start = Date.now()
    const result = await extractBothPasses(row.raw_text, tier)
    const elapsed = Date.now() - start
    const { gemini, openai, errors, usage } = result

    if (errors.gemini) console.log(`  ⚠ Gemini error: ${errors.gemini}`)
    if (errors.openai) console.log(`  ⚠ OpenAI error: ${errors.openai}`)

    const agreement = compareExtractions(gemini, openai)
    agreementCounts[agreement.agreement]++

    console.log(
      `  Agreement: ${agreement.agreement}${
        agreement.conflict_fields.length
          ? ` — conflicts: ${agreement.conflict_fields.join(', ')}`
          : ''
      }`,
    )
    console.log(`  Time: ${elapsed}ms`)

    // Red flag: is_book disagreement when expected_is_book = true
    if (
      agreement.conflict_fields.includes('is_book') &&
      row.expected_is_book === 'true'
    ) {
      const warn = `[${row.id}] RED FLAG: models disagreed on is_book for a real book`
      console.log(`  🚩 ${warn}`)
      warnings.push(warn)
    }

    if (agreement.agreement !== 'full' && gemini && openai) {
      console.log('  ── Gemini ──')
      console.log(`    title_native: ${gemini.title_native}`)
      console.log(`    title_transliterated: ${gemini.title_transliterated}`)
      console.log(`    title_english: ${gemini.title_english_meaningful}`)
      console.log(`    year: ${gemini.year_published}`)
      console.log(
        `    authors: ${gemini.authors.map(a => a.name_english).join(', ')}`,
      )
      console.log('  ── OpenAI ──')
      console.log(`    title_native: ${openai.title_native}`)
      console.log(`    title_transliterated: ${openai.title_transliterated}`)
      console.log(`    title_english: ${openai.title_english_meaningful}`)
      console.log(`    year: ${openai.year_published}`)
      console.log(
        `    authors: ${openai.authors.map(a => a.name_english).join(', ')}`,
      )
    }

    // Validate against expectations
    if (gemini) {
      const expectedIsBook = row.expected_is_book === 'true'
      if (gemini.is_book !== expectedIsBook) {
        console.log(
          `  ✗ Gemini got is_book wrong: expected ${expectedIsBook}, got ${gemini.is_book}`,
        )
      }
      if (
        row.expected_language &&
        gemini.original_language !== row.expected_language
      ) {
        console.log(
          `  ⚠ Gemini got language: expected ${row.expected_language}, got ${gemini.original_language}`,
        )
      }
    }
    if (openai) {
      const expectedIsBook = row.expected_is_book === 'true'
      if (openai.is_book !== expectedIsBook) {
        console.log(
          `  ✗ OpenAI got is_book wrong: expected ${expectedIsBook}, got ${openai.is_book}`,
        )
      }
      if (
        row.expected_language &&
        openai.original_language !== row.expected_language
      ) {
        console.log(
          `  ⚠ OpenAI got language: expected ${row.expected_language}, got ${openai.original_language}`,
        )
      }
    }

    if (usage.gemini) {
      totalUsage.input_tokens += usage.gemini.input_tokens
      totalUsage.output_tokens += usage.gemini.output_tokens
    }
    if (usage.openai) {
      totalUsage.input_tokens += usage.openai.input_tokens
      totalUsage.output_tokens += usage.openai.output_tokens
    }

    results.push({
      id: row.id,
      notes: row.notes,
      agreement,
      gemini,
      openai,
      errors,
      usage,
      elapsed,
    })
  }

  // Summary
  console.log('\n' + '═'.repeat(80))
  console.log(`SUMMARY (tier=${tier})`)
  console.log('═'.repeat(80))
  console.log(`Total entries: ${rows.length}`)
  console.log(`Full agreement:           ${agreementCounts.full}`)
  console.log(`Partial agreement:        ${agreementCounts.partial}`)
  console.log(`Conflict:                 ${agreementCounts.conflict}`)
  console.log(`Single-pass-only:         ${agreementCounts['single-pass-only']}`)
  const avgMs = Math.round(
    results.reduce((s, r) => s + r.elapsed, 0) / results.length,
  )
  console.log(`Avg time per entry:       ${avgMs}ms`)

  // Cost extrapolation
  const price = PRICING[tier]
  const costThisRun =
    (totalUsage.input_tokens / 1_000_000) * price.input +
    (totalUsage.output_tokens / 1_000_000) * price.output
  const costPerEntry = costThisRun / rows.length
  const costFor5000 = costPerEntry * 5000

  console.log('\nToken usage (both passes combined):')
  console.log(`  Input tokens:           ${totalUsage.input_tokens.toLocaleString()}`)
  console.log(`  Output tokens:          ${totalUsage.output_tokens.toLocaleString()}`)
  console.log(`  Cost this run:          $${costThisRun.toFixed(4)}`)
  console.log(`  Cost per entry:         $${costPerEntry.toFixed(5)}`)
  console.log(`  Projected for 5000:     $${costFor5000.toFixed(2)}`)

  if (warnings.length > 0) {
    console.log('\nWarnings:')
    for (const w of warnings) console.log(`  ${w}`)
  }

  const outPath = `/tmp/llm-extraction-test-${tier}-${Date.now()}.json`
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { tier, agreementCounts, totalUsage, costThisRun, costFor5000, results },
      null,
      2,
    ),
  )
  console.log(`\nFull results written to: ${outPath}`)
}

main().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})
