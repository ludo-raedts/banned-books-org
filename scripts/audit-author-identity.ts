/**
 * Identity audit: does every external source we link to an author actually name
 * THAT author? Read-only. Catches what the vision audit cannot: a perfectly
 * good portrait of the wrong person, e.g. Nancy Farmer's photo coming from the
 * Open Library author page of Elizabeth Wein (OL772148A).
 *
 * Per author, each source gets match / mismatch / unknown:
 *   photo_ol   photo is an Open Library author photo → that OL author's name
 *   photo_file photo is a Wikimedia file → person-like name in the file name
 *              ("Conor_McGregor_2025.jpeg"); generic names ("Portrait.jpg") → unknown
 *   ol_id      authors.openlibrary_author_id → OL name (+ alternate_names)
 *   wd_id      authors.wikidata_id → Wikidata label + aliases
 *   bio_src    authors.bio_source_url on Wikipedia → article title
 *
 * Name test (nameAgreement): fold accents/case/punctuation; match when the
 * author's surname or ≥2 name tokens appear in the source name (or vice versa,
 * for pseudonym lists); mismatch when a person-like source name shares NO
 * token with the author's name.
 *
 * Output: data/author-identity-<tag>.jsonl (resumable checkpoint) and
 * data/author-identity-<tag>.md (mismatches first). Writes nothing to the DB.
 *
 * Usage: npx tsx --env-file=.env.local scripts/audit-author-identity.ts [--ids-file=…] [--tag=2026-10-20] [--limit=N]
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { flagValue, idsFlag, intFlag } from './lib/cli'

const IDS = idsFlag()
const LIMIT = intFlag('limit', 100000)
const TAG = flagValue('tag') ?? new Date().toISOString().slice(0, 10)
const JSONL = `data/author-identity-${TAG}.jsonl`
const REPORT = `data/author-identity-${TAG}.md`
const UA = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }

type Verdict = 'match' | 'mismatch' | 'unknown'
type Check = { source: string; value: string; named: string | null; verdict: Verdict }
type Result = { id: number; slug: string; name: string; photo_url: string | null; checks: Check[] }

const fold = (s: string) => s.replace(/œ/gi, 'oe').replace(/æ/gi, 'ae').replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const STOP = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'dr', 'mr', 'mrs', 'ms', 'sir', 'de', 'van', 'von', 'der', 'den', 'la', 'le', 'du', 'da', 'di', 'el', 'al', 'bin', 'the', 'and', 'of'])
export function nameTokens(s: string): string[] {
  return fold(s).replace(/[^a-z0-9Ѐ-ӿ֐-ۿ぀-鿿]+/g, ' ').split(' ').filter(t => t.length > 1 && !STOP.has(t))
}
export function nameAgreement(author: string, source: string): Verdict {
  const a = nameTokens(author), s = new Set(nameTokens(source))
  if (!a.length || !s.size) return 'unknown'
  const shared = a.filter(t => s.has(t)).length
  const surname = a[a.length - 1]
  if (shared >= 2 || (a.length === 1 && shared === 1)) return 'match'
  if (s.has(surname)) {
    // Same surname, different first name ("Jewel Parker Rhodes" vs "Cody Rhodes")
    // is the classic namesake: not a match, leave it for a human.
    const sf = nameTokens(source)[0], af = a[0]
    const compatible = !sf || !af || sf === af || sf === surname || af === surname || sf[0] === af[0] && (sf.length === 1 || af.length === 1)
    return compatible ? 'match' : 'unknown'
  }
  // Non-Latin author names cannot be compared to a Latin source token by token.
  if (/[^\x00-\x7f]/.test(author.normalize('NFD').replace(/[̀-ͯ]/g, '')) !== /[^\x00-\x7f]/.test(source)) return 'unknown'
  return shared === 0 ? 'mismatch' : 'unknown'
}

// "Conor_McGregor_2025.jpeg" → "Conor McGregor"; null when the file name does not look like a person's name.
const FILE_NOISE = /^(img|dsc|dscn|p\d+|photo|portrait|picture|image|file|cropped|crop|retrato|foto|bild|official|headshot|author|writer|poet|at|in|on|with|and|the|by|from|signing|reading|festival|book|fair|award|prize|\d+(px)?)$/i
export function personNameFromFile(url: string): string | null {
  const m = url.match(/\/([^/]+?)\.(jpe?g|png|gif|webp|tiff?|svg)(?:\/|$|\?)/i)
  if (!m) return null
  const base = decodeURIComponent(m[1]).replace(/^\d+px-/, '')
  const words = base.replace(/[_\-.,()]+/g, ' ').split(/\s+/).filter(w => w && !FILE_NOISE.test(w) && !/\d/.test(w))
  const caps = words.filter(w => /^[A-ZÀ-Ý][A-Za-zà-ÿ'’]+$/.test(w) || /^[A-ZÀ-Ý]{2,}$/.test(w))
  return caps.length >= 2 ? caps.slice(0, 4).join(' ') : null
}

const olCache = new Map<string, string[] | null>()
async function olNames(olid: string): Promise<string[] | null> {
  if (olCache.has(olid)) return olCache.get(olid)!
  let names: string[] | null = null
  for (let attempt = 0; attempt < 3 && names === null; attempt++) {
    try {
      const r = await fetch(`https://openlibrary.org/authors/${olid}.json`, { headers: UA, signal: AbortSignal.timeout(15000) })
      if (r.ok) {
        const j = (await r.json()) as { name?: string; personal_name?: string; alternate_names?: string[] }
        // alternate_names is polluted with anthology credit lists ("Alexander,
        // Lloyd, Farmer, Nancy, …" on Elizabeth Wein's page): keep only entries
        // that look like ONE person (≤ 5 tokens, at most one comma).
        const alts = (j.alternate_names ?? []).filter(n => n.split(',').length <= 2 && n.split(/\s+/).length <= 5)
        names = [j.name, j.personal_name, ...alts].filter((x): x is string => !!x)
      } else if (r.status === 404) names = []
      else await new Promise(res => setTimeout(res, 2000 * (attempt + 1)))
    } catch { await new Promise(res => setTimeout(res, 2000 * (attempt + 1))) }
  }
  await new Promise(res => setTimeout(res, 350))
  olCache.set(olid, names)
  return names
}

async function wdLabels(ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    try {
      const r = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join('|')}&props=labels|aliases&format=json`, { headers: UA })
      const j = (await r.json()) as { entities?: Record<string, { labels?: Record<string, { value: string }>; aliases?: Record<string, Array<{ value: string }>> }> }
      for (const [id, e] of Object.entries(j.entities ?? {}))
        out.set(id, [...Object.values(e.labels ?? {}).map(l => l.value), ...Object.values(e.aliases ?? {}).flat().map(a => a.value)])
    } catch { /* leave unknown */ }
  }
  return out
}

