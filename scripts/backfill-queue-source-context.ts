#!/usr/bin/env tsx
/**
 * One-off backfill: write `agreement_details.source_context` for every
 * import_review_queue row that doesn't yet have one. New queue rows get
 * source_context written at insert time by src/lib/wikipedia/importer.ts
 * (commitReview); this script catches rows inserted before that change
 * landed.
 *
 * source_context is the self-contained snapshot of (country_code,
 * source_url, source_name, source_type, scope/action/status defaults) that
 * the admin /import-review approve flow uses when WIKIPEDIA_SOURCES doesn't
 * recognise the slug (typically: queue row inserted by a newer build, but
 * production hasn't redeployed yet). Without it, the approve form throws
 * "No source-config found for slug 'wikipedia-X'" and editors are blocked.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/backfill-queue-source-context.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/backfill-queue-source-context.ts --apply
 */
import { adminClient } from '../src/lib/supabase'
import { WIKIPEDIA_SOURCES } from '../src/lib/wikipedia/config'

const APPLY = process.argv.includes('--apply')

type AgreementDetails = {
  page?: string
  section_anchor?: string
  parsed_row?: { source_anchor?: string }
  source_context?: Record<string, unknown>
  [k: string]: unknown
}

async function main() {
  const sb = adminClient()
  console.log(`\n── backfill-queue-source-context (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  // Slug → SourceConfig lookup
  const bySlug = new Map<string, typeof WIKIPEDIA_SOURCES[string]>()
  for (const cfg of Object.values(WIKIPEDIA_SOURCES)) bySlug.set(cfg.source_slug, cfg)

  // Page through all queue rows (pending OR approved — approved rows don't
  // need it for approve flow, but writing it keeps the data consistent and
  // future-proofs any retrospective UI that surfaces archived rows).
  const all: Array<{
    id: number
    source_slug: string
    agreement_details: AgreementDetails | null
  }> = []
  const PAGE = 1000
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('import_review_queue')
      .select('id, source_slug, agreement_details')
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(
      ...(data as unknown as Array<{ id: number; source_slug: string; agreement_details: AgreementDetails | null }>),
    )
    if (data.length < PAGE) break
    offset += PAGE
  }
  console.log(`Total queue rows: ${all.length}`)

  let alreadyHas = 0
  let updated = 0
  let unknownSlug = 0
  let noSection = 0
  const slugCounts: Record<string, number> = {}

  for (const row of all) {
    const ad = (row.agreement_details ?? {}) as AgreementDetails
    if (ad.source_context && Object.keys(ad.source_context).length > 0) {
      alreadyHas++
      continue
    }
    const cfg = bySlug.get(row.source_slug)
    if (!cfg) {
      unknownSlug++
      slugCounts[row.source_slug] = (slugCounts[row.source_slug] ?? 0) + 1
      continue
    }
    const sectionAnchor =
      ad.parsed_row?.source_anchor ?? ad.section_anchor ?? ''
    const section =
      cfg.sections.find(s => s.heading.replace(/ /g, '_') === sectionAnchor)
      ?? cfg.sections[0]
    if (!section) { noSection++; continue }
    const countryCode = section.country_code ?? cfg.country_code
    if (!countryCode) { noSection++; continue }

    const page = (ad.page as string | undefined) ?? cfg.page
    const sourceUrl = `https://en.wikipedia.org/wiki/${page}#${sectionAnchor}`
    const sourceContext = {
      country_code: countryCode,
      source_url: sourceUrl,
      source_name: `Wikipedia: ${page.replace(/_/g, ' ')}`,
      source_type: cfg.source_type,
      section_heading: section.heading,
      scope_default: section.scope_default,
      action_type_default: section.action_type_default,
      status_default: section.status_default,
    }
    const newAd: AgreementDetails = { ...ad, source_context: sourceContext }

    if (APPLY) {
      const { error: upErr } = await sb
        .from('import_review_queue')
        .update({ agreement_details: newAd as unknown as Record<string, unknown> })
        .eq('id', row.id)
      if (upErr) {
        console.error(`  ✗ id=${row.id}: ${upErr.message}`)
        continue
      }
    }
    updated++
  }

  console.log()
  console.log(`Already has source_context: ${alreadyHas}`)
  console.log(`${APPLY ? 'Updated' : 'Would update'}:               ${updated}`)
  console.log(`Unknown source_slug:         ${unknownSlug}`)
  if (unknownSlug > 0) {
    for (const [s, n] of Object.entries(slugCounts)) {
      console.log(`  ${s}: ${n}`)
    }
  }
  console.log(`No section/country resolvable: ${noSection}`)

  if (!APPLY) console.log(`\nPass --apply to write.`)
}

main().catch(e => { console.error(e); process.exit(1) })
