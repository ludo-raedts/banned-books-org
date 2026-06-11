/**
 * Data-quality classifier.
 *
 * Scores every book and author into one of three levels:
 *   • confident — auto-promoted: canonical-id (OpenLibrary / ISBN / Gutenberg)
 *     + descriptions + at least one extra signal. The "1984" bucket.
 *   • default   — imported, nothing wrong, no hard verification. Most records.
 *   • flagged   — at least one hard problem (placeholder cover, no source
 *     citations, AI-drafted without description, only-placeholder-authors
 *     without canonical-id, …).
 *
 * Always writes the markdown report to data/data-quality-report.md.
 *
 * Pass `--apply` (or the legacy `--write` alias) to additionally persist the
 * verdicts to the DB (data_quality_status + data_quality_evaluated_at columns
 * added by migration 20260518065314_data_quality_status.sql).
 *
 *   npx tsx --env-file=.env.local scripts/score-data-quality.ts            # dry run
 *   npx tsx --env-file=.env.local scripts/score-data-quality.ts --apply    # persist
 */
import { adminClient } from '../src/lib/supabase'
import { writeFileSync } from 'fs'
import { isApply } from './lib/cli'

const supabase = adminClient()
const WRITE_TO_DB = isApply()

type Quality = 'confident' | 'default' | 'flagged'

interface BookVerdict {
  id: number
  slug: string
  title: string
  authorNames: string[]
  quality: Quality
  score: number
  reasons: string[]
  flags: string[]
}

interface AuthorVerdict {
  id: number
  slug: string
  display_name: string
  quality: Quality
  reasons: string[]
  flags: string[]
  bookCount: number
  confidentBookCount: number
}

function classifyBook(book: any): BookVerdict {
  const reasons: string[] = []
  const flags: string[] = []
  let score = 0

  // ── positieve signalen ───────────────────────────────────────────────
  const hasCanonicalId =
    !!book.openlibrary_work_id ||
    (book.isbn13 && book.bookshop_status === 'valid') ||
    book.gutenberg_id != null
  if (hasCanonicalId) {
    score++
    reasons.push('canonical-id')
  }

  const bans: any[] = book.bans ?? []
  const verifiedBans = bans.filter((b) => b.confidence === 'verified')
  const countries = new Set(bans.map((b) => b.country_code))
  // Relaxed: ≥3 landen OR ≥5 totaal vangt US-only canon (TKAM, Slaughterhouse-Five)
  // zonder dat `verified`-confidence (in praktijk vrijwel ongebruikt) blokkerend werkt.
  const banEvidenceStrong =
    verifiedBans.length >= 2 || countries.size >= 3 || bans.length >= 5
  if (banEvidenceStrong) {
    score++
    reasons.push(`bans:${verifiedBans.length}v/${bans.length}t/${countries.size}c`)
  }

  const totalSourceLinks = bans.reduce(
    (n, b) => n + ((b.ban_source_links as any[]) ?? []).length,
    0,
  )
  const verifiedSourceCount = bans.reduce((n, b) => {
    return (
      n +
      ((b.ban_source_links as any[]) ?? []).filter(
        (l: any) => l.ban_sources?.verification_status === 'verified',
      ).length
    )
  }, 0)
  const sourceEvidenceStrong = verifiedSourceCount >= 1 || totalSourceLinks >= 2
  if (sourceEvidenceStrong) {
    score++
    reasons.push(`sources:${verifiedSourceCount}v/${totalSourceLinks}t`)
  }

  const descBook = (book.description_book ?? '').trim()
  const descBan = (book.description_ban ?? '').trim()
  // ai_consensus = a cross-model AI summary, neither editorially reviewed nor
  // tied to a cited source. It must NOT count toward the editorial-complete
  // signal that (with a canonical id) gates a book into `confident`.
  const editorialComplete =
    descBook.length > 100 && descBan.length > 100 && book.description_source_type !== 'ai_consensus'
  if (editorialComplete) {
    score++
    reasons.push('editorial-complete')
  }

  const authors: any[] = (book.book_authors as any[])?.map((ba: any) => ba.authors) ?? []
  const realAuthors = authors.filter((a) => a && !a.is_placeholder)
  const authorLegit =
    realAuthors.length > 0 && realAuthors.some((a) => a.birth_year != null)
  if (authorLegit) {
    score++
    reasons.push('author-legit')
  }

  // ── flag-overrides ───────────────────────────────────────────────────
  if (book.cover_status === 'rejected_placeholder') {
    flags.push('cover-placeholder')
  }
  if (book.ai_drafted && !descBook) {
    flags.push('ai-drafted-empty-desc')
  }
  if (bans.length === 0) {
    flags.push('no-bans')
  } else if (totalSourceLinks === 0) {
    flags.push('no-source-citations')
  }
  if (bans.length > 0 && bans.every((b) => b.confidence === 'unverified')) {
    flags.push('all-bans-unverified')
  }
  if (
    book.first_published_year != null &&
    (book.first_published_year < -3000 || book.first_published_year > 2030)
  ) {
    flags.push(`implausible-year:${book.first_published_year}`)
  }
  if (authors.length === 0) {
    flags.push('no-author')
  } else if (realAuthors.length === 0 && !hasCanonicalId) {
    // Genuinely anonymous canonical works (Bible, Quran, 1001 Nights) hebben vaak
    // alleen "Various Authors"/"Anonymous" maar zijn wel canoniek attested.
    // Alleen flaggen als óók de canonical-id ontbreekt (echte unknown-author placeholder).
    flags.push('only-placeholder-authors')
  }

  // ── verdict ──────────────────────────────────────────────────────────
  let quality: Quality
  if (flags.length > 0) {
    quality = 'flagged'
  } else if (score >= 3 && hasCanonicalId && editorialComplete) {
    // Harde guards: canonical-id (we weten welk werk dit is) + descriptions
    // (editorial review heeft het bekeken). Eén extra signaal naar keuze
    // (auteur, bans, of sources) duwt naar confident. Zo passen zowel
    // canonieke named-author works (TKAM: canonical+editorial+author) als
    // anonieme canon (Bible: canonical+editorial+bans).
    quality = 'confident'
  } else {
    quality = 'default'
  }

  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    authorNames: authors
      .map((a) => a?.display_name)
      .filter(Boolean) as string[],
    quality,
    score,
    reasons,
    flags,
  }
}

