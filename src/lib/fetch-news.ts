import Parser from 'rss-parser'
import OpenAI from 'openai'
import { adminClient } from './supabase'
import { getNewsConfig } from '@/config/news'

export type Feed = {
  name: string
  url: string
  /** ISO-639-1; defaults to 'en' when omitted. Drives translate-and-summarise. */
  language?: string
  /** Google News-style aggregator: titles carry "<headline> - Publisher". */
  aggregator?: boolean
  /**
   * Topic filter for broad-scope feeds (RSF, HRW, Article 19) that cover more
   * than books. When set, only items whose title or description match the
   * regex pass through. Books-only feeds (PEN America, Index, etc.) leave
   * this unset and feed every item to the relevance check in the LLM prompt.
   */
  keywordFilter?: RegExp
}

// Topic filter for general human-rights / press-freedom feeds. Items not
// matching are dropped before the embedding + LLM calls, saving both API
// cost and admin-queue noise. Only the strong terms count: weak terms like
// "ban", "censor", and "publish" trigger on too many off-topic geopolitics
// stories (asset bans, press-credential bans, regulation-publishing) when
// the broad-scope feeds (HRW, Meduza, Article 19, etc.) get pulled in. \b
// boundaries prevent "Facebook"/"authoritarian" false positives.
export const BOOKS_KEYWORDS = /\b(?:books?|authors?|librar(?:y|ies)|literature|literary)\b/i

/** Returns true when an RSS item should pass the books-only topic filter. */
export function matchesBooksFilter(title: string, description: string, filter: RegExp = BOOKS_KEYWORDS): boolean {
  return filter.test(title) || filter.test(description)
}

export const FEEDS: Feed[] = [
  { name: 'PEN America',            url: 'https://pen.org/feed/' },
  { name: 'Index on Censorship',    url: 'https://www.indexoncensorship.org/feed/' },
  { name: 'Publishers Weekly',      url: 'https://www.publishersweekly.com/pw/feeds/news.xml' },
  { name: 'Freedom to Read Canada', url: 'https://www.freedomtoread.ca/feed/' },
  { name: 'Google News',            url: 'https://news.google.com/rss/search?q=banned+books&hl=en-US&gl=US&ceid=US:en', aggregator: true },

  // International perspectives — these are publisher-translated English
  // editions of non-English newsrooms, so language stays 'en' and the
  // summariser doesn't translate. The keywordFilter cuts geopolitical noise
  // before any LLM call. (RSF dropped: their site no longer exposes a working
  // RSS feed at any of /en/rss, /rss, /en/feed, /feeds/* — confirmed 2026-05.)
  { name: 'Meduza',              url: 'https://meduza.io/rss/en/all',                keywordFilter: BOOKS_KEYWORDS },
  { name: 'IranWire',            url: 'https://iranwire.com/en/feed/',               keywordFilter: BOOKS_KEYWORDS },
  { name: 'China Digital Times', url: 'https://chinadigitaltimes.net/feed/',         keywordFilter: BOOKS_KEYWORDS },

  // English-language NGO/HR feeds — broad scope, filter is essential.
  // HRW has no topic-specific free-speech RSS, so we pull /rss/news and let
  // the keyword filter pick out books/censorship items.
  { name: 'Article 19',          url: 'https://www.article19.org/feed/',             keywordFilter: BOOKS_KEYWORDS },
  { name: 'HRW',                 url: 'https://www.hrw.org/rss/news',                keywordFilter: BOOKS_KEYWORDS },
  { name: 'PEN International',   url: 'https://www.pen-international.org/news?format=rss', keywordFilter: BOOKS_KEYWORDS },
]

// Google News wraps an item's <source url="…">Publisher</source>. Keep the array so we
// can read both the publisher name (text) and URL (attribute).
type RawSource = { $?: { url?: string }; _?: string } | string
type ParsedItem = Parser.Item & { rawSource?: RawSource[] }

function readPublisher(item: ParsedItem): { name: string; url: string } | null {
  const raw = item.rawSource?.[0]
  if (!raw) return null
  if (typeof raw === 'string') return raw ? { name: raw, url: '' } : null
  const name = raw._?.trim() ?? ''
  const url = raw.$?.url?.trim() ?? ''
  return name ? { name, url } : null
}

