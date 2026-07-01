#!/usr/bin/env tsx
/**
 * fix-impossible-years-2026-07-01.ts — one-off correction of the 3 rows that
 * trip the `impossible-year-hard` INVARIANT in scripts/audit-integrity.ts
 * ("book published before its author was born"). All three are Berlin-1938
 * Nazi-ban authors whose birth_year was set by enrich-author-ol.ts on
 * 2026-06-19 from a *modern namesake* (OL long-tail pass), i.e. namesake
 * contamination — not a real regression in the underlying ban data.
 *
 * FINDINGS (verified against authoritative sources):
 *
 *  1+2. Josef Hofbauer (author id 14662)
 *       books: der-grosse-alte-mann-ein-masaryk-buch (1938),
 *              der-marsch-ins-chaos (1930)
 *       DB now: birth_year=1956, death_year=null  ← modern namesake (OL, 2026-06-19)
 *       CORRECT: birth_year=1886, death_year=1948
 *       Josef Hofbauer (Schriftsteller), Sudeten-German social-democratic
 *       writer, b. 20 Jan 1886 Vienna, d. 25 Sep 1948 Frankfurt a.M.; wrote
 *       both banned titles. Source:
 *       https://de.wikipedia.org/wiki/Josef_Hofbauer_(Schriftsteller)
 *       → this clears BOTH book rows (1930 and 1938 are both > 1886).
 *
 *  3.   Joseph Amiel (author id 16348)
 *       book: palastina-das-erlaubte-land ("Palästina, das erlaubte Land", 1934)
 *       DB now: birth_year=1937, bio = American attorney/novelist b. 1937 NYC
 *               ← this is a DIFFERENT person (the American novelist Joseph Amiel,
 *                 https://en.wikipedia.org/wiki/Joseph_Amiel). Namesake
 *                 contamination of BOTH birth_year and bio.
 *       The real author of the 1934 book is "Joseph Amiel", a PSEUDONYM of
 *       Grete Fischer (b. 6 Feb 1893 Prague, d. 28 Mar 1977 London).
 *       Source: https://www.fembio.org/biographie.php/frau/biographie/grete-fischer/
 *       FIX HERE (surgical, invariant-clearing): NULL the contaminated
 *       birth_year AND the wrong-person bio. We do NOT stamp Grete Fischer's
 *       1893 onto a record whose display_name is still the pseudonym "Joseph
 *       Amiel" — turning this row into a proper Grete-Fischer identity
 *       (display_name / slug / pseudonym handling) is a separate curated task.
 *       NULL birth_year clears the "published 1934 before author born 1937"
 *       invariant without asserting a new birth year onto a mixed identity.
 *
 * Each update is guarded: it only writes if the DB still holds the exact
 * contaminated value recorded here (so a later manual edit is never clobbered).
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/fix-impossible-years-2026-07-01.ts          # dry-run (default)
 *   pnpm tsx --env-file=.env.local scripts/fix-impossible-years-2026-07-01.ts --apply  # write
 */
import { adminClient } from '../src/lib/supabase'
import { isApply } from './lib/cli'

const WRITE = isApply()
const sb = adminClient()

interface Fix {
  authorId: number
  slug: string
  note: string
  // expected current (contaminated) values — guard
  expect: { birth_year: number | null; death_year: number | null }
  // target values to write
  set: { birth_year: number | null; death_year: number | null }
  // clear the wrong-person bio too? (Amiel only)
  clearBio?: boolean
}

const FIXES: Fix[] = [
  {
    authorId: 14662,
    slug: 'josef-hofbauer',
    note: 'Josef Hofbauer (Schriftsteller) b.1886 d.1948 — de.wikipedia; was modern namesake 1956',
    expect: { birth_year: 1956, death_year: null },
    set: { birth_year: 1886, death_year: 1948 },
  },
  {
    authorId: 16348,
    slug: 'joseph-amiel',
    note: 'Joseph Amiel = pseudonym of Grete Fischer (1893–1977); DB held American namesake b.1937 — NULL contaminated year+bio',
    expect: { birth_year: 1937, death_year: null },
    set: { birth_year: null, death_year: null },
    clearBio: true,
  },
]

async function main() {
  console.log(`fix-impossible-years-2026-07-01 — mode: ${WRITE ? 'WRITE' : 'DRY-RUN'}\n`)
  let ok = 0, skip = 0, fail = 0

  for (const f of FIXES) {
    const { data: cur, error: readErr } = await sb
      .from('authors')
      .select('id, slug, display_name, birth_year, death_year, bio')
      .eq('id', f.authorId)
      .maybeSingle()
    if (readErr) { fail++; console.log(`  FAIL author ${f.authorId}: ${readErr.message}`); continue }
    if (!cur) { fail++; console.log(`  FAIL author ${f.authorId}: not found`); continue }

    const beforeBio = cur.bio ? `${cur.bio.slice(0, 60)}…` : null
    console.log(`author #${cur.id} ${cur.slug} ("${cur.display_name}")`)
    console.log(`  reason: ${f.note}`)
    console.log(`  before: birth_year=${cur.birth_year} death_year=${cur.death_year}` +
      (f.clearBio ? ` bio=${beforeBio}` : ''))

    // guard: only proceed if the DB still holds the contaminated value we recorded
    if (cur.birth_year !== f.expect.birth_year || cur.death_year !== f.expect.death_year) {
      skip++
      console.log(`  SKIP: current values changed since audit ` +
        `(birth_year=${cur.birth_year}, death_year=${cur.death_year}) — not the recorded contaminated state\n`)
      continue
    }

    const patch: Record<string, unknown> = { birth_year: f.set.birth_year, death_year: f.set.death_year }
    if (f.clearBio) patch.bio = null

    console.log(`  after : birth_year=${f.set.birth_year} death_year=${f.set.death_year}` +
      (f.clearBio ? ` bio=NULL` : ''))

    if (!WRITE) { ok++; console.log('  (dry-run — no write)\n'); continue }

    const { error: updErr } = await sb.from('authors').update(patch).eq('id', f.authorId)
    if (updErr) { fail++; console.log(`  FAIL update: ${updErr.message}\n`); continue }
    ok++
    console.log('  written.\n')
  }

  console.log(`${WRITE ? 'Applied' : 'Would apply'}: ${ok}  Skipped: ${skip}  Failed: ${fail}`)
  if (!WRITE) console.log('Re-run with --apply to write.')
}

main().catch((e) => { console.error(e); process.exit(1) })