function classifyAuthor(
  author: any,
  bookVerdicts: BookVerdict[],
  authorBookMap: Map<number, BookVerdict[]>,
): AuthorVerdict {
  const reasons: string[] = []
  const flags: string[] = []
  const books = authorBookMap.get(author.id) ?? []
  const confidentBooks = books.filter((b) => b.quality === 'confident')

  // ── flags ─────────────────────────────────────────────────────────────
  if (author.is_placeholder) {
    flags.push('placeholder')
  }
  if (books.length === 0) {
    flags.push('no-books')
  }
  if (
    author.birth_year != null &&
    (author.birth_year < -3000 || author.birth_year > 2030)
  ) {
    flags.push(`implausible-birth-year:${author.birth_year}`)
  }
  if (
    author.death_year != null &&
    author.birth_year != null &&
    author.death_year < author.birth_year
  ) {
    flags.push('death-before-birth')
  }

  // ── positieve signalen ────────────────────────────────────────────────
  const hasBirthYear = author.birth_year != null
  if (hasBirthYear) reasons.push('birth-year')
  const hasBio = ((author.bio ?? '').trim()).length > 200
  if (hasBio) reasons.push('bio')
  const hasPhoto = !!author.photo_url
  if (hasPhoto) reasons.push('photo')
  const hasConfidentBook = confidentBooks.length >= 1
  if (hasConfidentBook) reasons.push(`confident-books:${confidentBooks.length}`)
  const hasBirthCountry = !!author.birth_country
  if (hasBirthCountry) reasons.push('birth-country')

  // ── verdict ──────────────────────────────────────────────────────────
  let quality: Quality
  if (flags.length > 0) {
    quality = 'flagged'
  } else if (hasBirthYear && hasBio && hasConfidentBook && hasBirthCountry) {
    quality = 'confident'
  } else {
    quality = 'default'
  }

  return {
    id: author.id,
    slug: author.slug,
    display_name: author.display_name,
    quality,
    reasons,
    flags,
    bookCount: books.length,
    confidentBookCount: confidentBooks.length,
  }
}