function best(author: string, names: string[]): { named: string | null; verdict: Verdict } {
  if (!names.length) return { named: null, verdict: 'unknown' }
  let firstUnknown: string | null = null
  for (const n of names) {
    const v = nameAgreement(author, n)
    if (v === 'match') return { named: n, verdict: 'match' }
    if (v === 'unknown') firstUnknown ??= n
  }
  return firstUnknown ? { named: firstUnknown, verdict: 'unknown' } : { named: names[0], verdict: 'mismatch' }
}

async function main() {
  const pg = newPgClient(); await pg.connect()
  const rows = (await pg.query(`select id, slug, display_name, name_native, photo_url, openlibrary_author_id, wikidata_id, bio_source_url
    from authors where (photo_url is not null or openlibrary_author_id is not null or wikidata_id is not null or bio_source_url is not null)
    ${IDS ? 'and id = any($1::bigint[])' : ''} order by id limit ${LIMIT}`, IDS ? [IDS] : [])).rows
  await pg.end()

  const done = new Set<number>()
  if (existsSync(JSONL)) for (const l of readFileSync(JSONL, 'utf8').split('\n').filter(Boolean)) done.add((JSON.parse(l) as Result).id)
  const todo = rows.filter(r => !done.has(Number(r.id)))
  console.log(`identity audit: ${rows.length} authors with a source, ${todo.length} to check (${done.size} in checkpoint)`)

  const wd = await wdLabels([...new Set(todo.map(r => r.wikidata_id).filter(Boolean))] as string[])
  let n = 0
  for (const r of todo) {
    const name = r.display_name as string
    const alt = [name, r.name_native].filter(Boolean) as string[]
    const agree = (names: string[]) => {
      // try every form of OUR name too (display + native)
      let out = best(alt[0], names)
      for (const a of alt.slice(1)) if (out.verdict !== 'match') { const o = best(a, names); if (o.verdict === 'match') out = o }
      return out
    }
    const checks: Check[] = []
    const photo = r.photo_url as string | null
    const olPhoto = photo?.match(/covers\.openlibrary\.org\/a\/olid\/(OL\d+A)/)?.[1]
    if (olPhoto) {
      // The photo sits on SOME Open Library author's page: unless that page's
      // name matches ours, it is another person's photo (namesakes with a shared
      // first or last name included), so anything short of a match is a mismatch.
      const names = (await olNames(olPhoto)) ?? []
      const o = agree(names)
      checks.push({ source: 'photo_ol', value: olPhoto, named: o.named ?? names[0] ?? null, verdict: o.verdict === 'match' ? 'match' : names.length ? 'mismatch' : 'unknown' })
    }
    else if (photo && /wikimedia\.org/.test(photo)) {
      const fileName = personNameFromFile(photo)
      checks.push({ source: 'photo_file', value: photo.split('/').pop() ?? '', ...(fileName ? agree([fileName]) : { named: null, verdict: 'unknown' as Verdict }) })
    }
    if (r.openlibrary_author_id && r.openlibrary_author_id !== olPhoto)
      checks.push({ source: 'ol_id', value: r.openlibrary_author_id, ...agree((await olNames(r.openlibrary_author_id)) ?? []) })
    if (r.wikidata_id) checks.push({ source: 'wd_id', value: r.wikidata_id, ...agree(wd.get(r.wikidata_id) ?? []) })
    const wp = (r.bio_source_url as string | null)?.match(/wikipedia\.org\/wiki\/([^?#]+)/)?.[1]
    if (wp) checks.push({ source: 'bio_src', value: r.bio_source_url, ...agree([decodeURIComponent(wp).replace(/_/g, ' ').replace(/\s*\(.*\)$/, '')]) })
    const res: Result = { id: Number(r.id), slug: r.slug, name, photo_url: photo, checks }
    appendFileSync(JSONL, JSON.stringify(res) + '\n')
    const bad = checks.filter(c => c.verdict === 'mismatch')
    if (bad.length) console.log(`  ✗ #${r.id} ${name}: ${bad.map(b => `${b.source}=${b.named}`).join('; ')}`)
    if (++n % 200 === 0) console.log(`  … ${n}/${todo.length}`)
  }

  const all = readFileSync(JSONL, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Result)
  const counts: Record<string, Record<Verdict, number>> = {}
  for (const r of all) for (const c of r.checks) {
    counts[c.source] ??= { match: 0, mismatch: 0, unknown: 0 }
    counts[c.source][c.verdict]++
  }
  const mism = all.filter(r => r.checks.some(c => c.verdict === 'mismatch'))
  writeFileSync(REPORT, `# Author identity audit — ${TAG}\n\n` +
    `Authors checked: ${all.length}. Per source (match / mismatch / unknown):\n\n` +
    Object.entries(counts).map(([s, c]) => `- ${s}: ${c.match} / **${c.mismatch}** / ${c.unknown}`).join('\n') +
    `\n\n## Mismatches (${mism.length})\n\n` +
    mism.map(r => `- [${r.name}](https://www.banned-books.org/authors/${r.slug}) — ` +
      r.checks.filter(c => c.verdict === 'mismatch').map(c => `${c.source}: **${c.named}** (${c.value})`).join('; ')).join('\n') + '\n')
  console.log(`report: ${REPORT}`)
  console.log(counts)
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) })
