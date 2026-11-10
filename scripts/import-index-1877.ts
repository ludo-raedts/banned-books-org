#!/usr/bin/env tsx
/**
 * Index Librorum Prohibitorum, 1877 edition — import (books only), from the
 * stage-1 file built by scripts/build-index-1877-stage0.ts +
 * scripts/clean-index-1877-llm.ts (data/index-1877/stage1-<date>.json).
 *
 * Thin reader over the shared commit-lib (commitParsedRow / commitNewBanForBook).
 * Only rows the LLM pass labelled book/blanket AND that carry a ban year
 * (decree year, or 1564/1596 for the Tridentine/Clementine Index) are used;
 * dateless rows are held. Per work (same author + same title slug):
 *
 *   SKIP   — curated: the work is already in the DB with a VA ban (mostly the
 *            Wikipedia "List of authors and works on the Index" batch under an
 *            English title). No second VA ban; year conflicts are reported.
 *   ATTACH — curated: same work in the DB without a VA ban → VA ban on it.
 *   HOLD   — exact slug / alias hit that is not curated; author slug that
 *            belongs to an existing author who is not plausibly historical
 *            (modern namesake: "Laurent", "J. Thomas"); one-word low-confidence
 *            names. Written to the held list, never imported.
 *   CREATE — everything else → commitParsedRow (+ extra bans per extra year).
 *
 * The match-before-create tier ran once over all rows in
 * scripts/_audit_index_1877_overlap.ts (matchExistingBook on 4,054 titles,
 * ~13 min) and was reviewed by hand into CURATED below; the importer re-checks
 * exact slug + alias at run time so nothing new slips through.
 *
 * Blanket rows ("1. Cl." first class / opera omnia) become one
 * "<Author> — All works" book per author with is_blanket_works = true, like
 * the existing VA and Liste Otto rows; skipped when the author already has a
 * blanket book.
 *
 *   npx tsx --env-file=.env.local scripts/import-index-1877.ts            # dry-run
 *   npx tsx --env-file=.env.local scripts/import-index-1877.ts --apply
 *
 * Second pass over held rows (2026-11-10): scripts/patch-index-1877-held.ts writes a
 * patched stage-1 + seq list; run with --date=2026-11-10 --only-seqs=<that list>.
 * Only those seqs are planned, and the report lists every planned work.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { commitNewBanForBook, commitParsedRow } from '../src/lib/imports/review-commit'
import { canonicaliseAuthorName } from '../src/lib/imports/canonicalise-author-name'
import { slugify } from '../src/lib/imports/slugify'
import { flagValue, isApply } from './lib/cli'
import { INDEX_1877_SOURCE_NAME, INDEX_1877_SOURCE_URL } from './build-index-1877-stage0'

const APPLY = isApply()
const DATE = flagValue('date') ?? '2026-11-09'
const IN = `data/index-1877/stage1-${DATE}.json`
const REPORT = `data/index-1877/import-plan-${DATE}.md`
const ONLY_FILE = flagValue('only-seqs')
const ONLY: Set<number> | null = ONLY_FILE ? new Set(JSON.parse(readFileSync(ONLY_FILE, 'utf8')) as number[]) : null
const ANONYMOUS = 'Anonymous'
// Existing authors without birth_year/VA ban checked by hand as the same person.
const ALLOW_EXISTING_AUTHOR_IDS = new Set([11720 /* François Rabelais */])
const INCLUSION =
  'Listed in the Index Librorum Prohibitorum (Rome, 1877 edition, complete to 1876), the Catholic Church’s ' +
  'official catalogue of books Catholics were forbidden to read, print or keep. The Index was abolished in 1966.'

