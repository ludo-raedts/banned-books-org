// audit-integrity.ts — STANDING data-integrity gate (read-only).
//
// One repeatable check that consolidates the cheap, SQL/regex-only heuristics
// scattered across the _audit_* / audit-* family into a single pass/fail report.
// Unlike _audit_site_health.ts (a one-off snapshot printer) this script:
//   - has explicit thresholds and prints a PASS / WARN / FAIL verdict
//   - exits non-zero when a hard INVARIANT is violated (cron / CI gate)
//   - tracks DRIFT metrics against a committed baseline so it flags *regressions*,
//     not the absolute count of a noisy heuristic
//
// It writes NOTHING to the DB. The only thing it can write is the baseline file
// (data/integrity-baseline.json), and only with --update-baseline.
//
// Two kinds of check:
//   INVARIANT — the DB has no constraint for it, and a violation breaks a page or
//               serves a 500. Threshold is 0 (or a fixed max). Over threshold => FAIL,
//               exit 1.
//   DRIFT     — a heuristic that legitimately has false positives (regex name
//               classifiers, contamination proxies, coverage gaps). Compared to the
//               baseline: growth => WARN, never fails the exit code.
//
// The EXPENSIVE audits (perceptual-hash covers, aspect-ratio strips, LLM
// groundedness) are intentionally NOT here — they stay as on-demand scripts.
// See the footer this prints for the periodic deep-audit list.
//
// Run:   pnpm tsx --env-file=.env.local scripts/audit-integrity.ts
// Flags: --json              machine-readable output
//        --verbose           more sample rows per finding
//        --update-baseline   rewrite data/integrity-baseline.json from this run's drift counts

import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { adminClient } from '../src/lib/supabase'
import { isAllowedImageUrl } from '../src/lib/allowed-image-hosts'
import { slugify } from '../src/lib/imports/slugify'
import { titlesMatch } from '../src/lib/enrich/title-match'

const sb = adminClient()
const THIS_YEAR = new Date().getFullYear()
const BASELINE_PATH = resolve(__dirname, '../data/integrity-baseline.json')

const argv = process.argv.slice(2)
const JSON_OUT = argv.includes('--json')
const VERBOSE = argv.includes('--verbose')
const UPDATE_BASELINE = argv.includes('--update-baseline')
const SAMPLE_CAP = VERBOSE ? 40 : 8

type Severity = 'invariant' | 'drift'
interface Finding {
  id: string
  label: string
  severity: Severity
  count: number
  threshold?: number // invariants only; default 0
  // drift only: which direction is the regression. Default 'up' (growth = WARN);
  // 'down' for breadth metrics (e.g. country coverage) where shrinkage = WARN.
  badDirection?: 'up' | 'down'
  samples: string[]
}

// ── pagination helper (always .order() per the project pagination doctrine) ──
async function paginate<T>(
  table: string,
  columns: string,
  orderCol: string,
  applyFilter?: (q: any) => any,
): Promise<T[]> {
  const out: T[] = []
  let offset = 0
  for (;;) {
    let q = sb.from(table).select(columns).order(orderCol).range(offset, offset + 999)
    if (applyFilter) q = applyFilter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data || data.length === 0) break
    out.push(...(data as T[]))
    if (data.length < 1000) break
    offset += 1000
  }
  return out
}

// ── load the catalogue once; nearly every check works off these in memory ──
interface Book {
  id: number
  slug: string
  title: string
  isbn13: string | null
  cover_url: string | null
  description: string | null
  description_book: string | null
  first_published_year: number | null
}
interface Author {
  id: number
  slug: string
  display_name: string
  birth_year: number | null
  death_year: number | null
  bio: string | null
  photo_url: string | null
}

async function load() {
  const [books, authors, bookAuthors, bans, banSourceLinks] = await Promise.all([
    paginate<Book>(
      'books',
      'id, slug, title, isbn13, cover_url, description, description_book, first_published_year',
      'id',
    ),
    paginate<Author>('authors', 'id, slug, display_name, birth_year, death_year, bio, photo_url', 'id'),
    paginate<{ book_id: number; author_id: number }>('book_authors', 'book_id, author_id', 'book_id'),
    paginate<{ id: number; book_id: number; year_started: number | null; country_code: string | null }>('bans', 'id, book_id, year_started, country_code', 'id'),
    paginate<{ ban_id: number }>('ban_source_links', 'ban_id', 'ban_id'),
  ])
  return { books, authors, bookAuthors, banBookIds: bans, bans, banSourceLinks }
}

