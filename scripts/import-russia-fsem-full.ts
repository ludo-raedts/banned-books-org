#!/usr/bin/env tsx
/**
 * Russia — FSEM full-list import (books only), from the Stap-0 seed built by
 * scripts/build-russia-fsem-stage0.ts (data/russia-fsem-<date>.json).
 *
 * Thin reader over the shared commit-lib (commitParsedRow / commitNewBanForBook)
 * — the same path as scripts/_import_fsem_delta_2026_08_25.ts. Per seed row:
 *
 *   1. SKIP  — the FSEM entry number already sits on an RU ban
 *              ("entry #N" from batch 1 / deltas, "FSEM #N" from the Wikipedia batch).
 *   2. Group the remaining rows by the transliterated title slug: one work listed
 *      under several entry numbers (other editions, other courts) is one book,
 *      with one ban per distinct ban year (batch-1 dedup key book × year).
 *   3. ATTACH — exact slug / slug-alias hit on a Cyrillic-titled book that already
 *      carries an RU ban → ban(s) on that book.
 *      HOLD   — any other hit: exact slug on a book without an RU ban, or a
 *               matchExistingBook hit (fuzzy title / English-title tier). Namesake
 *               risk is high for short Russian titles; these go to the held list
 *               for the editor, never auto-attached.
 *      CREATE — no hit → commitParsedRow (+ commitNewBanForBook for extra years).
 *
 * Authors: name_native from the gate (Cyrillic). The gate's name_english is NOT
 * used — it expands initials into invented first names. An author already on an
 * RU book is reused when surname + initials agree regardless of order
 * ("Романенко В.Ф." = "В.Ф. Романенко"); otherwise a new author with a BGN/PCGN
 * display_name and the Cyrillic in name_native. No author → "Anonymous" (#33).
 *
 * Writes the held rows to data/source-research/russia-fsem-held-<date>.md.
 *
 *   pnpm tsx --env-file=.env.local scripts/import-russia-fsem-full.ts            # dry-run
 *   pnpm tsx --env-file=.env.local scripts/import-russia-fsem-full.ts --apply
 *   … --seed=data/russia-fsem-2026-11-09.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { Client } from 'pg'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { matchExistingBook } from '../src/lib/imports/verifier'
import { commitParsedRow, commitNewBanForBook, type AuthorInput } from '../src/lib/imports/review-commit'
import { canonicaliseAuthorName } from '../src/lib/imports/canonicalise-author-name'
import { slugify } from '../src/lib/imports/slugify'
import { hasCyrillic, slugifyMaybeCyrillic, transliterateCyrillic } from '../src/lib/imports/transliterate-cyrillic'
import { isApply, flagValue } from './lib/cli'

const APPLY = isApply()
const SEED = flagValue('seed') ?? 'data/russia-fsem-2026-11-09.json'
const DATE = SEED.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10)
const HELD_PATH = `data/source-research/russia-fsem-held-${DATE}.md`

const SOURCE_URL = 'https://minjust.gov.ru/ru/extremist-materials/'
const SOURCE_NAME = 'Russian Ministry of Justice — Federal List of Extremist Materials'
const EDITOR_FLAG =
  '[Editor review needed — bibliographic fields machine-extracted from the Минюст list entry.]'
const ANONYMOUS = 'Anonymous'

interface SeedAuthor { name_native: string | null; name_transliterated: string | null; name_english: string }
interface SeedRow {
  fsem_entry: number
  title: string
  title_native_script: string | null
  title_transliterated: string | null
  title_english_meaningful: string | null
  original_language: string | null
  authors: SeedAuthor[]
  first_published_year: number | null
  isbn: string | null
  year: number | null
  inclusion_date: string | null
  court_decision: string | null
  raw_description: string
}

// ── helpers ────────────────────────────────────────────────────────────────

function cleanTitle(t: string): string {
  let out = t.replace(/^[«"“„\s]+|[»"”\s.;,]+$/g, '').replace(/\s+/g, ' ').trim()
  const open = (out.match(/«/g) ?? []).length
  const close = (out.match(/»/g) ?? []).length
  if (open !== close) out = out.replace(/[«»]/g, ' ').replace(/\s+/g, ' ').trim()
  return out
}

/** Main title: the part before the first subtitle separator. */
const mainTitleSlug = (t: string) => slugifyMaybeCyrillic(t.split(/[.:;(]|\s[–—-]\s/)[0] ?? t)

// Gate said "book", but the entry text shows it is not a published book.
const EXCLUDE: Record<number, string> = {
  597: '«Третий Рим» — Русский Альманах: an almanac (serial), not a book',
  2283: 'collection of 78 handwritten books and brochures seized in a search — not a published book',
}

// Held rows resolved by the editor (2026-11-09 dry-run): entry → existing book.
// Applied as attaches; the title guard aborts if the target drifted.
const RESOLVED: Record<number, { book_id: number; expect_title: string }> = {
  2: { book_id: 17331, expect_title: 'Книга единобожия' }, // at-Tamimi = Muhammad ibn Abd al-Wahhab (#4639 on the same book)
  4638: { book_id: 17331, expect_title: 'Книга единобожия' }, // al-Fawzan edition, cf. #75 on the same book
  296: { book_id: 171, expect_title: 'Zhuan Falun' },
  2615: { book_id: 17380, expect_title: 'Крепость мусульманина; Обращение к аллаху с мольбами; Лечение с помощью заговоров, встречающихся в Коране и Сунне' },
  2852: { book_id: 17380, expect_title: 'Крепость мусульманина; Обращение к аллаху с мольбами; Лечение с помощью заговоров, встречающихся в Коране и Сунне' },
  3897: { book_id: 17380, expect_title: 'Крепость мусульманина; Обращение к аллаху с мольбами; Лечение с помощью заговоров, встречающихся в Коране и Сунне' },
  2978: { book_id: 17304, expect_title: 'Исламская Акида (вероучение, убеждение, воззрение) по Священному Корану и достоверным изречениям пророка Мухаммада' },
  3344: { book_id: 17081, expect_title: 'Русские писатели о евреях' }, // book 2 of the same anthology (#3345)
  3819: { book_id: 17340, expect_title: 'Исламское государство' }, // an-Nabhani, other transliteration
  3822: { book_id: 17341, expect_title: 'Система ислама' }, // an-Nabhani, other transliteration
  5476: { book_id: 908, expect_title: 'Patriot' }, // Navalny, Russian edition (One Book Publishing 2024)
  5521: { book_id: 14331, expect_title: 'СВЯЩЕННОЕ ПИСАНИЕ' }, // New World Translation, cf. #5488
  5522: { book_id: 14331, expect_title: 'СВЯЩЕННОЕ ПИСАНИЕ' },
}

/** Subject-matter bucket, same 3-way split as batch 1 (political / religious / racial). */
function reasonOf(text: string): string {
  const t = text.toLowerCase()
  if (/еврей|жид|сион|талмуд|расов|арийск|национал-социал|гитлер|белой расы|нацизм|антисемит/.test(t)) return 'racial'
  if (/ислам|аллах|коран|пророк|хадис|сунн|нурси|рисале|иегов|сторожев|библи|фалун|церк|вероучен|мусульман|шариат|таухид|единобож|акыд|веры|религи|бог/.test(t)) return 'religious'
  return 'political'
}

function toIsbn13(isbn: string | null): string | null {
  if (!isbn) return null
  if (isbn.length === 13 && /^97[89]\d{10}$/.test(isbn)) return isbn
  if (isbn.length !== 10) return null
  const core = `978${isbn.slice(0, 9)}`
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 ? 3 : 1)
  return core + ((10 - (sum % 10)) % 10)
}

