/**
 * 50-book pilot for the Gemini-grounded cover-search pipeline.
 *
 * Selects 25 Hong Kong NSL ban-list books + 25 Malaysia KDN Chinese-language
 * books that currently have no cover_url, runs them through the full pipeline,
 * and writes results to data/cover-gemini-pilot-results.md for eyeball-review
 * BEFORE any cover_url is written to the DB.
 *
 * Pipeline per book:
 *   1. geminiCoverSearch — Gemini 2.5 flash + Google Search returns candidate URL
 *   2. verifyCoverOnPage — fetch source_page_url, check imageUrl is actually there
 *   3. openaiCoverSecondOpinion — vision model verifies the pixels match the book
 *   4. mirrorImageToStorage — download + magic-byte check + upload to book-covers bucket
 *   5. Record outcome (no DB writes in dry-run)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-covers-gemini-pilot.ts
 *     → dry-run: runs pipeline including mirror, writes results md, no books.cover_url updates
 *   npx tsx --env-file=.env.local scripts/enrich-covers-gemini-pilot.ts --apply
 *     → writes books.cover_url for entries that pass all gates
 *   npx tsx --env-file=.env.local scripts/enrich-covers-gemini-pilot.ts --limit=10
 *     → smaller smoke test
 */
import { adminClient } from '../src/lib/supabase'
import { geminiCoverSearch } from '../src/lib/enrich/gemini-cover-search'
// verifyCoverOnPage was used in v1 of the pipeline (Gemini-returned-image-URL
// path); v2 has Gemini return only the page URL and we extract the image
// ourselves via extractCoverFromPage, so page-verification is implicit.
import { extractCoverFromPage } from '../src/lib/enrich/extract-cover-from-page'
import { openaiCoverSecondOpinion } from '../src/lib/enrich/openai-cover-second-opinion'
import { mirrorImageToStorage } from '../src/lib/enrich/mirror-image'
import fs from 'node:fs'
import path from 'node:path'

const APPLY = process.argv.includes('--apply')
const LIMIT = (() => {
  const a = process.argv.find(x => x.startsWith('--limit='))
  return a ? parseInt(a.split('=')[1], 10) : null
})()
const SLUGS = (() => {
  const a = process.argv.find(x => x.startsWith('--slugs='))
  return a ? a.split('=')[1].split(',').map(s => s.trim()).filter(Boolean) : null
})()
const BETWEEN_BOOKS_MS = 1500

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

type Bucket = 'HK' | 'KDN'

type Candidate = {
  id: number
  slug: string
  title: string
  title_native: string | null
  title_transliterated: string | null
  first_published_year: number | null
  original_language: string | null
  author: string | null
  bucket: Bucket
}

const HK_SOURCE = 'Wikipedia: Book censorship in Hong Kong'
const KDN_SOURCE_PREFIX = 'Malaysia Ministry of Home Affairs (KDN)'

