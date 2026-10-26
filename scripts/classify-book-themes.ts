/**
 * Classifies book-level themes for book_themes (migration 20261026120000):
 *   lgbtq — the book features LGBTQ+ characters or people, or LGBTQ+ themes
 *   poc   — the book features characters or people of color (protagonist,
 *           major character or subject), or is centrally about race/racism
 *           as experienced by people of color
 * These mirror PEN America's two headline categories in its banned-books
 * analyses. A theme is what the BOOK features — never a claim about why a
 * ban happened (that is ban_reason_links).
 *
 * Evidence-verified: the model sees only the title, the blurb
 * (books.description_book) and Open Library subjects, and must quote the
 * words that show the theme. A "yes" is kept only when that quote is found
 * verbatim in the material it was given — no answers from memory. This trades
 * recall for precision: the old LLM reason tags (enrich-reasons.ts) were
 * ~65–75% precise for LGBTQ+ on a 40-book sample (Real Friends, The Poet X,
 * Vampire Academy tagged LGBTQ+).
 *
 * Candidates: every book with a US ban, plus every book with an lgbtq or
 * racial reason link (~9k).
 *
 * Checkpointed + resumable (safe to interrupt and re-run):
 *   data/ol-subjects-cache.json            Open Library subjects per work id
 *   data/book-themes-classify.jsonl        one verdict line per book
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/classify-book-themes.ts --sample=60
 *       → classify a random sample, print verdicts for manual precision check
 *   npx tsx --env-file=.env.local scripts/classify-book-themes.ts
 *       → classify all candidates not yet in the jsonl (no DB writes)
 *   npx tsx --env-file=.env.local scripts/classify-book-themes.ts --apply
 *       → write verified "yes" verdicts from the jsonl into book_themes
 *   --ids=1,2,3   restrict to these book ids      --concurrency=N (default 6)
 */

import fs from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { isApply, flagValue, intFlag } from './lib/cli'

const APPLY = isApply()
const SAMPLE = intFlag('sample', 0)
const CONCURRENCY = intFlag('concurrency', 6)
const OL_CONCURRENCY = intFlag('ol-concurrency', 10)
const IDS = flagValue('ids')?.split(',').map(Number).filter(Boolean) ?? null
const MODEL = 'gpt-4.1-mini'
const OL_CACHE = path.resolve('data', 'ol-subjects-cache.json')
const VERDICTS = path.resolve('data', 'book-themes-classify.jsonl')
const THEMES = ['lgbtq', 'poc'] as const
type Theme = typeof THEMES[number]

type Candidate = { id: number; slug: string; title: string; author: string; blurb: string | null; ol: string | null }
type Verdict = { book_id: number; slug: string; title: string } & Record<Theme, { yes: boolean; evidence: string | null; verified: boolean }>

const norm = (s: string) => s.toLowerCase().replace(/[“”"‘’']/g, '').replace(/\s+/g, ' ').trim()

// The quote must itself NAME the theme — a character name ("Emily"), a vague
// word ("sexuality") or a setting ("South America in fiction") lets the model
// answer from memory while passing the verbatim check (2026-10-26 sample).
const THEME_TERMS: Record<Theme, RegExp> = {
  lgbtq: /\b(gay|lesbian|bisexual|bi\b|queer\w*|sapphic|trans\b|transgender|nonbinary|non-binary|genderqueer|genderfluid|gender[- ]fluid|bigender|intersex|asexual|lgbt\w*|sexual minorit\w*|same[- ]sex|homosexual\w*|homophobia|transphobia|two[- ]spirit|drag (queen|king)|coming out|pronoun\w*|gender identity|sexual orientation|pride|two (?:teenage |young )?(?:girls|boys|women|men)\b[^.]*\b(?:love|romance|kiss\w*|relationship|fall))\b/i,
  poc: /\b(african[- ]americans?|black (american|people|girl|boy|family|famil\w+|woman|women|man|men|teen\w*|children|history|lives)|blacks?\b|africa\w*|ghana\w*|nigeria|kenya\w*|ethiopia\w*|rwand\w*|yemen\w*|mexico|latin america\w*|indian|india|gujarati|punjabi|half-native|native (?:hawaiian|alaskan)|latin[oaxe]s?\b|latinx|hispanic\w*|chican[oa]s?|mexican\w*|puerto ric\w*|cuban\w*|dominican\w*|salvador\w*|guatemal\w*|asian\w*|chinese|japanese|korean|vietnamese|filipin\w*|hmong|indian americans?|south asian|pakistani|bangladesh\w*|native americans?|indigenous|first nations|indians of north america|cherokee|navajo|lakota|ojibwe?|inuit|aborigin\w*|arab\w*|middle eastern|egyptian|iranian|persian|afghan\w*|somali\w*|nigerian|ghanaian|haitian|jamaican|people of color|person of color|biracial|multiracial|mixed[- ]race|racism|racist|racial\w*|race relations|segregation|civil rights|slavery|enslaved|slaves?\b|jim crow|harlem|immigrants?\b)\b/i,
}

async function loadCandidates(): Promise<Candidate[]> {
  const pg = newPgClient()
  await pg.connect()
  try {
    const rows = (await pg.query(`
      with cand as (
        select distinct book_id from bans where country_code = 'US'
        union
        select b.book_id from bans b
        join ban_reason_links l on l.ban_id = b.id join reasons r on r.id = l.reason_id
        where r.slug in ('lgbtq', 'racial'))
      select k.id, k.slug, k.title, k.description_book as blurb, k.openlibrary_work_id as ol,
        coalesce((select string_agg(a.display_name, ', ') from book_authors ba
                  join authors a on a.id = ba.author_id where ba.book_id = k.id), '') as author
      from cand join books k on k.id = cand.book_id
      where k.is_blanket_works is not true
      order by k.id`)).rows as Candidate[]
    return IDS ? rows.filter(r => IDS.includes(r.id)) : rows
  } finally {
    await pg.end()
  }
}

async function pool<T>(items: T[], n: number, fn: (t: T, i: number) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; await fn(items[i], i) }
  }))
}