// ── non-person author classifier (lifted from audit-non-person-authors.ts) ──
const NON_PERSON_PATTERNS: RegExp[] = [
  /\bet\s+al\.?/i,
  /\b(?:and|&|en|y)\s+\d+\s+others\b/i,
  /\b(?:and|&)\s+others\s*$/i,
  /\bEditorial\s+Staff\b/i,
  /\bRedactie\b/i, /\bRedaksi\b/i, /\bSidang\s+Pengarang\b/i,
  /\bEdiciones\b/i, /\bPenerbit(?:an)?\b/i, /\bPublish(?:ing|ers?)\b/i,
  /\bUitgeverij\b/i, /\bVerlag\b/i, /\bImprint\b/i,
  /\bMinist(?:ry|erio|erie|[èe]re)\b/i, /\bDepartment\b/i,
  /\bCommittee\b/i, /\bKomite\b/i, /\bPanitia\b/i,
  /\bCouncil\b/i, /\bMajlis\b/i, /\bDewan\b/i,
  /\bInstitute\b/i, /\bInstituto\b/i,
  /\bFoundation\b/i, /\bYayasan\b/i,
  /^(?:Atlas|Diccionario|Enciclopedia|Manual|Colecci[óo]n|Antolog[ií]a)\b/i,
]
const NON_PERSON_WHITELIST = new Set(['Melissa Kantor'])

