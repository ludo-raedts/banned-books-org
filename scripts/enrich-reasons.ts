/**
 * Classify ban reasons for bans that currently only have 'other' as their reason.
 * Uses GPT-4o-mini to infer reasons from title + description + author.
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

async function classifyReasons(
  client: OpenAI,
  title: string,
  author: string,
  description: string,
): Promise<string[]> {
  const prompt = `You are helping tag banned books with the reasons they were challenged or banned.

Book: "${title}" by ${author || 'unknown'}
${description ? `Description: ${description.slice(0, 400)}` : ''}

Choose ALL applicable reason slugs from this list (return as comma-separated, lowercase):
- lgbtq       = LGBTQ+ content or themes
- sexual      = Sexual content
- racial      = Race, racism, colonialism, civil rights
- political   = Political or ideological content
- religious   = Religious content
- violence    = Violence or graphic content
- language    = Offensive language / profanity
- drugs       = Drug or substance use
- obscenity   = Obscenity
- moral       = Immorality or inappropriate values
- blasphemy   = Blasphemy
- other       = None of the above / unclear

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
    books: {
      id: number; slug: string; title: string
      description_book: string | null; description: string | null
      book_authors: Array<{ authors: { display_name: string } | null }>
    } | null
    ban_reason_links: Array<{ reasons: { id: number; slug: string } | null }>
  }

  const SELECT = `
    id,
    books(id, slug, title, description_book, description, book_authors(authors(display_name))),
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
      const desc = book.description_book ?? book.description ?? ''
      const slugs = await classifyReasons(openai, book.title, author, desc)
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
