/**
 * Enrich description_ban for the top 50 most-banned books using Wikipedia.
 *
 * Strategy (in order):
 *   1. Dedicated ban/restrict/challeng section in the article
 *   2. Full plain-text article scan — find paragraphs that contain actual ban events
 *      (ban word + year or institution). Use the best paragraph.
 *   3. REST summary extract if it contains ban language
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-ban-descriptions.ts --sample [N]
 *   npx tsx --env-file=.env.local scripts/enrich-ban-descriptions.ts --write
 *   npx tsx --env-file=.env.local scripts/enrich-ban-descriptions.ts --write --overwrite
 */

import { adminClient } from '../src/lib/supabase'

const TOP_50_IDS = [6,8,557,4,11,51,558,880,23,68,537,560,562,569,593,604,760,10,36,37,52,54,58,71,72,92,94,95,141,149,249,267,273,297,326,559,561,571,576,577,579,581,596,597,601,605,606,620,622,623]

// Tier 1: strong signal — section heading names a ban/restriction action; trust without content check
const TIER1_KEYWORDS = ['bann', 'prohibit', 'challeng', 'suppress', 'restrict', 'forbidden', 'availab']
// Tier 2: weaker signal — section might contain ban info; require hasBanContent check
const TIER2_KEYWORDS = ['controversy', 'controv', 'legal']
const MAX_CHARS = 560 // leaves room for "\n\nSource: Wikipedia" (~20 chars)

const args = process.argv.slice(2)
const SAMPLE_MODE = args.includes('--sample')
const SAMPLE_N = parseInt(args[args.indexOf('--sample') + 1] ?? '5', 10) || 5
const WRITE_MODE = args.includes('--write')
const OVERWRITE = args.includes('--overwrite')

