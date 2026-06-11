#!/usr/bin/env tsx
/**
 * Audit the overlap between description_ban ("why was it banned") and
 * censorship_context ("how did it happen / who pushed for it"). The two
 * fields are often filled from the same structured ban-tuple, producing
 * boilerplate that says the same thing twice across hundreds of pages.
 *
 * Read-only. Writes data/ban-vs-context-audit-<date>.csv with per-book
 * classification + signals. No DB writes — operator decides thresholds
 * after reviewing the distribution.
 *
 * Buckets per book:
 *   TEMPLATE_CONFIRMED — censorship_context contains one of the verbatim
 *                        REASON_CONCLUSIONS sentences from
 *                        scripts/generate-censorship-context.ts.
 *                        Safe to wipe.
 *   REDUCE_TO_BAN_ONLY — trigram newness vs description_ban < 0.30 AND
 *                        no rich-case signals. Redundant in practice.
 *   KEEP_NARRATIVE     — rich-case signal present (court-case string,
 *                        ≥3 countries, ≥2 reasons, has ban_source_links,
 *                        OR data_quality_status='confident'). Or high
 *                        trigram newness without other signals.
 *   NO_CONTEXT         — censorship_context is NULL. Nothing to evaluate.
 *
 * After this audit lands you decide: which buckets get wiped, which get
 * permanently marked 'insufficient_evidence' so v3 re-runs leave them
 * alone, which get queued for grounded v3 re-enrichment.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

// ── Template fingerprint sentences from generate-censorship-context.ts ──
// If censorship_context literally contains any of these, it was emitted
// by the template generator (or copies of it). They are deliberately
// verbose and reason-specific so the false-positive rate is near zero.
// Two groups:
//   1. CONCLUSION sentences — the closing fixed line per reason slug.
//   2. STRUCTURAL phrases — the body-of-the-text scaffolding the generator
//      produces (openers, scope breakdowns, lift notes). Catches rows where
//      a conclusion was edited out but the opener betrays the origin.
const TEMPLATE_CONCLUSIONS: string[] = [
  'This case illustrates how governments across political systems have used censorship to shield authority from literary criticism.',
  'This pattern reflects the broad and inconsistent application of obscenity law across different legal systems.',
  'This case is part of a global pattern in which LGBTQ+ representation in literature faces disproportionate legal and institutional pressure.',
  'This reflects the recurring tension between protecting readers from disturbing content and suppressing honest accounts of human experience.',
  'This case illustrates the paradox of censoring literature that critiques racism for the very language it uses to document it.',
  'This case illustrates how religious authority and the state have historically aligned to suppress challenges to official doctrine.',
  'Blasphemy prohibitions demonstrate how religious offence continues to be treated as a legal harm in much of the world.',
  'This reflects how broadly drawn obscenity laws have historically targeted serious literature alongside explicitly pornographic material.',
  'This illustrates how catch-all moral provisions have been used to suppress not just explicit material but any challenge to social convention.',
  'This case reflects ongoing discomfort with literature that depicts drug use honestly rather than through a cautionary lens.',
  'This illustrates how the presence of offensive language',
  'This case illustrates how censorship authorities regularly reach for novel justifications when standard categories do not apply.',
]

const TEMPLATE_STRUCTURAL: RegExp[] = [
  // Single-ban opener: "$title was banned or restricted in $country in $year for $reason"
  /\bwas banned or restricted in [A-Z][^.]{2,80}\b(?: in \d{4})? for\b/,
  // Multi-country opener
  /\bhas been banned or restricted in multiple countries primarily for\b/,
  // Geographic scope sentence
  /\bThe book has faced formal bans or removal orders in\b/,
  // Government scope
  /\bGovernment-level bans have been imposed in\b/,
  /\bIn each case the ban was imposed at the national or government level\b/,
  // School scope
  /\bchallenges have been concentrated at school and library level\b/,
  // Lifted-bans coda
  /\bhave since been lifted or lapsed, though restrictions remain active elsewhere\b/,
  /\bThe documented ban has since been lifted or lapsed; the book now circulates freely\b/,
]

// ── Rich-case detection ─────────────────────────────────────────────────
// Court-case style strings, named legal proceedings, fatwas, etc. These
// only appear in real legal/historical writing, not in the template.
const COURT_CASE_RE = /\b(?:R v\.|R\. v\.|Reg(?:ina)? v\.|Crown v\.|United States v\.|U\.S\. v\.|People v\.|Commonwealth v\.|Roth v\.|Miller v\.|Stanley v\.|Penguin (?:Books )?(?:trial|case)|Lady Chatterley'?s? trial|fatwa\b|Rushdie affair|Mahomet|Khomeini)/i
const NAMED_PLAINTIFF_RE = /\b(?:Board of Education|School Board|Department of Justice|FBI|HUAC|Senator [A-Z][a-z]+|Justice [A-Z][a-z]+|Judge [A-Z][a-z]+)\b/

// ── Trigram newness ──────────────────────────────────────────────────────
// newness = |new_trigrams_in_context| / |trigrams_in_context|
// → 1.0 means context shares NO trigrams with description_ban (entirely new)
// → 0.0 means context is a subset of description_ban (entirely redundant)
function tokenize(s: string): string[] {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2)
}
function trigrams(s: string): Set<string> {
  const toks = tokenize(s)
  const out = new Set<string>()
  for (let i = 0; i + 2 < toks.length; i++) {
    out.add(`${toks[i]} ${toks[i+1]} ${toks[i+2]}`)
  }
  return out
}
function newnessScore(context: string, ban: string): number {
  const ctxTri = trigrams(context)
  if (ctxTri.size === 0) return 0
  const banTri = trigrams(ban)
  let novel = 0
  for (const t of ctxTri) if (!banTri.has(t)) novel++
  return novel / ctxTri.size
}

function hasTemplateFingerprint(context: string): string | null {
  for (const f of TEMPLATE_CONCLUSIONS) {
    if (context.includes(f)) return `conclusion: "${f.slice(0, 70)}…"`
  }
  for (const re of TEMPLATE_STRUCTURAL) {
    const m = context.match(re)
    if (m) return `structural: "${m[0].slice(0, 70)}…"`
  }
  return null
}

type Book = {
  id: number
  slug: string
  title: string
  description_ban: string | null
  censorship_context: string | null
  data_quality_status: string | null
  ai_drafted: boolean | null
}

type BanInfo = {
  book_id: number
  country_code: string
  reason_slugs: string[]
  has_source_link: boolean
}

async function main() {
  const { adminClient } = await import('../src/lib/supabase')
  const sb = adminClient()

  console.log(`# Audit description_ban vs censorship_context\n`)

  // ── Load all books with at least one of the two fields filled ─────────
  const PAGE = 1000
  const books: Book[] = []
  let from = 0
  for (;;) {
    const { data, error } = await sb
      .from('books')
      .select('id, slug, title, description_ban, censorship_context, data_quality_status, ai_drafted')
      .or('description_ban.not.is.null,censorship_context.not.is.null')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    books.push(...data as Book[])
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`Books with at least one of the fields filled: ${books.length}`)

  // ── Load ban rows + reason links + source links count ────────────────
  // We need country count, reason count, ban_source_links presence per book.
  const bookIds = books.map(b => b.id)
  const banInfoByBook = new Map<number, BanInfo[]>()

  // Pull bans in chunks of 500 ids.
  for (let i = 0; i < bookIds.length; i += 500) {
    const chunk = bookIds.slice(i, i + 500)
    const { data: bansData, error: bansErr } = await sb
      .from('bans')
      .select('id, book_id, country_code, ban_reason_links(reasons(slug)), ban_source_links(source_id)')
      .in('book_id', chunk)
    if (bansErr) throw bansErr
    for (const b of bansData ?? []) {
      const arr = banInfoByBook.get(b.book_id) ?? []
      const reasonSlugs = (b.ban_reason_links as unknown as Array<{ reasons?: { slug?: string } }> ?? [])
        .map(l => l.reasons?.slug).filter(Boolean) as string[]
      const hasSourceLink = ((b.ban_source_links as unknown as unknown[]) ?? []).length > 0
      arr.push({ book_id: b.book_id, country_code: b.country_code, reason_slugs: reasonSlugs, has_source_link: hasSourceLink })
      banInfoByBook.set(b.book_id, arr)
    }
  }

  // ── Classify ──────────────────────────────────────────────────────────
  type Classification = {
    bucket: 'TEMPLATE_CONFIRMED' | 'REDUCE_TO_BAN_ONLY' | 'KEEP_NARRATIVE' | 'NO_CONTEXT'
    fingerprint: string | null
    newness: number
    n_countries: number
    n_reasons: number
    n_with_source_link: number
    has_court_case: boolean
    has_named_plaintiff: boolean
    reasoning: string
  }

  const results: Array<Book & Classification> = []
  const counts = { TEMPLATE_CONFIRMED: 0, REDUCE_TO_BAN_ONLY: 0, KEEP_NARRATIVE: 0, NO_CONTEXT: 0 }

  for (const book of books) {
    const bans = banInfoByBook.get(book.id) ?? []
    const countries = new Set(bans.map(b => b.country_code))
    const reasons = new Set(bans.flatMap(b => b.reason_slugs))
    const n_with_source_link = bans.filter(b => b.has_source_link).length

    if (!book.censorship_context) {
      const c: Classification = {
        bucket: 'NO_CONTEXT',
        fingerprint: null,
        newness: 0,
        n_countries: countries.size,
        n_reasons: reasons.size,
        n_with_source_link,
        has_court_case: false,
        has_named_plaintiff: false,
        reasoning: 'no censorship_context to evaluate',
      }
      results.push({ ...book, ...c })
      counts.NO_CONTEXT++
      continue
    }

    const ctx = book.censorship_context
    const fingerprint = hasTemplateFingerprint(ctx)
    const newness = book.description_ban ? newnessScore(ctx, book.description_ban) : 1.0
    const has_court_case = COURT_CASE_RE.test(ctx)
    const has_named_plaintiff = NAMED_PLAINTIFF_RE.test(ctx)

    // STRICTER rich-case definition. We want signals that prove the
    // book has more narrative case-content than the structured ban-tuple
    // already contains. So:
    //   - court-case or named-plaintiff strings → strongest signal
    //   - ≥5 countries OR ≥3 reasons → genuine geographic/ideological breadth
    //   - ≥3 ban_source_links → multiple cited sources, beyond Wikipedia stub
    // We DON'T treat data_quality_status='confident' as a signal: that just
    // means description_book has been verified, says nothing about ban-case
    // richness. Same for "any ban_source_link" — almost every imported row
    // has at least one.
    const richSignals = (
      has_court_case
      || has_named_plaintiff
      || countries.size >= 5
      || reasons.size >= 3
      || n_with_source_link >= 3
    )

    let bucket: Classification['bucket']
    let reasoning: string
    if (fingerprint) {
      bucket = 'TEMPLATE_CONFIRMED'
      reasoning = `template ${fingerprint}`
    } else if (richSignals) {
      bucket = 'KEEP_NARRATIVE'
      const sigs: string[] = []
      if (has_court_case) sigs.push('court-case-string')
      if (has_named_plaintiff) sigs.push('named-plaintiff')
      if (countries.size >= 5) sigs.push(`${countries.size}-countries`)
      if (reasons.size >= 3) sigs.push(`${reasons.size}-reasons`)
      if (n_with_source_link >= 3) sigs.push(`${n_with_source_link}-ban_source_links`)
      reasoning = `rich signals: ${sigs.join(', ')}; newness=${newness.toFixed(2)}`
    } else if (newness >= 0.7) {
      // Substantially new prose without rich-case signals — likely AI-written
      // but possibly editorial. Keep for human review rather than auto-wipe.
      bucket = 'KEEP_NARRATIVE'
      reasoning = `high newness (${newness.toFixed(2)}) without rich-case signals — likely AI prose; flag for human review`
    } else {
      bucket = 'REDUCE_TO_BAN_ONLY'
      reasoning = `newness=${newness.toFixed(2)} and no rich signals — redundant with description_ban`
    }

    const c: Classification = {
      bucket,
      fingerprint,
      newness,
      n_countries: countries.size,
      n_reasons: reasons.size,
      n_with_source_link,
      has_court_case,
      has_named_plaintiff,
      reasoning,
    }
    results.push({ ...book, ...c })
    counts[bucket]++
  }

  // ── Distribution summary ──────────────────────────────────────────────
  console.log(`\n# Distribution`)
  for (const [k, v] of Object.entries(counts)) {
    const pct = books.length === 0 ? 0 : (v / books.length * 100).toFixed(1)
    console.log(`  ${k.padEnd(20)} ${String(v).padStart(5)}   (${pct}%)`)
  }

  // ── Sample lines per bucket ───────────────────────────────────────────
  for (const bucket of ['TEMPLATE_CONFIRMED', 'REDUCE_TO_BAN_ONLY', 'KEEP_NARRATIVE'] as const) {
    const sample = results.filter(r => r.bucket === bucket).slice(0, 5)
    if (sample.length === 0) continue
    console.log(`\n# Sample — ${bucket}`)
    for (const s of sample) {
      console.log(`  id=${s.id}  ${s.slug}`)
      console.log(`     ${s.reasoning}`)
      console.log(`     description_ban:      ${truncate(s.description_ban, 140)}`)
      console.log(`     censorship_context:   ${truncate(s.censorship_context, 140)}`)
    }
  }

  // ── CSV out ───────────────────────────────────────────────────────────
  const outPath = `data/ban-vs-context-audit-${new Date().toISOString().slice(0, 10)}.csv`
  const csv: string[] = ['id,slug,bucket,newness,n_countries,n_reasons,n_ban_source_links,has_court_case,has_named_plaintiff,template_fingerprint,reasoning,title']
  for (const r of results) {
    csv.push([
      r.id,
      esc(r.slug),
      r.bucket,
      r.newness.toFixed(3),
      r.n_countries,
      r.n_reasons,
      r.n_with_source_link,
      r.has_court_case ? 1 : 0,
      r.has_named_plaintiff ? 1 : 0,
      esc((r.fingerprint ?? '').slice(0, 80)),
      esc(r.reasoning),
      esc(r.title),
    ].join(','))
  }
  writeFileSync(outPath, csv.join('\n'))
  console.log(`\nReport: ${outPath}`)
}

function truncate(s: string | null | undefined, n: number): string {
  if (s == null) return '—'
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > n ? flat.slice(0, n) + '…' : flat
}
function esc(s: string | null | undefined): string {
  if (s == null) return ''
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

main().catch(e => { console.error(e); process.exit(1) })
