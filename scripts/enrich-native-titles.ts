/**
 * Native-title enrichment from Wikidata (CC-0) for foreign-language books that
 * are stored under their English / translated title and carry NO title_native.
 *
 * Why: ~4.2k books whose original_language != 'en' have an empty title_native
 * (e.g. "Doctor Zhivago", "One Hundred Years of Solitude"). The on-site search
 * (src/lib/book-search.ts) ilike-matches title_native, the public page renders
 * it as a secondary line, and it feeds schema.org alternateName — so filling it
 * is pure findability gain, especially for original-script queries.
 *
 * Source & matching (HIGH precision, NO confabulation):
 *   1. wbsearchentities(title) → candidate Q-ids.
 *   2. Keep only items whose P31 (instance of) is a written-work type
 *      (novel / book / literary work / play / poem / short story / comic).
 *      This drops the films/musicals that share a title (the #1 false match —
 *      "Doctor Zhivago" search returns the 1965 film first).
 *   3. AUTHOR GATE: the item's P50 author label must match the book's author
 *      (accent-insensitive, last-name aware). P364 (original language) is NOT
 *      used as a gate — it is empty on most literary-work items.
 *   4. Native title = the P1476 "title" value whose monolingual language ==
 *      original_language, else the item label in that language. Must be
 *      non-empty AND differ from the English title.
 *
 * What it writes (only with --apply):
 *   - title_native         = the sourced native-language title
 *   - title_native_script  = detectScript(nativeTitle)  ('latin'|'cyrillic'|…)
 * What it deliberately does NOT do:
 *   - title / slug                  — canonical English title stays the H1
 *   - title_transliterated          — non-Latin romanization is review-gated
 *     doctrine (never auto-accept); non-Latin hits are flagged in the review
 *     file for the dedicated transliteration pass (cf. normalize-russia-titles).
 *   - books that fail the author gate — routed to the review file as
 *     "unconfirmed", never written.
 *
 * Every run writes a human-checkable review file:
 *   data/native-title-enrichment-<date>.{json,md}
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/enrich-native-titles.ts                 # dry-run, top 40 most-banned
 *   pnpm tsx --env-file=.env.local scripts/enrich-native-titles.ts --limit=40 --apply
 *   pnpm tsx --env-file=.env.local scripts/enrich-native-titles.ts --lang=de --limit=100
 *   pnpm tsx --env-file=.env.local scripts/enrich-native-titles.ts --book-ids=27,576,6260
 */

import { writeFileSync } from 'node:fs'
import { adminClient } from '../src/lib/supabase'
import { detectScript } from '../src/lib/imports/language-inference'
import { isApply, flagValue, intFlag } from './lib/cli'

const APPLY = isApply()
const LIMIT = intFlag('limit', 40)
const OFFSET = intFlag('offset', 0)
const LANG_FILTER = flagValue('lang')?.toLowerCase() ?? null
const BOOK_IDS = (flagValue('book-ids') ?? '')
  .split(',')
  .map(s => parseInt(s.trim(), 10))
  .filter(Number.isFinite)

const WD_API = 'https://www.wikidata.org/w/api.php'
const WD_ENTITY = 'https://www.wikidata.org/wiki/Special:EntityData'
const UA = 'banned-books.org native-title enrichment (https://www.banned-books.org; ludo.raedts@voys.nl)'

const sb = adminClient()

// ── Written-work P31 allowlist. Precision over recall: a real banned book that
//    isn't one of these (rare) lands in the review file, not the DB. ──────────
const WRITTEN_WORK = new Set([
  'Q571',        // book
  'Q7725634',    // literary work
  'Q8261',       // novel
  'Q47461344',   // written work
  'Q49084',      // short story
  'Q1279564',    // short-story collection
  'Q25379',      // dramatic work / play
  'Q49085',      // poem
  'Q5185279',    // poetry / poem (alt)
  'Q386724',     // work — kept only because some books are typed this loosely
  'Q1004',       // comics
  'Q1760610',    // comic book
  'Q838795',     // comic strip
  'Q23622',      // anthology
  'Q235557',     // essay
  'Q1238720',    // treatise
  'Q57933693',   // book (alt)
  'Q3331189',    // EXCLUDED below — see editionBlock; listed for clarity
])
// Editions carry a language-specific (often translated) title, not the work's
// native title — never trust them as a native-title source.
const EDITION = 'Q3331189'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿ一-鿿؀-ۿ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Accent-insensitive, last-name-aware author match. */
function authorMatches(bookAuthor: string, wdLabels: string[]): boolean {
  const a = norm(bookAuthor)
  if (!a) return false
  const aLast = a.split(' ').filter(Boolean).pop() ?? a
  for (const raw of wdLabels) {
    const w = norm(raw)
    if (!w) continue
    if (w === a || w.includes(a) || a.includes(w)) return true
    const wLast = w.split(' ').filter(Boolean).pop() ?? w
    // Last-name equality only counts when it is a substantial token (avoids
    // matching common short particles like "de"/"li").
    if (aLast.length >= 4 && aLast === wLast) return true
  }
  return false
}

