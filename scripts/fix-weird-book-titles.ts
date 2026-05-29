/**
 * Per-case repair of 12 books with mangled titles discovered in the
 * enrich-descriptions audit (2026-05-27).
 *
 * Six are mojibake artefacts from data/kdn-epq-batch1.json where the
 * Chinese-script title was already encoding-broken at scrape time, leaving
 * only the parenthesised English/Malay rendering recoverable. Three are
 * Foreign Languages Press (China, 1980) titles where stray quote marks
 * survived and my prior title-casing pass mishandled the leading `'`.
 * Two are KDN gazette entries whose section-numbering format collapsed
 * into the title field. One has a leading whitespace artefact.
 *
 * 0.5 (id=13586), 1720 (id=6674), and 1997.9977 (id=6538) are intentionally
 * left untouched — the first is confirmed in PEN-Belarus raw source as the
 * actual title, the second has a real HK-publisher ISBN, and the third is
 * a low-confidence Wikipedia auto-import that needs manual research before
 * we touch it.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/fix-weird-book-titles.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-weird-book-titles.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

const FIXES: Array<{ id: number; title: string; note: string }> = [
  // Mojibake titles — drop the unrecoverable Chinese-script prefix.
  { id: 12699, title: "Lady Chatterley's Lover",                  note: 'mojibake drop' },
  { id: 12702, title: 'Cinta Percubaan',                          note: 'mojibake drop' },
  { id: 12703, title: 'Watak Seorang Bapa Ayam',                  note: 'mojibake drop' },
  { id: 12697, title: 'Kisah Jin Ping Mei (Komik)',               note: 'mojibake drop' },
  { id: 12700, title: 'Rapsodi Cahaya Bulan',                     note: 'mojibake drop' },
  { id: 12701, title: 'Bini Muda Berumur Enam Belas Tahun',       note: 'mojibake drop' },
  // Quote-mark/case mess from KDN 1980 Foreign Languages Press tract titles.
  { id: 11675, title: 'Confucius — Sage of the Reactionary Classes', note: 'unquote + title-case' },
  { id: 11676, title: 'Mine Walfare',                             note: 'unquote' },
  { id: 11679, title: "Karl Marx's Theory of Revolution Part I",  note: 'unquote + title-case' },
  // KDN gazette section-numbering collapsed into title.
  { id: 11677, title: 'Mahathir Menyalahgunakan Kuasa',           note: 'TOC fragment — first chapter as canonical' },
  { id: 11288, title: 'Chendera Mata 5.1: Hari Buroh Sa Dunia 1966', note: 'add colon after issue number' },
  // Leading-space artefact.
  { id: 1250,  title: 'Check, Please! Book 1: #Hockey',           note: 'trim leading whitespace' },
]

async function main() {
  const sb = adminClient()
  console.log(`── fix-weird-book-titles ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  // Print plan with before/after
  for (const f of FIXES) {
    const { data } = await sb.from('books').select('id, title').eq('id', f.id).maybeSingle()
    if (!data) { console.log(`  ! id=${f.id} NOT FOUND`); continue }
    console.log(`  id=${f.id}  [${f.note}]`)
    console.log(`    FROM: ${data.title}`)
    console.log(`    →     ${f.title}`)
  }

  if (!APPLY) {
    console.log(`\n── Dry-run complete. Re-run with --apply. ──`)
    return
  }

  // Apply
  let updated = 0, errors = 0
  for (const f of FIXES) {
    const { error } = await sb.from('books').update({ title: f.title }).eq('id', f.id)
    if (error) { errors++; console.error(`  ! id=${f.id}: ${error.message}`) }
    else { updated++; console.log(`  ✓ id=${f.id} → "${f.title}"`) }
  }
  console.log(`\n  updated: ${updated}, errors: ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
