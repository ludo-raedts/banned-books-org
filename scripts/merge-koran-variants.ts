#!/usr/bin/env tsx
// Merge Koran/Qur'an variants. Two phases:
//
// Phase 1 — Vague "Anonymous" KDN gazette translations of the Qur'an
//   (no identifiable translator) collapse into the canonical Qur'an
//   record #7327.
//     #13257 "Terjemahan Al-qur'an"
//     #13259 "The Meaning of the Glorious Qur'an Korean Edition"
//     #13260 "The Meaning of the Holy Quran ( Chinese Translation Edition)"
//     #13262 "Terjemahan Al-quran Bahasa Melayu"
//
// Phase 2 — Three KDN gazette editions of Abdullah Yusuf Ali's translation
//   collapse into a single Yusuf Ali record. Different publishers per
//   gazette, same translation. Survivor is #13261 (best-typed title);
//   afterwards we rename it to the canonical "The Holy Quran (Abdullah
//   Yusuf Ali translation)".
//     #13258 "Al-qur'an Translation"
//     #13261 "The Quran Modern English Translation"    ← KEEP
//     #13263 "Translation of the Quran"
//
// Phase 3 — Title fix:
//   #11239 scraper-truncated "The Koran..." → "The Koran"
//   #13261 rename to "The Holy Quran (Abdullah Yusuf Ali translation)"
//
// Per DROP we:
//   1. Migrate bans. Ban-unique key is
//      (book_id, country_code, year_started, scope_id, region, institution).
//      Collisions union sources/reasons and append the DROP ban description
//      (which already encodes publisher / printer / language) with an
//      "Edition: <DROP title>" header so per-edition KDN signal survives
//      in a single ban row.
//   2. Migrate slug aliases (re-point existing, insert DROP.slug as new).
//   3. DELETE DROP. CASCADE handles book_authors / cover_search_attempts /
//      residual bans/links.
//
// Idempotent. If DROP is already gone, the pair is a no-op.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/merge-koran-variants.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/merge-koran-variants.ts --write

import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')

type MergeBatch = {
  label: string
  keep: number
  drops: number[]
}

const MERGES: MergeBatch[] = [
  {
    label: 'Phase 1 — Anonymous KDN translations → canonical Qur\'an',
    keep: 7327,
    drops: [13257, 13259, 13260, 13262],
  },
  {
    label: 'Phase 2 — Abdullah Yusuf Ali translation editions',
    keep: 13261,
    drops: [13258, 13263],
  },
]

const TITLE_FIXES: { book: number; title: string }[] = [
  { book: 11239, title: 'The Koran' },
  { book: 13261, title: 'The Holy Quran (Abdullah Yusuf Ali translation)' },
]

type Ban = {
  id: number
  country_code: string
  scope_id: number | null
  action_type: string | null
  status: string | null
  year_started: number | null
  year_ended: number | null
  region: string | null
  institution: string | null
  actor: string | null
  description: string | null
  confidence: string | null
}

type BookRow = { id: number; slug: string; title: string }

function banKey(b: Ban): string {
  return [
    b.country_code,
    b.year_started ?? '',
    b.scope_id ?? '',
    b.region ?? '',
    b.institution ?? '',
  ].join('|')
}

function annotateOnInsert(dropTitle: string, baseDesc: string | null): string {
  const header = `Edition: ${dropTitle}`
  if (!baseDesc) return header
  return `${header}\n${baseDesc}`
}

function annotateOnUnion(
  existingDesc: string | null,
  dropTitle: string,
  dropDesc: string | null,
): string {
  const addition = annotateOnInsert(dropTitle, dropDesc)
  if (!existingDesc) return addition
  if (existingDesc.includes(`Edition: ${dropTitle}`)) return existingDesc
  return `${existingDesc}\n---\n${addition}`
}

