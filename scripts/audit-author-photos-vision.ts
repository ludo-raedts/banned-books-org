/**
 * Vision audit for author photos — the author counterpart of audit-covers-vision.ts.
 *
 * Wrong-subject photos keep slipping in through name-based lookups: a gemstone,
 * an actress namesake, a book cover, and in Oct 2026 a Panoz Esperante car for
 * "Andrea Robertson". No structural check catches these, so this script shows
 * each photo to gpt-4o-mini together with the author's name and life years and
 * asks a narrow question: is this a portrait of a person, and does its era fit?
 * It does NOT try to recognise who the person is.
 *
 * Verdicts:
 *   portrait      — a photo/painting of one person, era plausible → keep
 *   unsure        — person but group shot, tiny, heavily cropped, etc. → review
 *   era_mismatch  — clearly a person, but the era cannot fit (a modern colour
 *                   snapshot for an author who died in 1890) → review
 *   not_a_person  — object, vehicle, book cover, logo, landscape, text → wrong
 *   unreadable    — image did not load → review
 *
 * Output: data/author-photo-vision-<date>.md (review list with image links) plus a
 * JSONL checkpoint (data/author-photo-vision-<date>.jsonl), so an interrupted
 * run resumes where it stopped.
 *
 * REVIEW-ONLY. The first run (2026-10-20) auto-nulled every not_a_person verdict
 * and was far too trigger-happy: 743 of ~3,150 photos (25%), including people
 * at a piano, on stage, or in a painting. They were all restored from the
 * checkpoint. So nothing is written unless you pass a reviewed id list:
 *   --null-ids-file=<json array of author ids>  (photo_url → NULL + photo_v2_checked_at)
 * enrich-author-bios --photos-only can still re-fetch the same Wikipedia
 * thumbnail: if its page is about something else, the bio is suspect too.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-author-photos-vision.ts --ids-file=data/magnusson/new-author-ids.json
 *   npx tsx --env-file=.env.local scripts/audit-author-photos-vision.ts --limit=200          # any authors with a photo
 *   ... --null-ids-file=reviewed.json                                                          # null ONLY these, after eyeballing the report
 */
import OpenAI from 'openai'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { approvedPhotoUrls, readReview } from '../src/lib/photo-review'
import { flagValue, idsFlag, intFlag } from './lib/cli'

const NULL_IDS_FILE = flagValue('null-ids-file')
const IDS = idsFlag()
const LIMIT = intFlag('limit', 100000)
// --tag= gives a separate checkpoint + report (e.g. a re-check with a new prompt)
const STAMP = flagValue('tag') ?? new Date().toISOString().slice(0, 10)
const JSONL = `data/author-photo-vision-${STAMP}.jsonl`
const REPORT = `data/author-photo-vision-${STAMP}.md`

type Verdict = 'portrait' | 'unsure' | 'era_mismatch' | 'not_a_person' | 'unreadable'
type Row = { id: number; slug: string; display_name: string; birth_year: number | null; death_year: number | null; photo_url: string; bio: string | null }
type Result = { id: number; slug: string; name: string; photo_url: string; verdict: Verdict; reasoning: string; has_bio: boolean }

const SYSTEM = `You check author photos for a database of banned books. You get one image plus the author's name and life years. Reply with one JSON object:
{"verdict": "portrait" | "unsure" | "era_mismatch" | "not_a_person" | "unreadable", "reasoning": "one short sentence"}

- "portrait": the main subject is a human being: a photograph, painting, drawing or illustration of a person, also when they are performing, on stage, at an instrument, outdoors or not facing the camera, and nothing about it contradicts the life years
- "unsure": a person is visible but it is a group, a tiny or heavily cropped figure, or otherwise hard to judge
- "era_mismatch": clearly a person, but the image cannot be from the author's lifetime (e.g. a modern colour selfie for someone who died before 1900)
- "not_a_person": NO human being is the main subject: an object, vehicle, animal, gemstone, building, landscape, book cover, poster, logo, map, document or text. If a person is the main subject, it is never "not_a_person".
- "unreadable": the image did not load or is blank

Do not try to identify the person, do not ask whether it is \"related to the author\", and do not judge gender or ethnicity. No prose outside the JSON.`

let _openai: OpenAI | null = null
const openai = () => (_openai ??= new OpenAI())

