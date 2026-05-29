/**
 * Merge duplicate author rows where one is the other plus a trailing
 * academic / honorific credential ("Geoffrey Lowndes" ↔ "Geoffrey Lowndes
 * P.H.D"). For each group: keep the lowest id, move book_authors links from
 * the duplicates to the keeper, then delete the duplicate rows.
 *
 * Conservative on the credential pattern: requires explicit dots for
 * 1-2-letter degrees (M.A. not "Ma", M.D. not "Md") because those collide
 * with Chinese/Malay surname fragments. Also skips "Unknown" — multiple
 * anonymous attributions in the KDN gazette are not the same author.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/merge-credential-suffix-authors.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/merge-credential-suffix-authors.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

// Trailing patterns we strip when normalising. Dots are REQUIRED for
// short-letter degrees so we don't false-positive on "Ma", "Md", "Ba".
const CREDENTIALS: RegExp[] = [
  /\bp\.?h\.?d\.?$/i,                        // P.H.D, Ph.D, PhD, P.H.D.
  /\bd\.?phil\.?$/i,                         // D.Phil
  /\bm\.d\.?$/i,                             // M.D. — dot required
  /\bm\.a\.?$/i,                             // M.A. — dot required
  /\bb\.a\.?$/i,                             // B.A. — dot required
  /\b(b|m)\.sc\.?$/i,                        // B.Sc / M.Sc
  /\bj\.p\.?$/i,                             // J.P.
  /\besq\.?$/i,
  /\b(jr|sr)\.?$/i,
  /\b(dr|prof|professor)\.$/i,               // dr. / prof. with dot
  /\b(hj\.|haji|hajjah|ust\.|ustaz|ustadz)$/i,
  /\b(dato'?|datin'?|tan sri|puan sri)$/i,
]

function normalise(name: string): string {
  let out = name.trim()
  // Drop a trailing parenthesised aside ("(Mohamad Abd.Hamid)" etc.) so
  // pen-name forms group with bare ones.
  out = out.replace(/\s*\([^)]*\)\s*$/, '').trim()
  for (let i = 0; i < 4; i++) {
    let changed = false
    for (const re of CREDENTIALS) {
      const stripped = out.replace(re, '').trim()
      if (stripped !== out) { out = stripped; changed = true }
    }
    if (!changed) break
  }
  out = out.replace(/[,.]+\s*$/, '').trim()
  return out.toLowerCase().replace(/\s+/g, ' ')
}

async function main() {
  const sb = adminClient()
  console.log(`── merge-credential-suffix-authors ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // 1. Scan all authors
  const PAGE = 1000
  let offset = 0
  type Row = { id: number; display_name: string; bio: string | null; photo_url: string | null }
  const rows: Row[] = []
  while (true) {
    const { data, error } = await sb.from('authors').select('id, display_name, bio, photo_url').order('id').range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as Row[]))
    if (data.length < PAGE) break
    offset += PAGE
  }
  console.log(`Authors scanned: ${rows.length}\n`)

  // 2. Group by normalised name
  const byNorm = new Map<string, Row[]>()
  for (const r of rows) {
    const key = normalise(r.display_name)
    if (!key) continue
    if (key === 'unknown' || key === 'anonymous') continue
    const arr = byNorm.get(key) ?? []
    arr.push(r)
    byNorm.set(key, arr)
  }
  // Role-marker patterns. If the parenthesised aside on any group member is
  // a role (Editor, Translator, Compiler, …) we DROP the group — the
  // parenthesis is distinguishing people, not declaring a pen name.
  const ROLE_PAREN = /\((editor|trans(?:lator)?|ed\.|trans\.|compiler|illustrator|foreword|preface|introduction)/i
  const groups = [...byNorm.entries()].filter(([, v]) => {
    if (v.length < 2) return false
    if (v.some(r => ROLE_PAREN.test(r.display_name))) return false
    return true
  })
  console.log(`Duplicate groups (normalised): ${groups.length}\n`)

  // 3. For each group: pick keeper (lowest id), schedule merge of others
  type MergePlan = { keep: Row; drops: Row[]; key: string }
  const plans: MergePlan[] = []
  for (const [key, members] of groups) {
    const sorted = [...members].sort((a, b) => a.id - b.id)
    const keep = sorted[0]
    const drops = sorted.slice(1)
    plans.push({ keep, drops, key })
  }
  for (const p of plans) {
    console.log(`  key="${p.key}"`)
    console.log(`    KEEP   id=${p.keep.id} bio=${p.keep.bio ? 'Y' : 'N'} photo=${p.keep.photo_url ? 'Y' : 'N'} | ${p.keep.display_name}`)
    for (const d of p.drops) {
      console.log(`    DROP   id=${d.id} bio=${d.bio ? 'Y' : 'N'} photo=${d.photo_url ? 'Y' : 'N'} | ${d.display_name}`)
    }
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──`)
    return
  }

  // 4. Execute merges
  let mergedAuthors = 0, movedLinks = 0, errors = 0
  for (const p of plans) {
    for (const drop of p.drops) {
      // a) fetch drop's book links
      const { data: dropLinks, error: le } = await sb.from('book_authors').select('book_id, role').eq('author_id', drop.id)
      if (le) { console.error(`  ! fetch links for ${drop.id}: ${le.message}`); errors++; continue }
      // b) fetch keep's existing book links to avoid PK clash
      const { data: keepLinks, error: ke } = await sb.from('book_authors').select('book_id').eq('author_id', p.keep.id)
      if (ke) { console.error(`  ! fetch links for ${p.keep.id}: ${ke.message}`); errors++; continue }
      const keepSet = new Set((keepLinks ?? []).map(r => r.book_id))
      // c) re-link drop's books to keep (skip ones already on keep)
      const toLink = (dropLinks ?? []).filter(l => !keepSet.has(l.book_id))
      if (toLink.length > 0) {
        const payload = toLink.map(l => ({ book_id: l.book_id, author_id: p.keep.id, role: l.role ?? 'author' }))
        const { error: ie } = await sb.from('book_authors').insert(payload)
        if (ie) { console.error(`  ! insert links keep=${p.keep.id}: ${ie.message}`); errors++; continue }
        movedLinks += toLink.length
      }
      // d) delete drop's book_authors links (any that remain)
      const { error: de } = await sb.from('book_authors').delete().eq('author_id', drop.id)
      if (de) { console.error(`  ! delete links for ${drop.id}: ${de.message}`); errors++; continue }
      // e) delete the drop author row
      const { error: ae } = await sb.from('authors').delete().eq('id', drop.id)
      if (ae) { console.error(`  ! delete author ${drop.id}: ${ae.message}`); errors++; continue }
      console.log(`  ✓ merged ${drop.id} → ${p.keep.id} (moved ${toLink.length} link(s))`)
      mergedAuthors++
    }
  }
  console.log(`\n  authors merged: ${mergedAuthors}, links moved: ${movedLinks}, errors: ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
