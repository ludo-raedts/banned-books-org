#!/usr/bin/env tsx
// Merge parenthetical-suffix duplicate books surfaced by
// _audit_paren_suffix_dupes.ts (see data/paren-suffix-dupes.json).
//
// For each (KEEP, DROP) pair:
//   1. Enrich KEEP's NULL scalar fields from DROP so we don't lose ISBNs,
//      OL work IDs, year, descriptions, etc. (KEEP-set values win — the
//      audit chose KEEP as the cleaner row, so its set values are canonical.)
//   2. Migrate bans:
//        - Match on full unique key (country, year, scope, region, institution).
//        - If KEEP already has the matching ban → union ban_source_links and
//          ban_reason_links onto it (UPSERT-safe via composite PK).
//        - Else → INSERT a new ban on KEEP, copying scope/action/status/year
//          and re-attaching the source/reason links.
//   3. Migrate slug aliases:
//        - Re-point any existing alias rows from DROP onto KEEP.
//        - Insert DROP.slug as a new alias on KEEP (source='legacy_slug'),
//          ignoring PK conflicts (slug already aliased elsewhere).
//   4. DELETE DROP from books. CASCADE removes its residual bans/links,
//      book_authors, purchase_links, cover_search_attempts,
//      description_search_attempts, bbw_featured_selections,
//      reading_club_*, and any remaining book_slug_aliases.
//
// import_queue.approved_book_id is ON DELETE SET NULL, so any queue rows
// previously approved against DROP get null-ed — acceptable, those queue
// rows are already in 'approved' state and the audit trail survives.
//
// Idempotent: if DROP no longer exists, the pair is logged as already-done.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/merge-paren-suffix-dupes.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/merge-paren-suffix-dupes.ts --write

import { readFileSync } from 'fs'
import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')
const FILE_ARG = process.argv.find(a => a.startsWith('--file='))
const PAIRS_FILE = FILE_ARG ? FILE_ARG.split('=')[1] : 'data/paren-suffix-dupes.json'

type Pair = {
  keep: number
  drop: number
  keep_title: string
  drop_title: string
  confidence: 'high' | 'medium'
  reasons: string[]
  flags: string[]
}

type BookRow = {
  id: number
  slug: string
  title: string
  isbn13: string | null
  original_language: string | null
  first_published_year: number | null
  description: string | null
  description_book: string | null
  description_ban: string | null
  openlibrary_work_id: string | null
  cover_url: string | null
  gutenberg_id: number | null
  censorship_context: string | null
  inclusion_rationale: string | null
  extended_context: string | null
}

type Ban = {
  id: number
  country_code: string
  scope_id: number | null
  action_type: string | null
  status: string | null
  year_started: number | null
  region: string | null
  institution: string | null
  actor: string | null
  description: string | null
}

// Fields where any data beats NULL — copied from DROP iff KEEP is null.
const ENRICH_FIELDS = [
  'isbn13',
  'original_language',
  'first_published_year',
  'description',
  'description_book',
  'description_ban',
  'openlibrary_work_id',
  'cover_url',
  'gutenberg_id',
  'censorship_context',
  'inclusion_rationale',
  'extended_context',
] as const

async function getBook(s: ReturnType<typeof adminClient>, id: number): Promise<BookRow | null> {
  const { data } = await s
    .from('books')
    .select('id, slug, title, ' + ENRICH_FIELDS.join(', '))
    .eq('id', id)
    .maybeSingle()
  return (data as unknown as BookRow) ?? null
}

async function getBans(s: ReturnType<typeof adminClient>, bookId: number): Promise<Ban[]> {
  const { data } = await s
    .from('bans')
    .select('id, country_code, scope_id, action_type, status, year_started, region, institution, actor, description')
    .eq('book_id', bookId)
  return (data ?? []) as Ban[]
}

