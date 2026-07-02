#!/usr/bin/env tsx
/**
 * Backfill non-Latin pending review queue items with GPT-4o-mini suggestions
 * for the Model 3 title fields. Targets rows that are stuck in review because
 * the parsed `title` is a mess of concatenated native script + transliterations
 * + subtitles (a Wikipedia / library-catalog pattern) and a human reviewer
 * can't easily judge them.
 *
 * The script does NOT auto-approve. It only enriches `agreement_details.parsed_row`
 * fields that are NULL/empty (and in --aggressive mode it also splits "pinyin-soup"
 * titles into clean native/transliterated/english fields). The Sprint A
 * non-Latin review gate remains in place — every row still needs a human
 * approval click in /admin/import-review/[id].
 *
 * The original parsed_row is preserved under agreement_details.parsed_row_pre_llm
 * for one-click rollback. The LLM call metadata (model, ts, confidence,
 * reasoning) lands in agreement_details.llm_prefill.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-pending-non-latin.ts
 *     → dry-run: prints suggestions for up to 5 items, no writes
 *   npx tsx --env-file=.env.local scripts/enrich-pending-non-latin.ts --apply
 *     → writes to all pending non-Latin queue rows
 *   npx tsx --env-file=.env.local scripts/enrich-pending-non-latin.ts --apply --limit=20
 *     → cap at 20 writes
 *   npx tsx --env-file=.env.local scripts/enrich-pending-non-latin.ts --apply --source=wikipedia-china
 *     → restrict to one source
 *   npx tsx --env-file=.env.local scripts/enrich-pending-non-latin.ts --apply --redo
 *     → re-run even on rows that already have llm_prefill
 */
import OpenAI from 'openai'
import { adminClient } from '../../src/lib/supabase'
import { detectScript } from '../../src/lib/imports/language-inference'

type ParsedRow = {
  title?: string | null
  title_native?: string | null
  title_transliterated?: string | null
  title_english_meaningful?: string | null
  original_language?: string | null
  authors?: string[]
  year?: number | null
  state?: string | null
  notes_raw?: string | null
}

type AgreementDetails = {
  parsed_row?: ParsedRow
  parsed_row_pre_llm?: ParsedRow
  llm_prefill?: LlmPrefillMeta
  [key: string]: unknown
}

type LlmPrefillMeta = {
  model: string
  prompt_version: string
  ran_at: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  changed_fields: string[]
  notes?: string
}

type QueueRow = {
  id: number
  source_slug: string
  source_url: string | null
  agreement_class: string
  agreement_details: AgreementDetails | null
}

type LlmOutput = {
  title: string | null
  title_native: string | null
  title_transliterated: string | null
  title_english_meaningful: string | null
  original_language: string | null
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  notes?: string
}

const PROMPT_VERSION = '2026-05-15.v1'
const MODEL = 'gpt-4o-mini'
const RATE_LIMIT_DELAY_MS = 200

const SYSTEM_PROMPT = `You clean up messy bibliographic records for a non-Latin script book censorship database.

A library-catalog or Wikipedia parser has dumped a tangled string into the \`title\` field. It may contain:
  - native-script title (Hanzi, Cyrillic, Arabic, etc.)
  - romanized transliteration (pinyin, romaji, ALA-LC, etc.)
  - English literal meaning
  - subtitle markers (": ", ". ", " / ")
  - sometimes TWO separate book entries concatenated with " / "

Your job: untangle into clean structured fields.

OUTPUT a single JSON object, no prose, no markdown:
{
  "title": "Primary heading. For non-Latin works prefer the most widely-known transliteration (or English title if that's the canonical form). One title only — never two works joined by /. Include subtitle if present.",
  "title_native": "Native-script form only, no transliteration mixed in. null if the work has no native-script form.",
  "title_transliterated": "Romanized form (pinyin/romaji/ALA-LC). null if the title is already Latin-script.",
  "title_english_meaningful": "Literal English meaning. null if the title is already in English or is a proper name with no translation.",
  "original_language": "ISO 639-1 two-letter code lowercase (zh, fa, ru, ja, ko, ar, hi, …). null if unsure.",
  "confidence": "high | medium | low",
  "reasoning": "One short sentence: what you split out and why.",
  "notes": "Optional: flag anomalies for the human reviewer (e.g. 'input appears to concatenate two unrelated works')."
}

Rules:
- NEVER invent titles. If a field is unclear, output null.
- "high" confidence = unambiguous Hanzi+pinyin pair, well-known book, or clear source.
- "medium" = reasonable inference from script and context.
- "low" = multiple plausible interpretations — still give your best guess, flag in notes.
- If the input clearly concatenates two unrelated works (e.g. two separate Hanzi-pinyin pairs joined by " / "), pick the FIRST one as the primary title and note this in \`notes\`.
- Do not strip subtitles. "Title: Subtitle" stays as one field.
- Authors are provided for context — do not include them in any title field.`