const coverKey = (url: string | null): string | null => {
  if (!url) return null
  const m = url.match(/[?&]id=([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

// titles in a group are "consistent" if every title matches the first one
const groupConsistent = (titles: string[]): boolean =>
  titles.every((t) => titlesMatch(titles[0], t))

const hasMojibake = (s: string | null): boolean => !!s && s.includes('�')

async function runChecks(): Promise<Finding[]> {
  const { books, authors, bookAuthors, banBookIds, bans, banSourceLinks } = await load()
  const findings: Finding[] = []

  const authorById = new Map(authors.map((a) => [a.id, a]))
  const authorsByBook = new Map<number, number[]>()
  for (const ba of bookAuthors) {
    const arr = authorsByBook.get(ba.book_id) ?? []
    arr.push(ba.author_id)
    authorsByBook.set(ba.book_id, arr)
  }
  const bookIdsWithBan = new Set(banBookIds.map((b) => b.book_id))

  // ─────────── INVARIANTS (threshold 0) ───────────

  // 1+2. image-host violations → next/image returns 500 for these hosts
  const badCover = books.filter((b) => b.cover_url && !isAllowedImageUrl(b.cover_url))
  findings.push({
    id: 'image-host-cover', label: 'cover_url on non-allowlisted host (next/image 500s)',
    severity: 'invariant', count: badCover.length,
    samples: badCover.slice(0, SAMPLE_CAP).map((b) => `${b.slug}: ${b.cover_url}`),
  })
  const badPhoto = authors.filter((a) => a.photo_url && !isAllowedImageUrl(a.photo_url))
  findings.push({
    id: 'image-host-photo', label: 'author photo_url on non-allowlisted host',
    severity: 'invariant', count: badPhoto.length,
    samples: badPhoto.slice(0, SAMPLE_CAP).map((a) => `${a.slug}: ${a.photo_url}`),
  })

  // 3. mojibake (U+FFFD) in user-facing text — KDN import artefact
  const mojibake: string[] = []
  for (const b of books) {
    if (hasMojibake(b.title) || hasMojibake(b.description) || hasMojibake(b.description_book))
      mojibake.push(`book ${b.slug}: "${b.title}"`)
  }
  for (const a of authors) {
    if (hasMojibake(a.display_name) || hasMojibake(a.bio))
      mojibake.push(`author ${a.slug}: "${a.display_name}"`)
  }
  findings.push({
    id: 'mojibake', label: 'U+FFFD replacement char in title / name / description',
    severity: 'invariant', count: mojibake.length, samples: mojibake.slice(0, SAMPLE_CAP),
  })

  // 4. books with zero authors → broken detail/author rendering
  const noAuthor = books.filter((b) => !authorsByBook.has(b.id))
  findings.push({
    id: 'book-no-authors', label: 'book with zero linked authors',
    severity: 'invariant', count: noAuthor.length,
    samples: noAuthor.slice(0, SAMPLE_CAP).map((b) => `${b.slug}: "${b.title}"`),
  })

  // 4b. bans with zero source citations → breaks the site-wide promise that
  //     "every ban links to a source". Held at 0 since the 2026-06-04 seed-orphan
  //     remediation (scripts/source-orphan-{cluster,canonical}-bans.ts).
  const banIdsWithSource = new Set(banSourceLinks.map((l) => l.ban_id))
  const bansNoSource = bans.filter((b) => !banIdsWithSource.has(b.id))
  findings.push({
    id: 'ban-no-source', label: 'ban with zero source citations (breaks "every ban links to a source")',
    severity: 'invariant', count: bansNoSource.length,
    samples: bansNoSource.slice(0, SAMPLE_CAP).map((b) => `ban #${b.id} (book ${b.book_id})`),
  })

  // 5. chronologically impossible years (HARD subset only — soft cases are a deep audit)
  const badYears: string[] = []
  for (const b of books) {
    const y = b.first_published_year
    if (y == null) continue
    if (y > THIS_YEAR) { badYears.push(`book ${b.slug}: published ${y} (> ${THIS_YEAR})`); continue }
    const births = (authorsByBook.get(b.id) ?? [])
      .map((id) => authorById.get(id)?.birth_year)
      .filter((v): v is number => v != null)
    if (births.length && y < Math.min(...births))
      badYears.push(`book ${b.slug}: published ${y} before author born ${Math.min(...births)}`)
  }
  for (const a of authors) {
    if (a.birth_year != null && a.death_year != null && a.birth_year > a.death_year)
      badYears.push(`author ${a.slug}: born ${a.birth_year} > died ${a.death_year}`)
    if ((a.birth_year ?? 0) > THIS_YEAR || (a.death_year ?? 0) > THIS_YEAR)
      badYears.push(`author ${a.slug}: birth/death year in the future`)
  }
  findings.push({
    id: 'impossible-year-hard', label: 'chronologically impossible publication / birth / death year',
    severity: 'invariant', count: badYears.length, samples: badYears.slice(0, SAMPLE_CAP),
  })

  // ─────────── DRIFT (compared to baseline) ───────────

  // 6. non-person authors (publishers / orgs / anon groups misfiled as people)
  const nonPerson = authors.filter(
    (a) => !NON_PERSON_WHITELIST.has(a.display_name) &&
      NON_PERSON_PATTERNS.some((re) => re.test(a.display_name)),
  )
  findings.push({
    id: 'non-person-authors', label: 'author name looks like a publisher / org / group',
    severity: 'drift', count: nonPerson.length,
    samples: nonPerson.slice(0, SAMPLE_CAP).map((a) => `${a.slug}: "${a.display_name}"`),
  })

  // 7. shared-cover contamination (same Google volume id across mismatched titles)
  const coverGroups = new Map<string, Book[]>()
  for (const b of books) {
    const k = coverKey(b.cover_url)
    if (!k) continue
    const arr = coverGroups.get(k) ?? []
    arr.push(b)
    coverGroups.set(k, arr)
  }
  const coverSuspects = [...coverGroups.values()].filter(
    (g) => g.length > 1 && !groupConsistent(g.map((b) => b.title)),
  )
  findings.push({
    id: 'shared-cover-contamination', label: 'one cover shared across books with mismatched titles',
    severity: 'drift', count: coverSuspects.length,
    samples: coverSuspects.slice(0, SAMPLE_CAP).map((g) => g.map((b) => b.slug).join(' = ')),
  })

  // 8. shared-description contamination (same blurb across mismatched titles)
  const descGroups = new Map<string, Book[]>()
  for (const b of books) {
    const d = (b.description_book ?? '').trim()
    if (d.length < 40) continue
    const arr = descGroups.get(d) ?? []
    arr.push(b)
    descGroups.set(d, arr)
  }
  const descSuspects = [...descGroups.values()].filter(
    (g) => g.length > 1 && !groupConsistent(g.map((b) => b.title)),
  )
  findings.push({
    id: 'shared-desc-contamination', label: 'one description shared across books with mismatched titles',
    severity: 'drift', count: descSuspects.length,
    samples: descSuspects.slice(0, SAMPLE_CAP).map((g) => g.map((b) => b.slug).join(' = ')),
  })

  // 9. slug drift (stored slug != current slugify()) — may be intentional, hence drift
  const slugDrift: string[] = []
  for (const b of books) if (b.slug !== slugify(b.title)) slugDrift.push(`book ${b.slug} ⇏ ${slugify(b.title)}`)
  for (const a of authors)
    if (a.slug !== slugify(a.display_name)) slugDrift.push(`author ${a.slug} ⇏ ${slugify(a.display_name)}`)
  findings.push({
    id: 'slug-drift', label: 'stored slug differs from slugify(title/name)',
    severity: 'drift', count: slugDrift.length, samples: slugDrift.slice(0, SAMPLE_CAP),
  })

  // 10. orphan books (catalogue entry with zero bans anywhere)
  const orphans = books.filter((b) => !bookIdsWithBan.has(b.id))
  findings.push({
    id: 'orphan-books', label: 'book with zero bans (never actually banned anywhere)',
    severity: 'drift', count: orphans.length,
    samples: orphans.slice(0, SAMPLE_CAP).map((b) => `${b.slug}: "${b.title}"`),
  })

  // 13. ban dated before the book's first publication. Soft companion to #5:
  //      most are granularity noise (first_published_year tracks the English/
  //      translated edition while the ban hit the original-language edition
  //      earlier) or genuine pre-publication suppression (samizdat / posthumous
  //      release, e.g. The Master and Margarita banned 1940, published 1967).
  //      So it is DRIFT, not an invariant — but a bad import that stamps a
  //      placeholder ban year on post-publication books (cf. the 2026-05-19
  //      Iran "1979" batch) surfaces here as growth past baseline.
  const bookPubYear = new Map(books.map((b) => [b.id, b.first_published_year]))
  const banBeforePub: string[] = []
  for (const ban of bans) {
    const pub = bookPubYear.get(ban.book_id)
    if (ban.year_started != null && pub != null && ban.year_started < pub)
      banBeforePub.push(`ban #${ban.id} (book ${ban.book_id}): banned ${ban.year_started} < published ${pub}`)
  }
  findings.push({
    id: 'ban-before-publication', label: 'ban dated before the book was first published',
    severity: 'drift', count: banBeforePub.length, samples: banBeforePub.slice(0, SAMPLE_CAP),
  })

  // 11+12. coverage gaps
  const noCover = books.filter((b) => !b.cover_url)
  findings.push({
    id: 'no-cover', label: 'book without a cover',
    severity: 'drift', count: noCover.length,
    samples: noCover.slice(0, SAMPLE_CAP).map((b) => b.slug),
  })
  const noDesc = books.filter((b) => !b.description && !b.description_book)
  findings.push({
    id: 'no-description', label: 'book without any description',
    severity: 'drift', count: noDesc.length,
    samples: noDesc.slice(0, SAMPLE_CAP).map((b) => b.slug),
  })

  // 14. country coverage breadth (absorbed from the retired check-coverage.ts /
  //     audit-db.ts, which undercounted on the 1000-row .select() cap). A country
  //     disappearing from the bans table means an import/merge dropped rows.
  const countryCounts = new Map<string, number>()
  for (const ban of bans) {
    const c = ban.country_code ?? '??'
    countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1)
  }
  const topCountries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])
  findings.push({
    id: 'country-coverage', label: 'distinct countries with at least one ban',
    severity: 'drift', count: countryCounts.size, badDirection: 'down',
    samples: topCountries.slice(0, SAMPLE_CAP).map(([c, n]) => `${c}: ${n} bans`),
  })

  return findings
}

// ── baseline ──
type Baseline = { generatedAt: string; metrics: Record<string, number> }
function readBaseline(): Baseline | null {
  if (!existsSync(BASELINE_PATH)) return null
  try { return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline } catch { return null }
}

function main() {
  return runChecks().then((findings) => {
    const baseline = readBaseline()
    let failures = 0
    let regressions = 0

    // verdict per finding
    const verdicts = findings.map((f) => {
      if (f.severity === 'invariant') {
        const max = f.threshold ?? 0
        const status = f.count > max ? 'FAIL' : 'OK'
        if (status === 'FAIL') failures++
        return { ...f, status, baseline: undefined as number | undefined }
      }
      const base = baseline?.metrics[f.id]
      let status: string
      // Live enrichers shift these counts a few points between runs, so only flag
      // movement in the bad direction past a small tolerance (max of 2 rows or 2%
      // of baseline) as a regression. badDirection 'down' inverts the comparison
      // for breadth metrics where shrinkage is the problem.
      const tolerance = base == null ? 0 : Math.max(2, Math.ceil(base * 0.02))
      const regressed = base != null && (f.badDirection === 'down'
        ? f.count < base - tolerance
        : f.count > base + tolerance)
      if (base == null) status = 'NEW' // no baseline recorded yet
      else if (regressed) { status = 'WARN'; regressions++ }
      else status = 'OK'
      return { ...f, status, baseline: base }
    })

    if (JSON_OUT) {
      console.log(JSON.stringify({ thisYear: THIS_YEAR, failures, regressions, findings: verdicts }, null, 2))
    } else {
      const icon: Record<string, string> = { FAIL: '✗', WARN: '▲', OK: '✓', NEW: '·' }
      console.log(`\n=== DATA-INTEGRITY TOETS  (${new Date().toISOString().slice(0, 10)}) ===\n`)
      console.log('── INVARIANTS (must be 0; a FAIL exits non-zero) ──')
      for (const v of verdicts.filter((x) => x.severity === 'invariant')) {
        console.log(`  ${icon[v.status]} ${v.status.padEnd(4)} ${String(v.count).padStart(5)}  ${v.label}`)
        if (v.status === 'FAIL') v.samples.forEach((s) => console.log(`           - ${s}`))
      }
      console.log('\n── DRIFT (vs baseline; ▲ = regression, never fails the build) ──')
      for (const v of verdicts.filter((x) => x.severity === 'drift')) {
        const delta = v.baseline == null ? '(no baseline)' : `baseline ${v.baseline}`
        console.log(`  ${icon[v.status]} ${v.status.padEnd(4)} ${String(v.count).padStart(5)}  ${v.label}  [${delta}]`)
        if (v.status === 'WARN' || (v.status === 'NEW' && v.count > 0))
          v.samples.slice(0, VERBOSE ? SAMPLE_CAP : 4).forEach((s) => console.log(`           - ${s}`))
      }

      console.log('\n── VERDICT ──')
      if (failures) console.log(`  ✗ ${failures} invariant(s) violated — FIX before this counts as healthy.`)
      else console.log('  ✓ all invariants hold.')
      if (regressions) console.log(`  ▲ ${regressions} drift metric(s) grew vs baseline — review, then --update-baseline to accept.`)
      if (!baseline) console.log('  · no baseline yet — run with --update-baseline once the drift counts look right.')

      console.log('\n── PERIODIC DEEP AUDITS (not run here — external/LLM cost) ──')
      console.log('  · covers:       audit-covers-for-placeholders.ts, _audit_google_covers.ts, audit-study-guide-covers.ts')
      console.log('  · descriptions: _audit_ungrounded_descriptions.ts, score-descriptions.ts')
      console.log('  · dupes:        _audit_split_authors.ts, _audit_paren_suffix_dupes.ts, _audit_honorific_author_dupes.ts')
    }

    if (UPDATE_BASELINE) {
      const metrics: Record<string, number> = {}
      for (const f of findings) if (f.severity === 'drift') metrics[f.id] = f.count
      writeFileSync(BASELINE_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), metrics }, null, 2) + '\n')
      if (!JSON_OUT) console.log(`\nbaseline written → ${BASELINE_PATH}`)
    }

    process.exit(failures > 0 ? 1 : 0)
  })
}

main().catch((e) => { console.error(e); process.exit(2) })