// Hand-reviewed results of _audit_index_1877_overlap.ts (title matcher + author pass).
const CURATED: Record<number, { action: 'skip' | 'attach' | 'hold' | 'new'; book_id?: number; note: string }> = {
  120: { action: 'skip', book_id: 841, note: 'Dante, De monarchia' },
  539: { action: 'skip', book_id: 6681, note: 'Bentham, Deontology' },
  667: { action: 'skip', book_id: 93, note: 'Decameron (VA 1559 Pauline Index; 1877 lists Ind. Trid.)' },
  1408: { action: 'skip', book_id: 6562, note: 'Comte' },
  1635: { action: 'skip', book_id: 6640, note: 'Zoonomia (Italian translation)' },
  1686: { action: 'skip', book_id: 6233, note: 'Meditationes, 1722 edition with animadversiones' },
  1731: { action: 'skip', book_id: 921, note: 'Dictionnaire philosophique' },
  1736: { action: 'skip', book_id: 6572, note: 'Jacques le fataliste' },
  1861: { action: 'skip', book_id: 6584, note: 'Draper (Spanish translation)' },
  1966: { action: 'skip', book_id: 6563, note: 'Encyclopédie' },
  2072: { action: 'skip', book_id: 6547, note: "De l'esprit des lois" },
  2335: { action: 'skip', book_id: 6689, note: 'La Fontaine, Contes' },
  2681: { action: 'skip', book_id: 6573, note: 'Grotius, De imperio' },
  2682: { action: 'skip', book_id: 6580, note: 'Grotius, Annales' },
  2840: { action: 'skip', book_id: 6591, note: "Helvétius, De l'homme (OCR headword 'Hecverits')" },
  2964: { action: 'skip', book_id: 655, note: 'Hobbes, Leviathan (Latin)' },
  3032: { action: 'skip', book_id: 6542, note: 'Notre-Dame de Paris' },
  3312: { action: 'skip', book_id: 6613, note: 'Kollar' },
  3401: { action: 'skip', book_id: 6577, note: 'Larousse' },
  3596: { action: 'skip', book_id: 6544, note: 'Lettres persanes' },
  3863: { action: 'skip', book_id: 6676, note: 'Malebranche, Traité de morale' },
  4176: { action: 'skip', book_id: 6682, note: 'Milton, Literae pseudo-senatus' },
  4177: { action: 'skip', book_id: 6687, note: 'Paradise Lost (Rolli translation)' },
  4433: { action: 'skip', book_id: 6608, note: 'Nouvelle Héloïse' },
  5447: { action: 'skip', book_id: 658, note: 'Émile' },
  5961: { action: 'skip', book_id: 6659, note: 'Spinoza, Opera posthuma' },
  6056: { action: 'skip', book_id: 6537, note: 'Mill' },
  6096: { action: 'skip', book_id: 6526, note: 'Swedenborg, Principia' },
  6166: { action: 'skip', book_id: 6558, note: 'Conciliatorium biblicum' },
  6553: { action: 'skip', book_id: 6557, note: 'Lettres philosophiques' },
  6559: { action: 'skip', book_id: 6552, note: 'Traité sur la tolérance' },
  2301: { action: 'attach', book_id: 59, note: 'Madame Bovary (entry "Madame Bovary-Salammbò"; Salammbô #6570 already VA)' },
  4205: { action: 'attach', book_id: 7382, note: 'Toussaint, Les Mœurs (published anonymously)' },
  6260: { action: 'skip', book_id: 840, note: 'Spinoza, Tractatus theologico-politicus' },
  460: { action: 'new', note: 'Bas, L\'Allemagne — not Vermeil\'s L\'Allemagne (#15268); author-suffixed slug' },
  4330: { action: 'hold', note: '"Leviathan, vulgo dictus Geltnar oder Gensz prediger" — LLM said Hobbes; not his work' },
}

type Llm = { class: string; author: string | null; author_confidence: 'high' | 'low' | null; title: string | null; decree_year: number | null; language: string | null }
type Row = { seq: number; raw: string; headword: string; year: number | null; year_basis: string | null; action_type: 'banned' | 'restricted'; llm: Llm | null; author_guard: string | null }
type Work = { key: string; kind: 'book' | 'blanket'; author: string | null; title: string; rows: Row[] }

const isDash = (r: Row) => /^[—–]/.test(r.raw)

