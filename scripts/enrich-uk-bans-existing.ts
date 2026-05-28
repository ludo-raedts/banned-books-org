/**
 * Enrich existing bans that were dedup-skipped by import-uk-bans.ts.
 *
 * For each entry whose (book_id, country_code, scope_id, year_started) tuple
 * already exists in `bans`, find the existing ban_id and attach the new
 * collection's ban_source as an additional source link, plus any reason
 * slugs not yet linked to that ban. Native PK upserts handle deduplication.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/enrich-uk-bans-existing.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/enrich-uk-bans-existing.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { slugify } from '../src/lib/imports/slugify'
import { readFileSync } from 'fs'
import { join } from 'path'

const APPLY = process.argv.includes('--apply')
const JSON_PATH = join(process.cwd(), 'data/uk-bans-batch1.json')

interface BanDefaults {
  country_code?: string
  scope?: string
  year_started?: number | null
}
interface Entry extends BanDefaults {
  title: string
  reasons: string[]
}
interface Collection {
  slug: string
  source: { name: string; url: string; type: string }
  ban_defaults: BanDefaults
  entries: Entry[]
}
interface InputFile { collections: Collection[] }

const supabase = adminClient()

async function main() {
  console.log(`\n── enrich-uk-bans-existing ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const input: InputFile = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))

  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const scopeBySlug = new Map<string, number>()
  for (const s of scopes as Array<{ id: number; slug: string }>) scopeBySlug.set(s.slug, s.id)

  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const reasonBySlug = new Map<string, number>()
  for (const r of reasons as Array<{ id: number; slug: string }>) reasonBySlug.set(r.slug, r.id)

  const sourceIdByCollection = new Map<string, number>()
  for (const c of input.collections) {
    const { data: src } = await supabase
      .from('ban_sources').select('id').eq('source_url', c.source.url).maybeSingle()
    if (!src) {
      console.error(`  ! source not found for collection '${c.slug}' — run import-uk-bans.ts --apply first`)
      process.exit(1)
    }
    sourceIdByCollection.set(c.slug, (src as { id: number }).id)
  }

  let sourceLinksAdded = 0, sourceLinksAlready = 0
  let reasonLinksAdded = 0, reasonLinksAlready = 0
  let bansEnriched = 0, bansNotFound = 0, bansSkipped = 0

  for (const c of input.collections) {
    const collectionSourceId = sourceIdByCollection.get(c.slug)!
    for (const e of c.entries) {
      const country = e.country_code ?? c.ban_defaults.country_code
      const scope_slug = e.scope ?? c.ban_defaults.scope
      const year_started = e.year_started ?? c.ban_defaults.year_started ?? null
      if (!country || !scope_slug) { bansSkipped++; continue }
      const scope_id = scopeBySlug.get(scope_slug)
      if (!scope_id) { bansSkipped++; continue }

      const slug = slugify(e.title)
      const { data: book } = await supabase.from('books').select('id, title').eq('slug', slug).maybeSingle()
      if (!book) continue
      const bookId = (book as { id: number; title: string }).id

      // Find existing ban with matching (book_id, country, scope, year_started)
      let query = supabase
        .from('bans').select('id')
        .eq('book_id', bookId).eq('country_code', country).eq('scope_id', scope_id)
      query = year_started == null ? query.is('year_started', null) : query.eq('year_started', year_started)
      const { data: existingBans } = await query
      if (!existingBans || existingBans.length === 0) continue

      // Only act on bans that don't already have a link to this same source.
      // (If they do, the entry already came from our import — that's the
      // 'existing-book' path, not the 'dedup-skipped' path.)
      const banIds = (existingBans as Array<{ id: number }>).map(b => b.id)
      const { data: existingSourceLinks } = await supabase
        .from('ban_source_links').select('ban_id')
        .in('ban_id', banIds).eq('source_id', collectionSourceId)
      const alreadyLinkedBanIds = new Set((existingSourceLinks as Array<{ ban_id: number }>).map(l => l.ban_id))

      for (const banId of banIds) {
        if (alreadyLinkedBanIds.has(banId)) {
          sourceLinksAlready++
          continue
        }
        bansEnriched++
        console.log(`  ${APPLY ? 'enrich' : 'would enrich'} ban_${banId.toString().padStart(5)} "${(book as { title: string }).title.slice(0, 50)}"  + source_${collectionSourceId} (${c.slug})`)
        if (APPLY) {
          const { error: linkErr } = await supabase
            .from('ban_source_links').insert({ ban_id: banId, source_id: collectionSourceId })
          if (linkErr) { console.error(`    ! source link: ${linkErr.message}`); continue }
          sourceLinksAdded++
        }

        // Reason enrichment — add any reason slugs not already linked
        const desiredReasonIds = e.reasons.map(r => reasonBySlug.get(r)).filter((x): x is number => x != null)
        const { data: existingRs } = await supabase
          .from('ban_reason_links').select('reason_id').eq('ban_id', banId)
        const existingReasonIds = new Set((existingRs as Array<{ reason_id: number }>).map(r => r.reason_id))
        const missingReasons = desiredReasonIds.filter(rid => !existingReasonIds.has(rid))
        if (missingReasons.length > 0) {
          console.log(`    + reasons: ${e.reasons.filter(s => missingReasons.includes(reasonBySlug.get(s)!)).join(', ')}`)
          if (APPLY) {
            const { error: rErr } = await supabase
              .from('ban_reason_links').insert(missingReasons.map(rid => ({ ban_id: banId, reason_id: rid })))
            if (rErr) { console.error(`    ! reason links: ${rErr.message}`); continue }
            reasonLinksAdded += missingReasons.length
          }
        }
        reasonLinksAlready += desiredReasonIds.length - missingReasons.length
      }
      void bansNotFound  // unused (we 'continue' instead)
    }
  }

  console.log(`\n── ${APPLY ? 'Done' : 'Dry-run complete'} ──`)
  console.log(`  bans enriched (got new source-link):  ${bansEnriched}`)
  console.log(`  source-links added:                   ${sourceLinksAdded}`)
  console.log(`  source-links already present:         ${sourceLinksAlready}`)
  console.log(`  reason-links added:                   ${reasonLinksAdded}`)
  console.log(`  reason-links already present:         ${reasonLinksAlready}`)
  console.log(`  entries skipped (missing meta):       ${bansSkipped}`)
  if (!APPLY) console.log(`\n  Re-run with --apply.\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
