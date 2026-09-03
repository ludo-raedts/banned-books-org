/**
 * Classify ban reasons for bans that carry no usable reason yet — either only
 * 'other', or (since 2026-09-03) no reason link at all.
 * Uses GPT-4o-mini to infer reasons from per-event ban context (description,
 * jurisdiction, action_type) layered with book-level fallback context
 * (description_ban, censorship_context, book description).
 *
 * Ban-event context is the strongest signal — a PEN America district entry
 * may state "removed for sexual content" explicitly, which is decisive even
 * when the book's plot description is generic. Book-level context is the
 * fallback when the ban event has no description of its own.
 *
 * Two candidate classes, both "no usable reason on the row":
 *   - only 'other'      — the original target (~1.7k rows)
 *   - NO reason link     — used to be skipped outright (the filter required at
 *     least one existing link), even though an untagged ban is strictly worse
 *     off than one tagged 'other'. ~147 rows DB-wide, and they are not junk:
 *     the Utah HB 29 statewide rows and other hand-written imports land here
 *     with a full per-event description and no tags at all.
 * Rows that already carry a specific reason are never touched — this script
 * only fills gaps, it does not re-litigate existing classifications.
 *
 * The reason vocabulary is read from the `reasons` table at runtime, so the
 * prompt can never offer a slug the DB has no row for (it used to offer
 * 'blasphemy', which silently dropped every time the model chose it).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-reasons.ts
 *     → dry-run over the whole catalogue: counts + 5 sample classifications
 *   npx tsx --env-file=.env.local scripts/enrich-reasons.ts --apply
 *     → fills the gap rows in ban_reason_links
 *   npx tsx --env-file=.env.local scripts/enrich-reasons.ts --book-ids=37,209 --apply
 *   npx tsx --env-file=.env.local scripts/enrich-reasons.ts --ids-file=data/x.txt --apply
 *     → SCOPE to those books only.
 *   --class=untagged | other | both   (default both) — pick one candidate class
 *   --limit=N                          cap the candidate set (cheap first look)
 *   --grounded-only                    write ONLY reasons the ban event's own
 *                                      description states; leave rows whose
 *                                      description states no ground untagged
 *                                      instead of guessing from book themes
 *   --apply-from=data/foo.json         write the decisions of a previous
 *                                      --report dry-run verbatim (guarded: a
 *                                      row that has since been tagged is
 *                                      skipped). Avoids a second LLM pass and
 *                                      guarantees applied == reviewed
 *   --report=data/foo.md               classify EVERY candidate and write a
 *                                      review artifact. In a dry-run this is
 *                                      how you see all proposals before
 *                                      writing anything (the plain dry-run only
 *                                      prints 5 samples).
 *
 * Candidate ids are resolved over a direct Postgres connection first, so a run
 * loads only the rows it will actually classify instead of the whole ~36k-row
 * bans table over PostgREST. Every candidate still costs one LLM call, so scope
 * or --limit any exploratory run.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'
import { newPgClient } from '../src/lib/wikipedia/importer'
import { flagValue, hasFlag, intFlag, isApply } from './lib/cli'

const APPLY = isApply()
const BATCH_SIZE = 8
const RATE_LIMIT_MS = 150

const CLASS = (flagValue('class') ?? 'both') as 'untagged' | 'other' | 'both'
if (!['untagged', 'other', 'both'].includes(CLASS)) {
  throw new Error(`--class must be untagged | other | both (got "${CLASS}")`)
}
const LIMIT = intFlag('limit', 0) // 0 = no cap
const REPORT = flagValue('report')
// --grounded-only: write ONLY the reasons the ban event's own description states,
// never the ones inferred from the book's themes. Rows whose description states
// no reason are left untagged instead of being filled with book-level guesses.
const GROUNDED_ONLY = hasFlag('grounded-only')
// --apply-from=<json>: write the decisions from a previous --grounded-only
// dry-run instead of re-classifying, so what was reviewed is exactly what lands
// (and the LLM is billed once, not twice).
const APPLY_FROM = flagValue('apply-from')

/** Book-id scope from --book-ids=1,2,3 or --ids-file=<one id per line>. */
function scopeBookIds(): number[] | null {
  const inline = flagValue('book-ids')
  const file = flagValue('ids-file')
  const raw = inline ?? (file ? readFileSync(file, 'utf8').split(/\s+/).join(',') : null)
  if (raw == null) return null
  const ids = [...new Set(raw.split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite))]
  if (ids.length === 0) throw new Error('scope flag given but no valid book ids parsed')
  return ids
}

