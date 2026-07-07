/**
 * apply-original-language-fixes.ts — hand-verified corrections to
 * books.original_language (and one garbage title_native), from the
 * _audit_original_language_english.ts worklist of 2026-07-07 (Sprint A taak 4,
 * stap 2 — the "Gone with the Wind" misclassification class).
 *
 * Each row was verified individually against an authoritative source (author
 * nationality / first-publication language); the `why` is recorded per row.
 * Rows the audit flagged but that are actually CORRECT (foreign works banned
 * under historical country codes, e.g. Darwish=ar banned in IL) are NOT here.
 *
 * Idempotent + safe: every UPDATE is guarded by .eq(field, from) so re-running
 * after the fix (or after someone else edited the row) is a no-op, never a
 * blind overwrite. Verify with a read-only query before and after.
 *
 *   pnpm tsx --env-file=.env.local scripts/apply-original-language-fixes.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/apply-original-language-fixes.ts --apply
 */

import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const sb = adminClient()
const APPLY = isApply()

// original_language corrections: the stored value is wrong for the ORIGINAL
// work language (not merely a translated title on a correctly-tagged foreign
// work — those were left alone).
const LANG_FIXES: Array<{ id: number; slug: string; from: string; to: string; why: string }> = [
  { id: 6471, slug: 'his-dark-materials-series', from: 'de', to: 'en',
    why: 'Philip Pullman is British; the trilogy was written in English.' },
  { id: 6436, slug: 'the-rules-of-attraction', from: 'es', to: 'en',
    why: 'Bret Easton Ellis is American; novel first published in English (1987).' },
  { id: 6451, slug: 'women-on-top', from: 'es', to: 'en',
    why: 'Nancy Friday is American; written in English.' },
  { id: 7347, slug: 'my-gun-is-quick', from: 'ru', to: 'en',
    why: 'Mickey Spillane is American; hardboiled novel written in English (1950). Russian title_native was a translation artifact — nulled below.' },
  { id: 6663, slug: 'gabriele-dannunzio-all-love-stories', from: 'tr', to: 'it',
    why: "Gabriele D'Annunzio was Italian; author-level blanket entry, original language is Italian, not Turkish." },
  { id: 6533 /* verified below by slug */, slug: 'respect-chavez-perez', from: 'es', to: 'sv',
    why: 'Inti Chavez Perez is Swedish; original "Respekt" published in Sweden (2010), English is a translation.' },
  { id: 0 /* id resolved by slug */, slug: 'buttons-and-lace-her-debt-his-desire', from: 'ro', to: 'en',
    why: 'Penelope Sky writes in English (Barsetti Crime Family series); English original.' },
]

// title_native garbage: original_language is CORRECT but title_native holds a
// non-title string that would leak into the SERP <title> (not suppressed by
// equivalentTitles because it differs from the English title).
const NATIVE_NULLS: Array<{ slug: string; badNative: string; why: string }> = [
  { slug: 'sapiens-a-brief-history-of-humankind', badNative: 'mamagueverria',
    why: 'original_language he is correct (Harari wrote Sapiens in Hebrew, 2011); title_native was vandalism/garbage, not the Hebrew title.' },
  { slug: 'my-gun-is-quick', badNative: 'Мой револьвер быстр',
    why: 'English original (lang fixed ru→en above); the Russian value was a translated title misplaced in the native-title field.' },
]

async function main() {
  console.log(`apply-original-language-fixes — ${APPLY ? 'APPLY' : 'dry-run'}\n`)

  // Resolve ids by slug (authoritative) so a stale hardcoded id can't misfire.
  console.log('== original_language fixes ==')
  let langWritten = 0
  for (const f of LANG_FIXES) {
    const { data: row, error: selErr } = await sb
      .from('books').select('id, original_language, title').eq('slug', f.slug).single()
    if (selErr || !row) { console.log(`  ⚠ ${f.slug}: niet gevonden (${selErr?.message})`); continue }
    const cur = row.original_language
    const status = cur === f.to ? 'reeds ok' : cur === f.from ? 'te fixen' : `ONVERWACHT (${cur})`
    console.log(`  ${f.from}→${f.to}  "${row.title}" [${status}]  — ${f.why}`)
    if (!APPLY || cur !== f.from) continue
    const { data, error } = await sb
      .from('books').update({ original_language: f.to }).eq('id', row.id).eq('original_language', f.from).select('id')
    if (error) { console.log(`    ✗ ${error.message}`); continue }
    langWritten += data?.length ?? 0
  }

  console.log('\n== title_native cleanups ==')
  let nativeWritten = 0
  for (const n of NATIVE_NULLS) {
    const { data: row, error: selErr } = await sb
      .from('books').select('id, title_native, original_language, title').eq('slug', n.slug).single()
    if (selErr || !row) { console.log(`  ⚠ ${n.slug}: niet gevonden (${selErr?.message})`); continue }
    const match = row.title_native === n.badNative
    console.log(`  null title_native "${row.title_native}" (lang=${row.original_language}) [${match ? 'te fixen' : row.title_native == null ? 'reeds null' : `ONVERWACHT`}] — ${n.why}`)
    if (!APPLY || !match) continue
    const { data, error } = await sb
      .from('books').update({ title_native: null, title_native_script: null }).eq('id', row.id).eq('title_native', n.badNative).select('id')
    if (error) { console.log(`    ✗ ${error.message}`); continue }
    nativeWritten += data?.length ?? 0
  }

  console.log(`\n${APPLY ? `Geschreven: ${langWritten} taal-fixes, ${nativeWritten} title_native-nulls.` : 'Dry-run: geen writes. Draai met --apply.'}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
