/**
 * Enrich book descriptions in two passes:
 *
 *   Part A — Fix truncated descriptions (ends without sentence-final punctuation)
 *             Source: Open Library works API → Google Books
 *
 *   Part B — Fill completely missing descriptions (description_book IS NULL)
 *             Source: OL search → Google Books → GPT-4o-mini fallback
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions.ts
 *     → dry-run: shows counts and up to 3 samples, no writes
 *   npx tsx --env-file=.env.local scripts/enrich-descriptions.ts --apply
 *     → writes to description_book; sets ai_drafted=true when GPT is used
 */

import OpenAI from 'openai'
import { franc } from 'franc-min'
import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const OL_DELAY_MS = 600

const SENTENCE_FINAL = new Set(['.', '?', '!', '"', '’', '”'])

function isTruncated(desc: string): boolean {
  return !SENTENCE_FINAL.has(desc.trimEnd().slice(-1))
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Text cleaning ─────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/__(.+?)__/gs, '$1')
    .replace(/_(.+?)_/gs, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\r\n/g, '\n')
    .trim()
}

function stripLeadingEndorsements(text: string): string {
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line === '') { i++; continue }
    if (/^["'"']/.test(line) || /^[–—\-]/.test(line) || /["'"']\s*[–—\-]/.test(line)) {
      i++; continue
    }
    break
  }
  return lines.slice(i).join('\n').trim()
}

function clean(raw: string): string {
  return stripMarkdown(stripLeadingEndorsements(raw))
}

function isEnglish(text: string): boolean {
  if (text.length < 20) return true
  const lang = franc(text)
  return lang === 'eng' || lang === 'und'
}

// ── Data sources ──────────────────────────────────────────────────────────────

function extractOlDescription(json: Record<string, unknown>): string | null {
  const raw = json.description
  if (!raw) return null
  if (typeof raw === 'string') return raw.trim() || null
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    const v = (raw as { value: unknown }).value
    return typeof v === 'string' ? v.trim() || null : null
  }
  return null
}

async function fetchOlWorks(workId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org/works/${workId}.json`, {
      headers: { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' },
    })
    if (!res.ok) return null
    return extractOlDescription(await res.json() as Record<string, unknown>)
  } catch { return null }
}

async function searchOl(title: string, author: string): Promise<{ workId: string | null; desc: string | null }> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${q}&fields=key,cover_i&limit=1`,
      { headers: { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' } }
    )
    if (!res.ok) return { workId: null, desc: null }
    const json = await res.json() as { docs: Array<{ key?: string }> }
    const workId = json.docs?.[0]?.key?.replace('/works/', '') ?? null
    if (!workId) return { workId: null, desc: null }
    await sleep(OL_DELAY_MS)
    const desc = await fetchOlWorks(workId)
    return { workId, desc }
  } catch { return { workId: null, desc: null } }
}