// One-line gloss per slug for the prompt. The VOCABULARY itself comes from the
// reasons table at runtime (see loadVocabulary) — this map only supplies wording.
//
// Why: this list used to be a hardcoded Set that included 'blasphemy', which has
// no row in the reasons table. Every time the model answered "blasphemy" the id
// lookup returned undefined and the slug was dropped without a word — three
// Satanic Verses rows whose descriptions say "banned for blasphemy against
// Islam" classified fine and then wrote nothing at all. A vocabulary that can
// silently disagree with the DB is the bug; deriving it from the DB is the fix.
const REASON_GUIDE: Record<string, string> = {
  lgbtq: 'LGBTQ+ characters, relationships, or themes',
  sexual: 'Sexual content, romance, sex education, body topics',
  racial: 'Race, racism, colonialism, civil rights, slavery, ethnic conflict',
  political: 'Political ideology, government, war, propaganda',
  religious: 'Religious content or grounds (any tradition, including critique and blasphemy)',
  violence: 'Violence or graphic content',
  language: 'Offensive language / profanity',
  drugs: 'Drug or substance use',
  obscenity: 'Obscenity (often overlaps with sexual)',
  moral: 'Immorality or "inappropriate for age" values',
  other: 'Last resort only',
}

/** The reason slugs that actually exist in the DB. Set once in main(). */
let VALID_REASONS: Set<string> = new Set()

/** Prompt-ready "- slug = gloss" block for the live vocabulary. */
function vocabularyBlock(): string {
  return [...VALID_REASONS]
    .map((slug) => `- ${slug.padEnd(11)} = ${REASON_GUIDE[slug] ?? slug}`)
    .join('\n')
}

async function loadVocabulary(supabase: ReturnType<typeof adminClient>): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('reasons').select('id, slug')
  if (error) throw new Error(`reasons: ${error.message}`)
  const map = new Map((data ?? []).map((r) => [r.slug as string, r.id as number]))
  VALID_REASONS = new Set(map.keys())
  const undescribed = [...VALID_REASONS].filter((s) => !REASON_GUIDE[s])
  if (undescribed.length) {
    console.warn(`⚠ reasons table has slug(s) with no gloss in REASON_GUIDE: ${undescribed.join(', ')}`)
  }
  return map
}

/**
 * Evidence cues per reason, used ONLY in --grounded-only mode as a verifier on
 * the model's STATED line. gpt-4o-mini leaks: asked which reason the ban
 * description states, it will still answer "blasphemy" for a row that says only
 * "banned under apartheid-era publications law" — the ground comes from what it
 * knows about the book, not from the text. So a stated slug is kept only when
 * the description carries a lexical trace of it. Deliberately strict: for a
 * "sourced reasons only" pass, dropping a paraphrase is the safe error and the
 * report lists every drop for review.
 */
