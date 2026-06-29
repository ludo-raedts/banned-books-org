/**
 * Fill authors.wikidata_id / website_url / social_links from Wikidata (CC-0)
 * for the most-banned authors, so the author page can emit schema.org `sameAs`
 * (entity-authority signal) and an optional link row in the hero.
 *
 * Candidate set: the top --candidates authors by number of postable banned
 * books (same gate as the Bluesky / birthday picker) that are not placeholder
 * buckets, have a stored birth_year (needed to disambiguate namesakes), and
 * have never been probed (links_checked_at is null). The probe is sticky, so
 * re-runs march down the long tail without redoing resolved rows.
 *
 * Match gate (identical doctrine to enrich-author-birthdays — a WRONG social
 * link sends visitors to a real person's private account, so this is strict):
 * wbsearchentities by name → the entity must be a human (P31 = Q5) AND its
 * P569 birth year must equal the author's stored birth_year. First match wins;
 * a miss still stamps links_checked_at so we don't re-probe it.
 *
 * Properties harvested from the matched entity:
 *   P856  official website  → website_url
 *   P2002 X/Twitter username → social_links.twitter   (https://x.com/<u>)
 *   P2003 Instagram username → social_links.instagram (https://www.instagram.com/<u>/)
 *   P2013 Facebook ID        → social_links.facebook  (https://www.facebook.com/<id>)
 *   P214  VIAF ID            → social_links.viaf       (https://viaf.org/viaf/<id>)
 * (Wikipedia/Wikidata sameAs are derived at render time from wikidata_id +
 * sitelink, so we don't duplicate them here.)
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-links.ts                 # dry-run
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-links.ts --apply         # write
 *   flags: --candidates=300
 */

import { writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { LATIN_SCRIPT_LANGS } from '../src/lib/top-list-data'
import { isApply, intFlag } from './lib/cli'

const APPLY = isApply()
const N_CANDIDATES = intFlag('candidates', 300)

const WD_API = 'https://www.wikidata.org/w/api.php'
const WD_ENTITY = 'https://www.wikidata.org/wiki/Special:EntityData'
const UA = 'banned-books.org author-links enrichment (https://www.banned-books.org; ludo.raedts@voys.nl)'
const MIN_BANS = 2
const HUMAN = 'Q5'
const NON_PERSON = new Set(['Anonymous', 'Unknown', 'Various', 'Various Authors'])

const sb = adminClient()
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

type AuthorStat = { id: number; name: string; slug: string; books: number; bans: number }

/** Top postable-banned authors, ranked by distinct books then raw bans. */
async function loadRankedAuthors(): Promise<AuthorStat[]> {
  const byAuthor = new Map<number, AuthorStat>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('books')
      .select('id, bans(country_code), book_authors!inner(authors!inner(id, display_name, slug))')
      .eq('is_gated', false)
      .eq('is_blanket_works', false)
      .not('cover_url', 'is', null)
      .not('description_ban', 'is', null)
      .or(`original_language.is.null,original_language.in.(${LATIN_SCRIPT_LANGS.join(',')})`)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{
      id: number
      bans: Array<{ country_code: string | null }> | null
      book_authors: Array<{ authors: { id: number; display_name: string; slug: string } | null }> | null
    }>
    for (const r of rows) {
      const bans = r.bans ?? []
      const hasNonUs = bans.some(b => b.country_code && b.country_code !== 'US')
      if (!(bans.length >= MIN_BANS || hasNonUs)) continue
      for (const ba of r.book_authors ?? []) {
        const a = ba.authors
        if (!a || NON_PERSON.has(a.display_name)) continue
        const cur = byAuthor.get(a.id) ?? { id: a.id, name: a.display_name, slug: a.slug, books: 0, bans: 0 }
        cur.books += 1
        cur.bans += bans.length
        byAuthor.set(a.id, cur)
      }
    }
    if (rows.length < PAGE) break
  }
  return [...byAuthor.values()].sort((a, b) => b.books - a.books || b.bans - a.bans)
}

