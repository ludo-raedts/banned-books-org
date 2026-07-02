/**
 * Fix the audio / non-English Bookshop link ISBNs found by
 * audit-bookshop-editions.ts.
 *
 * Root cause: the bookshop_isbn13 cross-reference enrichment accepted ANY
 * edition of the work that resolved on Bookshop's /a/ path — including
 * CD-Audio editions (often out of stock) and foreign-language editions
 * (e.g. Nineteen Minutes → "Diecinueve minutos"). Two rows even carried a
 * different work entirely. This script re-derives a correct edition per
 * flagged book:
 *
 *   1. Load the book's Open Library work editions.
 *   2. Keep English (or language-less), non-audio editions whose title
 *      actually matches ours (≥50% token overlap — guards against junk
 *      editions attached to the OL work).
 *   3. Rank paperback > hardcover > unknown format, newest first, and
 *      HEAD-probe each on bookshop.org/a/{aid}/{isbn} until one resolves.
 *   4. Found  → bookshop_isbn13 = candidate (NULL if it equals the
 *               canonical isbn13), bookshop_status='valid'.
 *      Not found → demote to storefront fallback: NULL the xref (when the
 *               bad ISBN was a cross-ref) and bookshop_status='not_found'.
 *               Never leave a known-audio/foreign deep link standing.
 *
 * Guard: books flagged ONLY non_english whose original_language is not
 * English are skipped — for a genuinely foreign work, a non-English
 * edition can be the correct link.
 *
 * A CSV backup of every row to be touched is written before any write.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/remediate-bookshop-editions.ts
 *     → dry-run over the first 10 findings of today's audit
 *   npx tsx --env-file=.env.local scripts/remediate-bookshop-editions.ts --apply
 *   npx tsx --env-file=.env.local scripts/remediate-bookshop-editions.ts \
 *     --apply --book-ids=124,135,200
 *   Flags: --audit=data/bookshop-edition-audit-YYYY-MM-DD.json  --limit=N
 *
 * Interruption-safe: applied rows get a fresh bookshop_checked_at and drop
 * out of the audit on the next run, so re-running continues where it left
 * off (re-audit → re-remediate).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '../src/lib/supabase'
import { isApply, hasFlag, flagValue, intFlag } from './lib/cli'
import { BOOKSHOP_AFFILIATE_ID } from '../src/lib/bookshop'

const APPLY = isApply()
const LIMIT = intFlag('limit', APPLY ? Infinity : 10)
const BOOK_IDS = flagValue('book-ids')?.split(',').map(s => parseInt(s, 10)).filter(Number.isFinite)
// Bypass the genuinely-foreign guard: for classics with famous English
// translations (Madame Bovary, The Decameron) the English-facing catalogue
// row SHOULD link an English edition. Only honoured with explicit --book-ids
// so a bulk run can never mass-replace correct foreign editions.
const FORCE_ENGLISH = hasFlag('force-english') && Boolean(BOOK_IDS?.length)
const AUDIT_PATH = flagValue('audit')
  ?? join('data', `bookshop-edition-audit-${new Date().toISOString().slice(0, 10)}.json`)

const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const PROBE_DELAY_MS = 1000
const MAX_PROBES_PER_BOOK = 10
const AUDIO_RE = /audio|(^|\s|\[)cd(\s|\]|$)|mp3|cassette|playaway/i
// Never link ebook editions either — the "find this book" default is print.
const EBOOK_RE = /e-?book|kindle|epub|digital/i
// English-market registration groups. OL editions without a languages field
// slipped foreign editions through (a Taiwanese Grapes of Wrath carried the
// English title), so for English works we also require an English-market
// ISBN prefix. 9780/9781 (UK/US publishers) rank above 9798 (US print-on-
// demand) so a real trade edition wins when both resolve.
const ENGLISH_PREFIXES = ['9780', '9781', '9798']

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

type Finding = { id: number; slug: string; title: string; linkIsbn: string; isXref: boolean; flags: string[] }

type BookRow = {
  id: number
  slug: string
  title: string
  isbn13: string | null
  bookshop_isbn13: string | null
  bookshop_status: string | null
  bookshop_checked_at: string | null
  openlibrary_work_id: string | null
  original_language: string | null
}

type OlEdition = {
  title?: string
  physical_format?: string
  languages?: { key: string }[]
  isbn_13?: string[]
  publish_date?: string
}

function normTokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(t => t.length > 2),
  )
}

function titleMatches(bookTitle: string, editionTitle: string | undefined): boolean {
  if (!editionTitle) return false
  // Match on the main title only — subtitles ("Drama: A Graphic Novel")
  // otherwise reject plain-title editions ("Drama").
  const a = normTokens(bookTitle.split(':')[0])
  const b = normTokens(editionTitle)
  if (a.size === 0) return false
  let hit = 0
  for (const t of a) if (b.has(t)) hit++
  return hit / a.size >= 0.5
}

function isEnglishOriginal(lang: string | null): boolean {
  if (!lang) return true // unknown — assume English-market work
  return /^(en|eng|english)$/i.test(lang.trim())
}

const FORMAT_RANK = (f: string | undefined): number => {
  if (!f) return 2
  if (/paperback|soft/i.test(f)) return 0
  if (/hardcover|hardback/i.test(f)) return 1
  return 3
}

function publishYear(e: OlEdition): number {
  const m = e.publish_date?.match(/\d{4}/)
  return m ? parseInt(m[0], 10) : 0
}

async function fetchEditions(workId: string): Promise<OlEdition[]> {
  const editions: OlEdition[] = []
  let offset = 0
  while (offset < 600) {
    const url = `https://openlibrary.org/works/${workId}/editions.json?limit=200&offset=${offset}`
    const res = await fetch(url, { headers: OL_HEADERS })
    if (!res.ok) break
    const json = await res.json() as { entries?: OlEdition[]; size?: number }
    editions.push(...(json.entries ?? []))
    if (!json.entries?.length || editions.length >= (json.size ?? 0)) break
    offset += 200
  }
  return editions
}

async function probeBookshop(isbn13: string): Promise<boolean> {
  const url = `https://bookshop.org/a/${BOOKSHOP_AFFILIATE_ID}/${isbn13}`
  try {
    let res = await fetch(url, { method: 'HEAD', headers: OL_HEADERS, redirect: 'manual' })
    if (res.status === 405) res = await fetch(url, { method: 'GET', headers: OL_HEADERS, redirect: 'manual' })
    return res.status >= 200 && res.status < 400
  } catch {
    return false
  }
}

async function main() {
  console.log(`\n── remediate-bookshop-editions (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const audit = JSON.parse(readFileSync(AUDIT_PATH, 'utf8')) as { findings: Finding[] }
  const seen = new Set<number>()
  let findings = audit.findings.filter(f => !seen.has(f.id) && seen.add(f.id))
  if (BOOK_IDS?.length) findings = findings.filter(f => BOOK_IDS.includes(f.id))
  findings = findings.slice(0, LIMIT)
  console.log(`Findings to process: ${findings.length} (audit: ${AUDIT_PATH})`)

  const supabase = adminClient()
  const { data: rows, error } = await supabase
    .from('books')
    .select('id, slug, title, isbn13, bookshop_isbn13, bookshop_status, bookshop_checked_at, openlibrary_work_id, original_language')
    .in('id', findings.map(f => f.id))
  if (error) { console.error('DB error:', error.message); process.exit(1) }
  const bookById = new Map((rows as BookRow[]).map(b => [b.id, b]))

  // Backup every row we might touch (merge doctrine: backup before writes).
  if (APPLY) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = join('data', `bookshop-edition-remediation-backup-${ts}.csv`)
    const header = 'id,slug,isbn13,bookshop_isbn13,bookshop_status,bookshop_checked_at'
    const lines = findings.map(f => {
      const b = bookById.get(f.id)
      return b ? [b.id, b.slug, b.isbn13 ?? '', b.bookshop_isbn13 ?? '', b.bookshop_status ?? '', b.bookshop_checked_at ?? ''].join(',') : null
    }).filter(Boolean)
    writeFileSync(backupPath, [header, ...lines].join('\n') + '\n')
    console.log(`Backup written: ${backupPath}\n`)
  }

  let fixed = 0, demoted = 0, skippedForeign = 0, errors = 0

  for (let i = 0; i < findings.length; i++) {
    const f = findings[i]
    const book = bookById.get(f.id)
    if (!book) { console.log(`  [${i + 1}] #${f.id} ${f.slug} — row gone, skip`); continue }

    const label = `[${i + 1}/${findings.length}] #${book.id} ${book.title.slice(0, 40)}`

    // Genuinely-foreign guard: a non-English edition can be correct for a
    // non-English work. (Audio is never correct — those always proceed.)
    if (!FORCE_ENGLISH && f.flags.every(fl => fl === 'non_english') && !isEnglishOriginal(book.original_language)) {
      console.log(`  ${label} → SKIP (original_language=${book.original_language}, non-English edition may be correct)`)
      skippedForeign++
      continue
    }

    // Find replacement candidates on the OL work.
    let candidates: { isbn: string; format?: string }[] = []
    if (book.openlibrary_work_id) {
      try {
        const editions = await fetchEditions(book.openlibrary_work_id)
        candidates = editions
          .filter(e => {
            const langs = (e.languages ?? []).map(l => l.key)
            const englishOk = langs.length === 0 || langs.includes('/languages/eng')
            const notAudio = !e.physical_format || !AUDIO_RE.test(e.physical_format)
            const notEbook = !e.physical_format || !EBOOK_RE.test(e.physical_format)
            return englishOk && notAudio && notEbook && e.isbn_13?.length && titleMatches(book.title, e.title)
          })
          .sort((a, b) =>
            FORMAT_RANK(a.physical_format) - FORMAT_RANK(b.physical_format) ||
            publishYear(b) - publishYear(a),
          )
          .flatMap(e => (e.isbn_13 ?? []).map(isbn => ({ isbn: isbn.replace(/-/g, ''), format: e.physical_format })))
          .filter(c =>
            /^97[89]\d{10}$/.test(c.isbn) &&
            c.isbn !== f.linkIsbn &&
            ENGLISH_PREFIXES.some(p => c.isbn.startsWith(p)),
          )
          // Trade publishers (9780/9781) ahead of print-on-demand (9798),
          // format rank already applied above (stable sort keeps it).
          .sort((a, b) =>
            (a.isbn.startsWith('9798') ? 1 : 0) - (b.isbn.startsWith('9798') ? 1 : 0),
          )
      } catch (e) {
        console.log(`  ${label} → OL editions fetch failed: ${(e as Error).message}`)
      }
    }
    // Dedup, cap probes.
    const tried = new Set<string>()
    const shortlist = candidates.filter(c => !tried.has(c.isbn) && tried.add(c.isbn)).slice(0, MAX_PROBES_PER_BOOK)

    let winner: { isbn: string; format?: string } | null = null
    for (const c of shortlist) {
      if (await probeBookshop(c.isbn)) { winner = c; break }
      await sleep(PROBE_DELAY_MS)
    }

    if (winner) {
      const isCanonical = winner.isbn === book.isbn13
      console.log(`  ${label} → FIX ${f.linkIsbn} ⇒ ${winner.isbn} (${winner.format ?? 'format?'}${isCanonical ? ', = canonical' : ''})`)
      if (APPLY) {
        const { error: e2 } = await supabase.from('books').update({
          bookshop_isbn13: isCanonical ? null : winner.isbn,
          bookshop_status: 'valid',
          bookshop_checked_at: new Date().toISOString(),
        }).eq('id', book.id)
        if (e2) { console.error(`    ✗ DB write failed: ${e2.message}`); errors++; continue }
      }
      fixed++
    } else {
      console.log(`  ${label} → DEMOTE to storefront (no valid English print edition found; ${shortlist.length} probed)`)
      if (APPLY) {
        const { error: e2 } = await supabase.from('books').update({
          bookshop_isbn13: null,
          bookshop_status: 'not_found',
          bookshop_checked_at: new Date().toISOString(),
        }).eq('id', book.id)
        if (e2) { console.error(`    ✗ DB write failed: ${e2.message}`); errors++; continue }
      }
      demoted++
    }
    await sleep(PROBE_DELAY_MS)
  }

  console.log(`
── Summary ──────────────────────────────
  fixed (new edition)   : ${fixed}
  demoted to storefront : ${demoted}
  skipped (foreign work): ${skippedForeign}
  DB errors             : ${errors}
  ${APPLY ? '' : '(dry-run — no rows written)'}
──────────────────────────────────────────`)
}

main().catch(e => { console.error(e); process.exit(1) })