const EVIDENCE_CUES: Record<string, RegExp> = {
  blasphemy: /blasphem|sacrileg|heres(y|ies)|apostas/i,
  religious: /religio|islam|muslim|christ|catholic|church|bible|qur.?an|koran|hindu|jewish|juda|prophet|anti-?christian|sacrileg|blasphem/i,
  sexual: /\bsex|erotic|nudity|nude|explicit|intimate|pornograph|inappropriate content of a sexual|sexual/i,
  obscenity: /obscen|pornograph|indecen|filth|smut/i,
  violence: /violen|graphic|gore|brutal|torture|abuse/i,
  language: /\blanguage\b|profan|swear|curse|vulgar|obscene language|f-word/i,
  drugs: /\bdrugs?\b|narcotic|alcohol|substance (use|abuse)|marijuana|cocaine|heroin|smoking/i,
  lgbtq: /lgbt|\bgay\b|lesbian|queer|transgender|trans(sexual|gender)|homosexu|gender (identity|fluid|ideology)|same-?sex|sexual orientation/i,
  racial: /racis|racial|\brace\b|ethnic|colonial|slavery|insult to the|derogatory|stereotyp|apartheid/i,
  political: /politic|propaganda|communis|marxis|anti-?war|subversi|sedition|state security|national interest|regime|dissent|revolution/i,
  moral: /immoral|moral|indecen|inappropriate|unsuitable|age-?inappropriate|values|sensitive material|corrupt|harmful to (minors|children|youth)/i,
}

/** Keep only the stated slugs the description actually evidences. */
function verifyStated(stated: string[], description: string): { kept: string[]; dropped: string[] } {
  const kept: string[] = []
  const dropped: string[] = []
  for (const slug of stated) {
    const cue = EVIDENCE_CUES[slug]
    if (cue && description && cue.test(description)) kept.push(slug)
    else dropped.push(slug)
  }
  return { kept, dropped }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

type ClassifyContext = {
  title: string
  author: string
  bookDescription: string   // books.description_book
  bookBanContext: string    // books.description_ban ?? books.censorship_context
  banDescription: string    // bans.description (per-event, strongest signal)
  actionType: string        // banned | challenged | removed | restricted | blocked
  region: string
  institution: string
  countryCode: string
  yearStarted: number | null
}

async function classifyReasons(
  client: OpenAI,
  ctx: ClassifyContext,
): Promise<string[]> {
  const eventMeta = [
    ctx.actionType,
    ctx.institution,
    ctx.region,
    ctx.countryCode,
    ctx.yearStarted ? String(ctx.yearStarted) : null,
  ].filter(Boolean).join(' · ')

  const prompt = `You are tagging a single ban event of a book with the reasons it was challenged or banned. PRIORITIZE the ban-event context below — it explains why THIS jurisdiction acted, often more specifically than the book's general theme.

Ban event:
  ${eventMeta || '(no jurisdiction metadata)'}
${ctx.banDescription ? `  Ban description: ${ctx.banDescription.slice(0, 600)}\n` : ''}${ctx.bookBanContext ? `  Why this book is commonly banned: ${ctx.bookBanContext.slice(0, 400)}\n` : ''}
Book: "${ctx.title}" by ${ctx.author || 'unknown'}
${ctx.bookDescription ? `Plot: ${ctx.bookDescription.slice(0, 400)}\n` : ''}
Choose ALL applicable reason slugs (comma-separated, lowercase). Prefer SPECIFIC reasons. Use 'other' ONLY as a last resort when none of the specific reasons could plausibly apply.
${vocabularyBlock()}

Output ONLY the comma-separated slugs, nothing else. Example: lgbtq,sexual`

  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 60,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.choices[0]?.message?.content?.trim() ?? ''
    const slugs = text
      .toLowerCase()
      .split(',')
      .map(s => s.trim())
      .filter(s => VALID_REASONS.has(s))
    if (slugs.length === 0) return ['other']
    // 'other' is a last resort, never a co-tag: gpt-4o-mini routinely hedges by
    // appending 'other' alongside a specific slug. Drop it whenever any specific
    // reason was found, so 'other' survives only as the sole classification.
    const specific = [...new Set(slugs.filter(s => s !== 'other'))]
    return specific.length > 0 ? specific : ['other']
  } catch { return ['other'] }
}

