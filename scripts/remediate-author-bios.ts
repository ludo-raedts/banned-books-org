/**
 * Remediate contaminated author bios produced by enrich-author-bios.ts, which
 * accepted the intro of the WRONG Wikipedia article as an author bio. Four
 * failure modes exist and only an LLM can tell them apart reliably:
 *   - wrong_entity  : bio is about a book/film/band/award/topic, not a person
 *   - wrong_person  : bio is about a DIFFERENT real person with the same name
 *                     (e.g. "Suzanne Walker" the microbiologist vs. the comics
 *                     author) — deterministic name-matching CANNOT catch this,
 *                     since the name is the subject either way.
 *   - own_book_blurb: bio describes the author's own book, not the author
 *   - correct       : genuinely about this author (incl. legal-name/pen-name)
 *
 * This script asks gpt-4o-mini to CLASSIFY (not generate) each stored bio
 * against the author's name + the book titles we actually hold for them. A bio
 * that names one of those titles, or plausibly describes their author, is
 * "correct"; one describing a different profession/entity is not.
 *
 * On --apply it backs up every row it will touch to a CSV, then NULLs the bio
 * AND the birth_year / death_year / birth_country (those were written from the
 * same bad article, so they're suspect too). "correct" rows are untouched;
 * "uncertain" rows are left in place and logged for human review.
 *
 * Loop guard: nulling a bio sets bio IS NULL again, which is exactly what
 * enrich-author-bios.ts selects on — left alone it would refetch the same wrong
 * Wikipedia page and rewrite the same bad bio forever. So on --apply every
 * nulled author id is added to the enricher's `bios.skippedIds`
 * (data/enrich-author-bios.state.json), which the enricher already excludes.
 * Recover a wrongly-blocked author with the enricher's --retry-skipped.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/remediate-author-bios.ts                          # dry-run, sample 40
 *   npx tsx --env-file=.env.local scripts/remediate-author-bios.ts --slugs=suzanne-walker,jo-hirst,george-orwell,eva-darrows
 *   npx tsx --env-file=.env.local scripts/remediate-author-bios.ts --limit=300
 *   npx tsx --env-file=.env.local scripts/remediate-author-bios.ts --apply                   # full run, writes
 */
import fs from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'

// Shared with enrich-author-bios.ts. When we NULL a bio here, the enricher would
// otherwise re-select it (bio IS NULL), re-run the SAME deterministic Wikipedia
// search, and rewrite the SAME wrong bio — an endless enrich↔remediate pingpong.
// We close the loop by adding every nulled author id to the enricher's
// `bios.skippedIds`, which it already excludes. (`--retry-skipped` / `--reset-cache`
// on the enricher remain the escape hatch if a remediation was too strict.)
const ENRICH_CACHE_PATH = path.resolve(process.cwd(), 'data/enrich-author-bios.state.json')

