/**
 * Remediation for the "poisoned guard" OpenLibrary contamination (root cause
 * fixed in src/lib/enrich/descriptions-v2.ts on 2026-06-04).
 *
 * A stored openlibrary-sourced description is treated as CONTAMINATED — i.e.
 * the fixed pipeline would never have written it — when the corrected
 * (un-poisoned) guard rejects it AND there is positive evidence it is the wrong
 * book:
 *   - binding == search  (no isbn13, no openlibrary_work_id): the work was
 *     picked purely by OpenLibrary's free-text top hit, so a guard failure
 *     means the most-popular namesake's blurb was pasted on, OR
 *   - the identical blurb is also held by ≥1 other book whose title is
 *     mutually inconsistent (one blurb spread across unrelated titles).
 *
 * This deliberately SPARES correct-but-surname-less synopses that are vouched
 * for by a real ISBN/work-id binding (e.g. "The Outsiders" whose blurb never
 * says "Hinton"), and the true owner of each shared blurb.
 *
 * Action per contaminated row: clear description_book + provenance, set
 * data_quality_status='flagged' so the fixed pipeline re-enriches it (with no
 * verified source it will correctly stay empty rather than wrong).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/remediate-ol-contamination.ts
 *     → DRY-RUN: counts + data/ol-contamination-remediation.csv preview
 *   npx tsx --env-file=.env.local scripts/remediate-ol-contamination.ts --apply
 *     → backs up originals to data/ol-contamination-backup-<ts>.csv, then nulls+flags
 */

import { adminClient } from '../src/lib/supabase'
import { sourceMatches } from '../src/lib/enrich/descriptions-v2'
import { titlesMatch, titleTokens } from '../src/lib/enrich/title-match'
import { writeFileSync, appendFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')

type Row = {
  id: number
  slug: string
  title: string
  isbn13: string | null
  openlibrary_work_id: string | null
  description_book: string | null
  description_source_type: string | null
  description_source_url: string | null
  book_authors: Array<{ authors: { display_name: string } | null }>
}

const csvEscape = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function fetchAllBooks(): Promise<{ id: number; title: string; desc: string | null }[]> {
  const db = adminClient()
  const rows: { id: number; title: string; desc: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('books').select('id,title,description_book')
      .order('id', { ascending: true }).range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data.map((d: any) => ({ id: d.id, title: d.title, desc: d.description_book })))
    if (data.length < 1000) break
  }
  return rows
}

async function fetchOlRows(): Promise<Row[]> {
  const db = adminClient()
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('books')
      .select('id,slug,title,isbn13,openlibrary_work_id,description_book,description_source_type,description_source_url,book_authors(authors(display_name))')
      .eq('description_source_type', 'openlibrary')
      .order('id', { ascending: true }).range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as unknown as Row[]))
    if (data.length < 1000) break
  }
  return rows
}

/** Group of titles sharing one blurb is "inconsistent" if no single anchor title's tokens are a subset of all. */
function inconsistent(titles: string[]): boolean {
  const uniq = [...new Set(titles)]
  if (uniq.length <= 1) return false
  const anchor = uniq.reduce((a, b) => (titleTokens(a).size <= titleTokens(b).size ? a : b))
  if (titleTokens(anchor).size === 0) return true
  return !uniq.every((t) => titlesMatch(anchor, t))
}

async function main() {
  const [olRows, allBooks] = await Promise.all([fetchOlRows(), fetchAllBooks()])

  // Map: exact blurb text -> set of titles holding it (across the whole table).
  const blurbTitles = new Map<string, string[]>()
  for (const b of allBooks) {
    const d = (b.desc ?? '').trim()
    if (d.length < 40) continue
    if (!blurbTitles.has(d)) blurbTitles.set(d, [])
    blurbTitles.get(d)!.push(b.title)
  }

  const contaminated: Array<Row & { author: string; reason: string }> = []
  for (const r of olRows) {
    const author = r.book_authors?.[0]?.authors?.display_name ?? ''
    const text = (r.description_book ?? '').trim()
    if (!text) continue
    if (sourceMatches(text, r.title, author)) continue   // guard passes → keep

    const search = !r.isbn13 && !r.openlibrary_work_id
    const sharedGroup = blurbTitles.get(text) ?? [r.title]
    const sharedInconsistent = sharedGroup.length > 1 && inconsistent(sharedGroup)

    if (search || sharedInconsistent) {
      contaminated.push({ ...r, author, reason: search ? 'search-binding+mismatch' : 'shared-blurb-inconsistent' })
    }
  }

  const bySearch = contaminated.filter(c => c.reason === 'search-binding+mismatch').length
  const byShared = contaminated.length - bySearch
  console.log(`OpenLibrary rows scanned:     ${olRows.length}`)
  console.log(`Contaminated (to null+flag):  ${contaminated.length}`)
  console.log(`  search-binding + mismatch:  ${bySearch}`)
  console.log(`  shared-blurb inconsistent:  ${byShared}`)

  // Always write a preview CSV of what would change.
  const previewHeader = ['id', 'slug', 'title', 'author', 'reason', 'source_url', 'desc_snippet'].join(',')
  const previewRows = contaminated.map(c =>
    [c.id, c.slug, c.title, c.author, c.reason, c.description_source_url ?? '',
     (c.description_book ?? '').replace(/\s+/g, ' ').slice(0, 100)].map(csvEscape).join(','))
  writeFileSync('data/ol-contamination-remediation.csv', previewHeader + '\n' + previewRows.join('\n') + '\n')
  console.log(`\nPreview written: data/ol-contamination-remediation.csv`)

  if (!APPLY) {
    console.log(`\nDRY-RUN — re-run with --apply to null+flag (originals backed up first).`)
    return
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backup = `data/ol-contamination-backup-${stamp}.csv`
  writeFileSync(backup, ['id', 'slug', 'description_book', 'description_source_type', 'description_source_url'].join(',') + '\n')
  const db = adminClient()
  let done = 0
  for (const c of contaminated) {
    appendFileSync(backup, [c.id, c.slug, c.description_book ?? '', c.description_source_type ?? '', c.description_source_url ?? ''].map(csvEscape).join(',') + '\n')
    const { error } = await db.from('books').update({
      description_book: null,
      description_source_url: null,
      description_source_type: null,
      data_quality_status: 'flagged',
      data_quality_evaluated_at: new Date().toISOString(),
      ai_drafted: false,
    }).eq('id', c.id)
    if (error) { console.log(`  ✗ #${c.id}: ${error.message}`); continue }
    done++
  }
  console.log(`\nApplied: ${done}/${contaminated.length} nulled+flagged. Backup: ${backup}`)
}

main().catch(e => { console.error(e); process.exit(1) })
