#!/usr/bin/env tsx
// Category-A duplicate merges (placeholder/subtitle-variant records that map
// onto an existing canonical book). For each [keepSlug, deleteSlug] pair:
//
//   1. Copy description from delete → keep iff keep has none.
//   2. For each ban on delete-side:
//      - If keep has a matching (country, year_started) ban: union its
//        ban_source_links + ban_reason_links onto the keep ban (idempotent
//        via PK conflicts).
//      - Else: insert a new ban on keep and copy the links.
//   3. Insert delete.slug as a slug-alias of keep so inbound URLs still
//      resolve via 301. Move any aliases that already point at delete onto
//      keep first.
//   4. Delete the duplicate book — CASCADE drops its bans, ban links,
//      book_authors, purchase_links, reading_club_*, bbw_featured_selections,
//      cover_search_attempts, description_search_attempts.
//
// Run with `--write` to apply. Without it, prints planned mutations only.

import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')

const PAIRS: Array<[string, string, string?]> = [
  ['a-clockwork-orange', 'clockwork-orange', 'placeholder duplicate (US ban)'],
  ['a-clockwork-orange', 'a-clockwork-orange-authoritative-text-backgrounds-and-contexts-criticism', 'study-edition placeholder'],
  ['the-lord-of-the-flies', 'lord-of-the-flies', 'article variant placeholder'],
  ['tilt-eh', 'tilt', 'placeholder duplicate (Ellen Hopkins, US)'],
  ['forever-judy-blume', 'forever', 'placeholder (Judy Blume, US)'],
  ['the-other-boy', 'other-boy', 'placeholder (Hennessey, US)'],
  ['kaffir-boy', 'kaffir-boy-an-autobiography-the-true-story-of-a-black-youths-coming-of-age-in-apartheid-south-africa', 'subtitle explosion'],
  ['wild-swans', 'wild-swans-three-daughters-of-china', 'subtitle variant'],
  ['unfree-speech', 'unfree-speech-the-threat-to-global-democracy-and-why-we-must-act-now', 'subtitle variant'],
  ['great-soul', 'great-soul-mahatma-gandhi-and-his-struggle-with-india', 'subtitle variant'],
  ['sex-education', 'sex-education-title-only-no-further-information', 'junk placeholder'],
  ['fun-home', 'fun-home-a-family-tragicomic', 'official subtitle of same work'],
  ['speak', 'speak-audio', 'audio-edition placeholder'],
  ['inuyasha-series-title-not-specified', 'inu-yasha-ani-manga-series-title-not-specified', 'duplicate series-umbrella placeholder'],
  ['gaie-france', 'gaie-france-magazine', 'same French magazine — renamed ca. 1992; 1992 and 1994 decrees on same publication'],
]

type Ban = {
  id: number
  country_code: string
  scope_id: number | null
  action_type: string | null
  status: string | null
  year_started: number | null
  actor: string | null
  description: string | null
}

async function getBook(s: ReturnType<typeof adminClient>, slug: string) {
  const { data } = await s
    .from('books')
    .select('id, slug, title, description, first_published_year')
    .eq('slug', slug)
    .maybeSingle()
  return data
}

async function getBans(s: ReturnType<typeof adminClient>, bookId: number): Promise<Ban[]> {
  const { data } = await s
    .from('bans')
    .select('id, country_code, scope_id, action_type, status, year_started, actor, description')
    .eq('book_id', bookId)
  return (data ?? []) as Ban[]
}

async function getLinks(s: ReturnType<typeof adminClient>, banId: number) {
  const [{ data: src }, { data: rsn }] = await Promise.all([
    s.from('ban_source_links').select('source_id').eq('ban_id', banId),
    s.from('ban_reason_links').select('reason_id').eq('ban_id', banId),
  ])
  return {
    sources: (src ?? []).map(r => r.source_id as number),
    reasons: (rsn ?? []).map(r => r.reason_id as number),
  }
}

