/**
 * Resolve per-book Kobo ebook product URLs via the Rakuten Advertising
 * Product Search API, so "Find on Kobo" links land on the book instead of
 * a search-results page.
 *
 * Env (all in .env.local):
 *   RAKUTEN_CLIENT_ID / RAKUTEN_CLIENT_SECRET — developer-portal API keys
 *   RAKUTEN_SID — the numeric publisher Site ID (token `scope`; top-right
 *                 in the Rakuten publisher dashboard)
 *
 * Auth (Rakuten's non-standard OAuth2): POST https://api.linksynergy.com/token
 * with `Authorization: Bearer base64(client_id:client_secret)` and body
 * `grant_type=client_credentials&scope={SID}`. Access tokens last ~60 min;
 * we refresh proactively.
 *
 * Matching per book (namesake-guarded, like every enrichment here):
 *   1. Search keyword = "{title} {author last name}" against mid=37589
 *      (Kobo). Rakuten ANDs the terms, so results already co-mention both.
 *   2. Accept the first item whose productname passes the title-token
 *      guard (≥60% of our main-title tokens). No match → sticky miss.
 *   3. Store the PLAIN Kobo URL (the murl inside Rakuten's linkurl) in
 *      books.kobo_url; affiliate wrapping happens at render time
 *      (src/lib/kobo.ts getKoboProductUrl) so u1 sub-ids stay per-page.
 *
 * Sticky: every processed row gets kobo_checked_at. Misses stay NULL and
 * are skipped on later runs; re-check after catalogue growth with
 * --stale-before=YYYY-MM-DD (checkpoint-resumable, same pattern as
 * probe-bookshop-isbn.ts).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-kobo-links.ts
 *     → dry-run: 10 books, writes nothing
 *   npx tsx --env-file=.env.local scripts/enrich-kobo-links.ts --apply --limit=200
 *   npx tsx --env-file=.env.local scripts/enrich-kobo-links.ts --apply --stale-before=2026-09-01
 *   npx tsx --env-file=.env.local scripts/enrich-kobo-links.ts --book-ids=9,124 --apply
 *
 * Throttling ~1 req/s. Full first sweep over ~20k books ≈ 6 h — run it in
 * a terminal, it resumes where it stopped.
 */

import { adminClient } from '../src/lib/supabase'
import { isApply, flagValue, intFlag } from './lib/cli'
import { KOBO_RAKUTEN_MID } from '../src/lib/kobo'

const APPLY = isApply()
const LIMIT = intFlag('limit', APPLY ? Infinity : 10)
const STALE_BEFORE = flagValue('stale-before')
const BOOK_IDS = flagValue('book-ids')?.split(',').map(s => parseInt(s, 10)).filter(Number.isFinite)

const REQUEST_DELAY_MS = 1000
const TOKEN_URL = 'https://api.linksynergy.com/token'
const SEARCH_URL = 'https://api.linksynergy.com/productsearch/1.0'

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Auth ──────────────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token
  const cid = process.env.RAKUTEN_CLIENT_ID
  const sec = process.env.RAKUTEN_CLIENT_SECRET
  const sid = process.env.RAKUTEN_SID
  if (!cid || !sec) { console.error('RAKUTEN_CLIENT_ID / RAKUTEN_CLIENT_SECRET missing in .env.local'); process.exit(1) }
  if (!sid) { console.error('RAKUTEN_SID missing in .env.local — the numeric Site ID from the Rakuten publisher dashboard (token scope).'); process.exit(1) }

  const tokenKey = Buffer.from(`${cid}:${sec}`).toString('base64')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: sid }).toString(),
  })
  if (!res.ok) {
    console.error(`Token request failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
    process.exit(1)
  }
  const json = await res.json() as { access_token: string; expires_in?: number }
  cachedToken = {
    token: json.access_token,
    // refresh 5 min before expiry
    expiresAt: Date.now() + ((json.expires_in ?? 3600) - 300) * 1000,
  }
  return cachedToken.token
}

// ── Product search ────────────────────────────────────────────────────────

type SearchItem = { productname: string; linkurl: string; sku: string }

// The API returns XML; the fields we need are flat leaf elements, so a
// scoped regex parse is sufficient (no nesting inside <item>).
function parseItems(xml: string): SearchItem[] {
  const items: SearchItem[] = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1]
    const pick = (tag: string) => {
      const mm = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
      return mm ? mm[1].trim() : ''
    }
    items.push({ productname: decodeXml(pick('productname')), linkurl: decodeXml(pick('linkurl')), sku: pick('sku') })
  }
  return items
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
}

async function searchKobo(keyword: string): Promise<SearchItem[]> {
  const token = await getToken()
  // Punctuation 400s the API ("Slaughterhouse-Five") — search on plain words.
  const cleaned = keyword.replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim()
  const url = `${SEARCH_URL}?${new URLSearchParams({ keyword: cleaned, mid: KOBO_RAKUTEN_MID, max: '20' })}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) { cachedToken = null; return searchKobo(keyword) }
  if (!res.ok) {
    console.error(`    search failed (${res.status}) for "${keyword.slice(0, 60)}"`)
    return []
  }
  return parseItems(await res.text())
}