// ── Open Library subjects (cached) ─────────────────────────────────────────
async function loadOlSubjects(cands: Candidate[]): Promise<Map<string, string[]>> {
  const cache: Record<string, string[]> = fs.existsSync(OL_CACHE) ? JSON.parse(fs.readFileSync(OL_CACHE, 'utf8')) : {}
  const missing = [...new Set(cands.map(c => c.ol).filter((x): x is string => !!x && !(x in cache)))]
  if (missing.length) console.log(`  Open Library: fetching subjects for ${missing.length} works…`)
  let done = 0
  await pool(missing, OL_CONCURRENCY, async (id) => {
    try {
      const res = await fetch(`https://openlibrary.org/works/${id}.json`, { headers: { 'User-Agent': 'banned-books.org theme classifier' } })
      const j = res.ok ? await res.json() as { subjects?: unknown[]; subject_people?: unknown[] } : {}
      cache[id] = [...(j.subjects ?? []), ...(j.subject_people ?? [])].filter((s): s is string => typeof s === 'string').slice(0, 60)
    } catch { /* leave uncached → retried next run */ }
    if (++done % 200 === 0) { fs.writeFileSync(OL_CACHE, JSON.stringify(cache)); console.log(`    …${done}/${missing.length}`) }
  })
  fs.writeFileSync(OL_CACHE, JSON.stringify(cache))
  return new Map(Object.entries(cache))
}

// ── Classification ─────────────────────────────────────────────────────────
function buildPrompt(c: Candidate, subjects: string[]): string {
  return `You classify what a BOOK features, for a reference site about banned books. Use ONLY the material below — not your own knowledge of the book. If the material does not show it, answer no.

Title: ${c.title}
Author: ${c.author || '(unknown)'}
Blurb: ${c.blurb?.slice(0, 1500) || '(none)'}
Library subjects: ${subjects.length ? subjects.join('; ') : '(none)'}

Themes:
- lgbtq: the book features LGBTQ+ characters or people (gay, lesbian, bisexual, transgender, nonbinary, queer, gender-nonconforming), same-sex relationships, or is about LGBTQ+ topics. Gender roles or puberty in general do NOT count. The author's own identity does NOT count.
- poc: the book's protagonist, a major character or its main subject is a person or people of color (Black, Latino/a, Asian, Indigenous, Middle Eastern, etc.), or it is centrally about racism as experienced by people of color. Setting alone, or a minor side character, does NOT count. The author's own identity does NOT count.

For each theme answer yes/no and, for yes, give "evidence": the shortest EXACT quote (copied verbatim from the Title, Blurb or Library subjects above) that shows it.

Reply as JSON: {"lgbtq":{"yes":bool,"evidence":string|null},"poc":{"yes":bool,"evidence":string|null}}`
}

// Evidence that describes a work's ORIGIN, not its characters ("a Japanese
// manga series", "east asian style") — 14 false poc hits in the full run.
const ORIGIN_NOT_CHARACTERS = /\b(manga|manhwa|manhua|anime|east asian style|hepburn|japanese:|korean:|chinese:)/i
const CREATOR = /\b(author|writer|poet|illustrator|novelist|written by)\b/i

/** Gates every kept verdict must pass — also re-applied to stored verdicts on --apply. */
function passesGates(t: Theme, evidence: string | null): boolean {
  if (!evidence || !THEME_TERMS[t].test(evidence) || CREATOR.test(evidence)) return false
  if (t === 'poc' && ORIGIN_NOT_CHARACTERS.test(evidence)) return false
  return true
}