type AuthorMeta = {
  birthYear: number | null
  placeholder: boolean
  checked: boolean
  website: string | null
  social: Record<string, string> | null
}

/** Per-author gate + existing-link fields, fetched in batches keyed by id. */
async function loadAuthorMeta(ids: number[]): Promise<Map<number, AuthorMeta>> {
  const out = new Map<number, AuthorMeta>()
  const CHUNK = 500
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const { data, error } = await sb
      .from('authors')
      .select('id, birth_year, is_placeholder, links_checked_at, website_url, social_links')
      .in('id', slice)
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as Array<{ id: number; birth_year: number | null; is_placeholder: boolean | null; links_checked_at: string | null; website_url: string | null; social_links: Record<string, string> | null }>) {
      out.set(r.id, {
        birthYear: r.birth_year,
        placeholder: !!r.is_placeholder,
        checked: r.links_checked_at != null,
        website: r.website_url,
        social: r.social_links,
      })
    }
  }
  return out
}

interface WdEntity {
  id: string
  claims: Record<string, Array<{ mainsnak: { datavalue?: { value: unknown } }; rank?: string }>>
}

async function wdSearch(name: string): Promise<string[]> {
  const url = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=7&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const json = (await res.json()) as { search?: Array<{ id: string }> }
  return (json.search ?? []).map(s => s.id)
}