async function judge(r: Row): Promise<{ verdict: Verdict; reasoning: string }> {
  const years = r.birth_year || r.death_year ? ` (${r.birth_year ?? '?'}–${r.death_year ?? ''})` : ''
  try {
    const res = await openai().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: [
          { type: 'text', text: `Author: ${r.display_name}${years}. Is this an acceptable author photo?` },
          { type: 'image_url', image_url: { url: r.photo_url, detail: 'low' } },
        ] },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 120,
    })
    const p = JSON.parse(res.choices[0]?.message?.content ?? '{}') as { verdict?: string; reasoning?: string }
    const ok: Verdict[] = ['portrait', 'unsure', 'era_mismatch', 'not_a_person', 'unreadable']
    return { verdict: ok.includes(p.verdict as Verdict) ? (p.verdict as Verdict) : 'unsure', reasoning: p.reasoning ?? '' }
  } catch (e) {
    // OpenAI rejects URLs it cannot download — that is "unreadable", not a crash.
    return { verdict: 'unreadable', reasoning: String(e).slice(0, 160) }
  }
}

async function main() {
  const sb = adminClient()
  const done = new Map<number, Result>()
  if (existsSync(JSONL)) for (const l of readFileSync(JSONL, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l) as Result; done.set(r.id, r) }

  const rows: Row[] = []
  for (let from = 0; rows.length < LIMIT; from += 1000) {
    let q = sb.from('authors').select('id, slug, display_name, birth_year, death_year, photo_url, bio')
      .not('photo_url', 'is', null).order('id').range(from, from + 999)
    if (IDS) q = q.in('id', IDS)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...(data as Row[]))
    if (data.length < 1000) break
  }
  // Photos a human marked Good in /admin/authors/photo-review are never re-checked.
  const approved = approvedPhotoUrls(await readReview())
  const todo = rows.slice(0, LIMIT).filter(r => !approved.has(r.photo_url) && (!done.has(r.id) || done.get(r.id)!.photo_url !== r.photo_url))
  console.log(`REVIEW: ${rows.length} authors with a photo, ${todo.length} to check (${done.size} in checkpoint)`)

  let i = 0
  for (const r of todo) {
    const { verdict, reasoning } = await judge(r)
    const res: Result = { id: r.id, slug: r.slug, name: r.display_name, photo_url: r.photo_url, verdict, reasoning, has_bio: !!r.bio }
    appendFileSync(JSONL, JSON.stringify(res) + '\n')
    done.set(r.id, res)
    if (verdict !== 'portrait') console.log(`  ${verdict.padEnd(12)} #${r.id} ${r.display_name} — ${reasoning}`)
    if (++i % 50 === 0) console.log(`  … ${i}/${todo.length}`)
  }

  if (NULL_IDS_FILE) {
    const ids = new Set<number>(JSON.parse(readFileSync(NULL_IDS_FILE, 'utf8')))
    let n = 0
    for (const r of rows) if (ids.has(r.id)) {
      await sb.from('authors').update({ photo_url: null, photo_v2_checked_at: new Date().toISOString() }).eq('id', r.id).eq('photo_url', r.photo_url)
      n++
    }
    console.log(`nulled ${n} reviewed photo(s) from ${NULL_IDS_FILE}`)
  }

  const scope = new Set(rows.map(r => r.id))
  const all = [...done.values()].filter(r => scope.has(r.id))
  const by = (v: Verdict) => all.filter(r => r.verdict === v)
  const section = (v: Verdict, title: string, note: string) => {
    const list = by(v)
    if (!list.length) return ''
    return `## ${title} (${list.length})\n\n${note}\n\n` + list.map(r =>
      `- [${r.name}](https://www.banned-books.org/authors/${r.slug}) — ${r.reasoning}${r.has_bio && v === 'not_a_person' ? ' **(bio may come from the same wrong page: check it)**' : ''}  \n  ![](${r.photo_url})`).join('\n') + '\n\n'
  }
  writeFileSync(REPORT, `# Author photo vision audit — ${STAMP}\n\n` +
    `Checked ${all.length}: portrait ${by('portrait').length}, unsure ${by('unsure').length}, era_mismatch ${by('era_mismatch').length}, not_a_person ${by('not_a_person').length}, unreadable ${by('unreadable').length}.\n\n` +
    section('not_a_person', 'Not a person', 'Check each one; put the confirmed ids in a JSON array and run with --null-ids-file=.') +
    section('era_mismatch', 'Era mismatch', 'Probably a namesake. Check, then fix via the admin portal.') +
    section('unsure', 'Unsure', 'Group shots, tiny or cropped figures.') +
    section('unreadable', 'Unreadable', 'Image did not load (dead link or a host OpenAI cannot fetch).'))
  console.log(`report: ${REPORT}`)
}

main().catch(e => { console.error(e); process.exit(1) })
