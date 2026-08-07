#!/usr/bin/env tsx
// READ-ONLY standing audit: suspiciously truncated / generic book titles.
// Writes a review worklist; never touches the DB.
//
// Why this exists (2026-08-07, found via /news linkify work):
//   - #13397 "On the" — PEN Belarus importer cut the title at a nested quote;
//     the raw source reads «On the "border of civilizations". Pages of the
//     history of the pre-war Soviet-Polish cordon in Belarus» (Minsk, 2020).
//   - #18491 "The Event" — PEN America keeps the series in a separate CSV
//     column; the importer dropped it, leaving a generic fragment of
//     "Black Hammer, Vol. 2: The Event" (Lemire).
//   - #10449 "Times" / #11465 "Time" / #10970 "Novel" / #11165 "Stories" —
//     KDN-Malaysia gazette rows that are PERIODICALS (publisher "TIME INC,
//     ISSUE DATED 5 NOV 1973", "NOVEL MAGAZINE", "STORIES MONTHLY PRESS"),
//     out of scope (books only) AND magnets for title-search contamination
//     (all four carried a wrong ISBN / OL work id / description).
//   - The KDN source itself contains hard-truncated gazette titles
//     ("BEATING UP GONGS & DRUMS, AND SING"), and the Berlin-1938 list carries
//     the "… Frankfurt a" class (cut at "Frankfurt a. M."), so this class
//     regrows with every fixed-width-source import.
//
// Buckets (→ data/truncated-titles-audit.md):
//   TRUNCATED  — title ends in a word that cannot end a complete title
//                ("On the", "…und", "Frankfurt a") or in dangling punctuation
//                (",", ":", "&", "-"). Articles/conjunctions ("the", "and",
//                "und", …) flag regardless of enrichment; other function words
//                ("of", "on", "to", …) only flag when NOTHING corroborates the
//                title as complete (no ISBN, no OL work id, no description) —
//                English titles legitimately end in particles ("Carry On",
//                "Dare You To", "What Girls Are Made Of").
//                Recover the real title from the ban source before fixing
//                (never guess). CJK-original books are exempt: pinyin/Jyutping
//                romanisation collides with the function-word list ("…ji xiao
//                ji dan", "Bian zhe an").
//   ELLIPSIS   — uncorroborated title ending in "…". Review-only: many
//                sources carry faithful ellipsis titles ("Degrelle m'a
//                dit..."), but importer cuts hide here too ("Moscow News...").
//   INVERTED   — librarian-style trailing article ("Week, The"). Complete
//                titles, wrong form; mechanical de-inversion candidates.
//   PERIODICAL — a ban description names a periodical publisher/printer
//                ("Publisher: … MAGAZINE", "Printer: ISSUE DATED …") or the
//                title itself is issue-shaped ("Hustle Volume 15 Number 8").
//                Scope is books-only → confirmed rows get deleted, precedent:
//                scripts/archive/delete-kdn-periodicals.ts.
//   GENERIC    — single-word title with NO corroborating identity (no ISBN,
//                no OL work id, no description). Review-only: many one-word
//                titles are real books ("Speak", "America", "Court"), so a
//                corroborated one-worder is NOT reported.
//
// Verification doctrine for hits: check the row against its ban source (the
// import JSON in data/ and/or source_url) and its ISBN/OL id before touching
// anything. Wrong rows are fixed/deleted by a guarded one-off (template:
// scripts/archive/fix-impossible-years-2026-07-01.ts); title changes must
// insert a book_slug_aliases row for the old slug.
//
//   pnpm tsx --env-file=.env.local scripts/_audit_truncated_titles.ts

import { writeFileSync } from 'fs'
import { adminClient } from '../src/lib/supabase'

type Book = {
  id: number
  title: string
  slug: string
  isbn13: string | null
  openlibrary_work_id: string | null
  first_published_year: number | null
  original_language: string | null
  description_book: string | null
  is_blanket_works: boolean
}

type Ban = { book_id: number; description: string | null }

const PAGE = 1000

// Words that can NEVER end a complete title, corroborated or not.
// 'an' is deliberately absent: German separable verbs end complete titles on
// it ("Die Nation greift an") and Berlin-1938 rows carry original_language
// NULL, so a language gate can't save us.
const NEVER_ENDS = new Set(['the', 'and', 'or', 'und', 'oder', 'et', 'og', 'och'])