async function getBanLinks(s: ReturnType<typeof adminClient>, banId: number) {
  const [{ data: src }, { data: rsn }] = await Promise.all([
    s.from('ban_source_links').select('source_id').eq('ban_id', banId),
    s.from('ban_reason_links').select('reason_id').eq('ban_id', banId),
  ])
  return {
    sources: (src ?? []).map(r => r.source_id as number),
    reasons: (rsn ?? []).map(r => r.reason_id as number),
  }
}

function banKey(b: Ban): string {
  return [b.country_code, b.year_started ?? '', b.scope_id ?? '', b.region ?? '', b.institution ?? ''].join('|')
}

async function mergePair(s: ReturnType<typeof adminClient>, p: Pair): Promise<{ ok: boolean; note: string }> {
  const [keep, drop] = await Promise.all([getBook(s, p.keep), getBook(s, p.drop)])

  if (!drop) return { ok: true, note: `drop #${p.drop} already gone — no-op` }
  if (!keep) return { ok: false, note: `keep #${p.keep} not found — aborting pair` }

  console.log(`\n──── #${drop.id} "${drop.title}" → #${keep.id} "${keep.title}"`)
  console.log(`     (${p.confidence}: ${p.reasons.join('; ')}${p.flags.length ? '; ⚠ ' + p.flags.join(', ') : ''})`)

  // Cache enrich values now — DROP itself owns unique-constrained values
  // (e.g. isbn13) so we can't UPDATE them onto KEEP while DROP still exists.
  // Apply enrich at the END, after DROP is deleted and uniqueness is freed.
  const enrich: Record<string, unknown> = {}
  for (const f of ENRICH_FIELDS) {
    if ((keep as any)[f] == null && (drop as any)[f] != null) {
      enrich[f] = (drop as any)[f]
    }
  }

  // 1. Migrate bans
  const [keepBans, dropBans] = await Promise.all([getBans(s, keep.id), getBans(s, drop.id)])
  const keepBansByKey = new Map(keepBans.map(b => [banKey(b), b]))

  for (const db of dropBans) {
    const links = await getBanLinks(s, db.id)
    const target = keepBansByKey.get(banKey(db))

    if (target) {
      console.log(`  → ban ${db.country_code}/${db.year_started ?? '?'}/scope=${db.scope_id ?? '?'}${db.region ? `/${db.region}` : ''}${db.institution ? `/${db.institution}` : ''}: union ${links.sources.length} src + ${links.reasons.length} rsn onto KEEP ban #${target.id}`)
      if (WRITE) {
        for (const sid of links.sources) {
          await s.from('ban_source_links').upsert({ ban_id: target.id, source_id: sid }, { onConflict: 'ban_id,source_id', ignoreDuplicates: true })
        }
        for (const rid of links.reasons) {
          await s.from('ban_reason_links').upsert({ ban_id: target.id, reason_id: rid }, { onConflict: 'ban_id,reason_id', ignoreDuplicates: true })
        }
      }
    } else {
      console.log(`  → ban ${db.country_code}/${db.year_started ?? '?'}/scope=${db.scope_id ?? '?'}: insert on KEEP + carry ${links.sources.length} src + ${links.reasons.length} rsn`)
      if (WRITE) {
        const { data: newBan, error } = await s.from('bans').insert({
          book_id: keep.id,
          country_code: db.country_code,
          scope_id: db.scope_id,
          action_type: db.action_type,
          status: db.status,
          year_started: db.year_started,
          region: db.region,
          institution: db.institution,
          actor: db.actor,
          description: db.description,
        }).select('id').single()
        if (error || !newBan) return { ok: false, note: `ban insert failed: ${error?.message ?? 'no row'}` }
        for (const sid of links.sources) {
          await s.from('ban_source_links').upsert({ ban_id: newBan.id, source_id: sid }, { onConflict: 'ban_id,source_id', ignoreDuplicates: true })
        }
        for (const rid of links.reasons) {
          await s.from('ban_reason_links').upsert({ ban_id: newBan.id, reason_id: rid }, { onConflict: 'ban_id,reason_id', ignoreDuplicates: true })
        }
        // Local cache so subsequent dropBans with same key fold onto this row
        keepBansByKey.set(banKey(db), { ...db, id: newBan.id })
      }
    }
  }

  // 2. Migrate slug aliases
  const { data: existingAliases } = await s.from('book_slug_aliases').select('slug, source').eq('book_id', drop.id)
  for (const a of existingAliases ?? []) {
    console.log(`  → reassign alias "${a.slug}" → KEEP`)
    if (WRITE) {
      // Could collide if KEEP already has an alias with the same slug — rare.
      // PK is slug, so the existing alias just stays where it is; we'd see a
      // unique error. Ignore that and continue.
      const { error } = await s.from('book_slug_aliases').update({ book_id: keep.id }).eq('slug', a.slug)
      if (error && !/duplicate|unique/i.test(error.message)) {
        console.log(`     alias move failed: ${error.message}`)
      }
    }
  }

  // 2b. Insert DROP.slug as a new alias on KEEP
  if (drop.slug && drop.slug !== keep.slug) {
    console.log(`  → insert alias "${drop.slug}" → KEEP #${keep.id}`)
    if (WRITE) {
      const { error } = await s.from('book_slug_aliases').insert({
        slug: drop.slug,
        book_id: keep.id,
        source: 'legacy_slug',
      })
      if (error && !/duplicate|unique/i.test(error.message)) {
        console.log(`     alias insert failed: ${error.message}`)
      }
    }
  }

  // 3. Delete DROP — frees up unique-constrained values (isbn13, slug) so
  //    enrich can land on KEEP. CASCADE removes residual child rows.
  console.log(`  → DELETE book #${drop.id} (CASCADE)`)
  if (WRITE) {
    const { error } = await s.from('books').delete().eq('id', drop.id)
    if (error) return { ok: false, note: `delete failed: ${error.message}` }
  }

  // 4. Apply enrichment now that DROP no longer holds unique values.
  if (Object.keys(enrich).length > 0) {
    console.log(`  → enrich KEEP: ${Object.keys(enrich).join(', ')}`)
    if (WRITE) {
      const { error } = await s.from('books').update(enrich).eq('id', keep.id)
      if (error) {
        if (/duplicate|unique/i.test(error.message)) {
          // A *different* third row still owns one of the values. Retry per-
          // field so non-colliding fields still land.
          console.log(`     batch enrich hit ${error.message.slice(0, 80)} — retrying per field`)
          for (const [f, v] of Object.entries(enrich)) {
            const { error: e2 } = await s.from('books').update({ [f]: v }).eq('id', keep.id)
            if (e2) {
              if (/duplicate|unique/i.test(e2.message)) {
                console.log(`     skip ${f}: collides with another row (third-party owner)`)
              } else {
                console.log(`     ${f} failed: ${e2.message}`)
              }
            }
          }
        } else {
          console.log(`     enrich failed: ${error.message}`)
        }
      }
    }
  }

  return { ok: true, note: 'merged' }
}

async function main() {
  const raw = readFileSync(PAIRS_FILE, 'utf8')
  const pairs: Pair[] = JSON.parse(raw)

  console.log(`Loaded ${pairs.length} pairs from ${PAIRS_FILE}`)
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}\n`)

  const s = adminClient()
  let ok = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i]
    process.stdout.write(`[${i + 1}/${pairs.length}] `)
    try {
      const r = await mergePair(s, p)
      if (r.ok && r.note === 'merged') {
        ok++
        console.log(`  ✓ done`)
      } else if (r.ok) {
        skipped++
        console.log(`  ∅ skip: ${r.note}`)
      } else {
        failed++
        console.log(`  ✗ FAIL: ${r.note}`)
      }
    } catch (e) {
      failed++
      console.log(`  ✗ EXCEPTION: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log(`\nDone. ${WRITE ? 'Applied' : 'Would apply'}: ${ok}.  Skipped: ${skipped}.  Failed: ${failed}.`)
  if (!WRITE) console.log(`\nRe-run with --write to apply.`)
}

main().catch(e => { console.error(e); process.exit(1) })
