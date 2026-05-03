/**
 * GPT-powered reclassification of bans whose only reason is "other".
 * Uses description_book + censorship_context + title to infer a proper reason.
 *
 * Strategy per ban:
 *   1. Ask GPT for the most fitting reason(s) from the allowed list
 *   2. If GPT returns anything specific (not "other"), add those reason links
 *   3. Remove the "other" link only when at least one specific reason was added
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/reclassify-other-gpt.ts             # dry-run, 10 samples
 *   npx tsx --env-file=.env.local scripts/reclassify-other-gpt.ts --apply
 *   npx tsx --env-file=.env.local scripts/reclassify-other-gpt.ts --apply --limit=100
 */

import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'

const APPLY    = process.argv.includes('--apply')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]) : (APPLY ? 999 : 10)
const DELAY    = 300 // ms between GPT calls

const REASON_IDS: Record<string, number> = {
  lgbtq: 1, political: 2, religious: 3, sexual: 4,
  violence: 5, racial: 6, drugs: 7, other: 8,
  obscenity: 9, language: 10, moral: 11, blasphemy: 12,
}
const VALID_REASONS = new Set(Object.keys(REASON_IDS).filter(r => r !== 'other'))

const REASON_GUIDE = `
- lgbtq: LGBTQ+ characters, relationships, gender identity, coming-out, queer themes
- political: government censorship, political ideology, anti-authority, state critique
- religious: religious objection, occult/witchcraft/pagan themes, Bible concerns
- sexual: explicit sex, nudity, sexual content, rape, sexual abuse in plot
- violence: graphic violence, gore, murder, war, assault, self-harm, suicide
- racial: racism, racial slurs, racial inequality, police brutality, colonialism
- drugs: drug use, addiction, alcohol abuse
- obscenity: broad obscenity claims not captured by sexual/language
- blasphemy: specifically anti-religious blasphemy (distinct from general religious)
- moral: general immorality claims, bad values, inappropriate for age group
- language: profanity, offensive language, slurs (outside racial)
`.trim()

async function askGPT(
  client: OpenAI,
  title: string,
  description: string,
  context: string,
): Promise<string[]> {
  const text = [
    description && `Description: ${description.slice(0, 400)}`,
    context && `Censorship context: ${context.slice(0, 300)}`,
  ].filter(Boolean).join('\n')

  if (!text) return []

  const prompt = `A book called "${title}" was banned. Based on the information below, return the most accurate reason(s) it was banned from this exact list:
lgbtq, political, religious, sexual, violence, racial, drugs, obscenity, blasphemy, moral, language

Guide:
${REASON_GUIDE}

${text}

Rules:
- Return ONLY a comma-separated list of reason slugs from the list above, nothing else
- Return at most 2 reasons; pick the most specific one(s)
- If you genuinely cannot determine a reason, return the single word: other
- Do NOT add explanations, punctuation, or extra words`

  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 30,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = res.choices[0]?.message?.content?.trim().toLowerCase() ?? ''
    return raw
      .split(',')
      .map(s => s.trim())
      .filter(s => VALID_REASONS.has(s) || s === 'other')
  } catch {
    return []
  }
}

async function main() {
  const supabase = adminClient()
  const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set'); process.exit(1)
  }

  const OTHER_ID = 8

  // Get all bans where "other" is the ONLY reason
  // Step 1: all ban_ids tagged 'other'
  const otherBanIds = new Set<number>()
  {
    let offset = 0
    while (true) {
      const { data } = await supabase
        .from('ban_reason_links').select('ban_id').eq('reason_id', OTHER_ID).range(offset, offset + 999)
      if (!data || data.length === 0) break
      data.forEach((r: any) => otherBanIds.add(r.ban_id))
      if (data.length < 1000) break
      offset += 1000
    }
  }

  // Step 2: bans that have ANY non-other reason → exclude them
  const bansWithSpecific = new Set<number>()
  {
    let offset = 0
    while (true) {
      const { data } = await supabase
        .from('ban_reason_links').select('ban_id').neq('reason_id', OTHER_ID).range(offset, offset + 999)
      if (!data || data.length === 0) break
      data.forEach((r: any) => {
        if (otherBanIds.has(r.ban_id)) bansWithSpecific.add(r.ban_id)
      })
      if (data.length < 1000) break
      offset += 1000
    }
  }

  const onlyOtherBanIds = [...otherBanIds].filter(id => !bansWithSpecific.has(id))
  console.log(`\n── reclassify-other-gpt (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)
  console.log(`Bans with "other" as only reason: ${onlyOtherBanIds.length}`)
  console.log(`Processing: ${Math.min(onlyOtherBanIds.length, LIMIT)}\n`)

  // Load book data for those bans
  const { data: bansRaw } = await supabase
    .from('bans')
    .select('id, book_id, country_code, books(id, title, description_book, censorship_context)')
    .in('id', onlyOtherBanIds.slice(0, LIMIT * 2)) // fetch more to account for missing text

  const bans = (bansRaw ?? []) as unknown as Array<{
    id: number
    book_id: number
    country_code: string
    books: { id: number; title: string; description_book: string | null; censorship_context: string | null } | null
  }>

  let processed = 0, reclassified = 0, kept = 0, noText = 0, errors = 0

  for (const ban of bans) {
    if (processed >= LIMIT) break

    const book = ban.books
    if (!book) continue

    const desc = book.description_book ?? ''
    const ctx  = book.censorship_context ?? ''

    if (!desc && !ctx) {
      noText++
      continue
    }

    processed++
    console.log(`[${book.title.slice(0, 50)}] (ban ${ban.id}, ${ban.country_code})`)

    const reasons = await askGPT(openai, book.title, desc, ctx)
    const specific = reasons.filter(r => r !== 'other')

    if (specific.length === 0) {
      console.log(`  → keep other (GPT: ${reasons.join(', ') || 'no signal'})`)
      kept++
    } else {
      console.log(`  → reclassify: other → ${specific.join(', ')}`)
      if (APPLY) {
        // Add specific reason links
        const inserts = specific
          .map(slug => ({ ban_id: ban.id, reason_id: REASON_IDS[slug] }))
          .filter(r => r.reason_id)
        const { error: insErr } = await supabase.from('ban_reason_links').insert(inserts)
        if (insErr) {
          console.error(`  ✗ insert: ${insErr.message}`)
          errors++
        } else {
          // Remove "other" link
          const { error: delErr } = await supabase
            .from('ban_reason_links').delete().eq('ban_id', ban.id).eq('reason_id', OTHER_ID)
          if (delErr) console.error(`  ✗ delete other: ${delErr.message}`)
          else { console.log(`  ✓ done`); reclassified++ }
        }
      } else {
        reclassified++ // count intended changes in dry-run
      }
    }

    if (DELAY > 0) await new Promise(r => setTimeout(r, DELAY))
  }

  console.log(`\n── Summary ──`)
  console.log(`  Processed:    ${processed}`)
  console.log(`  Reclassified: ${reclassified}`)
  console.log(`  Kept other:   ${kept}`)
  console.log(`  No text:      ${noText}`)
  if (errors) console.log(`  Errors:       ${errors}`)
  if (!APPLY) console.log('\nDRY-RUN — add --apply to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