async function loadCandidates(): Promise<Candidate[]> {
  const sb = adminClient()

  if (SLUGS && SLUGS.length > 0) {
    const { data, error } = await sb.from('books')
      .select(`
        id, slug, title, title_native, title_transliterated, first_published_year, original_language,
        book_authors!left(authors!left(display_name))
      `)
      .in('slug', SLUGS)
    if (error) throw new Error(error.message)
    return (data ?? []).map<Candidate>((r: any) => ({
      id: r.id, slug: r.slug, title: r.title,
      title_native: r.title_native, title_transliterated: r.title_transliterated,
      first_published_year: r.first_published_year,
      original_language: r.original_language,
      author: r.book_authors?.[0]?.authors?.display_name ?? null,
      bucket: 'HK',  // bucket-label irrelevant in slug mode
    }))
  }

  const PAGE = 1000
  type Row = {
    id: number
    slug: string
    title: string
    title_native: string | null
    title_transliterated: string | null
    first_published_year: number | null
    original_language: string | null
    cover_status: string | null
    book_authors: Array<{ authors: { display_name: string } | null }> | null
    bans: Array<{ ban_source_links: Array<{ ban_sources: { source_name: string | null } | null }> | null }> | null
  }
  const all: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('books')
      .select(`
        id, slug, title, title_native, title_transliterated, first_published_year, original_language, cover_status,
        book_authors!left(authors!left(display_name)),
        bans!left(ban_source_links!left(ban_sources!left(source_name)))
      `)
      .is('cover_url', null)
      .or('cover_status.is.null,cover_status.eq.valid')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as unknown as Row[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }

  function sourceNames(r: Row): string[] {
    const out: string[] = []
    for (const b of r.bans ?? []) {
      for (const l of b.ban_source_links ?? []) {
        if (l.ban_sources?.source_name) out.push(l.ban_sources.source_name)
      }
    }
    return out
  }

  const hkPool = all.filter(r => sourceNames(r).some(n => n === HK_SOURCE))
  const kdnPool = all.filter(r =>
    sourceNames(r).some(n => n.startsWith(KDN_SOURCE_PREFIX)) && r.original_language === 'zh',
  )

  const total = LIMIT ?? 50
  const perBucket = Math.ceil(total / 2)

  function pickRandom<T>(arr: T[], n: number): T[] {
    return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
  }

  const hkPick = pickRandom(hkPool, perBucket).map<Candidate>(r => ({
    id: r.id, slug: r.slug, title: r.title,
    title_native: r.title_native, title_transliterated: r.title_transliterated,
    first_published_year: r.first_published_year,
    original_language: r.original_language,
    author: r.book_authors?.[0]?.authors?.display_name ?? null,
    bucket: 'HK',
  }))
  const kdnPick = pickRandom(kdnPool, perBucket).map<Candidate>(r => ({
    id: r.id, slug: r.slug, title: r.title,
    title_native: r.title_native, title_transliterated: r.title_transliterated,
    first_published_year: r.first_published_year,
    original_language: r.original_language,
    author: r.book_authors?.[0]?.authors?.display_name ?? null,
    bucket: 'KDN',
  }))
  return [...hkPick, ...kdnPick].slice(0, total)
}

type ResultRow = {
  bucket: Bucket
  slug: string
  title: string
  titleNative: string | null
  author: string | null
  geminiPageUrl: string | null
  geminiSite: string | null
  geminiConfidence: string
  geminiReasoning: string | null
  geminiInputTokens: number
  geminiOutputTokens: number
  extractedImageUrl: string | null
  extractedVia: string | null
  secondOpinion: string
  secondOpinionReasoning: string | null
  mirrored: string | null
  finalUrl: string | null
  outcome: 'ok' | 'rejected' | 'no_match' | 'extract_failed' | 'mirror_failed' | 'error'
  notes: string
}

// Delete a mirrored cover when downstream verification rejects it, so the
// bucket doesn't accumulate orphans. We don't know the exact ext we picked
// (mirror picked one of jpg/png/webp/gif from content-type), so try all four.
async function removeMirror(sb: ReturnType<typeof adminClient>, slug: string, contentType: string) {
  const ext = contentType.split('/')[1] ?? 'jpg'
  const exts = [ext, 'jpg', 'png', 'webp', 'gif']
  const paths = [...new Set(exts)].map(e => `${slug}.${e}`)
  await sb.storage.from('book-covers').remove(paths)
}

function contextHintFor(bucket: Bucket): string {
  if (bucket === 'HK') return 'Banned in Hong Kong (post-2020 National Security Law). Likely published in HK or Taiwan; check Bookzone, Joint Publishing, Books.com.tw, Douban.'
  return 'On the Malaysia KDN Senarai Larangan banned-publications list. Often older Chinese-language political/religious titles published in mainland China, 1950s-2000s. Check Douban Books, National Library of China.'
}