// Arabic name particles: shared by unrelated authors, never evidence of identity.
const NAME_PARTICLES = new Set(['ибн', 'бин', 'бинт', 'абу', 'аль', 'абд', 'абдуль', 'эль', 'шейх', 'имам', 'мухаммад', 'мухаммед', 'ахмад', 'абдуллах', 'абдулла'])

/** Lower-cased full-word tokens (len > 2) with genitive endings stripped: "Османа Нури Топбаша" ≈ "Осман Нури Топбаш". */
function nameStems(name: string): string[] {
  return name.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\s-]/gu, ' ').split(/[\s-]+/)
    .filter((t) => t.length > 2 && !NAME_PARTICLES.has(t))
    .map((t) => t.replace(/(ого|его)$/, '').replace(/(?<=.{3})[ая]$/, ''))
}
/** Order-independent key: stemmed words + initials. "Романенко В.Ф." ≡ "В.Ф. Романенко". */
function authorKey(name: string): string {
  const toks = name.toLowerCase().replace(/ё/g, 'е').replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean)
  const initials = toks.filter((t) => t.length <= 2).map((t) => t[0]).sort()
  return `${nameStems(name).sort().join(' ')}|${initials.join('')}`
}
/** Two author lists can be the same work's: one side unknown, or a shared surname stem. */
function authorsCompatible(a: string[], b: string[]): boolean {
  const sa = new Set(a.flatMap(nameStems))
  const sb = b.flatMap(nameStems)
  if (!sa.size || !sb.length) return true
  return sb.some((x) => sa.has(x))
}

