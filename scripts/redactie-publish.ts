/**
 * Publish human-approved redactie drafts: censorship_context = rewrite, literal text → censorship_context_unsourced,
 * sources kept, status 'narrative_curated'. Requires draft.approved === true and a passing gate (re-run in-process by
 * spawning redactie-gate.ts). Dry-run by default. Usage: --slugs=a,b [--apply]
 */
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'
import { bustPaths } from './lib/revalidate'
import { promises as fs } from 'node:fs'
import { spawnSync } from 'node:child_process'
const APPLY = isApply()
async function main() {
  const slugs = (process.argv.find(a => a.startsWith('--slugs='))?.slice(8) ?? '').split(',').filter(Boolean)
  if (!slugs.length) throw new Error('--slugs=a,b')
  const g = spawnSync('pnpm', ['tsx', '--env-file=.env.local', 'scripts/redactie-gate.ts', `--slugs=${slugs.join(',')}`], { encoding: 'utf8' }); console.log(g.stdout)
  const db = adminClient(); const done: string[] = []
  for (const s of slugs) {
    const d = JSON.parse(await fs.readFile(`data/redactie/drafts/${s}.json`, 'utf8'))
    if (d.approved !== true) { console.log('skip (not approved):', s); continue }
    if (new RegExp(`^FAIL ${s}\\b`, 'm').test(g.stdout)) { console.log('skip (gate FAIL):', s); continue }
    const b = (await db.from('books').select('id,censorship_context,censorship_context_status').eq('slug', s).single()).data as any
    if (b.censorship_context_status !== 'source_verified') { console.log('skip (status', b.censorship_context_status + '):', s); continue }
    console.log(APPLY ? 'publish' : 'would publish', s)
    if (APPLY) { const r = await db.from('books').update({ censorship_context: d.text, censorship_context_unsourced: b.censorship_context, censorship_context_status: 'narrative_curated', censorship_context_checked_at: new Date().toISOString(), censorship_context_check_note: 'redactie rewrite of the source-verified text; sources kept; ' + (d.changes ?? '') }).eq('id', b.id); if (r.error) throw r.error; done.push(s) }
  }
  if (APPLY && done.length) await bustPaths(done.map(s => '/books/' + s))
}
main().catch(e => { console.error(e); process.exit(1) })
