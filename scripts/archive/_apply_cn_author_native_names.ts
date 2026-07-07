/**
 * One-off: hand-verified authors.name_native for the CN-banned-book authors
 * that enrich-author-native-names.ts could not gate automatically (no stored
 * birth_year and no matchable Wikidata work item). Each value was verified
 * against the cited source on 2026-07-07; the book column in the review file
 * data/author-native-names-2026-07-07.md ties each row to its banned work.
 *
 *   pnpm tsx --env-file=.env.local scripts/_apply_cn_author_native_names.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/_apply_cn_author_native_names.ts --apply
 *
 * Only writes rows whose name_native is still NULL (idempotent, never clobbers
 * enrichment or portal edits). Sets original_language only when NULL.
 */

import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const APPLY = isApply()
const sb = adminClient()

const MAP: Array<{ id: number; slug: string; name: string; native: string; lang: string; source: string }> = [
  // en.wikipedia langlink zh ("Joshua Wong" → 黃之鋒; HK author, traditional)
  { id: 181, slug: 'joshua-wong', name: 'Joshua Wong', native: '黃之鋒', lang: 'zh', source: 'en.wikipedia langlink' },
  // en.wikipedia langlink zh ("Xu Zhiyong" → 许志永)
  { id: 541, slug: 'xu-zhiyong', name: 'Xu Zhiyong', native: '许志永', lang: 'zh', source: 'en.wikipedia langlink' },
  // en.wikipedia langlink zh ("Fang Fang" → "方方 (作家)", disambiguator stripped)
  { id: 689, slug: 'fang-fang', name: 'Fang Fang', native: '方方', lang: 'zh', source: 'en.wikipedia langlink' },
  // zh.wikipedia 香港不屈：不能被磨滅的城市 (her book Indelible City): "是林慕蓮（英语：Louisa Lim）撰寫的書籍"
  { id: 690, slug: 'louisa-lim', name: 'Louisa Lim', native: '林慕蓮', lang: 'zh', source: 'zh.wikipedia (香港不屈)' },
  // zh.wikipedia 天安門文件: documents provided by 化名「張良」; simplified form
  // consistent with our stored title_native 天安门文件
  { id: 4305, slug: 'zhang-liang', name: 'Zhang Liang', native: '张良', lang: 'zh', source: 'zh.wikipedia (天安門文件)' },
  // en.wikipedia langlink zh ("Mian Mian" → 棉棉)
  { id: 4306, slug: 'mian-mian', name: 'Mian Mian', native: '棉棉', lang: 'zh', source: 'en.wikipedia langlink' },
  // zh.wikipedia 血的神话: "谭合成著" — matches our title_native 血的神话
  { id: 4308, slug: 'tan-hecheng', name: 'Tan Hecheng', native: '谭合成', lang: 'zh', source: 'zh.wikipedia (血的神话)' },
  // en.wikipedia "Reverend Insanity": "written by Gu Zhen Ren (蛊真人)" — pen name equals the novel's title
  { id: 5537, slug: 'gu-zhen-ren', name: 'Gu Zhen Ren', native: '蛊真人', lang: 'zh', source: 'en.wikipedia (Reverend Insanity)' },
  // ja.wikipedia 佐藤ショウジ (HOTD artist; NOT 佐藤翔治 the badminton player the bare
  // en.wikipedia "Shōji Satō" title redirects to — namesake trap)
  { id: 5619, slug: 'shoji-sato', name: 'Shōji Satō', native: '佐藤ショウジ', lang: 'ja', source: 'ja.wikipedia' },
  // zh.wikipedia 陈梧桐: 中国历史学家, Ming specialist — matches The Chongzhen Emperor
  { id: 5620, slug: 'chen-wutong', name: 'Chen Wutong', native: '陈梧桐', lang: 'zh', source: 'zh.wikipedia (陈梧桐)' },
  // paper-republic.org/pers/chen-xiwo (translation-community registry): 陈希我
  { id: 5740, slug: 'chen-xiwo', name: 'Chen Xiwo', native: '陈希我', lang: 'zh', source: 'paper-republic.org' },
]

async function main() {
  console.log(`_apply_cn_author_native_names — ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)
  let written = 0, skipped = 0
  for (const m of MAP) {
    const { data, error } = await sb
      .from('authors')
      .select('id, slug, display_name, name_native, original_language')
      .eq('id', m.id)
      .single()
    if (error || !data) { console.error(`  ✗ ${m.slug}: not found (${error?.message})`); continue }
    if (data.slug !== m.slug || data.display_name !== m.name) {
      console.error(`  ✗ id ${m.id}: expected ${m.name}/${m.slug}, found ${data.display_name}/${data.slug} — skipped`)
      skipped++
      continue
    }
    if (data.name_native) {
      console.log(`  – ${m.slug}: name_native already "${data.name_native}" — skipped`)
      skipped++
      continue
    }
    console.log(`  ✓ ${m.name} → ${m.native} [${m.lang}] (${m.source})`)
    if (APPLY) {
      const update: Record<string, string> = { name_native: m.native }
      if (!data.original_language) update.original_language = m.lang
      const { error: e2 } = await sb.from('authors').update(update).eq('id', m.id)
      if (e2) { console.error(`  ✗ update ${m.slug}: ${e2.message}`); continue }
    }
    written++
  }
  console.log(`\n${APPLY ? 'Written' : 'Would write'}: ${written} · skipped: ${skipped}`)
}

main().catch(e => { console.error(e); process.exit(1) })
