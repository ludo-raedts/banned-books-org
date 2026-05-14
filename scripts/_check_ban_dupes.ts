#!/usr/bin/env tsx
// Count bans-rows that collide on (book_id, country_code, year_started, scope_id).
// Result determines whether we can add a UNIQUE constraint without cleanup.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvLocal() {
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

async function main() {
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  const rows: Array<{
    id: number
    book_id: number
    country_code: string
    year_started: number | null
    scope_id: number | null
  }> = []
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('bans')
      .select('id, book_id, country_code, year_started, scope_id')
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    offset += 1000
  }

  const groups = new Map<string, number[]>()
  for (const r of rows) {
    const key = `${r.book_id}|${r.country_code}|${r.year_started ?? 'null'}|${r.scope_id ?? 'null'}`
    const arr = groups.get(key) ?? []
    arr.push(r.id)
    groups.set(key, arr)
  }

  const dupes = [...groups.entries()].filter(([, ids]) => ids.length > 1)
  const totalDupeRows = dupes.reduce((sum, [, ids]) => sum + ids.length, 0)
  const wouldBeRemoved = dupes.reduce((sum, [, ids]) => sum + (ids.length - 1), 0)

  console.log(`Total bans:                    ${rows.length}`)
  console.log(`Unique scope-tuples:           ${groups.size}`)
  console.log(`Tuples with duplicates:        ${dupes.length}`)
  console.log(`Total rows in dupe groups:     ${totalDupeRows}`)
  console.log(`Rows that would be removed:    ${wouldBeRemoved}`)
  console.log('')

  if (dupes.length === 0) {
    console.log('✓ No duplicates — UNIQUE constraint can be applied directly.')
    return
  }

  console.log('Top 20 duplicate groups (descending size):')
  dupes
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20)
    .forEach(([key, ids]) =>
      console.log(`  ${String(ids.length).padStart(3)}× ${key}   ids=[${ids.join(',')}]`)
    )
}

main().catch(e => { console.error(e); process.exit(1) })