const JUNK_AUTHOR = /^(анонимн\S*|пер|ред|сост|авт|автор(ы)?( не указан\S*| неизвест\S*)?|неизвест\S*|не указан\S*|anonymous|unknown|н\/д)$/i

function banDescription(rows: SeedRow[]): string {
  const nums = rows.map((r) => `#${r.fsem_entry}`)
  const lead = nums.length === 1 ? `as entry ${nums[0]}` : `as entries ${nums.slice(0, -1).join(', ')} and ${nums.at(-1)}`
  const r = rows[0]
  const parts = [`Listed on Russia’s Federal List of Extremist Materials (Минюст) ${lead}.`]
  if (r.first_published_year) parts.push(`First published: ${r.first_published_year}.`)
  if (r.court_decision) parts.push(`Court decision: ${r.court_decision}.`)
  if (r.inclusion_date) parts.push(`Added to list: ${r.inclusion_date}.`)
  parts.push(EDITOR_FLAG)
  const entryText = rows.map((x) => `#${x.fsem_entry}: ${x.raw_description}`).join(' | ')
  parts.push(`List entry: ${entryText.length > 1200 ? `${entryText.slice(0, 1199)}…` : entryText}`)
  return parts.join(' ')
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const seed = JSON.parse(readFileSync(SEED, 'utf8')) as { books: SeedRow[]; doubtful: unknown[] }
  console.log(`\n── import-russia-fsem-full ── ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'} — seed ${SEED}: ${seed.books.length} book rows`)

  const pg: Client = newPgClient()
  await pg.connect()

  // FSEM entry numbers already on an RU ban.
  const have = new Set<number>()
  const banRows = (await pg.query(`select description from bans where country_code='RU' and description is not null`)).rows
  for (const { description } of banRows as { description: string }[]) {
    if (!/Минюст|Extremist Materials|FSEM/i.test(description)) continue
    for (const m of description.matchAll(/(?:entry|entries|FSEM)[^.]{0,8}?((?:(?:#|No\.?\s*)\d+(?:,\s*|\s+and\s+)?)+)/g)) {
      for (const n of m[1].matchAll(/(?:#|No\.?\s*)(\d+)/g)) have.add(Number(n[1]))
    }
  }
  const before = (await pg.query(`select (select count(*) from books)::int books, (select count(*) from bans where country_code='RU')::int ru_bans, (select count(distinct book_id) from bans where country_code='RU')::int ru_books`)).rows[0]
  console.log(`  BEFORE: books=${before.books} RU bans=${before.ru_bans} RU books=${before.ru_books}; FSEM entries already on RU bans: ${have.size}`)

  // Authors: every slug (exact reuse) + the RU-book authors keyed order-independently.
  const authorSlugs = new Set<string>((await pg.query(`select slug from authors`)).rows.map((r: { slug: string }) => r.slug))
  const ruAuthors = (await pg.query(`select distinct a.slug, a.display_name, a.name_native from authors a join book_authors ba on ba.author_id=a.id join bans b on b.book_id=ba.book_id where b.country_code='RU'`)).rows as { slug: string; display_name: string; name_native: string | null }[]
  const authorByKey = new Map<string, { slug: string; display_name: string }>()
  for (const a of ruAuthors) {
    for (const n of [a.display_name, a.name_native]) if (n && hasCyrillic(n)) authorByKey.set(authorKey(n), a)
  }
  const reusable = (slug: string) => slugify(canonicaliseAuthorName(slug)) === slug
  const bySubset = (native: string) => {
    const st = nameStems(native)
    if (st.length < 2) return undefined
    const hits = ruAuthors.filter((a) => [a.display_name, a.name_native].some((n) => n && hasCyrillic(n) && st.every((x) => nameStems(n).includes(x))))
    return new Set(hits.map((h) => h.slug)).size === 1 ? hits[0] : undefined
  }
  const variantByKey = new Map<string, string>() // in-run spelling variants → shortest form

  const seedNames = (r: SeedRow) =>
    r.authors.map((a) => a.name_native?.replace(/\s+/g, ' ').trim() ?? '').filter((n) => n && !JUNK_AUTHOR.test(n.replace(/[.:]$/, '')))
  for (const r of seed.books) {
    for (const n of seedNames(r)) {
      const k = authorKey(n)
      const cur = variantByKey.get(k)
      if (!cur || n.length < cur.length) variantByKey.set(k, n)
    }
  }

  const resolveAuthors = (r: SeedRow): { inputs: AuthorInput[]; labels: string[] } => {
    const inputs: AuthorInput[] = []
    const labels: string[] = []
    for (const raw of seedNames(r)) {
      const native = variantByKey.get(authorKey(raw)) ?? raw
      if (!hasCyrillic(native)) {
        inputs.push({ display_name: native })
        labels.push(native)
        continue
      }
      const latin = transliterateCyrillic(native)
      const exactSlug = slugify(canonicaliseAuthorName(latin))
      const known = authorByKey.get(authorKey(native)) ?? bySubset(native)
      if (exactSlug && authorSlugs.has(exactSlug)) {
        inputs.push({ display_name: latin, name_native: native, name_transliterated: latin })
        labels.push(`${native} → ${exactSlug} (existing)`)
      } else if (known && reusable(known.slug)) {
        inputs.push({ display_name: known.slug }) // slug-conflict path: existing row kept as is
        labels.push(`${native} → ${known.display_name} (existing)`)
      } else if (exactSlug) {
        inputs.push({ display_name: latin, name_native: native, name_transliterated: latin })
        labels.push(`${native} → ${latin}`)
      }
    }
    if (!inputs.length) {
      inputs.push({ display_name: ANONYMOUS })
      labels.push(ANONYMOUS)
    }
    return { inputs, labels }
  }

  // Authors per FSEM entry (all seed book rows) — used to vet attaches to books
  // whose own author row is just "Anonymous".
  const entryNames = new Map<number, string[]>(seed.books.map((r) => [r.fsem_entry, seedNames(r)]))

  // RU books by main title, to catch other editions under a variant subtitle.
  const ruBooks = (await pg.query(`select distinct k.id, k.title, k.slug from books k join bans b on b.book_id=k.id where b.country_code='RU'`)).rows as { id: number; title: string; slug: string }[]
  const ruByMain = new Map<string, { id: number; title: string; slug: string }>()
  for (const b of ruBooks) {
    const m = mainTitleSlug(b.title)
    if (m.includes('-')) ruByMain.set(m, b)
  }

  // 1. skip known entries; 2. group by transliterated title slug, split by author.
  let skipped = 0
  const excluded: SeedRow[] = []
  const byTitle = new Map<string, SeedRow[]>()
  const noYear: SeedRow[] = []
  for (const raw of seed.books) {
    if (have.has(raw.fsem_entry)) { skipped++; continue }
    if (EXCLUDE[raw.fsem_entry]) { excluded.push(raw); continue }
    const r = { ...raw, title: cleanTitle(raw.title) }
    const key = slugifyMaybeCyrillic(r.title)
    if (!r.year || !key) { noYear.push(r); continue }
    byTitle.set(key, [...(byTitle.get(key) ?? []), r])
  }
  const groups = new Map<string, SeedRow[]>()
  for (const [key, rows] of byTitle) {
    const subs: SeedRow[][] = []
    for (const r of rows) {
      const sub = subs.find((g) => authorsCompatible(g.flatMap(seedNames), seedNames(r)))
      if (sub) sub.push(r)
      else subs.push([r])
    }
    subs.forEach((g, i) => {
      const surname = nameStems(seedNames(g[0])[0] ?? '').sort((a, b) => b.length - a.length)[0]
      groups.set(i === 0 ? key : `${key}-${slugifyMaybeCyrillic(surname ?? String(g[0].fsem_entry))}`, g)
    })
  }

  type Held = { rows: SeedRow[]; why: string; target?: { id: number; title: string; slug: string } }
  const held: Held[] = noYear.map((r) => ({ rows: [r], why: 'no ban year / no usable title' }))
  const plan: { key: string; rows: SeedRow[]; action: 'create' | 'attach'; bookId?: number; bookTitle?: string }[] = []

  for (const [key, rows] of groups) {
    const r0 = rows[0]
    const resolved = RESOLVED[r0.fsem_entry]
    if (resolved) {
      if (!rows.every((r) => RESOLVED[r.fsem_entry]?.book_id === resolved.book_id)) throw new Error(`RESOLVED: group ${key} mixes targets`)
      const t = (await pg.query(`select title from books where id=$1`, [resolved.book_id])).rows[0]
      if (t?.title !== resolved.expect_title) throw new Error(`RESOLVED #${r0.fsem_entry}: book #${resolved.book_id} title drift ("${t?.title}") — aborting`)
      plan.push({ key, rows, action: 'attach', bookId: resolved.book_id, bookTitle: t.title })
      continue
    }
    const ours = rows.flatMap(seedNames)
    const exact = (await pg.query(
      `select b.id, b.title, b.slug, exists(select 1 from bans x where x.book_id=b.id and x.country_code='RU') has_ru
         from books b where b.slug=$1
       union
       select b.id, b.title, b.slug, exists(select 1 from bans x where x.book_id=b.id and x.country_code='RU')
         from book_slug_aliases a join books b on b.id=a.book_id where a.slug=$1`, [key])).rows[0]
    if (exact) {
      if (!(exact.has_ru && hasCyrillic(exact.title))) {
        held.push({ rows, why: 'exact slug hit on a book without an RU ban', target: exact })
        continue
      }
      const theirs: string[] = (await pg.query(
        `select coalesce(a.name_native, a.display_name) n from book_authors ba join authors a on a.id=ba.author_id where ba.book_id=$1 and a.slug<>'anonymous'`, [exact.id])).rows.map((x: { n: string }) => x.n)
      const descs: string[] = (await pg.query(`select description from bans where book_id=$1 and country_code='RU'`, [exact.id])).rows.map((x: { description: string | null }) => x.description ?? '')
      const theirEntries = descs.flatMap((d) => [...d.matchAll(/#(\d+)/g)].map((m) => Number(m[1])))
      const theirNames = [...theirs, ...theirEntries.flatMap((n) => entryNames.get(n) ?? [])]
      if (authorsCompatible(theirNames, ours)) plan.push({ key, rows, action: 'attach', bookId: exact.id, bookTitle: exact.title })
      else held.push({ rows, why: `same title, different author (theirs: ${[...new Set(theirNames)].join('; ')})`, target: exact })
      continue
    }
    const main = mainTitleSlug(r0.title)
    const edition = main.includes('-') ? ruByMain.get(main) : undefined
    if (edition) {
      held.push({ rows, why: 'same main title as an RU book — likely another edition', target: edition })
      continue
    }
    // Same author already in the catalogue under a Latin name (e.g. Navalny's "Patriot")?
    // The gate's name_english is used here only as a lookup key, never written.
    const engSlugs = [...new Set(rows.flatMap((r) => r.authors.map((x) => slugify(x.name_english ?? ''))).filter((x) => x.includes('-')))]
    const enTitle = slugify(r0.title_english_meaningful ?? '').replace(/^(the|a|an)-/, '')
    const sameAuthor = engSlugs.length && enTitle
      ? ((await pg.query(`select k.id, k.title, k.slug from books k join book_authors ba on ba.book_id=k.id join authors a on a.id=ba.author_id where a.slug = any($1)`, [engSlugs])).rows as { id: number; title: string; slug: string }[])
          .find((k) => {
            const t = slugify(k.title).replace(/^(the|a|an)-/, '')
            return t.length >= 5 && (`-${enTitle}-`.includes(`-${t}-`) || `-${t}-`.includes(`-${enTitle}-`))
          })
      : undefined
    if (sameAuthor) {
      held.push({ rows, why: 'same author already carries a book with this English title', target: sameAuthor })
      continue
    }
    const hit = await matchExistingBook({ title: r0.title, englishTitle: r0.title_english_meaningful })
    if (hit) {
      const t = (await pg.query(`select id, title, slug from books where id=$1`, [hit.id])).rows[0]
      held.push({ rows, why: `matchExistingBook ${hit.status} (confidence ${hit.confidence ?? 'n/a'})`, target: t })
      continue
    }
    plan.push({ key, rows, action: 'create' })
  }

  // Per-year ban sets for each planned group.
  const byYear = (rows: SeedRow[]) => {
    const m = new Map<number, SeedRow[]>()
    for (const r of rows) m.set(r.year as number, [...(m.get(r.year as number) ?? []), r])
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }

  let created = 0
  let bansNew = 0
  let bansOnExisting = 0
  let isbnSet = 0
  const samples: string[] = []

  for (const p of plan) {
    const years = byYear(p.rows)
    const r0 = p.rows[0]
    const reason = reasonOf(`${r0.title} ${r0.raw_description}`)
    if (p.action === 'attach') {
      for (const [year, rows] of years) {
        const dupe = (await pg.query(`select 1 from bans where book_id=$1 and country_code='RU' and year_started=$2 and scope_id=4 limit 1`, [p.bookId, year])).rows[0]
        if (dupe) { skipped += rows.length; continue }
        if (APPLY) {
          await commitNewBanForBook({
            book_id: p.bookId as number, country_code: 'RU', scope_slug: 'government', action_type: 'banned',
            ban_status: 'active', year, reason_slug: reason, description_ban: banDescription(rows),
            source_url: SOURCE_URL, source_name: SOURCE_NAME, source_type: 'government',
          }, pg)
        }
        bansOnExisting++
        if (samples.length < 400) samples.push(`  ATTACH ${rows.map((x) => `#${x.fsem_entry}`).join(',')} "${r0.title}" → book #${p.bookId} "${p.bookTitle}" [${year}]`)
      }
      continue
    }

    const { inputs, labels } = resolveAuthors(r0)
    const translit = hasCyrillic(r0.title) ? transliterateCyrillic(r0.title) : null
    const lang = r0.original_language && r0.original_language.length === 2 ? r0.original_language : hasCyrillic(r0.title) ? 'ru' : null
    if (samples.length < 400) samples.push(`  CREATE ${p.rows.map((x) => `#${x.fsem_entry}`).join(',')} "${r0.title}" [${years.map((y) => y[0]).join(',')}] ${reason} — ${labels.join('; ')}`)
    created++
    bansNew += years.length
    if (!APPLY) continue

    const [firstYear, firstRows] = years[0]
    const res = await commitParsedRow({
      title: r0.title,
      title_native: r0.title,
      title_transliterated: translit,
      title_english_meaningful: r0.title_english_meaningful,
      slug_override: p.key,
      original_language: lang,
      authors: inputs,
      year: firstYear,
      first_published_year: r0.first_published_year,
      country_code: 'RU',
      scope_slug: 'government',
      action_type: 'banned',
      ban_status: 'active',
      reason_slug: reason,
      description_ban: banDescription(firstRows),
      inclusion_rationale:
        `Entry #${r0.fsem_entry} on the Russian Ministry of Justice Federal List of Extremist Materials — ` +
        'declared extremist by a Russian court and banned nationwide; distribution is a criminal offence.',
      source_url: SOURCE_URL,
      source_name: SOURCE_NAME,
      source_type: 'government',
    }, pg)
    if (r0.title_native_script === 'cyrillic' || (translit && r0.title_native_script !== 'latin')) {
      await pg.query(`update books set title_native_script='cyrillic' where id=$1 and title_native_script is null`, [res.book_id])
    }
    const isbn13 = toIsbn13(r0.isbn)
    if (isbn13) {
      const taken = (await pg.query(`select 1 from books where isbn13=$1 limit 1`, [isbn13])).rows[0]
      if (!taken) { await pg.query(`update books set isbn13=$1 where id=$2 and isbn13 is null`, [isbn13, res.book_id]); isbnSet++ }
    }
    for (const [year, rows] of years.slice(1)) {
      await commitNewBanForBook({
        book_id: res.book_id, country_code: 'RU', scope_slug: 'government', action_type: 'banned',
        ban_status: 'active', year, reason_slug: reason, description_ban: banDescription(rows),
        source_url: SOURCE_URL, source_name: SOURCE_NAME, source_type: 'government',
      }, pg)
    }
  }

  // Held list for the editor.
  const md = [`# Russia FSEM — held rows (${DATE})`, '', `${held.length} groups held — NOT imported. Per row: match target or reason.`, '']
  for (const h of held) {
    const r = h.rows[0]
    md.push(`- ${h.rows.map((x) => `#${x.fsem_entry}`).join(', ')} **${r.title}** — ${h.why}${h.target ? ` → book #${h.target.id} "${h.target.title}" (/books/${h.target.slug})` : ''}`)
    md.push(`  - entry: ${r.raw_description.slice(0, 300)}`)
  }
  md.push('', '## Excluded by hand (gate said book, entry text says otherwise)', '')
  for (const r of excluded) md.push(`- #${r.fsem_entry} ${EXCLUDE[r.fsem_entry]}`)
  writeFileSync(HELD_PATH, `${md.join('\n')}\n`)

  console.log(samples.join('\n'))
  if (APPLY) {
    const after = (await pg.query(`select (select count(*) from books)::int books, (select count(*) from bans where country_code='RU')::int ru_bans, (select count(distinct book_id) from bans where country_code='RU')::int ru_books`)).rows[0]
    console.log(`\n  AFTER: books=${after.books} (+${after.books - before.books}) RU bans=${after.ru_bans} (+${after.ru_bans - before.ru_bans}) RU books=${after.ru_books} (+${after.ru_books - before.ru_books})`)
  }
  await pg.end()

  const groupedRows = [...groups.values()].reduce((s, g) => s + g.length, 0)
  console.log(`\n  ── ${APPLY ? 'DONE' : 'DRY-RUN'} ──`)
  console.log(`  seed book rows                       : ${seed.books.length}`)
  console.log(`  skipped (entry already imported)     : ${skipped}`)
  console.log(`  rows grouped into works              : ${groupedRows} → ${groups.size} works`)
  console.log(`  ${APPLY ? 'books created' : 'would-create books'}                 : ${created} (${bansNew} bans)`)
  console.log(`  ${APPLY ? 'bans on existing books' : 'would-attach bans to existing'}        : ${bansOnExisting}`)
  if (APPLY) console.log(`  isbn13 set                           : ${isbnSet}`)
  console.log(`  held (needs_review)                  : ${held.length} groups → ${HELD_PATH}`)
  console.log(`  doubtful (labelled, not imported)    : ${seed.doubtful.length} + ${excluded.length} excluded by hand (${excluded.map((r) => `#${r.fsem_entry}`).join(', ')})`)
  if (!APPLY) console.log('\n  DRY-RUN — nothing written. Re-run with --apply to write.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
