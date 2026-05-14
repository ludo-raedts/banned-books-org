#!/usr/bin/env tsx
// Simulate the new dedup behavior against the current pending review queue.
// Read-only — no DB mutations. Re-runs `dedupAgainstBooks()` (which now uses
// the title-normalization) on every pending `possible_duplicate` row and
// reports how the kind would shift:
//   - duplicate            → would auto-add-ban (queue row disappears on next pipeline run)
//   - still possible_duplicate → stays in review queue
//   - none                 → would become a new book (rare; means dedup lost the match)
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
  const { dedupAgainstBooks } = await import('../src/lib/wikipedia/dedup')
  const sb = adminClient()

  const rows: Array<{
    id: number
    pass_a_output: { title?: string; authors?: string[]; year?: number | null } | null
    agreement_details: { dedup_check?: { kind: string; book_id?: number; similarity?: number } } | null
  }> = []
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('import_review_queue')
      .select('id, pass_a_output, agreement_details')
      .eq('status', 'pending_review')
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as typeof rows))
    if (data.length < 1000) break
    offset += 1000
  }

  const flagged = rows.filter(
    r => r.agreement_details?.dedup_check?.kind === 'possible_duplicate',
  )
  console.log(`Pending rows: ${rows.length}`)
  console.log(`Pending + possible_duplicate (to simulate): ${flagged.length}`)
  console.log('')

  const shifts = {
    'possible → duplicate': 0,
    'possible → possible': 0,
    'possible → none': 0,
    'error': 0,
  }
  const promotions: Array<{ qid: number; title: string; before: number; after: number }> = []

  for (const r of flagged) {
    const pa = r.pass_a_output
    if (!pa?.title || !pa.authors || pa.authors.length === 0) {
      shifts['error']++
      continue
    }
    try {
      const result = await dedupAgainstBooks(sb, {
        title: pa.title,
        authors: pa.authors,
        year: pa.year ?? null,
        notes_raw: '',
        source_anchor: '',
        state: null,
        quality_flags: [],
      })
      const before = r.agreement_details?.dedup_check?.similarity ?? 0
      if (result.kind === 'duplicate') {
        shifts['possible → duplicate']++
        if (promotions.length < 30) {
          promotions.push({
            qid: r.id,
            title: pa.title,
            before,
            after: result.similarity,
          })
        }
      } else if (result.kind === 'possible_duplicate') {
        shifts['possible → possible']++
      } else {
        shifts['possible → none']++
      }
    } catch {
      shifts['error']++
    }
  }

  console.log('Outcome shift after normalization:')
  for (const [k, v] of Object.entries(shifts)) {
    const pct = flagged.length > 0 ? Math.round((v / flagged.length) * 100) : 0
    console.log(`  ${String(v).padStart(4)} (${String(pct).padStart(2)}%)  ${k}`)
  }

  if (promotions.length > 0) {
    console.log('\nFirst 30 promotions (possible_duplicate → duplicate = will auto-add-ban):')
    for (const p of promotions) {
      console.log(`  q#${String(p.qid).padStart(4)}  ${p.before.toFixed(2)} → ${p.after.toFixed(2)}  "${p.title.slice(0, 55)}"`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