// The Index prints given names as Latin abbreviations ("Ioan.", "Hieron.").
// Uncertain (low-confidence) names keep the printed form, so spell those out.
const LATIN_GIVEN: Record<string, string> = {
  io: 'Ioannes', ioan: 'Ioannes', ioann: 'Ioannes', ioh: 'Iohannes', joan: 'Joannes', petr: 'Petrus', franc: 'Franciscus',
  guil: 'Guilelmus', guilielm: 'Guilielmus', hieron: 'Hieronymus', hier: 'Hieronymus', iac: 'Iacobus', iaco: 'Iacobus',
  iacob: 'Iacobus', ios: 'Iosephus', ioseph: 'Iosephus', henr: 'Henricus', nic: 'Nicolaus', nicol: 'Nicolaus',
  ant: 'Antonius', andr: 'Andreas', bern: 'Bernardus', bernard: 'Bernardus', christoph: 'Christophorus',
  conrad: 'Conradus', dan: 'Daniel', frid: 'Fridericus', fried: 'Fridericus', georg: 'Georgius', greg: 'Gregorius',
  laur: 'Laurentius', ludov: 'Ludovicus', mich: 'Michael', paul: 'Paulus', phil: 'Philippus', sebast: 'Sebastianus',
  steph: 'Stephanus', thom: 'Thomas', vinc: 'Vincentius', bened: 'Benedictus', bapt: 'Baptista', carol: 'Carolus',
  gabr: 'Gabriel', iul: 'Iulius', mart: 'Martinus', rob: 'Robertus', valent: 'Valentinus', wolfg: 'Wolfgangus',
  gio: 'Giovanni', giac: 'Giacomo', gius: 'Giuseppe', alex: 'Alexander', alph: 'Alphonsus', aug: 'Augustinus',
  casp: 'Casparus', ernest: 'Ernestus', gottfr: 'Gottfridus', ignat: 'Ignatius', leonh: 'Leonhardus', melch: 'Melchior',
  sigism: 'Sigismundus', theod: 'Theodorus', ulr: 'Ulricus', ulric: 'Ulricus', zach: 'Zacharias', barth: 'Bartholomaeus',
}
const expandGiven = (name: string) =>
  name.replace(/\b([A-Za-z]+)\.(?=\s)/g, (m, w: string) => LATIN_GIVEN[w.toLowerCase()] ?? m)
// Plausible ban years for this source: Pauline/Tridentine era to the 1877 edition.
const plausibleYear = (y: number | null) => y != null && y >= 1500 && y <= 1877

function banDescription(r: Row): string {
  const until = r.action_type === 'restricted' ? ' until corrected (donec corrigatur)' : ''
  if (r.year_basis === 'index_trid_1564') return `Listed in the Tridentine Index (1564)${until}; still listed in the 1877 edition of the Index Librorum Prohibitorum.`
  if (r.year_basis === 'index_clem_1596') return `Listed in the Index of Clement VIII (1596)${until}; still listed in the 1877 edition of the Index Librorum Prohibitorum.`
  return `Prohibited${until} by a decree of ${r.year}, as recorded in the Index Librorum Prohibitorum (Rome, 1877 edition).`
}

function slugBase(title: string): string {
  const s = slugify(title)
  if (s.length <= 80) return s
  const cut = s.slice(0, 80)
  return cut.slice(0, cut.lastIndexOf('-') > 40 ? cut.lastIndexOf('-') : 80)
}

