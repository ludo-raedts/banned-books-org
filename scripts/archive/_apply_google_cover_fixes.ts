import { adminClient } from '../src/lib/supabase'
import data from '../data/google-cover-audit.json'

type F = { id: number; slug: string; title: string; z3ratio: number | null; z1ratio: number | null }
const STRIP = 0.7

// Every zoom=3 strip is re-pointed to zoom=1 — including the non-portrait
// covers (z1 < 1.2). Those are legitimate square picture books / landscape art
// books whose zoom=1 render is the real cover; nulling them only to re-enrich
// the identical cover later is pointless. Verified visually via the
// _montage_google_covers.ts montage (2026-06-03). No row is nulled.
const all = data as F[]
const toZoom1 = all.filter((x) => x.z3ratio != null && x.z3ratio < STRIP)

const DRY = process.argv.includes('--dry')

async function main() {
  const s = adminClient()
  console.log(`zoom=1 fixes: ${toZoom1.length}${DRY ? '  (DRY RUN)' : ''}`)

  // 1) zoom=3 -> zoom=1 : fetch current url per id, replace, update
  const ids = toZoom1.map((x) => x.id)
  const urlById = new Map<number, string>()
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200)
    const { data: rows, error } = await s.from('books').select('id,cover_url').in('id', batch)
    if (error) throw error
    for (const r of rows ?? []) urlById.set(r.id as number, r.cover_url as string)
  }

  let fixed = 0
  let skipped = 0
  for (const x of toZoom1) {
    const cur = urlById.get(x.id)
    if (!cur || !cur.includes('zoom=3')) {
      skipped++
      continue
    }
    const next = cur.replace('zoom=3', 'zoom=1')
    if (!DRY) {
      const { error } = await s.from('books').update({ cover_url: next }).eq('id', x.id)
      if (error) throw error
    }
    fixed++
  }

  console.log(`Done. zoom=1 updated: ${fixed} (skipped ${skipped})`)
}

main()