if (!SAMPLE_MODE && !WRITE_MODE) {
  console.error('Usage: --sample [N]  or  --write [--overwrite]')
  process.exit(1)
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove section headings (h1-h5) entirely — they show up as standalone words
    .replace(/<h[1-5][^>]*>[\s\S]*?<\/h[1-5]>/gi, ' ')
    // Remove hatnote divs ("Main article: ..." navigation notes)
    .replace(/<div[^>]*hatnote[^>]*>[\s\S]*?<\/div>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<\/li>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    // Decode numeric HTML entities before stripping refs
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Strip [edit], [n], [citation needed] etc.
    .replace(/\[edit\]/gi, '')
    .replace(/\[citation needed\]/gi, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateToSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const chunk = text.slice(0, maxLen + 1)
  // Find last sentence-ending punctuation within limit
  const match = chunk.slice(0, maxLen).match(/^(.*[.!?])\s/)
  if (match && match[1].length > maxLen * 0.4) return match[1]
  // Fallback: cut at last space
  const lastSpace = chunk.lastIndexOf(' ')
  return lastSpace > maxLen * 0.4 ? text.slice(0, lastSpace) : text.slice(0, maxLen)
}

function sectionTier(line: string): 1 | 2 | 0 {
  const lower = line.toLowerCase()
  if (TIER1_KEYWORDS.some(kw => lower.includes(kw))) return 1
  if (TIER2_KEYWORDS.some(kw => lower.includes(kw))) return 2
  return 0
}

function hasBanContent(text: string): boolean {
  // Strong ban words: unambiguously describe an act of banning/suppressing the book itself
  // NOTE: "challenged" and "removed" excluded — too ambiguous ("challenged the orthodoxies", "removed errors")
  const strongBan = /\b(banned|banning|prohibited|censored|confiscated|burned|outlawed|forbidden)\b/i.test(text)
  // Weak ban words: general censorship language, needs corroborating evidence
  const weakBan = /\b(ban|challeng|censor|censorship|restrict|suppress|forbid|prosecut|trial|obscen|seized|impounded)\b/i.test(text)
  const hasYear = /\b(1[6-9]\d{2}|20[0-2]\d)\b/.test(text)
  const hasCountry = /\b(United States|Soviet|USSR|Germany|France|Britain|England|China|Iran|India|Australia|Ireland|Canada|Russia|Japan|Brazil|Spain|Portugal|Argentina|Poland|Hungary|Cuba|Algeria|Pakistan|Bangladesh|Malaysia|Lebanon|Saudi Arabia|Saudi|Namibia|Zimbabwe|Uganda|Belarus|Afghanistan|United Arab Emirates|UAE|Egypt|Turkey|Mexico|Colombia|Venezuela|Peru|Chile|Kenya|Nigeria|Sudan)\b/i.test(text)
  const hasInstitution = /\b(school board|library board|supreme court|federal court|district court|ministry|parliament|congress|senate|customs|postal|attorney general|department of justice|court of appeal)\b/i.test(text)
  // Strong ban word needs one supporting signal
  if (strongBan && (hasYear || hasCountry || hasInstitution)) return true
  // Weak ban word needs year AND (country or institution)
  if (weakBan && hasYear && (hasCountry || hasInstitution)) return true
  return false
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'banned-books-org/1.0 (educational; contact@banned-books.org)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function getSectionText(encoded: string, index: string): Promise<string> {
  const data = await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=parse&page=${encoded}&prop=text&section=${index}&format=json`
  ) as { parse?: { text?: { '*': string } } }
  return stripHtml(data.parse?.text?.['*'] ?? '')
}

// Split plain text into sentences on ". ", "! ", "? "
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 20)
}

// Score a paragraph: higher = more specific ban content (years, institutions, countries)
function banScore(text: string): number {
  let score = 0
  const yearMatches = text.match(/\b(1[6-9]\d{2}|20[0-2]\d)\b/g)
  score += (yearMatches?.length ?? 0) * 3
  if (/\b(court|judge|ruling|verdict|trial|prosecut|convict)\b/i.test(text)) score += 4
  if (/\b(law|act|statute|ordinance|decree|order)\b/i.test(text)) score += 3
  if (/\b(government|parliament|congress|senate|supreme|ministry|minister)\b/i.test(text)) score += 2
  if (/\b(school|district|library|board)\b/i.test(text)) score += 2
  const countryMentions = text.match(/\b(United States|Soviet|USSR|Germany|France|UK|Britain|China|Iran|India|Australia|Ireland|Canada|Russia|Afghanistan)\b/g)
  score += (countryMentions?.length ?? 0) * 2
  return score
}

function cleanPlainText(text: string): string {
  return text
    .replace(/^={2,}[^=]+=+\s*/gm, '')           // strip == Section == headers
    .replace(/\[\d+\]/g, '')                       // strip [1] footnote refs
    .replace(/\bhttps?:\/\/\S+/g, '')             // strip raw URLs
    .replace(/\^\s*"[^"]*"/g, '')                  // strip ^ "citation title" footnotes
    .replace(/\^\s*/g, '')                         // strip stray ^ caret refs
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function scanFullArticle(wikiTitle: string): Promise<string | null> {
  const encoded = encodeURIComponent(wikiTitle)
  let fullText = ''

  try {
    const data = await fetchJson(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=extracts&explaintext=true&format=json`
    ) as { query?: { pages?: Record<string, { extract?: string }> } }
    const pages = data.query?.pages ?? {}
    const page = Object.values(pages)[0]
    fullText = cleanPlainText(page?.extract ?? '')
  } catch {
    return null
  }

  if (!fullText) return null

  // Split into paragraphs, filter short/header lines
  const paragraphs = fullText
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 60 && !/^={2,}/.test(p))

  // Work at sentence level — only sentences that individually pass hasBanContent are included.
  // This prevents in-story banning ("Beasts of England is banned") from polluting real-world content.
  const banSentences: { text: string; score: number }[] = []
  const seen = new Set<string>()
  for (const para of paragraphs) {
    const sentences = splitSentences(para)
    // Also treat the whole paragraph as a "sentence" if it's short (single-sentence paragraphs)
    const units = sentences.length <= 1 ? [para] : sentences
    for (const s of units) {
      if (s.length < 40 || seen.has(s)) continue
      if (hasBanContent(s)) {
        seen.add(s)
        banSentences.push({ text: s, score: banScore(s) })
      }
    }
  }

  if (banSentences.length === 0) return null

  // Sort by score, build up output respecting MAX_CHARS
  banSentences.sort((a, b) => b.score - a.score)
  let built = ''
  for (const item of banSentences) {
    const candidate = built ? built + ' ' + item.text : item.text
    if (candidate.length > MAX_CHARS) break
    built = candidate
  }

  if (built.length < 80) return null
  return built + '\n\nSource: Wikipedia'
}

