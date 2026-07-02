/**
 * Web-searched cover enrichment for books the GB/OL/Wikipedia ladder can't
 * cover — generalized from the 2026 HK/KDN Chinese pilot
 * (enrich-covers-gemini-pilot.ts, recoverable via git 329b635) to any
 * language/country batch.
 *
 * Pipeline per book:
 *   1. geminiCoverSearch — Gemini 2.5 flash + Google Search returns the book's
 *      page URL on a language-appropriate book site (site list per language in
 *      src/lib/enrich/gemini-cover-search.ts)
 *   2. extractCoverFromPage — og:image / twitter:image / JSON-LD from that
 *      page; plain fetch first, ONE Firecrawl retry when bot-blocked
 *      (Cloudflare 403 on wook.pt / bertrand.pt / fnac.pt / goodreads)
 *   3. mirrorImageToStorage → book-covers bucket; hotlink-blocked image hosts
 *      get one retry through the images.weserv.nl proxy
 *   4. openaiCoverSecondOpinion — vision model verifies the MIRRORED pixels
 *      match the book; wrong_book / not_a_cover → mirror deleted
 *   5. --apply writes books.cover_url ONLY for verdict looks_right
 *
 * Résumé: every processed book is appended to the run's JSONL; a re-run with
 * the same --out tag skips slugs already present (interruption-resistant).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-covers-websearch.ts --country=PT --limit=30
 *     → dry-run (mirrors + report, no cover_url writes)
 *   npx tsx --env-file=.env.local scripts/enrich-covers-websearch.ts --country=PT --limit=30 --apply
 *   npx tsx --env-file=.env.local scripts/enrich-covers-websearch.ts --slugs=o-judeu,quando-os-lobos-uivam
 *   Flags: --country=XX | --slugs=a,b | --book-id=1,2 · --limit=N (spread-sampled)
 *          --out=<tag> (report/JSONL suffix, default <country>-<date>) · --no-resume
 *
 * Output: data/cover-websearch-<tag>.md (+ .jsonl checkpoint) and
 *         data/cover-websearch-<tag>-montage.html for eyeball review.
 */

import fs from 'node:fs'
import path from 'node:path'
import { adminClient } from '../src/lib/supabase'
import { geminiCoverSearch } from '../src/lib/enrich/gemini-cover-search'
import { extractCoverFromPage } from '../src/lib/enrich/extract-cover-from-page'
import { openaiCoverSecondOpinion } from '../src/lib/enrich/openai-cover-second-opinion'
import { mirrorImageToStorage } from '../src/lib/enrich/mirror-image'
import { firecrawlFetchPage, getFirecrawlCallCount } from '../src/lib/enrich/firecrawl-fetch'
import { titlesMatch, titleTokens } from '../src/lib/enrich/title-match'
import { isApply, hasFlag, flagValue, intFlag } from './lib/cli'

const APPLY = isApply()
const COUNTRY = flagValue('country')?.toUpperCase()
const SLUGS = flagValue('slugs')?.split(',').map(s => s.trim()).filter(Boolean)
const BOOK_IDS = flagValue('book-id')?.split(',').map(s => parseInt(s.trim(), 10)).filter(Number.isFinite)
const LIMIT = intFlag('limit', 30)
const NO_RESUME = hasFlag('no-resume')
// Batch-level language fallback for books whose original_language is NULL
// (the whole Estado Novo import, pending the Sprint-A backfill). Drives the
// Gemini site-preference list only — never written to the DB.
const LANG_FALLBACK = flagValue('lang') ?? null
const OUT_TAG = flagValue('out') ?? `${(COUNTRY ?? 'custom').toLowerCase()}-${new Date().toISOString().slice(0, 10)}`

const BETWEEN_BOOKS_MS = 1500

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// Ban-history context per country helps Gemini disambiguate obscure titles
// (era, likely publishers). Extend as new batches come up.
const CONTEXT_HINTS: Record<string, string> = {
  PT: 'Banned in Portugal under the Estado Novo dictatorship (censorship lists 1933-1974). Portuguese-language title, often published in Lisbon/Porto; modern reeditions exist for many. Check Portuguese bookshop sites (wook.pt, bertrand.pt).',
  HK: 'Banned in Hong Kong (post-2020 National Security Law). Likely published in HK or Taiwan.',
  MY: 'On the Malaysia KDN Senarai Larangan banned-publications list.',
}

type Candidate = {
  id: number
  slug: string
  title: string
  title_native: string | null
  title_transliterated: string | null
  first_published_year: number | null
  original_language: string | null
  author: string | null
}

