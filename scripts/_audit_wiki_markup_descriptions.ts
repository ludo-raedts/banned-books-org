// _audit_wiki_markup_descriptions.ts — READ-ONLY.
// Counts books whose description / description_book still carry raw MediaWiki
// section markup (== Heading ==, === Sub ===) or other un-stripped wiki artefacts
// that leaked in from the Wikipedia-sourced enrichment path.
//
// Run: pnpm tsx --env-file=.env.local scripts/_audit_wiki_markup_descriptions.ts

import { adminClient } from '../src/lib/supabase'

const db = adminClient()

// A real section header: line/inline "== Something ==" or "=== Something ===".
// Require a space inside so we don't catch "==" used as an equality example.
const WIKI_HEADER = /={2,}\s?[^=\n]{1,80}?\s?={2,}/

async function paginate(select: string) {
  const rows: Record<string, unknown>[] = []
  const PAGE = 1000
  let from = 0
  for (;;) {
    const { data, error } = await db
      .from('books')
      .select(select)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as Record<string, unknown>[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

async function main() {
  const rows = await paginate(
    'id, slug, title, data_quality_status, description, description_book'
  )
  console.log(`Scanned ${rows.length} books.\n`)

  const hits: {
    id: number
    slug: string
    title: string
    status: string
    field: string
  }[] = []

  for (const r of rows) {
    for (const field of ['description', 'description_book'] as const) {
      const val = r[field] as string | null
      if (val && WIKI_HEADER.test(val)) {
        hits.push({
          id: r.id as number,
          slug: r.slug as string,
          title: r.title as string,
          status: (r.data_quality_status as string) ?? 'default',
          field,
        })
        break // count each book once
      }
    }
  }

  const byStatus: Record<string, number> = {}
  for (const h of hits) byStatus[h.status] = (byStatus[h.status] ?? 0) + 1

  console.log(`Books with raw wiki-markup in a description: ${hits.length}\n`)
  console.log('By data_quality_status:')
  for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${v}`)
  }

  console.log('\nFirst 30 samples:')
  for (const h of hits.slice(0, 30)) {
    console.log(`  #${h.id} [${h.status}] ${h.title} (${h.slug}) — ${h.field}`)
  }
}

main().then(() => process.exit(0))
