import Parser from 'rss-parser'
import OpenAI from 'openai'
import { adminClient } from './supabase'

export const FEEDS = [
  { name: 'PEN America',            url: 'https://pen.org/feed/' },
  { name: 'Index on Censorship',    url: 'https://www.indexoncensorship.org/feed/' },
  { name: 'Publishers Weekly',      url: 'https://www.publishersweekly.com/pw/feeds/news.xml' },
  { name: 'Freedom to Read Canada', url: 'https://www.freedomtoread.ca/feed/' },
  { name: 'Google News',            url: 'https://news.google.com/rss/search?q=banned+books&hl=en-US&gl=US&ceid=US:en', aggregator: true },
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

export type FetchNewsResult = {
  saved: number
  skipped: number
  errors: string[]
}

async function summarize(openai: OpenAI, title: string, sourceName: string, description: string, url: string): Promise<string | null> {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 150,
    messages: [
      {
        role: 'system',
        content: 'You summarize news about book bans and censorship for banned-books.org. Always write in clear, neutral English. Never copy sentences from the source. Max 80 words. If the item is not about book bans, censorship, or literary freedom, respond with exactly: NOT_RELEVANT',
      },
      {
        role: 'user',
        content: `Summarize this news item:\nTitle: ${title}\nSource: ${sourceName}\nDescription: ${description}\nURL: ${url}\n\nMention the country or institution if known. End with one sentence on why this matters for readers interested in censorship or free expression.`,
      },
    ],
  })
  const text = res.choices[0]?.message?.content?.trim() ?? ''
  return text === 'NOT_RELEVANT' ? null : text
}

export async function runFetchNews(apply = true): Promise<FetchNewsResult> {
  const supabase = adminClient()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const parser: Parser<unknown, { rawSource?: RawSource[] }> = new Parser({
    customFields: { item: [['source', 'rawSource', { keepArray: true }]] },
  })

  const { data: existing } = await supabase.from('news_items').select('source_url')
  const existingUrls = new Set((existing ?? []).map(r => r.source_url))

  const cutoff = Date.now() - SEVEN_DAYS_MS
  let saved = 0
  let skipped = 0
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

      let summary: string | null
      try {
        summary = await summarize(openai, title, sourceName, item.contentSnippet ?? item.content ?? '', url)
      } catch (e) {
        errors.push(`OpenAI error for "${title.slice(0, 40)}": ${e instanceof Error ? e.message : String(e)}`)
        continue
      }

      if (!summary) { skipped++; continue }
      if (!apply) continue

      const { error } = await supabase.from('news_items').insert({
        title,
        source_name: sourceName,
        source_url: url,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        summary,
        status: 'draft',
      })
      if (error) errors.push(`DB: ${error.message}`)
      else { saved++; existingUrls.add(url) }
    }
  }

  return { saved, skipped, errors }
}