function bucket<T extends { quality: Quality }>(
  items: T[],
): Record<Quality, T[]> {
  return {
    confident: items.filter((i) => i.quality === 'confident'),
    default: items.filter((i) => i.quality === 'default'),
    flagged: items.filter((i) => i.quality === 'flagged'),
  }
}

function fmtPct(n: number, total: number) {
  return total === 0 ? '0%' : `${((n / total) * 100).toFixed(1)}%`
}

async function fetchAllBooks() {
  const pageSize = 250
  const all: any[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('books')
      .select(
        `
        id, slug, title,
        openlibrary_work_id, isbn13, bookshop_status, gutenberg_id,
        cover_status, ai_drafted,
        description_book, description_ban, description_source_type,
        first_published_year,
        book_authors(authors(id, display_name, is_placeholder, birth_year)),
        bans(
          id, country_code, confidence,
          ban_source_links(ban_sources(verification_status))
        )
      `,
      )
      .order('id')
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    process.stdout.write(`  books: ${all.length}\r`)
    if (data.length < pageSize) break
  }
  process.stdout.write('\n')
  return all
}

async function fetchAllAuthors() {
  const pageSize = 1000
  const all: any[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('authors')
      .select(
        'id, slug, display_name, birth_year, death_year, birth_country, bio, photo_url, is_placeholder',
      )
      .order('id')
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    process.stdout.write(`  authors: ${all.length}\r`)
    if (data.length < pageSize) break
  }
  process.stdout.write('\n')
  return all
}

