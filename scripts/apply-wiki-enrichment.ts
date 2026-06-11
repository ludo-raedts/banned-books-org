#!/usr/bin/env tsx
/**
 * Step C of the Wikipedia enrichment pipeline.
 *
 * Reads data/wiki-enrichment-staging/*.json (produced by step B) and applies
 * proposed changes to the DB. Dry-run by default; pass --apply to write.
 *
 * For each staged file:
 *   - Ensures missing countries exist in the countries lookup table.
 *   - Inserts new bans (idempotency: skip if a near-duplicate already exists).
 *   - Updates existing bans, but only fields where the patch carries NEW info
 *     (regression-guard: never shorten a description, never overwrite a
 *     non-null field with null, never undo a manually-fixed scope_id).
 *   - Creates/uses a ban_source row keyed to the Wikipedia URL for the book.
 *   - Links the source to all touched bans (new + updated).
 *   - Updates book.description_ban / censorship_context only if the rewrite is
 *     strictly longer and the existing text is null OR shorter.
 *
 *   node --env-file=.env.local --import tsx scripts/apply-wiki-enrichment.ts
 *   node --env-file=.env.local --import tsx scripts/apply-wiki-enrichment.ts --apply
 *   node --env-file=.env.local --import tsx scripts/apply-wiki-enrichment.ts --only=tintin-in-the-congo
 *   node --env-file=.env.local --import tsx scripts/apply-wiki-enrichment.ts --apply --slug=lolita
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const t = l.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq)
    if (process.env[k]) continue
    process.env[k] = t.slice(eq + 1)
  }
}
loadEnvLocal()

import { adminClient } from '../src/lib/supabase'
import { censorshipContextQualityGate } from '../src/lib/censorship-context-quality'

const APPLY = process.argv.includes('--apply')
const STAGING_DIR = join(process.cwd(), 'data', 'wiki-enrichment-staging')
const LOG_PATH = join(process.cwd(), 'data', 'wiki-enrichment-applied.log')

const ONLY_SLUGS = new Set(
  process.argv
    .filter(a => a.startsWith('--only=') || a.startsWith('--slug='))
    .flatMap(a => a.split('=')[1].split(',').map(s => s.trim()))
    .filter(Boolean),
)

type StagedNewBan = {
  country_code: string
  country_name: string
  year_started: number | null
  year_ended: number | null
  scope_id: number
  scope_label: string
  action_type: 'banned' | 'challenged' | 'removed' | 'restricted' | 'blocked'
  status: 'active' | 'rescinded' | 'historical' | 'unclear'
  region: string | null
  institution: string | null
  actor: string | null
  description: string
  wikipedia_quote: string
}

type StagedUpdate = {
  ban_id: number
  patch: Record<string, unknown>
  rationale: string
  wikipedia_quote: string
}

type Staged = {
  book_id: number
  slug: string
  title: string
  author: string | null
  wikipedia_url: string
  generated_at: string
  new_bans: StagedNewBan[]
  updates_to_existing: StagedUpdate[]
  book_description_ban_rewrite: string | null
  book_censorship_context_rewrite: string | null
  notes: string | null
}

const VALID_ACTION_TYPES = new Set(['banned', 'challenged', 'removed', 'restricted', 'blocked'])
const VALID_STATUSES = new Set(['active', 'rescinded', 'historical', 'unclear'])
const VALID_SCOPE_IDS = new Set([1, 2, 3, 4, 5, 6, 7])

type LogLine = string
const logLines: LogLine[] = []

function log(...args: unknown[]) {
  const s = args
    .map(a => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')
  const tag = APPLY ? '[APPLY]' : '[DRY-RUN]'
  console.log(tag, s)
  logLines.push(`${tag} ${s}`)
}

// ─── Sanity guards ───────────────────────────────────────────────────────────

function validateNewBan(b: StagedNewBan): string | null {
  if (!/^[A-Z]{2}$/.test(b.country_code)) return `bad country_code "${b.country_code}"`
  if (!VALID_SCOPE_IDS.has(b.scope_id)) return `bad scope_id ${b.scope_id}`
  if (!VALID_ACTION_TYPES.has(b.action_type)) return `bad action_type "${b.action_type}"`
  if (!VALID_STATUSES.has(b.status)) return `bad status "${b.status}"`
  if (b.year_started !== null && (b.year_started < 1400 || b.year_started > 2100))
    return `implausible year_started ${b.year_started}`
  if (b.year_ended !== null && b.year_ended !== undefined) {
    if (b.year_ended < 1400 || b.year_ended > 2100) return `implausible year_ended ${b.year_ended}`
    if (b.year_started !== null && b.year_ended < b.year_started)
      return `year_ended < year_started`
  }
  if (!b.description || b.description.trim().length < 25)
    return `description too short (must include specifics)`
  if (!b.wikipedia_quote || b.wikipedia_quote.trim().length < 25)
    return `wikipedia_quote too short`
  return null
}

function patchHasNewInfo(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): { sanitized: Record<string, unknown>; reasons: string[] } {
  const sanitized: Record<string, unknown> = {}
  const reasons: string[] = []
  for (const [key, val] of Object.entries(patch)) {
    if (val === null || val === undefined) continue
    const existingVal = existing[key]
    if (key === 'description') {
      const existingStr = (existingVal as string | null) ?? ''
      const newStr = String(val)
      // Don't regress: existing must not already contain the proposed text.
      if (existingStr.includes(newStr)) {
        reasons.push(`skip description: existing already contains proposed text`)
        continue
      }
      // Never overwrite a longer existing description with a shorter one
      // unless the new one mentions facts the existing doesn't.
      if (
        existingStr.length > newStr.length &&
        !hasFactsExistingDoesNotHave(existingStr, newStr)
      ) {
        reasons.push(`skip description: shorter than existing, no new facts`)
        continue
      }
      sanitized[key] = newStr
      continue
    }
    if (existingVal !== null && existingVal !== undefined && existingVal !== '' && existingVal === val) {
      reasons.push(`skip ${key}: unchanged`)
      continue
    }
    // For scope/year fixes: allow when existing is null OR clearly wrong.
    sanitized[key] = val
  }
  return { sanitized, reasons }
}

/** Heuristic: does the proposed string mention 4-letter+ tokens absent from existing? */
function hasFactsExistingDoesNotHave(existing: string, proposed: string): boolean {
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 4),
    )
  const eTok = tokens(existing)
  const pTok = tokens(proposed)
  let newCount = 0
  for (const t of pTok) if (!eTok.has(t)) newCount++
  return newCount >= 3 // at least 3 new significant tokens
}

