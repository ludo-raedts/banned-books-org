#!/usr/bin/env tsx
// One-off (2026-10-20): enrich-author-bios.ts dropped the page id of the picked
// Wikipedia page (`picked = d`, since d58a925, 2026-06-09), so 162 authors got
// bio_source_url = "https://en.wikipedia.org/?curid=undefined" (a broken
// "Source: Wikipedia" link). The bio TEXT came from the right, validated page.
// Recover the page: search Wikipedia for the author, take the candidate whose
// intro text matches the stored bio, and write its real ?curid=<id>. Rows
// without a confident match keep their bio, but the broken URL is cleared.
//
// Usage: npx tsx --env-file=.env.local scripts/_fix_bio_source_curid_undefined.ts [--apply]
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'

const APPLY = isApply()
const UA = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }
const norm = (s: string) => s.replace(/<[^>]+>/g, ' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function overlap(a: string, b: string): number {
  const A = new Set(norm(a).split(' ').filter(w => w.length > 3)), B = new Set(norm(b).split(' ').filter(w => w.length > 3))
  if (!A.size) return 0
  let n = 0
  for (const w of A) if (B.has(w)) n++
  return n / A.size
}

async function candidates(name: string): Promise<{ id: number; title: string; extract: string }[]> {
  const s = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=6&format=json`, { headers: UA }).then(r => r.json()).catch(() => null) as { query?: { search?: { pageid: number }[] } } | null
  const ids = (s?.query?.search ?? []).map(x => x.pageid)
  if (!ids.length) return []
  const d = await fetch(`https://en.wikipedia.org/w/api.php?action=query&pageids=${ids.join('|')}&prop=extracts&exintro=true&exsentences=8&format=json`, { headers: UA }).then(r => r.json()).catch(() => null) as { query?: { pages?: Record<string, { pageid: number; title: string; extract?: string }> } } | null
  return Object.values(d?.query?.pages ?? {}).map(p => ({ id: p.pageid, title: p.title, extract: p.extract ?? '' }))
}

async function main() {
  const pg = newPgClient(); await pg.connect()
  const rows = (await pg.query(`select id, display_name, bio from authors where bio_source_url like '%curid=undefined%' order by id`)).rows
  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'}: ${rows.length} authors with ?curid=undefined`)
  let fixed = 0, cleared = 0
  for (const r of rows) {
    const firstPart = String(r.bio ?? '').slice(0, 400)
    const cands = await candidates(r.display_name)
    let best: { id: number; title: string; score: number } | null = null
    for (const c of cands) {
      const score = overlap(firstPart, c.extract)
      if (!best || score > best.score) best = { id: c.id, title: c.title, score }
    }
    await new Promise(res => setTimeout(res, 300))
    if (best && best.score >= 0.6) {
      fixed++
      if (fixed <= 8) console.log(`  ✓ ${r.display_name} → ${best.title} (#${best.id}, overlap ${best.score.toFixed(2)})`)
      if (APPLY) await pg.query(`update authors set bio_source_url=$2 where id=$1 and bio_source_url like '%curid=undefined%'`, [r.id, `https://en.wikipedia.org/?curid=${best.id}`])
    } else {
      cleared++
      console.log(`  ✗ ${r.display_name} — no confident page (best ${best ? `${best.title} ${best.score.toFixed(2)}` : 'none'}), URL cleared`)
      if (APPLY) await pg.query(`update authors set bio_source_url=null where id=$1 and bio_source_url like '%curid=undefined%'`, [r.id])
    }
  }
  console.log(`fixed ${fixed}, cleared ${cleared}`)
  await pg.end()
}
main().catch(e => { console.error(e); process.exit(1) })