async function getBook(
  s: ReturnType<typeof adminClient>,
  id: number,
): Promise<BookRow | null> {
  const { data } = await s.from('books').select('id, slug, title').eq('id', id).maybeSingle()
  return (data as BookRow) ?? null
}

async function getBans(
  s: ReturnType<typeof adminClient>,
  bookId: number,
): Promise<Ban[]> {
  const { data } = await s
    .from('bans')
    .select(
      'id, country_code, scope_id, action_type, status, year_started, year_ended, region, institution, actor, description, confidence',
    )
    .eq('book_id', bookId)
  return (data ?? []) as Ban[]
}

async function getBanLinks(s: ReturnType<typeof adminClient>, banId: number) {
  const [{ data: src }, { data: rsn }] = await Promise.all([
    s.from('ban_source_links').select('source_id, locator').eq('ban_id', banId),
    s.from('ban_reason_links').select('reason_id').eq('ban_id', banId),
  ])
  return {
    sources: (src ?? []) as { source_id: number; locator: string | null }[],
    reasons: (rsn ?? []).map((r) => r.reason_id as number),
  }
}

async function mergeDrop(
  s: ReturnType<typeof adminClient>,
  keep: BookRow,
  dropId: number,
  keepBansByKey: Map<string, Ban>,
): Promise<{ ok: boolean; note: string }> {
  const drop = await getBook(s, dropId)
  if (!drop) return { ok: true, note: `drop #${dropId} already gone — no-op` }

  console.log(`\n──── #${drop.id} "${drop.title}" → #${keep.id} "${keep.title}"`)

  // 1. Migrate bans
  const dropBans = await getBans(s, drop.id)
  for (const db of dropBans) {
    const links = await getBanLinks(s, db.id)
    const target = keepBansByKey.get(banKey(db))

    if (target) {
      const newDesc = annotateOnUnion(target.description, drop.title, db.description)
      console.log(
        `  → ban ${db.country_code}/${db.year_started ?? '?'}: UNION onto KEEP ban #${target.id}  (+${links.sources.length} src, +${links.reasons.length} rsn)`,
      )
      if (WRITE) {
        if (newDesc !== target.description) {
          const { error: descErr } = await s
            .from('bans')
            .update({ description: newDesc })
            .eq('id', target.id)
          if (descErr) return { ok: false, note: `desc update failed: ${descErr.message}` }
          target.description = newDesc
        }
        for (const l of links.sources) {
          await s.from('ban_source_links').upsert(
            { ban_id: target.id, source_id: l.source_id, locator: l.locator },
            { onConflict: 'ban_id,source_id', ignoreDuplicates: true },
          )
        }
        for (const rid of links.reasons) {
          await s.from('ban_reason_links').upsert(
            { ban_id: target.id, reason_id: rid },
            { onConflict: 'ban_id,reason_id', ignoreDuplicates: true },
          )
        }
      }
    } else {
      const insertDesc = annotateOnInsert(drop.title, db.description)
      console.log(
        `  → ban ${db.country_code}/${db.year_started ?? '?'}: INSERT on KEEP  (carry ${links.sources.length} src, ${links.reasons.length} rsn)`,
      )
      if (WRITE) {
        const { data: newBan, error } = await s
          .from('bans')
          .insert({
            book_id: keep.id,
            country_code: db.country_code,
            scope_id: db.scope_id,
            action_type: db.action_type,
            status: db.status,
            year_started: db.year_started,
            year_ended: db.year_ended,
            region: db.region,
            institution: db.institution,
            actor: db.actor,
            description: insertDesc,
            confidence: db.confidence,
          })
          .select(
            'id, country_code, scope_id, action_type, status, year_started, year_ended, region, institution, actor, description, confidence',
          )
          .single()
        if (error || !newBan) return { ok: false, note: `ban insert failed: ${error?.message ?? 'no row'}` }
        for (const l of links.sources) {
          await s.from('ban_source_links').upsert(
            { ban_id: newBan.id, source_id: l.source_id, locator: l.locator },
            { onConflict: 'ban_id,source_id', ignoreDuplicates: true },
          )
        }
        for (const rid of links.reasons) {
          await s.from('ban_reason_links').upsert(
            { ban_id: newBan.id, reason_id: rid },
            { onConflict: 'ban_id,reason_id', ignoreDuplicates: true },
          )
        }
        keepBansByKey.set(banKey(db), newBan as Ban)
      } else {
        keepBansByKey.set(banKey(db), { ...db, description: insertDesc, id: -1 })
      }
    }
  }

  // 2. Migrate slug aliases
  const { data: existingAliases } = await s
    .from('book_slug_aliases')
    .select('slug, source')
    .eq('book_id', drop.id)
  for (const a of existingAliases ?? []) {
    console.log(`  → reassign alias "${a.slug}" → KEEP`)
    if (WRITE) {
      const { error } = await s
        .from('book_slug_aliases')
        .update({ book_id: keep.id })
        .eq('slug', a.slug)
      if (error && !/duplicate|unique/i.test(error.message)) {
        console.log(`     alias move failed: ${error.message}`)
      }
    }
  }
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

  // 3. Delete DROP (CASCADE removes book_authors / residual bans / etc.)
  console.log(`  → DELETE book #${drop.id} (CASCADE)`)
  if (WRITE) {
    const { error } = await s.from('books').delete().eq('id', drop.id)
    if (error) return { ok: false, note: `delete failed: ${error.message}` }
  }

  return { ok: true, note: 'merged' }
}

