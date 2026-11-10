/**
 * SBZ register — overlap check (READ-ONLY, no writes).
 *
 * Pilot: runs the standard matcher (matchExistingBook) on the stage-0 sample and
 * confirms each hit against the matched book's authors (German generic titles
 * like "Deutschland" / "Der Weg" collide with unrelated books).
 * Full: cheap pass over ALL book/blanket rows — exact slug of the printed title
 * against books.slug, and author slug ("Hermann Adler" → hermann-adler) against
 * authors.slug — an upper bound on tier-(a) candidates.
 *
 *   npx tsx --env-file=.env.local scripts/_audit_sbz_register_overlap.ts [--date=2026-11-10] [--pilot-only]
 *   → data/sbz/overlap-<date>.md
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { matchExistingBook } from '../src/lib/imports/verifier'
import { slugify } from '../src/lib/imports/slugify'
import { flagValue, hasFlag } from './lib/cli'

const DATE = flagValue('date') ?? new Date().toISOString().slice(0, 10)
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
const surname = (printed: string | null) => (printed ? fold(printed.split(',')[0].split(/\s+u\.\s/)[0]) : '')

async function fetchAll<T>(table: string, cols: string): Promise<T[]> {
  const sb = adminClient()
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).order('id').range(from, from + 999)
    if (error) throw error
    out.push(...(data as T[]))
    if (!data || data.length < 1000) return out
  }
}

async function authorsOf(bookId: number): Promise<string[]> {
  const { data, error } = await adminClient()
    .from('book_authors')
    .select('authors(display_name)')
    .eq('book_id', bookId)
  if (error) throw error
  return (data ?? []).map((r: any) => r.authors?.display_name).filter(Boolean)
}

async function main() {
  const sample = JSON.parse(readFileSync(`data/sbz/sample-${DATE}.json`, 'utf8'))
  const lines: string[] = [`# SBZ register overlap — ${DATE}`, '', '## Pilot (matcher on sample)', '']
  let hits = 0
  let confirmed = 0
  for (const e of sample) {
    const m = await matchExistingBook({ title: e.title })
    if (!m) continue
    hits++
    const { data: b } = await adminClient().from('books').select('title, slug, first_published_year').eq('id', m.id).single()
    const auths = await authorsOf(m.id)
    const ok = !!e.printed_author && auths.some((a) => fold(a).includes(surname(e.printed_author)))
    if (ok) confirmed++
    lines.push(
      `- ${ok ? '✅' : '❌'} "${e.title}" (${e.printed_author ?? 'anon'}, ${e.pub_year ?? '?'}) → #${m.id} "${b?.title}" by ${auths.join('; ') || '—'} (${b?.first_published_year ?? '?'}) [${m.status} ${m.confidence?.toFixed(2) ?? ''}]`,
    )
  }
  lines.splice(4, 0, `Sample ${sample.length}: matcher hits ${hits}, author-confirmed ${confirmed}.`, '')
  console.log(`pilot: ${sample.length} rows, hits ${hits}, author-confirmed ${confirmed}`)

  if (!hasFlag('pilot-only')) {
    const rows = JSON.parse(readFileSync(`data/sbz/stage0-${DATE}.json`, 'utf8')).filter((e: any) =>
      ['book', 'blanket'].includes(e.kind),
    )
    const books = await fetchAll<{ id: number; slug: string; title: string }>('books', 'id, slug, title')
    const authors = await fetchAll<{ id: number; slug: string; display_name: string; birth_year: number | null }>(
      'authors',
      'id, slug, display_name, birth_year',
    )
    const bookBySlug = new Map(books.map((b) => [b.slug, b]))
    const authorBySlug = new Map(authors.map((a) => [a.slug, a]))
    const slugHits = rows.filter((e: any) => bookBySlug.has(slugify(e.title)))
    const authHits = rows.filter((e: any) => e.author_display && authorBySlug.has(slugify(e.author_display)))
    const distinctAuth = new Map<string, any>()
    for (const e of authHits) distinctAuth.set(slugify(e.author_display), authorBySlug.get(slugify(e.author_display)))
    lines.push('', '## Full set (cheap exact-slug pass)', '')
    lines.push(`Book/blanket rows: ${rows.length}. Exact title-slug hits: ${slugHits.length}. Rows whose author slug exists: ${authHits.length} (${distinctAuth.size} distinct authors).`, '')
    lines.push('### Title-slug hits', '')
    for (const e of slugHits) {
      const b = bookBySlug.get(slugify(e.title))!
      lines.push(`- "${e.title}" (${e.printed_author ?? 'anon'}, ${e.pub_year ?? '?'}, ${e.edition}) → #${b.id} "${b.title}"`)
    }
    lines.push('', '### Existing authors named on the list', '')
    for (const [s, a] of distinctAuth) {
      const n = authHits.filter((e: any) => slugify(e.author_display) === s).length
      lines.push(`- ${a.display_name} #${a.id} (b. ${a.birth_year ?? '?'}) — ${n} entries`)
    }
    console.log(`full: rows ${rows.length}, title-slug hits ${slugHits.length}, author rows ${authHits.length} / ${distinctAuth.size} authors`)
  }
  writeFileSync(`data/sbz/overlap-${DATE}.md`, lines.join('\n') + '\n')
  console.log(`→ data/sbz/overlap-${DATE}.md`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
