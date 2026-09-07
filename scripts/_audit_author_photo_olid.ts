#!/usr/bin/env tsx
/**
 * READ-ONLY audit for "wrong OpenLibrary author" photo contamination.
 *
 * Background — the 2026-09-07 /botd-week pre-flight found two author photos of
 * a *different human being*:
 *   • authors #7067 Alex London carried
 *     https://covers.openlibrary.org/a/olid/OL18319A-L.jpg?default=false —
 *     OL author OL18319A is **Mark Twain**.
 *   • authors #6995 Cristina Alger carried a Wikimedia Commons **Bernard Madoff
 *     mug shot**, matched off her Madoff-era novel "The Darlings".
 * Both were nulled by hand. Neither is caught by the allowlist invariants in
 * scripts/audit-integrity.ts: an OL cover-host URL is perfectly well-formed, it
 * is merely pointing at the wrong person. That whole population was unchecked.
 *
 * This script checks the OL-keyed half of it — every authors row whose
 * photo_url is a `covers.openlibrary.org/a/olid/<OLID>` image (475 rows as of
 * 2026-09-07). The OLID in that URL is a *verifiable claim*: it says "this is
 * the photo of OL author <OLID>". So we fetch /authors/<OLID>.json and ask
 * whether that record's name is our author at all.
 *
 * (The Cristina Alger class — a Wikimedia Commons file whose subject is someone
 * else entirely — is NOT detectable this way: a Commons URL carries no identity
 * claim we can resolve. Those 888-odd upload.wikimedia.org photos need a
 * separate vision/caption audit.)
 *
 * Method — the normalised surname-token match in
 * src/lib/enrich/author-name-match.ts (diacritic + ligature folding, inverted
 * "Surname, First" forms, pen names via `alternate_names`, and a script gate so
 * a Cyrillic name is compared in Cyrillic). That is the SAME module the photo
 * enricher's OpenLibrary branch now gates on: detector and gate share one
 * definition, or the enricher would keep writing rows this audit then flags.
 *
 * Verdicts (worst first — the report is ranked in this order):
 *   NO_NAME_OVERLAP   zero shared name tokens with ANY OL variant. This is the
 *                     Alex London/Mark Twain class → treat as contamination.
 *   SURNAME_MISMATCH  some overlap (usually the given name) but no surname
 *                     agreement → a different person with a shared first name.
 *   OL_UNRESOLVED     /authors/<OLID>.json is 404/redirect-dead/nameless. The
 *                     identity claim can't be verified, and the photo is very
 *                     likely a broken image too (`?default=false` 404s).
 *                     A 429/5xx/socket failure is deliberately NOT this: those
 *                     are retried (--retries) and, if still failing, left OUT
 *                     of the checkpoint for the next run.
 *   UNVERIFIABLE      no comparable tokens: an all-initials display_name, or
 *                     every OL variant is in a different script than ours
 *                     (CJK name vs. Latin-only record) — review by eye.
 *   OK                surname agreement on some OL variant.
 * Every flagged row also reports `olid_conflict`: the photo OLID differs from
 * the row's own openlibrary_author_id (50 rows). That is the exact shape of the
 * Alex London bug — the photo was keyed off a *different* OL author than the
 * one we resolved for this person — so it ranks a row up within its bucket.
 *
 * Writes NOTHING to the DB, and has no --apply. Per project doctrine photo
 * writes need a visual/name check first, so the deliverable is a review list a
 * human signs off on. Note for whoever writes the follow-up patch:
 * barbara-dee (#3446) and michelle-levy (#1515) are permission-managed photos
 * that must never be overwritten — both are self-hosted in Supabase storage and
 * therefore not in this population at all, but any bulk photo write must still
 * exclude them.
 *
 * Output:
 *   data/author-photo-olid-checkpoint.jsonl — one probe result per author;
 *     the run resumes from it, so an interrupted sweep continues where it
 *     stopped (475 rows ≈ 8 min at 1 req/s).
 *   data/author-photo-olid-audit.md   — review list, ranked worst-first.
 *   data/author-photo-olid-audit.json — the same mismatches as data, for a
 *     follow-up hand-checked null/replace patch.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/_audit_author_photo_olid.ts
 *     → full sweep (resumes from the checkpoint), then writes the report
 *   npx tsx --env-file=.env.local scripts/_audit_author_photo_olid.ts --limit=50
 *     → probe at most 50 new rows this run (still writes a report)
 *   npx tsx --env-file=.env.local scripts/_audit_author_photo_olid.ts --report-only
 *     → no probing; regenerate the MD/JSON from the checkpoint
 *   npx tsx --env-file=.env.local scripts/_audit_author_photo_olid.ts --fresh
 *     → ignore the existing checkpoint and start over
 *   npx tsx --env-file=.env.local scripts/_audit_author_photo_olid.ts --slug=alex-london
 *     → probe a single author (bypasses the checkpoint, writes no report)
 *
 * Flags:
 *   --limit=N     probe at most N not-yet-checkpointed rows (default: all)
 *   --delay=MS    throttle between OL fetches (default 1000 = ~1 req/s)
 *   --fresh       discard the checkpoint and re-probe everything
 *   --report-only rebuild the report from the checkpoint without any fetching
 *   --slug=SLUG   probe one author and print the verdict
 *   --retries=N   attempts per OLID before a transient failure is deferred
 *                 to the next run (default 3, with 2s/4s/8s backoff)
 *   --requeue-unresolved
 *                 drop the OL_UNRESOLVED rows from the checkpoint and re-probe
 *                 them (use after an OpenLibrary outage)
 */

