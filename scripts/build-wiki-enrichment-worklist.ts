#!/usr/bin/env tsx
/**
 * Build a worklist of books that should get a Wikipedia-driven ban
 * enrichment pass. No DB writes — outputs:
 *
 *   data/wiki-enrichment-worklist.json   ← structured input for step B
 *   data/wiki-enrichment-worklist.md     ← human-reviewable summary
 *
 * Selection:
 *   - Top 50 globally (v_top_banned_books, ranked by distinct_countries)
 *   - Top 10 per ban reason (excluding 'other'), ranked by distinct_countries
 *     among bans that carry that reason
 *
 * For each unique book it then asks the Wikipedia API for the most likely
 * dedicated article and scores the match. The user reviews the worklist
 * (especially low-confidence matches) before any further step runs.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx \
 *     scripts/build-wiki-enrichment-worklist.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const t = l.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

import { adminClient } from '../src/lib/supabase'

const OUT_JSON = join(process.cwd(), 'data', 'wiki-enrichment-worklist.json')
const OUT_MD = join(process.cwd(), 'data', 'wiki-enrichment-worklist.md')
const OVERRIDES_JSON = join(process.cwd(), 'data', 'wiki-enrichment-overrides.json')
const TOP_N_GLOBAL = 50
const TOP_N_PER_REASON = 10
const EXCLUDED_REASON_SLUGS = new Set(['other'])
const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const USER_AGENT = 'banned-books.org-enrichment-bot (ludo.raedts@voys.nl)'

// ─── CLI scope flags ─────────────────────────────────────────────────────────
// Default scope (no flags): top 50 globally + top 10 per ban reason.
// Country scope:  --countries=US,MY,FR,CA [--top-per-country=25]
//   Selects, per country, the books banned there ranked by within-country ban
//   rows, then by global distinct_countries, then global total bans. This
//   tiebreak matters for countries (MY/FR/CA) where almost every book carries
//   exactly one ban row — there raw within-country count is uninformative and
//   global significance surfaces the titles that actually have Wikipedia
//   articles. is_blanket_works rows ("Toutes ses œuvres" author-level Otto bans)
//   are excluded — they are not real titles.
const ARGV = process.argv.slice(2)
function argVal(name: string): string | null {
  const pref = `--${name}=`
  const hit = ARGV.find(a => a.startsWith(pref))
  return hit ? hit.slice(pref.length) : null
}
const SCOPE_COUNTRIES = (argVal('countries') ?? '')
  .split(',')
  .map(s => s.trim().toUpperCase())
  .filter(Boolean)
const TOP_PER_COUNTRY = Number(argVal('top-per-country') ?? '25')

// Explicit book-id scope:  --book-ids=6464,209,7234,...
//   Runs the matcher on exactly these books, in the given order. Used for
//   demand-driven batches (e.g. the GSC most-searched list). is_blanket_works
//   rows are still excluded.
const SCOPE_BOOK_IDS = (argVal('book-ids') ?? '')
  .split(',')
  .map(s => Number(s.trim()))
  .filter(n => Number.isFinite(n) && n > 0)

type BookRow = {
  id: number
  title: string
  slug: string
  author: string | null
  ban_count: number
  distinct_countries: number
}

type WorklistEntry = BookRow & {
  source_lists: string[] // e.g. ['top50', 'reason:religious']
  wiki: {
    url: string | null
    title: string | null
    confidence: 'high' | 'medium' | 'low' | 'none'
    score: number
    reason: string
    candidates_considered: number
  }
}

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function wikiFetch<T = unknown>(params: Record<string, string>): Promise<T> {
  const url = new URL(WIKI_API)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!r.ok) throw new Error(`Wikipedia API ${r.status}: ${url}`)
  return r.json() as Promise<T>
}

type OpenSearchRes = [string, string[], string[], string[]]

async function opensearch(query: string): Promise<{ titles: string[]; urls: string[] }> {
  try {
    const r = await wikiFetch<OpenSearchRes>({
      action: 'opensearch',
      search: query,
      limit: '5',
      namespace: '0',
      format: 'json',
    })
    return { titles: r[1] ?? [], urls: r[3] ?? [] }
  } catch {
    return { titles: [], urls: [] }
  }
}

async function fulltextSearch(query: string): Promise<string[]> {
  try {
    type SR = { query?: { search?: Array<{ title: string }> } }
    const r = await wikiFetch<SR>({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: '5',
      srnamespace: '0',
      format: 'json',
    })
    return (r.query?.search ?? []).map(x => x.title)
  } catch {
    return []
  }
}

/** Strip "Author Name: " prefix some legacy rows carry. */
function cleanTitle(raw: string): string {
  // If the part before the first colon is short-ish and the part after is the meaty title,
  // assume the prefix is a data-quality artifact and drop it.
  const m = raw.match(/^([^:]{3,40}):\s+(.{3,})$/)
  if (m && m[2].length > m[1].length / 2) return m[2]
  return raw
}

