#!/usr/bin/env tsx
// LLM 2nd-pass reason classification for queue rows the regex mapper couldn't
// handle. Targets rows where title+authors+year are present, no dedup hit, no
// civil-suit flag, and reason_mapping.slug is null (i.e. blocked only by the
// missing reason slug).
//
// Approach: feed Gemini 2.5 Pro the title, author, year, country/section
// anchor, and notes_raw, and ask it to pick a slug from the canonical
// `reasons` vocabulary. If the LLM cannot determine the reason with confidence,
// it must return 'other'. The mapping is written back to the queue row's
// agreement_details with reviewed_by audit ('auto-llm-2nd-pass'), and the
// `unmapped_reason` flag is replaced by `llm_classified_reason`.
//
// We deliberately DO NOT approve the rows here. The follow-up bulk-auto-accept
// run picks them up if all other gate conditions hold. That keeps the LLM's
// output reviewable and independent of the commit step.
//
// Confidence policy (Sprint-A-style: no blind LLM acceptance):
//   - high / medium → flag 'llm_classified_reason' only → auto-acceptable
//   - low           → also flag 'llm_low_confidence'    → stays manual
// `bulk-auto-accept-queue.ts` includes 'llm_low_confidence' in its blocking
// set so low-confidence picks remain editor-only.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/llm-classify-unmapped-reasons.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/llm-classify-unmapped-reasons.ts --apply    # (--write werkt nog als alias)
//   npx tsx --env-file=.env.local scripts/llm-classify-unmapped-reasons.ts --limit=5  # sample first
import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { adminClient } from '../src/lib/supabase'
import { isApply, flagValue } from './lib/cli'

const WRITE = isApply()
const limitRaw = flagValue('limit')
const LIMIT = limitRaw ? Number(limitRaw) : null

const REASON_SLUGS = [
  'drugs', 'language', 'lgbtq', 'moral', 'obscenity',
  'other', 'political', 'racial', 'religious', 'sexual', 'violence',
] as const

const ClassificationSchema = z.object({
  slug: z.enum(REASON_SLUGS),
  confidence: z.enum(['high', 'medium', 'low']),
  rationale: z.string().min(1).max(400),
})
type Classification = z.infer<typeof ClassificationSchema>

const SYSTEM_PROMPT = `You classify the editorial reason a book was banned.

Pick exactly one slug from this vocabulary:
- drugs: drug references / glorification / instruction
- language: profanity, vulgar language, slurs
- lgbtq: LGBTQ+ identity / themes
- moral: family values, age-appropriateness, anti-family, suicide/alcohol/gambling references, youth-protection framing
- obscenity: pornography, indecency, sexually explicit material framed as obscene
- political: state-imposed political censorship, sedition, criticism of regime/government/leader, communist/anti-state, named regime bans, military/wartime censorship
- racial: racism, antisemitism, ethnic hatred, hate speech, white-supremacy
- religious: religious content concerns, heresy, blasphemy (offending a religion), occult, witchcraft, "religious viewpoint" complaints, mocking a religion, promoting one religion over another
- sexual: sex education, sexual content, references to rape/abuse, nudity (when framed as content concern not obscenity)
- violence: graphic violence, gore, torture, weapons promotion
- other: use ONLY when the reason is genuinely unknown or unclassifiable

Inputs you receive:
- title, author(s), year of publication
- country (banning jurisdiction)
- notes (a one-line Wikipedia cell describing the ban)

Rules:
1. If the notes text explicitly states a reason, classify by the notes text.
2. If notes are thin ("Banned in X from YYYY to YYYY") but the book is well-known and the ban reason is undisputed public knowledge, classify with confidence='medium'.
3. If the underlying reason is unknown, ambiguous, or you'd have to guess, return slug='other' with confidence='low'.
4. NEVER invent reasons. NEVER infer political/sexual/etc. from a country's general censorship reputation alone.
5. Output strictly JSON: {"slug": "...", "confidence": "...", "rationale": "..."}. rationale is one short sentence.`

function userPrompt(row: {
  title: string
  authors: string[]
  year: number
  country: string
  notes: string
}): string {
  return `title: ${row.title}
author(s): ${row.authors.join('; ')}
year: ${row.year}
country/section: ${row.country}
notes: ${row.notes || '(empty)'}`
}

function stripJsonFences(text: string): string {
  const t = text.trim()
  if (t.startsWith('```')) {
    return t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  }
  return t
}