async function runMergeBatch(s: ReturnType<typeof adminClient>, batch: MergeBatch) {
  console.log(`\n========================================`)
  console.log(batch.label)
  console.log(`========================================`)
  const keep = await getBook(s, batch.keep)
  if (!keep) {
    console.error(`KEEP #${batch.keep} not found — skipping batch.`)
    return { ok: 0, skipped: 0, failed: 1 }
  }
  const keepBans = await getBans(s, keep.id)
  const keepBansByKey = new Map(keepBans.map((b) => [banKey(b), b]))
  console.log(`KEEP "${keep.title}" (/${keep.slug}) currently has ${keepBans.length} bans.`)

  let ok = 0
  let skipped = 0
  let failed = 0
  for (let i = 0; i < batch.drops.length; i++) {
    const dropId = batch.drops[i]
    process.stdout.write(`\n[${i + 1}/${batch.drops.length}] `)
    try {
      const r = await mergeDrop(s, keep, dropId, keepBansByKey)
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
  return { ok, skipped, failed }
}

async function applyTitleFixes(s: ReturnType<typeof adminClient>) {
  console.log(`\n========================================`)
  console.log(`Phase 3 — Title fixes`)
  console.log(`========================================`)
  for (const { book, title } of TITLE_FIXES) {
    const b = await getBook(s, book)
    if (!b) {
      console.log(`  ∅ #${book}: not found — skipped`)
      continue
    }
    if (b.title === title) {
      console.log(`  = #${book}: already "${title}" — no change`)
      continue
    }
    console.log(`  → #${book}: "${b.title}" → "${title}"`)
    if (WRITE) {
      const { error } = await s.from('books').update({ title }).eq('id', book)
      if (error) console.log(`     update failed: ${error.message}`)
    }
  }
}

async function main() {
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}`)
  const s = adminClient()

  let totalOk = 0
  let totalSkipped = 0
  let totalFailed = 0
  for (const batch of MERGES) {
    const r = await runMergeBatch(s, batch)
    totalOk += r.ok
    totalSkipped += r.skipped
    totalFailed += r.failed
  }

  await applyTitleFixes(s)

  console.log(`\n========================================`)
  console.log(
    `Done. ${WRITE ? 'Applied' : 'Would apply'}: ${totalOk} merges.  Skipped: ${totalSkipped}.  Failed: ${totalFailed}.`,
  )
  if (!WRITE) console.log(`Re-run with --write to apply.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