function buildUserPrompt(row: QueueRow, parsed: ParsedRow, script: string | null): string {
  return `Source: ${row.source_slug}
Source URL: ${row.source_url ?? '(none)'}
Detected script in raw title: ${script ?? 'unknown'}

Raw parsed fields (from upstream LLM extraction):
  title:                    ${JSON.stringify(parsed.title ?? null)}
  title_native:             ${JSON.stringify(parsed.title_native ?? null)}
  title_transliterated:     ${JSON.stringify(parsed.title_transliterated ?? null)}
  title_english_meaningful: ${JSON.stringify(parsed.title_english_meaningful ?? null)}
  original_language:        ${JSON.stringify(parsed.original_language ?? null)}
  authors:                  ${JSON.stringify(parsed.authors ?? [])}
  state/region:             ${JSON.stringify(parsed.state ?? null)}
  year:                     ${JSON.stringify(parsed.year ?? null)}

Produce the cleaned JSON.`
}

// Sources known to contain non-Latin or transliterated titles.
// Used as a fallback when the Unicode-script detector says 'latin' but the
// title is actually an ALA-LC / pinyin / Hepburn transliteration of a
// non-Latin work (e.g. wikipedia-iran rows like "chashmhāyash" are pure-Latin
// in the detector but represent Persian works).
const NON_LATIN_SOURCE_SLUGS = new Set<string>([
  'wikipedia-iran',
  'wikipedia-china',
  'wikipedia-hong-kong',
  'wikipedia-banned-by-governments',
  'wikipedia-index-librorum',
  'wikipedia-india',
])

// Latin Extended + IPA + diacritic-heavy ranges that signal transliteration.
// Pure-English ASCII text never triggers this.
function hasTransliterationDiacritics(text: string | null | undefined): boolean {
  if (!text) return false
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (cp >= 0x0100 && cp <= 0x024F) return true // Latin Extended-A/B
    if (cp >= 0x1E00 && cp <= 0x1EFF) return true // Latin Extended Additional
    if (cp >= 0x02B0 && cp <= 0x02FF) return true // Spacing modifier letters
  }
  return false
}

