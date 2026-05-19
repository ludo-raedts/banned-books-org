#!/usr/bin/env tsx
// Merge soft-duplicate `bans` rows: same book + country + scope, year_started
// within ±10 years. The `bans_unique_per_scope` UNIQUE constraint
// (migration 20260514151511) blocks year-exact duplicates only — this is the
// follow-up cleanup that the constraint cannot do by itself. See
// data/ban-soft-dupes-review.md for the full audit (generated 2026-05-19).
//
// Per group:
//   - Winner = MIN(id) (oldest insert; matches the precedent set by migration
//     20260514151511_bans_dedupe_and_unique.sql).
//   - year_started = MIN across the group  (more accurate "earliest documented").
//   - year_ended   = first non-null across the group.
//   - All loser reasons and sources are added to the winner (ON CONFLICT-safe).
//   - Description merge:
//       both empty           → null
//       one empty            → take the non-empty one
//       identical            → keep it
//       differ               → call GPT (gpt-4o-mini) to synthesize a single
//                              factual 1–2-sentence description that retains
//                              every concrete claim (year, scope, reason,
//                              statute name) from both inputs.
//   - Losers are DELETEd; ON DELETE CASCADE removes their leftover link rows.
//
// Idempotent re-runs are NOT a goal — this is a one-shot cleanup. Re-running
// after a successful pass finds 0 soft-duplicate groups (the constraint plus
// the importer fix in dedup.ts prevent re-introduction).
//
// Usage:
//   npx tsx --env-file=.env.local scripts/merge-soft-dupe-bans.ts            # dry-run (default)
//   npx tsx --env-file=.env.local scripts/merge-soft-dupe-bans.ts --write    # apply

