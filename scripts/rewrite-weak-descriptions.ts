/**
 * Rewrite weak/wrong Wikipedia-sourced description_ban entries using Claude.
 *
 * Fetches the full Wikipedia article for each book, then asks Claude to
 * synthesise a concise, factual ban description (2-3 sentences, no fluff).
 * If no real ban content can be found, sets description_ban to null.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/rewrite-weak-descriptions.ts        # dry-run
 *   npx tsx --env-file=.env.local scripts/rewrite-weak-descriptions.ts --write
 */

import Anthropic from '@anthropic-ai/sdk'
import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')

// Slugs whose current descriptions are wrong or too weak
const TARGETS = [
  'burned',
  'the-origin-of-species',
  'one-hundred-years-of-solitude',
  'the-trial',
  'mein-kampf',
  'a-farewell-to-arms',
  'married-love',
  'fanny-hill',
  '1984',
  'the-protocols-of-the-elders-of-zion',
  'lady-chatterleys-lover',
]

const anthropic = new Anthropic()

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'banned-books-org/1.0 (educational; contact@banned-books.org)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function cleanPlainText(text: string): string {
  return text
    .replace(/^={2,}[^=]+=+\s*/gm, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\bhttps?:\/\/\S+/g, '')
    .replace(/\^\s*"[^"]*"/g, '')
    .replace(/\^\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function getWikiText(title: string): Promise<string | null> {
  const encoded = encodeURIComponent(title)
  try {
    const data = await fetchJson(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=extracts&explaintext=true&exsectionformat=plain&format=json`
    ) as { query?: { pages?: Record<string, { extract?: string; missing?: string }> } }
    const pages = data.query?.pages ?? {}
    const page = Object.values(pages)[0]
    if (!page || 'missing' in page) return null
    return cleanPlainText(page.extract ?? '')
  } catch {
    return null
  }
}

async function askClaude(bookTitle: string, wikiText: string): Promise<string | null> {
  const truncated = wikiText.slice(0, 12000)

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `You are writing concise, factual descriptions for a website about banned books.

Book: "${bookTitle}"

Below is the Wikipedia article text. Extract ONLY real-world censorship / banning / challenging information about this specific book. Write 2–3 sentences (max 500 characters) that explain:
- Where and when it was banned or challenged
- Why it was banned (the stated reason)

Rules:
- Only use facts from the text below — do not invent anything
- Do NOT mention plot, themes, or literary analysis unless directly tied to a ban reason
- Do NOT mention other books or authors except as direct context for this book's banning
- If the text contains no real-world banning information about this specific book, reply with exactly: NULL
- End with nothing — no "Source:" attribution line, I will add that myself
- Be direct and factual, not promotional

Wikipedia text:
${truncated}`,
    }],
  })

  const raw = (message.content[0] as { type: string; text: string }).text.trim()
  if (raw === 'NULL' || raw.length < 20) return null
  return raw
}

async function main() {
  const s = adminClient()

  // Fetch books + their Wikipedia source URLs
  const { data: books, error } = await s
    .from('books')
    .select('id, title, slug, description_ban, bans(ban_source_links(ban_sources(source_url)))')
    .in('slug', TARGETS)

  if (error) { console.error(error); process.exit(1) }

  for (const book of books ?? []) {
    console.log(`\n=== ${book.title} [${book.slug}] ===`)
    console.log(`Current: ${book.description_ban?.slice(0, 120)}…`)

    // Find a Wikipedia URL from the ban sources
    let wikiTitle: string | null = null
    for (const ban of (book.bans as any[]) ?? []) {
      for (const bsl of ban.ban_source_links ?? []) {
        const url: string = bsl.ban_sources?.source_url ?? ''
        const m = url.match(/wikipedia\.org\/wiki\/(.+)$/)
        if (m) {
          wikiTitle = decodeURIComponent(m[1]).replace(/_/g, ' ')
          break
        }
      }
      if (wikiTitle) break
    }

    // Fall back to book title if no Wikipedia source linked
    if (!wikiTitle) wikiTitle = book.title
    console.log(`  Wiki title: ${wikiTitle}`)

    const wikiText = await getWikiText(wikiTitle)
    if (!wikiText) {
      console.log(`  → No Wikipedia article found, skipping`)
      await sleep(500)
      continue
    }
    console.log(`  Wiki text length: ${wikiText.length} chars`)

    const result = await askClaude(book.title, wikiText)

    if (result === null) {
      console.log(`  → Claude found no ban info → will CLEAR description_ban`)
    } else {
      console.log(`  → New description:\n     ${result}`)
    }

    if (WRITE) {
      const newValue = result ? result + '\n\nSource: Wikipedia' : null
      const { error: upErr } = await s
        .from('books')
        .update({ description_ban: newValue })
        .eq('id', book.id)
      if (upErr) console.error(`  DB error:`, upErr.message)
      else console.log(`  ✓ Written to DB`)
    }

    await sleep(800)
  }

  if (!WRITE) {
    console.log('\n[DRY-RUN] Re-run with --write to apply.')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
