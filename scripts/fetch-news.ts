/**
 * Fetch news from RSS feeds, summarize with GPT-4o-mini, save drafts.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/fetch-news.ts           # dry-run
 *   npx tsx --env-file=.env.local scripts/fetch-news.ts --apply   # write to DB
 */

import Parser from 'rss-parser'
import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const supabase = adminClient()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const FEEDS = [
  { name: 'PEN America',           url: 'https://pen.org/feed/' },
  { name: 'Index on Censorship',   url: 'https://www.indexoncensorship.org/feed/' },
  { name: 'Publishers Weekly',     url: 'https://www.publishersweekly.com/pw/feeds/news.xml' },
  { name: 'Freedom to Read Canada',url: 'https://www.freedomtoread.ca/feed/' },
]

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

async function summarize(title: string, sourceName: string, description: string, url: string): Promise<string | null> {
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

async function main() {
  const parser = new Parser()

  // Load already-saved URLs to skip duplicates
  const { data: existing } = await supabase.from('news_items').select('source_url')
  const existingUrls = new Set((existing ?? []).map(r => r.source_url))

  const cutoff = Date.now() - SEVEN_DAYS_MS

  let totalFound = 0
  let totalNew = 0
  let totalRelevant = 0
  let totalSaved = 0
  let totalSkipped = 0

  for (const feed of FEEDS) {
    console.log(`\n── ${feed.name} ──`)
    let items
    try {
      const parsed = await parser.parseURL(feed.url)
      items = parsed.items
    } catch (e) {
      console.log(`  ✗ fetch failed: ${e instanceof Error ? e.message : e}`)
      continue
    }

    const recent = items.filter(item => {
      const pub = item.pubDate ? new Date(item.pubDate).getTime() : 0
      return pub > cutoff
    })
    console.log(`  ${recent.length} items in last 7 days`)
    totalFound += recent.length

    for (const item of recent) {
      const url = item.link ?? item.guid ?? ''
      const title = item.title ?? ''
      const description = item.contentSnippet ?? item.content ?? ''

      if (!url || !title) continue
      if (existingUrls.has(url)) { console.log(`  [dup] ${title.slice(0, 60)}`); continue }

      totalNew++
      console.log(`  → ${title.slice(0, 70)}`)

      const summary = await summarize(title, feed.name, description, url)
      if (!summary) {
        console.log(`     NOT_RELEVANT`)
        totalSkipped++
        continue
      }
      console.log(`     ${summary.slice(0, 90)}…`)
      totalRelevant++

      if (!APPLY) continue

      const { error } = await supabase.from('news_items').insert({
        title,
        source_name: feed.name,
        source_url: url,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        summary,
        status: 'draft',
      })
      if (error) console.log(`     ✗ ${error.message}`)
      else { console.log(`     ✓ saved`); totalSaved++; existingUrls.add(url) }
    }
  }

  console.log(`\n── Summary ──`)
  console.log(`Found: ${totalFound} | New: ${totalNew} | Relevant: ${totalRelevant} | Saved: ${totalSaved} | Not relevant: ${totalSkipped}`)
  if (!APPLY) console.log('DRY-RUN — re-run with --apply to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