/**
 * Two-signal variant for --grounded-only. Splits the classification into what
 * THIS ban event's description actually states (or unmistakably implies) and
 * what merely follows from the book's themes. Only the first half is a sourced
 * fact; the second is inference that happens to sit in the same column, so a
 * run that cares about the distinction can write the stated half alone.
 */
async function classifyGrounded(
  client: OpenAI,
  ctx: ClassifyContext,
): Promise<{ stated: string[]; inferred: string[] }> {
  const eventMeta = [
    ctx.actionType, ctx.institution, ctx.region, ctx.countryCode,
    ctx.yearStarted ? String(ctx.yearStarted) : null,
  ].filter(Boolean).join(' · ')

  const prompt = `You are tagging one ban event of a book with the reasons it was banned or challenged, and separating SOURCED from INFERRED.

Ban event:
  ${eventMeta || '(no jurisdiction metadata)'}
  Ban description: ${ctx.banDescription ? ctx.banDescription.slice(0, 800) : '(none)'}

Book: "${ctx.title}" by ${ctx.author || 'unknown'}
${ctx.bookBanContext ? `Why this book is commonly banned: ${ctx.bookBanContext.slice(0, 400)}\n` : ''}${ctx.bookDescription ? `Plot: ${ctx.bookDescription.slice(0, 400)}\n` : ''}
Valid slugs (use ONLY these — nothing else exists in the database):
${vocabularyBlock()}

Answer on exactly two lines:
STATED: slugs the BAN DESCRIPTION itself states or unmistakably implies as the ground for THIS action. A description naming the objection ("banned for blasphemy", "over objectionable language", "cited as anti-war propaganda", "asked whether it depicts a sex act", "removed as pornographic") is stated. A description that only records the action ("banned from libraries in X district", "removed after a complaint", "moved to a restricted shelf") states NOTHING, even when you can guess why — write "none" then. Legal or policy language counts only if it names the content objection, not merely a statute number.
INFERRED: additional slugs that follow from the book's themes but are NOT stated by the description. May be "none".

Output only those two lines, comma-separated slugs, lowercase. Example:
STATED: language
INFERRED: violence, sexual`

  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 80,
      // A sourced/inferred split is a gate, not a creative task: at the default
      // temperature the same row flips between runs (the Tintin Brussels row
      // states "an insult to the Congolese people" and scored racial on one
      // pass, nothing on the next).
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.choices[0]?.message?.content ?? ''
    const pick = (label: string): string[] => {
      const line = text.split('\n').find((l) => l.trim().toUpperCase().startsWith(label))
      if (!line) return []
      return [...new Set(line.slice(line.indexOf(':') + 1)
        .toLowerCase().split(',').map((x) => x.trim())
        // 'other' is never a *stated* reason — it is the absence of one.
        .filter((x) => VALID_REASONS.has(x) && x !== 'other'))]
    }
    const stated = pick('STATED')
    const inferred = pick('INFERRED').filter((x) => !stated.includes(x))
    return { stated, inferred }
  } catch { return { stated: [], inferred: [] } }
}

/**
 * Candidate ban ids for the requested class, resolved in SQL. PostgREST cannot
 * express "has no reason link", so doing this over the REST select meant pulling
 * every ban in the catalogue and filtering in memory.
 */
async function candidateBanIds(scope: number[] | null): Promise<{ untagged: number[]; onlyOther: number[] }> {
  const pg = newPgClient()
  await pg.connect()
  try {
    const scopeSql = scope ? 'and b.book_id = any($1)' : ''
    const params = scope ? [scope] : []
    const { rows: untagged } = await pg.query(
      `select b.id from bans b
       where not exists (select 1 from ban_reason_links l where l.ban_id = b.id) ${scopeSql}
       order by b.id`, params)
    const { rows: onlyOther } = await pg.query(
      `select b.id from bans b
       where exists (
           select 1 from ban_reason_links l join reasons r on r.id = l.reason_id
           where l.ban_id = b.id and r.slug = 'other')
         and not exists (
           select 1 from ban_reason_links l join reasons r on r.id = l.reason_id
           where l.ban_id = b.id and r.slug <> 'other')
         ${scopeSql}
       order by b.id`, params)
    return {
      untagged: untagged.map((r) => Number(r.id)),
      onlyOther: onlyOther.map((r) => Number(r.id)),
    }
  } finally {
    await pg.end()
  }
}

