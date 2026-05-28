// ⚠️ DEPRECATED — prefer src/lib/enrich/descriptions-v2.ts for all new work.
//
// v1 kept around because /api/admin/enrich/run still imports it. Do not
// extend this file. v2 has:
//   - Wikipedia EN + langlinks as primary source (v1 only OL + GB)
//   - title-fuzz + author-surname cross-check on every accepted source
//     (v1 had none — produced wrong-book hallucinations)
//   - LLM "grounded synthesis from ≥2 cited sources", never free-form
//     generation (v1's GPT fallback caused the 2026-05-28 incident)
//   - description_source_url / description_source_type recorded per row
//   - Multi-source cross-confirmation → data_quality_status='confident'
//
// 2026-05-28 safety patch retroactively applied to v1:
//   - Skip rows where data_quality_status='flagged' (so the judge run's
//     wipes don't get re-hallucinated)
//   - GPT fallback is opt-in only (--allow-gpt-fallback)
//
// Core book-description enrichment logic, callable from either the CLI script
// (scripts/enrich-descriptions.ts) or the in-process API route
// (/api/admin/enrich/run). Two passes:
//
//   Part A — Fix truncated descriptions (ends without sentence-final punctuation)
//             Source: OL works API → OL search → Google Books
//
//   Part B — Fill completely missing descriptions (description_book IS NULL)
//             Source: OL search → Google Books → [opt-in] GPT-4o-mini fallback
//
// The GPT fallback only fires when OPENAI_API_KEY is set AND opts.allowGptFallback
// is true (or OPENAI_ALLOW_FALLBACK=true in env). Default = OL/GB only.

import OpenAI from 'openai'
import { franc } from 'franc-min'
import { adminClient } from '../supabase'
import { titleLadder } from './_title-ladder'

const OL_DELAY_MS = 600
const SENTENCE_FINAL = new Set(['.', '?', '!', '"', '’', '”'])

function isTruncated(desc: string): boolean {
  return !SENTENCE_FINAL.has(desc.trimEnd().slice(-1))
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function stripMarkdown(text: string): string {
  // [\s\S]+? in place of the dotAll s-flag (.+? with /s) because tsconfig
  // target=ES2017 doesn't support the s flag; same matching behavior.
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/\*([\s\S]+?)\*/g, '$1')
    .replace(/__([\s\S]+?)__/g, '$1')
    .replace(/_([\s\S]+?)_/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\r\n/g, '\n')
    .trim()
}

function stripLeadingEndorsements(text: string): string {
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line === '') { i++; continue }
    if (/^["'"']/.test(line) || /^[–—\-]/.test(line) || /["'"']\s*[–—\-]/.test(line)) {
      i++; continue
    }
    break
  }
  return lines.slice(i).join('\n').trim()
}

function clean(raw: string): string {
  return stripMarkdown(stripLeadingEndorsements(raw))
}

function isEnglish(text: string): boolean {
  if (text.length < 20) return true
  const lang = franc(text)
  return lang === 'eng' || lang === 'und'
}

function extractOlDescription(json: Record<string, unknown>): string | null {
  const raw = json.description
  if (!raw) return null
  if (typeof raw === 'string') return raw.trim() || null
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    const v = (raw as { value: unknown }).value
    return typeof v === 'string' ? v.trim() || null : null
  }
  return null
}

async function fetchOlWorks(workId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org/works/${workId}.json`, {
      headers: { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' },
    })
    if (!res.ok) return null
    return extractOlDescription(await res.json() as Record<string, unknown>)
  } catch { return null }
}

async function searchOl(title: string, author: string): Promise<{ workId: string | null; desc: string | null }> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${q}&fields=key,cover_i&limit=1`,
      { headers: { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' } }
    )
    if (!res.ok) return { workId: null, desc: null }
    const json = await res.json() as { docs: Array<{ key?: string }> }
    const workId = json.docs?.[0]?.key?.replace('/works/', '') ?? null
    if (!workId) return { workId: null, desc: null }
    await sleep(OL_DELAY_MS)
    const desc = await fetchOlWorks(workId)
    return { workId, desc }
  } catch { return { workId: null, desc: null } }
}

async function fetchGoogleBooks(title: string, author: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`intitle:${title}${author ? ` inauthor:${author}` : ''}`)
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`)
    if (!res.ok) return null
    const json = await res.json() as { items?: Array<{ volumeInfo: { description?: string } }> }
    const desc = json.items?.[0]?.volumeInfo?.description
    return (desc && desc.length >= 80) ? desc : null
  } catch { return null }
}

async function generateWithGPT(
  client: OpenAI,
  title: string,
  author: string,
): Promise<string | null> {
  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Write a 2–3 sentence description of the book "${title}"${author ? ` by ${author}` : ''}. Summarise the plot, themes, and why it's significant. Output only the description text, nothing else.`,
      }],
    })
    return res.choices[0]?.message?.content?.trim() ?? null
  } catch { return null }
}