async function mergePair(keepSlug: string, delSlug: string, note: string) {
  const s = adminClient()
  console.log(`\n──── ${delSlug} → ${keepSlug}  (${note})`)

  const [keep, del] = await Promise.all([getBook(s, keepSlug), getBook(s, delSlug)])
  if (!keep) { console.log(`  ❌ keep "${keepSlug}" not found`); return }
  if (!del)  { console.log(`  ✓ delete "${delSlug}" already gone (no-op)`); return }

  // 1. Description copy
  if (!keep.description && del.description) {
    console.log(`  → would copy description (${del.description.length}c) from delete`)
    if (WRITE) {
      await s.from('books').update({ description: del.description }).eq('id', keep.id)
    }
  }

  // 2. Ban migration with link preservation
  const [keepBans, delBans] = await Promise.all([getBans(s, keep.id), getBans(s, del.id)])

  for (const db of delBans) {
    const links = await getLinks(s, db.id)
    // Only union when (country, year) match exactly — different years on the
    // same country are separate ban events and stay as separate rows so the
    // timeline survives.
    const target = keepBans.find(kb => kb.country_code === db.country_code && kb.year_started === db.year_started)

    if (target) {
      console.log(`  → ban ${db.country_code} y=${db.year_started ?? '?'}: union ${links.sources.length} sources + ${links.reasons.length} reasons into keep ban #${target.id} (y=${target.year_started ?? '?'})`)
      if (WRITE) {
        for (const sid of links.sources) {
          await s.from('ban_source_links').upsert({ ban_id: target.id, source_id: sid })
        }
        for (const rid of links.reasons) {
          await s.from('ban_reason_links').upsert({ ban_id: target.id, reason_id: rid })
        }
      }
    } else {
      console.log(`  → ban ${db.country_code} y=${db.year_started ?? '?'}: insert new on keep, carry ${links.sources.length} sources + ${links.reasons.length} reasons`)
      if (WRITE) {
        const { data: newBan, error } = await s.from('bans').insert({
          book_id: keep.id,
          country_code: db.country_code,
          scope_id: db.scope_id,
          action_type: db.action_type,
          status: db.status,
          year_started: db.year_started,
          actor: db.actor,
          description: db.description,
        }).select('id').single()
        if (error || !newBan) { console.error(`    ban insert failed: ${error?.message}`); continue }
        for (const sid of links.sources) {
          await s.from('ban_source_links').upsert({ ban_id: newBan.id, source_id: sid })
        }
        for (const rid of links.reasons) {
          await s.from('ban_reason_links').upsert({ ban_id: newBan.id, reason_id: rid })
        }
      }
    }
  }

  // 3. Aliases
  // 3a. Move existing aliases that point at delete → point at keep
  const { data: existingAliases } = await s.from('book_slug_aliases').select('slug, source').eq('book_id', del.id)
  for (const a of existingAliases ?? []) {
    console.log(`  → reassign existing alias "${a.slug}" from delete to keep`)
    if (WRITE) {
      await s.from('book_slug_aliases').update({ book_id: keep.id }).eq('slug', a.slug)
    }
  }

  // 3b. Insert delete's slug as alias for keep (skip if conflict — could already be reserved)
  console.log(`  → insert slug-alias "${del.slug}" → keep #${keep.id}`)
  if (WRITE) {
    const { error: aliasErr } = await s.from('book_slug_aliases').insert({
      slug: del.slug,
      book_id: keep.id,
      source: 'manual',
    })
    if (aliasErr && !aliasErr.message?.includes('duplicate')) {
      console.error(`    alias insert failed: ${aliasErr.message}`)
    }
  }

  // 4. Delete book (CASCADE handles dependents)
  console.log(`  → delete book #${del.id} (CASCADE)`)
  if (WRITE) {
    const { error: delErr } = await s.from('books').delete().eq('id', del.id)
    if (delErr) console.error(`    delete failed: ${delErr.message}`)
    else console.log(`  ✓ done`)
  }
}

async function main() {
  console.log(WRITE ? '═══ WRITE MODE ═══' : '═══ DRY RUN — pass --write to apply ═══')
  for (const [keep, del, note] of PAIRS) {
    await mergePair(keep, del, note ?? '')
  }
  console.log('\nFinished.')
}
main().catch(err => { console.error(err); process.exit(1) })
