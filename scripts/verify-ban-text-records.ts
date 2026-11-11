/**
 * Record check for the generated ban text (books.description_ban).
 *
 * Since 1b3a641 the book page shows a ban text only when a person vetted it
 * ('human_curated'). ~4,300 generated texts are off the page. Most of them
 * are meant to be a summary of the book's own ban rows — so the cheap question
 * is not "is this true in the world" but "does this text say anything our
 * records do not". That needs no web search.
 *
 * Two stages, both against the book's OWN records (ban rows, row notes,
 * reasons a source states — never 'inferred' ones — and source names):
 *
 *   1. prefilter (code, free)   every number, date and name in the text must
 *                               occur in the records; every reason the text
 *                               gives must be a stated reason or be in a row
 *                               note; no padding phrases, no time relative to now
 *   2. claim check (small LLM)  the text is split into claims; each must be
 *                               covered by a record line (same country, year,
 *                               body, action, reason). All covered → pass.
 *
 * IMPORTANT: this checks against our records, not against the outside world.
 * An error in a ban row passes straight through (2026-11-11: source 825 had
 * publication years as ban years). A text that passes is "a summary of the
 * records below", not a sourced statement — it must not get the
 * 'source_verified' status that verify-censorship-context.ts hands out.
 *
 * DRY-RUN ONLY for now: reads the database, writes
 * data/ban-text-records-<tag>.jsonl (+ .md). No database writes.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/verify-ban-text-records.ts --ids-file=data/ban-text-sample-ids.json --limit=200 --out=sample
 *   Flags: --ids-file= / --ids= (order kept) · --slugs= · --limit=N · --concurrency=N (default 6)
 *          --models=fast,strong (default fast; both = measure them side by side) · --out=<tag> · --no-resume
 */

import fs from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'
import { OPENAI_COST_PER_TOKEN, OPENAI_FAST, OPENAI_STRONG, OPENAI_NO_REASONING } from '../src/lib/llm-models'
import { sentenceGroundingProblems } from '../src/lib/censorship-context-verify'
import { descriptionBanQualityGate } from '../src/lib/censorship-context-quality'
import { hasFlag, flagValue, intFlag, idsFlag, idChunks, isApply } from './lib/cli'

const IDS = idsFlag()
const SLUGS = flagValue('slugs')?.split(',').map(s => s.trim()).filter(Boolean)
const LIMIT = intFlag('limit', 30)
const CONCURRENCY = Math.max(1, Math.min(10, intFlag('concurrency', 6)))
const NO_RESUME = hasFlag('no-resume')
const OUT_TAG = flagValue('out') ?? new Date().toISOString().slice(0, 10)
const MODELS = (flagValue('models') ?? 'fast').split(',').map(s => s.trim()).filter(m => m === 'fast' || m === 'strong') as Array<'fast' | 'strong'>
const MODEL_ID = { fast: OPENAI_FAST, strong: OPENAI_STRONG }

// ── Types ───────────────────────────────────────────────────────────────

type BanRow = {
  id: number
  country_code: string
  scope_id: number
  action_type: string
  status: string
  region: string | null
  institution: string | null
  actor: string | null
  year_started: number | null
  year_ended: number | null
  description: string | null
  countries: { name_en: string } | null
  scopes: { label_en: string } | null
  ban_reason_links: Array<{ basis: string | null; reasons: { slug: string; label_en: string } | null }>
  ban_source_links: Array<{ ban_sources: { source_name: string } | null }>
}

type Book = {
  id: number
  slug: string
  title: string
  first_published_year: number | null
  description_ban: string
  description_ban_status: string | null
  book_authors: Array<{ authors: { display_name: string } | null }>
  bans: BanRow[]
}

type ClaimVerdict = { claim: string; covered: boolean; record: string | null; problem: string | null }
type ModelResult = { pass: boolean; claims: ClaimVerdict[]; costUsd: number; error?: string }

type RunRow = {
  id: number
  slug: string
  title: string
  status: string | null
  text: string
  nBans: number
  records: string
  prefilter: string[]
  fast?: ModelResult
  strong?: ModelResult
  ts: string
}