async function loadCandidates(): Promise<Candidate[]> {
  const sb = adminClient()
  const SELECT = `
    id, slug, title, title_native, title_transliterated, first_published_year, original_language,
    book_authors!left(authors!left(display_name))
  `
  type Row = {
    id: number; slug: string; title: string
    title_native: string | null; title_transliterated: string | null
    first_published_year: number | null; original_language: string | null
    book_authors: Array<{ authors: { display_name: string } | null }> | null
  }
  const toCandidate = (r: Row): Candidate => ({
    id: r.id, slug: r.slug, title: r.title,
    title_native: r.title_native, title_transliterated: r.title_transliterated,
    first_published_year: r.first_published_year, original_language: r.original_language,
    author: r.book_authors?.[0]?.authors?.display_name ?? null,
  })

  if (SLUGS?.length || BOOK_IDS?.length) {
    let q = sb.from('books').select(SELECT)
    q = SLUGS?.length ? q.in('slug', SLUGS) : q.in('id', BOOK_IDS!)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return ((data ?? []) as unknown as Row[]).map(toCandidate)
  }

  if (!COUNTRY) throw new Error('Pass --country=XX, --slugs=… or --book-id=…')

  // Distinct book ids with a ban in the country (paginated: bans can exceed
  // the 1000-row cap).
  const ids = new Set<number>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('bans').select('book_id')
      .eq('country_code', COUNTRY).order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) ids.add(r.book_id)
    if (!data || data.length < 1000) break
  }

  const pool: Candidate[] = []
  const idArr = [...ids]
  for (let i = 0; i < idArr.length; i += 200) {
    const { data, error } = await sb.from('books')
      .select(`${SELECT}, cover_status`)
      .in('id', idArr.slice(i, i + 200))
      .is('cover_url', null)
      .eq('is_blanket_works', false)
      .order('id')
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as unknown as Array<Row & { cover_status: string | null }>) {
      // manual_override means someone deliberately cleared the cover — skip.
      // rejected_placeholder is fine here: that verdict only says GB had
      // nothing real, which is exactly the population this script is for.
      if (r.cover_status === 'manual_override') continue
      pool.push(toCandidate(r))
    }
  }

  // Spread-sample so a --limit run sees the whole id range (imports are
  // id-contiguous; taking the first N would sample a single source cluster).
  if (pool.length > LIMIT) {
    const step = pool.length / LIMIT
    return Array.from({ length: LIMIT }, (_, i) => pool[Math.floor(i * step)])
  }
  return pool
}

type ResultRow = {
  slug: string
  title: string
  author: string | null
  geminiPageUrl: string | null
  geminiSite: string | null
  geminiConfidence: string
  geminiReasoning: string | null
  geminiInputTokens: number
  geminiOutputTokens: number
  extractedImageUrl: string | null
  extractedVia: string | null
  mirrorVia: string | null
  secondOpinion: string
  secondOpinionReasoning: string | null
  finalUrl: string | null
  outcome: 'ok' | 'unsure' | 'rejected' | 'no_match' | 'extract_failed' | 'mirror_failed' | 'error'
  notes: string
}

async function removeMirror(sb: ReturnType<typeof adminClient>, slug: string) {
  await sb.storage.from('book-covers').remove(['jpg', 'png', 'webp', 'gif'].map(e => `${slug}.${e}`))
}

// Hotlink-blocked image hosts (same Cloudflare wall as their pages) get one
// retry through the images.weserv.nl proxy, which fetches server-side and
// re-serves the bytes. Only used as a download path — the stored copy lives
// in our own bucket either way.
function weservUrl(imageUrl: string): string {
  return `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}`
}

type ImageCandidate = { imageUrl: string; pageUrl: string; via: string }