// Extract the plain Kobo URL from Rakuten's wrapped linkurl (murl param).
// Falls back to the raw linkurl host check so we never store a non-Kobo URL.
function extractKoboUrl(linkurl: string): string | null {
  try {
    const u = new URL(linkurl)
    const murl = u.searchParams.get('murl')
    if (murl) {
      const k = new URL(murl)
      if (k.hostname.endsWith('kobo.com')) return k.origin + k.pathname
    }
    if (u.hostname.endsWith('kobo.com')) return u.origin + u.pathname
  } catch { /* fall through */ }
  return null
}

// ── Matching guard ────────────────────────────────────────────────────────

function tokenList(s: string): string[] {
  const toks = s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  // Leading articles differ freely between editions ("1984" vs "Nineteen…"
  // aside, "The Bluest Eye" vs "Bluest Eye") — strip for comparison.
  while (toks.length > 1 && ['the', 'a', 'an'].includes(toks[0])) toks.shift()
  return toks
}

// Kobo's catalogue is full of study guides, summaries, and essays ABOUT
// famous books ("Summary and Analysis of Brave New World"), and those all
// contain the title tokens — a plain overlap guard matches them (same
// failure mode as the study-guide cover audit). Two stricter rules:
//   1. productname must START with the book's main-title token sequence
//      (modulo leading articles), so "Wasted Talent in The Bluest Eye"
//      and "Summary and Analysis of …" fail.
//   2. study-guide vocabulary anywhere in the productname rejects it —
//      unless the word is part of our own title ("The Lesbiana's Guide
//      to Catholic School").
const STUDY_GUIDE_RE = /summary|analysis|study guide|sparknotes|cliffsnotes|maxnotes|litcharts|shmoop|bookrags|gradesaver|workbook|lesson plan|classroom|questions|teaching|quiz|trivia|essay|critique|critical|companion|sidekick|conversation starters|book review|abridged|adapted|retold|songbook|musical|soundtrack|movie version/i

// Knockoff summaries and reprint mills title themselves "<Title> by
// <Author>"; official publisher editions never put the author inside the
// productname. Reject when " by " introduces the author's name.
function looksLikeByAuthorKnockoff(productName: string, authorLastName: string): boolean {
  if (!authorLastName) return false
  return new RegExp(`\\bby\\s+[a-z.\\s]*${authorLastName}\\b`, 'i').test(productName)
}

function titleGuard(bookTitle: string, productName: string): boolean {
  const title = tokenList(bookTitle.split(':')[0])
  const product = tokenList(productName)
  if (title.length === 0 || product.length < title.length) return false
  for (let i = 0; i < title.length; i++) {
    if (product[i] !== title[i]) return false
  }
  const m = productName.match(STUDY_GUIDE_RE)
  if (m && !bookTitle.toLowerCase().includes(m[0].toLowerCase())) return false
  return true
}

function lastName(display: string): string {
  const parts = display.trim().split(/\s+/)
  return parts[parts.length - 1] ?? ''
}