import { Client } from 'pg'
import OpenAI from 'openai'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvLocal() {
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
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

const WRITE = process.argv.includes('--write')
const MAX_YEAR_SPAN = 10

type BanRow = {
  id: number
  book_id: number
  country_code: string
  scope_id: number | null
  year_started: number | null
  year_ended: number | null
  description: string | null
}

type Group = {
  book_id: number
  country_code: string
  scope_id: number | null
  rows: BanRow[]   // sorted by id asc — rows[0] is the winner
  earliest_year: number
  latest_year: number
  span: number
}

async function loadGroups(pg: Client): Promise<Group[]> {
  const res = await pg.query<BanRow>(
    `select id, book_id, country_code, scope_id, year_started, year_ended, description
     from bans
     order by id asc`,
  )
  // node-pg returns bigint as string; coerce to JS number so downstream
  // Map.get(id) lookups don't fall through silently. Safe — book_id and id
  // are well under 2^53.
  for (const r of res.rows) {
    r.id = Number(r.id) as unknown as number
    r.book_id = Number(r.book_id) as unknown as number
    r.scope_id = r.scope_id == null ? null : (Number(r.scope_id) as unknown as number)
  }
  const byKey = new Map<string, BanRow[]>()
  for (const r of res.rows) {
    // Match on (book, country, scope) — same key the audit script uses, since
    // soft-dupes within the same scope are the bug we're fixing. Cross-scope
    // pairs (customs ban vs school ban) are legitimately distinct and left
    // alone.
    const key = `${r.book_id}|${r.country_code}|${r.scope_id ?? 'null'}`
    const arr = byKey.get(key) ?? []
    arr.push(r)
    byKey.set(key, arr)
  }
  const groups: Group[] = []
  for (const [key, rows] of byKey) {
    if (rows.length < 2) continue
    const years = rows.map(r => r.year_started).filter((y): y is number => y != null)
    if (years.length < 2) continue
    const earliest = Math.min(...years)
    const latest = Math.max(...years)
    const span = latest - earliest
    if (span > MAX_YEAR_SPAN) continue
    const [bookIdStr, country] = key.split('|')
    groups.push({
      book_id: parseInt(bookIdStr),
      country_code: country,
      scope_id: rows[0].scope_id,
      rows,
      earliest_year: earliest,
      latest_year: latest,
      span,
    })
  }
  return groups
}

async function loadBookMeta(pg: Client, ids: number[]): Promise<Map<number, { title: string; slug: string }>> {
  if (ids.length === 0) return new Map()
  const res = await pg.query<{ id: number; title: string; slug: string }>(
    `select id, title, slug from books where id = any($1::int[])`,
    [ids],
  )
  return new Map(res.rows.map(r => [Number(r.id), { title: r.title, slug: r.slug }]))
}

async function loadCountryNames(pg: Client): Promise<Map<string, string>> {
  const res = await pg.query<{ code: string; name_en: string }>(
    `select code, name_en from countries`,
  )
  return new Map(res.rows.map(r => [r.code, r.name_en]))
}

async function synthesizeDescription(
  client: OpenAI,
  title: string,
  country: string,
  earliestYear: number,
  latestYear: number,
  descA: string,
  descB: string,
): Promise<string> {
  // Two descriptions about the SAME real-world ban event, recorded with
  // slightly off-by-N years and/or different reason wording. Goal: one
  // merged factual line that retains every concrete claim from both
  // without speculation.
  //
  // Caveat baked into the prompt: do NOT phrase the year-disagreement as a
  // "ban from X to Y" range. The two years are competing reports of the
  // same start date, not two endpoints. Without this guard rail GPT
  // produced "banned from 1955 to 1960, lifted in 1982" for Lolita ZA,
  // implying a 1960 end-year that does not exist in either source.
  const yearLine =
    earliestYear === latestYear
      ? `Both sources record ${earliestYear} as the ban-start year.`
      : `Sources disagree on the start year: ${earliestYear} vs ${latestYear}. ` +
        `These are two reports of the SAME start, not two endpoints — ` +
        `do NOT write "banned from ${earliestYear} to ${latestYear}". ` +
        `Prefer the earliest (${earliestYear}); you may mention the discrepancy ` +
        `parenthetically (e.g. "banned ${earliestYear} (some sources cite ${latestYear})").`
  // Pre-extract identifier-like tokens from both inputs so we can pass them
  // back to GPT as an explicit must-retain list. Catches JORF decree IDs,
  // ECLI case numbers, ALA/PEN file IDs, gazette numbers — anything matching
  // a "letters+digits" pattern of ≥8 chars. Without this, GPT routinely
  // collapses multiple distinct decree numbers into a single citation when
  // both sources reference the same underlying event.
  const idPattern = /\b[A-Z]+\d{6,}\b|\b\d{4,}\/\d{2,}\b|\bECLI:[A-Z:0-9.]+\b/gi
  const idsA = descA.match(idPattern) ?? []
  const idsB = descB.match(idPattern) ?? []
  const allIds = [...new Set([...idsA, ...idsB])]
  const idLine =
    allIds.length > 0
      ? `The merged description MUST cite EACH of these identifiers verbatim, in full: ${allIds.join(', ')}.`
      : ''
  const prompt =
    `Two sources describe the SAME real-world ban event for "${title}" in ${country}. ` +
    `${yearLine} ` +
    `Merge them into ONE factual 1–2 sentence description. ` +
    `Retain statute names, dated decrees, case names, court order references, ` +
    `end-year, specific reasons, and any quoted motive phrases. ` +
    `${idLine} ` +
    `Do not speculate, do not editorialise, do not add facts not present in either input. ` +
    `Output only the merged description text, no preamble.\n\n` +
    `Source A: ${descA}\n\n` +
    `Source B: ${descB}`
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = res.choices[0]?.message?.content?.trim() ?? ''
  if (!text) throw new Error('GPT returned empty description')
  return text.length > 2000 ? text.slice(0, 1997) + '…' : text
}

type MergePlan = {
  group: Group
  winner_id: number
  loser_ids: number[]
  new_year_started: number
  new_year_ended: number | null
  new_description: string | null
  description_source: 'unchanged' | 'from-loser' | 'identical' | 'gpt-merged' | 'cleared'
}

async function planMerges(
  pg: Client,
  groups: Group[],
  openai: OpenAI | null,
  bookMeta: Map<number, { title: string; slug: string }>,
  countryNames: Map<string, string>,
): Promise<MergePlan[]> {
  const plans: MergePlan[] = []
  for (const g of groups) {
    const sorted = [...g.rows].sort((a, b) => a.id - b.id)
    const winner = sorted[0]
    const losers = sorted.slice(1)

    // year_started: MIN. year_ended: first non-null across group.
    const years = sorted.map(r => r.year_started).filter((y): y is number => y != null)
    const newYearStarted = Math.min(...years)
    const endYears = sorted.map(r => r.year_ended).filter((y): y is number => y != null)
    const newYearEnded = endYears.length > 0 ? endYears[0] : null

    // Description merge.
    const descs = sorted
      .map(r => (r.description ?? '').trim())
      .filter(d => d.length > 0)
    let newDescription: string | null = winner.description
    let descriptionSource: MergePlan['description_source'] = 'unchanged'

    if (descs.length === 0) {
      newDescription = null
      descriptionSource = 'cleared'
    } else if (descs.length === 1) {
      // Exactly one non-empty across the group.
      if ((winner.description ?? '').trim() === descs[0]) {
        newDescription = descs[0]
        descriptionSource = 'unchanged'
      } else {
        newDescription = descs[0]
        descriptionSource = 'from-loser'
      }
    } else {
      const unique = [...new Set(descs)]
      if (unique.length === 1) {
        newDescription = unique[0]
        descriptionSource = 'identical'
      } else {
        // Conflict — need GPT.
        if (!openai) {
          throw new Error(
            `Description conflict on book=${g.book_id} ${g.country_code} but OPENAI_API_KEY is not set`,
          )
        }
        const meta = bookMeta.get(g.book_id)
        const title = meta?.title ?? `book id=${g.book_id}`
        const country = countryNames.get(g.country_code) ?? g.country_code
        // For 3+ descriptions we still pass exactly two — the longest pair.
        // In practice every observed group has 2 rows, so this branch is the
        // typical path.
        const sortedByLen = [...unique].sort((a, b) => b.length - a.length)
        const [a, b] = sortedByLen
        const merged = await synthesizeDescription(
          openai, title, country, g.earliest_year, g.latest_year, a, b,
        )
        newDescription = merged
        descriptionSource = 'gpt-merged'
      }
    }

    plans.push({
      group: g,
      winner_id: winner.id,
      loser_ids: losers.map(r => r.id),
      new_year_started: newYearStarted,
      new_year_ended: newYearEnded,
      new_description: newDescription,
      description_source: descriptionSource,
    })
  }
  return plans
}

async function applyMerge(pg: Client, plan: MergePlan): Promise<void> {
  // Move source-links from losers → winner. Preserve winner's locator on
  // conflict (locator may be an editor edit).
  await pg.query(
    `insert into ban_source_links (ban_id, source_id, locator)
     select $1, source_id, locator
     from ban_source_links
     where ban_id = any($2::bigint[])
     on conflict (ban_id, source_id)
     do update set locator = coalesce(ban_source_links.locator, excluded.locator)`,
    [plan.winner_id, plan.loser_ids],
  )
  // Move reason-links.
  await pg.query(
    `insert into ban_reason_links (ban_id, reason_id)
     select $1, reason_id
     from ban_reason_links
     where ban_id = any($2::bigint[])
     on conflict (ban_id, reason_id) do nothing`,
    [plan.winner_id, plan.loser_ids],
  )
  // Delete losers BEFORE updating winner's year_started. The bans_unique_per_scope
  // UNIQUE constraint is checked row-by-row at UPDATE time, so if a loser still
  // holds the (book, country, MIN-year, scope) tuple that the winner is about
  // to take, the constraint fires. Deleting first sidesteps the conflict.
  // CASCADE clears any link rows that survived the moves above.
  await pg.query(
    `delete from bans where id = any($1::bigint[])`,
    [plan.loser_ids],
  )
  // Now the winner can safely take the merged year_started / year_ended.
  await pg.query(
    `update bans
     set year_started = $2,
         year_ended   = coalesce(year_ended, $3),
         description  = $4
     where id = $1`,
    [plan.winner_id, plan.new_year_started, plan.new_year_ended, plan.new_description],
  )
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const pg = new Client({ connectionString })
  await pg.connect()

  const apiKey = process.env.OPENAI_API_KEY
  const openai = apiKey ? new OpenAI({ apiKey }) : null

  try {
    const groups = await loadGroups(pg)
    const bookMeta = await loadBookMeta(pg, [...new Set(groups.map(g => g.book_id))])
    const countryNames = await loadCountryNames(pg)
    console.log(`Loaded ${groups.length} soft-duplicate groups (span ≤ ${MAX_YEAR_SPAN}y, same scope).`)

    const plans = await planMerges(pg, groups, openai, bookMeta, countryNames)

    const byDescSource = new Map<string, number>()
    for (const p of plans) {
      byDescSource.set(p.description_source, (byDescSource.get(p.description_source) ?? 0) + 1)
    }
    console.log('\nDescription merge breakdown:')
    for (const [k, v] of [...byDescSource.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(v).padStart(3)}  ${k}`)
    }

    console.log('\nGPT-merged groups (conflict resolution):')
    for (const p of plans.filter(p => p.description_source === 'gpt-merged')) {
      const meta = bookMeta.get(p.group.book_id)
      const country = countryNames.get(p.group.country_code) ?? p.group.country_code
      console.log(`\n  ${meta?.slug ?? '?'} · ${country}`)
      for (const r of [...p.group.rows].sort((a, b) => a.id - b.id)) {
        console.log(`    id=${r.id} year=${r.year_started} desc="${(r.description ?? '').slice(0, 200)}"`)
      }
      console.log(`    → merged: "${p.new_description}"`)
    }

    console.log('\nAll plans:')
    for (const p of plans) {
      const meta = bookMeta.get(p.group.book_id)
      const yearsBefore = [...p.group.rows].sort((a, b) => a.id - b.id).map(r => r.year_started).join(',')
      console.log(
        `  book=${p.group.book_id} (${meta?.slug ?? '?'}) ${p.group.country_code}: ` +
        `keep id=${p.winner_id} drop=[${p.loser_ids.join(',')}] ` +
        `year ${yearsBefore} → ${p.new_year_started} ` +
        `desc=${p.description_source}`,
      )
    }

    if (!WRITE) {
      console.log('\nDry-run only. Re-run with --write to apply.')
      return
    }

    console.log('\nApplying merges in a single transaction...')
    await pg.query('BEGIN')
    try {
      for (const p of plans) {
        await applyMerge(pg, p)
      }
      await pg.query('COMMIT')
      console.log(`✓ Merged ${plans.length} groups, removed ${plans.reduce((s, p) => s + p.loser_ids.length, 0)} ban rows.`)
    } catch (err) {
      await pg.query('ROLLBACK')
      throw err
    }
  } finally {
    await pg.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
