/**
 * READ-ONLY follow-up to the "poisoned guard" incident: did any LLM-grounded
 * description get synthesised partly FROM a wrong OpenLibrary-search source?
 *
 * In enrichOne, OpenLibrary is collected via at most one path (ISBN → work_id →
 * search). ISBN/work-id bindings are trusted, so the ONLY way a wrong OL text
 * could have fed an LLM synthesis is the free-text search path, which only runs
 * when the book has neither isbn13 nor openlibrary_work_id. So the entire
 * contamination universe is the search-only llm_grounded_* rows. For each, we
 * re-run olSearch and report whether the OL work it returns now fails the strict
 * (corrected) guard — i.e. the synthesis was likely built on a wrong-book blurb.
 *
 * Writes nothing. Usage:
 *   npx tsx --env-file=.env.local scripts/_audit_llm_ol_contamination.ts
 */

import { adminClient } from '../src/lib/supabase'
import { sourceMatches } from '../src/lib/enrich/descriptions-v2'

const UA = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function stripAuthorPrefix(t: string): string { const i = t.indexOf(' — '); return i > 0 ? t.slice(i + 3).trim() : t }
function stripTrailingParen(t: string): string { return t.replace(/\s*\([^)]*\)\s*$/g, '').trim() }

function extractOlDesc(json: Record<string, unknown>): string | null {
  const raw = json.description
  if (!raw) return null
  if (typeof raw === 'string') return raw.trim() || null
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    const v = (raw as { value: unknown }).value
    return typeof v === 'string' ? v.trim() || null : null
  }
  return null
}

async function olSearchRaw(title: string, author: string): Promise<{ workId: string; text: string } | null> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key&limit=1`, { headers: UA })
    if (!res.ok) return null
    const json = await res.json() as { docs: Array<{ key?: string }> }
    const workId = json.docs?.[0]?.key?.replace('/works/', '')
    if (!workId) return null
    await sleep(600)
    const wr = await fetch(`https://openlibrary.org/works/${workId}.json`, { headers: UA })
    if (!wr.ok) return null
    const text = extractOlDesc(await wr.json() as Record<string, unknown>)
    if (!text || text.length < 80) return null
    return { workId, text }
  } catch { return null }
}

async function main() {
  const sb = adminClient()
  const { data } = await sb.from('books')
    .select('id,slug,title,description_book,description_source_type,description_source_url,ai_drafted,book_authors(authors(display_name))')
    .in('description_source_type', ['llm_grounded_multi', 'llm_grounded_single'])
    .is('isbn13', null).is('openlibrary_work_id', null)
    .order('id', { ascending: true })
  const rows = (data as any[]) ?? []
  console.log(`Search-only llm_grounded rows to inspect: ${rows.length}\n`)

  for (const r of rows) {
    const author = r.book_authors?.[0]?.authors?.display_name ?? ''
    const titleClean = stripTrailingParen(stripAuthorPrefix(r.title))
    const ol = await olSearchRaw(titleClean, author)
    await sleep(600)
    const olVerdict = ol
      ? (sourceMatches(ol.text, r.title, author) ? 'OL-search matches (legit)' : `OL-search MISMATCH → /works/${ol.workId}`)
      : 'OL-search returns nothing now'
    console.log(`#${r.id} [${r.description_source_type}] "${r.title}" — ${author || '(no author)'}`)
    console.log(`  url: ${r.description_source_url}`)
    console.log(`  re-olSearch: ${olVerdict}`)
    if (ol && !sourceMatches(ol.text, r.title, author)) {
      console.log(`    OL text now: ${ol.text.replace(/\s+/g, ' ').slice(0, 120)}`)
    }
    console.log(`  STORED desc: ${(r.description_book ?? '').replace(/\s+/g, ' ').slice(0, 200)}`)
    console.log()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
