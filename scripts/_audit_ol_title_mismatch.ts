#!/usr/bin/env tsx
/**
 * READ-ONLY audit for "wrong unique OpenLibrary work" contamination.
 *
 * Sibling to scripts/_audit_shared_enrichment.ts — but that script only catches
 * contamination SHARED across multiple books (grouped by identical cover_url /
 * description_book). This one catches the case where a single book's
 * openlibrary_work_id points to a DIFFERENT real work and no other book in the
 * DB happens to share it, so the shared-enrichment grouping misses it.
 *
 * Example: "More Joy of Sex" (id 1029) was linked to work OL2736537W =
 * "Banned in the U.S.A." — a reference book ABOUT banned books — so its
 * cover, isbn13 and description_book were all that other work's. The title-
 * search fallback picked a "popular hit" whose title shares nothing with ours.
 *
 * Method (two tiers, to suppress the dominant false-positive class):
 *  1. For every book with an openlibrary_work_id, fetch the OL work title and
 *     compare significant tokens against the book title. ZERO shared tokens =
 *     raw suspect. (We do NOT use titlesMatch(): it over-flags when our title
 *     is merely longer, e.g. "Emile, or On Education" vs "Emile".)
 *  2. Most raw suspects are translations whose OL title is the original-language
 *     title (Three Trapped Tigers / "Tres tristes tigres", No Longer Human /
 *     "人間失格"). So for each raw suspect we ALSO fetch the OL work's author and
 *     compare to our book's author:
 *       - author MATCHES  → same work, different-language title → LIKELY_TRANSLATION
 *       - author DIFFERS  → genuinely a different book          → CONFIRMED
 *       - author unknown  → UNVERIFIED
 *
 * Writes nothing to the DB. Output: data/ol-title-mismatch-audit.md
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/_audit_ol_title_mismatch.ts
 *   node --env-file=.env.local --import tsx scripts/_audit_ol_title_mismatch.ts --sample=300 --concurrency=12
 *
 * Flags:
 *   --sample=N        check a random N-book sample (estimate the rate cheaply
 *                     when OpenLibrary is rate-limiting). Default: all books.
 *   --concurrency=N   parallel OL fetches (default 8).
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const t = l.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

import { adminClient } from '../src/lib/supabase'
import { titleTokens } from '../src/lib/enrich/title-match'

const OUT_MD = join(process.cwd(), 'data', 'ol-title-mismatch-audit.md')
const UA = 'banned-books.org-audit-bot (ludo.raedts@voys.nl)'

function argVal(name: string): string | null {
  const hit = process.argv.slice(2).find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}
const CONCURRENCY = Number(argVal('concurrency') ?? '8')
const SAMPLE = argVal('sample') ? Number(argVal('sample')) : null

type Book = {
  id: number
  title: string
  slug: string
  openlibrary_work_id: string
  cover_url: string | null
  description_book: string | null
  description_source_type: string | null
  is_blanket_works: boolean
  author: string | null
}

async function fetchAll(): Promise<Book[]> {
  const db = adminClient()
  const rows: Book[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('books')
      .select(
        'id,title,slug,openlibrary_work_id,cover_url,description_book,description_source_type,is_blanket_works,book_authors(role,authors(display_name))',
      )
      .not('openlibrary_work_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    for (const b of data as any[]) {
      const ba = b.book_authors ?? []
      const author =
        ba.find((x: any) => x.role === 'author')?.authors?.display_name ||
        ba[0]?.authors?.display_name ||
        null
      rows.push({ ...b, author })
    }
    if (data.length < PAGE) break
  }
  return rows
}

/** Fetch JSON from OL with retry/backoff (OL aggressively rate-limits). */
async function olJson(url: string): Promise<any | null | 'ERR'> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } })
      if (r.status === 404) return null
      if (r.status === 429 || r.status >= 500) {
        await new Promise(res => setTimeout(res, 800 * (attempt + 1)))
        continue
      }
      if (!r.ok) return 'ERR'
      return await r.json()
    } catch {
      await new Promise(res => setTimeout(res, 500 * (attempt + 1)))
    }
  }
  return 'ERR'
}

const authorCache = new Map<string, string>()
async function olAuthorNames(workJson: any): Promise<string[]> {
  const keys: string[] = (workJson?.authors ?? [])
    .map((a: any) => a?.author?.key)
    .filter(Boolean)
  const names: string[] = []
  for (const key of keys) {
    if (authorCache.has(key)) {
      names.push(authorCache.get(key)!)
      continue
    }
    const j = await olJson(`https://openlibrary.org${key}.json`)
    const name = j && j !== 'ERR' ? (j.name ?? '') : ''
    if (name) authorCache.set(key, name)
    if (name) names.push(name)
  }
  return names
}

function nameTokens(s: string): Set<string> {
  return new Set(
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter(t => t.length >= 3),
  )
}
/** True if the two author strings share a significant name token. */
function authorsOverlap(a: string, b: string): boolean {
  const ta = nameTokens(a)
  const tb = nameTokens(b)
  for (const t of ta) if (tb.has(t)) return true
  return false
}

/**
 * True when the string is predominantly non-Latin script (Cyrillic, Arabic,
 * CJK, etc.). A non-Latin OL work title for a Latin-titled book is
 * overwhelmingly the original-language title of a translation, not a wrong
 * match — and cross-script author names (Гроссман, Nafzāwī) defeat token
 * comparison, so we classify on the title script directly.
 */
function isMostlyNonLatin(s: string): boolean {
  const letters = s.match(/\p{L}/gu) ?? []
  if (letters.length === 0) return false
  const latin = s.match(/\p{Script=Latin}/gu) ?? []
  return latin.length / letters.length < 0.5
}

