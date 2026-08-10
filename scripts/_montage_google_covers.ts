// Read-only visual montage for the Google degenerate-cover remediation.
// Mirrors the exact partition logic in _apply_google_cover_fixes.ts so the
// montage shows precisely what that script would do, WITHOUT touching the DB.
//
//   npx tsx --env-file=.env.local scripts/_montage_google_covers.ts
//   → writes public/cover-montage.html (served at http://localhost:3000/cover-montage.html)
//
// Section 1 (zoom=1 fixes): current cover (zoom=3 strip) vs proposed zoom=1.
// Section 2 (null candidates): current cover that would be REMOVED entirely.
// Plain <img> tags (Google Books URLs) — bypasses next/image allowlist.

import { writeFileSync } from 'fs'
import { adminClient } from '../src/lib/supabase'
import data from '../data/google-cover-audit.json'

type F = { id: number; slug: string; title: string; z3ratio: number | null; z1ratio: number | null }
const STRIP = 0.7
const PORTRAIT = 1.2

const all = data as F[]
const strips = all.filter((x) => x.z3ratio != null && x.z3ratio < STRIP)
const toZoom1 = strips.filter((x) => x.z1ratio != null && x.z1ratio >= PORTRAIT)
const toNull = strips.filter((x) => !(x.z1ratio != null && x.z1ratio >= PORTRAIT))

async function main() {
  const s = adminClient()
  const ids = [...toZoom1, ...toNull].map((x) => x.id)
  const urlById = new Map<number, string>()
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200)
    const { data: rows, error } = await s.from('books').select('id,cover_url').in('id', batch)
    if (error) throw error
    for (const r of rows ?? []) urlById.set(r.id as number, (r.cover_url as string) ?? '')
  }

  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

  const card = (x: F, kind: 'fix' | 'null') => {
    const cur = urlById.get(x.id) ?? ''
    const next = cur.includes('zoom=3') ? cur.replace('zoom=3', 'zoom=1') : cur
    const link = `<a href="/books/${x.slug}" target="_blank">${esc(x.title)}</a>`
    const ratios = `z3=${x.z3ratio?.toFixed(2) ?? '–'} z1=${x.z1ratio?.toFixed(2) ?? '–'}`
    const cls = kind === 'fix' ? 'card' : 'card keep'
    const propLabel = kind === 'fix' ? 'proposed (zoom=1)' : 'KEEP — zoom=1'
    return `<div class="${cls}"><div class="t">#${x.id} ${link}<br><span class="r">${ratios}</span></div>
      <div class="pair"><figure><img loading="lazy" src="${esc(cur)}"><figcaption>current (zoom=3)</figcaption></figure>
      <figure><img loading="lazy" src="${esc(next)}"><figcaption>${propLabel}</figcaption></figure></div></div>`
  }

  const html = `<!doctype html><meta charset="utf-8"><title>Google cover montage</title>
<style>
  body{font:14px/1.4 system-ui;margin:24px;background:#fafafa}
  h1{font-size:20px} h2{margin-top:32px;border-bottom:2px solid #ddd;padding-bottom:6px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px}
  .card{background:#fff;border:1px solid #e3e3e3;border-radius:8px;padding:10px}
  .card.keep{border-color:#b4d0e0;background:#f7fbff}
  .t{font-size:12px;margin-bottom:8px} .r{color:#888;font-size:11px}
  .pair{display:flex;gap:10px} figure{margin:0;text-align:center;flex:1}
  img{max-height:220px;max-width:100%;border:1px solid #eee;background:#f0f0f0}
  figcaption{font-size:11px;color:#666;margin-top:4px}
</style>
<h1>Google degenerate-cover remediation — visual check</h1>
<p>Mirrors <code>_apply_google_cover_fixes.ts</code>. Nothing is written until you approve.</p>
<h2>① zoom=1 fixes — ${toZoom1.length} books (URL param swapped, cover stays)</h2>
<div class="grid">${toZoom1.map((x) => card(x, 'fix')).join('')}</div>
<h2>② non-portrait covers — ${toNull.length} books (KEEP, switch to zoom=1)</h2>
<p>Square picture books / landscape art books. Current zoom=3 is the degenerate strip; zoom=1 is the real cover. Flag any whose zoom=1 is STILL broken — only those get nulled.</p>
<div class="grid">${toNull.map((x) => card(x, 'keep')).join('')}</div>`

  writeFileSync('public/cover-montage.html', html)
  console.log(`Wrote public/cover-montage.html — ${toZoom1.length} fixes, ${toNull.length} nulls`)
}

main().catch((e) => { console.error(e); process.exit(1) })
