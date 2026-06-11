#!/usr/bin/env tsx
/**
 * Print description_ban + censorship_context for a list of book IDs.
 * Ad-hoc sanity-check helper for the groundedness audit.
 *
 * Usage: npx tsx scripts/_peek_censorship_context.ts 6858 7487 9137 10096
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
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
  const ids = process.argv.slice(2).map(s => parseInt(s, 10)).filter(Number.isFinite)
  if (ids.length === 0) { console.error('usage: ... <id> [id...]'); process.exit(1) }
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()
  const { data, error } = await sb
    .from('books')
    .select('id, slug, title, description_ban, censorship_context')
    .in('id', ids)
  if (error) throw error
  for (const id of ids) {
    const r = data?.find(x => x.id === id)
    if (!r) { console.log(`\n## id=${id} NOT FOUND\n`); continue }
    console.log(`\n## ${r.title}  [id=${r.id}]  /books/${r.slug}`)
    console.log(`\n**description_ban** (${(r.description_ban ?? '').length}c)`)
    console.log(`> ${(r.description_ban ?? '—').replace(/\s+/g, ' ').trim()}`)
    console.log(`\n**censorship_context** (${(r.censorship_context ?? '').length}c)`)
    console.log(`> ${(r.censorship_context ?? '—').replace(/\s+/g, ' ').trim()}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
