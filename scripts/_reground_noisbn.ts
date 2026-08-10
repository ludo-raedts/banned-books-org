#!/usr/bin/env tsx
/**
 * One-off: re-ground the no-ISBN ungrounded synopses that the audit
 * (data/ungrounded-desc-dryrun.jsonl, decision=REGROUND) found a source for.
 *
 * These rows carry pre-v2 ungrounded text (ai_drafted, no description_source_type,
 * no ISBN) but resolve to a real OpenLibrary/Wikipedia source by title+author.
 * Runs the full v2 ladder over exactly those ids with overwrite, backing up the
 * ORIGINAL description_book + provenance first (the ids+overwrite path in the
 * lib does not auto-backup — only --reground-ungrounded does).
 *
 *   npx tsx --env-file=.env.local scripts/_reground_noisbn.ts            # dry-run, 8 rows
 *   npx tsx --env-file=.env.local scripts/_reground_noisbn.ts --apply    # full apply + backup
 *   npx tsx --env-file=.env.local scripts/_reground_noisbn.ts --limit=20 # cap rows
 */
import fs from 'node:fs'
import path from 'node:path'
import { adminClient } from '../src/lib/supabase'
import { enrichDescriptionsV2 } from '../src/lib/enrich/descriptions-v2'

const APPLY = process.argv.includes('--apply')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : (APPLY ? undefined : 8)

const csvEscape = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// ISO timestamp; rows evaluated at/after this were already processed in the
// first (killed) run on 2026-06-06 — skip them so we don't re-source or
// clobber their backup. Pass --resume-after=<iso> to override.
const resumeArg = process.argv.find(a => a.startsWith('--resume-after='))
const RESUME_AFTER = resumeArg?.split('=')[1] ?? null

// Explicit id list (e.g. data/reground-noisbn-remaining-ids.json). Needed since
// score-data-quality.ts (2026-06-10) re-stamped data_quality_evaluated_at
// catalog-wide, which made --resume-after useless for resuming the killed runs.
const idsFileArg = process.argv.find(a => a.startsWith('--ids-file='))
const IDS_FILE = idsFileArg?.split('=')[1] ?? null

async function main() {
  const sb = adminClient()
  let ids: number[]
  if (IDS_FILE) {
    ids = JSON.parse(fs.readFileSync(IDS_FILE, 'utf8')) as number[]
    console.log(`Loaded ${ids.length} ids from ${IDS_FILE}`)
  } else {
    const jsonl = fs.readFileSync('data/ungrounded-desc-dryrun.jsonl', 'utf8')
    ids = jsonl.split('\n').filter(l => l.includes('"decision":"REGROUND"')).map(l => JSON.parse(l).id as number)
  }

  if (RESUME_AFTER) {
    const done = new Set<number>()
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      const { data, error } = await sb.from('books')
        .select('id, data_quality_evaluated_at')
        .in('id', chunk)
        .gte('data_quality_evaluated_at', RESUME_AFTER)
      if (error) throw new Error(error.message)
      for (const b of data!) done.add(b.id)
    }
    const before = ids.length
    ids = ids.filter(id => !done.has(id))
    console.log(`Resume: skipping ${done.size} already-processed (evaluated >= ${RESUME_AFTER}); ${ids.length} of ${before} remain`)
  }

  if (LIMIT) ids = ids.slice(0, LIMIT)
  console.log(`REGROUND target ids: ${ids.length}${LIMIT ? ` (limited to ${LIMIT})` : ''}`)

  if (APPLY) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backup = path.resolve('data', `reground-noisbn-backup-${stamp}.csv`)
    fs.writeFileSync(backup, ['id', 'slug', 'description_book_old', 'description_source_type_old', 'data_quality_status_old', 'ai_drafted_old'].join(',') + '\n')
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      const { data, error } = await sb.from('books')
        .select('id, slug, description_book, description_source_type, data_quality_status, ai_drafted')
        .in('id', chunk)
      if (error) throw new Error(error.message)
      for (const b of data!) {
        fs.appendFileSync(backup, [b.id, b.slug, b.description_book, b.description_source_type, b.data_quality_status, b.ai_drafted].map(csvEscape).join(',') + '\n')
      }
    }
    console.log(`Backup written: ${backup}`)
  }

  const res = await enrichDescriptionsV2({
    ids,
    apply: APPLY,
    overwrite: true,
    allowLlm: true,
    skipGoogleBooks: true, // GB daily quota exhausted; Wikipedia/OL resolved these in the audit
    concurrency: 3,
    onProgress: (m: string) => console.log(m),
  })
  console.log('\n=== RESULT ===')
  console.log(JSON.stringify(res, null, 2))
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
