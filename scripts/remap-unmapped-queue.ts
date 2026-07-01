/**
 * Re-run reason mapping over import_review_queue rows that still carry the
 * `unmapped_reason` quality_flag. Three passes per row, in order:
 *
 *   1. The current strict `mapReason()` from src/lib/wikipedia/reason-mapper.ts.
 *      If it now finds a slug (patterns were extended after the row was
 *      originally imported — see the 2026-05-14 international-corpus additions),
 *      update `agreement_details.reason_mapping`, drop the `unmapped_reason`
 *      flag, and add any extra flags the mapper produced (defamation_suit_civil,
 *      import_ban_no_explicit_reason, etc.).
 *
 *   2. Source-level fallback. `mapReason()` is now called with the section
 *      config's `fallback_reason_slug` (when configured). For rows whose
 *      notes are empty or carry only trivial markers (HK's "✓"), the mapper
 *      returns the fallback slug with confidence='low' and the new
 *      `source_default_reason` quality flag. The `unmapped_reason` flag is
 *      dropped because the row is now mapped, just at low confidence.
 *
 *   3. If passes 1+2 still return null AND notes are non-empty, try a
 *      broader keyword heuristic ported from
 *      scripts/reclassify-other-reasons.ts. On a hit, set reason_mapping =
 *      { slug: <first>, confidence: 'low' } but KEEP the `unmapped_reason`
 *      flag so the editor recognises this as a low-confidence guess.
 *
 * Rows with truly empty notes AND no configured fallback are skipped.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/remap-unmapped-queue.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/remap-unmapped-queue.ts --apply  # (--write werkt nog als alias)
 */
import { adminClient } from '../src/lib/supabase'
import { mapReason } from '../src/lib/wikipedia/reason-mapper'
import { findWikipediaSourceConfig } from '../src/lib/imports/review-approve'
import type { SectionConfig } from '../src/lib/wikipedia/types'
import { isApply } from './lib/cli'

const WRITE = isApply()

// Broader keyword heuristic, ported from scripts/reclassify-other-reasons.ts.
// Looser than the strict wikipedia mapper — used only as a fallback for rows
// the strict mapper rejected. All hits are marked confidence='low'.
function inferReasonsBroad(text: string): string[] {
  const t = text.toLowerCase()
  const found = new Set<string>()

  if (/lgbtq|lesbian|gay |same-sex|transgender|\btrans\b|queer|gender identity|gender expression|gender-fluid|genderqueer|non-?binary|bisexual|sexual identity|conversion therapy|homosexual|coming out|pride |rainbow flag|same sex|intersex|asexual/.test(t))
    found.add('lgbtq')

  if (/sexual content|explicit sex|sex scene|erotic|pornograph|sexually explicit|sexual relationship|sexual references|adult romantic|sexual material|sexual violence|sexual assault|sexual abuse|obscene|nude|nudity|incest|prostitut|rape|masturbat|genitalia/.test(t))
    found.add('sexual')

  if (/\bviolence\b|violent|murder|graphic depic|graphic content|torture|war crime|brutal|gore|graphic|killing|assault|abuse|self.harm|suicide|self-harm|gun violence|domestic abuse|kidnap|captiv/.test(t))
    found.add('violence')

  if (/\brace\b|racism|racial|systemic racism|police violence|police brutality|kkk|racial slur|n-word|white supremac|civil rights|black teenager|anti-?black|anti-?racism|colonialism|segregation|slavery|microagression|microaggression|reparation/.test(t))
    found.add('racial')

  if (/drug use|\bdrugs?\b|addiction|substance abuse|\balcohol\b|narcotics|heroin|cocaine|marijuana|cannabis/.test(t))
    found.add('drugs')

  if (/religious content|religious objection|religious material|religious upbringing|anti-?religious|irreverence|religious group|anti.christian|anti.islam|blasphemy|faith.based|witchcraft|occult|satanism|biblical|supernatural (belief|concern)/.test(t))
    found.add('religious')

  if (/politic|totalitarian|communist|communism|capitalism|authoritarian|systemic inequality|social justice|protest|policing|anti-?authoritarian|marxis|censorship of|ideologic/.test(t))
    found.add('political')

  if (/obscen/.test(t) && !found.has('sexual'))
    found.add('obscenity')

  // `blasphemy` was merged into `religious` on 2026-05-20.
  if (/blasphemy|blasphemous/.test(t))
    found.add('religious')

  return [...found]
}

type QueueRow = {
  id: number
  source_slug: string
  agreement_details: {
    parsed_row?: { title?: string; notes_raw?: string; source_anchor?: string }
    section_anchor?: string
    quality_flags?: string[]
    reason_mapping?: { slug: string | null; confidence: 'high' | 'low' }
    [k: string]: unknown
  } | null
}

// Resolve the SectionConfig for a queue row, mirroring the lookup used by
// getQueueSourceContext / getQueueSectionDefaults in src/lib/imports/
// review-approve.ts. Returns null if the source slug isn't in the live
// config (e.g. a renamed/removed source) — in that case no fallback applies
// even if it was originally configured.
function findSectionForRow(row: QueueRow): SectionConfig | null {
  const cfg = findWikipediaSourceConfig(row.source_slug)
  if (!cfg) return null
  const anchor =
    row.agreement_details?.parsed_row?.source_anchor
    ?? row.agreement_details?.section_anchor
    ?? ''
  const matched = cfg.sections.find(s => s.heading.replace(/ /g, '_') === anchor)
  return matched ?? cfg.sections[0] ?? null
}