/**
 * Write the decisions of a previous dry-run (--report's JSON twin) verbatim.
 * Guarded: a ban that has since acquired reason links is skipped, so this can
 * never overwrite a classification that arrived after the review.
 */
async function applyFromFile(
  supabase: ReturnType<typeof adminClient>,
  reasonIdMap: Map<string, number>,
): Promise<void> {
  type Decision = { ban_id: number; book_id: number | null; title: string; write: string[] }
  const parsed = JSON.parse(readFileSync(APPLY_FROM as string, 'utf8')) as
    { generatedAt: string; mode: string; decisions: Decision[] }
  const all = parsed.decisions ?? []
  const writable = all.filter((d) => d.write.length > 0)
  console.log(`Decisions file : ${APPLY_FROM}`)
  console.log(`  generated    : ${parsed.generatedAt} (mode ${parsed.mode})`)
  console.log(`  decisions    : ${all.length}, of which with reasons to write: ${writable.length}`)
  if (!APPLY) {
    console.log('\nDRY-RUN — pass --apply to write these decisions.')
    for (const d of writable.slice(0, 10)) console.log(`  ban ${d.ban_id} "${d.title}" → ${d.write.join(', ')}`)
    return
  }

  let written = 0, skipped = 0, errored = 0
  for (const d of writable) {
    // exact-state guard: only fill rows that are still untagged
    const { data: existing, error: qe } = await supabase
      .from('ban_reason_links').select('reason_id').eq('ban_id', d.ban_id)
    if (qe) { errored++; console.error(`  ban ${d.ban_id}: ${qe.message}`); continue }
    if ((existing ?? []).length > 0) {
      skipped++
      console.log(`  skip ban ${d.ban_id} "${d.title}": already has ${existing?.length} reason link(s)`)
      continue
    }
    const unknown = d.write.filter((slug) => !reasonIdMap.has(slug))
    if (unknown.length) {
      console.warn(`  ⚠ ban ${d.ban_id} "${d.title}": no reasons row for ${unknown.join(', ')} — not written`)
    }
    const inserts = d.write
      .map((slug) => reasonIdMap.get(slug))
      .filter((id): id is number => id !== undefined)
      .map((reason_id) => ({ ban_id: d.ban_id, reason_id }))
    if (inserts.length === 0) {
      skipped++
      console.log(`  skip ban ${d.ban_id} "${d.title}": nothing writable (${d.write.join(', ') || 'no slugs'})`)
      continue
    }
    const { error: ie } = await supabase.from('ban_reason_links').insert(inserts)
    if (ie) { errored++; console.error(`  ban ${d.ban_id}: ${ie.message}`); continue }
    written++
    console.log(`  ban ${d.ban_id} "${d.title}" → ${d.write.join(', ')}`)
  }
  console.log(`\n── Done ──`)
  console.log(`Rows written : ${written}`)
  console.log(`Skipped      : ${skipped} (already tagged / nothing to write)`)
  console.log(`Errors       : ${errored}`)
  console.log(`Left untagged by design: ${all.length - writable.length} (description states no reason)`)
}

