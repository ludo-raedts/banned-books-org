// wipe-ungrounded-filler-descriptions.ts — Phase 1 of the AI-description QA pass.
//
// Sets `description_book = NULL` for the highest-risk ungrounded AI descriptions:
// rows the read-only audit (scripts/_audit_ungrounded_descriptions.ts) classified
// as decision='WIPE' (ai_drafted, no ISBN, no source_type, and no external source
// resolved) AND that carry heavy filler (>=2 boilerplate tells). For these,
// showing nothing beats showing an unverifiable, generic AI synopsis.
//
// Re-groundable rows (decision='REGROUND') are NOT touched here — they belong to
// Phase 2 (re-run grounded enrichment).
//
// Safety:
//   - reads the ids from data/ungrounded-desc-dryrun.jsonl (refresh it first).
//   - on --apply, writes a CSV backup of every (id, slug, description_book) it
//     clears, so the wipe is reversible.
//   - the UPDATE is guarded with `description_source_type IS NULL`, so a row that
//     was grounded after the audit ran is never blanked.
//
// Run (dry):   pnpm tsx --env-file=.env.local scripts/wipe-ungrounded-filler-descriptions.ts
// Run (write): …/wipe-ungrounded-filler-descriptions.ts --apply

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
// A1c mode: wipe EVERY remaining ungrounded AI description (ai_drafted, no
// source_type, non-null text), all languages, ISBN or not — the keep-vs-wipe
// cohort that A1/A1b confirmed has no findable source and that cross-model
// consensus confirmed the models don't know (100% UNKNOWN). Selects by DB
// signature instead of the phase-1 audit jsonl.
const NO_SOURCE_ALL = process.argv.includes('--no-source-all')
const sb = adminClient()
const JSONL = resolve(__dirname, '../data/ungrounded-desc-dryrun.jsonl')

type Row = { id: number; title: string; decision: string; filler: number }

function loadWipeIds(): number[] {
  if (!existsSync(JSONL)) throw new Error(`missing ${JSONL} — run scripts/_audit_ungrounded_descriptions.ts first`)
  const ids: number[] = []
  for (const line of readFileSync(JSONL, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t) continue
    const r = JSON.parse(t) as Row
    if (r.decision === 'WIPE' && (r.filler ?? 0) >= 2) ids.push(r.id)
  }
  return ids
}

// A1c selection: paginate the full ungrounded-no-source-with-text population.
async function loadNoSourceAllRows(): Promise<{ id: number; slug: string; description_book: string | null }[]> {
  const rows: { id: number; slug: string; description_book: string | null }[] = []
  let from = 0
  const PAGE = 1000
  for (;;) {
    const { data, error } = await sb
      .from('books')
      .select('id, slug, description_book')
      .eq('ai_drafted', true)
      .is('description_source_type', null)
      .not('description_book', 'is', null)
      .eq('is_blanket_works', false)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    for (const r of data as { id: number; slug: string; description_book: string }[]) {
      rows.push({ id: r.id, slug: r.slug, description_book: r.description_book })
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

async function run() {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN (pass --apply to write) ===')
  console.log(NO_SOURCE_ALL ? 'mode: --no-source-all (A1c, full DB signature)' : 'mode: phase-1 heavy-filler (audit jsonl)')

  // Pull current state — only rows that are STILL ungrounded get cleared.
  let rows: { id: number; slug: string; description_book: string | null }[] = []
  const backupName = NO_SOURCE_ALL ? 'wiped-a1c-no-source-backup.csv' : 'wiped-ungrounded-descriptions-backup.csv'
  if (NO_SOURCE_ALL) {
    rows = await loadNoSourceAllRows()
  } else {
    const ids = loadWipeIds()
    console.log(`heavy-filler WIPE candidates in report: ${ids.length}`)
    if (!ids.length) return
    for (let i = 0; i < ids.length; i += 300) {
      const slice = ids.slice(i, i + 300)
      const { data, error } = await sb
        .from('books')
        .select('id, slug, description_book, description_source_type')
        .in('id', slice)
        .is('description_source_type', null)
        .not('description_book', 'is', null)
      if (error) throw error
      for (const r of data as { id: number; slug: string; description_book: string; description_source_type: null }[]) {
        rows.push({ id: r.id, slug: r.slug, description_book: r.description_book })
      }
    }
  }
  console.log(`still ungrounded & non-null (will clear): ${rows.length}`)
  console.log('sample:')
  for (const r of rows.slice(0, 8)) console.log(`  #${r.id} ${r.slug}: "${(r.description_book ?? '').slice(0, 80)}…"`)

  if (!APPLY) {
    console.log(`\n[dry] would set description_book = NULL on ${rows.length} rows (and back them up).`)
    return
  }

  // Reversible: back up before clearing.
  const backup = 'id,slug,description_book\n' +
    rows.map((r) => `${r.id},${r.slug},${JSON.stringify(r.description_book ?? '')}`).join('\n')
  const backupPath = resolve(__dirname, `../data/${backupName}`)
  writeFileSync(backupPath, backup + '\n')
  console.log(`backed up ${rows.length} descriptions → ${backupPath}`)

  let cleared = 0
  const clearIds = rows.map((r) => r.id)
  for (let i = 0; i < clearIds.length; i += 300) {
    const slice = clearIds.slice(i, i + 300)
    const { error } = await sb
      .from('books')
      .update({ description_book: null })
      .in('id', slice)
      .is('description_source_type', null) // guard: never blank a since-grounded row
    if (error) throw error
    cleared += slice.length
  }
  console.log(`cleared description_book on ${cleared} rows.`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
