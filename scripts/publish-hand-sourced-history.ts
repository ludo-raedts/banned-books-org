/**
 * Publish hand-researched, source-verified censorship histories.
 * Input JSON: [{ slug, text, sources: [{ url, title, quote }], note? }]  (e.g. data/top100-check/hand/entries.json)
 * Gates (mechanical, same spirit as verify-censorship-context.ts):
 *   - every quote must occur LITERALLY (whitespace/quote-mark/case normalised) on the page we fetch ourselves;
 *   - every number in the text must occur in the quotes; every capitalised name in the text must occur in the quotes
 *     or in the book title/author;
 *   - the book must not already be source_verified / narrative_curated.
 * Writes like verify-censorship-context.ts --apply (old text → censorship_context_unsourced).
 * Dry-run default; --apply writes.  node: scripts/publish-hand-sourced-history.ts --file=<json>
 */
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'
import { promises as fs } from 'node:fs'

const APPLY = isApply()
const EXTEND = process.argv.includes('--extend') // extend an existing source_verified text: new quotes are added to the old sources
const FILE = (process.argv.find(a => a.startsWith('--file=')) ?? '--file=data/top100-check/hand/entries.json').slice(7)
type Src = { url: string; title?: string; quote: string }
type Entry = { slug: string; text: string; sources: Src[]; note?: string }
const norm = (s: string) => s.toLowerCase().replace(/[‘’‚‛'`´]/g, "'").replace(/[“”„"]/g, '"').replace(/[–—−]/g, '-').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim()
const strip = (h: string) => h.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&[a-z]+;/g, ' ')
async function page(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; banned-books-org verifier)' }, redirect: 'follow', signal: AbortSignal.timeout(30000) })
    if (!r.ok) return null
    const t = await r.text()
    return norm(strip(t))
  } catch { return null }
}
async function main() {
  console.log(APPLY ? 'APPLY' : 'DRY-RUN', FILE)
  const entries: Entry[] = JSON.parse(await fs.readFile(FILE, 'utf8'))
  const db = adminClient(); const cache = new Map<string, string | null>()
  let ok = 0
  for (const e of entries) {
    const why: string[] = []
    const book = (await db.from('books').select('id,title,censorship_context,censorship_context_status,censorship_context_sources,book_authors(authors(display_name))').eq('slug', e.slug).single()).data as any
    if (!book) { console.log('✗', e.slug, 'no such book'); continue }
    if (EXTEND ? book.censorship_context_status !== 'source_verified' : ['source_verified', 'narrative_curated'].includes(book.censorship_context_status ?? '')) { console.log('·', e.slug, EXTEND ? 'not source_verified' : 'already', book.censorship_context_status); continue }
    if (!e.sources?.length) why.push('no sources')
    if (EXTEND && book.censorship_context) for (const y of new Set(book.censorship_context.match(/\b(1[0-9]{3}|20[0-9]{2})\b/g) ?? [])) if (!e.text.includes(y)) why.push(`year ${y} of the existing text lost`)
    for (const s of e.sources ?? []) {
      if (!cache.has(s.url)) cache.set(s.url, await page(s.url))
      const p = cache.get(s.url)
      if (p == null) { why.push(`cannot fetch ${s.url}`); continue }
      if (!p.includes(norm(s.quote))) why.push(`quote not literally on page: ${s.url} :: ${s.quote.slice(0, 60)}`)
    }
    const oldSrc: Src[] = EXTEND ? (book.censorship_context_sources ?? []) : []
    const quotes = norm([...(e.sources ?? []), ...oldSrc].map(s => s.quote).join(' ') + (EXTEND ? ' ' + (book.censorship_context ?? '') : ''))
    const known = norm(`${book.title} ${book.book_authors?.map((a: any) => a.authors?.display_name).join(' ')}`)
    for (const n of e.text.match(/\b\d{3,4}\b/g) ?? []) if (!quotes.includes(n)) why.push(`number ${n} not in quotes`)
    const SKIP = new Set(['In', 'On', 'The', 'A', 'An', 'It', 'Its', 'He', 'She', 'They', 'After', 'Before', 'When', 'While', 'By', 'For', 'Of', 'At', 'To', 'As', 'From', 'That', 'This', 'These', 'Those', 'Copies', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'])
    for (const w of new Set(e.text.match(/\b[A-Z][\p{L}'’-]{2,}\b/gu) ?? [])) if (!SKIP.has(w) && !norm(quotes).includes(norm(w)) && !known.includes(norm(w))) why.push(`name "${w}" not in quotes`)
    if (why.length) { console.log('✗', e.slug, why.slice(0, 4).join(' | ')); continue }
    ok++; console.log('✓', e.slug, '—', e.text.slice(0, 110))
    if (!APPLY) continue
    const ts = new Date().toISOString()
    const r = await db.from('books').update({
      censorship_context: e.text, censorship_context_unsourced: EXTEND ? undefined : (book.censorship_context || null),
      censorship_context_sources: [...oldSrc, ...e.sources.map(s => ({ url: s.url, title: s.title ?? null, quote: s.quote }))],
      censorship_context_status: 'source_verified', censorship_context_checked_at: ts,
      censorship_context_check_note: (`hand-sourced ${ts.slice(0, 10)}${e.note ? ': ' + e.note : ''}`).slice(0, 1000),
    }).eq('id', book.id)
    if (r.error) throw r.error
  }
  console.log(ok, 'of', entries.length, APPLY ? 'published' : 'would publish')
}
main().catch(e => { console.error(e); process.exit(1) })
