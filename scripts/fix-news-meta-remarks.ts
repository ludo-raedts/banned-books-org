#!/usr/bin/env tsx
/**
 * Remove "the description gave no details" remarks from published news summaries.
 *
 * WHY: 11 of 850 published news_items end with a sentence the summariser wrote
 * about its own input — "The supplied description does not provide dates,
 * venue details…", "The source provides no further details about…". It reads
 * as an instruction to a text generator, not as information for the visitor.
 * Flagged by the external UX review (2026-11-11).
 *
 * HOW: split the summary into sentences and drop only those that talk about the
 * description/source text itself. A summary that would be left with no
 * substantive sentence is skipped and reported. Statements ABOUT THE EVENT
 * ("No further details on the reasons … have been provided by the school
 * system", ids 122 and 564) are not matched and stay.
 *
 * Idempotent. Backup of every touched summary in data/ on --apply; /news and
 * the homepage are busted afterwards.
 *
 *   pnpm tsx --env-file=.env.local scripts/fix-news-meta-remarks.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-news-meta-remarks.ts --apply
 */
import { writeFileSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply } from './lib/cli'
import { bustPaths } from './lib/revalidate'

const APPLY = isApply()

// A sentence is a meta-remark when it speaks about the supplied/available/
// source description or the source/post providing details.
const META =
  /\b(supplied|available|provided|brief|source|snippet)\s+(description|summary|text|excerpt)\b|\b(source|post|article|report|description|feed|listing)\s+(provides?|gives?|contains?|offers?|includes?)\s+no\s+(further\s+)?(details?|information)\b|\bprovided no further details in the supplied\b|\bdoes not (provide|give|specify)\b[^.]*\b(supplied|available|source)\s+description\b/i

const SPLIT = /(?<=[.!?])\s+(?=[A-Z“"'(*])/
// A meta-remark often rides on a real clause: "…addresses censorship through
// satire; the available description provides no further details about its
// plot." Keep the clause that says something about the event.
const JOINTS = ['; ', ', though ', ', but ', ', although ', ', and ']

function trimSentence(sentence: string): string | null {
  const m = META.exec(sentence)
  if (!m) return sentence
  let cut = -1
  for (const j of JOINTS) {
    const at = sentence.lastIndexOf(j, m.index)
    if (at > cut) cut = at
  }
  if (cut < 35) return null
  return `${sentence.slice(0, cut).replace(/[,;:\s]+$/, '')}.`
}

function clean(summary: string): string {
  return summary
    .split(SPLIT)
    .map(trimSentence)
    .filter((x): x is string => x !== null)
    .join(' ')
    .trim()
}

async function main() {
  const pg = newPgClient()
  await pg.connect()
  try {
    await pg.query(APPLY ? 'BEGIN' : 'BEGIN READ ONLY')
    const { rows } = await pg.query<{ id: number; summary: string }>(
      `select id, summary from news_items where status = 'published' and summary is not null
          and summary ~* '(supplied|available|provided|brief|source|snippet) (description|summary|text|excerpt)|(provides?|gives?|contains?|offers?|includes?) no (further )?(details?|information)'
        order by id`,
    )
    const planned = rows
      .map(r => ({ id: r.id, before: r.summary, after: clean(r.summary) }))
      .filter(r => r.after !== r.before.trim())
    const empty = planned.filter(r => r.after.length < 40)
    const todo = planned.filter(r => r.after.length >= 40)
    console.log(`Candidates: ${rows.length}; to clean: ${todo.length}; left alone (would leave <40 chars): ${empty.length}; matched but unchanged: ${rows.length - planned.length}`)
    for (const r of todo) {
      const touched = r.before.split(SPLIT).filter(x => META.test(x))
      console.log(`  #${r.id}: ${touched.map(d => `«${d.trim().slice(0, 70)}…» → «${(trimSentence(d) ?? '(dropped)').slice(-70)}»`).join(' ')}`)
    }
    for (const r of empty) console.log(`  SKIP #${r.id}: "${r.after}"`)

    if (!APPLY) {
      await pg.query('ROLLBACK')
      console.log('\nDry-run: nothing written. Re-run with --apply.')
      return
    }
    const at = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const backupPath = `data/fix-news-meta-remarks-backup-${at}.json`
    writeFileSync(backupPath, JSON.stringify(todo.map(({ id, before }) => ({ id, summary: before })), null, 2))
    let n = 0
    for (const r of todo) {
      const res = await pg.query(`update news_items set summary = $2 where id = $1 and summary = $3`, [r.id, r.after, r.before])
      n += res.rowCount ?? 0
    }
    await pg.query('COMMIT')
    console.log(`\nApplied: ${n} summaries cleaned. Backup: ${backupPath}`)
    await bustPaths(['/', '/news'])
  } catch (err) {
    await pg.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    await pg.end()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