async function fetchGoogleBooks(title: string, author: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`intitle:${title}${author ? ` inauthor:${author}` : ''}`)
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`)
    if (!res.ok) return null
    const json = await res.json() as { items?: Array<{ volumeInfo: { description?: string } }> }
    const desc = json.items?.[0]?.volumeInfo?.description
    return (desc && desc.length >= 80) ? desc : null
  } catch { return null }
}

async function generateWithGPT(
  client: OpenAI,
  title: string,
  author: string,
): Promise<string | null> {
  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Write a 2–3 sentence description of the book "${title}"${author ? ` by ${author}` : ''}. Summarise the plot, themes, and why it's significant. Output only the description text, nothing else.`,
      }],
    })
    return res.choices[0]?.message?.content?.trim() ?? null
  } catch { return null }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type BookRow = {
  id: number
  slug: string
  title: string
  description: string | null
  description_book: string | null
  openlibrary_work_id: string | null
  book_authors: Array<{ authors: { display_name: string } | null }>
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── enrich-descriptions (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const supabase = adminClient()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const { data, error } = await supabase
    .from('books')
    .select('id, slug, title, description, description_book, openlibrary_work_id, book_authors(authors(display_name))')
    .order('title')
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  const all = (data ?? []) as unknown as BookRow[]

  // Only repair truncated descriptions that don't already have description_book set
  const truncated = all.filter(b => b.description && isTruncated(b.description) && !b.description_book)
  const missing   = all.filter(b => !b.description_book && !b.description)

  console.log(`Part A — truncated descriptions to repair : ${truncated.length}`)
  console.log(`Part B — missing descriptions to fill     : ${missing.length}`)
  console.log()

  // ── Part A ────────────────────────────────────────────────────────────────

  if (truncated.length > 0) {
    const limitA = APPLY ? truncated.length : Math.min(3, truncated.length)
    console.log(`Part A — ${APPLY ? `repairing ${truncated.length}` : `dry-run, showing ${limitA}`}:\n`)
    let updatedA = 0, skippedA = 0

    for (let i = 0; i < limitA; i++) {
      const book = truncated[i]
      const author = book.book_authors?.[0]?.authors?.display_name ?? ''
      process.stdout.write(`  [${i + 1}/${limitA}] ${book.title.slice(0, 50)} `)

      let proposed: string | null = null

      if (book.openlibrary_work_id) {
        const raw = await fetchOlWorks(book.openlibrary_work_id)
        await sleep(OL_DELAY_MS)
        if (raw) {
          const c = clean(raw)
          if (isEnglish(c) && c.length >= 80) proposed = c
        }
      }
      if (!proposed) {
        const { desc } = await searchOl(book.title, author)
        await sleep(OL_DELAY_MS)
        if (desc) {
          const c = clean(desc)
          if (isEnglish(c) && c.length >= 80) proposed = c
        }
      }
      if (!proposed) {
        const gb = await fetchGoogleBooks(book.title, author)
        await sleep(OL_DELAY_MS)
        if (gb) {
          const c = clean(gb)
          if (isEnglish(c) && c.length >= 80) proposed = c
        }
      }

      if (!proposed) { console.log('— no source'); skippedA++; continue }

      if (!APPLY) {
        console.log(`— ok (${proposed.length} chars)`)
        console.log(`    "${proposed.slice(0, 100)}…"`)
      } else {
        const { error: ue } = await supabase.from('books')
          .update({ description_book: proposed, ai_drafted: false })
          .eq('id', book.id)
        if (ue) { console.log(`— DB error: ${ue.message}`); skippedA++ }
        else { console.log(`✓ ${proposed.length} chars`); updatedA++ }
      }
    }
    if (APPLY) console.log(`\n  Part A: updated=${updatedA} skipped=${skippedA}\n`)
    else console.log()
  }

  // ── Part B ────────────────────────────────────────────────────────────────

  if (missing.length > 0) {
    const limitB = APPLY ? missing.length : Math.min(3, missing.length)
    console.log(`Part B — ${APPLY ? `filling ${missing.length}` : `dry-run, showing ${limitB}`}:\n`)
    let updatedB_ol = 0, updatedB_gb = 0, updatedB_gpt = 0, skippedB = 0

    for (let i = 0; i < limitB; i++) {
      const book = missing[i]
      const author = book.book_authors?.[0]?.authors?.display_name ?? ''
      process.stdout.write(`  [${i + 1}/${limitB}] ${book.title.slice(0, 50)} `)

      let proposed: string | null = null
      let source = ''

      // 1. Try OL search
      const { desc: olDesc } = await searchOl(book.title, author)
      await sleep(OL_DELAY_MS)
      if (olDesc) {
        const c = clean(olDesc)
        if (isEnglish(c) && c.length >= 80) { proposed = c; source = 'OL' }
      }

      // 2. Google Books
      if (!proposed) {
        const gb = await fetchGoogleBooks(book.title, author)
        await sleep(OL_DELAY_MS)
        if (gb) {
          const c = clean(gb)
          if (isEnglish(c) && c.length >= 80) { proposed = c; source = 'GB' }
        }
      }

      // 3. GPT fallback
      if (!proposed && process.env.OPENAI_API_KEY) {
        proposed = await generateWithGPT(openai, book.title, author)
        if (proposed) source = 'GPT'
      }

      if (!proposed) { console.log('— no source'); skippedB++; continue }

      if (!APPLY) {
        console.log(`— ${source} (${proposed.length} chars)`)
        console.log(`    "${proposed.slice(0, 100)}…"`)
      } else {
        const aiDrafted = source === 'GPT'
        const { error: ue } = await supabase.from('books')
          .update({ description_book: proposed, ai_drafted: aiDrafted })
          .eq('id', book.id)
        if (ue) { console.log(`— DB error: ${ue.message}`); skippedB++ }
        else {
          console.log(`✓ ${source} (${proposed.length} chars)`)
          if (source === 'OL') updatedB_ol++
          else if (source === 'GB') updatedB_gb++
          else updatedB_gpt++
        }
      }
    }
    if (APPLY) {
      console.log(`\n  Part B: OL=${updatedB_ol} Google=${updatedB_gb} GPT=${updatedB_gpt} skipped=${skippedB}`)
    }
  }

  console.log(`\n── Done ──`)
  if (!APPLY) console.log('Re-run with --apply to write all changes.\n')
}

main().catch(e => { console.error(e); process.exit(1) })