// ── Records ─────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Names a text may use for a country our rows name differently.
const COUNTRY_ALIASES: Record<string, string[]> = {
  US: ['U.S.', 'US', 'USA', 'America', 'American'],
  GB: ['UK', 'U.K.', 'Britain', 'British', 'England', 'English'],
  SU: ['Soviet', 'USSR', 'Soviets'],
  RU: ['Russian'], CN: ['Chinese'], DE: ['German'], FR: ['French'], IE: ['Irish'], IN: ['Indian'],
  MY: ['Malaysian'], AU: ['Australian'], NZ: ['Zealand'], CA: ['Canadian'], ES: ['Spanish'], IT: ['Italian'],
  PT: ['Portuguese'], BY: ['Belarusian'], IR: ['Iranian'], TR: ['Turkish'], ZA: ['African'], JP: ['Japanese'],
  PL: ['Polish'], VA: ['Vatican', 'Catholic', 'Church', 'Roman'], HK: ['Kong'], SG: ['Singaporean'], EG: ['Egyptian'],
}

function authorsOf(b: Book): string {
  return b.book_authors.map(a => a.authors?.display_name).filter(Boolean).join(', ')
}

/** Record lines for the prompt: rows that differ only by institution are one line. */
function recordLines(b: Book): string[] {
  type G = { rows: BanRow[]; stated: string[]; inferred: string[] }
  const groups = new Map<string, G>()
  for (const r of b.bans) {
    const stated = [...new Set(r.ban_reason_links.filter(l => l.basis !== 'inferred').map(l => l.reasons?.label_en).filter((x): x is string => !!x))].sort()
    const inferred = [...new Set(r.ban_reason_links.filter(l => l.basis === 'inferred').map(l => l.reasons?.label_en).filter((x): x is string => !!x))].sort()
    const key = [r.country_code, r.scope_id, r.action_type, r.status, r.year_started, r.year_ended, stated.join(','), r.description ?? '', r.actor ?? ''].join('|')
    const g = groups.get(key)
    if (g) g.rows.push(r)
    else groups.set(key, { rows: [r], stated, inferred })
  }
  return [...groups.values()].slice(0, 60).map((g, i) => {
    const r = g.rows[0]
    const places = [...new Set(g.rows.map(x => [x.institution, x.region].filter(Boolean).join(', ')).filter(Boolean))]
    const sources = [...new Set(g.rows.flatMap(x => x.ban_source_links.map(l => l.ban_sources?.source_name)).filter((x): x is string => !!x))]
    return [
      `R${i + 1}: ${r.countries?.name_en ?? r.country_code}`,
      r.scopes?.label_en ?? 'unknown scope',
      `action: ${r.action_type}`,
      `started: ${r.year_started ?? 'unknown'}`,
      r.year_ended ? `ended: ${r.year_ended}` : null,
      `status: ${r.status}`,
      g.rows.length > 1 ? `${g.rows.length} rows` : null,
      places.length ? `where: ${places.slice(0, 40).join('; ')}${places.length > 40 ? `; … (${places.length} in all)` : ''}` : null,
      r.actor ? `actor: ${r.actor}` : null,
      `stated reasons: ${g.stated.length ? g.stated.join('; ') : 'none'}`,
      g.inferred.length ? `inferred reasons (NOT evidence): ${g.inferred.join('; ')}` : null,
      r.description ? `note: "${r.description.trim()}"` : null,
      sources.length ? `sources: ${sources.join('; ')}` : null,
    ].filter(Boolean).join(' · ')
  })
}

/** Everything a text may legitimately draw on, as one string for the code checks. */
function recordsBlob(b: Book): string {
  const parts: string[] = [b.title, authorsOf(b), b.first_published_year ? String(b.first_published_year) : '']
  const countries = new Set<string>()
  for (const r of b.bans) {
    countries.add(r.country_code.trim())
    parts.push(
      r.countries?.name_en ?? '', r.scopes?.label_en ?? '', r.action_type, r.status,
      r.region ?? '', r.institution ?? '', r.actor ?? '',
      r.year_started ? String(r.year_started) : '', r.year_ended ? String(r.year_ended) : '',
      r.description ?? '',
      ...r.ban_reason_links.filter(l => l.basis !== 'inferred').map(l => l.reasons?.label_en ?? ''),
      ...r.ban_source_links.map(l => l.ban_sources?.source_name ?? ''),
    )
  }
  for (const c of countries) parts.push(...(COUNTRY_ALIASES[c] ?? []))
  // Counts a summary may state: number of rows and of countries.
  parts.push(String(b.bans.length), String(countries.size))
  let blob = parts.filter(Boolean).join(' \n ')
  // ISO dates in notes ("Gazetted 1957-06-06") also count in written form.
  for (const m of blob.matchAll(/\b(1[5-9]\d\d|20\d\d)-(\d\d)-(\d\d)\b/g)) {
    const mi = Number(m[2]) - 1
    if (mi >= 0 && mi < 12) blob += ` \n ${MONTHS[mi]} ${Number(m[3])}, ${m[1]} · ${Number(m[3])} ${MONTHS[mi]} ${m[1]} · ${MONTHS[mi]} ${m[1]}`
  }
  return blob
}

