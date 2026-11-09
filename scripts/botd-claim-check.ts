/**
 * botd-claim-check.ts — independent claim-level grounding check for hand-written
 * author bios and book descriptions (the /botd-week skill's verification step).
 *
 * The bios in the weekly pre-flight are written by the agent running the skill;
 * a writer re-reading its own text misses its own generalisations. This script
 * hands each text to a second model (OPENAI_STRONG) together with the cited
 * source (bio_source_url / description_source_url, fetched fresh) and our own
 * book+ban records, and gets a verdict per atomic claim:
 *   supported | distorted | unsupported
 * First run (2026-11-09) caught 4 real errors in 9 texts — all in the
 * censorship closing sentence (superlatives, "banned in N countries" over
 * sub-national records, "pulled from shelves" for restrictions).
 *
 * Read-only: writes nothing. Exit 1 when any claim is flagged, so the skill
 * can gate on it. Fix flagged claims (or consciously reject a pedantic flag)
 * and re-run until clean.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/botd-claim-check.ts --authors=19,944 --books=16639
 *   # check drafts BEFORE writing them (same shape as the DB columns):
 *   pnpm tsx --env-file=.env.local scripts/botd-claim-check.ts --draft=drafts.json
 *     drafts.json: { "authors": [{ "id": 19, "bio": "…", "bio_source_url": "…" }],
 *                    "books":   [{ "id": 16639, "description_book": "…", "description_source_url": "…" }] }
 */
import { readFileSync } from 'node:fs'
import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'
import { OPENAI_STRONG } from '../src/lib/llm-models'
import { flagValue } from './lib/cli'

const UA = { 'User-Agent': 'banned-books-org-botd/1.0 (https://banned-books.org)' }

const SYSTEM = `You are a strict fact-checker for an encyclopedia of banned books. You get (A) a TEXT to check, (B) a SOURCE article, (C) DB FACTS: our own database records about the author's books and bans.
Split TEXT into atomic factual claims. For each claim give a verdict:
- "supported": stated in SOURCE or DB FACTS (paraphrase OK, translation OK).
- "distorted": source covers it but TEXT changes meaning, strength, number, date or scope.
- "unsupported": not found in SOURCE or DB FACTS (even if you believe it is true).
Be precise about numbers, years, superlatives, causality and words like "all", "first", "most". A ban record with action_type "restricted" is not a removal; a record limited to one district/state/province is not a national ban.
Return JSON: {"claims":[{"claim":"...","verdict":"supported|distorted|unsupported","evidence":"short quote or DB fact, or empty","note":"why, if not supported"}]}`

type Job = { kind: 'author' | 'book'; id: number; label: string; text: string; sourceUrl: string | null; authorIds: number[] }
type Claim = { claim: string; verdict: 'supported' | 'distorted' | 'unsupported'; evidence: string; note: string }

const ids = (name: string) => (flagValue(name) ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0)

