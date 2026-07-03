/**
 * Web-sourced description enrichment — for books the Wikipedia/OL/GB ladder
 * (enrich-descriptions-v2) came up empty on. Two blurb-discovery modes:
 *
 *   --mode=altisbn    Books with a probe-validated Bookshop link
 *                     (bookshop_status='valid') and no description_book.
 *                     The probe's bookshop_isbn13 is an alternate-edition ISBN
 *                     that v2 never tried: query Google Books BY ISBN (v2 only
 *                     searched title/author) and OpenLibrary BY ISBN for both
 *                     the alternate and primary ISBN. No scraping involved.
 *                     Guard rejects double as a wrong-bookshop-link detector
 *                     (found live: to-live-yu-hua's bookshop_isbn13 resolves
 *                     to Leo Buscaglia's "Living, Loving and Learning").
 *   --mode=isbn       Same GB/OL-by-ISBN arm for ISBN-bearing books OUTSIDE
 *                     the altisbn pool (bookshop_status != 'valid'). The GB
 *                     by-ISBN lookup is new coverage for these too; the OL
 *                     retry is mostly redundant with v2 but harmless.
 *                     NB GB quota: ~1000 queries/day per key — schedule this
 *                     pool (~1.4k rows) on a fresh quota day.
 *   --mode=search     ISBN-bearing books with no description_book. Gemini
 *                     2.5 flash + Google Search finds the book's page on a
 *                     language-appropriate site (reuses geminiCoverSearch —
 *                     same page-URL deliverable, we harvest the synopsis
 *                     instead of og:image), then extractDescriptionFromPage.
 *                     NB: bookshop.org and goodreads 403 all non-browser
 *                     fetches and the Firecrawl fallback needs credits — the
 *                     language-specific site lists (douban, thalia, labirint,
 *                     babelio, …) are the ones that fetch clean.
 *
 * Every accepted blurb — regardless of mode — goes through a gpt-4o-mini
 * judge+groom (temp 0): same-book verdict + a 2-4 sentence English
 * description synthesised ONLY from the supplied text. Retail blurbs are
 * marketing copy, so they are NEVER stored literally.
 *
 * Hard guards BEFORE the LLM sees any text:
 *   - titlesMatch(our title, page/volume name) when a name is available
 *   - authorsAgree when the source exposes author names
 *   - search mode requires the author surname somewhere on the page when
 *     structured authors are absent
 *
 * --apply writes description_book with
 * description_source_type='llm_grounded_single' (existing UI label "cited
 * source, AI-summarised"), description_source_url = the canonical source
 * page (never our affiliate path), data_quality_status='default',
 * ai_drafted=true.
 *
 * Résumé: every processed book is appended to the run's JSONL; a re-run with
 * the same --out tag skips slugs already present (interruption-resistant).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-websearch.ts --mode=altisbn --limit=40
 *     → dry-run (report only, no DB writes)
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-websearch.ts --mode=search --limit=25
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions-websearch.ts --mode=altisbn --apply
 *   Flags: --mode=altisbn|isbn|search · --limit=N · --slugs=a,b · --lang=xx · --apply
 *          --out=<tag> (report/JSONL suffix, default <mode>-<date>) · --no-resume
 *
 * Output: data/desc-websearch-<tag>.md (+ .jsonl checkpoint) for review.
 */

import fs from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'
import { geminiCoverSearch } from '../src/lib/enrich/gemini-cover-search'
import { extractDescriptionFromPage } from '../src/lib/enrich/extract-description-from-page'
import { getFirecrawlCallCount } from '../src/lib/enrich/firecrawl-fetch'
import { titlesMatch, authorsAgree } from '../src/lib/enrich/title-match'
import { gbVolumesByIsbn, GB_FIELDS_DESCRIPTION, gbQuotaTripped } from '../src/lib/enrich/google-books'
import { isApply, hasFlag, flagValue, intFlag } from './lib/cli'