// ── Stage 1: prefilter ──────────────────────────────────────────────────

const REASON_WORDS: Array<{ slug: string; re: RegExp }> = [
  { slug: 'lgbtq', re: /\b(lgbt\w*|gay|lesbian\w*|queer|homosexual\w*|transgender|same-sex|gender identity)\b/i },
  { slug: 'political', re: /\b(politic\w*|subversi\w*|communis\w*|anti-government|propaganda|seditio\w*|ideolog\w*|extremis\w*)\b/i },
  { slug: 'religious', re: /\b(religio\w*|blasphem\w*|heres\w*|heretic\w*|sacrileg\w*)\b/i },
  { slug: 'sexual', re: /\b(sexual\w*|sex|porn\w*|erotic\w*|nudity|explicit)\b/i },
  { slug: 'violence', re: /\b(violen\w*|gore|brutal\w*)\b/i },
  { slug: 'racial', re: /\b(racial\w*|racis\w*|coloni\w*)\b/i },
  { slug: 'drugs', re: /\b(drugs?|alcohol|substance)\b/i },
  { slug: 'obscenity', re: /\b(obscen\w*|indecen\w*|lewd)\b/i },
  { slug: 'language', re: /\b(profan\w*|vulgar\w*|offensive language|swear\w*)\b/i },
  { slug: 'moral', re: /\b(immoral\w*|moral\w*|inappropriate|unsuit\w*|mature)\b/i },
]

function prefilter(b: Book): string[] {
  const text = b.description_ban
  const blob = recordsBlob(b)
  const problems: string[] = []

  const gate = descriptionBanQualityGate(text)
  if (!gate.accept) problems.push(`padding:${gate.tells[0] ?? gate.bucket}`)

  // Numbers, names, time relative to now — the same code that guards the sourced histories.
  problems.push(...sentenceGroundingProblems({
    sentence: text.replace(/\*+/g, ''),
    quotes: [blob], pageTexts: [blob],
    allowWords: [b.title, authorsOf(b)], title: b.title, forceNameCheck: true,
  }))

  // Written dates must be the dates in the records, month included.
  const lower = blob.toLowerCase()
  for (const m of text.matchAll(new RegExp(`\\b(?:(\\d{1,2}) )?(${MONTHS.join('|')})(?: (\\d{1,2}),?)? (1[5-9]\\d\\d|20\\d\\d)\\b`, 'g'))) {
    const day = m[1] ?? m[3]
    const want = day ? `${m[2]} ${Number(day)}, ${m[4]}` : `${m[2]} ${m[4]}`
    if (!lower.includes(want.toLowerCase())) problems.push(`date:${want}`)
  }

  // A reason the text gives must be one a source states, or be in a row note.
  const stated = new Set(b.bans.flatMap(r => r.ban_reason_links.filter(l => l.basis !== 'inferred').map(l => l.reasons?.slug)))
  const notes = b.bans.map(r => r.description ?? '').join(' \n ').toLowerCase()
  const plain = text.split(b.title).join(' ')
  for (const { slug, re } of REASON_WORDS) {
    const m = plain.match(re)
    if (!m) continue
    if (stated.has(slug)) continue
    if (notes.includes(m[0].toLowerCase().slice(0, 6))) continue
    problems.push(`reason:${slug}(${m[0]})`)
  }
  return [...new Set(problems)]
}

// ── Stage 2: claim check ────────────────────────────────────────────────

