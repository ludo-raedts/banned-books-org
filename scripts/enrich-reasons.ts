/**
 * Classify ban reasons for bans that currently only have 'other' as their reason.
 * Uses GPT-4o-mini to infer reasons from per-event ban context (description,
 * jurisdiction, action_type) layered with book-level fallback context
 * (description_ban, censorship_context, book description).
 *
 * Ban-event context is the strongest signal — a PEN America district entry
 * may state "removed for sexual content" explicitly, which is decisive even
 * when the book's plot description is generic. Book-level context is the
 * fallback when the ban event has no description of its own.
 *
 * Available reason slugs:
 *   lgbtq, sexual, racial, political, religious, violence, language,
 *   drugs, obscenity, moral, blasphemy, other
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-reasons.ts
 *     → dry-run: shows counts and 5 sample classifications, no writes
 *   npx tsx --env-file=.env.local scripts/enrich-reasons.ts --apply
 *     → replaces 'other' reason with inferred reasons in ban_reason_links
 */

import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const BATCH_SIZE = 8
const RATE_LIMIT_MS = 150

const VALID_REASONS = new Set([
  'lgbtq', 'sexual', 'racial', 'political', 'religious',
  'violence', 'language', 'drugs', 'obscenity', 'moral', 'blasphemy', 'other',
])

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

type ClassifyContext = {
  title: string
  author: string
  bookDescription: string   // books.description_book ?? books.description
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
    return slugs.length > 0 ? slugs : ['other']
  } catch { return ['other'] }
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
      description_book: string | null; description: string | null
      description_ban: string | null; censorship_context: string | null
      book_authors: Array<{ authors: { display_name: string } | null }>
    } | null
    ban_reason_links: Array<{ reasons: { id: number; slug: string } | null }>
  }

  const SELECT = `
    id, country_code, region, institution, action_type, year_started, description,
    books(id, slug, title, description_book, description, description_ban, censorship_context, book_authors(authors(display_name))),
    ban_reason_links(reasons(id, slug))
  `

  let allBans: BanRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('bans')
      .select(SELECT)
      .range(offset, offset + 999)
      .order('id')
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    if (!data || data.length === 0) break
    allBans = allBans.concat(data as unknown as BanRow[])
    if (data.length < 1000) break
    offset += 1000
  }

  // Keep only bans whose reasons are exclusively 'other'
  const targets = allBans.filter((ban) => {
    const slugs = ban.ban_reason_links.map(l => l.reasons?.slug).filter(Boolean)
    return slugs.length > 0 && slugs.every(s => s === 'other')
  })

  console.log(`Total bans loaded            : ${allBans.length}`)
  console.log(`Bans with only 'other' reason: ${targets.length}`)

  if (targets.length === 0) {
    console.log('Nothing to classify.')
    return
  }

  const limit = APPLY ? targets.length : Math.min(5, targets.length)
  console.log(`\n${APPLY ? `Classifying ${targets.length} bans…` : `DRY-RUN — showing ${limit} samples:`}\n`)

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
        bookDescription: book.description_book ?? book.description ?? '',
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

      if (!APPLY) {
        console.log(`  [${n}/${limit}] "${title}" — ${author}`)
        console.log(`    Reasons: ${slugs.join(', ')}`)
        console.log()
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

  console.log(`\n── Done ──`)
  if (APPLY) {
    console.log(`Updated (replaced 'other'): ${updated}`)
    console.log(`Kept as 'other' (no better): ${kept}`)
    console.log(`Errors: ${errored}`)
  } else {
    console.log(`Would classify ${targets.length} bans. Re-run with --apply to write.\n`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