let _genai: GoogleGenAI | null = null
function genai(): GoogleGenAI {
  if (!_genai) {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set')
    _genai = new GoogleGenAI({ apiKey })
  }
  return _genai
}

async function classifyOne(input: {
  title: string; authors: string[]; year: number; country: string; notes: string
}): Promise<Classification> {
  const response = await genai().models.generateContent({
    model: 'gemini-2.5-pro',
    contents: userPrompt(input),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      temperature: 0,
    },
  })
  const text = response.text ?? ''
  const parsed = JSON.parse(stripJsonFences(text))
  return ClassificationSchema.parse(parsed)
}

type CandidateRow = {
  id: number
  source_slug: string
  agreement_details: Record<string, unknown>
  parsed: { title: string; authors: string[]; year: number; notes: string }
  anchor: string
  flags: string[]
}

async function loadCandidates(): Promise<CandidateRow[]> {
  const sb = adminClient()
  const all: any[] = []
  let offset = 0
  while (true) {
    const { data, error } = await sb
      .from('import_review_queue')
      .select('id, source_slug, agreement_details')
      .eq('status', 'pending_review')
      .order('id', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    all.push(...data)
    if (data.length < 1000) break
  }

  const BLOCKING = new Set([
    'defamation_suit_civil', 'civil_action_private_party', 'civil_court_stay_order',
    'possible_duplicate', 'model_3_review_needed',
  ])

  const candidates: CandidateRow[] = []
  for (const r of all) {
    const ad = r.agreement_details ?? {}
    const p = ad.parsed_row ?? {}
    const reason = ad.reason_mapping
    const flags: string[] = ad.quality_flags ?? []
    const dedup = ad.dedup_check?.kind
    if (!p.title || !p.authors?.length || p.year == null) continue
    if (reason?.slug) continue
    if (dedup && dedup !== 'none') continue
    if (flags.some((f: string) => BLOCKING.has(f))) continue
    candidates.push({
      id: r.id,
      source_slug: r.source_slug,
      agreement_details: ad,
      parsed: {
        title: p.title,
        authors: p.authors,
        year: p.year,
        notes: p.notes_raw ?? '',
      },
      anchor: p.source_anchor ?? ad.section_anchor ?? '',
      flags,
    })
  }
  return candidates
}

async function persist(row: CandidateRow, c: Classification): Promise<void> {
  const sb = adminClient()
  const ad = { ...row.agreement_details } as any
  ad.reason_mapping = {
    slug: c.slug,
    confidence: c.confidence,
    rationale: c.rationale,
    source: 'llm-2nd-pass',
  }
  const newFlags = (ad.quality_flags ?? [])
    .filter((f: string) => f !== 'unmapped_reason')
  if (!newFlags.includes('llm_classified_reason')) newFlags.push('llm_classified_reason')
  if (c.confidence === 'low' && !newFlags.includes('llm_low_confidence')) {
    newFlags.push('llm_low_confidence')
  }
  ad.quality_flags = newFlags

  const { error } = await sb
    .from('import_review_queue')
    .update({ agreement_details: ad })
    .eq('id', row.id)
  if (error) throw new Error(`q#${row.id} update: ${error.message}`)
}

async function main() {
  const candidates = await loadCandidates()
  console.log(`Candidates: ${candidates.length}`)
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}${LIMIT ? ` (limit=${LIMIT})` : ''}\n`)

  const work = LIMIT ? candidates.slice(0, LIMIT) : candidates
  const summary = new Map<string, number>()
  let failures = 0

  for (const row of work) {
    try {
      const c = await classifyOne({
        title: row.parsed.title,
        authors: row.parsed.authors,
        year: row.parsed.year,
        country: row.anchor.replace(/_/g, ' '),
        notes: row.parsed.notes,
      })
      summary.set(`${c.slug} (${c.confidence})`, (summary.get(`${c.slug} (${c.confidence})`) ?? 0) + 1)
      console.log(`q#${row.id} [${row.source_slug}] "${row.parsed.title.slice(0, 40)}" → ${c.slug}/${c.confidence}`)
      console.log(`         rationale: ${c.rationale}`)
      if (WRITE) await persist(row, c)
    } catch (e) {
      failures++
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`q#${row.id} FAIL: ${msg}`)
    }
  }

  console.log(`\n── SUMMARY ──`)
  for (const [k, n] of [...summary.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${k}`)
  }
  if (failures) console.log(`  failures: ${failures}`)
  if (!WRITE) console.log(`\n[DRY-RUN] re-run with --write to persist mappings.`)
}

main().catch(e => { console.error(e); process.exit(1) })
