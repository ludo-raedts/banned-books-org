// clean-wiki-markup-descriptions.ts — repair descriptions that leaked raw
// MediaWiki markup ("== Section ==", "=== Sub ===") from the Wikipedia-sourced
// enrichment path. Detector: scripts/_audit_wiki_markup_descriptions.ts.
//
// Transform (same helper the live pipeline now uses — src/lib/enrich/descriptions.ts):
//   stripWikiMarkup() truncates at the first section header (keeping the lead
//   paragraph) and scrubs residual "==" runs.
//
// Per field (description, description_book):
//   - cleaned length >= MIN_LEN  → overwrite with the cleaned lead
//   - cleaned length <  MIN_LEN  → NULL the field (a stub blurb is worse than
//     the page's normal empty-state / fallback)
//
// Dry-run by default; prints before/after samples + a length distribution.
// Pass --apply to persist. Tune the null threshold with --min=<n> (default 60).
//
// Run: pnpm tsx --env-file=.env.local scripts/clean-wiki-markup-descriptions.ts
//      pnpm tsx --env-file=.env.local scripts/clean-wiki-markup-descriptions.ts --apply

import { adminClient } from '../src/lib/supabase'
import { stripWikiMarkup } from '../src/lib/enrich/descriptions'
import { isApply, intFlag } from './lib/cli'

const db = adminClient()
const APPLY = isApply()
const MIN_LEN = intFlag('min', 60)
const WIKI_HEADER = /={2,}\s?[^=\n]{1,80}?\s?={2,}/
const FIELDS = ['description_book'] as const

type Book = {
  id: number
  slug: string
  title: string
  data_quality_status: string | null
  description_book: string | null
}

async function paginate(): Promise<Book[]> {
  const rows: Book[] = []
  const PAGE = 1000
  let from = 0
  for (;;) {
    const { data, error } = await db
      .from('books')
      .select('id, slug, title, data_quality_status, description_book')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as Book[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

type Change = {
  id: number
  slug: string
  title: string
  status: string
  field: (typeof FIELDS)[number]
  before: string
  after: string | null // null = field will be NULLed
}

function snippet(s: string, n = 220): string {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? one.slice(0, n) + '…' : one
}

async function main() {
  const rows = await paginate()
  const changes: Change[] = []

  for (const b of rows) {
    for (const field of FIELDS) {
      const val = b[field]
      if (!val || !WIKI_HEADER.test(val)) continue
      const stripped = stripWikiMarkup(val)
      changes.push({
        id: b.id,
        slug: b.slug,
        title: b.title,
        status: b.data_quality_status ?? 'default',
        field,
        before: val,
        after: stripped.length >= MIN_LEN ? stripped : null,
      })
    }
  }

  const overwrites = changes.filter((c) => c.after !== null)
  const nulled = changes.filter((c) => c.after === null)

  console.log(`Scanned ${rows.length} books.`)
  console.log(`Contaminated fields: ${changes.length}`)
  console.log(`  → truncate to lead: ${overwrites.length}`)
  console.log(`  → NULL (lead < ${MIN_LEN} chars): ${nulled.length}\n`)

  const byField: Record<string, number> = {}
  for (const c of changes) byField[c.field] = (byField[c.field] ?? 0) + 1
  console.log('By field:', byField, '\n')

  console.log('── 10 before/after samples (truncate) ──')
  for (const c of overwrites.slice(0, 10)) {
    console.log(`\n#${c.id} [${c.status}] ${c.title} — ${c.field}`)
    console.log(`  BEFORE: ${snippet(c.before)}`)
    console.log(`  AFTER : ${snippet(c.after!)}`)
  }

  if (nulled.length > 0) {
    console.log('\n── would be NULLed (lead too short) ──')
    for (const c of nulled.slice(0, 15)) {
      console.log(`  #${c.id} [${c.status}] ${c.title} — ${c.field}: "${snippet(c.before, 90)}"`)
    }
  }

  if (!APPLY) {
    console.log(`\nDry run. Re-run with --apply to persist ${changes.length} field updates.`)
    return
  }

  // Group updates per book so overwrite + null on the same row is one PATCH.
  const perBook = new Map<number, Record<string, string | null>>()
  for (const c of changes) {
    const patch = perBook.get(c.id) ?? {}
    patch[c.field] = c.after
    perBook.set(c.id, patch)
  }

  let ok = 0
  for (const [id, patch] of perBook) {
    const { error } = await db.from('books').update(patch).eq('id', id)
    if (error) {
      console.error(`  ✗ #${id}: ${error.message}`)
      continue
    }
    ok++
  }
  console.log(`\nApplied: ${ok}/${perBook.size} books updated (${changes.length} fields).`)
}

main().then(() => process.exit(0))