const APPLY = isApply()
const MODE = flagValue('mode')
const SLUGS = flagValue('slugs')?.split(',').map(s => s.trim()).filter(Boolean)
const LANG = flagValue('lang')
const LIMIT = intFlag('limit', 25)
const NO_RESUME = hasFlag('no-resume')
const OUT_TAG = flagValue('out') ?? `${MODE}-${new Date().toISOString().slice(0, 10)}`

if (MODE !== 'altisbn' && MODE !== 'isbn' && MODE !== 'search') {
  console.error('Pass --mode=altisbn, --mode=isbn or --mode=search')
  process.exit(1)
}

const BETWEEN_BOOKS_MS = 1000
const MIN_BLURB_CHARS = 80
const MAX_GROOM_INPUT = 4000
const UA = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const FETCH_TIMEOUT_MS = 30_000
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type Candidate = {
  id: number
  slug: string
  title: string
  first_published_year: number | null
  original_language: string | null
  isbn13: string | null
  bookshop_isbn13: string | null
  book_authors: Array<{ authors: { display_name: string } | null }>
}

// One discovered blurb, whatever the mode. `sourceName`/`sourceAuthors` are
// the discovering source's own idea of title/authors — used by the guards.
type Blurb = {
  text: string
  sourceUrl: string
  via: string            // 'gb_isbn' | 'ol_isbn' | 'jsonld' | 'og' | 'meta'
  sourceName: string | null
  sourceAuthors: string[]
}

type RunRow = {
  slug: string
  id: number
  title: string
  author: string
  mode: string
  via: string | null
  sourceUrl: string | null
  sourceName: string | null
  geminiConfidence: string | null
  outcome: 'filled' | 'no_source' | 'guard_reject' | 'judge_reject' | 'error'
  detail: string
  description: string | null
}

function authorOf(b: Candidate): string {
  return b.book_authors?.[0]?.authors?.display_name ?? ''
}
function allAuthorsOf(b: Candidate): string[] {
  return (b.book_authors ?? []).map(a => a.authors?.display_name).filter((x): x is string => !!x)
}
// Our titles often carry a subtitle or series suffix the retail edition lacks
// ("Out!: How to Be Your Authentic Self" vs "Out!"). Match on the full title
// first, then on the head before ':'/'(' — the judge remains the final
// same-work arbiter for head-only matches.
function titleHeadOf(t: string): string {
  return t.replace(/\s*\([^)]*\)\s*$/g, '').split(/[:;]/)[0].trim()
}
function titlesMatchLoose(ourTitle: string, candidateTitle: string): boolean {
  if (titlesMatch(ourTitle, candidateTitle)) return true
  const head = titleHeadOf(ourTitle)
  return head.length >= 4 && head !== ourTitle && titlesMatch(head, candidateTitle)
}
function lastNameOf(author: string): string {
  const parts = author.trim().split(/\s+/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : ''
}
function normalise(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// ── LLM judge + groom ──────────────────────────────────────────────────

const JUDGE_SYSTEM = `You verify and summarise book blurbs sourced from retailer/catalogue pages and book APIs.

You get: a book (title, author, year) from our database, and TEXT from an external source (the source's own title for the item, plus its synopsis/blurb).

Step 1 — same_book: is the text about this exact book (any edition/translation of the same work is fine; a study guide, summary-of, sequel, film tie-in companion, or a different work by a namesake is NOT)?
Step 2 — only if same_book: write a 2-4 sentence English description (100-500 characters) of the book using ONLY facts present in the supplied text. Translate if the text is not English. Strip marketing superlatives ("bestselling", "must-read"), review quotes, award-bragging and calls to action — keep what the book is about. Never add facts from your own knowledge. If the text contains no actual information about the book's content, return description=null.

Return ONLY a JSON object, no prose:
{"same_book": true|false, "reason": "one short sentence", "description": "..." | null}`

const JUDGE_COST = { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 } // gpt-4o-mini

async function judgeAndGroom(
  openai: OpenAI,
  book: Candidate,
  author: string,
  blurb: Blurb,
): Promise<{ sameBook: boolean; reason: string; description: string | null; cost: number }> {
  const userMsg = `OUR BOOK:
Title: ${book.title}
Author: ${author || '(unknown)'}
Year: ${book.first_published_year ?? '(unknown)'}

SOURCE'S TITLE FOR THE ITEM: ${blurb.sourceName ?? '(none)'}
SOURCE'S AUTHORS: ${blurb.sourceAuthors.join('; ') || '(none)'}

SOURCE TEXT:
${blurb.text.slice(0, MAX_GROOM_INPUT)}`
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 300,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: JUDGE_SYSTEM },
      { role: 'user', content: userMsg },
    ],
  })
  const cost = (res.usage?.prompt_tokens ?? 0) * JUDGE_COST.input + (res.usage?.completion_tokens ?? 0) * JUDGE_COST.output
  let parsed: { same_book?: unknown; reason?: unknown; description?: unknown } = {}
  try { parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') } catch { /* judge_reject below */ }
  const sameBook = parsed.same_book === true
  const reason = typeof parsed.reason === 'string' ? parsed.reason : 'unparseable judge output'
  let description = typeof parsed.description === 'string' ? parsed.description.trim() : null
  if (description && (description.length < 80 || description.length > 900)) description = null
  return { sameBook, reason, description, cost }
}