// Function words that only end a complete title in idiomatic exceptions
// (phrasal particles etc.) — flag only when the row has zero corroborating
// identity. EN + the import languages we carry (DE/FR/ES/PT/NL/MS).
const DANGLING = new Set([
  // English
  'a', 'of', 'on', 'in', 'at', 'to', 'for', 'with', 'from', 'by', 'into',
  'onto', 'upon', 'their', 'his', 'her', 'its', 'your', 'my',
  // German
  'der', 'die', 'das', 'des', 'dem', 'den', 'ein', 'eine', 'einer', 'im', 'am',
  // French
  'le', 'la', 'les', 'du', 'au', 'aux', 'dans', 'sur', 'une',
  // Spanish / Portuguese
  // ('um' is absent: German "Kehr' um" collides.)
  'el', 'los', 'las', 'una', 'uno', 'e', 'y', 'em', 'no', 'na', 'dos', 'das',
  'uma', 'para', 'entre',
  // Dutch — only the unambiguous articles; 'van'/'over'/'met' collide with
  // English ("…is not over") and surnames.
  'het', 'een',
  // Malay/Indonesian (KDN imports)
  'dan', 'di', 'ke', 'yang', 'dalam', 'untuk',
])

// Romanised CJK collides with the function-word lists ("…ji xiao ji dan",
// "Wo tui xiu shi bai le", "Bian zhe an") — exempt from the dangling check.
const CJK_LANGS = new Set(['zh', 'ja', 'ko'])

// German separable-verb prefixes legitimately end complete titles ("Die
// Nation greift an", "Kehr' um") — exempt for original_language='de'.
const DE_SEPARABLE = new Set(['an', 'um', 'auf', 'aus', 'zu', 'mit', 'nach', 'vor', 'bei'])

// Periodical markers, only trusted inside a publisher/printer clause of a ban
// description (KDN import format: "Publisher: X. Printer: Y."). A bare
// narrative "magazine" (Ulysses was serialised in a magazine) does NOT count.
const PUBLISHER_CLAUSE_RE =
  /(publisher|printer|penerbit|pencetak):[^.]*?\b(magazine|newspaper|akhbar|majalah|monthly press|weekly press|daily press|issue dated|journal|gazette)\b/i
// Issue-shaped titles are a periodical signal on their own.
const ISSUE_TITLE_RE =
  /\b(magazine|majalah|akhbar|newspaper)\b|\bvol(ume)?\.?\s*[IVXL0-9]+\b.*\b(no|number)\b|\bno\.?\s*\d+\s*$/i

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const db = adminClient()
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data || data.length === 0) break
    out.push(...(data as unknown as T[]))
    if (data.length < PAGE) break
  }
  return out
}