type BookRow = {
  id: number
  slug: string
  title: string
  title_native: string | null
  title_transliterated: string | null
  title_english_meaningful: string | null
  original_language: string | null
  description: string | null
  description_book: string | null
  openlibrary_work_id: string | null
  data_quality_status: 'confident' | 'default' | 'flagged' | null
  book_authors: Array<{ authors: { display_name: string } | null }>
}

export type EnrichDescriptionsOpts = {
  apply: boolean
  limit?: number
  overwrite?: boolean
  slug?: string
  /**
   * Opt-in switch for the LLM (gpt-4o-mini) fallback when OpenLibrary and
   * Google Books both return no description. Default false because
   * un-grounded LLM text is what the 2026-05-28 judge run cleaned up.
   * Also enabled by `OPENAI_ALLOW_FALLBACK=true` in env.
   */
  allowGptFallback?: boolean
  onProgress?: (msg: string) => void
}

export type EnrichDescriptionsResult = {
  truncatedCandidates: number
  missingCandidates: number
  processedTruncated: number
  processedMissing: number
  partA: { updated: number; skipped: number }
  partB: { ol: number; gb: number; gpt: number; skipped: number }
  errors: number
  samples: Array<{ title: string; source: string; chars: number }>
}

export async function enrichDescriptions(opts: EnrichDescriptionsOpts): Promise<EnrichDescriptionsResult> {
  const log = opts.onProgress ?? (() => {})
  const supabase = adminClient()
  // GPT fallback is now OPT-IN to prevent re-introducing hallucinations.
  // After the 2026-05-28 judge run wiped CONTRADICTED descriptions, an
  // un-gated GPT fallback would have re-filled those NULL fields with
  // fresh LLM output — defeating the entire cleanup. Two opt-in switches:
  //   - opts.allowGptFallback (programmatic)
  //   - process.env.OPENAI_ALLOW_FALLBACK === 'true' (CLI/env)
  const gptAllowed =
    Boolean(opts.allowGptFallback)
    || process.env.OPENAI_ALLOW_FALLBACK === 'true'
  const hasGptKey = Boolean(process.env.OPENAI_API_KEY)
  const openai = gptAllowed && hasGptKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

  const overwriteMode = Boolean(opts.overwrite || opts.slug)

  let all: BookRow[] = []
  let offset = 0
  while (true) {
    let query = supabase
      .from('books')
      .select('id, slug, title, title_native, title_transliterated, title_english_meaningful, original_language, description, description_book, openlibrary_work_id, data_quality_status, book_authors(authors(display_name))')
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (opts.slug) {
      query = query.eq('slug', opts.slug) as typeof query
    } else if (!opts.overwrite) {
      query = query.is('description_book', null) as typeof query
    }
    const { data, error } = await query
    if (error) throw new Error(`DB read: ${error.message}`)
    if (!data?.length) break
    all = all.concat(data as unknown as BookRow[])
    if (data.length < 1000) break
    offset += 1000
  }
  all.sort((a, b) => a.title.localeCompare(b.title))

  // Skip rows that the AI-description judge has flagged (2026-05-28).
  // 'flagged' on a NULL description_book means: judge wiped it because the
  // source contradicted the AI text. Don't refill it without a verified
  // source. The --slug and --overwrite paths bypass this — those are
  // explicit single-book operations the operator has confirmed.
  let flaggedSkipped = 0
  if (!opts.slug && !opts.overwrite) {
    const before = all.length
    all = all.filter(b => b.data_quality_status !== 'flagged')
    flaggedSkipped = before - all.length
  }

  // In overwrite/slug mode, skip Part A (which only makes sense when description_book
  // is still NULL and we're salvaging a truncated legacy `description`) and route
  // every fetched row through Part B as a re-fill.
  const truncated = overwriteMode
    ? []
    : all.filter(b => b.description && isTruncated(b.description) && !b.description_book)
  const missing   = overwriteMode
    ? all
    : all.filter(b => !b.description_book && !b.description)

  log(`Part A — truncated descriptions to repair: ${truncated.length}`)
  log(`Part B — missing descriptions to fill:     ${missing.length}`)
  if (flaggedSkipped > 0) log(`Skipped (data_quality_status='flagged'):    ${flaggedSkipped}`)
  log(`GPT fallback: ${gptAllowed && hasGptKey ? 'enabled (opt-in)' : (gptAllowed ? 'disabled (no OPENAI_API_KEY)' : 'DISABLED — set OPENAI_ALLOW_FALLBACK=true or opts.allowGptFallback to enable')}`)

  const samples: EnrichDescriptionsResult['samples'] = []
  let errCount = 0

  // Part A — repair truncated
  const limitA = opts.apply
    ? Math.min(truncated.length, opts.limit ?? Number.POSITIVE_INFINITY)
    : Math.min(3, truncated.length)
  let updatedA = 0, skippedA = 0
  for (let i = 0; i < limitA; i++) {
    const book = truncated[i]
    const author = book.book_authors?.[0]?.authors?.display_name ?? ''
    const ladder = titleLadder(book)
    let proposed: string | null = null

    if (book.openlibrary_work_id) {
      const raw = await fetchOlWorks(book.openlibrary_work_id)
      await sleep(OL_DELAY_MS)
      if (raw) { const c = clean(raw); if (isEnglish(c) && c.length >= 80) proposed = c }
    }
    // Walk the title ladder; for each variant try OL then GB. First match wins.
    for (const variant of ladder) {
      if (proposed) break
      const { desc } = await searchOl(variant.title, author)
      await sleep(OL_DELAY_MS)
      if (desc) { const c = clean(desc); if (isEnglish(c) && c.length >= 80) { proposed = c; break } }
      const gb = await fetchGoogleBooks(variant.title, author)
      await sleep(OL_DELAY_MS)
      if (gb) { const c = clean(gb); if (isEnglish(c) && c.length >= 80) { proposed = c; break } }
    }
    if (!proposed) { log(`  [A ${i + 1}/${limitA}] ${book.title.slice(0, 50)} — no source`); skippedA++; continue }

    log(`  [A ${i + 1}/${limitA}] ${book.title.slice(0, 50)} → ${proposed.length} chars`)
    if (samples.length < 10) samples.push({ title: book.title, source: 'A-repair', chars: proposed.length })
    if (opts.apply) {
      // Part A only runs in default mode (overwriteMode === false), so the
      // NULL guard always applies here.
      const { error: ue } = await supabase.from('books')
        .update({ description_book: proposed, ai_drafted: false })
        .eq('id', book.id)
        .is('description_book', null)
      if (ue) { log(`    ✗ DB write failed: ${ue.message}`); skippedA++; errCount++ }
      else updatedA++
    }
  }

  // Part B — fill missing
  const remainingBudget = opts.apply
    ? Math.max(0, (opts.limit ?? Number.POSITIVE_INFINITY) - limitA)
    : 3
  const limitB = opts.apply
    ? Math.min(missing.length, remainingBudget)
    : Math.min(3, missing.length)
  let updatedB_ol = 0, updatedB_gb = 0, updatedB_gpt = 0, skippedB = 0
  for (let i = 0; i < limitB; i++) {
    const book = missing[i]
    const author = book.book_authors?.[0]?.authors?.display_name ?? ''
    const ladder = titleLadder(book)
    let proposed: string | null = null
    let source = ''

    // Walk the title ladder. The `source` label gets a variant tag for
    // telemetry (e.g. 'OL:english_meaningful') when the winning variant
    // is not the canonical title.
    for (const variant of ladder) {
      if (proposed) break
      const tag = variant.source === 'canonical' ? '' : `:${variant.source}`
      const { desc: olDesc } = await searchOl(variant.title, author)
      await sleep(OL_DELAY_MS)
      if (olDesc) {
        const c = clean(olDesc)
        if (isEnglish(c) && c.length >= 80) { proposed = c; source = `OL${tag}`; break }
      }
      const gb = await fetchGoogleBooks(variant.title, author)
      await sleep(OL_DELAY_MS)
      if (gb) {
        const c = clean(gb)
        if (isEnglish(c) && c.length >= 80) { proposed = c; source = `GB${tag}`; break }
      }
    }
    if (!proposed && openai) {
      // GPT uses canonical title only — generation, not retrieval.
      proposed = await generateWithGPT(openai, book.title, author)
      if (proposed) source = 'GPT'
    }

    if (!proposed) { log(`  [B ${i + 1}/${limitB}] ${book.title.slice(0, 50)} — no source`); skippedB++; continue }

    log(`  [B ${i + 1}/${limitB}] ${book.title.slice(0, 50)} → ${source} (${proposed.length} chars)`)
    if (samples.length < 10) samples.push({ title: book.title, source, chars: proposed.length })
    if (opts.apply) {
      const aiDrafted = source === 'GPT'
      let upd = supabase.from('books')
        .update({ description_book: proposed, ai_drafted: aiDrafted })
        .eq('id', book.id)
      if (!overwriteMode) upd = upd.is('description_book', null) as typeof upd
      const { error: ue } = await upd
      if (ue) { log(`    ✗ DB write failed: ${ue.message}`); skippedB++; errCount++ }
      else if (source.startsWith('OL')) updatedB_ol++
      else if (source.startsWith('GB')) updatedB_gb++
      else updatedB_gpt++
    }
  }

  return {
    truncatedCandidates: truncated.length,
    missingCandidates: missing.length,
    processedTruncated: limitA,
    processedMissing: limitB,
    partA: { updated: updatedA, skipped: skippedA },
    partB: { ol: updatedB_ol, gb: updatedB_gb, gpt: updatedB_gpt, skipped: skippedB },
    errors: errCount,
    samples,
  }
}
