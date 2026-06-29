/**
 * Guarded restore for descriptions nulled by cleanup-shared-enrichment.ts.
 *
 * Problem: a blanket enrich-descriptions-v2 re-fill trusts OL/GB *by ISBN*,
 * but the upstream record for an ISBN can itself be wrong — e.g. "To Live"
 * (#104) was re-filled with a romanized-pinyin blurb about a different book
 * (Dream of the Red Chamber). The title-match guard never fires on ISBN
 * lookups, so junk slips back in.
 *
 * This script restores ONLY the rows listed in a cleanup backup CSV, and for
 * each candidate it applies the same guard used for title-search matches:
 * the upstream record's *title* must contain every token of our title
 * (titlesMatch) AND author tokens must not actively disagree (authorsAgree).
 * If we can't verify the candidate is about the same book, we leave it NULL —
 * an honest gap beats a confident error.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/restore-cleaned-descriptions.ts                 # dry-run
 *   npx tsx --env-file=.env.local scripts/restore-cleaned-descriptions.ts --apply
 *   npx tsx --env-file=.env.local scripts/restore-cleaned-descriptions.ts --backup=data/cleanup-descriptions-backup-2026-06-29.csv --apply
 */

import { readFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { titlesMatch, authorsAgree } from '../src/lib/enrich/title-match'
import { gbVolumesByIsbn } from '../src/lib/enrich/google-books'

const APPLY = process.argv.includes('--apply')
const backupArg = process.argv.find((a) => a.startsWith('--backup='))
const BACKUP = backupArg ? backupArg.replace('--backup=', '') : 'data/cleanup-descriptions-backup-2026-06-29.csv'

const sb = adminClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function idsFromBackup(path: string): number[] {
  const lines = readFileSync(path, 'utf8').split('\n').slice(1)
  const ids: number[] = []
  for (const l of lines) {
    const m = l.match(/^(\d+),/)
    if (m) ids.push(Number(m[1]))
  }
  return [...new Set(ids)]
}

type Cand = { title: string; authors: string[]; description: string; source_type: string; source_url: string | null }

async function gbCandidate(isbn: string): Promise<Cand | null> {
  try {
    const vols = await gbVolumesByIsbn(isbn)
    const vi = vols[0]?.volumeInfo
    if (!vi?.description || !vi.title) return null
    return {
      title: vi.title + (vi.subtitle ? `: ${vi.subtitle}` : ''),
      authors: vi.authors ?? [],
      description: stripHtml(vi.description),
      source_type: 'google_books',
      source_url: vi.infoLink ?? null,
    }
  } catch {
    return null
  }
}

async function olCandidate(isbn: string): Promise<Cand | null> {
  try {
    const ed = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, {
      headers: { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' },
    })
    if (!ed.ok) return null
    const edition: any = await ed.json()
    const workKey: string | undefined = edition.works?.[0]?.key
    if (!workKey) return null
    await sleep(150)
    const wk = await fetch(`https://openlibrary.org${workKey}.json`, {
      headers: { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' },
    })
    if (!wk.ok) return null
    const work: any = await wk.json()
    const descRaw = typeof work.description === 'string' ? work.description : work.description?.value
    if (!descRaw) return null
    const title: string | undefined = work.title ?? edition.title
    if (!title) return null
    return {
      title,
      authors: [],
      description: stripHtml(descRaw),
      source_type: 'openlibrary',
      source_url: `https://openlibrary.org${workKey}`,
    }
  } catch {
    return null
  }
}

async function main() {
  const ids = idsFromBackup(BACKUP)
  console.log(`── restore-cleaned-descriptions (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  console.log(`Backup: ${BACKUP} → ${ids.length} ids\n`)

  // fetch current state (must still be NULL) + our title/author
  const books: any[] = []
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await sb
      .from('books')
      .select('id, slug, title, isbn13, description_book, book_authors(authors(display_name))')
      .in('id', ids.slice(i, i + 300))
    books.push(...(data ?? []))
  }

  let restored = 0, rejectedTitle = 0, rejectedAuthor = 0, noSource = 0, skippedNonNull = 0, noIsbn = 0
  const restoredRows: string[] = []
  const rejectedRows: string[] = []

  for (const b of books) {
    if (b.description_book) { skippedNonNull++; continue }
    if (!b.isbn13) { noIsbn++; continue }
    const ourAuthor = (b.book_authors ?? []).map((x: any) => x.authors?.display_name).filter(Boolean)[0] ?? ''

    let cand = await gbCandidate(b.isbn13)
    await sleep(120)
    if (!cand) { cand = await olCandidate(b.isbn13); await sleep(120) }
    if (!cand) { noSource++; continue }

    if (!titlesMatch(b.title, cand.title)) {
      rejectedTitle++
      rejectedRows.push(`  ✗ [${b.id}] "${b.title}" — ${cand.source_type} title "${cand.title}" (title mismatch)`)
      continue
    }
    if (cand.authors.length && ourAuthor && !authorsAgree(ourAuthor, cand.authors)) {
      rejectedAuthor++
      rejectedRows.push(`  ✗ [${b.id}] "${b.title}" — ${cand.source_type} authors ${JSON.stringify(cand.authors)} disagree with "${ourAuthor}"`)
      continue
    }

    restored++
    restoredRows.push(`  ✓ [${b.id}] "${b.title}" ← ${cand.source_type} (${cand.description.length}c)`)
    if (APPLY) {
      const { error } = await sb.from('books').update({
        description_book: cand.description,
        description_source_type: cand.source_type,
        description_source_url: cand.source_url,
      }).eq('id', b.id)
      if (error) throw error
    }
  }

  console.log('Restored:'); restoredRows.forEach((r) => console.log(r))
  console.log('\nRejected (guard):'); rejectedRows.forEach((r) => console.log(r))
  console.log('\n── Summary ──')
  console.log(`Restored          : ${restored}`)
  console.log(`Rejected (title)  : ${rejectedTitle}`)
  console.log(`Rejected (author) : ${rejectedAuthor}`)
  console.log(`No source         : ${noSource}`)
  console.log(`No ISBN           : ${noIsbn}`)
  console.log(`Already had desc  : ${skippedNonNull}`)
  if (!APPLY) console.log('\nDRY-RUN — re-run with --apply to write.')
}

main()
