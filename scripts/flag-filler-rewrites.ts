/**
 * Stage 2.5 — flags books whose current description_ban or censorship_context
 * matches an extended filler-phrase regex set, and writes a fake-audit CSV
 * shaped like score-descriptions.ts output so rewrite-descriptions-grounded.ts
 * can target only those books.
 *
 * Free — no LLM calls. Runs in ~5 seconds.
 *
 * Output: data/description-filler-flagged-<timestamp>.csv
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/flag-filler-rewrites.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import { adminClient } from '../src/lib/supabase'

// Original filler patterns from score-descriptions.ts
const FILLER_BASELINE = [
  /reflects (?:the )?(?:recurring|ongoing) tension/i,
  /broad and inconsistent application/i,
  /this pattern reflects/i,
  /frequently banned/i,
  /^the (?:book|novel) has been (?:challenged|banned)/i,
  /highlights ongoing tensions/i,
  /according to records/i,
  /based on available data/i,
  /no documented lawsuits/i,
  /no (?:formal )?(?:lawsuits or )?formal proceedings have been documented/i,
  /no notable legal challenges/i,
  /(?:specific school district|specific district) (?:involved )?(?:has |have )?not been publicly disclosed/i,
  /no public statements? (?:from )?the author or publisher (?:have|has)? been (?:documented|recorded)/i,
  /the official reason given (?:by the banning authority )?was/i,
]

// New patterns from the gpt-4.1-mini run
const FILLER_NEW = [
  /this case illustrates how censorship authorit/i,
  /reach for novel justifications/i,
  /reflecting (?:a )?(?:growing|ongoing|broader) (?:trend|concern|debate)/i,
  /complex (?:social|emotional) issues in educational settings/i,
  /specific scenes or passages (?:that led to the ban )?are not (?:detailed|documented|widely documented)/i,
  /specific (?:details|passages|reasons|themes) (?:regarding|that led to|are not) [^.]+ (?:not|have not been) (?:detailed|publicly|widely)? ?(?:documented|disclosed|available)/i,
  /ongoing discussions (?:among|by) school boards/i,
  /reflecting (?:a )?(?:growing|ongoing) trend of (?:challenging|restricting|banning)/i,
  /themes? deemed (?:immoral|inappropriate|controversial)/i,
  /content (?:being )?deemed (?:inappropriate|obscene|controversial)/i,
  /local parent-teacher associations \(ptas?\)/i,
  /perceived by some as inappropriate/i,
  /(?:still )?ongoing discussions about (?:the )?(?:book|novel)['’]s (?:educational value|appropriateness|relevance)/i,
  /school board votes that resulted in the removal/i,
  /reflects? (?:ongoing|broader|growing) (?:debates?|concerns) (?:about|over)/i,
  /community members? (?:expressed|voiced) (?:discomfort|concerns|objections)/i,
  /(?:in|across) several districts? (?:across )?the united states due to/i,
]

const ALL_PATTERNS = [...FILLER_BASELINE, ...FILLER_NEW]

function detectFiller(text: string | null): { hits: number; matched: string[] } {
  if (!text) return { hits: 0, matched: [] }
  const matched: string[] = []
  for (const re of ALL_PATTERNS) {
    if (re.test(text)) matched.push(re.source.slice(0, 50))
  }
  return { hits: matched.length, matched }
}

type Book = {
  id: number
  slug: string
  title: string
  description_ban: string | null
  censorship_context: string | null
}

async function fetchAll(): Promise<Book[]> {
  const supabase = adminClient()
  const PAGE = 1000
  const all: Book[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('books')
      .select('id, slug, title, description_ban, censorship_context')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    const rows = (data ?? []) as Book[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  const all = await fetchAll()
  console.log(`Scanning ${all.length} books for filler patterns…`)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outPath = path.resolve('data', `description-filler-flagged-${stamp}.csv`)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  const header = ['slug','title','ban_score','ban_reason','ctx_score','ctx_reason','ban_filler_hits','ctx_filler_hits','ban_len','ctx_len']
  fs.writeFileSync(outPath, header.join(',') + '\n')

  let flagged = 0, banFlagged = 0, ctxFlagged = 0
  for (const b of all) {
    const ban = detectFiller(b.description_ban)
    const ctx = detectFiller(b.censorship_context)
    if (ban.hits === 0 && ctx.hits === 0) continue
    flagged++
    if (ban.hits) banFlagged++
    if (ctx.hits) ctxFlagged++

    const row = [
      b.slug, b.title,
      ban.hits ? 1 : 3, ban.matched.join('|'),
      ctx.hits ? 1 : 3, ctx.matched.join('|'),
      ban.matched.join('|'), ctx.matched.join('|'),
      b.description_ban?.length ?? 0,
      b.censorship_context?.length ?? 0,
    ].map(csvEscape).join(',')
    fs.appendFileSync(outPath, row + '\n')
  }

  console.log(`\nFlagged: ${flagged} books  (ban: ${banFlagged}, ctx: ${ctxFlagged})`)
  console.log(`Wrote: ${outPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