/** Normalize for similarity: lowercase, strip qualifier, strip leading article. */
function normForCmp(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*\([^)]+\)\s*$/, '')
    .replace(/^(the|an|a)\s+/i, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

/** Dice's coefficient on character bigrams — robust enough for short titles. */
function titleSimilarity(a: string, b: string): number {
  const na = normForCmp(a)
  const nb = normForCmp(b)
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) return 0
  const bigrams = (s: string) => {
    const out = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2)
      out.set(bg, (out.get(bg) ?? 0) + 1)
    }
    return out
  }
  const ba = bigrams(na)
  const bb = bigrams(nb)
  let intersection = 0
  let totalA = 0
  let totalB = 0
  for (const v of ba.values()) totalA += v
  for (const v of bb.values()) totalB += v
  for (const [k, va] of ba.entries()) {
    const vb = bb.get(k)
    if (vb) intersection += Math.min(va, vb)
  }
  return (2 * intersection) / (totalA + totalB)
}

/** Token-level Jaccard — stricter check that catches "haters" vs "hunters". */
function wordOverlap(a: string, b: string): number {
  const toks = (s: string) =>
    new Set(
      normForCmp(s)
        .split(/\s+/)
        .filter(w => w.length >= 3),
    )
  const ta = toks(a)
  const tb = toks(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const w of ta) if (tb.has(w)) inter++
  return inter / Math.min(ta.size, tb.size)
}

