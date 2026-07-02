/**
 * Audit the *edition quality* of every Bookshop.org affiliate link ISBN.
 *
 * probe-bookshop-isbn.ts only verifies that the link ISBN resolves on
 * Bookshop (HTTP-level). It says nothing about WHICH edition that ISBN
 * is. The bookshop_isbn13 cross-reference enrichment picked any edition
 * that resolved, which let two bad classes through (found 2026-07-02 on
 * the storefront lists):
 *
 *   - audio editions (CD-Audio / MP3 CD) — often out of stock, and the
 *     wrong default for a "buy the book" link anyway
 *   - non-English editions (e.g. Nineteen Minutes → "Diecinueve
 *     minutos", A Court of Mist and Fury → "Una corte de niebla y
 *     furia")
 *
 * This script is READ-ONLY. For every book with bookshop_status='valid'
 * it takes the link ISBN (bookshop_isbn13 ?? isbn13, mirroring
 * getBookshopUrl) and looks up the edition's physical_format + language
 * via Open Library's batched books API (50 bibkeys per call). Output:
 *
 *   data/bookshop-edition-audit-{date}.json   — machine-readable flags
 *   data/bookshop-edition-audit-{date}.md     — review list
 *
 * Flags:
 *   audio        — physical_format matches audio/cd/mp3/cassette
 *   non_english  — OL languages present and none is eng
 *   unknown      — ISBN not in OL / no format+language data (informational)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-bookshop-editions.ts
 *   npx tsx --env-file=.env.local scripts/audit-bookshop-editions.ts --xrefs-only
 *     → only rows where bookshop_isbn13 is set (the cross-ref cohort)
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '../src/lib/supabase'

const XREFS_ONLY = process.argv.includes('--xrefs-only')
const BATCH_SIZE = 50
const BATCH_DELAY_MS = 600
const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }

const today = new Date().toISOString().slice(0, 10)
const OUT_JSON = join(process.cwd(), 'data', `bookshop-edition-audit-${today}.json`)
const OUT_MD = join(process.cwd(), 'data', `bookshop-edition-audit-${today}.md`)

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

type BookRow = {
  id: number
  slug: string
  title: string
  isbn13: string | null
  bookshop_isbn13: string | null
}

type OlDetails = {
  title?: string
  physical_format?: string
  languages?: { key: string }[]
}

type Finding = {
  id: number
  slug: string
  title: string
  linkIsbn: string
  isXref: boolean
  flags: string[]
  olTitle: string | null
  olFormat: string | null
  olLanguages: string[]
}

const AUDIO_RE = /audio|(^|\s|\[)cd(\s|\]|$)|mp3|cassette|playaway/i

async function fetchBooks(): Promise<BookRow[]> {
  const supabase = adminClient()
  const rows: BookRow[] = []
  let offset = 0
  while (true) {
    let q = supabase
      .from('books')
      .select('id, slug, title, isbn13, bookshop_isbn13')
      .eq('bookshop_status', 'valid')
      .order('id')
      .range(offset, offset + 999)
    if (XREFS_ONLY) q = q.not('bookshop_isbn13', 'is', null)
    const { data, error } = await q
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    if (!data?.length) break
    rows.push(...(data as BookRow[]))
    if (data.length < 1000) break
    offset += 1000
  }
  return rows
}

async function olBatchLookup(isbns: string[]): Promise<Map<string, OlDetails>> {
  const bibkeys = isbns.map(i => `ISBN:${i}`).join(',')
  const url = `https://openlibrary.org/api/books?bibkeys=${bibkeys}&jscmd=details&format=json`
  const out = new Map<string, OlDetails>()
  try {
    const res = await fetch(url, { headers: OL_HEADERS })
    if (!res.ok) {
      console.error(`  OL batch failed (${res.status}) — treating batch as unknown`)
      return out
    }
    const json = await res.json() as Record<string, { details?: OlDetails }>
    for (const [key, val] of Object.entries(json)) {
      const isbn = key.replace(/^ISBN:/, '')
      if (val?.details) out.set(isbn, val.details)
    }
  } catch (e) {
    console.error(`  OL batch error: ${(e as Error).message} — treating batch as unknown`)
  }
  return out
}

async function main() {
  console.log(`\n── audit-bookshop-editions (${XREFS_ONLY ? 'xrefs only' : 'all valid'}) ──\n`)

  const books = await fetchBooks()
  const linked = books
    .map(b => ({ ...b, linkIsbn: b.bookshop_isbn13 ?? b.isbn13 }))
    .filter((b): b is BookRow & { linkIsbn: string } => b.linkIsbn != null)
  console.log(`Books to audit: ${linked.length}`)

  const findings: Finding[] = []
  let audio = 0, nonEnglish = 0, unknown = 0, clean = 0

  for (let i = 0; i < linked.length; i += BATCH_SIZE) {
    const batch = linked.slice(i, i + BATCH_SIZE)
    const details = await olBatchLookup(batch.map(b => b.linkIsbn))

    for (const b of batch) {
      const d = details.get(b.linkIsbn)
      const flags: string[] = []
      const olFormat = d?.physical_format ?? null
      const olLanguages = (d?.languages ?? []).map(l => l.key.replace('/languages/', ''))

      if (!d) {
        flags.push('unknown')
        unknown++
      } else {
        if (olFormat && AUDIO_RE.test(olFormat)) { flags.push('audio'); audio++ }
        if (olLanguages.length > 0 && !olLanguages.includes('eng')) { flags.push('non_english'); nonEnglish++ }
      }
      if (flags.length === 0) clean++
      if (flags.some(f => f !== 'unknown')) {
        findings.push({
          id: b.id,
          slug: b.slug,
          title: b.title,
          linkIsbn: b.linkIsbn,
          isXref: b.bookshop_isbn13 != null,
          flags,
          olTitle: d?.title ?? null,
          olFormat,
          olLanguages,
        })
      }
    }

    process.stdout.write(`\r  audited ${Math.min(i + BATCH_SIZE, linked.length)}/${linked.length}  (audio ${audio}, non-eng ${nonEnglish}, unknown ${unknown})`)
    if (i + BATCH_SIZE < linked.length) await sleep(BATCH_DELAY_MS)
  }
  console.log('\n')

  findings.sort((a, b) => a.flags.join().localeCompare(b.flags.join()) || a.id - b.id)
  writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), scope: XREFS_ONLY ? 'xrefs' : 'all-valid', total: linked.length, findings }, null, 2))

  const md = `# Bookshop edition audit — ${today}

Scope: ${XREFS_ONLY ? 'cross-ref rows only' : "all bookshop_status='valid'"} (${linked.length} books)

| | count |
|---|---|
| clean | ${clean} |
| audio edition | ${audio} |
| non-English edition | ${nonEnglish} |
| unknown to OL (no flag) | ${unknown} |

## Flagged link ISBNs

| book | link ISBN | xref? | flags | OL says |
|---|---|---|---|---|
${findings.map(f =>
  `| ${f.title.slice(0, 45)} (\`${f.slug}\`) | ${f.linkIsbn} | ${f.isXref ? 'yes' : 'no'} | ${f.flags.join(', ')} | ${(f.olTitle ?? '').slice(0, 40)} · ${f.olFormat ?? '?'} · ${f.olLanguages.join('/') || '?'} |`
).join('\n')}
`
  writeFileSync(OUT_MD, md)

  console.log(`── Summary ──────────────────────────────
  clean        : ${clean}
  audio        : ${audio}
  non-English  : ${nonEnglish}
  unknown (OL) : ${unknown}

  Written: ${OUT_JSON}
           ${OUT_MD}`)
}

main().catch(e => { console.error(e); process.exit(1) })