async function classify(client: OpenAI, c: Candidate, subjects: string[]): Promise<Verdict> {
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildPrompt(c, subjects) }],
  })
  const j = JSON.parse(res.choices[0]?.message?.content ?? '{}') as Record<string, { yes?: boolean; evidence?: string | null }>
  const haystack = norm([c.title, c.blurb ?? '', subjects.join('; ')].join(' \n '))
  const out = { book_id: c.id, slug: c.slug, title: c.title } as Verdict
  for (const t of THEMES) {
    const yes = j[t]?.yes === true
    const evidence = yes ? (j[t]?.evidence ?? null) : null
    // Verbatim check per "; "-separated piece (models join several subjects).
    const pieces = (evidence ?? '').split(/\s*;\s*/).filter(p => p.trim().length >= 3)
    const verified = yes && pieces.length > 0
      && pieces.every(p => haystack.includes(norm(p)))
      // Theme named explicitly; not the creator's identity ("a novel by Mexican
      // author…"); not the work's origin ("a Japanese manga series").
      && passesGates(t, evidence)
    out[t] = { yes, evidence, verified }
  }
  return out
}

function readVerdicts(): Map<number, Verdict> {
  const m = new Map<number, Verdict>()
  if (!fs.existsSync(VERDICTS)) return m
  for (const line of fs.readFileSync(VERDICTS, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { const v = JSON.parse(line) as Verdict; m.set(v.book_id, v) } catch { /* torn line */ }
  }
  return m
}

async function apply() {
  const verdicts = [...readVerdicts().values()]
  const rows = verdicts.flatMap(v => THEMES.filter(t => v[t]?.verified && passesGates(t, v[t].evidence)).map(t => ({ book_id: v.book_id, theme: t, evidence: v[t].evidence })))
  console.log(`\n── apply: ${rows.length} verified theme rows from ${verdicts.length} verdicts ──`)
  for (const t of THEMES) console.log(`  ${t}: ${rows.filter(r => r.theme === t).length}`)
  const pg = newPgClient()
  await pg.connect()
  try {
    await pg.query('begin')
    // Classifier-owned rows are replaced wholesale; manual rows are never touched.
    const del = await pg.query(`delete from book_themes where source = 'llm_grounded'`)
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      await pg.query(
        `insert into book_themes (book_id, theme, evidence, source)
         select u.b, u.t, u.e, 'llm_grounded' from unnest($1::bigint[], $2::text[], $3::text[]) as u(b, t, e)
         on conflict (book_id, theme) do nothing`,
        [chunk.map(r => r.book_id), chunk.map(r => r.theme), chunk.map(r => r.evidence)],
      )
    }
    await pg.query('commit')
    const after = (await pg.query(`select theme, source, count(*)::int from book_themes group by 1,2 order by 1,2`)).rows
    console.log(`  replaced ${del.rowCount} previous llm_grounded rows`)
    console.table(after)
  } catch (e) {
    await pg.query('rollback'); throw e
  } finally {
    await pg.end()
  }
}

async function main() {
  if (APPLY) return apply()

  let cands = await loadCandidates()
  const done = readVerdicts()
  if (SAMPLE) {
    cands = [...cands].sort(() => Math.random() - 0.5).slice(0, SAMPLE)
  } else {
    cands = cands.filter(c => !done.has(c.id))
  }
  console.log(`\n── classify-book-themes (${SAMPLE ? `SAMPLE ${SAMPLE}` : 'RUN'}) — ${cands.length} books to classify ──`)
  const subjects = await loadOlSubjects(cands)

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const results: Verdict[] = []
  let n = 0
  await pool(cands, CONCURRENCY, async (c) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const v = await classify(client, c, c.ol ? subjects.get(c.ol) ?? [] : [])
        results.push(v)
        if (!SAMPLE) fs.appendFileSync(VERDICTS, JSON.stringify(v) + '\n')
        break
      } catch (e) {
        if (attempt === 3) console.error(`  ✗ ${c.slug}: ${(e as Error).message}`)
        else await new Promise(r => setTimeout(r, 2000 * attempt))
      }
    }
    if (++n % 250 === 0) console.log(`  …${n}/${cands.length}`)
  })

  for (const t of THEMES) {
    const yes = results.filter(r => r[t].yes)
    console.log(`  ${t}: yes ${yes.length}, verified ${yes.filter(r => r[t].verified).length}`)
  }
  if (SAMPLE) {
    for (const r of results.sort((a, b) => a.title.localeCompare(b.title))) {
      const tags = THEMES.map(t => r[t].yes ? `${t}${r[t].verified ? '' : '(UNVERIFIED)'}: "${(r[t].evidence ?? '').slice(0, 70)}"` : null).filter(Boolean)
      console.log(`  ${tags.length ? '■' : '·'} ${r.title.slice(0, 50)}  ${tags.join(' | ')}`)
    }
  } else {
    console.log(`\nVerdicts appended to ${VERDICTS}. Review, then --apply.`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
