/**
 * Second-tier Kobo link resolver: Kobo SITE search via Firecrawl, for the
 * books the Rakuten Product Search API missed.
 *
 * Why: Rakuten's product catalogue for Kobo (mid 37589) excludes most
 * agency-priced Big-5 ebooks — exactly the famous titles (The Hate U
 * Give, Persepolis, Beloved). Kobo's own site search DOES have them, and
 * Rakuten's deeplink wrapper works for any kobo.com URL, so a product URL
 * found via site search is just as monetisable.
 *
 * Requires the `firecrawl` CLI (logged in) — kobo.com blocks plain HTTP
 * clients. One scrape per book: run this for the top of the catalogue,
 * not the full 20k tail (credits).
 *
 * Targets rows where enrich-kobo-links.ts already ran and missed
 * (kobo_checked_at set, kobo_url NULL), ordered by ban count (mv_ban_counts)
 * so the famous books come first. Matching guards are shared with the
 * API script (scripts/lib/kobo-match.ts). A found URL sets kobo_url +
 * fresh kobo_checked_at; a miss refreshes kobo_checked_at (stays sticky).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-kobo-links-site.ts
 *     → dry-run: top 10 missed books
 *   npx tsx --env-file=.env.local scripts/enrich-kobo-links-site.ts --apply --limit=500
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { adminClient } from '../src/lib/supabase'
import { isApply, flagValue, intFlag } from './lib/cli'
import { pickBestMatch, lastName } from './lib/kobo-match'

const APPLY = isApply()
const LIMIT = intFlag('limit', APPLY ? 500 : 10)
const BOOK_IDS = flagValue('book-ids')?.split(',').map(s => parseInt(s, 10)).filter(Number.isFinite)
const KOBO_SEARCH = 'https://www.kobo.com/gb/en/search?query='
const REQUEST_DELAY_MS = 700

const SCRATCH = mkdtempSync(join(tmpdir(), 'kobo-site-'))

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

type Candidate = { name: string; url: string }

// Kobo search results render as `## [Title](https://www.kobo.com/gb/en/ebook/slug?…)`
// in Firecrawl markdown, in result order.
function scrapeSearch(query: string, idx: number): Candidate[] {
  const out = join(SCRATCH, `search-${idx}.md`)
  try {
    execFileSync('firecrawl', [
      'scrape', `${KOBO_SEARCH}${encodeURIComponent(query)}`,
      '--only-main-content', '-o', out,
    ], { stdio: 'pipe', timeout: 60_000 })
  } catch {
    return []
  }
  if (!existsSync(out)) return []
  const md = readFileSync(out, 'utf8')
  const cands: Candidate[] = []
  const seen = new Set<string>()
  const re = /##\s+\[([^\]]+)\]\((https:\/\/www\.kobo\.com\/gb\/en\/ebook\/[a-z0-9-]+)[^)]*\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null) {
    if (!seen.has(m[2])) { seen.add(m[2]); cands.push({ name: m[1], url: m[2] }) }
  }
  return cands
}

type BookRow = {
  id: number
  slug: string
  title: string
  book_authors: { authors: { display_name: string } | null }[] | null
}

async function main() {
  console.log(`\n── enrich-kobo-links-site (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const supabase = adminClient()

  // Ban-count ranking: famous books first. Counted client-side over the
  // bans table (paginated; mv_ban_counts is per-country, not per-book).
  const banCount = new Map<number, number>()
  for (let off = 0; ; off += 1000) {
    const { data, error } = await supabase
      .from('bans').select('book_id').order('id').range(off, off + 999)
    if (error) { console.error('bans error:', error.message); process.exit(1) }
    if (!data?.length) break
    for (const r of data as { book_id: number }[]) {
      banCount.set(r.book_id, (banCount.get(r.book_id) ?? 0) + 1)
    }
    if (data.length < 1000) break
  }

  const books: BookRow[] = []
  let offset = 0
  while (true) {
    let q = supabase
      .from('books')
      .select('id, slug, title, book_authors(authors(display_name))')
      .is('kobo_url', null)
      .not('kobo_checked_at', 'is', null)
      .order('id')
      .range(offset, offset + 999)
    if (BOOK_IDS?.length) q = q.in('id', BOOK_IDS)
    const { data, error } = await q
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    if (!data?.length) break
    books.push(...(data as unknown as BookRow[]))
    if (data.length < 1000 || BOOK_IDS?.length) break
    offset += 1000
  }
  books.sort((a, b) => (banCount.get(b.id) ?? 0) - (banCount.get(a.id) ?? 0))
  const todo = books.slice(0, LIMIT)
  console.log(`Missed books pending: ${books.length}; processing top ${todo.length} by ban count\n`)

  let found = 0, missed = 0, dbErrors = 0

  for (let i = 0; i < todo.length; i++) {
    const b = todo[i]
    const author = b.book_authors?.[0]?.authors?.display_name ?? ''
    const query = author ? `${b.title.split(':')[0]} ${lastName(author)}` : b.title.split(':')[0]
    process.stdout.write(`  [${i + 1}/${todo.length}] ${b.title.slice(0, 45).padEnd(45)} `)

    const cands = scrapeSearch(query, i)
    const match = pickBestMatch(cands, b.title, lastName(author))

    if (match) {
      process.stdout.write(`→ "${match.name.slice(0, 40)}" ${match.url.slice(28)}\n`)
      found++
    } else {
      process.stdout.write(`→ no match (${cands.length} results)\n`)
      missed++
    }

    if (APPLY) {
      const { error } = await supabase.from('books').update({
        kobo_url: match?.url ?? null,
        kobo_checked_at: new Date().toISOString(),
      }).eq('id', b.id)
      if (error) { console.error(`    ✗ DB write failed: ${error.message}`); dbErrors++ }
    }

    if (i < todo.length - 1) await sleep(REQUEST_DELAY_MS)
  }

  console.log(`
── Summary ──────────────────────────────
  product link found : ${found}
  still no match     : ${missed}
  DB errors          : ${dbErrors}
  ${APPLY ? '' : '(dry-run — no rows written)'}
──────────────────────────────────────────`)
}

main().catch(e => { console.error(e); process.exit(1) })
