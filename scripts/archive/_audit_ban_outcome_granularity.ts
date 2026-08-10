#!/usr/bin/env tsx
/**
 * READ-ONLY audit: how big is the "not really removed — relocated / access-restricted"
 * category in our bans, the way Banned Index splits it out (11 statuses vs our 3).
 *
 * We already have action_type = banned | restricted | challenged. This measures:
 *   1. distribution of action_type over raw ban rows AND distinct books
 *   2. US vs non-US split (the relocation nuance is almost entirely a US/PEN concern)
 *   3. keyword scan over bans.description for FINER outcomes Banned Index distinguishes
 *      but we currently flatten into one bucket:
 *        - relocation  (moved to adult/teen/HS section, reshelved)
 *        - access-gate (parental permission/consent, opt-in, age-gated, library card)
 *        - full removal (removed/pulled/withdrawn from shelves/collection)
 *   The point: how many rows are "softer than a ban" yet counted in our headline totals.
 *
 * Writes nothing.
 */
import { makeAdminClient } from './lib/dataset-io'

type Row = { action_type: string; status: string; country_code: string; book_id: number; description: string | null }

const RELOCATION = /\b(relocat|reshelv|moved? to (the )?(adult|teen|young adult|ya|high[- ]?school|mature)|transferred? to|placed in (the )?adult)\b/i
const ACCESS_GATE = /\b(parental (permission|consent)|opt[- ]?in|opt[- ]?out|permission slip|age[- ]?gat|library card|restricted to (the )?adult|requires? (parent|guardian))\b/i
const FULL_REMOVAL = /\b(removed?|pulled|withdrawn|taken off|banned from|prohibited|destroyed|burned|confiscat)\b/i

async function main() {
  const s = makeAdminClient()
  const PAGE = 1000
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await s
      .from('bans')
      .select('action_type, status, country_code, book_id, description')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    rows.push(...(data as Row[]))
    if (data.length < PAGE) break
  }

  const total = rows.length
  const us = rows.filter((r) => r.country_code === 'US')
  console.log(`\n▸ Total ban rows: ${total}   (US: ${us.length}, non-US: ${total - us.length})\n`)

  // 1+2: action_type distribution, rows + distinct books, US vs non-US
  const byType = (subset: Row[]) => {
    const m = new Map<string, { rows: number; books: Set<number> }>()
    for (const r of subset) {
      const k = r.action_type
      if (!m.has(k)) m.set(k, { rows: 0, books: new Set() })
      const e = m.get(k)!
      e.rows++
      e.books.add(r.book_id)
    }
    return m
  }
  const fmt = (m: Map<string, { rows: number; books: Set<number> }>) =>
    [...m.entries()].sort((a, b) => b[1].rows - a[1].rows)
      .map(([k, v]) => `    ${k.padEnd(11)} rows=${String(v.rows).padStart(6)}  distinct books=${String(v.books.size).padStart(6)}`).join('\n')

  console.log('action_type — ALL:'); console.log(fmt(byType(rows)))
  console.log('\naction_type — US only:'); console.log(fmt(byType(us)))
  console.log('\naction_type — non-US only:'); console.log(fmt(byType(rows.filter((r) => r.country_code !== 'US'))))

  // global distinct-book overlap: a book counted as "banned" anywhere vs only soft
  const booksWithBanned = new Set(rows.filter((r) => r.action_type === 'banned').map((r) => r.book_id))
  const booksAny = new Set(rows.map((r) => r.book_id))
  const softOnly = [...booksAny].filter((b) => !booksWithBanned.has(b))
  console.log(`\n▸ Distinct books total: ${booksAny.size}`)
  console.log(`   • with ≥1 'banned' row:        ${booksWithBanned.size}`)
  console.log(`   • ONLY restricted/challenged:  ${softOnly.length}  (counted in headline totals, but never a legal ban)`)

  // 3: finer-outcome keyword scan over description (only rows that HAVE a description)
  const withDesc = rows.filter((r) => r.description && r.description.trim().length > 0)
  console.log(`\n▸ Finer-outcome keyword scan (rows with a description: ${withDesc.length} / ${total})`)
  const bucket = { relocation: 0, accessGate: 0, fullRemoval: 0, none: 0 }
  // cross-tab: how is each finer signal currently typed?
  const reloByType = new Map<string, number>()
  const gateByType = new Map<string, number>()
  for (const r of withDesc) {
    const d = r.description as string
    const isRelo = RELOCATION.test(d)
    const isGate = ACCESS_GATE.test(d)
    const isRem = FULL_REMOVAL.test(d)
    if (isRelo) { bucket.relocation++; reloByType.set(r.action_type, (reloByType.get(r.action_type) ?? 0) + 1) }
    if (isGate) { bucket.accessGate++; gateByType.set(r.action_type, (gateByType.get(r.action_type) ?? 0) + 1) }
    if (isRem && !isRelo && !isGate) bucket.fullRemoval++
    if (!isRelo && !isGate && !isRem) bucket.none++
  }
  console.log(`    relocation signal:   ${bucket.relocation}   by current action_type → ${JSON.stringify(Object.fromEntries(reloByType))}`)
  console.log(`    access-gate signal:  ${bucket.accessGate}   by current action_type → ${JSON.stringify(Object.fromEntries(gateByType))}`)
  console.log(`    full-removal signal: ${bucket.fullRemoval}`)
  console.log(`    no clear signal:     ${bucket.none}`)

  // the headline-impact number: rows typed 'banned' that READ like a mere relocation/gate
  const mislabeledBanned = withDesc.filter((r) => r.action_type === 'banned' && (RELOCATION.test(r.description!) || ACCESS_GATE.test(r.description!)))
  console.log(`\n▸ Rows typed 'banned' whose description reads as relocation/access-gate: ${mislabeledBanned.length}`)
  for (const r of mislabeledBanned.slice(0, 12)) console.log(`    [${r.country_code}] ${(r.description ?? '').slice(0, 110).replace(/\s+/g, ' ')}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