/** Plain text of the cited page: Wikipedia (any language) via the extracts API, else tag-stripped HTML. */
async function fetchSource(url: string): Promise<string> {
  const m = url.match(/^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/(.+)$/)
  if (m) {
    const api = `https://${m[1]}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${m[2]}`
    const d = await (await fetch(api, { headers: UA })).json()
    const page = Object.values(d.query.pages)[0] as { extract?: string }
    return page.extract ?? ''
  }
  const html = await (await fetch(url, { headers: UA })).text()
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

async function dbFacts(sb: ReturnType<typeof adminClient>, authorIds: number[]): Promise<string> {
  const lines: string[] = []
  for (const authorId of authorIds) {
    const { data: ba } = await sb.from('book_authors').select('book_id').eq('author_id', authorId).order('book_id')
    const bookIds = (ba ?? []).map(r => r.book_id)
    const { data: books } = await sb.from('books').select('id, title, first_published_year').in('id', bookIds).order('id')
    for (const b of books ?? []) {
      const { data: bans } = await sb.from('bans')
        .select('country_code, year_started, action_type, status, institution, region, description')
        .eq('book_id', b.id).order('id')
      lines.push(`BOOK "${b.title}" (${b.first_published_year}): ${bans?.length ?? 0} ban records`)
      for (const x of bans ?? []) {
        lines.push(`  - ${x.country_code} ${x.year_started} ${x.action_type}/${x.status} ${x.region ?? ''} ${x.institution ?? ''} ${x.description ?? ''}`.replace(/\s+/g, ' ').trim())
      }
    }
  }
  return lines.join('\n')
}

async function main() {
  const sb = adminClient()
  const draftPath = flagValue('draft')
  const draft = draftPath ? JSON.parse(readFileSync(draftPath, 'utf8')) : { authors: [], books: [] }
  const authorIds = [...new Set([...ids('authors'), ...(draft.authors ?? []).map((a: { id: number }) => a.id)])]
  const bookIds = [...new Set([...ids('books'), ...(draft.books ?? []).map((b: { id: number }) => b.id)])]
  if (!authorIds.length && !bookIds.length) throw new Error('pass --authors=…, --books=… and/or --draft=…')

  const jobs: Job[] = []
  if (authorIds.length) {
    const { data } = await sb.from('authors').select('id, display_name, bio, bio_source_url').in('id', authorIds).order('id')
    for (const a of data ?? []) {
      const d = (draft.authors ?? []).find((x: { id: number }) => x.id === a.id) ?? {}
      jobs.push({ kind: 'author', id: a.id, label: a.display_name, text: d.bio ?? a.bio, sourceUrl: d.bio_source_url ?? a.bio_source_url, authorIds: [a.id] })
    }
  }
  if (bookIds.length) {
    const { data } = await sb.from('books').select('id, title, description_book, description_source_url, book_authors(author_id)').in('id', bookIds).order('id')
    for (const b of data ?? []) {
      const d = (draft.books ?? []).find((x: { id: number }) => x.id === b.id) ?? {}
      jobs.push({
        kind: 'book', id: b.id, label: b.title, text: d.description_book ?? b.description_book,
        sourceUrl: d.description_source_url ?? b.description_source_url,
        authorIds: (b.book_authors as { author_id: number }[]).map(r => r.author_id),
      })
    }
  }

  const openai = new OpenAI()
  let flaggedTotal = 0
  for (const j of jobs) {
    if (!j.text) { console.log(`\n### ${j.kind} ${j.id} ${j.label}: no text — skipped`); continue }
    if (!j.sourceUrl) { console.log(`\n### ${j.kind} ${j.id} ${j.label}: no source URL — cannot check, FLAGGED`); flaggedTotal++; continue }
    const source = (await fetchSource(j.sourceUrl)).slice(0, 60_000)
    const facts = await dbFacts(sb, j.authorIds)
    // Judge role: keep the default reasoning effort (accuracy over latency, ~10 calls a week).
    const res = await openai.chat.completions.create({
      model: OPENAI_STRONG,
      reasoning_effort: 'medium',
      max_completion_tokens: 12_000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `(A) TEXT:\n${j.text}\n\n(B) SOURCE (${j.sourceUrl}):\n${source}\n\n(C) DB FACTS:\n${facts}` },
      ],
    })
    const claims: Claim[] = JSON.parse(res.choices[0].message.content ?? '{"claims":[]}').claims ?? []
    const flagged = claims.filter(c => c.verdict !== 'supported')
    flaggedTotal += flagged.length
    console.log(`\n### ${j.kind} ${j.id} ${j.label}: ${claims.length} claims, ${flagged.length} flagged`)
    for (const c of flagged) console.log(`  [${c.verdict}] ${c.claim}\n      note: ${c.note}${c.evidence ? ` | evidence: ${c.evidence}` : ''}`)
  }
  console.log(`\n${jobs.length} texts checked, ${flaggedTotal} claims flagged.`)
  process.exitCode = flaggedTotal ? 1 : 0
}

main().catch(e => { console.error(e); process.exit(2) })