function lastToken(title: string): string {
  // Strip bracketing quote/paren characters but keep word-internal
  // apostrophes ("Qur'an" must not split into …-'an').
  const tokens = title
    .toLowerCase()
    .replace(/[“”"«»()[\]]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^['’]+|['’]+$/g, ''))
    .filter(Boolean)
  return tokens[tokens.length - 1] ?? ''
}

const corroborated = (b: Book) =>
  Boolean(b.isbn13 || b.openlibrary_work_id || b.description_book)

const INVERTED_RE =
  /[,?!.]\s*(the|an?|la|le|les|der|die|das|el|los|las|o|os|as|de|het)[\s.…]*$/i

function classify(books: Book[], bansByBook: Map<number, string[]>) {
  const truncated: Book[] = []
  const ellipsis: Book[] = []
  const inverted: Book[] = []
  const periodical: { book: Book; hint: string }[] = []
  const generic: Book[] = []
  let corroboratedDangles = 0

  for (const b of books) {
    if (b.is_blanket_works) continue // pseudo-books, not real titles by design
    const title = (b.title ?? '').trim()
    if (!title) continue

    // PERIODICAL first: out-of-scope media trumps title-shape concerns.
    const banDescs = bansByBook.get(b.id) ?? []
    const clauseHit = banDescs
      .map((d) => d.match(PUBLISHER_CLAUSE_RE))
      .find(Boolean)
    const titleHit = ISSUE_TITLE_RE.test(title)
    if (clauseHit || titleHit) {
      periodical.push({ book: b, hint: clauseHit ? clauseHit[2] : 'issue-shaped title' })
      continue
    }

    // INVERTED: "Week, The" / "Classe Operária Irá Desaparecer? A".
    if (INVERTED_RE.test(title)) {
      inverted.push(b)
      continue
    }

    // Tail analysis on the title minus any trailing ellipsis.
    const core = title.replace(/(\.{3,}|…)[\s.]*$/, '').trim()
    const hadEllipsis = core !== title
    const tail = lastToken(core)
    // Exemptions: romanised CJK collides wholesale; German separable-verb
    // endings ("greift an", "Kehr' um") are complete titles.
    const tailChecked =
      !CJK_LANGS.has(b.original_language ?? '') &&
      !(b.original_language === 'de' && DE_SEPARABLE.has(tail))

    if (tailChecked && NEVER_ENDS.has(tail)) {
      truncated.push(b)
      continue
    }
    if (tailChecked && (DANGLING.has(tail) || /[,;:&–—-]$/.test(core))) {
      if (corroborated(b)) corroboratedDangles++
      else truncated.push(b)
      continue
    }
    if (hadEllipsis && !corroborated(b)) {
      ellipsis.push(b)
      continue
    }

    // GENERIC: one-word title with zero corroborating identity.
    const words = title.split(/\s+/).filter(Boolean)
    if (words.length === 1 && !/\d/.test(title) && !corroborated(b)) {
      generic.push(b)
    }
  }

  return { truncated, ellipsis, inverted, periodical, generic, corroboratedDangles }
}

function fmt(b: Book): string {
  return (
    `- **#${b.id}** \`${b.slug}\` — “${b.title}”` +
    ` (isbn=${b.isbn13 ?? '∅'}, ol=${b.openlibrary_work_id ?? '∅'},` +
    ` pub=${b.first_published_year ?? '∅'}, desc=${b.description_book ? 'yes' : '∅'})`
  )
}

async function main() {
  const books = await fetchAll<Book>(
    'books',
    'id, title, slug, isbn13, openlibrary_work_id, first_published_year, original_language, description_book, is_blanket_works',
  )
  const bans = await fetchAll<Ban>('bans', 'id, book_id, description')
  const bansByBook = new Map<number, string[]>()
  for (const ban of bans) {
    if (!ban.description) continue
    const arr = bansByBook.get(ban.book_id) ?? []
    arr.push(ban.description)
    bansByBook.set(ban.book_id, arr)
  }

  const { truncated, ellipsis, inverted, periodical, generic, corroboratedDangles } =
    classify(books, bansByBook)

  const lines: string[] = [
    '# Truncated / generic title audit',
    '',
    `Generated by \`scripts/_audit_truncated_titles.ts\` on ${new Date().toISOString().slice(0, 10)}.`,
    `Books scanned: ${books.length} (blanket-works rows excluded; CJK-original rows exempt`,
    `from the dangling-word check; ${corroboratedDangles} corroborated dangling-tail titles`,
    'suppressed as idiomatic — "Carry On"-class).',
    '',
    `## TRUNCATED — dangling tail, near-certain import truncation (${truncated.length})`,
    'Recover the real title from the ban source (import JSON in `data/` / source_url); never guess.',
    '',
    ...truncated.map(fmt),
    '',
    `## ELLIPSIS — uncorroborated "…" tail (${ellipsis.length})`,
    'Review-only: sources carry faithful ellipsis titles, but importer cuts hide here too.',
    '',
    ...ellipsis.map(fmt),
    '',
    `## INVERTED — librarian-style trailing article, de-inversion candidates (${inverted.length})`,
    '',
    ...inverted.map(fmt),
    '',
    `## PERIODICAL — periodical publisher/printer or issue-shaped title, likely out of scope (${periodical.length})`,
    'Books-only scope: confirmed periodicals get deleted (precedent: `scripts/archive/delete-kdn-periodicals.ts`).',
    '',
    ...periodical.map(({ book, hint }) => `${fmt(book)} — marker: “${hint}”`),
    '',
    `## GENERIC — one-word title without any corroborating identity (${generic.length})`,
    'Review-only: verify against the ban source. Corroborated one-word titles (Speak, America, …) are not listed.',
    '',
    ...generic.map(fmt),
    '',
  ]
  const out = 'data/truncated-titles-audit.md'
  writeFileSync(out, lines.join('\n'))

  console.log(`Books scanned:        ${books.length}`)
  console.log(`TRUNCATED:            ${truncated.length}`)
  console.log(`ELLIPSIS (review):    ${ellipsis.length}`)
  console.log(`INVERTED (review):    ${inverted.length}`)
  console.log(`PERIODICAL:           ${periodical.length}`)
  console.log(`GENERIC (review):     ${generic.length}`)
  console.log(`corroborated dangles suppressed: ${corroboratedDangles}`)
  console.log(`\nWorklist written: ${out}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
