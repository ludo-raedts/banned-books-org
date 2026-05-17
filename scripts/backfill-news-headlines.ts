/**
 * One-shot backfill: generate a short attention-grabbing headline for every
 * news_items row that doesn't have one yet. Existing rows pre-date the
 * headline column added in migration 20260517082858 — until backfilled, the
 * news surfaces fall back to the bron-titel.
 *
 * Re-runnable: skips rows where headline is already set.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-news-headlines.ts           # dry-run
 *   npx tsx --env-file=.env.local scripts/backfill-news-headlines.ts --apply   # write
 */

import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

const SYSTEM = `You write punchy, neutral headlines for book-ban / censorship news on banned-books.org.

Given the article title and summary, return ONLY the headline — no quotes, no trailing punctuation, no JSON wrapper.

Rules:
- 4–8 words. Title Case.
- Name the specific actor, book, or place. "Tennessee District Bans Roots" beats "School District Bans Novel".
- No clickbait, no questions, no "you won't believe", no all-caps shouting.
- English only.`

async function generate(openai: OpenAI, title: string, summary: string): Promise<string | null> {
  const res = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    max_tokens: 40,
    temperature: 0.6,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Source title: ${title}\nSummary: ${summary}\n\nWrite the headline.` },
    ],
  })
  const text = res.choices[0]?.message?.content?.trim() ?? ''
  // Strip wrapping quotes if the model added them.
  return text.replace(/^["'`]+|["'`]+$/g, '').trim() || null
}

async function main() {
  const supabase = adminClient()
  // Rejected items never surface in UI/RSS — no point spending API calls
  // generating headlines for them.
  const { data, error } = await supabase
    .from('news_items')
    .select('id, title, summary')
    .is('headline', null)
    .not('summary', 'is', null)
    .in('status', ['draft', 'published'])
    .order('id', { ascending: true })

  if (error) throw error
  const rows = data ?? []
  console.log(`Found ${rows.length} item${rows.length === 1 ? '' : 's'} without a headline (${APPLY ? 'apply' : 'dry-run'}).\n`)

  if (rows.length === 0) return
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let updated = 0
  let failed = 0
  for (const row of rows) {
    try {
      const headline = await generate(openai, row.title ?? '', row.summary ?? '')
      if (!headline) {
        console.log(`  ✗ ${row.id}: empty response`)
        failed++
        continue
      }
      console.log(`  • ${row.id}: ${headline}`)
      if (APPLY) {
        const { error: upErr } = await supabase
          .from('news_items')
          .update({ headline })
          .eq('id', row.id)
        if (upErr) {
          console.log(`    ✗ update failed: ${upErr.message}`)
          failed++
          continue
        }
      }
      updated++
    } catch (e) {
      console.log(`  ✗ ${row.id}: ${e instanceof Error ? e.message : String(e)}`)
      failed++
    }
  }

  console.log(`\n── Summary ──`)
  console.log(`${APPLY ? 'Updated' : 'Would update'}: ${updated} | Failed: ${failed}`)
  if (!APPLY) console.log('\nDRY-RUN — re-run with --apply to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