// ── altisbn mode: GB/OL structured lookups by ISBN ─────────────────────

// Minimal OL ISBN→edition→work description resolver (same shape as
// descriptions-v2's olByIsbn, plus the edition/work title so guards can run —
// needed here because the alternate ISBN's provenance is weaker than a
// books.isbn13 binding).
async function olBlurbByIsbn(isbn: string): Promise<Blurb | null> {
  const extractDesc = (o: Record<string, unknown>): string | null => {
    const raw = o.description
    if (typeof raw === 'string') return raw.trim() || null
    if (raw && typeof raw === 'object' && 'value' in raw) {
      const v = (raw as { value: unknown }).value
      return typeof v === 'string' ? v.trim() || null : null
    }
    return null
  }
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return null
    const edition = await res.json() as Record<string, unknown>
    const edTitle = typeof edition.title === 'string' ? edition.title : null
    let text: string | null = null
    let url = `https://openlibrary.org/isbn/${isbn}`
    let name = edTitle
    const workKey = (edition.works as Array<{ key?: string }> | undefined)?.[0]?.key
    if (workKey) {
      await sleep(600)
      const wr = await fetch(`https://openlibrary.org${workKey}.json`, { headers: UA, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (wr.ok) {
        const work = await wr.json() as Record<string, unknown>
        const wDesc = extractDesc(work)
        if (wDesc && wDesc.length >= MIN_BLURB_CHARS) {
          text = wDesc
          url = `https://openlibrary.org${workKey}`
          if (typeof work.title === 'string') name = work.title
        }
      }
    }
    if (!text) {
      const eDesc = extractDesc(edition)
      if (eDesc && eDesc.length >= MIN_BLURB_CHARS) text = eDesc
    }
    if (!text) return null
    return { text, sourceUrl: url, via: 'ol_isbn', sourceName: name, sourceAuthors: [] }
  } catch { return null }
}

async function discoverAltIsbn(book: Candidate): Promise<{ blurb: Blurb | null; detail: string }> {
  const isbns = [...new Set([book.bookshop_isbn13, book.isbn13].filter((x): x is string => !!x))]
  if (isbns.length === 0) return { blurb: null, detail: 'no isbn at all' }
  const tried: string[] = []
  for (const isbn of isbns) {
    // Google Books by ISBN — richest blurbs, and returns title/authors for guards.
    if (!gbQuotaTripped()) {
      const vols = await gbVolumesByIsbn(isbn, { maxResults: 3, fields: GB_FIELDS_DESCRIPTION })
      for (const v of vols) {
        const d = v.volumeInfo.description
        if (d && d.length >= MIN_BLURB_CHARS) {
          return {
            blurb: {
              text: d,
              sourceUrl: v.volumeInfo.infoLink ?? `https://books.google.com/books?id=${v.id}`,
              via: 'gb_isbn',
              sourceName: v.volumeInfo.title ?? null,
              sourceAuthors: v.volumeInfo.authors ?? [],
            },
            detail: `gb isbn:${isbn}`,
          }
        }
      }
      tried.push(`gb:${isbn}`)
    }
    const ol = await olBlurbByIsbn(isbn)
    await sleep(600)
    if (ol) return { blurb: ol, detail: `ol isbn:${isbn}` }
    tried.push(`ol:${isbn}`)
  }
  return { blurb: null, detail: `no blurb via ${tried.join(', ')}` }
}

// ── search mode: Gemini page discovery + page extraction ───────────────

const CONTEXT_BY_LANG: Record<string, string> = {
  de: 'Historically banned book (often Nazi-era or DDR Germany). German-language title.',
  pt: 'Banned in Portugal under the Estado Novo dictatorship (1933-1974).',
  ru: 'Banned/restricted in Russia or the Soviet Union.',
  zh: 'Banned in China or Hong Kong; likely published in HK or Taiwan.',
  ms: 'On the Malaysia KDN banned-publications list.',
}

async function discoverSearch(book: Candidate, author: string): Promise<{ blurb: Blurb | null; confidence: string | null; detail: string }> {
  const r = await geminiCoverSearch({
    title: book.title,
    author: author || null,
    year: book.first_published_year,
    language: book.original_language,
    contextHint: [
      book.original_language ? CONTEXT_BY_LANG[book.original_language] : null,
      book.isbn13 ? `ISBN-13: ${book.isbn13} — prefer a page that lists this ISBN.` : null,
    ].filter(Boolean).join(' ') || null,
  })
  if (!r.pageUrl || r.confidence === 'low') {
    return { blurb: null, confidence: r.confidence, detail: r.reasoning ?? 'no confident page' }
  }
  const ex = await extractDescriptionFromPage(r.pageUrl, { firecrawlFallback: true, minChars: MIN_BLURB_CHARS })
  if (!ex.ok) return { blurb: null, confidence: r.confidence, detail: `${r.pageUrl} → ${ex.reason}` }
  const cand = ex.candidates[0]
  if (!cand) return { blurb: null, confidence: r.confidence, detail: `${ex.finalUrl} had no usable description meta` }
  return {
    blurb: {
      text: cand.text,
      sourceUrl: ex.finalUrl,
      via: cand.via,
      sourceName: ex.pageName,
      sourceAuthors: ex.pageAuthors,
    },
    confidence: r.confidence,
    detail: '',
  }
}

// ── Guards ─────────────────────────────────────────────────────────────

function guardReject(book: Candidate, author: string, blurb: Blurb): string | null {
  if (blurb.sourceName && !titlesMatchLoose(book.title, blurb.sourceName)) {
    return `source name "${blurb.sourceName.slice(0, 60)}" fails titlesMatch`
  }
  if (!blurb.sourceName && MODE === 'search') {
    return 'no page name to verify against (search mode requires one)'
  }
  // A source author must agree with AT LEAST ONE of our credited authors —
  // co-authored and illustrated books list them in varying order/subset.
  const ours = allAuthorsOf(book)
  if (blurb.sourceAuthors.length > 0 && ours.length > 0
      && !ours.some(a => authorsAgree(a, blurb.sourceAuthors))) {
    return `source authors [${blurb.sourceAuthors.slice(0, 3).join('; ')}] disagree`
  }
  if (MODE === 'search' && blurb.sourceAuthors.length === 0 && author) {
    const surname = normalise(lastNameOf(author))
    const hay = normalise(`${blurb.sourceName ?? ''} ${blurb.text}`)
    if (surname.length >= 3 && !hay.includes(surname)) {
      return `author surname "${surname}" nowhere on page`
    }
  }
  return null
}

// ── Candidate query ────────────────────────────────────────────────────

async function fetchCandidates(): Promise<Candidate[]> {
  const sb = adminClient()
  const rows: Candidate[] = []
  let from = 0
  for (;;) {
    let q = sb.from('books')
      .select('id, slug, title, first_published_year, original_language, isbn13, bookshop_isbn13, book_authors(authors(display_name))')
      .is('description_book', null)
      .eq('is_blanket_works', false)
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (SLUGS?.length) q = q.in('slug', SLUGS) as typeof q
    else if (MODE === 'altisbn') q = q.eq('bookshop_status', 'valid') as typeof q
    else if (MODE === 'isbn') {
      // ISBN-bearing rows NOT in the altisbn pool (bookshop_status='valid' is
      // covered there; .neq alone would also drop the NULL-status majority).
      q = q.not('isbn13', 'is', null)
        .or('bookshop_status.is.null,bookshop_status.neq.valid') as typeof q
    }
    else q = q.not('isbn13', 'is', null) as typeof q
    if (LANG) q = q.eq('original_language', LANG) as typeof q
    const { data, error } = await q
    if (error) throw new Error(`DB read: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as Candidate[]))
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set (judge+groom requires it)')
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const sb = adminClient()

  const jsonlPath = path.resolve('data', `desc-websearch-${OUT_TAG}.jsonl`)
  const reportPath = path.resolve('data', `desc-websearch-${OUT_TAG}.md`)

  const done = new Set<string>()
  if (!NO_RESUME && fs.existsSync(jsonlPath)) {
    for (const line of fs.readFileSync(jsonlPath, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try { done.add((JSON.parse(line) as RunRow).slug) } catch { /* skip */ }
    }
    if (done.size) console.log(`Resume: ${done.size} slugs already in ${path.basename(jsonlPath)}`)
  }

  let candidates = (await fetchCandidates()).filter(b => !done.has(b.slug))
  const totalPool = candidates.length + done.size
  candidates = candidates.slice(0, LIMIT)
  console.log(`Mode: ${MODE} · pool ${totalPool} · this run ${candidates.length} · ${APPLY ? 'APPLY' : 'dry-run'}`)

  const rows: RunRow[] = []
  let llmCost = 0

  for (const [i, book] of candidates.entries()) {
    const author = authorOf(book)
    const row: RunRow = {
      slug: book.slug, id: book.id, title: book.title, author, mode: MODE!,
      via: null, sourceUrl: null, sourceName: null, geminiConfidence: null,
      outcome: 'error', detail: '', description: null,
    }
    try {
      let blurb: Blurb | null = null
      if (MODE === 'altisbn' || MODE === 'isbn') {
        const r = await discoverAltIsbn(book)
        blurb = r.blurb
        row.detail = r.detail
      } else {
        const r = await discoverSearch(book, author)
        blurb = r.blurb
        row.geminiConfidence = r.confidence
        row.detail = r.detail
      }
      if (!blurb) {
        row.outcome = 'no_source'
      } else {
        row.via = blurb.via
        row.sourceUrl = blurb.sourceUrl
        row.sourceName = blurb.sourceName
        const guard = guardReject(book, author, blurb)
        if (guard) {
          row.outcome = 'guard_reject'; row.detail = guard
        } else {
          const j = await judgeAndGroom(openai, book, author, blurb)
          llmCost += j.cost
          if (!j.sameBook || !j.description) {
            row.outcome = 'judge_reject'
            row.detail = j.sameBook ? `same book but no groomable content: ${j.reason}` : j.reason
          } else {
            row.outcome = 'filled'
            row.detail = j.reason
            row.description = j.description
            if (APPLY) {
              const { error: ue } = await sb.from('books').update({
                description_book: j.description,
                description_source_url: blurb.sourceUrl,
                description_source_type: 'llm_grounded_single',
                data_quality_status: 'default',
                data_quality_evaluated_at: new Date().toISOString(),
                ai_drafted: true,
              }).eq('id', book.id)
              if (ue) { row.outcome = 'error'; row.detail = `DB write: ${ue.message}` }
            }
          }
        }
      }
    } catch (e) {
      row.outcome = 'error'
      row.detail = e instanceof Error ? e.message : String(e)
    }
    rows.push(row)
    fs.appendFileSync(jsonlPath, JSON.stringify(row) + '\n')
    const mark = row.outcome === 'filled' ? '✓' : row.outcome === 'error' ? '!' : '·'
    console.log(`  ${mark} [${i + 1}/${candidates.length}] ${book.title.slice(0, 55)} → ${row.outcome}${row.detail ? ` (${row.detail.slice(0, 90)})` : ''}`)
    await sleep(BETWEEN_BOOKS_MS)
  }

  // ── Report ──
  const tally: Record<string, number> = {}
  for (const r of rows) tally[r.outcome] = (tally[r.outcome] ?? 0) + 1
  const md = (s: string) => s.replace(/\|/g, '\\|')
  const lines: string[] = []
  lines.push(`# Description websearch — ${OUT_TAG}`)
  lines.push('')
  lines.push(`Mode **${MODE}** · ${APPLY ? '**APPLIED**' : 'dry-run'} · ${rows.length} processed (pool ${totalPool}) · judge cost $${llmCost.toFixed(3)} · Firecrawl calls ${getFirecrawlCallCount()}`)
  lines.push('')
  lines.push(Object.entries(tally).map(([k, v]) => `${k}: **${v}**`).join(' · '))
  lines.push('')
  lines.push('## Filled (review these)')
  lines.push('')
  lines.push('| book | source | via | description |')
  lines.push('|---|---|---|---|')
  for (const r of rows.filter(r => r.outcome === 'filled')) {
    lines.push(`| [${md(r.title)}](https://banned-books.org/books/${r.slug}) — ${md(r.author)} | [${new URL(r.sourceUrl!).hostname}](${r.sourceUrl}) | ${r.via} | ${md(r.description!.slice(0, 220))}${r.description!.length > 220 ? '…' : ''} |`)
  }
  lines.push('')
  lines.push('## Guard rejects (possible wrong bookshop_isbn13 / wrong page)')
  lines.push('')
  lines.push('| book | source name | detail |')
  lines.push('|---|---|---|')
  for (const r of rows.filter(r => r.outcome === 'guard_reject')) {
    lines.push(`| ${md(r.title).slice(0, 60)} (${r.slug}) | ${md(r.sourceName ?? '')} | ${md(r.detail).slice(0, 140)} |`)
  }
  lines.push('')
  lines.push('## Other misses')
  lines.push('')
  lines.push('| book | outcome | detail |')
  lines.push('|---|---|---|')
  for (const r of rows.filter(r => r.outcome !== 'filled' && r.outcome !== 'guard_reject')) {
    lines.push(`| ${md(r.title).slice(0, 60)} | ${r.outcome} | ${md(r.detail).slice(0, 140)} |`)
  }
  fs.writeFileSync(reportPath, lines.join('\n') + '\n')
  console.log(`\nOutcomes: ${JSON.stringify(tally)} · judge $${llmCost.toFixed(3)} · Firecrawl ${getFirecrawlCallCount()}`)
  console.log(`Report: ${reportPath}`)
  if (!APPLY) console.log('Dry-run — review the report, then re-run with --apply.')
}

main().catch((e) => { console.error(e); process.exit(1) })