// Google News appends " - Publisher" to titles; strip it once we surface the publisher separately.
function stripTrailingPublisher(title: string, publisher: string): string {
  if (!publisher) return title
  const suffix = ` - ${publisher}`
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const SUMMARY_MODEL = 'gpt-4.1-mini'
const EMBED_MODEL = 'text-embedding-3-small'

export type FetchNewsResult = {
  saved: number
  skipped: number
  duplicates: number
  errors: string[]
}

const SUMMARY_SYSTEM = `You write short, neutral news briefs about book bans, censorship, and literary freedom for banned-books.org.

Return a JSON object with two fields:
- "headline": 4–8 words. A punchy, concrete attention-grabber that names the specific actor or book or place. Title case. No trailing punctuation. No clickbait, no "you won't believe", no questions. If the source title is already a strong concrete headline, you may lightly rewrite it for tone — do not just copy it verbatim.
- "summary": 40–70 words. One paragraph. The full brief.

Hard rules for the summary:
- No copying phrases from the source.
- Output English only. If the source is not in English, translate the facts into English first; do not transliterate names ad-hoc — use the standard English spelling when there is one.
- Open with the most concrete fact: a number, a name, a place, or the specific action taken. Avoid generic openers like "A new…", "A recently…", "A report shows…".
- Vary sentence structure between briefs. Do not start every brief with the same subject-verb pattern.
- Mention the country, institution, or publisher when known.
- Do NOT end with a generic "this matters because…" sentence. Only add an implication if it is concrete (a specific consequence, precedent, or contradiction). Otherwise stop after the facts.
- Stay factual; no editorialising.
- Banned phrases (do not use): "highlights", "underscores", "such efforts", "such developments", "such actions", "ongoing challenges", "this is significant for readers interested in", "raises important questions", "reflects broader concerns", "draws attention to", "sheds light on", "the importance of", "literary freedom" as filler.

If the item is not about book bans, censorship, or literary freedom, return exactly: {"not_relevant": true}`

export type GeneratedBrief = { headline: string; summary: string }

export async function summarize(
  openai: OpenAI,
  title: string,
  sourceName: string,
  description: string,
  language: string,
): Promise<GeneratedBrief | null> {
  const langNote = language && language !== 'en'
    ? `\nSource language: ${language}. Translate as needed; output English only.`
    : ''
  const res = await openai.chat.completions.create({
    model: SUMMARY_MODEL,
    max_tokens: 260,
    temperature: 0.8,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SUMMARY_SYSTEM },
      {
        role: 'user',
        content: `Title: ${title}\nSource: ${sourceName}${langNote}\nDescription: ${description.slice(0, 1500)}\n\nReturn the JSON object.`,
      },
    ],
  })
  const text = res.choices[0]?.message?.content?.trim() ?? ''
  if (!text) return null
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return null }
  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>
  if (obj.not_relevant === true) return null
  const headline = typeof obj.headline === 'string' ? obj.headline.trim() : ''
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''
  if (!headline || !summary) return null
  return { headline, summary }
}

async function embed(openai: OpenAI, title: string, description: string): Promise<number[]> {
  // Embed title + leading description so dedup matches on the actual story,
  // not just the headline (Google News headlines can differ wildly across
  // republishers for the same underlying event).
  const input = `${title}\n${description.slice(0, 800)}`
  const res = await openai.embeddings.create({ model: EMBED_MODEL, input })
  return res.data[0].embedding
}