function blockInEnrichCache(ids: number[]): number {
  if (!ids.length) return 0
  let cache: { bios?: { skippedIds?: number[] }; photosOnly?: { skippedIds?: number[] }; updatedAt?: string } = {}
  try {
    cache = JSON.parse(fs.readFileSync(ENRICH_CACHE_PATH, 'utf8'))
  } catch {
    /* missing/unreadable → start fresh */
  }
  cache.bios ??= { skippedIds: [] }
  cache.bios.skippedIds ??= []
  cache.photosOnly ??= { skippedIds: [] }
  cache.photosOnly.skippedIds ??= []
  const merged = new Set<number>(cache.bios.skippedIds)
  const before = merged.size
  for (const id of ids) merged.add(id)
  cache.bios.skippedIds = [...merged]
  cache.updatedAt = new Date().toISOString()
  fs.mkdirSync(path.dirname(ENRICH_CACHE_PATH), { recursive: true })
  fs.writeFileSync(ENRICH_CACHE_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf8')
  return merged.size - before
}

const APPLY = process.argv.includes('--apply')
const arg = (k: string) => process.argv.find((x) => x.startsWith(`--${k}=`))?.split('=')[1]
const LIMIT = arg('limit') ? parseInt(arg('limit')!, 10) : Number.POSITIVE_INFINITY
const SLUGS = arg('slugs')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null
const CONCURRENCY = arg('concurrency') ? parseInt(arg('concurrency')!, 10) : 6
const MODEL = arg('model') ?? 'gpt-4o-mini'

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const BACKUP = `data/author-bio-remediation-backup-${ts}.csv`
const PROPOSALS = `data/author-bio-remediation-${APPLY ? 'applied' : 'dryrun'}-${ts}.jsonl`
const REVIEW = `data/author-bio-remediation-uncertain-${ts}.jsonl`

type Verdict = 'correct' | 'wrong_person' | 'not_a_bio' | 'uncertain'
const NULL_VERDICTS: Verdict[] = ['wrong_person', 'not_a_bio']

type Row = {
  id: number
  slug: string
  display_name: string
  bio: string
  birth_year: number | null
  death_year: number | null
  birth_country: string | null
  book_authors: Array<{ books: { title: string | null } | null }> | null
}

function titlesOf(r: Row): string[] {
  return [...new Set((r.book_authors ?? []).map((ba) => ba.books?.title).filter((t): t is string => !!t))].slice(0, 8)
}

const SYSTEM =
  'You validate a stored author biography. You are given an author name, the book titles we hold for that author, and a stored bio. Decide which ONE label fits the bio:\n' +
  '- "correct": the bio is about this author — the writer of those books (this includes legal-name or pen-name bios, e.g. a real name that notes the pen name).\n' +
  '- "wrong_person": the bio is about a DIFFERENT real person who merely shares the name — a different career/field, clearly not the writer of these books. NOTE: a bio that leads with the author\'s real/legal name and notes the stored name as a pen name (e.g. "Hillary Monahan ... pen names include Eva Darrows") is the SAME person → that is "correct", NOT wrong_person.\n' +
  '- "not_a_bio": the FIRST SENTENCE\'s grammatical subject is a work or topic, not the person — it opens like "The Gender Fairy is a 2015 picture book ..." or "Son of Sam was an American punk band ...". Label this not_a_bio even if the author is named later in it.\n' +
  '- "uncertain": genuinely not enough information to decide.\n' +
  'KEY TEST: look at the FIRST SENTENCE. If its subject is the PERSON (e.g. "D. H. Lawrence is best known for Lady Chatterley\'s Lover ...", "Khaled Hosseini is an Afghan-American novelist ..."), it is "correct" even when it then discusses their books. If its subject is a WORK (a book/film/band/award), it is "not_a_bio". Legal-name/pen-name bios that open with the real name are "correct". Reply with strict JSON only: {"verdict":"...","reason":"<max 8 words>"}.'

async function classify(openai: OpenAI, r: Row): Promise<{ verdict: Verdict; reason: string } | null> {
  const titles = titlesOf(r)
  const user =
    `Author name: ${r.display_name}\n` +
    `Books we hold for this author: ${titles.length ? titles.join('; ') : '(none recorded)'}\n` +
    `Stored bio:\n"""${r.bio.slice(0, 1200)}"""`
  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
    })
    const txt = res.choices[0]?.message?.content ?? ''
    const j = JSON.parse(txt) as { verdict?: string; reason?: string }
    const v = (j.verdict ?? '').toLowerCase()
    if (v !== 'correct' && v !== 'wrong_person' && v !== 'not_a_bio' && v !== 'uncertain') return null
    return { verdict: v as Verdict, reason: (j.reason ?? '').slice(0, 80) }
  } catch {
    return null
  }
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

