#!/usr/bin/env tsx
// Merge honorific-prefix duplicate AUTHORS — the recurring Malaysian-import
// artefact where the same person appears twice, once with an Ustaz/Ustazah/
// Haji/Al-Haj honorific and once without (e.g. "Ustaz Ashaari Muhammad" vs
// "Ashaari Muhammad"). Detector: scripts/_audit_honorific_author_dupes.ts
// (one-off; re-derive with the honorific-twin sweep in chat 2026-06-03).
//
// Each PAIR is { keep, drop } — KEEP is the canonical record we fold DROP into.
// Pairs here have been MANUALLY verified (book themes + name match); the raw
// twin-match also surfaces false positives like "Dr Jin"/"Jin" (different
// people) which are intentionally excluded.
//
// Steps per pair (mirrors merge-paren-suffix-dupes.ts doctrine):
//   1. Re-point book_authors rows DROP → KEEP. If KEEP already links that book
//      (book_id,author_id) PK collision), delete DROP's row instead.
//   2. Re-point any author_external_ids / author_links / author_photo_attempts
//      rows DROP → KEEP (ignore PK collisions — KEEP's value wins).
//   3. Enrich KEEP's NULL scalar fields from DROP (bio/years/photo/country).
//   4. DELETE DROP.
// Idempotent: if DROP is already gone, the pair is a no-op.
//
//   npx tsx --env-file=.env.local scripts/merge-honorific-author-dupes.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/merge-honorific-author-dupes.ts --write
import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')

// keep = canonical (plain / fuller name); drop = honorific-prefixed twin.
const PAIRS: { keep: number; drop: number; note: string }[] = [
  { keep: 8309, drop: 8587, note: 'Kurdi Ismail Hj. Za  ←  Ustaz Kurdi Ismail Hj. Za' },
  { keep: 8233, drop: 8195, note: 'Hal Azwan Al-Haj  ←  Ustaz Hal Azwan' },
]

const ENRICH_FIELDS = ['bio', 'birth_year', 'death_year', 'birth_country', 'photo_url',
  'name_native', 'name_transliterated', 'name_english', 'original_language'] as const

const FK_TABLES = ['author_external_ids', 'author_links', 'author_photo_attempts'] as const

async function main() {
  const sb = adminClient()
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}  (${PAIRS.length} pair(s))\n`)

  for (const p of PAIRS) {
    const { data: keep } = await sb.from('authors').select('*').eq('id', p.keep).maybeSingle()
    const { data: drop } = await sb.from('authors').select('*').eq('id', p.drop).maybeSingle()
    console.log(`──── ${p.note}`)
    if (!drop) { console.log(`  ∅ DROP #${p.drop} already gone — no-op\n`); continue }
    if (!keep) { console.log(`  ✗ KEEP #${p.keep} missing — skip pair\n`); continue }

    // 1. book_authors
    const { data: dropLinks } = await sb.from('book_authors').select('book_id, role').eq('author_id', p.drop)
    const { data: keepLinks } = await sb.from('book_authors').select('book_id').eq('author_id', p.keep)
    const keepBooks = new Set((keepLinks ?? []).map(r => r.book_id))
    for (const l of dropLinks ?? []) {
      if (keepBooks.has(l.book_id)) {
        console.log(`  book ${l.book_id}: KEEP already linked → delete DROP row`)
        if (WRITE) await sb.from('book_authors').delete().eq('author_id', p.drop).eq('book_id', l.book_id)
      } else {
        console.log(`  book ${l.book_id}: re-point → KEEP (role=${l.role})`)
        if (WRITE) {
          const { error } = await sb.from('book_authors').update({ author_id: p.keep }).eq('author_id', p.drop).eq('book_id', l.book_id)
          if (error) { console.log(`    ✗ ${error.message}`); }
        }
      }
    }

    // 2. other FK tables
    for (const t of FK_TABLES) {
      const { data, error } = await sb.from(t).select('*').eq('author_id', p.drop)
      if (error) continue // table may not reference author_id in all schemas
      for (const _ of data ?? []) {
        console.log(`  ${t}: re-point row → KEEP`)
        if (WRITE) {
          const { error: e2 } = await sb.from(t).update({ author_id: p.keep }).eq('author_id', p.drop)
          if (e2 && !/duplicate|unique/i.test(e2.message)) console.log(`    ✗ ${e2.message}`)
          break // single update statement moves all rows
        }
      }
    }

    // 3. enrich KEEP nulls from DROP
    const enrich: Record<string, unknown> = {}
    for (const f of ENRICH_FIELDS) {
      if ((keep as any)[f] == null && (drop as any)[f] != null) enrich[f] = (drop as any)[f]
    }
    if (Object.keys(enrich).length) {
      console.log(`  enrich KEEP: ${Object.keys(enrich).join(', ')}`)
      if (WRITE) { const { error } = await sb.from('authors').update(enrich).eq('id', p.keep); if (error) console.log(`    ✗ ${error.message}`) }
    }

    // 4. delete DROP
    console.log(`  DELETE author #${p.drop} (${drop.slug})`)
    if (WRITE) { const { error } = await sb.from('authors').delete().eq('id', p.drop); if (error) console.log(`    ✗ ${error.message}`) }
    console.log()
  }

  console.log(WRITE ? 'Applied.' : 'Dry-run — re-run with --write.')
}
main().catch(e => { console.error(e); process.exit(1) })