async function main() {
  const rows: Row[] = JSON.parse(readFileSync(IN, 'utf8'))
  const pg = newPgClient()
  await pg.connect()
  // Dry-run inside one READ ONLY transaction. Never a session-level SET: the
  // Supabase pooler hands the server connection to other clients afterwards
  // (a leaked default_transaction_read_only broke the next --apply).
  if (!APPLY) await pg.query('begin read only')

  // Sub-entries ("— …") take the author of their head entry, so one Index
  // author does not split into several spellings across the LLM batches.
  let head: Row | null = null
  const authorOf = new Map<number, { name: string | null; conf: string | null }>()
  for (const r of rows) {
    if (!isDash(r)) head = r
    const src = isDash(r) && head?.llm ? head : r
    const conf = src.llm?.author_confidence ?? null
    const name = src.llm?.author ?? null
    authorOf.set(r.seq, { name: name && conf !== 'high' ? expandGiven(name) : name, conf })
  }

  const usable = rows.filter(r => r.llm && (r.llm.class === 'book' || r.llm.class === 'blanket') && (!ONLY || ONLY.has(r.seq)))
  const noYear = usable.filter(r => !plausibleYear(r.year))
  const dated = usable.filter(r => plausibleYear(r.year))

  // --- authors: resolve against existing rows --------------------------------
  const names = [...new Set(dated.map(r => authorOf.get(r.seq)!.name).filter(Boolean))] as string[]
  const slugs = [...new Set(names.map(n => slugify(canonicaliseAuthorName(n))))]
  const existing = new Map<string, { id: number; display_name: string; birth_year: number | null; has_va: boolean; has_blanket: boolean }>()
  for (const row of (await pg.query(
    `select a.id, a.slug, a.display_name, a.birth_year,
            exists(select 1 from book_authors ba join bans b on b.book_id=ba.book_id where ba.author_id=a.id and b.country_code='VA') has_va,
            exists(select 1 from book_authors ba join books k on k.id=ba.book_id where ba.author_id=a.id and k.is_blanket_works) has_blanket
       from authors a where a.slug = any($1)`, [slugs])).rows) existing.set(row.slug, row)

  type AuthorVerdict = { ok: true; display: string; reuse: boolean } | { ok: false; why: string }
  const verdict = new Map<string, AuthorVerdict>()
  const authorVerdict = (name: string | null, conf: string | null): AuthorVerdict => {
    if (!name) return { ok: true, display: ANONYMOUS, reuse: true }
    const key = `${name}|${conf}`
    if (verdict.has(key)) return verdict.get(key)!
    const display = canonicaliseAuthorName(name)
    const slug = slugify(display)
    const ex = existing.get(slug)
    let v: AuthorVerdict
    if (!slug) v = { ok: false, why: `author name "${name}" has no slug` }
    else if (ex) {
      const historical = ex.has_va || (ex.birth_year != null && ex.birth_year < 1860) || ALLOW_EXISTING_AUTHOR_IDS.has(Number(ex.id))
      v = historical ? { ok: true, display, reuse: true } : { ok: false, why: `author slug "${slug}" belongs to existing author #${ex.id} ${ex.display_name} (born ${ex.birth_year ?? '?'}) — namesake risk` }
    } else if (!/\s/.test(display.trim()) && conf !== 'high') v = { ok: false, why: `one-word uncertain author name "${display}"` }
    else v = { ok: true, display, reuse: false }
    verdict.set(key, v)
    return v
  }

  // --- group rows into works ---------------------------------------------------
  const works = new Map<string, Work>()
  const held: { rows: Row[]; why: string }[] = noYear.map(r => ({ rows: [r], why: 'no ban year in the entry' }))  // incl. OCR years outside 1500–1877
  const skipped: { r: Row; note: string; book_id: number }[] = []
  const attach: { r: Row; book_id: number; note: string }[] = []
  for (const r of dated) {
    const c = CURATED[r.seq]
    if (c?.action === 'skip') { skipped.push({ r, note: c.note, book_id: c.book_id! }); continue }
    if (c?.action === 'attach') { attach.push({ r, book_id: c.book_id!, note: c.note }); continue }
    if (c?.action === 'hold') { held.push({ rows: [r], why: c.note }); continue }
    const a = authorOf.get(r.seq)!
    const v = authorVerdict(a.name, a.conf)
    if (!v.ok) { held.push({ rows: [r], why: v.why }); continue }
    if (r.llm!.class === 'blanket') {
      if (v.display === ANONYMOUS) { held.push({ rows: [r], why: 'blanket entry without author' }); continue }
      const key = `blanket|${slugify(v.display)}`
      const w = works.get(key) ?? { key, kind: 'blanket' as const, author: v.display, title: `${v.display} — All works`, rows: [] }
      w.rows.push(r)
      works.set(key, w)
      continue
    }
    const title = r.llm!.title?.trim()
    if (!title || !slugify(title)) { held.push({ rows: [r], why: 'no usable title' }); continue }
    // Anonymous same-title entries with different decrees are usually different works.
    const key = `book|${slugify(v.display)}|${slugBase(title)}${v.display === ANONYMOUS ? `|${r.year}` : ''}`
    const w = works.get(key) ?? { key, kind: 'book' as const, author: v.display, title, rows: [] }
    w.rows.push(r)
    works.set(key, w)
  }

  // Blanket: skip authors that already carry a blanket book.
  for (const [k, w] of works) {
    if (w.kind !== 'blanket') continue
    const ex = existing.get(slugify(w.author!))
    if (ex?.has_blanket) { works.delete(k); for (const r of w.rows) skipped.push({ r, note: `author #${ex.id} already has a blanket book`, book_id: 0 }) }
  }

  // --- slugs: exact/alias hits → hold; else unique slug ------------------------
  const allBase = [...works.values()].map(w => slugBase(w.title))
  const taken = new Set<string>(
    (await pg.query(
      `select slug from books where slug = any($1) union select slug from book_slug_aliases where slug = any($1)`,
      [allBase],
    )).rows.map((x: { slug: string }) => x.slug),
  )
  // Resume support: books this importer already created (a ban linked to the
  // 1877 source) are recognised by slug candidate + author, and only get their
  // (idempotent) bans / blanket flag re-applied — never a second book.
  const mine = new Map<string, { id: number; authors: Set<string>; years: Set<number> }>()
  for (const x of (await pg.query(
    `select k.id, k.slug, array_agg(distinct a.slug) authors, array_agg(distinct b.year_started) years
       from ban_sources s join ban_source_links l on l.source_id=s.id join bans b on b.id=l.ban_id
       join books k on k.id=b.book_id left join book_authors ba on ba.book_id=k.id left join authors a on a.id=ba.author_id
      where s.source_url=$1 group by k.id, k.slug`, [INDEX_1877_SOURCE_URL])).rows)
    mine.set(x.slug, { id: Number(x.id), authors: new Set(x.authors), years: new Set(x.years.map(Number)) })

  const plan: (Work & { slug: string; years: [number, Row[]][]; resumeId?: number })[] = []
  const used = new Set<string>()
  for (const w of works.values()) {
    const base = slugBase(w.title)
    const forceNew = w.rows.some(r => CURATED[r.seq]?.action === 'new')
    {
      const yrs = [...new Set(w.rows.map(r => r.year!))].sort((a, b) => a - b)
      const ap = w.author && w.author !== ANONYMOUS ? slugify(w.author.split(/\s+/).pop()!) : ''
      const aSlug = slugify(canonicaliseAuthorName(w.author ?? ANONYMOUS))
      const prior = [base, `${base}-${ap}`, `${base}-${ap}-${yrs[0]}`, `${base}-${yrs[0]}-${w.rows[0].seq}`]
        .map(c => [c, mine.get(c)] as const)
        .find(([c, m]) => m && !used.has(c) && m.authors.has(aSlug) && (w.author !== ANONYMOUS || yrs.some(y => m.years.has(y))))
      if (prior) {
        used.add(prior[0])
        const years = [...w.rows.reduce((m, r) => m.set(r.year!, [...(m.get(r.year!) ?? []), r]), new Map<number, Row[]>())].sort((a, b) => a[0] - b[0])
        plan.push({ ...w, slug: prior[0], years, resumeId: prior[1]!.id })
        continue
      }
    }
    if (w.kind === 'book' && taken.has(base) && !forceNew) {
      const t = (await pg.query(`select id, title from books where slug=$1 union select b.id, b.title from book_slug_aliases a join books b on b.id=a.book_id where a.slug=$1`, [base])).rows[0]
      held.push({ rows: w.rows, why: `exact slug/alias hit on #${t?.id} "${t?.title}" — not curated` })
      continue
    }
    if (w.kind === 'blanket' && taken.has(base)) {
      for (const r of w.rows) skipped.push({ r, note: `blanket book "${w.title}" already exists`, book_id: 0 })
      continue
    }
    const years = [...w.rows.reduce((m, r) => m.set(r.year!, [...(m.get(r.year!) ?? []), r]), new Map<number, Row[]>())].sort((a, b) => a[0] - b[0])
    const authorPart = w.author && w.author !== ANONYMOUS ? slugify(w.author.split(/\s+/).pop()!) : ''
    // A one- or two-word title ("Opere", "Miscellanea") never gets the bare slug.
    const generic = base.split('-').length <= 2 && !!authorPart
    let slug = base
    for (const cand of [generic || forceNew ? '' : base, `${base}-${authorPart}`, `${base}-${authorPart}-${years[0][0]}`, `${base}-${years[0][0]}-${w.rows[0].seq}`]) {
      if (cand && !cand.endsWith('-') && !used.has(cand) && !taken.has(cand)) { slug = cand; break }
    }
    if (used.has(slug) || (slug !== base && taken.has(slug))) throw new Error(`slug collision ${slug}`)
    if (slug !== base) {
      const hit = (await pg.query(`select 1 from books where slug=$1 union select 1 from book_slug_aliases where slug=$1`, [slug])).rows[0]
      if (hit) throw new Error(`disambiguated slug ${slug} exists`)
    }
    used.add(slug)
    plan.push({ ...w, slug, years })
  }

  // --- report --------------------------------------------------------------------
  const resumed = plan.filter(p => p.resumeId)
  const books = plan.filter(p => p.kind === 'book' && !p.resumeId)
  const blankets = plan.filter(p => p.kind === 'blanket' && !p.resumeId)
  const newAuthors = new Set(plan.map(p => p.author).filter(a => a && a !== ANONYMOUS && !existing.has(slugify(a!))))
  const reusedAuthors = new Set(plan.map(p => p.author).filter(a => a && existing.has(slugify(a!))))
  const heldWhy = new Map<string, number>()
  for (const h of held) { const k = h.why.replace(/".*?"|#\d+.*$/g, '…'); heldWhy.set(k, (heldWhy.get(k) ?? 0) + h.rows.length) }

  const before = (await pg.query(`select (select count(*) from books)::int books, (select count(*) from authors)::int authors, (select count(*) from bans where country_code='VA')::int va_bans, (select count(distinct book_id) from bans where country_code='VA')::int va_books`)).rows[0]
  const md: string[] = [
    `# Index 1877 import plan (${DATE}) — ${APPLY ? 'APPLY' : 'DRY-RUN'}`, '',
    `- create books: ${books.length} (${books.reduce((s, p) => s + p.years.length, 0)} VA bans; ${books.filter(p => p.author === ANONYMOUS).length} anonymous)`,
    `- create blanket "— All works" books: ${blankets.length}`,
    `- already imported by an earlier (interrupted) run — bans re-checked: ${resumed.length}`,
    `- attach VA ban to existing book: ${attach.length}`,
    `- skip (already VA in DB / blanket exists): ${skipped.length} rows`,
    `- held: ${held.reduce((s, h) => s + h.rows.length, 0)} rows`,
    ...[...heldWhy].sort((a, b) => b[1] - a[1]).map(([k, n]) => `  - ${k}: ${n}`),
    `- new authors: ${newAuthors.size}; existing authors reused: ${reusedAuthors.size} (${[...reusedAuthors].join(', ')})`,
    '', '## Attach', ...attach.map(a => `- seq ${a.r.seq} → #${a.book_id} [VA ${a.r.year}] ${a.note}`),
    '', '## Skip (year conflicts marked ⚠)',
  ]
  for (const s of skipped.filter(s => s.book_id)) {
    const va = (await pg.query(`select year_started from bans where book_id=$1 and country_code='VA'`, [s.book_id])).rows.map((x: { year_started: number }) => x.year_started)
    md.push(`- ${va.includes(s.r.year!) ? '' : '⚠ '}seq ${s.r.seq} → #${s.book_id} ${s.note}: VA ${va.join('/') || '—'} vs 1877 ${s.r.year} (${s.r.year_basis})`)
  }
  md.push('', ONLY ? '## Create (all)' : '## Create — every 15th work', ...plan.filter((_, i) => ONLY || i % 15 === 0).map(p =>
    `- [${p.kind}]${p.resumeId ? ` RESUME #${p.resumeId}` : ''} /books/${p.slug} "${p.title}" — ${p.author} — VA ${p.years.map(y => y[0]).join(',')}${p.rows.some(r => r.action_type === 'restricted') ? ' (restricted)' : ''} · seq ${p.rows.map(r => r.seq).join(',')}`))
  md.push('', '## Held (not imported)', ...held.filter(h => h.why !== 'no ban year in the entry').map(h => `- seq ${h.rows.map(r => r.seq).join(',')} "${h.rows[0].llm?.title ?? ''}" — ${h.why}`))
  md.push('', '## Held: no ban year', ...held.filter(h => h.why === 'no ban year in the entry').map(h => `- seq ${h.rows[0].seq} ${authorOf.get(h.rows[0].seq)?.name ?? 'anon'} — "${h.rows[0].llm?.title ?? ''}"`))
  writeFileSync(REPORT, md.join('\n') + '\n')
  console.log(md.slice(0, 12).join('\n'))
  console.log(`BEFORE: books=${before.books} authors=${before.authors} VA bans=${before.va_bans} VA books=${before.va_books}`)
  console.log(`→ ${REPORT}`)

  if (!APPLY) { await pg.query('rollback'); await pg.end(); console.log('\nDRY-RUN — nothing written. Re-run with --apply.'); return }

  // --- apply -----------------------------------------------------------------------
  const common = { country_code: 'VA', scope_slug: 'government', ban_status: 'historical' as const, reason_slug: 'religious', source_url: INDEX_1877_SOURCE_URL, source_name: INDEX_1877_SOURCE_NAME, source_type: 'government' }
  for (const a of attach) {
    await commitNewBanForBook({ ...common, book_id: a.book_id, action_type: a.r.action_type, year: a.r.year!, description_ban: banDescription(a.r) }, pg)
  }
  let done = 0
  for (const p of plan) {
    if (p.resumeId) {
      if (p.kind === 'blanket') await pg.query(`update books set is_blanket_works = true where id = $1 and not is_blanket_works`, [p.resumeId])
      for (const [, rs] of p.years) {
        await commitNewBanForBook({ ...common, book_id: p.resumeId, action_type: rs[0].action_type, year: rs[0].year!, description_ban: banDescription(rs[0]) }, pg)
      }
      if (++done % 250 === 0) console.log(`  ${done}/${plan.length}`)
      continue
    }
    const [y0, rows0] = p.years[0]
    const lang = p.rows[0].llm?.language
    const res = await commitParsedRow({
      ...common,
      title: p.title,
      slug_override: p.slug,
      original_language: p.kind === 'book' && lang && /^[a-z]{2}$/.test(lang) ? lang : null,
      authors: [p.author ?? ANONYMOUS],
      year: y0,
      action_type: rows0[0].action_type,
      description_ban: banDescription(rows0[0]),
      inclusion_rationale: INCLUSION,
    }, pg)
    if (p.kind === 'blanket') await pg.query(`update books set is_blanket_works = true where id = $1`, [res.book_id])
    for (const [, rs] of p.years.slice(1)) {
      await commitNewBanForBook({ ...common, book_id: res.book_id, action_type: rs[0].action_type, year: rs[0].year!, description_ban: banDescription(rs[0]) }, pg)
    }
    if (++done % 250 === 0) console.log(`  ${done}/${plan.length}`)
  }
  const after = (await pg.query(`select (select count(*) from books)::int books, (select count(*) from authors)::int authors, (select count(*) from bans where country_code='VA')::int va_bans, (select count(distinct book_id) from bans where country_code='VA')::int va_books`)).rows[0]
  console.log(`AFTER: books=${after.books} (+${after.books - before.books}) authors=${after.authors} (+${after.authors - before.authors}) VA bans=${after.va_bans} (+${after.va_bans - before.va_bans}) VA books=${after.va_books} (+${after.va_books - before.va_books})`)
  await pg.end()
}

main().catch(e => { console.error(e); process.exit(1) })