async function pool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>) {
  let idx = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (idx < items.length) {
        const i = idx++
        await fn(items[i], i)
      }
    }),
  )
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set in .env.local')
    process.exit(1)
  }
  const sb = adminClient()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const SELECT = 'id, slug, display_name, bio, birth_year, death_year, birth_country, book_authors(books(title))'
  const rows: Row[] = []
  if (SLUGS) {
    const { data, error } = await sb.from('authors').select(SELECT).in('slug', SLUGS).not('bio', 'is', null)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as unknown as Row[]))
  } else {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('authors').select(SELECT).not('bio', 'is', null).order('id').range(from, from + 999)
      if (error) throw new Error(error.message)
      if (!data?.length) break
      rows.push(...(data as unknown as Row[]))
      if (data.length < 1000) break
    }
  }

  const batch = SLUGS ? rows : Number.isFinite(LIMIT) ? rows.slice(0, LIMIT) : APPLY ? rows : rows.slice(0, 40)
  console.log(`\n── remediate-author-bios (${APPLY ? 'APPLY' : 'DRY-RUN'}) model=${MODEL} conc=${CONCURRENCY} ──`)
  console.log(`Authors with a bio: ${rows.length}; classifying ${batch.length}\n`)

  const counts: Record<Verdict, number> = { correct: 0, wrong_person: 0, not_a_bio: 0, uncertain: 0 }
  const nulledIds: number[] = []
  let errors = 0,
    nulled = 0
  const propStream = fs.createWriteStream(PROPOSALS, { flags: 'a' })
  const reviewStream = fs.createWriteStream(REVIEW, { flags: 'a' })
  let backupStream: fs.WriteStream | null = null
  if (APPLY) {
    backupStream = fs.createWriteStream(BACKUP, { flags: 'a' })
    backupStream.write('id,slug,display_name,verdict,bio,birth_year,death_year,birth_country\n')
  }

  await pool(batch, CONCURRENCY, async (r) => {
    const result = await classify(openai, r)
    if (!result) {
      errors++
      return
    }
    counts[result.verdict]++
    propStream.write(JSON.stringify({ id: r.id, slug: r.slug, name: r.display_name, verdict: result.verdict, reason: result.reason, bio: r.bio.slice(0, 120) }) + '\n')

    if (result.verdict === 'uncertain') {
      reviewStream.write(JSON.stringify({ id: r.id, slug: r.slug, name: r.display_name, reason: result.reason, bio: r.bio.slice(0, 200) }) + '\n')
    }

    const tag = result.verdict === 'correct' ? '·' : result.verdict === 'uncertain' ? '?' : '✗'
    console.log(`  ${tag} ${r.display_name.slice(0, 36).padEnd(36)} ${result.verdict.padEnd(13)} ${result.reason}`)

    if (NULL_VERDICTS.includes(result.verdict)) {
      if (APPLY) {
        backupStream!.write(
          [r.id, r.slug, r.display_name, result.verdict, r.bio, r.birth_year, r.death_year, r.birth_country].map(csvCell).join(',') + '\n',
        )
        const { error } = await sb
          .from('authors')
          .update({ bio: null, birth_year: null, death_year: null, birth_country: null })
          .eq('id', r.id)
        if (error) errors++
        else {
          nulled++
          nulledIds.push(r.id)
        }
      } else {
        nulled++
        nulledIds.push(r.id)
      }
    }
  })

  propStream.end()
  reviewStream.end()
  backupStream?.end()

  // Close the enrich↔remediate loop: pin every nulled author so the enricher
  // won't refetch the same wrong Wikipedia page next run.
  const newlyBlocked = APPLY ? blockInEnrichCache(nulledIds) : 0

  console.log(`
── Summary ──────────────────────────────
  Classified:                 ${batch.length - errors}
  correct (keep):             ${counts.correct}
  wrong_person → null:        ${counts.wrong_person}
  not_a_bio   → null:         ${counts.not_a_bio}
  uncertain (review):         ${counts.uncertain}
  classify errors:            ${errors}
  rows ${APPLY ? 'nulled' : 'to null'}:              ${nulled}
  ${APPLY ? `enrich-cache blocked:        +${newlyBlocked} (won't be re-enriched)` : 'enrich-cache:                (apply blocks nulled ids from re-enrichment)'}
  proposals → ${PROPOSALS}
  uncertain → ${REVIEW}
  ${APPLY ? `backup → ${BACKUP}\n  Written ✓ (bio+birth/death/country nulled for wrong_person/not_a_bio)` : 'DRY-RUN — add --apply to write (backs up before nulling)'}
`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