/** Does monolingual-text language `code` belong to original_language `lang`? */
function langMatches(code: string, lang: string): boolean {
  const c = code.toLowerCase()
  return c === lang || c.startsWith(lang + '-')
}

interface Candidate {
  id: number
  title: string
  original_language: string
  author: string | null
}

interface WdEntity {
  id: string
  labels: Record<string, { value: string }>
  claims: Record<string, Array<{ mainsnak: { datavalue?: { value: unknown } } }>>
}

/** Search strings to try, in priority order. Stripping a leading article is
 *  load-bearing: searching "The Story of O" returns the film/song, while
 *  "Story of O" surfaces the novel (Q1501981). */
function searchVariants(title: string): string[] {
  const t = title.trim()
  const stripped = t.replace(/^(the|a|an)\s+/i, '').trim()
  const out = [t]
  if (stripped && stripped.toLowerCase() !== t.toLowerCase()) out.push(stripped)
  return out
}

async function wdSearchOne(query: string): Promise<string[]> {
  const url = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&type=item&limit=7&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const json = (await res.json()) as { search?: Array<{ id: string }> }
  return (json.search ?? []).map(s => s.id)
}

async function wdSearch(title: string): Promise<string[]> {
  const seen = new Set<string>()
  const out: string[] = []
  for (const q of searchVariants(title)) {
    for (const id of await wdSearchOne(q)) {
      if (!seen.has(id)) { seen.add(id); out.push(id) }
    }
    await delay(120)
  }
  return out
}