async function main() {
  console.log(`\n── enrich-reasons (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const supabase = adminClient()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // Vocabulary + slug → id map, straight from the DB (never hardcoded)
  const reasonIdMap = await loadVocabulary(supabase)
  const otherId = reasonIdMap.get('other')!

  if (APPLY_FROM) {
    await applyFromFile(supabase, reasonIdMap)
    return
  }

  // Load all bans with paginated query (Supabase caps at 1000/request)
  type BanRow = {
    id: number
    country_code: string
    region: string | null
    institution: string | null
    action_type: string
    year_started: number | null
    description: string | null
    books: {
      id: number; slug: string; title: string
      description_book: string | null
      description_ban: string | null; censorship_context: string | null
      book_authors: Array<{ authors: { display_name: string } | null }>
    } | null
    ban_reason_links: Array<{ reasons: { id: number; slug: string } | null }>
  }

  const SELECT = `
    id, country_code, region, institution, action_type, year_started, description,
    books(id, slug, title, description_book, description_ban, censorship_context, book_authors(authors(display_name))),
    ban_reason_links(reasons(id, slug))
  `

  const scope = scopeBookIds()
  if (scope) console.log(`Scope: ${scope.length} book id(s) — ${scope.slice(0, 12).join(', ')}${scope.length > 12 ? ', …' : ''}\n`)

  // Candidates: rows with no usable reason — no link at all, or nothing but
  // 'other'. Resolved in SQL so only these rows travel over PostgREST.
  const cand = await candidateBanIds(scope)
  let ids = CLASS === 'untagged' ? cand.untagged
    : CLASS === 'other' ? cand.onlyOther
    : [...cand.untagged, ...cand.onlyOther]

  console.log(`Bans with no reason at all   : ${cand.untagged.length}`)
  console.log(`Bans with only 'other' reason: ${cand.onlyOther.length}`)
  console.log(`Candidate class              : ${CLASS}`)
  if (LIMIT > 0 && ids.length > LIMIT) {
    console.log(`Candidates                   : ${ids.length} → capped at ${LIMIT} (--limit)`)
    ids = ids.slice(0, LIMIT)
  } else {
    console.log(`Candidates                   : ${ids.length}`)
  }

  if (ids.length === 0) {
    console.log('Nothing to classify.')
    return
  }

  let allBans: BanRow[] = []
  for (let i = 0; i < ids.length; i += 1000) {
    const { data, error } = await supabase
      .from('bans').select(SELECT).in('id', ids.slice(i, i + 1000)).order('id')
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    allBans = allBans.concat((data ?? []) as unknown as BanRow[])
  }
  const untaggedIds = new Set(cand.untagged)
  const targets = allBans

  // A dry-run normally prints 5 samples; --report means "classify everything and
  // write it down" so the full proposal can be reviewed before any write.
  const limit = APPLY || REPORT ? targets.length : Math.min(5, targets.length)
  console.log(`\n${APPLY ? `Classifying ${targets.length} bans…`
    : REPORT ? `DRY-RUN — classifying all ${targets.length} for the report:`
    : `DRY-RUN — showing ${limit} samples:`}\n`)

  type ReportRow = { banId: number; bookId: number | null; title: string; author: string
    cls: string; country: string; year: number | null; region: string; institution: string
    desc: string; slugs: string[]; inferred: string[] }
  const reportRows: ReportRow[] = []

  let updated = 0, kept = 0, errored = 0

  for (let i = 0; i < limit; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, limit)
    const batch = targets.slice(i, batchEnd)

    const results = await Promise.all(batch.map(async (ban) => {
      const book = ban.books
      if (!book) return { ban, slugs: ['other'] as string[], inferred: [] as string[] }
      const author = book.book_authors?.[0]?.authors?.display_name ?? ''
      const ctx = {
        title: book.title,
        author,
        bookDescription: book.description_book ?? '',
        bookBanContext: book.description_ban ?? book.censorship_context ?? '',
        banDescription: ban.description ?? '',
        actionType: ban.action_type ?? '',
        region: ban.region ?? '',
        institution: ban.institution ?? '',
        countryCode: ban.country_code ?? '',
        yearStarted: ban.year_started,
      }
      if (GROUNDED_ONLY) {
        const { stated, inferred } = await classifyGrounded(openai, ctx)
        // Verifier: a slug survives only with lexical evidence in the
        // description. stated == [] afterwards means the row records the action
        // but no ground — it stays untagged rather than taking a book guess.
        const { kept, dropped } = verifyStated(stated, ctx.banDescription)
        return { ban, book, author, slugs: kept, inferred: [...inferred, ...dropped.map((d) => `${d} (unevidenced)`)] }
      }
      const slugs = await classifyReasons(openai, ctx)
      return { ban, book, author, slugs, inferred: [] as string[] }
    }))

    for (let j = 0; j < results.length; j++) {
      const { ban, book, author, slugs, inferred } = results[j]
      const n = i + j + 1
      const title = book?.title ?? `ban#${ban.id}`

      if (REPORT) {
        reportRows.push({
          banId: ban.id, bookId: book?.id ?? null, title, author: author ?? '',
          cls: untaggedIds.has(ban.id) ? 'untagged' : "only-'other'",
          country: ban.country_code ?? '', year: ban.year_started,
          region: ban.region ?? '', institution: ban.institution ?? '',
          desc: ban.description ?? '', slugs, inferred,
        })
      }

      if (!APPLY) {
        if (!REPORT) {
          console.log(`  [${n}/${limit}] "${title}" — ${author}`)
          console.log(`    ${GROUNDED_ONLY ? 'Stated' : 'Reasons'}: ${slugs.join(', ') || '(none)'}`)
          if (GROUNDED_ONLY && inferred.length) console.log(`    Inferred (not written): ${inferred.join(', ')}`)
          console.log()
        } else if (n % 25 === 0 || n === limit) {
          console.log(`  … ${n}/${limit} classified`)
        }
        continue
      }

      // Nothing usable: either the model found no specific reason at all, or
      // (--grounded-only) the event description states none. Leave the row as is.
      if (slugs.length === 0) { kept++; continue }
      if (slugs.length === 1 && slugs[0] === 'other') { kept++; continue }

      try {
        // Delete existing reason links for this ban
        const { error: de } = await supabase
          .from('ban_reason_links')
          .delete()
          .eq('ban_id', ban.id)
        if (de) throw de

        // Insert new reason links
        const inserts = slugs
          .map(slug => reasonIdMap.get(slug))
          .filter((id): id is number => id !== undefined)
          .map(reason_id => ({ ban_id: ban.id, reason_id }))

        if (inserts.length === 0) {
          await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: otherId })
          kept++
        } else {
          const { error: ie } = await supabase.from('ban_reason_links').insert(inserts)
          if (ie) throw ie
          console.log(`  [${n}/${limit}] "${title}" → ${slugs.join(', ')}`)
          updated++
        }
      } catch (err) {
        console.error(`  [${n}] error on ban ${ban.id}: ${err instanceof Error ? err.message : String(err)}`)
        errored++
      }
    }

    if (i + BATCH_SIZE < limit) await sleep(RATE_LIMIT_MS)
  }

  if (REPORT && reportRows.length) {
    const bySlug = new Map<string, number>()
    for (const r of reportRows) for (const sl of r.slugs) bySlug.set(sl, (bySlug.get(sl) ?? 0) + 1)
    const stillOther = reportRows.filter((r) => r.slugs.length === 1 && r.slugs[0] === 'other')
    const nothingStated = reportRows.filter((r) => r.slugs.length === 0)
    const noDesc = reportRows.filter((r) => !r.desc)
    const lines: string[] = []
    lines.push(`# enrich-reasons ${APPLY ? 'applied' : 'DRY-RUN'} — class ${CLASS}`)
    lines.push('')
    lines.push(`Run: ${new Date().toISOString()} · model gpt-4o-mini · ${reportRows.length} bans classified`)
    lines.push(APPLY ? 'Written to ban_reason_links.' : 'Nothing was written to the database.')
    lines.push('')
    if (GROUNDED_ONLY) {
      lines.push('Mode: **--grounded-only** — only reasons the ban event\'s own description states')
      lines.push('are written. Slugs under "inferred" follow from the book\'s themes and are')
      lines.push('deliberately NOT written.')
      lines.push('')
      lines.push(`- rows the description states a reason for (would be written): **${reportRows.length - nothingStated.length}**`)
      lines.push(`- rows whose description states no reason (left untagged): **${nothingStated.length}**`)
    } else {
      lines.push(`- would stay 'other' (no specific reason found): **${stillOther.length}**`)
    }
    lines.push(`- rows without a per-event description (book-level inference only): **${noDesc.length}**`)
    lines.push('')
    lines.push('## Proposed reasons per slug')
    lines.push('')
    lines.push('| slug | rows |')
    lines.push('| --- | --- |')
    for (const [sl, n] of [...bySlug.entries()].sort((a, b) => b[1] - a[1])) lines.push(`| ${sl} | ${n} |`)
    lines.push('')
    lines.push('## Per row')
    lines.push('')
    lines.push(`| ban | book | title | event | ${GROUNDED_ONLY ? 'STATED (written) | inferred (dropped)' : 'proposed'} | has per-event description |`)
    lines.push(`| --- | --- | --- | --- | ${GROUNDED_ONLY ? '--- | ---' : '---'} | --- |`)
    for (const r of reportRows) {
      const event = [r.country, r.year ?? '', r.region, r.institution].filter(Boolean).join(' · ').replace(/\|/g, '/')
      const cols = GROUNDED_ONLY
        ? `${r.slugs.join(', ') || '—'} | ${r.inferred.join(', ') || '—'}`
        : r.slugs.join(', ')
      lines.push(`| ${r.banId} | ${r.bookId ?? '-'} | ${r.title.replace(/\|/g, '/')} | ${event} | ${cols} | ${r.desc ? 'yes' : 'no'} |`)
    }
    lines.push('')
    lines.push('## Rows with a per-event description (the strongest signal)')
    lines.push('')
    for (const r of reportRows.filter((x) => x.desc)) {
      lines.push(`- **ban ${r.banId}** "${r.title}" → \`${r.slugs.join(', ') || 'nothing stated'}\`` +
        (GROUNDED_ONLY && r.inferred.length ? ` _(dropped: ${r.inferred.join(', ')})_` : ''))
      lines.push(`  > ${r.desc.replace(/\s+/g, ' ').slice(0, 400)}`)
    }
    writeFileSync(REPORT, lines.join('\n') + '\n')
    console.log(`\nreport → ${REPORT} (${reportRows.length} rows)`)

    // Machine-readable twin, so --apply-from can write exactly the reviewed
    // decisions instead of re-classifying (a second LLM pass would drift).
    if (!APPLY) {
      const jsonPath = REPORT.replace(/\.md$/, '') + '.json'
      writeFileSync(jsonPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        mode: GROUNDED_ONLY ? 'grounded-only' : 'all',
        model: 'gpt-4o-mini',
        decisions: reportRows.map((r) => ({
          ban_id: r.banId, book_id: r.bookId, title: r.title,
          write: r.slugs, dropped_inferred: r.inferred,
        })),
      }, null, 1) + '\n')
      console.log(`decisions → ${jsonPath}`)
    }
  }

  console.log(`\n── Done ──`)
  if (APPLY) {
    console.log(`Updated (replaced 'other'): ${updated}`)
    console.log(`Kept as 'other' (no better): ${kept}`)
    console.log(`Errors: ${errored}`)
  } else {
    console.log(`Would classify ${targets.length} bans. Re-run with --apply to write.\n`)
    if (!REPORT) console.log('Tip: --report=data/<file>.md classifies every candidate and writes a review artifact.\n')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