/** Latin diacritic stripper for author-name comparisons. */
function deburr(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const PLACEHOLDER_AUTHORS = new Set([
  'anonymous',
  'unknown',
  'various authors',
  'various',
  'multiple authors',
  'collective',
])

/** Best-effort Wikipedia article match for a book. */
async function matchWikipedia(book: BookRow): Promise<WorklistEntry['wiki']> {
  const cleanedTitle = cleanTitle(book.title)
  const rawAuthor = book.author?.toLowerCase().trim() ?? null
  const isPlaceholderAuthor = rawAuthor !== null && PLACEHOLDER_AUTHORS.has(rawAuthor)
  const lastName =
    isPlaceholderAuthor || !book.author
      ? null
      : deburr(book.author).split(/\s+/).slice(-1)[0]?.toLowerCase() ?? null

  // Build title variants. Wikipedia opensearch is fussy about extra words
  // and leading articles, so try a few normalized forms.
  const titleVariants = new Set<string>()
  titleVariants.add(cleanedTitle)
  titleVariants.add(book.title)
  // Strip leading "The "/"A "/"An ".
  for (const t of [...titleVariants]) {
    const m = t.match(/^(?:The|An|A)\s+(.{3,})$/i)
    if (m) titleVariants.add(m[1])
  }
  // Strip "The Adventures of " — common in series-book titles.
  for (const t of [...titleVariants]) {
    const m = t.match(/^The Adventures of\s+(.+)$/i)
    if (m) titleVariants.add(m[1])
  }

  // Multi-pass search. Dedup candidate titles across passes.
  const passes: string[] = []
  for (const tv of titleVariants) {
    if (book.author) passes.push(`${tv} ${book.author}`)
    passes.push(`${tv} novel`)
    passes.push(tv)
  }

  const seen = new Map<string, string>() // title → url
  for (const q of passes) {
    const { titles, urls } = await opensearch(q)
    for (let i = 0; i < titles.length; i++) {
      if (!seen.has(titles[i])) seen.set(titles[i], urls[i])
    }
    await delay(60)
    if (seen.size >= 10) break
  }

  // If still empty or thin, augment with fulltext search (better at content).
  if (seen.size < 3) {
    const ftQuery = book.author ? `"${cleanedTitle}" ${book.author}` : `"${cleanedTitle}"`
    const ftTitles = await fulltextSearch(ftQuery)
    for (const t of ftTitles) {
      if (!seen.has(t)) {
        seen.set(
          t,
          `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/\s/g, '_'))}`,
        )
      }
    }
    await delay(60)
  }

  if (seen.size === 0) {
    return {
      url: null,
      title: null,
      confidence: 'none',
      score: 0,
      reason: 'no opensearch results across all passes',
      candidates_considered: 0,
    }
  }

  // Fetch intros + categories for all candidates.
  type ExtractRes = {
    query?: {
      redirects?: Array<{ from: string; to: string }>
      pages?: Record<
        string,
        { title?: string; extract?: string; missing?: boolean; categories?: { title: string }[] }
      >
    }
  }
  let extracts: ExtractRes
  try {
    extracts = await wikiFetch<ExtractRes>({
      action: 'query',
      titles: [...seen.keys()].slice(0, 15).join('|'),
      prop: 'extracts|categories',
      exintro: '1',
      explaintext: '1',
      cllimit: '50',
      redirects: '1', // follow "1984" → "Nineteen Eighty-Four" etc.
      format: 'json',
    })
  } catch (e) {
    return {
      url: [...seen.values()][0] ?? null,
      title: [...seen.keys()][0] ?? null,
      confidence: 'low',
      score: 0,
      reason: `extract fetch failed: ${String(e)}`,
      candidates_considered: seen.size,
    }
  }

  const pages = Object.values(extracts.query?.pages ?? {})
  // Build redirect map so "1984" → "Nineteen Eighty-Four" resolves.
  const redirectMap = new Map<string, string>()
  for (const r of extracts.query?.redirects ?? []) {
    redirectMap.set(r.from, r.to)
  }

  let best: {
    title: string
    url: string
    score: number
    reason: string
    authorMatched: boolean
  } | null = null

  for (const [origTitle, origUrl] of seen.entries()) {
    const resolvedTitle = redirectMap.get(origTitle) ?? origTitle
    const wasRedirected = resolvedTitle !== origTitle
    const page = pages.find(p => p.title === resolvedTitle)
    // Use the resolved title/url for display (so we link to the real article).
    const title = resolvedTitle
    const url =
      resolvedTitle === origTitle
        ? origUrl
        : `https://en.wikipedia.org/wiki/${encodeURIComponent(resolvedTitle.replace(/\s/g, '_'))}`
    const extract = (page?.extract ?? '').toLowerCase()
    const categories = (page?.categories ?? []).map(c => c.title.toLowerCase())

    // Title similarity — guard against picking unrelated articles that just happen
    // to have a (novel) qualifier (Lolita → Lilith etc.).
    const sim = titleSimilarity(book.title, title)
    const cleanedSim = titleSimilarity(cleanedTitle, title)
    const bestSim = Math.max(sim, cleanedSim)
    // Word-overlap as a second axis (catches "haters" vs "hunters").
    const wordOv = Math.max(wordOverlap(book.title, title), wordOverlap(cleanedTitle, title))

    let score = 0
    const reasons: string[] = []
    let authorMatched = false

    // Hard guard: if the title is wildly different from the book title AND
    // we weren't redirected here, almost certainly a wrong match.
    if (bestSim < 0.4 && wordOv === 0 && !wasRedirected) {
      score -= 80
      reasons.push(`title dissimilar to book (sim=${bestSim.toFixed(2)}, wordOv=0)`)
    }
    // Word-overlap-zero guard: titles share zero significant words → reject.
    if (wordOv === 0 && bestSim < 0.6 && !wasRedirected) {
      score -= 60
      reasons.push(`no word overlap (sim=${bestSim.toFixed(2)})`)
    }

    // Strong positive: (novel)/(book)/etc. qualifier — but ONLY if there's
    // meaningful word overlap. Otherwise we pick up "Lilith (novel)" when
    // searching "Lolita" or "The Hunters (novel)" when searching "The Haters".
    if (
      /\((novel|novels|book|books|novella|memoir|comic|graphic novel|play|short story collection|poem|essay|autobiography)\)/i.test(title) &&
      wordOv > 0
    ) {
      score += 50
      reasons.push('title has (novel/book/...) qualifier')
    }
    // Author-name-in-title bonus, e.g. "Lolita (Nabokov novel)".
    if (lastName && title.toLowerCase().includes(lastName)) {
      score += 40
      reasons.push(`title contains author last name "${lastName}"`)
    }
    // Redirect bonus — Wikipedia itself thinks our query maps to this article.
    if (wasRedirected) {
      score += 30
      reasons.push(`redirect: "${origTitle}" → "${resolvedTitle}"`)
    }
    // Category hints.
    if (categories.some(c => /\b(novels|books|literature|fiction|non-fiction|graphic novels|memoirs)\b/.test(c))) {
      score += 25
      reasons.push('category indicates book')
    }
    if (categories.some(c => c.includes('banned') || c.includes('censored'))) {
      score += 15
      reasons.push('category mentions banned/censored')
    }
    if (categories.some(c => c.includes('disambiguation'))) {
      score -= 100
      reasons.push('DISAMBIGUATION page')
    }

    // Title-equality bonus (qualifier stripped).
    const stripped = title.replace(/\s*\([^)]+\)\s*$/, '').toLowerCase()
    if (stripped === cleanedTitle.toLowerCase() || stripped === book.title.toLowerCase()) {
      score += 20
      reasons.push('exact title match')
    }

    // Author presence — the most important signal.
    if (lastName && deburr(extract).includes(lastName)) {
      score += 40
      reasons.push(`author last name appears in intro`)
      authorMatched = true
    }

    // Extract too short = probably a stub or disambiguation page.
    if (extract.length < 80) {
      score -= 20
      reasons.push('intro too short')
    }

    // Pages clearly about adaptations.
    if (/\b(film|television series|tv series|miniseries|video game|music album|song)\b/i.test(title)) {
      score -= 40
      reasons.push('title mentions film/tv/game/album')
    }

    if (!best || score > best.score) {
      best = {
        title,
        url,
        score,
        reason: reasons.join('; ') || '(no positive signals)',
        authorMatched,
      }
    }
  }

  if (!best) {
    return {
      url: null,
      title: null,
      confidence: 'none',
      score: 0,
      reason: 'no candidates ranked',
      candidates_considered: seen.size,
    }
  }

  // Confidence rules:
  //   high   = (score >= 60 AND author matched) OR (score >= 50 AND no author info)
  //   medium = score >= 30
  //   low    = score > 0
  //   none   = score <= 0 (don't trust it)
  const authorOK = !lastName || best.authorMatched
  let confidence: 'high' | 'medium' | 'low' | 'none'
  if (best.score >= 60 && authorOK) confidence = 'high'
  else if (best.score >= 50 && !lastName) confidence = 'high'
  else if (best.score >= 30) confidence = 'medium'
  else if (best.score > 0) confidence = 'low'
  else confidence = 'none'

  return {
    url: best.url,
    title: best.title,
    confidence,
    score: best.score,
    reason: best.reason,
    candidates_considered: seen.size,
  }
}