// Fixed instruction first, so the provider can cache the prefix.
const CHECK_SYSTEM = `You check a short "why it was banned" text for ONE book against the archive's own RECORDS for that book. The records are the only truth you may use. You have no other knowledge of this book or of the world.

Split the TEXT into atomic claims: who acted, where, when, what the action was, the stated reason, the outcome or current status, who documented it. Then judge each claim:

covered = true only if a RECORD line states it:
- the same country, and the same region / institution / authority where the text names one;
- the same year or date (a year in the text must be a "started" or "ended" year or be in a row note);
- the same action: "banned", "restricted" and "challenged" are different actions; "removed" counts as banned only for a school or library row;
- the same reason: only "stated reasons" and row notes count. "inferred reasons" are guesses and never cover a claim;
- status words ("still", "remains", "was lifted", "rescinded") must match the row's status or end year.

Not covered: anything about the book's content, plot, themes or author that no record states; any event, number, body, law or quotation that is not in a record; commentary ("reflecting…", "part of a wider…"); a general statement ("often challenged", "in several districts") unless the rows show it.
A plain mention of the title, author or publication year is not a claim. A count ("banned in 12 districts") is covered only if the rows add up to it.

Return ONLY JSON: {"claims":[{"claim":"…","covered":true,"record":"R1","problem":null}]}
"record" is the line that covers the claim (null if none); "problem" says in a few words what is missing (null if covered).`

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function claimCheck(b: Book, lines: string[], which: 'fast' | 'strong'): Promise<ModelResult> {
  const model = MODEL_ID[which]
  const user = `BOOK: "${b.title}" by ${authorsOf(b) || 'unknown author'}${b.first_published_year ? `, first published ${b.first_published_year}` : ''}

RECORDS:
${lines.join('\n')}

TEXT:
${b.description_ban}`
  try {
    let res: Awaited<ReturnType<typeof openai.chat.completions.create>> | null = null
    for (let attempt = 1; ; attempt++) {
      try {
        res = await openai.chat.completions.create({
          ...OPENAI_NO_REASONING, model, max_completion_tokens: 900, temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: CHECK_SYSTEM }, { role: 'user', content: user }],
        })
        break
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (attempt >= 3 || !/\b(429|500|502|503|504)\b|timeout|ECONNRESET|fetch failed/i.test(msg)) throw e
        await new Promise(r => setTimeout(r, 3000 * attempt))
      }
    }
    const p = OPENAI_COST_PER_TOKEN[model] ?? OPENAI_COST_PER_TOKEN['gpt-6-luna']
    const costUsd = (res!.usage?.prompt_tokens ?? 0) * p.input + (res!.usage?.completion_tokens ?? 0) * p.output
    let parsed: { claims?: unknown } = {}
    try { parsed = JSON.parse(res!.choices[0]?.message?.content ?? '{}') } catch { /* fails below */ }
    const raw = Array.isArray(parsed.claims) ? parsed.claims as Array<Record<string, unknown>> : []
    const claims: ClaimVerdict[] = raw.filter(c => typeof c.claim === 'string').map(c => ({
      claim: c.claim as string,
      covered: c.covered === true,
      record: typeof c.record === 'string' ? c.record : null,
      problem: typeof c.problem === 'string' ? c.problem : null,
    }))
    // No claims at all is not a pass: a text that says nothing checkable is not a summary of the records.
    return { pass: claims.length > 0 && claims.every(c => c.covered), claims, costUsd: Number(costUsd.toFixed(6)) }
  } catch (e) {
    return { pass: false, claims: [], costUsd: 0, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Load ────────────────────────────────────────────────────────────────

const SELECT = `id, slug, title, first_published_year, description_ban, description_ban_status,
  book_authors(authors(display_name)),
  bans(id, country_code, scope_id, action_type, status, region, institution, actor, year_started, year_ended, description,
    countries(name_en), scopes(label_en),
    ban_reason_links(basis, reasons(slug, label_en)),
    ban_source_links(ban_sources(source_name)))`

// The texts that are off the page today. 'human_curated' is shown; 'auto_rejected_low_quality' was never shown.
const inPool = (b: Book) => !!b.description_ban?.trim() && (b.description_ban_status == null || b.description_ban_status === 'auto_accepted')

async function loadBooks(): Promise<Book[]> {
  const sb = adminClient()
  const out: Book[] = []
  if (SLUGS?.length) {
    const { data, error } = await sb.from('books').select(SELECT).in('slug', SLUGS)
    if (error) throw new Error(`DB read: ${error.message}`)
    out.push(...(data as unknown as Book[]))
  } else if (IDS) {
    for (const chunk of idChunks(IDS, 60)) {
      const { data, error } = await sb.from('books').select(SELECT).in('id', chunk!)
      if (error) throw new Error(`DB read: ${error.message}`)
      out.push(...(data as unknown as Book[]))
    }
    const pos = new Map(IDS.map((id, i) => [id, i]))
    out.sort((a, b) => pos.get(a.id)! - pos.get(b.id)!)
  } else {
    throw new Error('Pass --ids-file=, --ids= or --slugs= (the full pool is ~4,300 books; build a worklist first).')
  }
  return out.filter(inPool)
}

// ── Report ──────────────────────────────────────────────────────────────

function verdictOf(r: RunRow, which: 'fast' | 'strong'): 'pass' | 'prefilter' | 'claims' | 'error' {
  if (r.prefilter.length) return 'prefilter'
  const m = r[which]
  if (!m) return 'error'
  if (m.error) return 'error'
  return m.pass ? 'pass' : 'claims'
}

function writeReport(rows: RunRow[], reportPath: string) {
  const L: string[] = []
  L.push(`# Ban-text record check — ${OUT_TAG}`, '')
  L.push(`${rows.length} texts · dry-run (no database writes). A pass means "says nothing our records do not", not "true".`, '')
  for (const which of MODELS) {
    const t: Record<string, number> = {}
    for (const r of rows) { const v = verdictOf(r, which); t[v] = (t[v] ?? 0) + 1 }
    const cost = rows.reduce((a, r) => a + (r[which]?.costUsd ?? 0), 0)
    L.push(`**${which}** (${MODEL_ID[which]}): ${Object.entries(t).map(([k, v]) => `${k} ${v}`).join(' · ')} · model cost $${cost.toFixed(4)} ($${(cost / Math.max(1, rows.length)).toFixed(5)}/text)`, '')
  }
  const main = MODELS[0]
  const block = (title: string, pick: (r: RunRow) => boolean) => {
    const rs = rows.filter(pick)
    if (!rs.length) return
    L.push(`## ${title} (${rs.length})`, '')
    for (const r of rs) {
      L.push(`### ${r.title} · \`${r.slug}\` · ${r.nBans} ban row(s)`, '', `**Text:** ${r.text}`, '')
      if (r.prefilter.length) L.push(`**Prefilter:** ${r.prefilter.join(' · ')}`, '')
      for (const which of MODELS) {
        const m = r[which]
        if (!m) continue
        const bad = m.claims.filter(c => !c.covered)
        L.push(`**${which}:** ${m.error ? `error ${m.error}` : m.pass ? `all ${m.claims.length} claims covered` : bad.map(c => `✗ ${c.claim} — ${c.problem ?? 'not in records'}`).join(' · ')}`, '')
      }
      L.push('```', r.records, '```', '')
    }
  }
  block('Pass', r => verdictOf(r, main) === 'pass')
  block('Stopped by the claim check', r => verdictOf(r, main) === 'claims')
  block('Stopped by the prefilter', r => verdictOf(r, main) === 'prefilter')
  block('Errors', r => verdictOf(r, main) === 'error')
  fs.writeFileSync(reportPath, L.join('\n') + '\n')
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  if (isApply()) { console.error('--apply does not exist yet: this check is dry-run only until the sample is approved.'); process.exit(1) }
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set')
  if (MODELS.length === 0) throw new Error('--models must name fast and/or strong')
  const jsonlPath = path.resolve('data', `ban-text-records-${OUT_TAG}.jsonl`)
  const reportPath = path.resolve('data', `ban-text-records-${OUT_TAG}.md`)
  const rows: RunRow[] = []
  if (!NO_RESUME && fs.existsSync(jsonlPath)) {
    for (const line of fs.readFileSync(jsonlPath, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try { rows.push(JSON.parse(line) as RunRow) } catch { /* torn line */ }
    }
  }
  const done = new Set(rows.map(r => r.id))
  const batch = (await loadBooks()).filter(b => !done.has(b.id)).slice(0, LIMIT)
  console.log(`This run ${batch.length} (resumed ${done.size}) · models ${MODELS.join('+')} · concurrency ${CONCURRENCY} · dry-run`)

  let next = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= batch.length) return
      const b = batch[i]
      const lines = recordLines(b)
      const row: RunRow = {
        id: b.id, slug: b.slug, title: b.title, status: b.description_ban_status, text: b.description_ban,
        nBans: b.bans.length, records: lines.join('\n'), prefilter: prefilter(b), ts: new Date().toISOString(),
      }
      // In a measuring run the model sees every text, also those the prefilter stops,
      // so the two stages can be compared. A production run would skip them.
      for (const which of MODELS) row[which] = await claimCheck(b, lines, which)
      rows.push(row)
      fs.appendFileSync(jsonlPath, JSON.stringify(row) + '\n')
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  writeReport(rows, reportPath)
  for (const which of MODELS) {
    const t: Record<string, number> = {}
    for (const r of rows) { const v = verdictOf(r, which); t[v] = (t[v] ?? 0) + 1 }
    console.log(`${which}: ${JSON.stringify(t)} · $${rows.reduce((a, r) => a + (r[which]?.costUsd ?? 0), 0).toFixed(4)}`)
  }
  console.log(`Report: ${reportPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
