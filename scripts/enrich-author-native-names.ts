/**
 * Fill authors.name_native (+ original_language, + wikidata_id when missing)
 * from Wikidata (CC-0) for authors who write in a non-Latin script, so the
 * author hero shows the native-script name ("莫言" under "Mo Yan") and the
 * Person JSON-LD emits it as alternateName — original-script findability,
 * mirror of books.title_native (cf. enrich-native-titles.ts).
 *
 * Candidate set: authors with name_native IS NULL, scoped by flag —
 *   --country=CN     authors with ≥1 book banned in that country (the intended
 *                    everyday scope: the censoring country's language is where
 *                    native-name search demand lives)
 *   --author-ids=1,2 explicit rows
 * Placeholder buckets, NON_PERSON names, and the corporate-author registry
 * (src/lib/organization-authors.ts) are skipped — an Organization has no
 * P1559 native personal name.
 *
 * Match gate (namesake doctrine of enrich-author-links.ts, extended because
 * many dissident writers here have NO stored birth_year):
 *   0. authors.wikidata_id, when present, is trusted as-is (already gated).
 *   Otherwise wbsearchentities(display_name) → P31 must include Q5, then:
 *   A. P569 birth year == stored birth_year (when we have one), else
 *   B. a P800 (notable work) label matches one of the author's book titles
 *      (accent/case-insensitive; title_native exact also counts), else
 *   C. reverse work search: wbsearchentities(book title) hits an item whose
 *      P50 includes the candidate and whose label matches that book.
 *   No gate passed → the author lands in the review file, nothing written.
 *
 * Native-name extraction from the matched entity:
 *   P1559 (name in native language, monolingual) → value + its language code;
 *   else the entity label in the language inferred from the author's books
 *   (mode of non-'en' books.original_language). The value must be non-Latin
 *   script (detectScript) AND differ from display_name — a Latin value means
 *   the author writes in a Latin-script language and name_native stays NULL
 *   by column doctrine (see 20260514191552_authors_multilingual.sql).
 *
 * Writes (only with --apply):
 *   - name_native        = the sourced native-script name
 *   - original_language  = 2-letter code of that name, only when currently NULL
 *                          (the hero's lang= attribute needs it)
 *   - wikidata_id        = matched QID, only when currently NULL
 *   links_checked_at is NOT touched — that stamp belongs to enrich-author-links.
 *
 * Every run writes a review file: data/author-native-names-<date>.md
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-native-names.ts --country=CN
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-native-names.ts --country=CN --apply
 *   pnpm tsx --env-file=.env.local scripts/enrich-author-native-names.ts --author-ids=663,664 --apply
 */

import { writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { detectScript } from '../src/lib/imports/language-inference'
import { ORGANIZATION_AUTHOR_SLUGS } from '../src/lib/organization-authors'
import { isApply, flagValue, intFlag } from './lib/cli'

const APPLY = isApply()
const LIMIT = intFlag('limit', 200)
const COUNTRY = flagValue('country')?.toUpperCase() ?? null
// Last-resort label language for matched entities whose language can't be
// derived (no P1559/P103/P1412, books lack original_language). The operator
// asserts the run's scope is e.g. Chinese ("--country=CN --lang=zh"). Only
// consulted AFTER the entity's own declared language, so a Japanese author in
// a CN-scoped run still resolves to the ja form first.
const LANG_FALLBACK = flagValue('lang')?.toLowerCase() ?? null
const AUTHOR_IDS = (flagValue('author-ids') ?? '')
  .split(',')
  .map(s => parseInt(s.trim(), 10))
  .filter(Number.isFinite)

const WD_API = 'https://www.wikidata.org/w/api.php'
const WD_ENTITY = 'https://www.wikidata.org/wiki/Special:EntityData'
const UA = 'banned-books.org author-native-name enrichment (https://www.banned-books.org; ludo.raedts@voys.nl)'
const HUMAN = 'Q5'
const NON_PERSON = new Set(['Anonymous', 'Unknown', 'Various', 'Various Authors'])

const sb = adminClient()
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

type Author = {
  id: number
  display_name: string
  slug: string
  birth_year: number | null
  wikidata_id: string | null
  original_language: string | null
  is_placeholder: boolean | null
  books: Array<{ title: string; title_native: string | null; original_language: string | null }>
}

// ── Wikidata plumbing (same shapes as enrich-author-links.ts) ────────────────

interface WdEntity {
  id: string
  labels?: Record<string, { language: string; value: string }>
  sitelinks?: Record<string, { title: string }>
  claims: Record<string, Array<{ mainsnak: { datavalue?: { value: unknown } }; rank?: string }>>
}

async function wdSearch(term: string, language = 'en'): Promise<string[]> {
  const url = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(term)}&language=${language}&type=item&limit=7&format=json`
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

/** First non-deprecated string value of a claim (external-id datatype). */
function claimString(e: WdEntity, prop: string): string | null {
  for (const c of e.claims[prop] ?? []) {
    if (c.rank === 'deprecated') continue
    const v = c.mainsnak?.datavalue?.value
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
  }
  return null
}

/** All non-deprecated P569 years — some entities carry several (calendar variants). */
function p569Years(e: WdEntity): number[] {
  const out: number[] = []
  for (const c of e.claims['P569'] ?? []) {
    if (c.rank === 'deprecated') continue
    const v = c.mainsnak?.datavalue?.value as { time?: string } | undefined
    if (!v?.time) continue
    const m = /^[+-](\d{4,})-/.exec(v.time)
    if (m) out.push(+m[1])
  }
  return out
}

/** P1559 "name in native language" — monolingual text value. */
function p1559(e: WdEntity): { text: string; language: string } | null {
  for (const c of e.claims['P1559'] ?? []) {
    if (c.rank === 'deprecated') continue
    const v = c.mainsnak?.datavalue?.value as { text?: string; language?: string } | undefined
    if (v?.text && v.language) return { text: v.text.trim(), language: v.language }
  }
  return null
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Candidate loading ─────────────────────────────────────────────────────────

async function loadAuthors(): Promise<Author[]> {
  let ids: number[]
  if (AUTHOR_IDS.length > 0) {
    ids = AUTHOR_IDS
  } else if (COUNTRY) {
    const { data, error } = await sb
      .from('bans')
      .select('book_id')
      .eq('country_code', COUNTRY)
      .order('book_id')
      .range(0, 4999)
    if (error) throw new Error(error.message)
    const bookIds = [...new Set((data ?? []).map(b => b.book_id))]
    const authorIds = new Set<number>()
    for (let i = 0; i < bookIds.length; i += 300) {
      const { data: rows, error: e2 } = await sb
        .from('book_authors')
        .select('author_id')
        .in('book_id', bookIds.slice(i, i + 300))
      if (e2) throw new Error(e2.message)
      for (const r of rows ?? []) authorIds.add(r.author_id)
    }
    ids = [...authorIds]
  } else {
    throw new Error('Pass --country=XX or --author-ids=1,2 (unbounded runs are not supported)')
  }

  const out: Author[] = []
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await sb
      .from('authors')
      .select('id, display_name, slug, birth_year, wikidata_id, original_language, is_placeholder, name_native, book_authors(books(title, title_native, original_language))')
      .in('id', ids.slice(i, i + 300))
      .is('name_native', null)
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as unknown as Array<Author & { name_native: string | null; book_authors: Array<{ books: Author['books'][number] | null }> }>) {
      out.push({
        id: r.id,
        display_name: r.display_name,
        slug: r.slug,
        birth_year: r.birth_year,
        wikidata_id: r.wikidata_id,
        original_language: r.original_language,
        is_placeholder: r.is_placeholder,
        books: (r.book_authors ?? []).map(ba => ba.books).filter((b): b is Author['books'][number] => !!b),
      })
    }
  }
  return out.slice(0, LIMIT)
}

// ── Resolution ────────────────────────────────────────────────────────────────

type Hit = { qid: string; gate: 'stored-qid' | 'birth-year' | 'notable-work' | 'reverse-work'; entity: WdEntity }
type Miss = { reason: string }

async function labelsMatchAnyBook(workQids: string[], a: Author): Promise<boolean> {
  const bookNorms = new Set(a.books.map(b => norm(b.title)))
  const nativeTitles = new Set(a.books.map(b => b.title_native?.trim()).filter(Boolean))
  for (const qid of workQids.slice(0, 10)) {
    await delay(120)
    const w = await wdEntity(qid)
    if (!w) continue
    for (const l of Object.values(w.labels ?? {})) {
      if (bookNorms.has(norm(l.value)) || nativeTitles.has(l.value.trim())) return true
    }
  }
  return false
}

async function resolveAuthor(a: Author): Promise<Hit | Miss> {
  if (a.wikidata_id) {
    const e = await wdEntity(a.wikidata_id)
    if (e) return { qid: a.wikidata_id, gate: 'stored-qid', entity: e }
    return { reason: `stored wikidata_id ${a.wikidata_id} unfetchable` }
  }

  let qids: string[] = []
  try { qids = await wdSearch(a.display_name) } catch { return { reason: 'search-error' } }
  if (qids.length === 0) return { reason: 'no-search-hit' }

  const humans: Array<{ qid: string; e: WdEntity }> = []
  for (const qid of qids) {
    await delay(120)
    const e = await wdEntity(qid)
    if (!e) continue
    if (!claimQids(e, 'P31').includes(HUMAN)) continue
    humans.push({ qid, e })
  }
  if (humans.length === 0) return { reason: 'no-human-candidate' }

  // Gate A: birth year (strict, same as enrich-author-links)
  if (a.birth_year != null) {
    for (const { qid, e } of humans) {
      if (p569Years(e).includes(a.birth_year)) return { qid, gate: 'birth-year', entity: e }
    }
  }

  // Gate B: P800 notable-work label matches one of the author's books
  for (const { qid, e } of humans) {
    const works = claimQids(e, 'P800')
    if (works.length === 0) continue
    if (await labelsMatchAnyBook(works, a)) return { qid, gate: 'notable-work', entity: e }
  }

  // Gate C: reverse work search — a work item authored (P50) by the candidate
  // whose label matches one of the author's books
  const candidateQids = new Set(humans.map(h => h.qid))
  for (const b of a.books.slice(0, 3)) {
    let workQids: string[] = []
    try { workQids = await wdSearch(b.title) } catch { continue }
    for (const wq of workQids.slice(0, 5)) {
      await delay(120)
      const w = await wdEntity(wq)
      if (!w) continue
      const labelMatches = Object.values(w.labels ?? {}).some(
        l => norm(l.value) === norm(b.title) || (b.title_native && l.value.trim() === b.title_native.trim()),
      )
      if (!labelMatches) continue
      const authorQid = claimQids(w, 'P50').find(q => candidateQids.has(q))
      if (authorQid) {
        const hit = humans.find(h => h.qid === authorQid)!
        return { qid: authorQid, gate: 'reverse-work', entity: hit.e }
      }
    }
  }

  return { reason: a.birth_year != null ? 'no-gate-passed (birth-year+works tried)' : 'no-gate-passed (no stored birth_year; works tried)' }
}

// P103 (native language) / P1412 (languages spoken) point at language ITEMS;
// P424 on those items is the Wikimedia language code ('zh', 'ja', …). Cached —
// the same handful of language entities recurs across every author.
const langCodeCache = new Map<string, string | null>()
async function languageCode(langQid: string): Promise<string | null> {
  if (langCodeCache.has(langQid)) return langCodeCache.get(langQid)!
  await delay(120)
  const e = await wdEntity(langQid)
  const code = e ? claimString(e, 'P424') : null
  langCodeCache.set(langQid, code)
  return code
}

function labelIn(e: WdEntity, lang: string): { value: string; language: string } | null {
  const labels = e.labels ?? {}
  const label = labels[lang] ?? labels[`${lang}-hans`] ?? labels[`${lang}-hant`]
  if (label) return label
  // Sitelink fallback: the zhwiki/jawiki article title IS the native name for
  // entities whose native-language label was never filled (common on obscure
  // dissident writers). Strip the " (disambiguator)" wiki suffix.
  const short = lang.slice(0, 2)
  const site = e.sitelinks?.[`${short}wiki`]
  if (site?.title) {
    return { value: site.title.replace(/\s*[(（][^)）]*[)）]\s*$/, ''), language: `${short}wiki` }
  }
  return null
}

/**
 * Chinese names carry no spaces (Wikidata P1559 sometimes has "张 戎"), and
 * the odd label carries trailing punctuation ("李志綏," — real case, Q492897).
 */
function tidy(name: string, lang: string): string {
  const t = name.trim().replace(/[,，、;；.。]+$/, '')
  return lang.startsWith('zh') ? t.replace(/\s+/g, '') : t
}

/**
 * Native name from the entity. Language ladder: P1559's own monolingual code,
 * else the entity's declared language (P103 native, else first P1412) resolved
 * to a Wikimedia code, else the modal non-'en' original_language of the
 * author's books. A P1559 that is a proper prefix/substring of the
 * same-language label is a family-name-only stub (real case: Ai Weiwei's
 * P1559 is "艾", label "艾未未") — the fuller label wins.
 */
async function extractNativeName(e: WdEntity, a: Author): Promise<{ name: string; language: string; source: string } | null> {
  // A Latin-script P1559 is a Wikidata entry error (romaji/pinyin entered as
  // the "native" name — real case: Q11586892 has P1559 "Sui Ishida"@ja) — fall
  // through to the label ladder, which has the real 石田スイ.
  const pRaw = p1559(e)
  const p = pRaw && detectScript(pRaw.text) !== 'latin' ? pRaw : null
  if (p) {
    const lang = p.language.slice(0, 2)
    // Family-name-only stubs are 1–2 CJK chars; anything longer is a real name
    // and must NOT be replaced by the label (labels can carry junk like
    // "ئىلھام توختى|Ilham Toxti" — real case, Q1894882).
    const label = labelIn(e, p.language) ?? labelIn(e, lang)
    if (p.text.length <= 2 && label && label.value.length > p.text.length && label.value.includes(p.text)) {
      return { name: tidy(label.value, lang), language: lang, source: `label:${label.language} (P1559 stub "${p.text}")` }
    }
    return { name: tidy(p.text, lang), language: lang, source: 'P1559' }
  }

  // Entity's own declared language beats guessing from our book rows.
  for (const langQid of [...claimQids(e, 'P103'), ...claimQids(e, 'P1412')]) {
    const code = await languageCode(langQid)
    if (!code || code === 'en') continue
    const label = labelIn(e, code)
    if (label) return { name: tidy(label.value, code), language: code.slice(0, 2), source: `label:${label.language} (via P103/P1412)` }
  }

  const langCounts = new Map<string, number>()
  for (const b of a.books) {
    const l = b.original_language
    if (l && l !== 'en') langCounts.set(l, (langCounts.get(l) ?? 0) + 1)
  }
  const lang = [...langCounts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0]
  if (lang) {
    const label = labelIn(e, lang)
    if (label) return { name: tidy(label.value, lang), language: lang, source: `label:${label.language} (via book lang)` }
  }

  if (LANG_FALLBACK) {
    const label = labelIn(e, LANG_FALLBACK)
    if (label) return { name: tidy(label.value, LANG_FALLBACK), language: LANG_FALLBACK.slice(0, 2), source: `label:${label.language} (via --lang)` }
  }
  return null
}

function nowIso(): string { return new Date().toISOString() }

async function main() {
  console.log(`enrich-author-native-names — ${APPLY ? 'APPLY' : 'DRY-RUN'} — scope=${AUTHOR_IDS.length ? `ids(${AUTHOR_IDS.length})` : `country ${COUNTRY}`}\n`)
  const authors = (await loadAuthors()).filter(a =>
    !a.is_placeholder && !NON_PERSON.has(a.display_name) && !ORGANIZATION_AUTHOR_SLUGS.has(a.slug),
  )
  console.log(`${authors.length} candidate authors (name_native IS NULL).\n`)

  const written: Array<{ a: Author; qid: string; gate: string; name: string; language: string; source: string }> = []
  const review: Array<{ a: Author; note: string }> = []
  let done = 0

  for (const a of authors) {
    const r = await resolveAuthor(a)
    if ('reason' in r) {
      review.push({ a, note: r.reason })
    } else {
      const native = await extractNativeName(r.entity, a)
      if (!native) {
        review.push({ a, note: `matched ${r.qid} (${r.gate}) but no P1559/native-language label` })
      } else if (detectScript(native.name) === 'latin') {
        review.push({ a, note: `matched ${r.qid} (${r.gate}) but native name is Latin script ("${native.name}") — name_native stays NULL by doctrine` })
      } else if (norm(native.name) === norm(a.display_name)) {
        review.push({ a, note: `matched ${r.qid} (${r.gate}) but native name equals display_name` })
      } else {
        written.push({ a, qid: r.qid, gate: r.gate, ...native })
        if (APPLY) {
          const update: Record<string, string> = { name_native: native.name }
          if (!a.original_language) update.original_language = native.language
          if (!a.wikidata_id) update.wikidata_id = r.qid
          const { error } = await sb.from('authors').update(update).eq('id', a.id)
          if (error) console.error(`  ✗ update ${a.slug}: ${error.message}`)
        }
        console.log(`  ✓ ${a.display_name} → ${native.name} [${native.language}] (${r.gate}, ${native.source}, ${r.qid})`)
      }
    }
    if (++done % 10 === 0) console.log(`  …${done}/${authors.length}`)
    await delay(100)
  }

  console.log('\n══════════════════ RESULTS ══════════════════')
  console.log(`Probed:   ${authors.length}`)
  console.log(`${APPLY ? 'Written' : 'Would write'}:  ${written.length}`)
  console.log(`Review:   ${review.length}`)
  console.log(APPLY ? '\n✓ Written to DB.' : '\n(dry-run — nothing written)')

  const date = nowIso().slice(0, 10)
  const lines: string[] = [
    `# Author native-name enrichment — ${date}${APPLY ? '' : ' (DRY-RUN)'}`,
    '',
    `Source: Wikidata (CC-0). Gates: stored-qid | P569 birth-year | P800 notable-work | reverse P50 work search.`,
    `Probed ${authors.length} · written ${written.length} · review ${review.length}`,
    '',
    '## Written',
    '',
    '| Author | Native name | Lang | Gate | Source | QID |',
    '|---|---|---|---|---|---|',
    ...written.map(w => `| [${w.a.display_name}](https://www.banned-books.org/authors/${w.a.slug}) | ${w.name} | ${w.language} | ${w.gate} | ${w.source} | [${w.qid}](https://www.wikidata.org/wiki/${w.qid}) |`),
    '',
    '## Review only (nothing written)',
    '',
    ...review.map(m => `- ${m.a.display_name} (id ${m.a.id}) — ${m.note}`),
    '',
  ]
  const path = `data/author-native-names-${date}${APPLY ? '' : '-dryrun'}.md`
  writeFileSync(path, lines.join('\n'))
  console.log(`\nReview file: ${path}`)
}

main().catch(e => { console.error(e); process.exit(1) })