// Site-search fallback for when Gemini's page URL was hallucinated or its
// image CDN is unmirrorable (wook/bertrand 403 every non-browser fetch, incl.
// weserv). fnac.pt search results embed the book title in the cover image
// FILENAME ("…/tsp…/Quando-os-Lobos-Uivam.jpg"), which gives us a
// title-verified, mirrorable (fnac-static.com is open) image for one
// Firecrawl credit. Guards:
//   - only for titles with ≥2 significant tokens: a one-word title ("Homens")
//    against a title-only filename match is namesake roulette, and the
//    filename carries no author to check against
//   - titlesMatch on the de-hyphenated filename (rejects the real-world
//    parody trap "Quando os Bobos Uivam" one letter away)
//   - the vision 2nd-opinion still runs downstream like every other path
async function fnacSearchCover(title: string): Promise<ImageCandidate[]> {
  if (titleTokens(title).size < 2) return []
  const searchUrl = `https://www.fnac.pt/SearchResult/ResultList.aspx?Search=${encodeURIComponent(title)}`
  const page = await firecrawlFetchPage(searchUrl)
  if (!page.ok) return []
  const seen = new Set<string>()
  for (const m of page.html.matchAll(/https:\/\/static\.fnac-static\.com\/multimedia\/Images\/[^"'\s\\]+\.jpg/g)) {
    const url = m[0]
    if (seen.has(url)) continue
    seen.add(url)
    const file = url.split('/').pop()?.replace(/\.jpg$/, '') ?? ''
    if (!/[a-zA-Z]-[a-zA-Z]/.test(file)) continue  // size-code-only names like "1545-1" carry no title
    if (!titlesMatch(title, file.replace(/-/g, ' '))) continue
    // Search-grid images are 200×200 thumbs (format code 1545-1); format
    // 1507-1 is the same asset at full product size (~400×618). Try the
    // upsized variant first and keep the thumb as fallback for the rare
    // asset where 1507-1 404s.
    const upsized = url.replace(/\/\d{4}-\d\//, '/1507-1/')
    const out: ImageCandidate[] = []
    if (upsized !== url) out.push({ imageUrl: upsized, pageUrl: searchUrl, via: 'fnac-search-1507' })
    out.push({ imageUrl: url, pageUrl: searchUrl, via: 'fnac-search' })
    return out
  }
  return []
}

async function processBook(c: Candidate): Promise<ResultRow> {
  const row: ResultRow = {
    slug: c.slug, title: c.title, author: c.author,
    geminiPageUrl: null, geminiSite: null, geminiConfidence: 'low', geminiReasoning: null,
    geminiInputTokens: 0, geminiOutputTokens: 0,
    extractedImageUrl: null, extractedVia: null, mirrorVia: null,
    secondOpinion: '', secondOpinionReasoning: null,
    finalUrl: null, outcome: 'no_match', notes: '',
  }

  // 1. Gemini → page URL on a language-appropriate book site.
  let gemini
  try {
    gemini = await geminiCoverSearch({
      title: c.title,
      titleNative: c.title_native,
      titleTransliterated: c.title_transliterated,
      author: c.author,
      year: c.first_published_year,
      language: c.original_language ?? LANG_FALLBACK,
      contextHint: COUNTRY ? CONTEXT_HINTS[COUNTRY] ?? null : null,
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

  // 2+3. Build image candidates and mirror the first one that downloads.
  // Chain: Gemini page → og:image extraction (Firecrawl retry when blocked),
  // then the fnac site-search fallback — Gemini's URLs for obscure books are
  // often pattern-hallucinated (it even parrots the example ID from its own
  // prompt), and wook/bertrand images are unmirrorable, so the fallback does
  // real work. Each mirror attempt: direct fetch, then weserv proxy.
  const sb = adminClient()
  const notes: string[] = []
  let mirrored: { publicUrl: string } | null = null

  async function tryCandidate(cand: ImageCandidate): Promise<boolean> {
    row.extractedImageUrl = cand.imageUrl
    row.extractedVia = cand.via
    let m = await mirrorImageToStorage(sb, cand.imageUrl, c.slug, 'book-covers', cand.pageUrl)
    if (m.ok) { mirrored = { publicUrl: m.publicUrl }; row.mirrorVia = 'direct'; return true }
    if (/HTTP (403|401|429)|fetch failed/.test(m.reason)) {
      m = await mirrorImageToStorage(sb, weservUrl(cand.imageUrl), c.slug, 'book-covers')
      if (m.ok) { mirrored = { publicUrl: m.publicUrl }; row.mirrorVia = 'weserv'; return true }
    }
    notes.push(`mirror ${cand.via}: ${m.reason}`)
    return false
  }

  // Candidate providers, in order. Each candidate is mirrored and then
  // vision-verified INDIVIDUALLY: a wrong_book/not_a_cover verdict deletes
  // the mirror and moves on to the next provider — the smoke test's O Judeu
  // run showed why (Gemini's hallucinated fnac ID resolved to a Supertramp
  // CD; per-candidate verification lets the fnac-search fallback still run
  // after that rejection).
  const providers: Array<() => Promise<ImageCandidate[]>> = [
    async () => {
      if (!gemini.pageUrl) { notes.push(gemini.reasoning ?? 'gemini returned no page_url'); return [] }
      const extracted = await extractCoverFromPage(gemini.pageUrl, { firecrawlFallback: true })
      if (!extracted.ok) { notes.push(`extract: ${extracted.reason}`); return [] }
      return [{ imageUrl: extracted.imageUrl, pageUrl: extracted.resolvedPageUrl, via: extracted.via }]
    },
  ]
  if ((c.original_language ?? LANG_FALLBACK) === 'pt') {
    providers.push(async () => {
      const fnac = await fnacSearchCover(c.title)
      if (fnac.length === 0) notes.push('fnac-search: no title-matched image')
      return fnac
    })
  }

  for (const provider of providers) {
    const cands = await provider()
    mirrored = null
    // Within one provider the candidates are the same asset at different
    // sizes — first one that mirrors wins.
    let active: ImageCandidate | null = null
    for (const cand of cands) {
      if (await tryCandidate(cand)) { active = cand; break }
    }
    if (!mirrored || !active) continue

    // 4. Vision 2nd-opinion runs AGAINST THE MIRROR (OpenAI can always reach
    // our Supabase host; it often can't reach the blocked source CDNs).
    let opinion
    try {
      opinion = await openaiCoverSecondOpinion({
        imageUrl: mirrored!.publicUrl,
        title: c.title,
        titleNative: c.title_native,
        author: c.author,
        year: c.first_published_year,
      })
    } catch (e) {
      notes.push(`2nd-opinion failed: ${e instanceof Error ? e.message : String(e)}`)
      await removeMirror(sb, c.slug)
      row.outcome = 'error'
      row.notes = notes.join(' · ')
      return row
    }
    row.secondOpinion = opinion.verdict
    row.secondOpinionReasoning = opinion.reasoning

    if (opinion.verdict === 'wrong_book' || opinion.verdict === 'not_a_cover') {
      notes.push(`2nd-opinion rejected ${active.via}: ${opinion.verdict}`)
      await removeMirror(sb, c.slug)
      mirrored = null
      continue
    }

    // looks_right → ok; unsure/unreadable mirrors are kept for the montage
    // but never auto-applied. Stop either way — swapping an
    // unclear-but-plausible cover for the next provider's guess only adds
    // wrong-cover risk.
    row.finalUrl = mirrored!.publicUrl
    row.outcome = opinion.verdict === 'looks_right' ? 'ok' : 'unsure'
    break
  }

  row.notes = notes.join(' · ')
  if (!row.finalUrl) {
    if (row.secondOpinion) row.outcome = 'rejected'
    else if (row.extractedImageUrl) row.outcome = 'mirror_failed'
    else row.outcome = gemini.pageUrl ? 'extract_failed' : 'no_match'
    return row
  }

  if (APPLY && row.outcome === 'ok') {
    const { error: ue } = await sb.from('books')
      .update({ cover_url: row.finalUrl, cover_status: 'valid', cover_checked_at: new Date().toISOString() })
      .eq('id', c.id)
      .is('cover_url', null)
    if (ue) row.notes = `db write failed: ${ue.message}`
  }

  return row
}

function renderMarkdown(rows: ResultRow[]): string {
  const lines: string[] = []
  lines.push(`# Cover websearch enrichment — ${OUT_TAG}`)
  lines.push('')
  lines.push(`Run: ${new Date().toISOString()} · mode: ${APPLY ? 'APPLY (writes looks_right only)' : 'DRY-RUN'} · books: ${rows.length}`)
  lines.push('')
  const counts: Record<string, number> = {}
  for (const r of rows) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1
  lines.push('## Outcome summary')
  for (const [k, v] of Object.entries(counts).sort()) lines.push(`- **${k}**: ${v}`)
  const totalIn = rows.reduce((s, r) => s + r.geminiInputTokens, 0)
  const totalOut = rows.reduce((s, r) => s + r.geminiOutputTokens, 0)
  const estCost = (totalIn / 1_000_000) * 0.30 + (totalOut / 1_000_000) * 2.50
  lines.push(`- Gemini usage: in=${totalIn} out=${totalOut} → est. ~$${estCost.toFixed(4)}`)
  lines.push(`- Firecrawl calls this run: ${getFirecrawlCallCount()}`)
  lines.push('')
  lines.push('## Per-book details')
  lines.push('')
  for (const r of rows) {
    lines.push(`### ${r.title} — \`${r.slug}\``)
    lines.push(`- Author: ${r.author ?? '_(none)_'}`)
    lines.push(`- Outcome: **${r.outcome}**`)
    if (r.geminiPageUrl) lines.push(`- Page (${r.geminiSite ?? '?'}, conf=${r.geminiConfidence}): ${r.geminiPageUrl}`)
    if (r.geminiReasoning) lines.push(`- Gemini: ${r.geminiReasoning}`)
    if (r.extractedImageUrl) lines.push(`- Image (via ${r.extractedVia}, mirror=${r.mirrorVia ?? '—'}): ${r.extractedImageUrl}`)
    if (r.secondOpinion) lines.push(`- 2nd-opinion: **${r.secondOpinion}**${r.secondOpinionReasoning ? ` — ${r.secondOpinionReasoning}` : ''}`)
    if (r.finalUrl) lines.push(`- Mirrored: ${r.finalUrl}`)
    if (r.notes) lines.push(`- Notes: ${r.notes}`)
    lines.push('')
  }
  return lines.join('\n')
}

// Montage for eyeball review (cover doctrine: verify a sample before bulk
// apply). Plain HTML file — open directly in the browser.
function renderMontage(rows: ResultRow[]): string {
  const cards = rows
    .filter(r => r.finalUrl)
    .map(r => `
  <figure class="${r.outcome}">
    <img src="${r.finalUrl}" loading="lazy" alt="">
    <figcaption>
      <strong>${escapeHtml(r.title)}</strong><br>
      ${escapeHtml(r.author ?? '')}<br>
      <code>${r.slug}</code> · ${r.outcome} (${escapeHtml(r.secondOpinion)})<br>
      <a href="${r.geminiPageUrl ?? '#'}" target="_blank">${escapeHtml(r.geminiSite ?? 'bron')}</a>
    </figcaption>
  </figure>`).join('\n')
  return `<!doctype html><meta charset="utf-8"><title>cover websearch ${OUT_TAG}</title>
<style>
  body{font:14px system-ui;margin:20px;background:#111;color:#eee}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
  figure{margin:0;padding:8px;background:#1c1c1c;border-radius:8px;border:2px solid transparent}
  figure.ok{border-color:#2e7d32} figure.unsure{border-color:#f9a825}
  img{width:100%;height:260px;object-fit:contain;background:#000}
  figcaption{margin-top:6px;line-height:1.4} a{color:#8ab4f8}
</style>
<h1>cover websearch — ${OUT_TAG} (${rows.filter(r => r.finalUrl).length} mirrored)</h1>
<p>groen = looks_right (auto-apply kandidaat) · geel = unsure (handmatig beoordelen)</p>
<div class="grid">${cards}</div>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function main() {
  console.log(`── enrich-covers-websearch (${APPLY ? 'APPLY' : 'DRY-RUN'}) · ${OUT_TAG} ──`)
  const jsonlPath = path.join(process.cwd(), 'data', `cover-websearch-${OUT_TAG}.jsonl`)

  const done = new Set<string>()
  const prior: ResultRow[] = []
  if (!NO_RESUME && fs.existsSync(jsonlPath)) {
    for (const line of fs.readFileSync(jsonlPath, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const r = JSON.parse(line) as ResultRow
        done.add(r.slug); prior.push(r)
      } catch { /* torn write from an interrupted run — reprocess that book */ }
    }
    if (done.size) console.log(`Resume: ${done.size} boeken al verwerkt in ${path.basename(jsonlPath)}`)
  }

  const candidates = (await loadCandidates()).filter(c => !done.has(c.slug))
  console.log(`Kandidaten: ${candidates.length}${COUNTRY ? ` (country=${COUNTRY})` : ''}\n`)

  const results: ResultRow[] = [...prior]
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    process.stdout.write(`[${i + 1}/${candidates.length}] ${c.title.slice(0, 48)}… `)
    const r = await processBook(c)
    results.push(r)
    fs.appendFileSync(jsonlPath, JSON.stringify(r) + '\n')
    console.log(`→ ${r.outcome}`)
    await sleep(BETWEEN_BOOKS_MS)
  }

  const mdPath = path.join(process.cwd(), 'data', `cover-websearch-${OUT_TAG}.md`)
  fs.writeFileSync(mdPath, renderMarkdown(results), 'utf8')
  const montagePath = path.join(process.cwd(), 'data', `cover-websearch-${OUT_TAG}-montage.html`)
  fs.writeFileSync(montagePath, renderMontage(results), 'utf8')

  const counts: Record<string, number> = {}
  for (const r of results) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1
  console.log(`\nOutcomes: ${JSON.stringify(counts)}`)
  console.log(`Firecrawl calls: ${getFirecrawlCallCount()}`)
  console.log(`Rapport:  ${mdPath}`)
  console.log(`Montage:  ${montagePath}`)
  if (!APPLY) console.log('\nDRY-RUN — beoordeel de montage, daarna --apply om cover_url te schrijven (alleen looks_right).')
}

main().catch(e => { console.error(e); process.exit(1) })