async function processBook(c: Candidate): Promise<ResultRow> {
  const row: ResultRow = {
    bucket: c.bucket, slug: c.slug, title: c.title, titleNative: c.title_native, author: c.author,
    geminiPageUrl: null, geminiSite: null, geminiConfidence: 'low', geminiReasoning: null,
    geminiInputTokens: 0, geminiOutputTokens: 0,
    extractedImageUrl: null, extractedVia: null,
    secondOpinion: '', secondOpinionReasoning: null,
    mirrored: null, finalUrl: null, outcome: 'no_match', notes: '',
  }

  // Step 1: Gemini → page URL on a known Chinese book site.
  let gemini
  try {
    gemini = await geminiCoverSearch({
      title: c.title,
      titleNative: c.title_native,
      titleTransliterated: c.title_transliterated,
      author: c.author,
      year: c.first_published_year,
      language: c.original_language,
      contextHint: contextHintFor(c.bucket),
    })
  } catch (e) {
    row.outcome = 'error'
    row.notes = `gemini call failed: ${e instanceof Error ? e.message : String(e)}`
    return row
  }
  row.geminiPageUrl = gemini.pageUrl
  row.geminiSite = gemini.site
  row.geminiConfidence = gemini.confidence
  row.geminiReasoning = gemini.reasoning
  row.geminiInputTokens = gemini.inputTokens
  row.geminiOutputTokens = gemini.outputTokens

  if (!gemini.pageUrl) {
    row.outcome = 'no_match'
    row.notes = gemini.reasoning ?? 'gemini returned no page_url'
    return row
  }

  // Step 2: Fetch the page and extract a real cover URL (og:image / pattern /
  // json-ld). This is the part Gemini was bad at — by doing it ourselves we
  // eliminate URL-pattern hallucination and unreliable snippet inference.
  const extracted = await extractCoverFromPage(gemini.pageUrl)
  if (!extracted.ok) {
    row.outcome = 'extract_failed'
    row.notes = `extract failed: ${extracted.reason}`
    return row
  }
  row.extractedImageUrl = extracted.imageUrl
  row.extractedVia = extracted.via

  // Step 3: Mirror, using the resolved page URL as Referer (some CDNs care).
  const sb = adminClient()
  const mirror = await mirrorImageToStorage(sb, extracted.imageUrl, c.slug, 'book-covers', extracted.resolvedPageUrl)
  if (!mirror.ok) {
    row.outcome = 'mirror_failed'
    row.notes = `mirror failed: ${mirror.reason}`
    return row
  }
  row.mirrored = `${mirror.bytes}B ${mirror.contentType}`

  // Vision 2nd-opinion runs AGAINST THE MIRROR. OpenAI's vision endpoint can
  // reliably fetch our Supabase host, so we don't get false negatives from
  // OpenAI being unable to reach Douban/Readmoo CDNs directly.
  let secondOpinion
  try {
    secondOpinion = await openaiCoverSecondOpinion({
      imageUrl: mirror.publicUrl,
      title: c.title,
      titleNative: c.title_native,
      author: c.author,
      year: c.first_published_year,
    })
  } catch (e) {
    row.secondOpinion = `error: ${e instanceof Error ? e.message : String(e)}`
    row.outcome = 'error'
    row.notes = row.secondOpinion
    await removeMirror(sb, c.slug, mirror.contentType)
    return row
  }
  row.secondOpinion = secondOpinion.verdict
  row.secondOpinionReasoning = secondOpinion.reasoning

  if (secondOpinion.verdict === 'wrong_book' || secondOpinion.verdict === 'not_a_cover') {
    row.outcome = 'rejected'
    row.notes = `2nd-opinion: ${secondOpinion.verdict} — ${secondOpinion.reasoning}`
    await removeMirror(sb, c.slug, mirror.contentType)
    return row
  }

  row.finalUrl = mirror.publicUrl
  row.outcome = 'ok'

  if (APPLY) {
    const { error: ue } = await sb.from('books')
      .update({
        cover_url: mirror.publicUrl,
        cover_status: 'valid',
        cover_checked_at: new Date().toISOString(),
      })
      .eq('id', c.id)
      .is('cover_url', null)
    if (ue) row.notes = `db write failed: ${ue.message}`
  }

  return row
}