async function loadPendingUnmapped(s: ReturnType<typeof adminClient>): Promise<QueueRow[]> {
  let all: QueueRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await s
      .from('import_review_queue')
      .select('id, source_slug, agreement_details')
      .eq('status', 'pending_review')
      .order('id', { ascending: false })
      .range(offset, offset + 999)
    if (error) throw new Error(`load queue: ${error.message}`)
    if (!data || data.length === 0) break
    all = all.concat(data as unknown as QueueRow[])
    if (data.length < 1000) break
    offset += 1000
  }
  return all.filter(r => (r.agreement_details?.quality_flags ?? []).includes('unmapped_reason'))
}

async function main() {
  const s = adminClient()
  const rows = await loadPendingUnmapped(s)
  console.log(`Pending rows with unmapped_reason: ${rows.length}`)
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}\n`)

  let pass1PatternHits = 0
  let pass2FallbackHits = 0
  let pass3BroadHits = 0
  let noSignal = 0
  let emptyNotes = 0
  let errors = 0

  for (const row of rows) {
    const ad = row.agreement_details ?? {}
    const notes = (ad.parsed_row?.notes_raw ?? '').trim()
    const title = ad.parsed_row?.title ?? '(no title)'

    const section = findSectionForRow(row)
    const fallback = section?.fallback_reason_slug ?? null

    const flags = [...(ad.quality_flags ?? [])]
    // mapReason handles three branches: strict patterns, source-fallback (when
    // notes carry no signal AND fallback is configured), or null+unmapped.
    const result = mapReason(notes, fallback)

    let nextMapping: { slug: string | null; confidence: 'high' | 'low' } | null = null
    let nextFlags: string[] | null = null
    let label = ''

    if (result.mapping.slug !== null) {
      // Pass-1 OR pass-2 hit. Distinguish by the extra_flags returned: the
      // source-fallback always carries 'source_default_reason'.
      const isFallback = result.extra_flags.includes('source_default_reason')
      nextMapping = result.mapping
      nextFlags = flags.filter(f => f !== 'unmapped_reason')
      for (const f of result.extra_flags) {
        if (!nextFlags.includes(f)) nextFlags.push(f)
      }
      if (isFallback) {
        label = `pass-2 source-default → ${result.mapping.slug}`
        pass2FallbackHits++
      } else {
        label = `pass-1 (${result.mapping.confidence}) → ${result.mapping.slug}`
        pass1PatternHits++
      }
    } else if (notes) {
      // Pass-3: broad keyword heuristic. Only meaningful when notes have
      // content — mapReason already handled the empty/trivial case above.
      const broad = inferReasonsBroad(notes)
      if (broad.length > 0) {
        nextMapping = { slug: broad[0], confidence: 'low' }
        nextFlags = flags // keep unmapped_reason — signals "guessed via broad heuristic"
        label = `pass-3 (low) → ${broad[0]}${broad.length > 1 ? ` (also: ${broad.slice(1).join(', ')})` : ''}`
        pass3BroadHits++
      } else {
        noSignal++
        continue
      }
    } else {
      // Empty notes AND no fallback configured for this source/section.
      emptyNotes++
      continue
    }

    console.log(`[${row.id}] ${title}`)
    console.log(`  notes: ${notes.slice(0, 160)}${notes.length > 160 ? '…' : ''}`)
    console.log(`  → ${label}`)

    if (!WRITE) continue

    const newAgreementDetails = {
      ...ad,
      reason_mapping: nextMapping,
      quality_flags: nextFlags,
    }
    const { error } = await s
      .from('import_review_queue')
      .update({ agreement_details: newAgreementDetails })
      .eq('id', row.id)
      .eq('status', 'pending_review') // guard: don't touch already-reviewed rows
    if (error) {
      console.error(`  ✗ update error: ${error.message}`)
      errors++
    }
  }

  console.log('\n──────────── Summary ────────────')
  console.log(`Total inspected:           ${rows.length}`)
  console.log(`Pass-1 strict pattern hits: ${pass1PatternHits}   (slug filled, unmapped_reason flag removed)`)
  console.log(`Pass-2 source-default hits: ${pass2FallbackHits}   (slug from section fallback; source_default_reason flag added)`)
  console.log(`Pass-3 broad-heuristic hits: ${pass3BroadHits}   (low-confidence guess; unmapped_reason flag kept)`)
  console.log(`Empty notes (skipped):     ${emptyNotes}   (no notes AND no source fallback configured)`)
  console.log(`No signal (skipped):       ${noSignal}   (notes have text but no pattern matched)`)
  if (WRITE) console.log(`Update errors:             ${errors}`)
  if (!WRITE) console.log(`\n[DRY-RUN] Re-run with --apply to persist.`)
}

main().catch(e => { console.error(e); process.exit(1) })