function sharedTitleTokens(a: string, b: string): number {
  const ta = titleTokens(a)
  const tb = titleTokens(b)
  let n = 0
  for (const t of ta) if (tb.has(t)) n++
  return n
}

async function main() {
  let books = (await fetchAll()).filter(b => !b.is_blanket_works)
  const population = books.length
  console.log(`books with openlibrary_work_id (excl. blanket): ${population}`)
  if (SAMPLE && SAMPLE < books.length) {
    for (let i = 0; i < SAMPLE; i++) {
      const j = i + Math.floor(Math.random() * (books.length - i))
      ;[books[i], books[j]] = [books[j], books[i]]
    }
    books = books.slice(0, SAMPLE)
    console.log(`random sample: ${books.length}`)
  }

  // ── Pass 1: fetch work title (+ keep json for author lookup) per book ──
  type Raw = Book & { ol_title: string; ol_json: any }
  const rawSuspects: Raw[] = []
  let checked = 0
  let errors = 0
  let unverifiable = 0

  let idx = 0
  async function worker() {
    while (idx < books.length) {
      const b = books[idx++]
      if (titleTokens(b.title).size === 0) {
        unverifiable++
        continue
      }
      const j = await olJson(`https://openlibrary.org/works/${b.openlibrary_work_id}.json`)
      checked++
      if (checked % 250 === 0)
        process.stdout.write(`\r  pass1 ${checked}/${books.length} (${rawSuspects.length} raw suspect)   `)
      if (j === 'ERR') {
        errors++
        continue
      }
      if (j === null) continue
      const olTitle = j.title ?? ''
      if (!olTitle) continue
      if (sharedTitleTokens(b.title, olTitle) === 0) {
        rawSuspects.push({ ...b, ol_title: olTitle, ol_json: j })
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  process.stdout.write('\n')
  console.log(`raw suspects (zero shared title token): ${rawSuspects.length}`)

  // ── Pass 2: author corroboration on raw suspects only ──
  type Classified = Raw & { ol_authors: string[]; verdict: 'CONFIRMED' | 'LIKELY_TRANSLATION' | 'UNVERIFIED' }
  const classified: Classified[] = []
  let done = 0
  let i2 = 0
  async function worker2() {
    while (i2 < rawSuspects.length) {
      const s = rawSuspects[i2++]
      const olAuthors = await olAuthorNames(s.ol_json)
      done++
      if (done % 50 === 0) process.stdout.write(`\r  pass2 ${done}/${rawSuspects.length}   `)
      let verdict: Classified['verdict']
      if (isMostlyNonLatin(s.ol_title)) verdict = 'LIKELY_TRANSLATION' // foreign-script original title
      else if (!s.author || olAuthors.length === 0) verdict = 'UNVERIFIED'
      else if (olAuthors.some(oa => authorsOverlap(s.author!, oa))) verdict = 'LIKELY_TRANSLATION'
      else verdict = 'CONFIRMED'
      classified.push({ ...s, ol_authors: olAuthors, verdict })
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, 6) }, () => worker2()))
  process.stdout.write('\n')

  classified.sort((a, b) => a.id - b.id)
  const confirmed = classified.filter(c => c.verdict === 'CONFIRMED')
  const translations = classified.filter(c => c.verdict === 'LIKELY_TRANSLATION')
  const unverified = classified.filter(c => c.verdict === 'UNVERIFIED')

  const md: string[] = []
  md.push('# OpenLibrary title-mismatch audit')
  md.push('')
  md.push(`Generated ${new Date().toISOString()}.`)
  md.push(`Population (books with openlibrary_work_id, excl. blanket-works): **${population}**`)
  if (SAMPLE) md.push(`Mode: **random sample** of ${books.length}.`)
  md.push(`Checked against OpenLibrary: **${checked}** · fetch errors: ${errors} · unverifiable book titles: ${unverifiable}`)
  md.push(`Raw suspects (zero shared title token): **${rawSuspects.length}**`)
  const rate = checked > 0 ? confirmed.length / checked : 0
  md.push(
    `Author-corroborated CONFIRMED: **${confirmed.length}** · likely-translation: ${translations.length} · unverified: ${unverified.length}`,
  )
  md.push(
    `Confirmed rate among checked: **${(rate * 100).toFixed(2)}%**` +
      (SAMPLE ? ` → extrapolated ≈ **${Math.round(rate * population)}** of ${population}` : ''),
  )
  md.push('')

  const table = (rows: Classified[]) => {
    md.push('| id | our title | our author | linked OL work | OL author | desc src | /books/ |')
    md.push('|---|---|---|---|---|---|---|')
    for (const c of rows) {
      md.push(
        `| ${c.id} | ${c.title} | ${c.author ?? '—'} | ${c.ol_title} | ${c.ol_authors.join('; ') || '—'} | ${c.description_source_type ?? '—'} | /books/${c.slug} |`,
      )
    }
    md.push('')
  }

  md.push(`## CONFIRMED — different title AND different author (${confirmed.length})`)
  md.push('')
  md.push('Linked to a genuinely different book; cover_url / isbn13 / description_book are likely wrong. Prime remediation targets.')
  md.push('')
  table(confirmed)

  md.push(`## UNVERIFIED — title differs, author could not be compared (${unverified.length})`)
  md.push('')
  table(unverified)

  md.push(`## LIKELY_TRANSLATION — different title but SAME author = same work, different-language title (${translations.length})`)
  md.push('')
  md.push('Almost certainly fine (original/translated title). Listed for completeness.')
  md.push('')
  table(translations)

  writeFileSync(OUT_MD, md.join('\n'))
  console.log(`\nCONFIRMED: ${confirmed.length} · UNVERIFIED: ${unverified.length} · LIKELY_TRANSLATION: ${translations.length}`)
  console.log(`wrote ${OUT_MD}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