async function wdEntity(qid: string): Promise<WdEntity | null> {
  const res = await fetch(`${WD_ENTITY}/${qid}.json`, { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  const json = (await res.json()) as { entities: Record<string, WdEntity> }
  return json.entities[qid] ?? null
}

function claimQids(e: WdEntity, prop: string): string[] {
  return (e.claims[prop] ?? [])
    .map(c => {
      const v = c.mainsnak?.datavalue?.value as { id?: string } | undefined
      return v?.id
    })
    .filter((x): x is string => !!x)
}

function p1476Titles(e: WdEntity): Array<{ language: string; text: string }> {
  return (e.claims['P1476'] ?? [])
    .map(c => c.mainsnak?.datavalue?.value as { language?: string; text?: string } | undefined)
    .filter((v): v is { language: string; text: string } => !!v?.language && !!v?.text)
}

interface Proposal {
  id: number
  title: string
  author: string | null
  lang: string
  qid: string
  nativeTitle: string
  script: string
  needsTransliteration: boolean
  source: string
}
interface Unconfirmed {
  id: number
  title: string
  author: string | null
  lang: string
  reason: string
  triedQids: string[]
}

async function resolveNative(c: Candidate): Promise<Proposal | Unconfirmed> {
  const triedQids: string[] = []
  let qids: string[] = []
  try {
    qids = await wdSearch(c.title)
  } catch {
    return { id: c.id, title: c.title, author: c.author, lang: c.original_language, reason: 'search-error', triedQids }
  }
  if (qids.length === 0)
    return { id: c.id, title: c.title, author: c.author, lang: c.original_language, reason: 'no-search-hit', triedQids }

  for (const qid of qids) {
    triedQids.push(qid)
    await delay(120)
    const e = await wdEntity(qid)
    if (!e) continue

    const p31 = claimQids(e, 'P31')
    if (p31.includes(EDITION)) continue
    const isWork = p31.some(t => WRITTEN_WORK.has(t) && t !== EDITION)
    if (!isWork) continue

    // Author gate (only when we have an author to check against).
    if (c.author) {
      const authorQids = claimQids(e, 'P50')
      if (authorQids.length === 0) continue
      // Fetch author labels (batched single call).
      const idsParam = authorQids.slice(0, 5).join('|')
      await delay(120)
      let labels: string[] = []
      try {
        const r = await fetch(
          `${WD_API}?action=wbgetentities&ids=${idsParam}&props=labels|aliases&format=json`,
          { headers: { 'User-Agent': UA } },
        )
        if (r.ok) {
          // Pen names matter: "Pauline Réage" is an ALIAS of the Story of O
          // author (labels are "Anne Desclos"/"Dominique Aury"), so match
          // against labels AND aliases.
          const j = (await r.json()) as {
            entities?: Record<string, {
              labels?: Record<string, { value: string }>
              aliases?: Record<string, Array<{ value: string }>>
            }>
          }
          for (const ent of Object.values(j.entities ?? {})) {
            for (const l of Object.values(ent.labels ?? {})) labels.push(l.value)
            for (const arr of Object.values(ent.aliases ?? {})) for (const a of arr) labels.push(a.value)
          }
        }
      } catch { /* fall through to no-match */ }
      if (!authorMatches(c.author, labels)) continue
    }

    // Native title: prefer P1476 in the original language, else label.
    let native: string | null = null
    for (const t of p1476Titles(e)) {
      if (langMatches(t.language, c.original_language)) { native = t.text.trim(); break }
    }
    if (!native) {
      const labelKeys = Object.keys(e.labels).filter(k => langMatches(k, c.original_language))
      if (labelKeys.length) native = e.labels[labelKeys[0]].value.trim()
    }
    if (!native) continue
    if (norm(native) === norm(c.title)) continue // identical to English title → useless

    const script = detectScript(native) ?? 'latin'
    return {
      id: c.id,
      title: c.title,
      author: c.author,
      lang: c.original_language,
      qid,
      nativeTitle: native,
      script,
      needsTransliteration: script !== 'latin',
      source: `https://www.wikidata.org/wiki/${qid}`,
    }
  }
  return { id: c.id, title: c.title, author: c.author, lang: c.original_language, reason: 'no-confirmed-work-match', triedQids }
}

function isProposal(x: Proposal | Unconfirmed): x is Proposal {
  return 'nativeTitle' in x
}

async function loadCandidates(): Promise<Candidate[]> {
  // Pull foreign-language books lacking a native title, with their author.
  const rows: Array<{
    id: number; title: string; original_language: string
    book_authors: Array<{ authors: { display_name: string } | null }>
  }> = []

  if (BOOK_IDS.length) {
    const { data, error } = await sb
      .from('books')
      .select('id, title, original_language, book_authors(authors(display_name))')
      .in('id', BOOK_IDS)
    if (error) throw error
    rows.push(...((data ?? []) as typeof rows))
  } else {
    for (let from = 0; ; from += 1000) {
      let q = sb
        .from('books')
        .select('id, title, original_language, book_authors(authors(display_name))')
        .not('original_language', 'is', null)
        .neq('original_language', 'en')
        .is('title_native', null)
        .order('id')
        .range(from, from + 999)
      if (LANG_FILTER) q = q.eq('original_language', LANG_FILTER)
      const { data, error } = await q
      if (error) throw error
      if (!data || data.length === 0) break
      rows.push(...(data as typeof rows))
      if (data.length < 1000) break
    }
  }

  const candidates: Candidate[] = rows.map(r => ({
    id: r.id,
    title: r.title,
    original_language: (r.original_language || '').trim(),
    author: r.book_authors?.[0]?.authors?.display_name ?? null,
  }))

  if (BOOK_IDS.length) return candidates // explicit list: keep order, no ranking

  // Rank by notability: distinct_countries desc, then total_bans desc.
  // v_book_ban_counts must be queried with a LITERAL id list (index push-down).
  const counts = new Map<number, { c: number; b: number }>()
  const ids = candidates.map(c => c.id)
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200)
    const { data } = await sb
      .from('v_book_ban_counts')
      .select('entity_id, total_bans, distinct_countries')
      .in('entity_id', slice)
    for (const r of (data ?? []) as Array<{ entity_id: number; total_bans: number; distinct_countries: number }>) {
      counts.set(r.entity_id, { c: r.distinct_countries, b: r.total_bans })
    }
  }
  candidates.sort((x, y) => {
    const cx = counts.get(x.id) ?? { c: 0, b: 0 }
    const cy = counts.get(y.id) ?? { c: 0, b: 0 }
    return cy.c - cx.c || cy.b - cx.b || x.id - y.id
  })

  return candidates.slice(OFFSET, OFFSET + LIMIT)
}