function renderResultsMarkdown(rows: ResultRow[]): string {
  const lines: string[] = []
  lines.push(`# Cover-enrichment Gemini pilot — results`)
  lines.push('')
  lines.push(`Run: ${new Date().toISOString()} · mode: ${APPLY ? 'APPLY' : 'DRY-RUN'} · books: ${rows.length}`)
  lines.push('')
  const counts: Record<string, number> = {}
  for (const r of rows) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1
  lines.push(`## Outcome summary`)
  for (const [k, v] of Object.entries(counts)) lines.push(`- **${k}**: ${v}`)
  lines.push('')
  lines.push(`## Per-book details`)
  lines.push('')
  // Token + cost rollup
  const totalIn = rows.reduce((s, r) => s + r.geminiInputTokens, 0)
  const totalOut = rows.reduce((s, r) => s + r.geminiOutputTokens, 0)
  // gemini-2.5-flash pricing as of 2026-05: $0.30/1M input, $2.50/1M output.
  const estCost = (totalIn / 1_000_000) * 0.30 + (totalOut / 1_000_000) * 2.50
  lines.push('')
  lines.push(`Gemini usage: in=${totalIn} out=${totalOut} → est. cost ~$${estCost.toFixed(4)}`)
  lines.push('')

  for (const r of rows) {
    lines.push(`### [${r.bucket}] ${r.title} — \`${r.slug}\``)
    if (r.titleNative && r.titleNative !== r.title) lines.push(`- Native title: ${r.titleNative}`)
    lines.push(`- Author: ${r.author ?? '_(none)_'}`)
    lines.push(`- Outcome: **${r.outcome}**`)
    if (r.geminiPageUrl) lines.push(`- Gemini page URL: ${r.geminiPageUrl}`)
    if (r.geminiSite) lines.push(`- Gemini site: ${r.geminiSite}`)
    if (r.geminiReasoning) lines.push(`- Gemini reasoning: ${r.geminiReasoning}`)
    lines.push(`- Confidence: ${r.geminiConfidence}`)
    if (r.extractedImageUrl) lines.push(`- Extracted image (via ${r.extractedVia}): ${r.extractedImageUrl}`)
    if (r.secondOpinion) lines.push(`- 2nd-opinion verdict: ${r.secondOpinion}${r.secondOpinionReasoning ? ` — ${r.secondOpinionReasoning}` : ''}`)
    if (r.mirrored) lines.push(`- Mirrored: ${r.mirrored}`)
    if (r.finalUrl) lines.push(`- Final URL: ${r.finalUrl}`)
    if (r.notes) lines.push(`- Notes: ${r.notes}`)
    if (r.finalUrl) lines.push(`- Preview: ![cover](${r.finalUrl})`)
    lines.push('')
  }
  return lines.join('\n')
}

async function main() {
  console.log(`── enrich-covers-gemini-pilot (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  const candidates = await loadCandidates()
  console.log(`Selected ${candidates.length} candidates (HK + KDN)`)
  console.log('')

  const results: ResultRow[] = []
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    process.stdout.write(`[${i + 1}/${candidates.length}] [${c.bucket}] ${c.title.slice(0, 48)}… `)
    const r = await processBook(c)
    results.push(r)
    console.log(`→ ${r.outcome}${r.geminiUrl ? '' : ' (no gemini url)'}`)
    await sleep(BETWEEN_BOOKS_MS)
  }

  const md = renderResultsMarkdown(results)
  const outPath = path.join(process.cwd(), 'data', 'cover-gemini-pilot-results.md')
  fs.writeFileSync(outPath, md, 'utf8')
  console.log(`\nResults written: ${outPath}`)
  const counts: Record<string, number> = {}
  for (const r of results) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1
  console.log('Outcomes:', JSON.stringify(counts))
  if (!APPLY) console.log('\nDRY-RUN — review the md file, then re-run with --apply to write cover_url.')
}

main().catch(e => { console.error(e); process.exit(1) })