// ── Main ──────────────────────────────────────────────────────────────────

type BookRow = {
  id: number
  slug: string
  title: string
  book_authors: { authors: { display_name: string } | null }[] | null
}

async function main() {
  const mode = STALE_BEFORE ? `, STALE-BEFORE ${STALE_BEFORE}` : ''
  console.log(`\n── enrich-kobo-links (${APPLY ? 'APPLY' : 'DRY-RUN'}${mode}) ──\n`)

  const supabase = adminClient()
  const books: BookRow[] = []
  let offset = 0
  while (books.length < LIMIT) {
    let q = supabase
      .from('books')
      .select('id, slug, title, book_authors(authors(display_name))')
      .order('id')
      .range(offset, offset + 999)
    if (BOOK_IDS?.length) {
      q = q.in('id', BOOK_IDS)
    } else if (STALE_BEFORE) {
      q = q.or(`kobo_checked_at.is.null,kobo_checked_at.lt.${STALE_BEFORE}`)
    } else {
      q = q.is('kobo_checked_at', null)
    }
    const { data, error } = await q
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    if (!data?.length) break
    books.push(...(data as unknown as BookRow[]))
    if (data.length < 1000 || BOOK_IDS?.length) break
    offset += 1000
  }

  const todo = books.slice(0, Math.min(books.length, LIMIT === Infinity ? books.length : LIMIT))
  console.log(`Books to process: ${todo.length}${books.length > todo.length ? ` (of ${books.length} pending)` : ''}\n`)
  if (todo.length === 0) { console.log('Nothing to do.'); return }

  // Fail fast on auth before the loop.
  await getToken()
  console.log('Rakuten token OK.\n')

  let found = 0, missed = 0, dbErrors = 0

  for (let i = 0; i < todo.length; i++) {
    const b = todo[i]
    const author = b.book_authors?.[0]?.authors?.display_name ?? ''
    const keyword = author ? `${b.title.split(':')[0]} ${lastName(author)}` : b.title.split(':')[0]
    process.stdout.write(`  [${i + 1}/${todo.length}] ${b.title.slice(0, 45).padEnd(45)} `)

    const items = await searchKobo(keyword)
    // Among guard-passing items, the real edition is the one with the
    // FEWEST tokens beyond the title itself — "The Satanic Verses" beats
    // "The Satanic Verses: The Rhetoric of…" (academic works and knockoff
    // guides start with the title too, but always trail a subtitle). Cap
    // the trailing-subtitle length at 3 tokens: beyond that it's near
    // always a work ABOUT the book, and a miss just keeps the (safe)
    // search-link fallback.
    const titleLen = tokenList(b.title.split(':')[0]).length
    const authorLast = lastName(author)
    const match = items
      .filter(it =>
        titleGuard(b.title, it.productname) &&
        !looksLikeByAuthorKnockoff(it.productname, authorLast) &&
        tokenList(it.productname).length - titleLen <= 3,
      )
      .sort((x, y) => tokenList(x.productname).length - tokenList(y.productname).length)[0]
    const koboUrl = match ? extractKoboUrl(match.linkurl) : null

    if (koboUrl) {
      process.stdout.write(`→ "${match!.productname.slice(0, 50)}" ${koboUrl.slice(28, 80)}\n`)
      found++
    } else {
      process.stdout.write(`→ no match (${items.length} results)\n`)
      missed++
    }

    if (APPLY) {
      const { error } = await supabase.from('books').update({
        kobo_url: koboUrl,
        kobo_checked_at: new Date().toISOString(),
      }).eq('id', b.id)
      if (error) { console.error(`    ✗ DB write failed: ${error.message}`); dbErrors++ }
    }

    if (i < todo.length - 1) await sleep(REQUEST_DELAY_MS)
  }

  console.log(`
── Summary ──────────────────────────────
  product link found : ${found}
  no match (sticky)  : ${missed}
  DB errors          : ${dbErrors}
  ${APPLY ? '' : '(dry-run — no rows written)'}
──────────────────────────────────────────`)
}

main().catch(e => { console.error(e); process.exit(1) })