function today(): string {
  // Date.* is fine in a normal script (only Workflow scripts forbid it).
  return new Date().toISOString().slice(0, 10)
}

async function main() {
  console.log(`\n── enrich-native-titles ── (${APPLY ? 'APPLY' : 'DRY-RUN'})`)
  const candidates = await loadCandidates()
  console.log(`  candidates this run: ${candidates.length}` +
    (LANG_FILTER ? ` (lang=${LANG_FILTER})` : '') +
    (BOOK_IDS.length ? ` (explicit ids)` : ` (top by distinct_countries, offset ${OFFSET})`))
  console.log()

  const proposals: Proposal[] = []
  const unconfirmed: Unconfirmed[] = []

  for (const c of candidates) {
    const r = await resolveNative(c)
    if (isProposal(r)) {
      proposals.push(r)
      const flag = r.needsTransliteration ? ` [${r.script}: needs translit follow-up]` : ''
      console.log(`  ✓ #${r.id} "${r.title}" → "${r.nativeTitle}" (${r.lang}/${r.script}) ${r.qid}${flag}`)
    } else {
      unconfirmed.push(r)
      console.log(`  · #${r.id} "${r.title}" — ${r.reason}`)
    }
    await delay(120)
  }

  console.log(`\n  matched: ${proposals.length}   unconfirmed: ${unconfirmed.length}`)
  const latinReady = proposals.filter(p => !p.needsTransliteration).length
  const nonLatin = proposals.length - latinReady
  console.log(`  of matched: ${latinReady} Latin-script (write native+script), ${nonLatin} non-Latin (native+script now, transliteration flagged)`)

  // Review files.
  const date = today()
  const jsonPath = `data/native-title-enrichment-${date}.json`
  const mdPath = `data/native-title-enrichment-${date}.md`
  writeFileSync(jsonPath, JSON.stringify({ generatedAt: date, applied: APPLY, proposals, unconfirmed }, null, 2))
  const md = [
    `# Native-title enrichment — ${date} ${APPLY ? '(APPLIED)' : '(dry-run)'}`,
    ``,
    `Source: Wikidata (CC-0). Author-gated + written-work-typed matches only.`,
    ``,
    `## Proposed (${proposals.length})`,
    ``,
    `| # | English title | Native title | lang/script | author | Wikidata | translit? |`,
    `|---|---|---|---|---|---|---|`,
    ...proposals.map(p =>
      `| ${p.id} | ${p.title} | ${p.nativeTitle} | ${p.lang}/${p.script} | ${p.author ?? '—'} | ${p.qid} | ${p.needsTransliteration ? 'follow-up' : '—'} |`),
    ``,
    `## Unconfirmed — NOT written (${unconfirmed.length})`,
    ``,
    `| # | English title | author | lang | reason |`,
    `|---|---|---|---|---|`,
    ...unconfirmed.map(u => `| ${u.id} | ${u.title} | ${u.author ?? '—'} | ${u.lang} | ${u.reason} |`),
    ``,
  ].join('\n')
  writeFileSync(mdPath, md)
  console.log(`\n  review files: ${jsonPath} , ${mdPath}`)

  if (!APPLY) {
    console.log(`\n  DRY-RUN — nothing written. Re-run with --apply to write title_native + title_native_script.\n`)
    return
  }

  let written = 0
  for (const p of proposals) {
    const { error } = await sb
      .from('books')
      .update({ title_native: p.nativeTitle, title_native_script: p.script })
      .eq('id', p.id)
      .is('title_native', null) // never clobber a manually-set native title
    if (error) { console.error(`  ✗ #${p.id}: ${error.message}`); continue }
    written++
  }
  console.log(`\n  APPLIED: wrote title_native+script to ${written} book(s).`)
  console.log(`  Non-Latin transliterations remain NULL by design — see the review file.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
