/**
 * Enrich description_ban for the top 50 most-banned books using Wikipedia.
 *
 * For each book:
 *   1. Resolves the Wikipedia article title (from ban_sources or book title)
 *   2. Fetches the sections list from the MediaWiki API
 *   3. Finds the first section whose heading matches ban/censor/legal/challeng etc.
 *   4. If found: fetches that section HTML, strips tags, truncates to a complete sentence ≤ 560 chars,
 *      appends "Source: Wikipedia"
 *   5. If not found: falls back to the REST summary extract if it contains ban language
 *   6. Only writes if we found real sourced content
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-ban-descriptions.ts --sample 5
 *   npx tsx --env-file=.env.local scripts/enrich-ban-descriptions.ts --write
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

if (!SAMPLE_MODE && !WRITE_MODE) {
  console.error('Usage: --sample [N]  or  --write')
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
  // The text must mention an actual ban event (not just the theme)
  const hasBanWord = /\b(ban|banned|banning|censor|censored|censorship|prohibit|prohibit|challeng|restrict|forbid|suppress)\b/i.test(text)
  const hasYear = /\b(1[6-9]\d{2}|20[0-2]\d)\b/.test(text)
  const hasCountry = /\b(country|countries|nation|government|state|school|district|library|court|supreme|parliament)\b/i.test(text)
  return hasBanWord && (hasYear || hasCountry)
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
    // ignore, fall through to summary
  }

  // 2. Try tier-1 sections first (strong ban signal — trust without content check)
  const tier1 = sections.filter(s => sectionTier(s.line) === 1)
  const tier2 = sections.filter(s => sectionTier(s.line) === 2)

  for (const section of tier1) {
    try {
      const text = await getSectionText(encoded, section.index)
      if (text.length > 80) {
        return truncateToSentence(text, MAX_CHARS) + '\n\nSource: Wikipedia'
      }
      await sleep(200)
    } catch {
      // try next
    }
  }

  for (const section of tier2) {
    try {
      const text = await getSectionText(encoded, section.index)
      if (text.length > 80 && hasBanContent(text)) {
        return truncateToSentence(text, MAX_CHARS) + '\n\nSource: Wikipedia'
      }
      await sleep(200)
    } catch {
      // try next
    }
  }

  // 3. Fall back to REST summary
  try {
    const data = await fetchJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle.replace(/ /g, '_'))}`
    ) as { extract?: string }
    const extract = data.extract ?? ''
    if (extract.length > 80 && hasBanContent(extract)) {
      return truncateToSentence(extract, MAX_CHARS) + '\n\nSource: Wikipedia'
    }
  } catch {
    // ignore
  }

  return null
}

function wikiTitleFromUrl(url: string): string | null {
  const m = url.match(/wikipedia\.org\/wiki\/(.+)$/)
  if (!m) return null
  return decodeURIComponent(m[1]).replace(/_/g, ' ')
}

function guessWikiTitle(bookTitle: string): string {
  return bookTitle
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
    const wikiTitle = wikiUrl ? wikiTitleFromUrl(wikiUrl) : guessWikiTitle(book.title)

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
    const { error } = await s.from('books').update({ description_ban: r.newDesc }).eq('id', r.id)
    if (error) { console.error(`Error updating ${r.slug}:`, error.message); continue }
    updated++
    process.stderr.write(`  ✓ ${r.title}\n`)
    await sleep(50)
  }
  console.log(`\nDone. Updated: ${updated}  Skipped (no content): ${skipped}`)
}

main().catch(e => { console.error(e); process.exit(1) })