function needsEnrichment(parsed: ParsedRow, sourceSlug: string): boolean {
  const titleScript = detectScript(parsed.title ?? '')
  const nativeScript = detectScript(parsed.title_native ?? '')

  // Any explicit non-Latin script in title or native → enrich.
  if (titleScript && titleScript !== 'latin') return true
  if (nativeScript && nativeScript !== 'latin') return true

  // Transliteration diacritics → enrich (Persian, IAST, ALA-LC, etc.).
  if (hasTransliterationDiacritics(parsed.title)) return true
  if (hasTransliterationDiacritics(parsed.title_transliterated)) return true

  // Known non-Latin sources where the parser left model 3 fields empty:
  // still likely needs enrichment even if title is pure ASCII.
  if (NON_LATIN_SOURCE_SLUGS.has(sourceSlug)) {
    const incomplete =
      !parsed.title_native ||
      !parsed.title_english_meaningful ||
      !parsed.original_language
    if (incomplete) return true
  }

  return false
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function diffFields(before: ParsedRow, after: ParsedRow): string[] {
  const keys: Array<keyof ParsedRow> = [
    'title',
    'title_native',
    'title_transliterated',
    'title_english_meaningful',
    'original_language',
  ]
  const changed: string[] = []
  for (const k of keys) {
    const b = (before[k] ?? null) as unknown
    const a = (after[k] ?? null) as unknown
    if (b !== a) changed.push(k)
  }
  return changed
}

async function enrichOne(
  client: OpenAI,
  row: QueueRow,
  aggressive: boolean,
): Promise<{
  output: LlmOutput
  merged: ParsedRow
  changed: string[]
} | null> {
  const before: ParsedRow = (row.agreement_details?.parsed_row ?? {}) as ParsedRow
  const script = detectScript(before.title ?? before.title_native ?? '')

  const resp = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(row, before, script) },
    ],
  })

  const raw = resp.choices[0]?.message?.content
  if (!raw) return null

  let parsed: LlmOutput
  try {
    parsed = JSON.parse(raw) as LlmOutput
  } catch {
    console.error(`  [${row.id}] LLM returned non-JSON: ${raw.slice(0, 100)}`)
    return null
  }

  // In conservative mode: only fill empty/null fields, never overwrite.
  // In aggressive mode: overwrite if LLM is high/medium confidence AND the
  // existing field looks like pinyin-soup (Latin script for a non-Latin work,
  // contains " / ", or contains the same value as another field).
  const merged: ParsedRow = { ...before }
  const fields: Array<keyof LlmOutput & keyof ParsedRow> = [
    'title',
    'title_native',
    'title_transliterated',
    'title_english_meaningful',
    'original_language',
  ]
  for (const f of fields) {
    const current = (before[f] ?? null) as string | null
    const proposed = (parsed[f] ?? null) as string | null
    if (proposed === null || proposed === '') continue
    if (!current || current.trim() === '') {
      merged[f] = proposed as never
      continue
    }
    if (aggressive && parsed.confidence !== 'low') {
      // Overwrite "pinyin soup" in title: contains " / " or non-Latin chars mixed with Latin.
      if (f === 'title' && /\s\/\s/.test(current)) {
        merged[f] = proposed as never
        continue
      }
      // Overwrite transliterated if it equals the title (parser confusion).
      if (f === 'title_transliterated' && current === before.title) {
        merged[f] = proposed as never
        continue
      }
    }
  }

  const changed = diffFields(before, merged)
  return { output: parsed, merged, changed }
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  // Aggressive splitting is the default (per Sprint A decision): the script
  // overwrites pinyin-soup titles where it can split them cleanly. Pass
  // --conservative to fill only empty fields and never overwrite.
  const aggressive = !args.includes('--conservative')
  const redo = args.includes('--redo')
  const limitArg = args.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Number.POSITIVE_INFINITY
  const sourceArg = args.find(a => a.startsWith('--source='))
  const sourceSlug = sourceArg ? sourceArg.split('=')[1] : null
  const idArg = args.find(a => a.startsWith('--id='))
  const onlyId = idArg ? parseInt(idArg.split('=')[1], 10) : null

  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY in env.')
    process.exit(1)
  }

  const supabase = adminClient()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  console.log(`Mode: ${apply ? 'APPLY (writes)' : 'DRY-RUN'} | aggressive=${aggressive} | redo=${redo}`)
  console.log(`Source filter: ${sourceSlug ?? '(all non-Latin pending)'}`)
  console.log(`Limit: ${limit === Number.POSITIVE_INFINITY ? '(none)' : limit}`)
  console.log('---')

  // Fetch pending queue rows. We can't filter "non-Latin" in SQL (JSON
  // inspection + Unicode-block analysis is application-side), so we fetch
  // pending rows and filter in memory. agreement_class='non_latin_review_gate'
  // catches most but not all — some rows are 'partial' with non-Latin titles.
  let rows: QueueRow[] = []
  let offset = 0
  const PAGE = 500
  while (true) {
    let q = supabase
      .from('import_review_queue')
      .select('id, source_slug, source_url, agreement_class, agreement_details')
      .eq('status', 'pending_review')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (sourceSlug) q = q.eq('source_slug', sourceSlug) as typeof q
    const { data, error } = await q
    if (error) throw new Error(`DB read: ${error.message}`)
    if (!data?.length) break
    rows = rows.concat(data as QueueRow[])
    if (data.length < PAGE) break
    offset += PAGE
  }

  const candidates = rows.filter(r => {
    if (onlyId !== null && r.id !== onlyId) return false
    const pr = (r.agreement_details?.parsed_row ?? null) as ParsedRow | null
    if (!pr) return false
    if (onlyId === null && !needsEnrichment(pr, r.source_slug)) return false
    if (!redo && r.agreement_details?.llm_prefill) return false
    return true
  })

  console.log(`Pending rows fetched: ${rows.length}`)
  console.log(`Non-Latin candidates: ${candidates.length}`)
  console.log('---')

  const dryRunSampleArg = args.find(a => a.startsWith('--sample='))
  const dryRunSampleSize = apply
    ? 0
    : Math.min(dryRunSampleArg ? parseInt(dryRunSampleArg.split('=')[1], 10) : 5, candidates.length)
  const targetCount = apply ? Math.min(candidates.length, limit) : dryRunSampleSize

  let updated = 0
  let skipped = 0
  let errors = 0
  const confidenceTally = { high: 0, medium: 0, low: 0 }
  const changedTally: Record<string, number> = {}

  for (let i = 0; i < targetCount; i++) {
    const row = candidates[i]
    try {
      const result = await enrichOne(openai, row, aggressive)
      if (!result) {
        errors++
        continue
      }
      const { output, merged, changed } = result
      confidenceTally[output.confidence] = (confidenceTally[output.confidence] ?? 0) + 1
      for (const c of changed) changedTally[c] = (changedTally[c] ?? 0) + 1

      const before = (row.agreement_details?.parsed_row ?? {}) as ParsedRow
      console.log(`[${i + 1}/${targetCount}] queue#${row.id} (${row.source_slug}) — ${output.confidence}`)
      console.log(`  title:        ${JSON.stringify(before.title ?? null)} → ${JSON.stringify(merged.title ?? null)}`)
      if ((before.title_native ?? null) !== (merged.title_native ?? null)) {
        console.log(`  title_native: ${JSON.stringify(before.title_native ?? null)} → ${JSON.stringify(merged.title_native ?? null)}`)
      }
      if ((before.title_english_meaningful ?? null) !== (merged.title_english_meaningful ?? null)) {
        console.log(`  english:      ${JSON.stringify(before.title_english_meaningful ?? null)} → ${JSON.stringify(merged.title_english_meaningful ?? null)}`)
      }
      if ((before.title_transliterated ?? null) !== (merged.title_transliterated ?? null)) {
        console.log(`  translit:     ${JSON.stringify(before.title_transliterated ?? null)} → ${JSON.stringify(merged.title_transliterated ?? null)}`)
      }
      if ((before.original_language ?? null) !== (merged.original_language ?? null)) {
        console.log(`  lang:         ${JSON.stringify(before.original_language ?? null)} → ${JSON.stringify(merged.original_language ?? null)}`)
      }
      console.log(`  reasoning: ${output.reasoning}`)
      if (output.notes) console.log(`  notes:     ${output.notes}`)
      if (changed.length === 0) console.log(`  → no fields changed, skipping write`)

      if (apply && changed.length > 0) {
        const meta: LlmPrefillMeta = {
          model: MODEL,
          prompt_version: PROMPT_VERSION,
          ran_at: new Date().toISOString(),
          confidence: output.confidence,
          reasoning: output.reasoning,
          changed_fields: changed,
          notes: output.notes,
        }
        const newDetails: AgreementDetails = {
          ...(row.agreement_details ?? {}),
          parsed_row: merged,
          parsed_row_pre_llm: before,
          llm_prefill: meta,
        }
        const { error: ue } = await supabase
          .from('import_review_queue')
          .update({ agreement_details: newDetails })
          .eq('id', row.id)
          .eq('status', 'pending_review')
        if (ue) {
          console.error(`  ✗ DB write failed: ${ue.message}`)
          errors++
        } else {
          updated++
        }
      } else if (!apply) {
        skipped++
      }
    } catch (err) {
      console.error(`  ✗ enrichment failed for queue#${row.id}: ${err instanceof Error ? err.message : err}`)
      errors++
    }
    await sleep(RATE_LIMIT_DELAY_MS)
  }

  console.log('---')
  console.log(`Done. updated=${updated} skipped=${skipped} errors=${errors}`)
  console.log(`Confidence: high=${confidenceTally.high} medium=${confidenceTally.medium} low=${confidenceTally.low}`)
  console.log(`Fields changed: ${JSON.stringify(changedTally)}`)
  if (!apply && candidates.length > dryRunSampleSize) {
    console.log(`\nDry-run showed ${dryRunSampleSize}/${candidates.length} candidates.`)
    console.log(`Run with --apply to write all ${candidates.length}.`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