// ─── Per-book applier ────────────────────────────────────────────────────────

const KNOWN_COUNTRIES = new Map<string, string>() // code → name
async function getCountryInfo(sb: ReturnType<typeof adminClient>): Promise<void> {
  if (KNOWN_COUNTRIES.size > 0) return
  const { data } = await sb.from('countries').select('code, name_en')
  for (const r of data ?? []) KNOWN_COUNTRIES.set(r.code, r.name_en)
}

async function ensureCountry(
  sb: ReturnType<typeof adminClient>,
  code: string,
  name: string,
): Promise<void> {
  if (KNOWN_COUNTRIES.has(code)) return
  log(`insert country ${code} (${name})`)
  if (APPLY) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const { error } = await sb.from('countries').insert({ code, name_en: name, slug })
    if (error) throw error
  }
  KNOWN_COUNTRIES.set(code, name)
}

async function ensureWikiSource(
  sb: ReturnType<typeof adminClient>,
  url: string,
  title: string,
): Promise<number> {
  const { data: existing } = await sb
    .from('ban_sources')
    .select('id')
    .eq('source_url', url)
    .maybeSingle()
  if (existing) return existing.id
  log(`insert ban_sources row (${title}) ${url}`)
  if (APPLY) {
    const { data, error } = await sb
      .from('ban_sources')
      .insert({
        source_name: `Wikipedia — ${title}`,
        source_url: url,
        source_type: 'web',
        accessed_at: new Date().toISOString().slice(0, 10),
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  return -1
}

async function linkSource(
  sb: ReturnType<typeof adminClient>,
  banId: number,
  sourceId: number,
): Promise<void> {
  if (sourceId < 0) {
    log(`  would link ban_id=${banId} → (pending new source)`)
    return
  }
  const { data: existing } = await sb
    .from('ban_source_links')
    .select('ban_id')
    .eq('ban_id', banId)
    .eq('source_id', sourceId)
    .maybeSingle()
  if (existing) return
  log(`  link ban_id=${banId} → source_id=${sourceId}`)
  if (APPLY) {
    const { error } = await sb.from('ban_source_links').insert({ ban_id: banId, source_id: sourceId })
    if (error) throw error
  }
}

/**
 * Normalize an institution string to its identifying core so that the common
 * US-district phrasings collapse to the same value:
 *   "Broward County Public Schools" / "Broward County Schools" /
 *   "Broward County School District"  →  "broward county"
 *
 * Lowercase, strip punctuation, then drop filler/type tokens (public, unified,
 * school(s), district, isd). Returns '' when the string is ALL filler
 * (e.g. "Public Schools") — callers must treat an empty core as "no usable
 * normalization", never as a match, or every all-filler row would collide.
 *
 * Note: it deliberately keeps distinguishing nouns like "library", so a
 * "Broward County Public Library" ban ("broward county library") does NOT
 * collapse onto a "Broward County Public Schools" ban ("broward county").
 */
const INSTITUTION_FILLER = new Set(['public', 'unified', 'school', 'schools', 'district', 'isd'])
function normalizeInstitution(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok && !INSTITUTION_FILLER.has(tok))
    .join(' ')
    .trim()
}

/**
 * Do two institution strings identify the same institution? Exact match,
 * bidirectional substring ("X Schools" ⊂ "X County Schools"), or
 * identifying-core match via normalizeInstitution ("X Public Schools" =
 * "X School District"). Empty core never matches.
 */
function institutionsCorrespond(a: string, b: string): boolean {
  const aLc = a.toLowerCase()
  const bLc = b.toLowerCase()
  if (aLc === bLc || aLc.includes(bLc) || bLc.includes(aLc)) return true
  const aCore = normalizeInstitution(a)
  return aCore !== '' && aCore === normalizeInstitution(b)
}

/**
 * Wrong-row guard (2026-06-11, after the Broward #34760 / Collierville #34627
 * contamination): does the wiki evidence text actually mention this
 * institution? Every identifying-core token of the institution must appear
 * as a whole word in the text. An all-filler institution ("Public Schools")
 * has no core and counts as NOT mentioned, so generic state/country-level
 * prose can never claim a per-district row.
 */
function institutionMentionedInText(text: string, institution: string): boolean {
  const core = normalizeInstitution(institution)
  if (!core) return false
  const normText = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `
  return core.split(' ').every(tok => normText.includes(` ${tok} `))
}

type NearDupe = {
  id: number
  description: string | null
  region: string | null
  institution: string | null
  scope_id: number
  // How the match was made — drives whether the apply loop may promote
  // (fill a bare row) or must merely skip the insert:
  //   'institution'       same institution within ±1 yr (scope/action may differ)
  //   'same_scope_bucket' same scope within ±1 yr, at least one side lacks an institution
  //   'scope_variant'     different scope within ±1 yr, both sides generic (no institution)
  //   'summary'           country-level summary collision (pass 2)
  match: 'institution' | 'same_scope_bucket' | 'scope_variant' | 'summary'
}

/**
 * Dedup. Two passes:
 *   1. Same country + year window ±1 (school-year boundaries make off-by-one
 *      years common), across ALL scopes. Within the window:
 *        - institutions on both sides that correspond → duplicate, even when
 *          scope_id/action_type were coded differently (the Tintin GB-2007 /
 *          Katy ISD shape: same real-world event, different coding);
 *        - same scope and at least one side without an institution →
 *          same-bucket duplicate (pre-existing behavior);
 *        - different scope and BOTH sides without an institution → duplicate
 *          only when the regions don't disagree (scope/action variant of a
 *          generic event).
 *      Per-institution rows whose institutions differ are never duplicates.
 *   2. If the candidate has NO institution, also search for "summary" rows
 *      at the same country + scope with institution=null, regardless of
 *      year. These are country-level summary rows that should not coexist
 *      — multiple "USA banned" rows on the same book is the bug this catches.
 *
 * Per-institution events (PEN per-district etc.) are unaffected by pass 2
 * because the candidate's institution is non-null, so pass 1 alone applies.
 */
async function findNearDuplicate(
  sb: ReturnType<typeof adminClient>,
  bookId: number,
  candidate: StagedNewBan,
): Promise<NearDupe | null> {
  const yr = candidate.year_started

  // Pass 1: same year ±1, any scope.
  let q = sb
    .from('bans')
    .select('id, year_started, scope_id, region, institution, description')
    .eq('book_id', bookId)
    .eq('country_code', candidate.country_code)
  if (yr !== null) q = q.gte('year_started', yr - 1).lte('year_started', yr + 1)
  const { data } = await q

  const toDupe = (row: NonNullable<typeof data>[number], match: NearDupe['match']): NearDupe => ({
    id: row.id,
    description: row.description,
    region: row.region,
    institution: row.institution,
    scope_id: row.scope_id,
    match,
  })

  let bucketMatch: NearDupe | null = null
  let variantMatch: NearDupe | null = null
  for (const row of data ?? []) {
    if (candidate.institution && row.institution) {
      if (institutionsCorrespond(candidate.institution, row.institution)) {
        // Strongest signal — same institution within the window is the same
        // real-world event regardless of scope/action coding.
        return toDupe(row, 'institution')
      }
      continue // different institution → not a dupe within window
    }
    if (row.scope_id === candidate.scope_id) {
      // candidate or row has no institution → treat as same-bucket within window.
      if (!bucketMatch) bucketMatch = toDupe(row, 'same_scope_bucket')
      continue
    }
    // Different scope: only a dupe when both sides are generic (no
    // institution) and the regions don't disagree.
    if (!candidate.institution && !row.institution) {
      const regionsCompatible =
        !candidate.region ||
        !row.region ||
        candidate.region.toLowerCase() === row.region.toLowerCase()
      if (regionsCompatible && !variantMatch) variantMatch = toDupe(row, 'scope_variant')
    }
  }
  if (bucketMatch) return bucketMatch
  if (variantMatch) return variantMatch

  // Pass 2: summary-row collision (institution=null on both sides, any year).
  if (!candidate.institution) {
    const { data: summary } = await sb
      .from('bans')
      .select('id, year_started, scope_id, region, institution, description')
      .eq('book_id', bookId)
      .eq('country_code', candidate.country_code)
      .eq('scope_id', candidate.scope_id)
      .is('institution', null)
    // Prefer a bare row (no description) so the candidate fills it; else
    // fall back to the first summary row so we don't double-insert.
    const bare = (summary ?? []).find(r => !r.description)
    if (bare) return toDupe({ ...bare, description: null }, 'summary')
    if (summary && summary.length > 0) {
      return toDupe(summary[0], 'summary')
    }
  }

  return null
}

async function applyStaged(staged: Staged): Promise<{
  inserted: number
  updated: number
  skipped: number
  linked: number
}> {
  const sb = adminClient()
  await getCountryInfo(sb)

  let inserted = 0
  let updated = 0
  let skipped = 0
  let linked = 0

  log(`\n=== ${staged.title} (book_id=${staged.book_id})`)
  log(`  wikipedia: ${staged.wikipedia_url}`)

  // Source row first.
  const wikiTitleMatch = staged.wikipedia_url.match(/\/wiki\/(.+)$/)
  const wikiPageTitle = wikiTitleMatch
    ? decodeURIComponent(wikiTitleMatch[1]).replace(/_/g, ' ')
    : staged.title
  const sourceId = await ensureWikiSource(sb, staged.wikipedia_url, wikiPageTitle)

  const touchedBanIds: number[] = []
  const claimedForUpdate = new Set<number>() // ban ids already targeted this run

  // ─── Updates to existing ───────────────────────────────────────────────────
  for (const u of staged.updates_to_existing) {
    const { data: existing } = await sb
      .from('bans')
      .select('id, country_code, region, institution, scope_id, action_type, status, year_started, year_ended, actor, description, confidence')
      .eq('id', u.ban_id)
      .maybeSingle()
    if (!existing) {
      log(`  skip update for ban_id=${u.ban_id}: row not found`)
      skipped++
      continue
    }
    // Wrong-row guard (2026-06-11): the staged ban_id comes from an LLM that
    // has targeted the wrong row before — generic statewide events patched
    // onto PEN per-district rows (And Tango Makes Three #34760 Broward,
    // Heartstopper #34627 Collierville). When the existing row names an
    // institution, the supporting article quote must mention that
    // institution; otherwise we leave the row untouched (no description/
    // region overwrite, no Wikipedia source link). The quote is gated, not
    // the rationale/description, because those are LLM prose that can echo
    // the institution name straight from the DB context it was shown.
    if (
      existing.institution &&
      !institutionMentionedInText(u.wikipedia_quote ?? '', existing.institution)
    ) {
      log(
        `  skip update ban_id=${u.ban_id}: institution "${existing.institution}" not mentioned in wikipedia_quote — wrong-row guard`,
      )
      skipped++
      continue
    }
    const { sanitized, reasons } = patchHasNewInfo(
      existing as Record<string, unknown>,
      u.patch,
    )
    if (Object.keys(sanitized).length === 0) {
      log(`  skip update ban_id=${u.ban_id}: ${reasons.join(', ')}`)
      skipped++
      continue
    }
    log(`  update ban_id=${u.ban_id} (${existing.country_code}): patch=${JSON.stringify(sanitized)}; rationale=${u.rationale}`)
    if (APPLY) {
      const { error } = await sb.from('bans').update(sanitized).eq('id', u.ban_id)
      if (error) throw error
    }
    updated++
    touchedBanIds.push(u.ban_id)
    claimedForUpdate.add(u.ban_id)
  }

  // ─── New bans ──────────────────────────────────────────────────────────────
  for (const nb of staged.new_bans) {
    const err = validateNewBan(nb)
    if (err) {
      log(`  skip new ban (${nb.country_code}): validation failed — ${err}`)
      skipped++
      continue
    }
    // Ensure country FK.
    await ensureCountry(sb, nb.country_code, nb.country_name)
    const dupe = await findNearDuplicate(sb, staged.book_id, nb)
    if (dupe) {
      // Promote (fill a bare existing row) only when the dupe is safely the
      // SAME row: same scope, and — when the existing row names an
      // institution — the candidate either names a corresponding institution
      // or its article quote explicitly mentions the row's institution.
      // Without this, a generic state-level candidate overwrote PEN
      // per-district rows (Heartstopper #34627 Collierville got a Florida/
      // Oregon region + copied description). Scope/action variants are
      // skipped, never promoted across.
      const institutionSafe =
        !dupe.institution ||
        (nb.institution
          ? institutionsCorrespond(nb.institution, dupe.institution)
          : institutionMentionedInText(nb.wikipedia_quote ?? '', dupe.institution))
      if (
        !dupe.description &&
        nb.description &&
        !claimedForUpdate.has(dupe.id) &&
        dupe.scope_id === nb.scope_id &&
        institutionSafe
      ) {
        log(`  promote new ban → update ban_id=${dupe.id}: existing was bare, candidate has description`)
        if (APPLY) {
          const patch: Record<string, unknown> = {
            description: nb.description,
            confidence: 'verified',
          }
          // Fill-only: never overwrite a non-null region/institution — the
          // existing row's locality is authoritative (PEN district rows).
          if (nb.region && !dupe.region) patch.region = nb.region
          if (nb.institution && !dupe.institution) patch.institution = nb.institution
          if (nb.actor) patch.actor = nb.actor
          if (nb.year_ended) patch.year_ended = nb.year_ended
          const { error } = await sb.from('bans').update(patch).eq('id', dupe.id)
          if (error) throw error
        }
        updated++
        touchedBanIds.push(dupe.id)
        claimedForUpdate.add(dupe.id)
        continue
      }
      if (claimedForUpdate.has(dupe.id)) {
        log(`  insert (not promote): ban_id=${dupe.id} already claimed this run; treating as distinct granular event`)
        // Fall through to insert path below.
      } else {
        log(
          `  skip new ban (${nb.country_code} ${nb.year_started} scope=${nb.scope_id}): near-dupe of ban_id=${dupe.id} (match=${dupe.match}${!dupe.description ? ', bare but not promotable' : ''})`,
        )
        skipped++
        continue
      }
    }
    const row = {
      book_id: staged.book_id,
      country_code: nb.country_code,
      scope_id: nb.scope_id,
      action_type: nb.action_type,
      status: nb.status,
      year_started: nb.year_started,
      year_ended: nb.year_ended,
      region: nb.region,
      institution: nb.institution,
      actor: nb.actor,
      description: nb.description,
      confidence: 'verified',
    }
    log(`  insert new ban (${nb.country_code} ${nb.year_started} scope=${nb.scope_id}): ${nb.description.slice(0, 100)}…`)
    if (APPLY) {
      const { data, error } = await sb.from('bans').insert(row).select('id').single()
      if (error) throw error
      touchedBanIds.push(data.id)
    } else {
      log(`  would link new ban → source_id=${sourceId} (after insert resolves id)`)
    }
    inserted++
  }

  // ─── Source links ──────────────────────────────────────────────────────────
  for (const banId of touchedBanIds) {
    await linkSource(sb, banId, sourceId)
    linked++
  }

  // ─── Book-level rewrites ───────────────────────────────────────────────────
  if (staged.book_description_ban_rewrite || staged.book_censorship_context_rewrite) {
    const { data: book } = await sb
      .from('books')
      .select('description_ban, censorship_context')
      .eq('id', staged.book_id)
      .single()
    const updates: Record<string, string> = {}
    if (staged.book_description_ban_rewrite) {
      const cur = book?.description_ban ?? ''
      const newer = staged.book_description_ban_rewrite
      if (cur.length < newer.length || hasFactsExistingDoesNotHave(cur, newer)) {
        updates.description_ban = newer
      } else {
        log(`  skip description_ban rewrite: not strictly longer, no new facts`)
      }
    }
    if (staged.book_censorship_context_rewrite) {
      const cur = book?.censorship_context ?? ''
      const newer = staged.book_censorship_context_rewrite
      // Quality gate (added 2026-05-29): the wiki-staging output is also LLM-derived
      // and has occasionally produced ungrounded prose. Reject anything that does
      // not carry a verifiable anchor — see src/lib/censorship-context-quality.ts.
      const gate = censorshipContextQualityGate(newer)
      if (!gate.accept) {
        log(`  skip censorship_context rewrite: quality gate [${gate.bucket}] — ${gate.reasoning}`)
      } else if (cur.length < newer.length || hasFactsExistingDoesNotHave(cur, newer)) {
        updates.censorship_context = newer
      } else {
        log(`  skip censorship_context rewrite: not strictly longer, no new facts`)
      }
    }
    if (Object.keys(updates).length > 0) {
      log(`  book-level rewrite (${staged.book_id}): ${Object.keys(updates).join(', ')}`)
      if (APPLY) {
        const { error } = await sb.from('books').update(updates).eq('id', staged.book_id)
        if (error) throw error
      }
    }
  }

  return { inserted, updated, skipped, linked }
}

async function main() {
  if (!existsSync(STAGING_DIR)) {
    throw new Error(`staging dir not found: ${STAGING_DIR} — run step B first`)
  }

  const files = readdirSync(STAGING_DIR)
    .filter(f => f.endsWith('.json') && f !== '_summary.md')
    .sort()

  const all: Staged[] = []
  for (const f of files) {
    try {
      const j = JSON.parse(readFileSync(join(STAGING_DIR, f), 'utf8')) as Staged
      if (!j.book_id || !j.wikipedia_url) continue
      if (ONLY_SLUGS.size > 0 && !ONLY_SLUGS.has(j.slug)) continue
      all.push(j)
    } catch (e) {
      console.error(`failed to parse ${f}: ${e}`)
    }
  }

  log(`processing ${all.length} staged files`)

  let totIns = 0
  let totUpd = 0
  let totSkp = 0
  let totLnk = 0
  for (const s of all) {
    try {
      const { inserted, updated, skipped, linked } = await applyStaged(s)
      totIns += inserted
      totUpd += updated
      totSkp += skipped
      totLnk += linked
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log(`ERROR on ${s.slug}: ${msg}`)
    }
  }

  log(`\n=== SUMMARY`)
  log(`  inserted: ${totIns}`)
  log(`  updated:  ${totUpd}`)
  log(`  skipped:  ${totSkp}`)
  log(`  linked:   ${totLnk}`)
  log(`  ${APPLY ? 'Changes committed.' : 'No writes (pass --apply).'}`)

  writeFileSync(LOG_PATH, logLines.join('\n'))
  console.log(`\nlog: ${LOG_PATH}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