function parseEmbedding(val: unknown): number[] | null {
  if (!val) return null
  if (Array.isArray(val)) return val as number[]
  // pgvector serialises to a JSON-array-shaped string: "[0.1,0.2,...]"
  if (typeof val === 'string') {
    try { return JSON.parse(val) as number[] } catch { return null }
  }
  return null
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function currentMonday(): string {
  const d = new Date()
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

export async function runFetchNews(apply = true): Promise<FetchNewsResult> {
  const supabase = adminClient()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const parser: Parser<unknown, { rawSource?: RawSource[] }> = new Parser({
    customFields: { item: [['source', 'rawSource', { keepArray: true }]] },
  })

  const config = await getNewsConfig()

  // URL dedup: same as before, hard skip if URL already exists in any state.
  const { data: existing } = await supabase.from('news_items').select('source_url')
  const existingUrls = new Set((existing ?? []).map(r => r.source_url))

  // Embedding dedup: load embeddings of items from the lookback window. Items
  // without an embedding (legacy rows from before migration 018) are skipped
  // here — they can't contribute to similarity comparisons.
  const dedupCutoff = new Date(Date.now() - config.dedupWindowDays * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentRows } = await supabase
    .from('news_items')
    .select('embedding')
    .gte('published_at', dedupCutoff)
    .not('embedding', 'is', null)
  const recentEmbeddings: number[][] = (recentRows ?? [])
    .map(r => parseEmbedding((r as { embedding: unknown }).embedding))
    .filter((v): v is number[] => v !== null)

  // Track embeddings of items saved in *this* run so dupes within a single
  // fetch round get caught too (e.g. PEN America posts the same story twice).
  const justSavedEmbeddings: number[][] = []

  const cutoff = Date.now() - SEVEN_DAYS_MS
  let saved = 0
  let skipped = 0
  let duplicates = 0
  const errors: string[] = []

  for (const feed of FEEDS) {
    let items
    try {
      const parsed = await parser.parseURL(feed.url)
      items = parsed.items
    } catch (e) {
      errors.push(`${feed.name}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }

    const recent = items.filter(item => {
      const pub = item.pubDate ? new Date(item.pubDate).getTime() : 0
      return pub > cutoff
    })

    for (const item of recent as ParsedItem[]) {
      const url = item.link ?? item.guid ?? ''
      const rawTitle = item.title ?? ''
      if (!url || !rawTitle || existingUrls.has(url)) continue

      const publisher = feed.aggregator ? readPublisher(item) : null
      const sourceName = publisher?.name ?? feed.name
      const title = publisher ? stripTrailingPublisher(rawTitle, publisher.name) : rawTitle
      const description = item.contentSnippet ?? item.content ?? ''

      // Cheap topic filter for broad-scope feeds — avoids paying for an
      // embedding + summary on stories that are clearly off-topic.
      if (feed.keywordFilter && !matchesBooksFilter(title, description, feed.keywordFilter)) continue

      // Embed first — cheaper than the chat call and lets us bail before
      // paying for a summary on something we'd reject as duplicate anyway.
      let embedding: number[]
      try {
        embedding = await embed(openai, title, description)
      } catch (e) {
        errors.push(`Embedding error for "${title.slice(0, 40)}": ${e instanceof Error ? e.message : String(e)}`)
        continue
      }

      const maxSimRecent = recentEmbeddings.reduce((max, e) => Math.max(max, cosine(embedding, e)), 0)
      const maxSimBatch = justSavedEmbeddings.reduce((max, e) => Math.max(max, cosine(embedding, e)), 0)
      if (Math.max(maxSimRecent, maxSimBatch) >= config.dedupThreshold) {
        duplicates++
        continue
      }

      const language = feed.language ?? 'en'
      let brief: GeneratedBrief | null
      try {
        brief = await summarize(openai, title, sourceName, description, language)
      } catch (e) {
        errors.push(`OpenAI error for "${title.slice(0, 40)}": ${e instanceof Error ? e.message : String(e)}`)
        continue
      }

      if (!brief) { skipped++; continue }
      if (!apply) continue

      const status = config.autoPublish ? 'published' : 'draft'
      const insertRow: Record<string, unknown> = {
        title,
        headline: brief.headline,
        source_name: sourceName,
        source_url: url,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        summary: brief.summary,
        status,
        embedding,
        auto_published: config.autoPublish,
        source_language: language,
        // Preserve raw RSS values so the editor can audit the translation.
        // For en feeds these duplicate the English title/summary — small
        // cost, and it keeps the schema regular.
        original_title: rawTitle,
        original_summary: description || null,
      }
      if (config.autoPublish) insertRow.published_week = currentMonday()

      const { error } = await supabase.from('news_items').insert(insertRow)
      if (error) errors.push(`DB: ${error.message}`)
      else {
        saved++
        existingUrls.add(url)
        justSavedEmbeddings.push(embedding)
      }
    }
  }

  return { saved, skipped, duplicates, errors }
}