async function getWikipediaContent(wikiTitle: string): Promise<string | null> {
  const encoded = encodeURIComponent(wikiTitle)

  // 1. Get sections list
  let sections: { index: string; line: string }[] = []
  try {
    const data = await fetchJson(
      `https://en.wikipedia.org/w/api.php?action=parse&page=${encoded}&prop=sections&format=json`
    ) as { parse?: { sections: { index: string; line: string }[] } }
    sections = data.parse?.sections ?? []
  } catch {
    // ignore, fall through
  }

  // 2. Try tier-1/2 sections with sentence-level filtering
  //    (section name tells us it's ban-related, but section body may start with context prose)
  const tier1 = sections.filter(s => sectionTier(s.line) === 1)
  const tier2 = sections.filter(s => sectionTier(s.line) === 2)

  for (const section of [...tier1, ...tier2]) {
    const mustHaveBanContent = sectionTier(section.line) === 2
    try {
      const rawText = await getSectionText(encoded, section.index)
      if (rawText.length < 80) { await sleep(150); continue }

      // Extract only sentences that themselves contain ban content
      const sentences = splitSentences(rawText)
      const units = sentences.length <= 1 ? [rawText] : sentences
      const banUnits = units.filter(u => u.length >= 40 && hasBanContent(u))

      if (banUnits.length === 0) {
        // For tier-1, fall back to plain truncation if no sentence passes individually
        // (some sections are short, factual, and pass as a whole)
        if (!mustHaveBanContent && hasBanContent(rawText)) {
          return truncateToSentence(rawText, MAX_CHARS) + '\n\nSource: Wikipedia'
        }
        await sleep(150)
        continue
      }

      // Build from highest-scoring ban sentences
      banUnits.sort((a, b) => banScore(b) - banScore(a))
      let built = ''
      for (const s of banUnits) {
        const candidate = built ? built + ' ' + s : s
        if (candidate.length > MAX_CHARS) break
        built = candidate
      }
      if (built.length > 80) return built + '\n\nSource: Wikipedia'
      await sleep(150)
    } catch { /* try next */ }
  }

  // 3. Scan full plain-text article for ban paragraphs
  await sleep(300)
  const fromScan = await scanFullArticle(wikiTitle)
  if (fromScan) return fromScan

  // 4. Fall back to REST summary — validate on TRUNCATED text to avoid writing plot summaries
  try {
    const data = await fetchJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle.replace(/ /g, '_'))}`
    ) as { extract?: string }
    const extract = data.extract ?? ''
    const truncated = truncateToSentence(extract, MAX_CHARS)
    if (truncated.length > 80 && hasBanContent(truncated)) {
      return truncated + '\n\nSource: Wikipedia'
    }
  } catch { /* ignore */ }

  return null
}

function wikiTitleFromUrl(url: string, bookTitle: string): string | null {
  const m = url.match(/wikipedia\.org\/wiki\/(.+)$/)
  if (!m) return null
  const title = decodeURIComponent(m[1]).replace(/_/g, ' ')
  // Sanity-check: if the article title shares no words with the book title, fall back
  // (guards against mislinked ban_sources entries like Les Misérables→1984)
  const bookWords = bookTitle.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3)
  const titleLower = title.toLowerCase()
  const hasMatch = bookWords.some(w => titleLower.includes(w))
  if (!hasMatch && bookWords.length > 0) return bookTitle // fall back to book title
  return title
}

async function main() {
  const s = adminClient()

  // Load books
  const { data: books, error } = await s
    .from('books')
    .select('id, title, slug, description_ban')
    .in('id', TOP_50_IDS)
  if (error || !books) { console.error(error); process.exit(1) }

  const booksById = Object.fromEntries(books.map(b => [b.id, b]))

  // Load Wikipedia URLs via: bans -> ban_source_links -> ban_sources
  const { data: bans } = await s
    .from('bans')
    .select('id, book_id, ban_source_links(ban_sources(source_name, source_url))')
    .in('book_id', TOP_50_IDS)

  // Build map: book_id -> Wikipedia URL
  const wikiUrls: Record<number, string> = {}
  for (const ban of bans ?? []) {
    if (wikiUrls[ban.book_id]) continue
    const links = (ban as unknown as {
      ban_source_links: { ban_sources: { source_name: string; source_url: string } | null }[]
    }).ban_source_links
    for (const link of links ?? []) {
      if (link.ban_sources?.source_name === 'Wikipedia') {
        wikiUrls[ban.book_id] = link.ban_sources.source_url
        break
      }
    }
  }

  const ordered = TOP_50_IDS.map(id => booksById[id]).filter(Boolean)

  const results: { id: number; title: string; slug: string; oldDesc: string | null; newDesc: string | null }[] = []
  let processed = 0

  for (const book of ordered) {
    if (SAMPLE_MODE && processed >= SAMPLE_N) break

    const wikiUrl = wikiUrls[book.id]
    const wikiTitle = wikiUrl ? wikiTitleFromUrl(wikiUrl, book.title) : book.title

    if (!wikiTitle) {
      results.push({ id: book.id, title: book.title, slug: book.slug, oldDesc: book.description_ban, newDesc: null })
      processed++
      continue
    }

    process.stderr.write(`Fetching ${book.title} (${wikiTitle})...\n`)
    const newDesc = await getWikipediaContent(wikiTitle)
    results.push({ id: book.id, title: book.title, slug: book.slug, oldDesc: book.description_ban, newDesc })
    processed++

    await sleep(500) // be polite to Wikipedia
  }

  if (SAMPLE_MODE) {
    for (const r of results) {
      console.log(`\n${'='.repeat(70)}`)
      console.log(`BOOK: ${r.title} [${r.slug}]`)
      console.log(`\nBEFORE (${r.oldDesc?.length ?? 0} chars):`)
      console.log(r.oldDesc ?? '(none)')
      console.log(`\nAFTER (${r.newDesc?.length ?? 0} chars):`)
      console.log(r.newDesc ?? '(no Wikipedia ban content found — would keep existing)')
    }
    return
  }

  // WRITE MODE
  let updated = 0
  let skipped = 0
  for (const r of results) {
    if (!r.newDesc) { skipped++; process.stderr.write(`  — ${r.title}: no Wikipedia ban content\n`); continue }
    // Skip if already has Wikipedia-sourced content and not overwriting
    if (!OVERWRITE && r.oldDesc?.includes('Source: Wikipedia')) {
      process.stderr.write(`  ~ ${r.title}: already Wikipedia-sourced, skipping\n`)
      skipped++
      continue
    }
    const { error } = await s.from('books').update({ description_ban: r.newDesc }).eq('id', r.id)
    if (error) { console.error(`Error updating ${r.slug}:`, error.message); continue }
    updated++
    process.stderr.write(`  ✓ ${r.title}\n`)
    await sleep(50)
  }
  console.log(`\nDone. Updated: ${updated}  Skipped: ${skipped}`)
}

main().catch(e => { console.error(e); process.exit(1) })