async function wdEntity(qid: string): Promise<WdEntity | null> {
  const res = await fetch(`${WD_ENTITY}/${qid}.json`, { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  const json = (await res.json()) as { entities: Record<string, WdEntity> }
  return json.entities[qid] ?? null
}

function claimQids(e: WdEntity, prop: string): string[] {
  return (e.claims[prop] ?? [])
    .map(c => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((x): x is string => !!x)
}

/** First non-deprecated string value of a claim (url or external-id datatype). */
function claimString(e: WdEntity, prop: string): string | null {
  for (const c of e.claims[prop] ?? []) {
    if (c.rank === 'deprecated') continue
    const v = c.mainsnak?.datavalue?.value
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
  }
  return null
}

function p569Year(e: WdEntity): number | null {
  const v = e.claims['P569']?.[0]?.mainsnak?.datavalue?.value as { time?: string } | undefined
  if (!v?.time) return null
  const m = /^[+-](\d{4,})-/.exec(v.time)
  return m ? +m[1] : null
}

function isHttpUrl(s: string): boolean {
  try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' } catch { return false }
}

type Links = { qid: string; website: string | null; social: Record<string, string> }

type Resolved =
  | { ok: true; links: Links }
  | { ok: false; reason: string }

async function resolve(name: string, birthYear: number): Promise<Resolved> {
  let qids: string[] = []
  try { qids = await wdSearch(name) } catch { return { ok: false, reason: 'search-error' } }
  if (qids.length === 0) return { ok: false, reason: 'no-search-hit' }
  for (const qid of qids) {
    await delay(120)
    const e = await wdEntity(qid)
    if (!e) continue
    if (!claimQids(e, 'P31').includes(HUMAN)) continue
    if (p569Year(e) !== birthYear) continue // namesake guard

    const social: Record<string, string> = {}
    const tw = claimString(e, 'P2002')
    if (tw) social.twitter = `https://x.com/${tw}`
    const ig = claimString(e, 'P2003')
    if (ig) social.instagram = `https://www.instagram.com/${ig}/`
    const fb = claimString(e, 'P2013')
    if (fb) social.facebook = `https://www.facebook.com/${fb}`
    const viaf = claimString(e, 'P214')
    if (viaf) social.viaf = `https://viaf.org/viaf/${viaf}`

    const websiteRaw = claimString(e, 'P856')
    const website = websiteRaw && isHttpUrl(websiteRaw) ? websiteRaw : null
    return { ok: true, links: { qid, website, social } }
  }
  return { ok: false, reason: 'no-human-with-matching-birth-year' }
}

function nowIso(): string { return new Date().toISOString() }

async function main() {
  console.log(`enrich-author-links — ${APPLY ? 'APPLY' : 'DRY-RUN'} — candidates=${N_CANDIDATES}\n`)
  console.log('Ranking authors by postable bans…')
  const ranked = await loadRankedAuthors()
  const meta = await loadAuthorMeta(ranked.map(a => a.id))

  const candidates = ranked.filter(a => {
    const m = meta.get(a.id)
    return m && !m.placeholder && m.birthYear != null && !m.checked
  }).slice(0, N_CANDIDATES)

  console.log(`${ranked.length} ranked authors; ${candidates.length} eligible & unchecked this run.\n`)

  const hits: Array<{ a: AuthorStat; links: Links }> = []
  const misses: Array<{ a: AuthorStat; reason: string }> = []
  let done = 0
  for (const a of candidates) {
    const birthYear = meta.get(a.id)!.birthYear!
    const r = await resolve(a.name, birthYear)
    const stamp = nowIso()
    if (r.ok) {
      hits.push({ a, links: r.links })
      if (APPLY) {
        // Merge-safe: never clobber a manually-curated website with a null,
        // and union social_links so hand-added handles (e.g. an Instagram
        // Wikidata doesn't carry) survive a later run. Wikidata wins per key
        // when it has a value; existing manual entries are preserved otherwise.
        const m = meta.get(a.id)!
        const mergedSocial = { ...(m.social ?? {}), ...r.links.social }
        const { error } = await sb.from('authors').update({
          wikidata_id: r.links.qid,
          website_url: r.links.website ?? m.website,
          social_links: Object.keys(mergedSocial).length > 0 ? mergedSocial : null,
          links_checked_at: stamp,
        }).eq('id', a.id)
        if (error) console.error(`  ✗ update ${a.slug}: ${error.message}`)
      }
    } else {
      misses.push({ a, reason: r.reason })
      if (APPLY) {
        await sb.from('authors').update({ links_checked_at: stamp }).eq('id', a.id)
      }
    }
    if (++done % 20 === 0) console.log(`  …${done}/${candidates.length}`)
    await delay(100)
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const withSite = hits.filter(h => h.links.website).length
  const withSocial = hits.filter(h => Object.keys(h.links.social).length > 0).length
  console.log('\n══════════════════ RESULTS ══════════════════')
  console.log(`Probed:         ${candidates.length}`)
  console.log(`Matched QID:    ${hits.length}`)
  console.log(`  with website: ${withSite}`)
  console.log(`  with ≥1 social/authority: ${withSocial}`)
  console.log(`Unmatched:      ${misses.length}`)
  console.log(APPLY ? '\n✓ Written to DB (links_checked_at stamped on every probe).' : '\n(dry-run — nothing written)')

  const date = nowIso().slice(0, 10)
  const lines: string[] = [
    `# Author-links enrichment — ${date}${APPLY ? '' : ' (DRY-RUN)'}`,
    '',
    `Source: Wikidata (CC-0). Namesake gate: P31=Q5 + P569 year == stored birth_year.`,
    `Probed ${candidates.length} · matched ${hits.length} · with-website ${withSite} · with-social/authority ${withSocial} · unmatched ${misses.length}`,
    '',
    '## Matches',
    '',
    '| Author | QID | Website | Social / authority |',
    '|---|---|---|---|',
    ...hits.map(h => `| [${h.a.name}](https://www.banned-books.org/authors/${h.a.slug}) | ${h.links.qid} | ${h.links.website ?? '—'} | ${Object.entries(h.links.social).map(([k, v]) => `${k}: ${v}`).join('<br>') || '—'} |`),
    '',
    '## Unmatched (links_checked_at stamped, no data written)',
    '',
    ...misses.map(m => `- ${m.a.name} — ${m.reason}`),
    '',
  ]
  const path = `data/author-links-enrichment-${date}${APPLY ? '' : '-dryrun'}.md`
  writeFileSync(path, lines.join('\n'))
  console.log(`\nReview file: ${path}`)
}

main().catch(e => { console.error(e); process.exit(1) })