import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { matchNames } from '../src/lib/enrich/author-name-match'
import { adminClient } from '../src/lib/supabase'
import { flagValue, hasFlag, intFlag, isApply } from './lib/cli'

const LIMIT = intFlag('limit', Number.POSITIVE_INFINITY)
const DELAY_MS = intFlag('delay', 1000)
const FRESH = hasFlag('fresh')
const REPORT_ONLY = hasFlag('report-only')
const REQUEUE_UNRESOLVED = hasFlag('requeue-unresolved')
const SLUG = flagValue('slug') ?? null
/** Attempts per OLID before a transient failure is left for the next run. */
const RETRIES = intFlag('retries', 3)

if (isApply() && import.meta.url === `file://${process.argv[1]}`) {
  console.warn(
    '⚠ This is a read-only audit — it has no --apply and writes nothing to the DB.\n' +
      '  Photo writes need a per-row visual/name check first; use the review file.',
  )
}

const UA = 'banned-books.org-audit-bot (ludo.raedts@voys.nl)'
const OL_HEADERS = { 'User-Agent': UA }
const PAGE = 1000

const CHECKPOINT = join(process.cwd(), 'data', 'author-photo-olid-checkpoint.jsonl')
const OUT_MD = join(process.cwd(), 'data', 'author-photo-olid-audit.md')
const OUT_JSON = join(process.cwd(), 'data', 'author-photo-olid-audit.json')

/** Photos we must never touch even if a future patch goes bulk — see header. */
const PERMISSION_MANAGED_SLUGS = new Set(['barbara-dee', 'michelle-levy'])

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── DB + OL access ────────────────────────────────────────────────────

type AuthorRow = {
  id: number
  slug: string
  display_name: string
  photo_url: string
  openlibrary_author_id: string | null
  photo_v2_checked_at: string | null
  /** OLID parsed out of photo_url — the identity claim we verify. */
  photo_olid: string
}

const PHOTO_OLID_RE = /covers\.openlibrary\.org\/a\/olid\/(OL\d+A)/i

async function loadAuthors(): Promise<AuthorRow[]> {
  const db = adminClient()
  const select = 'id,slug,display_name,photo_url,openlibrary_author_id,photo_v2_checked_at'
  const rows: AuthorRow[] = []

  // Paginated + ordered: an unordered .range() duplicates rows past the page
  // boundary, and a plain .select() is capped at 1000 anyway.
  for (let from = 0; ; from += PAGE) {
    let q = db
      .from('authors')
      .select(select)
      .ilike('photo_url', '%covers.openlibrary.org/a/olid/%')
      .order('id')
      .range(from, from + PAGE - 1)
    if (SLUG) q = q.eq('slug', SLUG)

    const { data, error } = await q
    if (error) throw new Error(`authors read failed: ${error.message}`)
    const batch = data ?? []
    for (const r of batch) {
      const m = PHOTO_OLID_RE.exec(r.photo_url as string)
      if (!m) continue // ilike matched a URL shape the regex doesn't — skip, not ours
      rows.push({ ...(r as Omit<AuthorRow, 'photo_olid'>), photo_olid: m[1].toUpperCase() })
    }
    if (batch.length < PAGE) break
  }
  return rows
}

