/**
 * Pre-flight collision check for the NFD-bulk slug repair.
 *
 * For every target slug in /tmp/nfd-subset.json, query the remote DB to see
 * whether any OTHER row in the same table already has that slug. A bare
 * UPDATE on a column with a UNIQUE constraint will explode otherwise (we
 * already saw this on `authors_slug_key`).
 *
 * Read-only — reports collisions, does not modify anything.
 */

import { readFileSync } from 'fs'
import { adminClient } from '../src/lib/supabase'

type Row = { table: 'books' | 'authors'; id: number; source: string; storedSlug: string; expectedSlug: string }

const rows: Row[] = readFileSync('/tmp/nfd-subset.json', 'utf8')
  .split('\n').filter(Boolean).map(JSON.parse)

async function main() {
  const db = adminClient()
  const collisions: Array<{ row: Row; conflict: { id: number; name: string } }> = []
  for (const r of rows) {
    const col = r.table === 'books' ? 'title' : 'display_name'
    const { data, error } = await db
      .from(r.table)
      .select(`id, ${col}, slug`)
      .eq('slug', r.expectedSlug)
    if (error) throw new Error(`${r.table} query failed: ${error.message}`)
    const rest = (data ?? []).filter((d: any) => d.id !== r.id)
    if (rest.length > 0) {
      for (const c of rest as any[]) {
        collisions.push({ row: r, conflict: { id: c.id, name: c[col] } })
      }
    }
  }
  if (collisions.length === 0) {
    console.log('No collisions. Migration is safe to re-run.')
    return
  }
  console.log(`Found ${collisions.length} collisions:\n`)
  for (const c of collisions) {
    console.log(`[${c.row.table}] id ${c.row.id} "${c.row.source}"`)
    console.log(`  wants slug: ${c.row.expectedSlug}`)
    console.log(`  blocked by: id ${c.conflict.id} "${c.conflict.name}"`)
    console.log('')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
