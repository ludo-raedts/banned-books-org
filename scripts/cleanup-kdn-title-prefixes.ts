/**
 * Clean leading `*`, `**`, and surrounding `"` from KDN-imported book titles.
 *
 * The KDN e-PQ register uses category-marker prefixes in its title column:
 *   - `* TITLE`   → periodicals / magazines (e.g. * PLAYBOY, * CINEMA)
 *   - `** TITLE`  → pamphlets / political leaflets (e.g. ** ANCAMAN KOMUNISMA)
 *   - `"TITLE"`   → quoted source-of-record propaganda titles
 *
 * These prefixes broke Wikipedia/OpenLibrary enrichment lookups and look
 * ugly on the rendered book pages. Since `slugify` already strips them at
 * insert time, every book's slug is already clean — only the display
 * `books.title` field needs updating. No URL changes, no slug-collision
 * risk.
 *
 * Touches only KDN-sourced books (links to source_id=2154).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/cleanup-kdn-title-prefixes.ts             # dry-run
 *   pnpm tsx --env-file=.env.local scripts/cleanup-kdn-title-prefixes.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const KDN_SOURCE_ID = 2154

function cleanTitle(raw: string): string {
  let t = raw

  // Step 1: strip leading category-marker prefixes (`**` or `*` + whitespace).
  // Iterate twice so `** ` after `*` (rare) collapses cleanly.
  for (let i = 0; i < 2; i++) {
    const before = t
    t = t.replace(/^\s*\*\*+\s*/, '')   // `**` then optional whitespace
         .replace(/^\s*\*\s+/, '')      // `*` followed by required whitespace (avoid stripping `*italic*`)
    if (t === before) break
  }
  t = t.trim()

  // Step 2: balanced full-wrap quotes — title starts AND ends with `"` AND
  // contains exactly 2 quotes total. Asymmetric cases like `"Wide Angle" 48 …`
  // (where `"Wide Angle"` is a periodical name inside the title) are NOT touched.
  const quoteCount = (t.match(/"/g) ?? []).length
  if (quoteCount === 2 && t.startsWith('"') && t.endsWith('"')) {
    t = t.slice(1, -1).trim()
  }

  // Step 3: trailing doubled `""` escape artefact when title doesn't start with `"`.
  // Pattern observed: `LAGU PERINGATAN HARI PAHLAWAN "1 SEPTEMBER""` (inner quote
  // + trailing close-of-wrap doubled). Safe to strip both trailing `"`.
  if (!t.startsWith('"') && t.endsWith('""')) {
    t = t.slice(0, -2).trim()
  }

  return t
}

async function main() {
  const sb = adminClient()

  console.log(`\n── cleanup-kdn-title-prefixes ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // Fetch all KDN-linked books (postgrest's like() treats * as wildcard, so we
  // can't filter the prefix server-side cleanly). Filter in JS.
  const seen = new Set<number>()
  type Row = { id: number; title: string; slug: string }
  const candidates: Row[] = []
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('books')
      .select(`
        id, title, slug,
        bans!inner(ban_source_links!inner(source_id))
      `)
      .order('id')
      .range(offset, offset + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data as unknown as Array<{
      id: number; title: string; slug: string;
      bans: Array<{ ban_source_links: Array<{ source_id: number }> }>
    }>) {
      if (seen.has(r.id)) continue
      const hasKdn = r.bans.some(b => b.ban_source_links.some(l => l.source_id === KDN_SOURCE_ID))
      if (!hasKdn) continue
      seen.add(r.id)
      if (/^\s*(\*+|")/.test(r.title) || /""\s*$/.test(r.title)) {
        candidates.push({ id: r.id, title: r.title, slug: r.slug })
      }
    }
    if (data.length < 1000) break
    offset += 1000
  }

  console.log(`Candidates with prefix/quote pollution: ${candidates.length}\n`)

  const plans: Array<{ id: number; old: string; clean: string; slug: string }> = []
  for (const c of candidates) {
    const clean = cleanTitle(c.title)
    if (clean === c.title) continue
    if (clean.length === 0) {
      console.log(`  ⚠ skip book_${c.id} — clean title would be empty: "${c.title}"`)
      continue
    }
    plans.push({ id: c.id, old: c.title, clean, slug: c.slug })
  }

  console.log(`Will update ${plans.length} titles:\n`)
  for (const p of plans) {
    console.log(`  book_${p.id}  "${p.old.slice(0, 60)}"`)
    console.log(`           → "${p.clean.slice(0, 60)}"  (slug unchanged: ${p.slug.slice(0, 40)})`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──\n`)
    return
  }

  console.log(`\n── Applying ──`)
  let updated = 0, errors = 0
  for (const p of plans) {
    const { error: e } = await sb.from('books').update({ title: p.clean }).eq('id', p.id)
    if (e) { errors++; console.error(`  ! book_${p.id}: ${e.message}`); continue }
    updated++
  }
  console.log(`\n  updated: ${updated}, errors: ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
