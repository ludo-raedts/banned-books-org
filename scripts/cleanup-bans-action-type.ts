#!/usr/bin/env tsx
/**
 * Clean non-canonical bans.action_type values.
 *
 * Decided after audit (2026-06-02):
 *   - 'removed'  → 'restricted'   (school "removed from shelves" is a restriction,
 *                                  not a formal legal ban). Bulk, all rows.
 *   - 'blocked'  → per scope:     government-scope → 'banned';
 *                                  customs / retail / import (and any other) → 'restricted'.
 *
 * `bans.action_type` is a TEXT column with CHECK constraint `bans_action_type_check`
 * that ALREADY permits 'banned' and 'restricted', so this data UPDATE needs no
 * migration to run. (Tightening the constraint to forbid 'removed'/'blocked' going
 * forward is a SEPARATE schema change handled by a migration, applied after this.)
 *
 * Usage:
 *   pnpm tsx scripts/cleanup-bans-action-type.ts          # dry-run: show plan, write nothing
 *   pnpm tsx scripts/cleanup-bans-action-type.ts --apply  # perform the UPDATEs
 *
 * Idempotent: a second run finds zero 'removed'/'blocked' rows and does nothing.
 */

import { makeAdminClient } from './lib/dataset-io'

const APPLY = process.argv.includes('--apply')

// Scope slugs that mean "a border/commercial block", mapped to 'restricted'.
// Government-scope blocks are a state prohibition → 'banned'. Anything else
// defaults to 'restricted' (the more conservative, less-strong claim).
function blockedTarget(scopeSlug: string | null): 'banned' | 'restricted' {
  return scopeSlug === 'government' ? 'banned' : 'restricted'
}

async function main() {
  const s = makeAdminClient()
  console.log(`▸ bans.action_type cleanup  ${APPLY ? '(--apply: WRITING)' : '(dry-run: no writes)'}\n`)

  // ── 'removed' → 'restricted' (bulk) ───────────────────────────────────────
  const { data: removedRows, error: remErr } = await s
    .from('bans')
    .select('id')
    .eq('action_type', 'removed')
  if (remErr) throw new Error(`select removed: ${remErr.message}`)
  console.log(`'removed' → 'restricted':  ${removedRows?.length ?? 0} row(s)`)

  // ── 'blocked' → per-scope (show each row + target) ────────────────────────
  const { data: blockedRows, error: blkErr } = await s
    .from('bans')
    .select('id, country_code, status, scope_id, books(title), scopes(slug)')
    .eq('action_type', 'blocked')
    .order('id', { ascending: true })
  if (blkErr) throw new Error(`select blocked: ${blkErr.message}`)

  console.log(`\n'blocked' → per scope:  ${blockedRows?.length ?? 0} row(s)`)
  const blockedPlan = (blockedRows ?? []).map((r: any) => {
    const scope = r.scopes?.slug ?? null
    return { id: r.id, title: r.books?.title ?? '(no book)', cc: r.country_code, status: r.status, scope, target: blockedTarget(scope) }
  })
  for (const p of blockedPlan) {
    console.log(`  • ${String(p.title).slice(0, 42).padEnd(42)} | ${String(p.cc).padEnd(3)} | scope=${String(p.scope ?? '∅').padEnd(11)} | status=${String(p.status).padEnd(10)} → ${p.target}`)
  }

  if (!APPLY) {
    console.log('\n✓ Dry-run only. Re-run with --apply to perform these UPDATEs.')
    return
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  if ((removedRows?.length ?? 0) > 0) {
    const { error } = await s.from('bans').update({ action_type: 'restricted' }).eq('action_type', 'removed')
    if (error) throw new Error(`update removed: ${error.message}`)
    console.log(`\n  ✓ Updated ${removedRows!.length} 'removed' → 'restricted'`)
  }
  for (const p of blockedPlan) {
    const { error } = await s.from('bans').update({ action_type: p.target }).eq('id', p.id)
    if (error) throw new Error(`update blocked ${p.id}: ${error.message}`)
    console.log(`  ✓ ${p.id} → ${p.target}`)
  }

  // ── Re-verify ───────────────────────────────────────────────────────────
  const counts = new Map<string, number>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await s.from('bans').select('action_type').order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw new Error(`verify: ${error.message}`)
    if (!data || data.length === 0) break
    for (const r of data) counts.set(String(r.action_type), (counts.get(String(r.action_type)) ?? 0) + 1)
    if (data.length < PAGE) break
  }
  console.log('\n  Post-cleanup action_type distribution:')
  for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(12)} ${v}`)
  const leftover = [...counts.keys()].filter((k) => !['banned', 'restricted', 'challenged'].includes(k))
  if (leftover.length) console.log(`\n  ! Unexpected residual values: ${leftover.join(', ')}`)
  else console.log('\n✓ action_type is now exactly banned | restricted | challenged')
}

main().catch((e) => { console.error(e); process.exit(1) })
