/**
 * Manual, hand-grounded native-title backfill for books the Wikidata pipeline
 * (enrich-native-titles.ts) cannot match — dissident/exile works without a
 * written-work Wikidata item. Every entry below carries its grounding source
 * (zh.wikipedia article or en.wikipedia lead) and was verified by hand against
 * the author's zh.wikipedia works list before inclusion.
 *
 * Writes the same fields as enrich-native-titles.ts and nothing else:
 *   title_native, title_native_script (detectScript), native_title_checked_at.
 * title_transliterated stays untouched (non-Latin transliteration is
 * review-gated doctrine). Guard: refuses to overwrite an existing
 * title_native.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/apply-manual-native-titles.ts           # dry-run
 *   pnpm tsx --env-file=.env.local scripts/apply-manual-native-titles.ts --apply
 */

import { writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { detectScript } from '../src/lib/imports/language-inference'
import { isApply } from './lib/cli'

const APPLY = isApply()
const sb = adminClient()

type Entry = {
  id: number
  slug: string
  native: string
  source: string
  note?: string
}

// CN-banned zh-original books, researched 2026-07-06 (session: Chinese-visitor
// experience). Ban-country: CN for all rows.
const ENTRIES: Entry[] = [
  {
    id: 147, slug: 'tombstone-yang-jisheng', native: '墓碑',
    source: 'zh.wikipedia "墓碑 (书籍)" (杨继绳著, 香港天地图书 2008); en.wikipedia "Yang Jisheng (journalist)" lead: Tombstone (墓碑)',
  },
  {
    id: 738, slug: 'the-corpse-walker', native: '中国底层访谈录',
    source: 'zh.wikipedia "中国底层访谈录" (廖亦武/老威, 2001); The Corpse Walker (Pantheon 2008) is the English selection of this work',
    note: 'Taiwan edition of the English selection is titled 吆屍人：来自中国底层的真实故事; the banned original (2001, PRC) is 中国底层访谈录',
  },
  {
    id: 739, slug: 'forbidden-memory-woeser', native: '杀劫',
    source: 'zh.wikipedia "唯色": 《杀劫》/《杀劫-镜头下的西藏文革》 incl. author explanation of the title (藏语"革命"谐音)',
  },
  {
    id: 912, slug: 'for-a-song-and-a-hundred-songs', native: '我的證詞',
    source: 'zh.wikipedia "廖亦武" infobox representative works: 《我的證詞》 (Taiwan 允晨文化 2011); German/English editions = Für ein Lied und hundert Lieder / For a Song and a Hundred Songs',
  },
  {
    id: 933, slug: '1000-years-of-joys-and-sorrows', native: '千年悲欢',
    source: 'zh.wikipedia "艾未未" works list: 《千年悲欢》 (memoir, 2021)',
  },
  {
    id: 939, slug: 'red-dust-ma-jian', native: '非法流浪',
    source: 'zh.wikipedia "马建 (作家)": 2002年因小说《非法流浪》获托马斯·库克旅行文学奖 — Red Dust won the 2002 Thomas Cook Travel Book Award',
  },
  {
    id: 942, slug: 'god-is-red-liao-yiwu', native: '上帝是紅色的',
    source: 'zh.wikipedia "廖亦武" infobox representative works: 《上帝是紅色的》',
  },
  {
    id: 6250, slug: 'candy-mian-mian', native: '糖',
    source: 'zh.wikipedia "棉棉": 代表作为2000年出版的长篇小说《糖》',
  },
  {
    id: 6251, slug: 'lingren-wangshi', native: '伶人往事',
    source: 'en.wikipedia "Lingren Wangshi" (Chinese: 伶人往事) + zh interwiki 伶人往事 (章诒和)',
  },
  {
    id: 6252, slug: 'bloody-myth-tan-hecheng', native: '血的神话',
    source: 'zh.wikipedia "血的神话" (谭合成著, 2010): 《血的神话：公元1967年湖南道县文革大屠杀纪实》; English = The Killing Wind',
  },
  {
    id: 6253, slug: 'moving-away-from-the-imperial-regime', native: '走出帝制',
    source: 'zh.wikipedia "秦晖" works list: 《走出帝制——从晚清到民国的历史回望》; en.wikipedia "Moving Away from the Imperial Regime" (Qin Hui)',
  },
  {
    id: 976, slug: 'viral-murong-xuecun', native: '禁城：武漢傳來的聲音',
    source: 'zh.wikipedia "慕容雪村": 最新作品非虛構小說《禁城：武漢傳來的聲音》 — his only COVID/Wuhan nonfiction work (English: Deadly Quiet City / announced as Viral: China\'s COVID Coverups)',
    note: 'MEDIUM confidence on title equivalence: DB row title "Viral: China\'s COVID Coverups" was the pre-publication English title; published as Deadly Quiet City (Hardie Grant 2022)',
  },
]

// Researched but deliberately NOT written (documented for the review file):
const SKIPPED = [
  { id: 741, slug: 'prisoners-of-the-state', reason: 'No such Xu Zhiyong book found on en/zh Wikipedia — row looks like a data error (possible conflation with prisoner-of-the-state / Zhao Ziyang). Needs editor review, not enrichment.' },
  { id: 932, slug: 'no-enemies-no-hatred', reason: 'English-language anthology (Belknap/Harvard 2012, ed. Link/Martin-Liao/Liu Xia); no single zh original volume exists. title_native correctly stays NULL.' },
  { id: 940, slug: 'the-noodle-maker', reason: 'Suspected 拉麵者 but zero zh.wikipedia grounding (not in 马建 works list, no article). Left for a later pass with publisher sources.' },
]

async function main() {
  console.log(`\n── apply-manual-native-titles ── (${APPLY ? 'APPLY' : 'DRY-RUN'})`)

  const ids = ENTRIES.map(e => e.id)
  const { data: before, error } = await sb
    .from('books')
    .select('id, slug, title, title_native, original_language')
    .in('id', ids)
    .order('id')
  if (error) throw error

  const bySlug = new Map(before!.map(b => [b.id, b]))
  let writable = 0
  for (const e of ENTRIES) {
    const row = bySlug.get(e.id)
    if (!row) { console.log(`  ✗ #${e.id} ${e.slug} — NOT FOUND, skipping`); continue }
    if (row.slug !== e.slug) { console.log(`  ✗ #${e.id} — slug mismatch (db: ${row.slug}), skipping`); continue }
    if (row.title_native) { console.log(`  ✗ #${e.id} ${e.slug} — already has title_native "${row.title_native}", skipping`); continue }
    const script = detectScript(e.native)
    console.log(`  · #${e.id} ${e.slug} — "${row.title}" → ${e.native} [${script}]`)
    writable++
  }
  console.log(`\n  writable: ${writable}/${ENTRIES.length}  skipped-by-doctrine: ${SKIPPED.length}`)

  const date = new Date().toISOString().slice(0, 10)
  const review = {
    generated: new Date().toISOString(),
    apply: APPLY,
    entries: ENTRIES,
    skipped: SKIPPED,
  }
  const jsonPath = `data/native-title-manual-${date}.json`
  const mdPath = `data/native-title-manual-${date}.md`
  writeFileSync(jsonPath, JSON.stringify(review, null, 2))
  writeFileSync(mdPath, [
    `# Manual native-title backfill (CN-banned zh books) — ${date}`,
    '',
    'Hand-grounded via zh/en.wikipedia (see per-row source). Wikidata pipeline matched 0/15 of these.',
    '',
    '| id | slug | title_native | source |',
    '|---|---|---|---|',
    ...ENTRIES.map(e => `| ${e.id} | ${e.slug} | ${e.native} | ${e.source.replace(/\|/g, '\\|')} |`),
    '',
    '## Skipped (deliberate)',
    '',
    ...SKIPPED.map(s => `- **${s.slug}** (#${s.id}): ${s.reason}`),
    '',
  ].join('\n'))
  console.log(`  review files: ${jsonPath} , ${mdPath}`)

  if (!APPLY) {
    console.log('\n  DRY-RUN — nothing written. Re-run with --apply.\n')
    return
  }

  const now = new Date().toISOString()
  let written = 0
  for (const e of ENTRIES) {
    const row = bySlug.get(e.id)
    if (!row || row.slug !== e.slug || row.title_native) continue
    const { error: uerr } = await sb
      .from('books')
      .update({
        title_native: e.native,
        title_native_script: detectScript(e.native),
        native_title_checked_at: now,
      })
      .eq('id', e.id)
      .is('title_native', null)
    if (uerr) { console.log(`  ✗ #${e.id} write failed: ${uerr.message}`); continue }
    written++
  }

  const { data: after } = await sb
    .from('books')
    .select('id, slug, title_native, title_native_script')
    .in('id', ids)
    .order('id')
  console.log(`\n  written: ${written}`)
  for (const r of after ?? []) console.log(`  ✓ #${r.id} ${r.slug} → ${r.title_native ?? 'NULL'} [${r.title_native_script ?? '—'}]`)
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
