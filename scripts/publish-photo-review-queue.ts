/**
 * Build the author-photo review queue for /admin/authors/photo-review from one
 * or more audit-author-photos-vision.ts checkpoints, and upload it to storage
 * (src/lib/photo-review.ts).
 *
 * Per author, the LAST checkpoint given wins (pass the original run first,
 * then re-checks). Queued: verdicts era_mismatch, unsure, unreadable, plus
 * not_a_person rows whose photo is STILL set (the art-like ones excluded from
 * the --null-ids-file batches). Only rows whose current photo_url still equals
 * the audited URL are queued. Earlier decisions in the stored file are kept, as
 * are pending items for authors the inputs do not cover; an author already
 * decided for the same photo URL is not re-queued.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/publish-photo-review-queue.ts \
 *     --in=data/author-photo-vision-2026-10-19.jsonl,data/author-photo-vision-recheck-2026-10-20.jsonl \
 *     [--identity=data/author-identity-2026-10-20.jsonl,…] [--apply]
 */
import { readFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { readReview, writeReview, type ReviewItem } from '../src/lib/photo-review'
import { flagValue, isApply } from './lib/cli'

const APPLY = isApply()
const INPUTS = (flagValue('in') ?? '').split(',').filter(Boolean)
// audit-author-identity.ts checkpoints: a photo_ol mismatch (the photo is on ANOTHER
// author's Open Library page) is queued as 'identity_mismatch' even if vision said
// portrait; a photo_file mismatch is attached as a hint (file names are noisy).
const IDENTITY = (flagValue('identity') ?? '').split(',').filter(Boolean)
const QUEUE_VERDICTS = new Set(['era_mismatch', 'unsure', 'unreadable', 'not_a_person'])

type Row = { id: number; photo_url: string; verdict: string; reasoning: string }

async function main() {
  if (!INPUTS.length) throw new Error('--in=<checkpoint.jsonl>[,<recheck.jsonl>] required')
  const latest = new Map<number, Row>()
  for (const f of INPUTS) for (const l of readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(l) as Row
    latest.set(r.id, r)
  }
  type Check = { source: string; value: string; named: string | null; verdict: string }
  const hints = new Map<number, string>()
  for (const f of IDENTITY) for (const l of readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(l) as { id: number; photo_url: string | null; checks: Check[] }
    const ol = r.checks.find(c => c.source === 'photo_ol' && c.verdict === 'mismatch')
    const file = r.checks.find(c => c.source === 'photo_file' && c.verdict === 'mismatch')
    if (ol && r.photo_url) {
      latest.set(r.id, { id: r.id, photo_url: r.photo_url, verdict: 'identity_mismatch',
        reasoning: `Photo comes from the Open Library author page of ${ol.named} (${ol.value}), not this author.` })
    } else if (file?.named) hints.set(r.id, `File name mentions "${file.named}"`)
  }
  const wanted = [...latest.values()].filter(r => QUEUE_VERDICTS.has(r.verdict) || r.verdict === 'identity_mismatch')

  const sb = adminClient()
  const authors = new Map<number, { slug: string; display_name: string; birth_year: number | null; death_year: number | null; photo_url: string | null }>()
  const ids = wanted.map(r => r.id)
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await sb.from('authors').select('id, slug, display_name, birth_year, death_year, photo_url').in('id', ids.slice(i, i + 300))
    if (error) throw new Error(error.message)
    for (const a of data ?? []) authors.set(Number(a.id), a as never)
  }

  const existing = await readReview()
  const decidedKey = new Set(existing.items.filter(i => i.decision).map(i => `${i.author_id}|${i.photo_url}`))
  // Keep every decision, plus pending items for authors these inputs do NOT
  // cover (so publishing one new checkpoint never drops the older queue).
  const covered = new Set(latest.keys())
  const kept = existing.items.filter(i => i.decision || !covered.has(i.author_id))
  const fresh: ReviewItem[] = []
  for (const r of wanted) {
    const a = authors.get(r.id)
    if (!a || a.photo_url !== r.photo_url) continue            // photo removed/changed since the audit
    if (decidedKey.has(`${r.id}|${r.photo_url}`)) continue      // a human already decided this photo
    fresh.push({ author_id: r.id, slug: a.slug, name: a.display_name, birth_year: a.birth_year, death_year: a.death_year,
      photo_url: r.photo_url, verdict: r.verdict, reasoning: r.reasoning, ...(hints.has(r.id) ? { identity_note: hints.get(r.id) } : {}) })
  }
  const by: Record<string, number> = {}
  for (const f of fresh) by[f.verdict] = (by[f.verdict] ?? 0) + 1
  console.log(`queue: ${fresh.length} from these inputs ${JSON.stringify(by)} · ${kept.length} earlier items kept (decisions + other authors' pending)`)
  if (!APPLY) { console.log('dry-run — re-run with --apply to upload'); return }
  await writeReview({ generated_at: new Date().toISOString(), items: [...kept, ...fresh] })
  console.log('uploaded → storage admin-data/photo-review.json')
}

main().catch(e => { console.error(e); process.exit(1) })
