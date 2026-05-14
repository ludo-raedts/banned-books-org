#!/usr/bin/env tsx
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
  const id = Number(process.argv[2] ?? 122)
  const { data, error } = await sb
    .from('import_review_queue')
    .select('id, source_slug, status, pass_a_output, pass_b_output, agreement_details')
    .eq('id', id)
  if (error) throw error
  console.log(JSON.stringify(data?.[0], null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
