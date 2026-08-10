/**
 * READ-ONLY audit: classify author bios to find the contamination that
 * enrich-author-bios.ts introduced by accepting the intro of the WRONG
 * Wikipedia article (a book/film/band/award/other-person) as an author bio.
 *
 * Classes:
 *   ok            — bio opens with / is clearly about the author (keep).
 *   legal_name    — bio opens with a real name but resolves to the author via a
 *                   "(born …) / known by / pen name / née" pattern (keep — e.g.
 *                   Voltaire → "François-Marie Arouet … known by his pen name").
 *   wrong_entity  — bio's subject is a different entity (a band/film/award/…)
 *                   or another person; the article was mis-matched (remediate).
 *   own_book_blurb— bio describes a BOOK, not the author (e.g. "The Gender
 *                   Fairy is a 2015 picture book …") (remediate).
 *   llm_artifact  — leaked LLM meta-text ("Here's an expanded version …")
 *                   (remediate).
 *   ambiguous     — none of the above fired confidently (human review).
 *
 * For every non-keep class we also flag whether birth_year / death_year /
 * birth_country are set, because enrich-author-bios.ts writes those from the
 * SAME article — so a wrong bio means those are suspect too.
 *
 * No DB writes. Output: console summary + data/author-bio-contamination-audit.md
 *
 * Usage: npx tsx --env-file=.env.local scripts/_audit_author_bio_contamination.ts
 */
import fs from 'node:fs'
import { adminClient } from '../src/lib/supabase'

const OUT = 'data/author-bio-contamination-audit.md'

function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nameTokens(...names: (string | null)[]): Set<string> {
  const t = new Set<string>()
  for (const n of names) for (const w of norm(n ?? '').split(' ')) if (w.length >= 3) t.add(w)
  return t
}

const WORK_NOUN =
  /\b(book|novel|picture book|memoir|play|film|movie|series|album|band|award|prize|poem|anthology|short story|comic|manga|graphic novel|song|magazine|newspaper|biography|autobiography|story|video game|tv series|sitcom|documentary|painting|sculpture|opera|musical)\b/i

// Leading-only: the bio STARTS with model meta-text. Anchored to ^ so ordinary
// words mid-bio (e.g. "...in the...") never false-match (that broke Carolyn
// Mackler, whose bio is fine).
const LLM_ARTIFACT =
  /^\s*(here'?s\b|sure[,!:]|certainly[,!:]|as an ai\b|i can (help|provide|write)\b|i'?ll (write|provide)\b|of course[,!:]|below is\b|---)/i