type OlAuthor = {
  key?: string
  name?: string
  personal_name?: string
  alternate_names?: string[]
  type?: { key?: string }
  location?: string
  error?: string
}

/**
 * Fetch outcome. The three cases must stay separate: a 404 is a *verdict*
 * (the OLID really is dead), while a 429/5xx/socket error is NOT — the first
 * run of this script checkpointed five transient OL failures as
 * OL_UNRESOLVED and froze them, even though all five answered 200 by hand a
 * minute later. Only `missing` and `ok` are ever checkpointed; `error` rows
 * stay in the to-do set and are retried next run.
 */
type OlFetch =
  | { status: 'ok'; author: OlAuthor }
  | { status: 'missing' }
  | { status: 'error'; detail: string }

/** Fetch /authors/<OLID>.json, following a single /type/redirect hop. */
async function fetchOlAuthorOnce(olid: string, depth = 0): Promise<OlFetch> {
  const url = `https://openlibrary.org/authors/${olid}.json`
  try {
    const res = await fetch(url, { headers: OL_HEADERS, redirect: 'follow' })
    if (res.status === 404) return { status: 'missing' }
    if (!res.ok) return { status: 'error', detail: `HTTP ${res.status}` }
    const json = (await res.json().catch(() => null)) as OlAuthor | null
    if (!json) return { status: 'error', detail: 'unparseable JSON' }
    // Merged/renamed OL records answer with a redirect stub pointing at the
    // surviving author; the surviving name is the one to compare against.
    if (json.type?.key === '/type/redirect' && depth === 0) {
      const target = /\/authors\/(OL\d+A)/.exec(json.location ?? '')?.[1]
      if (!target) return { status: 'missing' } // dead redirect
      await sleep(DELAY_MS)
      return fetchOlAuthorOnce(target, 1)
    }
    return { status: 'ok', author: json }
  } catch (e) {
    return { status: 'error', detail: e instanceof Error ? e.message : String(e) }
  }
}

/** Retry only the transient case, with backoff — never a 404. */
async function fetchOlAuthor(olid: string): Promise<OlFetch> {
  let last: OlFetch = { status: 'error', detail: 'not attempted' }
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    if (attempt > 0) await sleep(DELAY_MS * 2 ** attempt)
    last = await fetchOlAuthorOnce(olid)
    if (last.status !== 'error') return last
  }
  return last
}

// ── checkpoint ────────────────────────────────────────────────────────

type Probe = {
  id: number
  slug: string
  display_name: string
  photo_url: string
  photo_olid: string
  openlibrary_author_id: string | null
  photo_v2_checked_at: string | null
  ol_key: string | null
  ol_name: string | null
  ol_variants: string[]
  verdict: 'OK' | 'NO_NAME_OVERLAP' | 'SURNAME_MISMATCH' | 'UNVERIFIABLE' | 'OL_UNRESOLVED'
  matched_on: string | null
  shared_tokens: string[]
  olid_conflict: boolean
  /** Why an OL_UNRESOLVED row is unresolved (404 vs. nameless record). */
  reason?: string
  probed_at: string
}

function loadCheckpoint(): Map<number, Probe> {
  const done = new Map<number, Probe>()
  if (FRESH || !existsSync(CHECKPOINT)) return done
  for (const line of readFileSync(CHECKPOINT, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const p = JSON.parse(line) as Probe
      if (!p.verdict) continue
      // Escape hatch for a checkpoint written before the transient-vs-404 split
      // (or after an OL outage): re-probe the unresolved rows, keep the rest.
      if (REQUEUE_UNRESOLVED && p.verdict === 'OL_UNRESOLVED') {
        done.delete(p.id)
        continue
      }
      done.set(p.id, p)
    } catch {
      /* truncated last line from an interrupted run — ignore */
    }
  }
  return done
}

