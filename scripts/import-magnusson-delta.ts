/**
 * Delta-import of the Magnusson Book Censorship Database (stage-0 from
 * build-magnusson-stage0.ts) — PEN path, per-district granularity.
 *
 * Magnusson is PEN America's upstream feeder, so most rows are already in the
 * DB via import-pen.ts. A stage-0 row is SKIPPED when the matched book already
 * has a US ban in the same state whose institution normalises to the same
 * district (any year — Magnusson uses calendar years, PEN school years, and we
 * would rather miss a repeat event than inflate per-district counts).
 *
 * Per row:
 *   1. match-before-create via matchExistingBook (full title, then the
 *      pre-colon title) + an author last-name check. Title hit with a
 *      different author → HELD as needs_review (data/magnusson/needs-review-*.json),
 *      never created and never attached.
 *   2. no match → new book via commitParsedRow (shared commit-lib), whose ban
 *      is then stamped with region/institution/confidence.
 *   3. matched → ban inserted PEN-style with region + institution.
 *   Every new ban links to the Magnusson DB source AND the row's primary
 *   source URL (news article / board minutes) when present; reason = 'other'
 *   (Magnusson has no reason column — PEN convention).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-magnusson-delta.ts            # dry-run
 *   npx tsx --env-file=.env.local scripts/import-magnusson-delta.ts --apply
 *   ... --in=data/magnusson/stage0-2026-10-09.json --limit=50
 *   ... --resolutions=data/magnusson/resolutions-2026-10-09.json   # needs_review verdicts
 *       { "<title>|<first author>": {attach: book_id} | {create: slug, title?, authors?} | {drop: reason} }
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isApply, flagValue, intFlag } from './lib/cli'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { matchExistingBook } from '../src/lib/imports/verifier'
import { commitParsedRow } from '../src/lib/imports/review-commit'
import { MAGNUSSON_SOURCE_NAME, MAGNUSSON_SOURCE_URL, type Stage0Row } from './build-magnusson-stage0'

const APPLY = isApply()
const IN = flagValue('in') ?? 'data/magnusson/stage0-2026-10-09.json'
const LIMIT = intFlag('limit', Infinity)
const RES_PATH = flagValue('resolutions')
type Verdict = { attach?: number; create?: string; drop?: string; title?: string; authors?: string[] }
const RESOLUTIONS: Record<string, Verdict> = RES_PATH ? JSON.parse(readFileSync(RES_PATH, 'utf8')) : {}
const STAMP = IN.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? 'run'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const STOP = new Set(['school', 'schools', 'district', 'districts', 'county', 'public', 'city', 'unified', 'independent', 'isd', 'usd', 'cisd', 'area', 'community', 'consolidated', 'the', 'of', 'sd', 'csd', 'ps', 'library', 'libraries', 'system', 'board', 'education', 'regional', 'parish', 'township', 'and', 'co', 'no', 'r', 'cusd'])
export const districtKey = (s: string | null) =>
  fold(s ?? '').replace(/['’`.]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).sort().join(' ')
const sameDistrict = (a: string, b: string) => !!a && !!b && (a === b || a.includes(b) || b.includes(a))
const lastName = (n: string) => fold(n).replace(/\b(jr|sr|ii|iii)\b\.?/g, '').trim().split(/\s+/).pop() ?? ''

// Title → match result, persisted so the --apply run reuses the dry-run's lookups.
const CACHE_PATH = 'data/magnusson/match-cache.json'
const matchCache: Record<string, { id: number; status: string } | null> = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {}
async function matchCached(title: string) {
  if (title in matchCache) return matchCache[title]
  for (let attempt = 1; ; attempt++) {
    try {
      const m = await matchExistingBook({ title })
      matchCache[title] = m ? { id: m.id, status: m.status } : null
      if (Object.keys(matchCache).length % 200 === 0) writeFileSync(CACHE_PATH, JSON.stringify(matchCache))
      return matchCache[title]
    } catch (e) {
      if (attempt >= 5) throw e
      await new Promise(r => setTimeout(r, 2000 * attempt))
    }
  }
}

// Last-resort tier for rows matchExistingBook misses: same-author books only,
// compared on a normalised key ("&"→"and", parentheticals/series tags dropped)
// or trigram similarity ≥ 0.6. Volume numbers (digits / roman) must agree, so
// "Bleach, Vol. 9" never lands on "Bleach, Vol. 21".
const normTitle = (t: string) => fold(t).replace(/&/g, ' and ').replace(/\([^)]*\)/g, ' ').replace(/\bseries\b/g, ' ')
  .replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim()
const volumes = (t: string) => (normTitle(t).match(/\b(\d+|i{1,3}|iv|vi{0,3}|ix|x)\b/g) ?? []).join(',')
async function authorFuzzy(pg: import('pg').Client, title: string, authors: string[]) {
  const nt = normTitle(title)
  for (const a of authors) {
    const ln = lastName(a)
    if (ln.length < 3) continue
    const cands = (await pg.query(`select b.id, b.title, similarity(lower(b.title), lower($1)) sim from books b
        join book_authors ba on ba.book_id=b.id join authors a on a.id=ba.author_id
        where lower(a.display_name) like '%' || $2 || '%' order by sim desc limit 5`, [title, ln])).rows
    for (const c of cands) {
      const nc = normTitle(c.title)
      if (volumes(c.title) !== volumes(title)) continue
      const prefix = (x: string, y: string) => x.startsWith(y + ' ') && y.split(' ').length >= 2
      if (nc === nt || prefix(nt, nc) || prefix(nc, nt) || Number(c.sim) >= 0.6) return { id: Number(c.id), title: c.title as string, sim: Number(c.sim) }
    }
  }
  return null
}
const authorFuzzyLog: string[] = []

type Existing = { region: string | null; dkey: string }
type Held = { row: Stage0Row; matched_book_id: number; matched_title: string; matched_authors: string; how: string }

async function main() {
  const rows = (JSON.parse(readFileSync(IN, 'utf8')) as Stage0Row[]).slice(0, LIMIT)
  const pg = newPgClient(); await pg.connect()

  const count = async () => (await pg.query(`select (select count(*) from books)::int books, (select count(*) from bans)::int bans, (select count(*) from bans where country_code='US')::int us_bans`)).rows[0]
  const before = await count()
  console.log('BEFORE', before)

  const banIdx = new Map<number, Existing[]>()
  for (const b of (await pg.query(`select book_id, region, institution from bans where country_code='US'`)).rows) {
    const bid = Number(b.book_id)
    if (!banIdx.has(bid)) banIdx.set(bid, [])
    banIdx.get(bid)!.push({ region: b.region, dkey: districtKey(b.institution) })
  }
  const authorsOf = async (id: number): Promise<{ title: string; authors: string }> =>
    (await pg.query(`select b.title, coalesce(string_agg(a.display_name, ' | '), '') authors from books b left join book_authors ba on ba.book_id=b.id left join authors a on a.id=ba.author_id where b.id=$1 group by b.id`, [id])).rows[0]
  const scopeId = new Map<string, number>((await pg.query(`select id, slug from scopes`)).rows.map(r => [r.slug, Number(r.id)]))
  const reasonOther = (await pg.query(`select id from reasons where slug='other'`)).rows[0].id as number

  // Cache per (title|first author) so repeat titles cost one lookup.
  const resolved = new Map<string, { kind: 'existing' | 'new' | 'held'; id?: number; held?: Omit<Held, 'row'> }>()
  const stats: Record<string, number> = {}
  const bump = (k: string) => (stats[k] = (stats[k] ?? 0) + 1)
  const held: Held[] = []
  const plannedNewBooks = new Map<string, Stage0Row[]>()   // key → rows (dry-run + apply)
  const toAttach: { row: Stage0Row; book_id: number; how: string }[] = []
  const seen = new Set<string>()

  for (const row0 of rows) {
    const verdict = RESOLUTIONS[`${row0.title}|${row0.authors[0]}`]
    if (verdict?.drop) { bump('resolved:drop'); continue }
    const row: Stage0Row & { slug_override?: string } = verdict?.create
      ? { ...row0, title: verdict.title ?? row0.title, authors: verdict.authors ?? row0.authors, slug_override: verdict.create }
      : row0
    const key = `${fold(row.title)}|${lastName(row.authors[0])}`
    let res = resolved.get(key)
    if (!res && verdict?.attach) { res = { kind: 'existing', id: verdict.attach }; bump('resolved:attach'); resolved.set(key, res) }
    if (!res && verdict?.create) { res = { kind: 'new' }; bump('resolved:create'); resolved.set(key, res) }
    if (!res) {
      let hit: { id: number; how: string } | null = null
      let mismatch: Omit<Held, 'row'> | null = null
      const pre = row.title.split(/[:;]/)[0].trim()
      for (const [t, how] of [[row.title, 'title'], [pre, 'pre-colon']] as const) {
        if (hit || (how === 'pre-colon' && (pre === row.title || pre.split(/\s+/).length < 2))) continue
        const m = await matchCached(t)
        if (!m) continue
        const b = await authorsOf(m.id)
        const names = fold(b.authors)
        if (row.authors.some(a => lastName(a) && names.includes(lastName(a)))) hit = { id: m.id, how: `${how}:${m.status}` }
        else mismatch ??= { matched_book_id: m.id, matched_title: b.title, matched_authors: b.authors, how: `${how}:${m.status}` }
      }
      if (!hit && !mismatch) {
        const af = await authorFuzzy(pg, row.title, row.authors)
        if (af) { hit = { id: af.id, how: 'author-fuzzy' }; authorFuzzyLog.push(`${row.title} [${row.authors[0]}] ⇒ #${af.id} ${af.title} (sim ${af.sim.toFixed(2)})`) }
      }
      res = hit ? { kind: 'existing', id: hit.id } : mismatch ? { kind: 'held', held: mismatch } : { kind: 'new' }
      if (hit) bump(`match:${hit.how}`)
      resolved.set(key, res)
    }
    if (res.kind === 'held') { held.push({ row, ...res.held! }); bump('needs_review'); continue }
    if (res.kind === 'new') {
      const dk = `new:${key}|${row.region}|${districtKey(row.institution)}`
      if (seen.has(dk)) { bump('skip:dup-in-file'); continue }
      seen.add(dk)
      if (!plannedNewBooks.has(key)) plannedNewBooks.set(key, [])
      plannedNewBooks.get(key)!.push(row); bump('ban:on-new-book'); continue
    }
    const dkey = districtKey(row.institution)
    const ex = banIdx.get(res.id!) ?? []
    if (ex.some(e => e.region === row.region && sameDistrict(e.dkey, dkey))) { bump('skip:already-in-db'); continue }
    const dk = `${res.id}|${row.region}|${dkey}`
    if (seen.has(dk)) { bump('skip:dup-in-file'); continue }
    seen.add(dk)
    toAttach.push({ row, book_id: res.id!, how: 'existing' }); bump('ban:on-existing-book')
  }

  writeFileSync(CACHE_PATH, JSON.stringify(matchCache))
  writeFileSync(`data/magnusson/author-fuzzy-${STAMP}.txt`, authorFuzzyLog.join('\n'))
  writeFileSync(`data/magnusson/needs-review-${STAMP}.json`, JSON.stringify(held, null, 1))
  const plan = { attach: toAttach.map(a => ({ book_id: a.book_id, ...a.row })), new_books: [...plannedNewBooks.values()] }
  writeFileSync(`data/magnusson/plan-${STAMP}.json`, JSON.stringify(plan, null, 1))
  console.log({ rows: rows.length, ...stats, new_books: plannedNewBooks.size, held_titles: new Set(held.map(h => h.matched_book_id)).size })
  if (!APPLY) { console.log('dry-run — plan + needs_review written to data/magnusson/'); await pg.end(); return }

  // ── apply ────────────────────────────────────────────────────────────────
  const upsertSource = async (name: string, url: string) =>
    (await pg.query(`insert into ban_sources (source_name, source_url, source_type, verification_status, accessed_at)
       values ($1,$2,'web','unverified',now()) on conflict (source_url) do update set accessed_at=now() returning id`, [name, url])).rows[0].id as number
  const magSrc = await upsertSource(MAGNUSSON_SOURCE_NAME, MAGNUSSON_SOURCE_URL)
  const srcCache = new Map<string, number>()
  const linkSources = async (banId: number, row: Stage0Row) => {
    const ids = [magSrc]
    if (row.source_url) {
      if (!srcCache.has(row.source_url)) srcCache.set(row.source_url, await upsertSource('News / public record (via Magnusson Book Censorship Database)', row.source_url))
      ids.push(srcCache.get(row.source_url)!)
    }
    for (const id of ids) await pg.query(`insert into ban_source_links (ban_id, source_id) values ($1,$2) on conflict do nothing`, [banId, id])
  }
  const insertBan = async (bookId: number, row: Stage0Row) => {
    const id = (await pg.query(`insert into bans (book_id, country_code, scope_id, action_type, status, region, institution, year_started, confidence)
       values ($1,'US',$2,$3,'active',$4,$5,$6,'reported') returning id`,
      [bookId, scopeId.get(row.scope_slug), row.action_type, row.region, row.institution, row.year])).rows[0].id as number
    await pg.query(`insert into ban_reason_links (ban_id, reason_id) values ($1,$2) on conflict do nothing`, [id, reasonOther])
    await linkSources(id, row)
  }

  let banCount = 0, bookCount = 0
  const failed: unknown[] = []
  for (const a of toAttach) { await insertBan(a.book_id, a.row); banCount++ }
  for (const group of plannedNewBooks.values()) {
    const [first, ...rest] = group
    let r
    try { r = await commitParsedRow({
      title: first.title, authors: first.authors, slug_override: (first as { slug_override?: string }).slug_override ?? null, year: first.year, country_code: 'US',
      scope_slug: first.scope_slug, action_type: first.action_type, ban_status: 'active', reason_slug: 'other',
      inclusion_rationale: `Listed as ${first.action_type} (${first.institution}, ${first.region}, ${first.year}) in the Magnusson Book Censorship Database.`,
      source_url: MAGNUSSON_SOURCE_URL, source_name: MAGNUSSON_SOURCE_NAME, source_type: 'web',
    }, pg) } catch (e) { failed.push({ title: first.title, authors: first.authors, error: String(e) }); continue }
    await pg.query(`update bans set region=$2, institution=$3, confidence='reported' where id=$1`, [r.ban_ids[0], first.region, first.institution])
    await linkSources(r.ban_ids[0], first)
    bookCount++; banCount++
    for (const row of rest) { await insertBan(r.book_id, row); banCount++ }
  }
  if (failed.length) writeFileSync(`data/magnusson/create-failed-${STAMP}.json`, JSON.stringify(failed, null, 1))
  const after = await count()
  console.log('AFTER', after, { books_created: bookCount, bans_created: banCount, create_failed: failed.length,
    delta: { books: after.books - before.books, bans: after.bans - before.bans } })
  await pg.end()
}

main().catch(e => { console.error(e); process.exit(1) })