const LEGAL_NAME =
  /\(born\b|\(b\.\s|\bborn (in |on |\d)|known (by|as)|better known|pen name|pen-name|real name|birth name|née\b|pseudonym|stage name/i

type Cls = 'ok' | 'legal_name' | 'wrong_entity' | 'own_book_blurb' | 'llm_artifact' | 'ambiguous'

// The grammatical SUBJECT of the opening clause: text before the first copula
// ("is/was/were") or a "(born …)/better known/who" aside. This is the entity
// the bio is actually about — robust to initials like "D. H." that a naive
// sentence-splitter would choke on (that broke D.H. Lawrence, J.K. Rowling…).
function subjectOf(intro: string): string {
  const cut = intro.search(/\s+(is|was|are|were)\b|\s*\((?:born|b\.|c\.|\d)|,\s+(better )?known\b|,\s+who\b/i)
  return cut > 0 ? intro.slice(0, cut) : intro.slice(0, 60)
}

function classify(a: {
  display_name: string
  bio: string
  name_native: string | null
  name_transliterated: string | null
  name_english: string | null
}): Cls {
  const bio = a.bio.trim()
  if (LLM_ARTIFACT.test(bio)) return 'llm_artifact'

  const toks = nameTokens(a.display_name, a.name_native, a.name_transliterated, a.name_english)
  const intro = bio.slice(0, 240)
  const introNorm = norm(intro)
  const subjectNorm = norm(subjectOf(intro))

  // Author is the SUBJECT of the opening clause (also catches pen names whose
  // real name leads but names the pen name in the subject, e.g. Ayn Rand).
  if ([...toks].some((t) => subjectNorm.includes(t))) return 'ok'

  // Real-name/pen-name bio: a different name leads, but the author is named in
  // the intro via a "(born …)/known by/pen name" construction (Voltaire, Carroll).
  const nameInIntro = [...toks].some((t) => introNorm.includes(t))
  if (LEGAL_NAME.test(intro) && nameInIntro) return 'legal_name'

  // Subject is a work ("X is a … novel/film/band/award") → blurb, not a bio.
  if (WORK_NOUN.test(intro)) return 'own_book_blurb'
  // A different person/entity entirely; the author appears nowhere in the intro.
  if (!nameInIntro) return 'wrong_entity'
  return 'ambiguous'
}

async function main() {
  const sb = adminClient()
  const rows: Array<{
    id: number
    slug: string
    display_name: string
    bio: string
    birth_year: number | null
    death_year: number | null
    birth_country: string | null
    name_native: string | null
    name_transliterated: string | null
    name_english: string | null
  }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('authors')
      .select('id, slug, display_name, bio, birth_year, death_year, birth_country, name_native, name_transliterated, name_english')
      .not('bio', 'is', null)
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...(data as (typeof rows)))
    if (data.length < 1000) break
  }

  const buckets: Record<Cls, typeof rows> = {
    ok: [], legal_name: [], wrong_entity: [], own_book_blurb: [], llm_artifact: [], ambiguous: [],
  }
  for (const r of rows) buckets[classify(r)].push(r)

  const remediate = ['wrong_entity', 'own_book_blurb', 'llm_artifact'] as const
  const suspectYears = remediate.flatMap((c) => buckets[c]).filter((r) => r.birth_year != null || r.death_year != null || r.birth_country != null)

  const pct = (n: number) => `${((100 * n) / rows.length).toFixed(1)}%`
  console.log(`\n── author-bio contamination audit ──`)
  console.log(`authors with a bio:        ${rows.length}`)
  for (const c of ['ok', 'legal_name', 'wrong_entity', 'own_book_blurb', 'llm_artifact', 'ambiguous'] as Cls[]) {
    console.log(`  ${c.padEnd(15)} ${String(buckets[c].length).padStart(5)}  (${pct(buckets[c].length)})`)
  }
  const remediateCount = remediate.reduce((n, c) => n + buckets[c].length, 0)
  console.log(`\n  → remediate (wrong/blurb/llm): ${remediateCount}; of those with suspect birth/death/country set: ${suspectYears.length}`)
  console.log(`  → keep (ok + legal_name): ${buckets.ok.length + buckets.legal_name.length}; review (ambiguous): ${buckets.ambiguous.length}`)

  const sample = (c: Cls, n = 25) =>
    buckets[c].slice(0, n).map((r) => `- **${r.display_name}**${r.birth_year ? ` _(b=${r.birth_year}${r.death_year ? `,d=${r.death_year}` : ''})_` : ''}: ${r.bio.replace(/\n/g, ' ').slice(0, 130)}…`).join('\n')

  const md = `# Author-bio contamination audit

Generated read-only by \`scripts/_audit_author_bio_contamination.ts\`. Root cause: \`enrich-author-bios.ts\` accepted the intro of the wrong Wikipedia article (book/film/band/award/other person) as an author bio — and wrote birth/death/country from the same article.

| class | count | % | action |
|---|---:|---:|---|
| ok | ${buckets.ok.length} | ${pct(buckets.ok.length)} | keep |
| legal_name | ${buckets.legal_name.length} | ${pct(buckets.legal_name.length)} | keep |
| wrong_entity | ${buckets.wrong_entity.length} | ${pct(buckets.wrong_entity.length)} | **null** |
| own_book_blurb | ${buckets.own_book_blurb.length} | ${pct(buckets.own_book_blurb.length)} | **null** |
| llm_artifact | ${buckets.llm_artifact.length} | ${pct(buckets.llm_artifact.length)} | **null** |
| ambiguous | ${buckets.ambiguous.length} | ${pct(buckets.ambiguous.length)} | review |

**Remediate total:** ${remediateCount} bios; **${suspectYears.length}** of those also carry a birth/death/country written from the same bad article.

## wrong_entity (a different entity/person)
${sample('wrong_entity')}

## own_book_blurb (a book, not the author)
${sample('own_book_blurb')}

## llm_artifact (leaked model meta-text)
${sample('llm_artifact')}

## ambiguous (needs human review)
${sample('ambiguous', 30)}

## legal_name (KEEP — real-name/pen-name bios, must not be nulled)
${sample('legal_name', 20)}
`
  fs.writeFileSync(OUT, md)
  console.log(`\nReport → ${OUT}\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