async function main() {
  console.log('Querying books with joins (paginated)...')
  const books = await fetchAllBooks()
  console.log(`Fetched ${books.length} books.`)

  console.log('Querying authors (paginated)...')
  const authors = await fetchAllAuthors()
  console.log(`Fetched ${authors.length} authors.`)

  // ── classify books ──────────────────────────────────────────────────
  const bookVerdicts = books.map(classifyBook)

  // ── build author→books index ────────────────────────────────────────
  const authorBookMap = new Map<number, BookVerdict[]>()
  for (const book of books) {
    const verdict = bookVerdicts.find((v) => v.id === book.id)!
    for (const ba of (book.book_authors as any[]) ?? []) {
      const aid = ba.authors?.id
      if (!aid) continue
      if (!authorBookMap.has(aid)) authorBookMap.set(aid, [])
      authorBookMap.get(aid)!.push(verdict)
    }
  }

  const authorVerdicts = authors.map((a) =>
    classifyAuthor(a, bookVerdicts, authorBookMap),
  )

  const bb = bucket(bookVerdicts)
  const ab = bucket(authorVerdicts)

  // ── build report ────────────────────────────────────────────────────
  const lines: string[] = []
  lines.push('# Data Quality Dry Run')
  lines.push('')
  lines.push(`Run at: ${new Date().toISOString()}`)
  lines.push('')
  lines.push(
    'Drie buckets per record: `confident` (automatisch hoog vertrouwen), `default` (geïmporteerd, niets mis), `flagged` (minimaal één probleem).',
  )
  lines.push('')
  lines.push('## Books')
  lines.push('')
  lines.push(`Totaal: **${bookVerdicts.length}**`)
  lines.push('')
  lines.push('| Bucket | Count | % |')
  lines.push('|---|---:|---:|')
  for (const q of ['confident', 'default', 'flagged'] as Quality[]) {
    lines.push(
      `| ${q} | ${bb[q].length} | ${fmtPct(bb[q].length, bookVerdicts.length)} |`,
    )
  }
  lines.push('')

  lines.push('### Confident books — sample (top 25 by score, oudste eerst)')
  lines.push('')
  lines.push('| ID | Slug | Title | Auteur | Score | Signalen |')
  lines.push('|---:|---|---|---|---:|---|')
  const confidentSorted = [...bb.confident]
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, 25)
  for (const v of confidentSorted) {
    lines.push(
      `| ${v.id} | ${v.slug} | ${v.title.replace(/\|/g, '\\|')} | ${v.authorNames.join(', ')} | ${v.score}/5 | ${v.reasons.join(', ')} |`,
    )
  }
  lines.push('')

  lines.push('### Flagged books — flag-frequentie')
  lines.push('')
  const flagCounts = new Map<string, number>()
  for (const v of bb.flagged) {
    for (const f of v.flags) {
      const key = f.split(':')[0]
      flagCounts.set(key, (flagCounts.get(key) ?? 0) + 1)
    }
  }
  lines.push('| Flag | Count |')
  lines.push('|---|---:|')
  for (const [flag, count] of [...flagCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    lines.push(`| ${flag} | ${count} |`)
  }
  lines.push('')

  lines.push('### Flagged books — sample (eerste 30)')
  lines.push('')
  lines.push('| ID | Slug | Title | Auteur | Flags |')
  lines.push('|---:|---|---|---|---|')
  for (const v of bb.flagged.slice(0, 30)) {
    lines.push(
      `| ${v.id} | ${v.slug} | ${v.title.replace(/\|/g, '\\|')} | ${v.authorNames.join(', ') || '—'} | ${v.flags.join(', ')} |`,
    )
  }
  lines.push('')

  lines.push('### Default books — sample (eerste 20, om te zien wat in het midden valt)')
  lines.push('')
  lines.push('| ID | Slug | Title | Auteur | Score | Welke signalen miste |')
  lines.push('|---:|---|---|---|---:|---|')
  for (const v of bb.default.slice(0, 20)) {
    const missing: string[] = []
    if (!v.reasons.includes('canonical-id')) missing.push('canonical-id')
    if (!v.reasons.some((r) => r.startsWith('bans:'))) missing.push('bans')
    if (!v.reasons.some((r) => r.startsWith('sources:'))) missing.push('sources')
    if (!v.reasons.includes('editorial-complete')) missing.push('editorial')
    if (!v.reasons.includes('author-legit')) missing.push('author-legit')
    lines.push(
      `| ${v.id} | ${v.slug} | ${v.title.replace(/\|/g, '\\|')} | ${v.authorNames.join(', ') || '—'} | ${v.score}/5 | ${missing.join(', ')} |`,
    )
  }
  lines.push('')

  // ── authors ─────────────────────────────────────────────────────────
  lines.push('## Authors')
  lines.push('')
  lines.push(`Totaal: **${authorVerdicts.length}**`)
  lines.push('')
  lines.push('| Bucket | Count | % |')
  lines.push('|---|---:|---:|')
  for (const q of ['confident', 'default', 'flagged'] as Quality[]) {
    lines.push(
      `| ${q} | ${ab[q].length} | ${fmtPct(ab[q].length, authorVerdicts.length)} |`,
    )
  }
  lines.push('')

  lines.push('### Confident authors — sample (eerste 25)')
  lines.push('')
  lines.push('| ID | Slug | Name | Books | Confident books | Signalen |')
  lines.push('|---:|---|---|---:|---:|---|')
  for (const v of ab.confident.slice(0, 25)) {
    lines.push(
      `| ${v.id} | ${v.slug} | ${v.display_name} | ${v.bookCount} | ${v.confidentBookCount} | ${v.reasons.join(', ')} |`,
    )
  }
  lines.push('')

  lines.push('### Flagged authors — flag-frequentie')
  lines.push('')
  const authorFlagCounts = new Map<string, number>()
  for (const v of ab.flagged) {
    for (const f of v.flags) {
      const key = f.split(':')[0]
      authorFlagCounts.set(key, (authorFlagCounts.get(key) ?? 0) + 1)
    }
  }
  lines.push('| Flag | Count |')
  lines.push('|---|---:|')
  for (const [flag, count] of [...authorFlagCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    lines.push(`| ${flag} | ${count} |`)
  }
  lines.push('')

  lines.push('### Flagged authors — sample (eerste 30)')
  lines.push('')
  lines.push('| ID | Slug | Name | Books | Flags |')
  lines.push('|---:|---|---|---:|---|')
  for (const v of ab.flagged.slice(0, 30)) {
    lines.push(
      `| ${v.id} | ${v.slug} | ${v.display_name} | ${v.bookCount} | ${v.flags.join(', ')} |`,
    )
  }
  lines.push('')

  // ── canary check: is 1984 confident? ────────────────────────────────
  lines.push('## Canary checks')
  lines.push('')
  lines.push(
    'Zoek bekende titels op om te zien of de heuristiek ze in `confident` plaatst:',
  )
  lines.push('')
  lines.push('| Titel | Verdict | Score | Signalen / flags |')
  lines.push('|---|---|---:|---|')
  const canaryTitles = [
    '1984',
    'Nineteen Eighty-Four',
    'Animal Farm',
    'Brave New World',
    'Lolita',
    'The Satanic Verses',
    'To Kill a Mockingbird',
    'Fahrenheit 451',
    "The Handmaid's Tale",
    'Ulysses',
    'The Bible',
    'The Quran',
    'One Thousand and One Nights',
    'Lysistrata',
    'Ars Amatoria',
  ]
  for (const t of canaryTitles) {
    const matches = bookVerdicts.filter(
      (v) => v.title.toLowerCase() === t.toLowerCase(),
    )
    if (matches.length === 0) {
      lines.push(`| ${t} | _niet gevonden_ | — | — |`)
      continue
    }
    for (const v of matches) {
      const detail = v.quality === 'flagged' ? v.flags.join(', ') : v.reasons.join(', ')
      lines.push(`| ${v.title} (${v.slug}) | ${v.quality} | ${v.score}/5 | ${detail} |`)
    }
  }
  lines.push('')

  const path = 'data/data-quality-report.md'
  writeFileSync(path, lines.join('\n'))
  console.log(`Wrote ${path}`)
  console.log('')
  console.log('Summary:')
  console.log(
    `  Books   — confident:${bb.confident.length}  default:${bb.default.length}  flagged:${bb.flagged.length}`,
  )
  console.log(
    `  Authors — confident:${ab.confident.length}  default:${ab.default.length}  flagged:${ab.flagged.length}`,
  )

  if (!WRITE_TO_DB) {
    console.log('')
    console.log('Dry run only. Pass --write to persist verdicts to the DB.')
    return
  }

  console.log('')
  console.log('Writing verdicts to DB...')
  const now = new Date().toISOString()

  await writeVerdicts(
    'books',
    bookVerdicts.map((v) => ({ id: v.id, status: v.quality })),
    now,
  )
  await writeVerdicts(
    'authors',
    authorVerdicts.map((v) => ({ id: v.id, status: v.quality })),
    now,
  )
  console.log('DB updated.')
}

async function writeVerdicts(
  table: 'books' | 'authors',
  rows: { id: number; status: Quality }[],
  evaluatedAt: string,
) {
  // Per-status bulk update — far fewer round-trips than per-row upserts.
  // Books default already; we only flip rows whose new status differs.
  // Easiest correct path: update all rows to their assigned status.
  const byStatus: Record<Quality, number[]> = { confident: [], default: [], flagged: [] }
  for (const r of rows) byStatus[r.status].push(r.id)

  for (const status of ['confident', 'default', 'flagged'] as Quality[]) {
    const ids = byStatus[status]
    if (ids.length === 0) continue
    // Chunk to avoid URL-length limits on the .in() filter.
    const chunkSize = 500
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const { error } = await supabase
        .from(table)
        .update({
          data_quality_status: status,
          data_quality_evaluated_at: evaluatedAt,
        })
        .in('id', chunk)
      if (error) {
        console.error(`update ${table} ${status} chunk ${i}: ${error.message}`)
        throw error
      }
    }
    console.log(`  ${table} → ${status}: ${ids.length}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