async function main() {
  const sb = adminClient()

  // ─── Fetch reasons (excluding 'other') ─────────────────────────────────────
  const { data: reasons, error: reasonsErr } = await sb
    .from('reasons')
    .select('id, slug, label_en')
    .order('id')
  if (reasonsErr) throw reasonsErr
  const targetReasons = (reasons ?? []).filter(r => !EXCLUDED_REASON_SLUGS.has(r.slug))
  console.log(`reasons: ${targetReasons.length} (excluding ${[...EXCLUDED_REASON_SLUGS].join(', ')})`)

  const inLists = new Map<number, Set<string>>()
  const banStats = new Map<number, { total: number; countries: number }>()

  if (SCOPE_BOOK_IDS.length > 0) {
    // ─── Explicit book-id scope ─────────────────────────────────────────────────
    const candidateIds = [...new Set(SCOPE_BOOK_IDS)]
    console.log(`book-id scope: ${candidateIds.length} books`)

    // Exclude blanket-works (not real titles).
    const blanket = new Set<number>()
    {
      const CHUNK = 300
      for (let i = 0; i < candidateIds.length; i += CHUNK) {
        const chunk = candidateIds.slice(i, i + CHUNK)
        const { data, error } = await sb
          .from('books')
          .select('id, is_blanket_works')
          .in('id', chunk)
        if (error) throw error
        for (const b of data ?? []) if (b.is_blanket_works) blanket.add(b.id)
      }
    }
    if (blanket.size > 0) console.log(`excluding ${blanket.size} is_blanket_works book(s)`)

    // Global ban stats (total rows + distinct countries) for display, paginated.
    const PAGE = 1000
    const CHUNK = 200
    const ids = candidateIds.filter(id => !blanket.has(id))
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      const acc = new Map<number, { total: number; countries: Set<string> }>()
      let from = 0
      while (true) {
        const { data, error } = await sb
          .from('bans')
          .select('book_id, country_code')
          .in('book_id', chunk)
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        for (const r of data) {
          if (!acc.has(r.book_id)) acc.set(r.book_id, { total: 0, countries: new Set() })
          const a = acc.get(r.book_id)!
          a.total += 1
          a.countries.add(r.country_code)
        }
        if (data.length < PAGE) break
        from += PAGE
      }
      for (const [id, a] of acc.entries()) {
        banStats.set(id, { total: a.total, countries: a.countries.size })
      }
    }

    // Preserve the requested order via an index suffix on the source list.
    ids.forEach((id, idx) => {
      inLists.set(id, new Set([`gsc:${String(idx + 1).padStart(2, '0')}`]))
      if (!banStats.has(id)) banStats.set(id, { total: 0, countries: 0 })
    })
  } else if (SCOPE_COUNTRIES.length > 0) {
    // ─── Country scope ────────────────────────────────────────────────────────
    if (!Number.isFinite(TOP_PER_COUNTRY) || TOP_PER_COUNTRY < 1) {
      throw new Error(`--top-per-country must be a positive integer (got "${argVal('top-per-country')}")`)
    }
    console.log(`country scope: ${SCOPE_COUNTRIES.join(', ')} — top ${TOP_PER_COUNTRY} per country`)

    // 1. Per-country within-country ban-row counts.
    const withinByCountry = new Map<string, Map<number, number>>()
    const allCandidates = new Set<number>()
    const PAGE = 1000
    for (const cc of SCOPE_COUNTRIES) {
      const within = new Map<number, number>()
      let from = 0
      while (true) {
        const { data, error } = await sb
          .from('bans')
          .select('book_id')
          .eq('country_code', cc)
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        for (const r of data) {
          within.set(r.book_id, (within.get(r.book_id) ?? 0) + 1)
          allCandidates.add(r.book_id)
        }
        if (data.length < PAGE) break
        from += PAGE
      }
      withinByCountry.set(cc, within)
      console.log(`${cc}: ${within.size} candidate books`)
    }

    const candidateIds = [...allCandidates]

    // 2. Exclude blanket-works ("Toutes ses œuvres") author-level Otto bans —
    //    not real titles, and isolated from enrichers elsewhere.
    const blanket = new Set<number>()
    {
      const CHUNK = 300
      for (let i = 0; i < candidateIds.length; i += CHUNK) {
        const chunk = candidateIds.slice(i, i + CHUNK)
        const { data, error } = await sb
          .from('books')
          .select('id, is_blanket_works')
          .in('id', chunk)
        if (error) throw error
        for (const b of data ?? []) if (b.is_blanket_works) blanket.add(b.id)
      }
    }
    if (blanket.size > 0) console.log(`excluding ${blanket.size} is_blanket_works book(s)`)

    // 3. Global ban stats (total rows + distinct countries) for the tiebreaker.
    //    Paginate each .in() chunk so district-heavy books don't trip the
    //    1000-row select cap.
    const global = new Map<number, { total: number; countries: number }>()
    {
      const CHUNK = 200
      for (let i = 0; i < candidateIds.length; i += CHUNK) {
        const chunk = candidateIds.slice(i, i + CHUNK)
        const acc = new Map<number, { total: number; countries: Set<string> }>()
        let from = 0
        while (true) {
          const { data, error } = await sb
            .from('bans')
            .select('book_id, country_code')
            .in('book_id', chunk)
            .order('id', { ascending: true })
            .range(from, from + PAGE - 1)
          if (error) throw error
          if (!data || data.length === 0) break
          for (const r of data) {
            if (!acc.has(r.book_id)) acc.set(r.book_id, { total: 0, countries: new Set() })
            const a = acc.get(r.book_id)!
            a.total += 1
            a.countries.add(r.country_code)
          }
          if (data.length < PAGE) break
          from += PAGE
        }
        for (const [id, a] of acc.entries()) {
          global.set(id, { total: a.total, countries: a.countries.size })
        }
      }
    }

    // 4. Rank per country and assign the top-N to the worklist.
    for (const cc of SCOPE_COUNTRIES) {
      const within = withinByCountry.get(cc)!
      const ranked = [...within.entries()]
        .filter(([bookId]) => !blanket.has(bookId))
        .map(([bookId, withinCount]) => ({
          bookId,
          withinCount,
          gCountries: global.get(bookId)?.countries ?? 0,
          gTotal: global.get(bookId)?.total ?? 0,
        }))
        .sort(
          (a, b) =>
            b.withinCount - a.withinCount ||
            b.gCountries - a.gCountries ||
            b.gTotal - a.gTotal ||
            a.bookId - b.bookId,
        )
        .slice(0, TOP_PER_COUNTRY)

      for (const e of ranked) {
        if (!inLists.has(e.bookId)) inLists.set(e.bookId, new Set())
        inLists.get(e.bookId)!.add(`country:${cc}`)
        if (!banStats.has(e.bookId)) {
          banStats.set(e.bookId, { total: e.gTotal, countries: e.gCountries })
        }
      }
      console.log(`${cc}: ${ranked.length} books selected`)
    }
  } else {
    // ─── Default scope: top 50 globally + top 10 per reason ─────────────────────
    const { data: topGlobal, error: topErr } = await sb
      .from('v_top_banned_books')
      .select('entity_id, total_bans, distinct_countries')
      .order('distinct_countries', { ascending: false })
      .order('total_bans', { ascending: false })
      .limit(TOP_N_GLOBAL)
    if (topErr) throw topErr

    for (const r of topGlobal ?? []) {
      inLists.set(r.entity_id, new Set(['top50']))
      banStats.set(r.entity_id, { total: r.total_bans, countries: r.distinct_countries })
    }

    // ─── Top 10 per reason ─────────────────────────────────────────────────────
    for (const reason of targetReasons) {
      // Fetch all bans linked to this reason (book_id, country_code).
      // Paginate to handle reasons with many ban rows.
      const PAGE = 1000
      const seen = new Map<number, Set<string>>()
      const eventCount = new Map<number, number>()
      let from = 0
      while (true) {
        const { data, error } = await sb
          .from('ban_reason_links')
          .select('ban_id, bans!inner(book_id, country_code)')
          .eq('reason_id', reason.id)
          .order('ban_id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        for (const row of data) {
          // bans is the joined ban row(s).
          const ban = (row as unknown as { bans: { book_id: number; country_code: string } }).bans
          if (!ban) continue
          const bookId = ban.book_id
          if (!seen.has(bookId)) seen.set(bookId, new Set())
          seen.get(bookId)!.add(ban.country_code)
          eventCount.set(bookId, (eventCount.get(bookId) ?? 0) + 1)
        }
        if (data.length < PAGE) break
        from += PAGE
      }

      const ranked = [...seen.entries()]
        .map(([bookId, countrySet]) => ({
          bookId,
          countries: countrySet.size,
          events: eventCount.get(bookId) ?? 0,
        }))
        .sort((a, b) => b.countries - a.countries || b.events - a.events)
        .slice(0, TOP_N_PER_REASON)

      for (const e of ranked) {
        if (!inLists.has(e.bookId)) inLists.set(e.bookId, new Set())
        inLists.get(e.bookId)!.add(`reason:${reason.slug}`)
        if (!banStats.has(e.bookId)) {
          // Stats from per-reason aggregation are partial — get the global numbers in a follow-up.
          banStats.set(e.bookId, { total: e.events, countries: e.countries })
        }
      }
      console.log(`reason ${reason.slug}: ${ranked.length} books ranked, ${seen.size} candidates`)
    }

    // ─── Global ban stats fallback for reason-only books ───────────────────────
    const missingStats = [...inLists.keys()].filter(
      id => !(topGlobal ?? []).some(r => r.entity_id === id),
    )
    if (missingStats.length > 0) {
      const CHUNK = 100
      for (let i = 0; i < missingStats.length; i += CHUNK) {
        const chunk = missingStats.slice(i, i + CHUNK)
        const { data } = await sb
          .from('bans')
          .select('book_id, country_code')
          .in('book_id', chunk)
        const acc = new Map<number, { total: number; countries: Set<string> }>()
        for (const r of data ?? []) {
          if (!acc.has(r.book_id)) acc.set(r.book_id, { total: 0, countries: new Set() })
          const a = acc.get(r.book_id)!
          a.total += 1
          a.countries.add(r.country_code)
        }
        for (const [id, a] of acc.entries()) {
          banStats.set(id, { total: a.total, countries: a.countries.size })
        }
      }
    }
  }

  const allBookIds = [...inLists.keys()]
  console.log(`unique books across all lists: ${allBookIds.length}`)

  // ─── Resolve book metadata + author display name ───────────────────────────
  const books: Map<number, BookRow> = new Map()
  const CHUNK = 50
  for (let i = 0; i < allBookIds.length; i += CHUNK) {
    const chunk = allBookIds.slice(i, i + CHUNK)
    const { data, error } = await sb
      .from('books')
      .select('id, title, slug, book_authors(author_id, role, authors(display_name))')
      .in('id', chunk)
    if (error) throw error
    for (const b of data ?? []) {
      const bookAuthors = (b as unknown as {
        book_authors?: Array<{ role: string; authors?: { display_name?: string } }>
      }).book_authors ?? []
      const primary =
        bookAuthors.find(ba => ba.role === 'author')?.authors?.display_name ||
        bookAuthors[0]?.authors?.display_name ||
        null
      const stats = banStats.get(b.id) ?? { total: 0, countries: 0 }
      books.set(b.id, {
        id: b.id,
        title: b.title,
        slug: b.slug,
        author: primary,
        ban_count: stats.total,
        distinct_countries: stats.countries,
      })
    }
  }

  // ─── Load manual URL overrides if present ─────────────────────────────────
  // Format: { "<book_id>": { "url": "https://en.wikipedia.org/wiki/...", "note": "optional" } }
  // Any book listed here skips the Wikipedia matcher and uses the override directly
  // with confidence='high'.
  let overrides: Record<string, { url: string; note?: string }> = {}
  if (existsSync(OVERRIDES_JSON)) {
    try {
      overrides = JSON.parse(readFileSync(OVERRIDES_JSON, 'utf8'))
      console.log(`loaded ${Object.keys(overrides).length} overrides from ${OVERRIDES_JSON}`)
    } catch (e) {
      console.warn(`failed to parse overrides file: ${e}`)
    }
  }

  // ─── Wikipedia matching ────────────────────────────────────────────────────
  const entries: WorklistEntry[] = []
  let i = 0
  for (const [bookId, lists] of inLists.entries()) {
    const book = books.get(bookId)
    if (!book) continue
    i++
    process.stdout.write(`\r[${i}/${allBookIds.length}] matching: ${book.title.slice(0, 60)}                    `)
    const override = overrides[String(bookId)] as
      | { url: string | null; note?: string }
      | undefined
    let wiki: WorklistEntry['wiki']
    if (override !== undefined) {
      if (override.url === null) {
        // Explicit "no Wikipedia article" marker → exclude from step B.
        wiki = {
          url: null,
          title: null,
          confidence: 'none',
          score: 0,
          reason: `manual override: skip${override.note ? ` (${override.note})` : ''}`,
          candidates_considered: 0,
        }
      } else {
        const m = override.url.match(/\/wiki\/(.+)$/)
        const wikiTitle = m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : null
        wiki = {
          url: override.url,
          title: wikiTitle,
          confidence: 'high',
          score: 999,
          reason: `manual override${override.note ? ` (${override.note})` : ''}`,
          candidates_considered: 0,
        }
      }
    } else {
      wiki = await matchWikipedia(book)
      await delay(120) // be polite to Wikipedia API
    }
    entries.push({
      ...book,
      source_lists: [...lists].sort(),
      wiki,
    })
  }
  process.stdout.write('\n')

  // Sort: top50 books first, then by distinct_countries.
  entries.sort((a, b) => {
    const aTop = a.source_lists.includes('top50') ? 1 : 0
    const bTop = b.source_lists.includes('top50') ? 1 : 0
    if (aTop !== bTop) return bTop - aTop
    return b.distinct_countries - a.distinct_countries
  })

  // ─── Write JSON + markdown ─────────────────────────────────────────────────
  if (!existsSync(join(process.cwd(), 'data'))) {
    mkdirSync(join(process.cwd(), 'data'))
  }
  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        params:
          SCOPE_BOOK_IDS.length > 0
            ? { scope: 'book-ids', book_ids: SCOPE_BOOK_IDS }
            : SCOPE_COUNTRIES.length > 0
              ? { scope: 'country', countries: SCOPE_COUNTRIES, top_per_country: TOP_PER_COUNTRY }
              : { scope: 'default', top_n_global: TOP_N_GLOBAL, top_n_per_reason: TOP_N_PER_REASON },
        total_books: entries.length,
        entries,
      },
      null,
      2,
    ),
  )

  const byConfidence = entries.reduce(
    (acc, e) => ((acc[e.wiki.confidence] = (acc[e.wiki.confidence] ?? 0) + 1), acc),
    {} as Record<string, number>,
  )

  const md: string[] = []
  md.push(`# Wikipedia enrichment worklist`)
  md.push('')
  md.push(`Generated ${new Date().toISOString()}.`)
  md.push(
    SCOPE_BOOK_IDS.length > 0
      ? `Scope: **book-ids** — ${SCOPE_BOOK_IDS.length} explicit books.`
      : SCOPE_COUNTRIES.length > 0
        ? `Scope: **country** — ${SCOPE_COUNTRIES.join(', ')}, top ${TOP_PER_COUNTRY} per country.`
        : `Scope: **default** — top ${TOP_N_GLOBAL} globally + top ${TOP_N_PER_REASON} per reason.`,
  )
  md.push(`Total unique books: **${entries.length}**`)
  md.push('')
  md.push(`## Match confidence`)
  md.push('')
  for (const c of ['high', 'medium', 'low', 'none']) {
    md.push(`- **${c}**: ${byConfidence[c] ?? 0}`)
  }
  md.push('')
  md.push(`## Review checklist`)
  md.push('')
  md.push(`Low/none confidence matches need manual review before step B runs.`)
  md.push('')
  md.push(`| # | Book | Author | Bans | Lists | Confidence | Wikipedia URL |`)
  md.push(`|---|---|---|---|---|---|---|`)
  entries.forEach((e, idx) => {
    const lists = e.source_lists.join(', ')
    const url = e.wiki.url ? `[${e.wiki.title}](${e.wiki.url})` : '_(none)_'
    md.push(
      `| ${idx + 1} | ${e.title} | ${e.author ?? '—'} | ${e.ban_count} (${e.distinct_countries}c) | ${lists} | ${e.wiki.confidence} (${e.wiki.score}) | ${url} |`,
    )
  })
  md.push('')
  md.push(`## Per-row match reasoning`)
  md.push('')
  for (const e of entries) {
    md.push(`### ${e.title} — ${e.author ?? '—'} (id ${e.id})`)
    md.push(`- Lists: ${e.source_lists.join(', ')}`)
    md.push(`- Bans: ${e.ban_count} (${e.distinct_countries} countries)`)
    md.push(`- Match: ${e.wiki.confidence} (score ${e.wiki.score}, considered ${e.wiki.candidates_considered})`)
    md.push(`- URL: ${e.wiki.url ?? '—'}`)
    md.push(`- Reasoning: ${e.wiki.reason}`)
    md.push('')
  }

  writeFileSync(OUT_MD, md.join('\n'))
  console.log(`\nwrote:\n  ${OUT_JSON}\n  ${OUT_MD}`)
  console.log(`confidence summary:`, byConfidence)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