// ── report ────────────────────────────────────────────────────────────

const RANK: Record<Probe['verdict'], number> = {
  NO_NAME_OVERLAP: 0,
  SURNAME_MISMATCH: 1,
  OL_UNRESOLVED: 2,
  UNVERIFIABLE: 3,
  OK: 4,
}

const BUCKET_NOTE: Record<string, string> = {
  NO_NAME_OVERLAP:
    'Zero shared name tokens with any OL variant — the Alex London/Mark Twain class. ' +
    'Treat as contamination: the photo belongs to a different person.',
  SURNAME_MISMATCH:
    'Some tokens overlap (usually the given name) but the surnames disagree — ' +
    'likely a namesake. Check by eye before nulling.',
  OL_UNRESOLVED:
    'OL author record does not resolve (404 / dead redirect / no name). The identity ' +
    'claim is unverifiable and the image itself is probably a `?default=false` 404.',
  UNVERIFIABLE:
    'No comparable tokens — an all-initials name, or every OL variant is in a different ' +
    'script than ours. Review by eye; the matcher deliberately refuses to judge these.',
}

function writeReport(probes: Probe[]) {
  const sorted = [...probes].sort(
    (a, b) =>
      RANK[a.verdict] - RANK[b.verdict] ||
      Number(b.olid_conflict) - Number(a.olid_conflict) ||
      a.display_name.localeCompare(b.display_name),
  )
  const flagged = sorted.filter((p) => p.verdict !== 'OK')
  const counts = sorted.reduce<Record<string, number>>((acc, p) => {
    acc[p.verdict] = (acc[p.verdict] ?? 0) + 1
    return acc
  }, {})

  const lines: string[] = []
  lines.push('# Author photo audit — OpenLibrary OLID identity claims')
  lines.push('')
  lines.push(`Generated ${new Date().toISOString()} by \`scripts/_audit_author_photo_olid.ts\` (read-only).`)
  lines.push('')
  lines.push(
    'Every `authors.photo_url` of the form `covers.openlibrary.org/a/olid/<OLID>` claims to be ' +
      'the photo of OL author `<OLID>`. This report re-checks that claim against ' +
      '`/authors/<OLID>.json` (`name` / `personal_name` / `alternate_names`) with a normalised ' +
      'surname-token match. Nothing was written to the database.',
  )
  lines.push('')
  lines.push(`- probed: **${sorted.length}**`)
  for (const v of Object.keys(RANK) as Probe['verdict'][]) {
    if (counts[v]) lines.push(`- ${v}: **${counts[v]}**`)
  }
  lines.push(`- flagged (everything but OK): **${flagged.length}**`)
  lines.push(
    `- of which photo OLID ≠ row's own \`openlibrary_author_id\`: **${flagged.filter((p) => p.olid_conflict).length}**`,
  )
  lines.push('')
  lines.push(
    '> Do NOT null in bulk. Photo writes need a per-row visual/name check first, and ' +
      '`barbara-dee` (#3446) + `michelle-levy` (#1515) are permission-managed photos that must ' +
      'never be overwritten (both are self-hosted, so neither appears below).',
  )
  lines.push('')
  lines.push('## How these get in')
  lines.push('')
  lines.push(
    '`tryOpenLibrary()` in `src/lib/enrich/author-photos.ts` used to query ' +
      '`/search/authors.json?q=<our name>` and accept the first of up to 3 docs that had ' +
      '`work_count >= 1` and a HEAD-able photo — **without ever comparing `doc.name` to ours**. ' +
      'So any author whose name merely *retrieved* a photo-bearing OL record inherited that ' +
      "record's face: \"Troy Andrews\" pulled Lauran Paine, whose `alternate_names` include " +
      '"Troy Howard (pseud.)". That branch is now gated on `namesAgree()` from ' +
      '`src/lib/enrich/author-name-match.ts` — the same matcher this audit uses — so a ' +
      'candidate must positively agree on the surname before its photo is even HEAD-checked. ' +
      'The Wikidata and site branches are gated differently (human + writer-occupation, and ' +
      'JSON-LD `Person.image` respectively) and are NOT covered by this audit.',
  )
  lines.push('')

  if (flagged.length === 0) {
    lines.push('No mismatches found.')
  }

  let currentBucket = ''
  for (const p of flagged) {
    if (p.verdict !== currentBucket) {
      currentBucket = p.verdict
      lines.push(`## ${p.verdict} (${counts[p.verdict]})`)
      lines.push('')
      lines.push(BUCKET_NOTE[p.verdict] ?? '')
      lines.push('')
    }
    lines.push(`### #${p.id} ${p.display_name} — \`${p.slug}\``)
    lines.push('')
    lines.push(`- our name: **${p.display_name}**`)
    lines.push(`- OL name (${p.photo_olid}): **${p.ol_name ?? '— (unresolved)'}**`)
    if (p.ol_variants.length > 1) {
      lines.push(`- OL variants: ${p.ol_variants.map((v) => `\`${v}\``).join(', ')}`)
    }
    if (p.shared_tokens.length > 0) lines.push(`- shared tokens: ${p.shared_tokens.join(', ')}`)
    if (p.reason) lines.push(`- reason: ${p.reason}`)
    lines.push(`- photo: ${p.photo_url}`)
    lines.push(
      `- our \`openlibrary_author_id\`: ${p.openlibrary_author_id ?? '—'}` +
        (p.olid_conflict ? ' ⚠ **conflicts with the photo OLID**' : ''),
    )
    lines.push(`- \`photo_v2_checked_at\`: ${p.photo_v2_checked_at ?? '—'}`)
    lines.push(`- OL record: https://openlibrary.org/authors/${p.photo_olid}`)
    if (PERMISSION_MANAGED_SLUGS.has(p.slug)) {
      // Belt and braces: these two are self-hosted today, so they cannot appear
      // here — but if a re-enrichment ever pins an OL photo on them, the review
      // list must shout rather than let a patch quietly overwrite it.
      lines.push('- 🚫 **PERMISSION-MANAGED PHOTO — never overwrite** (see project doctrine)')
    }
    lines.push('')
  }

  writeFileSync(OUT_MD, `${lines.join('\n')}\n`)
  writeFileSync(
    OUT_JSON,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        script: 'scripts/_audit_author_photo_olid.ts',
        probed: sorted.length,
        counts,
        /** Slugs a follow-up patch must skip unconditionally — see the header. */
        never_overwrite: [...PERMISSION_MANAGED_SLUGS],
        findings: flagged,
      },
      null,
      2,
    )}\n`,
  )
  return { total: sorted.length, flagged: flagged.length, counts }
}

// ── main ──────────────────────────────────────────────────────────────

function probeOf(row: AuthorRow, fetched: OlFetch): Probe {
  const ol = fetched.status === 'ok' ? fetched.author : null
  const variants = ol
    ? [ol.name, ol.personal_name, ...(ol.alternate_names ?? [])].filter(
        (v): v is string => typeof v === 'string' && v.trim().length > 0,
      )
    : []
  const unique = [...new Set(variants)]
  const base = {
    id: row.id,
    slug: row.slug,
    display_name: row.display_name,
    photo_url: row.photo_url,
    photo_olid: row.photo_olid,
    openlibrary_author_id: row.openlibrary_author_id,
    photo_v2_checked_at: row.photo_v2_checked_at,
    ol_key: ol?.key ?? null,
    ol_name: ol?.name ?? ol?.personal_name ?? null,
    ol_variants: unique,
    olid_conflict:
      !!row.openlibrary_author_id &&
      row.openlibrary_author_id.toUpperCase() !== row.photo_olid.toUpperCase(),
    probed_at: new Date().toISOString(),
  }
  if (!ol || unique.length === 0) {
    const reason =
      fetched.status === 'missing' ? '404 / dead redirect' : ol ? 'record has no name' : 'fetch failed'
    return { ...base, verdict: 'OL_UNRESOLVED', matched_on: null, shared_tokens: [], reason }
  }
  const m = matchNames(row.display_name, unique)
  return { ...base, verdict: m.verdict, matched_on: m.matchedOn, shared_tokens: m.sharedTokens }
}

/**
 * Recompute a checkpointed probe's verdict from its cached OL name variants and
 * the row's CURRENT display_name (a hand-fixed name should clear the row on the
 * next report, not stay flagged). OL_UNRESOLVED rows carry no variants to
 * re-judge, so they pass through unchanged.
 */
function rederive(p: Probe, row: AuthorRow): Probe {
  if (p.ol_variants.length === 0) return { ...p, display_name: row.display_name }
  const m = matchNames(row.display_name, p.ol_variants)
  return {
    ...p,
    display_name: row.display_name,
    openlibrary_author_id: row.openlibrary_author_id,
    photo_v2_checked_at: row.photo_v2_checked_at,
    olid_conflict:
      !!row.openlibrary_author_id &&
      row.openlibrary_author_id.toUpperCase() !== p.photo_olid.toUpperCase(),
    verdict: m.verdict,
    matched_on: m.matchedOn,
    shared_tokens: m.sharedTokens,
  }
}

async function main() {
  const rows = await loadAuthors()
  if (SLUG) {
    if (rows.length === 0) {
      console.log(`No author with slug "${SLUG}" has an OLID-derived photo.`)
      return
    }
    for (const row of rows) {
      const p = probeOf(row, await fetchOlAuthor(row.photo_olid))
      // (single-author probe: printed, never checkpointed)
      console.log(JSON.stringify(p, null, 2))
    }
    return
  }

  console.log(`Population: ${rows.length} authors with a covers.openlibrary.org/a/olid photo.`)

  if (FRESH && existsSync(CHECKPOINT)) {
    rmSync(CHECKPOINT)
    console.log('--fresh: checkpoint discarded.')
  }
  const done = loadCheckpoint()
  console.log(`Checkpoint: ${done.size} already probed.`)

  if (!REPORT_ONLY) {
    const todo = rows.filter((r) => !done.has(r.id)).slice(0, LIMIT)
    console.log(`Probing ${todo.length} row(s) at ~${1000 / DELAY_MS}/s…`)
    let i = 0
    let transient = 0
    for (const row of todo) {
      i++
      const fetched = await fetchOlAuthor(row.photo_olid)
      if (fetched.status === 'error') {
        // Not a verdict: leave the row out of the checkpoint so the next run
        // retries it, rather than freezing an OL hiccup as OL_UNRESOLVED.
        transient++
        console.log(
          `  [${i}/${todo.length}] retry-later: #${row.id} ${row.display_name} → OL ${row.photo_olid} (${fetched.detail})`,
        )
        await sleep(DELAY_MS)
        continue
      }
      const p = probeOf(row, fetched)
      done.set(row.id, p)
      appendFileSync(CHECKPOINT, `${JSON.stringify(p)}\n`)
      if (p.verdict !== 'OK') {
        console.log(
          `  [${i}/${todo.length}] ${p.verdict}: #${p.id} ${p.display_name} → OL ${p.photo_olid} "${p.ol_name ?? '—'}"`,
        )
      }
      await sleep(DELAY_MS)
    }
    if (transient > 0) {
      console.log(`⚠ ${transient} row(s) failed transiently and were NOT checkpointed — re-run to retry.`)
    }
  }

  // Report only over the current population (a row whose photo has since been
  // nulled stays in the checkpoint but is no longer a finding).
  const live = new Map(rows.map((r) => [r.id, r]))
  const probes = [...done.values()]
    .filter((p) => live.has(p.id))
    // The checkpoint is a cache of OL *responses*, not of verdicts: re-derive
    // every verdict from the stored name variants so a matcher fix (e.g. the
    // "Kœstler" ligature gap) lands on the whole population via --report-only,
    // without re-fetching 475 records from OpenLibrary.
    .map((p) => rederive(p, live.get(p.id) as AuthorRow))
  const stats = writeReport(probes)

  const remaining = rows.length - probes.length
  console.log('')
  console.log(`Report: ${OUT_MD}`)
  console.log(`JSON:   ${OUT_JSON}`)
  console.log(`Probed ${stats.total}/${rows.length}; flagged ${stats.flagged}.`)
  console.log(`Buckets: ${JSON.stringify(stats.counts)}`)
  if (remaining > 0) console.log(`⚠ ${remaining} row(s) not yet probed — re-run to continue.`)
}

// Guarded so the pure matcher above can be unit-tested by importing this module
// (see scripts/__tests__/audit-author-photo-olid.test.ts).
const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
