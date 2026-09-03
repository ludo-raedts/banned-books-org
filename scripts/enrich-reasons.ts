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
 * Available reason slugs:
 *   lgbtq, sexual, racial, political, religious, violence, language,
 *   drugs, obscenity, moral, blasphemy, other
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
import { flagValue, intFlag, isApply } from './lib/cli'

const APPLY = isApply()
const BATCH_SIZE = 8
const RATE_LIMIT_MS = 150

const CLASS = (flagValue('class') ?? 'both') as 'untagged' | 'other' | 'both'
if (!['untagged', 'other', 'both'].includes(CLASS)) {
  throw new Error(`--class must be untagged | other | both (got "${CLASS}")`)
}
const LIMIT = intFlag('limit', 0) // 0 = no cap
const REPORT = flagValue('report')

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

const VALID_REASONS = new Set([
  'lgbtq', 'sexual', 'racial', 'political', 'religious',
  'violence', 'language', 'drugs', 'obscenity', 'moral', 'blasphemy', 'other',
])

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
- lgbtq       = LGBTQ+ characters, relationships, or themes
- sexual      = Sexual content, romance, sex education, body topics
- racial      = Race, racism, colonialism, civil rights, slavery, ethnic conflict
- political   = Political ideology, government, war, propaganda
- religious   = Religious content (any tradition, including critique)
- violence    = Violence or graphic content
- language    = Offensive language / profanity
- drugs       = Drug or substance use
- obscenity   = Obscenity (often overlaps with sexual)
- moral       = Immorality or "inappropriate for age" values
- blasphemy   = Blasphemy specifically
- other       = Last resort only

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

async function main() {
  console.log(`\n── enrich-reasons (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const supabase = adminClient()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // Load reason slug → id map
  const { data: reasonRows } = await supabase.from('reasons').select('id, slug')
  const reasonIdMap = new Map((reasonRows ?? []).map(r => [r.slug, r.id as number]))
  const otherId = reasonIdMap.get('other')!

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
    desc: string; slugs: string[] }
  const reportRows: ReportRow[] = []

  let updated = 0, kept = 0, errored = 0

  for (let i = 0; i < limit; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, limit)
    const batch = targets.slice(i, batchEnd)

    const results = await Promise.all(batch.map(async (ban) => {
      const book = ban.books
      if (!book) return { ban, slugs: ['other'] as string[] }
      const author = book.book_authors?.[0]?.authors?.display_name ?? ''
      const slugs = await classifyReasons(openai, {
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
      })
      return { ban, book, author, slugs }
    }))

    for (let j = 0; j < results.length; j++) {
      const { ban, book, author, slugs } = results[j]
      const n = i + j + 1
      const title = book?.title ?? `ban#${ban.id}`

      if (REPORT) {
        reportRows.push({
          banId: ban.id, bookId: book?.id ?? null, title, author: author ?? '',
          cls: untaggedIds.has(ban.id) ? 'untagged' : "only-'other'",
          country: ban.country_code ?? '', year: ban.year_started,
          region: ban.region ?? '', institution: ban.institution ?? '',
          desc: ban.description ?? '', slugs,
        })
      }

      if (!APPLY) {
        if (!REPORT) {
          console.log(`  [${n}/${limit}] "${title}" — ${author}`)
          console.log(`    Reasons: ${slugs.join(', ')}`)
          console.log()
        } else if (n % 25 === 0 || n === limit) {
          console.log(`  … ${n}/${limit} classified`)
        }
        continue
      }

      // If the only result is still 'other', skip (nothing to improve)
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
    const noDesc = reportRows.filter((r) => !r.desc)
    const lines: string[] = []
    lines.push(`# enrich-reasons ${APPLY ? 'applied' : 'DRY-RUN'} — class ${CLASS}`)
    lines.push('')
    lines.push(`Run: ${new Date().toISOString()} · model gpt-4o-mini · ${reportRows.length} bans classified`)
    lines.push(APPLY ? 'Written to ban_reason_links.' : 'Nothing was written to the database.')
    lines.push('')
    lines.push(`- would stay 'other' (no specific reason found): **${stillOther.length}**`)
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
    lines.push('| ban | book | title | event | proposed | has per-event description |')
    lines.push('| --- | --- | --- | --- | --- | --- |')
    for (const r of reportRows) {
      const event = [r.country, r.year ?? '', r.region, r.institution].filter(Boolean).join(' · ').replace(/\|/g, '/')
      lines.push(`| ${r.banId} | ${r.bookId ?? '-'} | ${r.title.replace(/\|/g, '/')} | ${event} | ${r.slugs.join(', ')} | ${r.desc ? 'yes' : 'no'} |`)
    }
    lines.push('')
    lines.push('## Rows with a per-event description (the strongest signal)')
    lines.push('')
    for (const r of reportRows.filter((x) => x.desc)) {
      lines.push(`- **ban ${r.banId}** "${r.title}" → \`${r.slugs.join(', ')}\``)
      lines.push(`  > ${r.desc.replace(/\s+/g, ' ').slice(0, 400)}`)
    }
    writeFileSync(REPORT, lines.join('\n') + '\n')
    console.log(`\nreport → ${REPORT} (${reportRows.length} rows)`)
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
