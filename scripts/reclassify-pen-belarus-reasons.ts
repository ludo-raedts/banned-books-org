/**
 * Reclassify PEN-Belarus bans whose default reason is `political` (assigned
 * en bloc by import-pen-belarus.ts) when the actual ban target is non-political
 * content (BDSM poetry, religious texts, etc.).
 *
 * Why this exists: import-pen-belarus.ts hardcodes `political` for ALL ~336
 * Belarus bans as "primary regime targeting". That's right for the vast
 * majority — Lukashenko's regime mainly bans opposition writing — but the
 * Harmful & Extremist lists also sweep in books targeted for their actual
 * content (sex, occult, drugs). reclassify-other-gpt.ts skips these because
 * their reason is `political`, not `other`.
 *
 * Strategy per ban (conservative):
 *   1. Ask GPT to return {reasons:[…], political_target:bool} from
 *      title + description_book + censorship_context + ban.description.
 *   2. Add any specific reasons GPT returned that aren't already linked.
 *   3. Drop the `political` link ONLY when GPT says political_target=false
 *      AND we successfully added at least one non-political reason.
 *
 * Bans without a description_book are skipped — run description enrichment
 * first.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/reclassify-pen-belarus-reasons.ts            # dry-run, 10 samples
 *   pnpm tsx --env-file=.env.local scripts/reclassify-pen-belarus-reasons.ts --apply
 *   pnpm tsx --env-file=.env.local scripts/reclassify-pen-belarus-reasons.ts --apply --limit=50
 *   pnpm tsx --env-file=.env.local scripts/reclassify-pen-belarus-reasons.ts --slug=the-poetry-of-bdsm-stories-tales-and-poems
 */

import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'

const APPLY    = process.argv.includes('--apply')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const slugArg  = process.argv.find(a => a.startsWith('--slug='))
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]) : (APPLY ? 9999 : 10)
const SLUG     = slugArg?.split('=')[1] ?? null
const DELAY    = 300 // ms between GPT calls

const REASON_IDS: Record<string, number> = {
  lgbtq: 1, political: 2, religious: 3, sexual: 4,
  violence: 5, racial: 6, drugs: 7, other: 8,
  obscenity: 9, language: 10, moral: 11,
}
const POLITICAL_ID = REASON_IDS.political
const VALID_REASONS = new Set(Object.keys(REASON_IDS).filter(r => r !== 'other'))

const PEN_BELARUS_SOURCE_URLS = [
  'https://bannedbooks.penbelarus.org/en/extremist_list_en/',
  'https://bannedbooks.penbelarus.org/en/harmful_list_en/',
]

const REASON_GUIDE = `
- lgbtq: LGBTQ+ characters, relationships, gender identity, coming-out, queer themes
- political: government censorship for political ideology, state critique, anti-regime, opposition writing
- religious: religious objection, occult/witchcraft/pagan themes, blasphemy
- sexual: explicit sex, nudity, sexual content, rape, sexual abuse, BDSM, erotica
- violence: graphic violence, gore, murder, war, assault, self-harm, suicide
- racial: racism, racial slurs, racial inequality, police brutality, colonialism
- drugs: drug use, addiction, alcohol abuse
- obscenity: broad obscenity claims not captured by sexual/language
- moral: general immorality claims, bad values, inappropriate for age group
- language: profanity, offensive language, slurs (outside racial)
`.trim()

type GPTReply = {
  reasons: string[]
  political_target: boolean
}

async function askGPT(
  client: OpenAI,
  title: string,
  authorName: string | null,
  descBook: string,
  censorshipCtx: string,
  banDesc: string,
): Promise<GPTReply | null> {
  const text = [
    descBook       && `Book description: ${descBook.slice(0, 600)}`,
    censorshipCtx  && `Censorship context: ${censorshipCtx.slice(0, 400)}`,
    banDesc        && `Ban record: ${banDesc.slice(0, 300)}`,
  ].filter(Boolean).join('\n')

  if (!text) return null

  const prompt = `A book titled "${title}"${authorName ? ` by ${authorName}` : ''} was banned in Belarus under the Lukashenko regime. The regime bans many books for purely political reasons (opposition writing, regime critique) AND also bans books for non-political reasons (BDSM/erotica, occult/religious objection, drug content, etc.).

From the information below, infer (a) the most accurate content-based reason(s), and (b) whether the regime's actual target here was political content vs. the content of the work itself.

Allowed reasons:
${REASON_GUIDE}

${text}

Return ONLY a JSON object on a single line, no prose, no code fences:
{"reasons": ["<slug>", ...], "political_target": <true|false>}

Rules:
- "reasons" = at most 2 slugs from this list: lgbtq, political, religious, sexual, violence, racial, drugs, obscenity, moral, language. Empty array if nothing fits.
- Include "political" in reasons ONLY if the book is genuinely political in content (opposition writing, regime critique, political ideology).
- "political_target" = true if the regime almost certainly banned this for political reasons (author is opposition figure, content critiques regime, etc.); false if the actual target is the work's non-political content.
- When in doubt about political_target, return true. We only drop the political tag when you are confident the target is non-political content.`

  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 80,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = res.choices[0]?.message?.content?.trim() ?? ''
    const parsed = JSON.parse(raw) as { reasons?: unknown; political_target?: unknown }
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons
          .map(r => String(r).trim().toLowerCase())
          .filter(r => VALID_REASONS.has(r))
      : []
    const political_target = parsed.political_target !== false // default true on ambiguity
    return { reasons, political_target }
  } catch (e) {
    console.error(`  ! GPT error: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

async function main() {
  const supabase = adminClient()
  const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set'); process.exit(1)
  }

  console.log(`\n── reclassify-pen-belarus-reasons (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──`)

  // 1. Look up the two PEN Belarus source IDs
  const { data: sources, error: srcErr } = await supabase
    .from('ban_sources').select('id, source_url')
    .in('source_url', PEN_BELARUS_SOURCE_URLS)
  if (srcErr) throw srcErr
  const sourceIds = (sources ?? []).map((s: { id: number }) => s.id)
  if (sourceIds.length === 0) {
    console.error('No PEN Belarus sources found — was the importer ever run?')
    process.exit(1)
  }
  console.log(`PEN Belarus source IDs: ${sourceIds.join(', ')}`)

  // 2. Collect ban_ids linked to those sources (paginated)
  const banIds = new Set<number>()
  {
    let offset = 0
    while (true) {
      const { data, error } = await supabase
        .from('ban_source_links').select('ban_id')
        .in('source_id', sourceIds)
        .order('ban_id').range(offset, offset + 999)
      if (error) throw error
      if (!data || data.length === 0) break
      data.forEach((r: { ban_id: number }) => banIds.add(r.ban_id))
      if (data.length < 1000) break
      offset += 1000
    }
  }
  console.log(`Bans linked to PEN Belarus sources: ${banIds.size}`)

  // 3. Pull bans + book data (paginated, in chunks of 200 IDs at a time)
  type BanRow = {
    id: number
    book_id: number
    description: string | null
    books: {
      id: number
      slug: string
      title: string
      description_book: string | null
      censorship_context: string | null
    } | null
  }
  const idsArr = [...banIds]
  const banRows: BanRow[] = []
  for (let i = 0; i < idsArr.length; i += 200) {
    const chunk = idsArr.slice(i, i + 200)
    let q = supabase
      .from('bans')
      .select('id, book_id, description, books(id, slug, title, description_book, censorship_context)')
      .in('id', chunk)
    if (SLUG) q = q.eq('books.slug', SLUG)
    const { data, error } = await q
    if (error) throw error
    banRows.push(...((data ?? []) as unknown as BanRow[]))
  }

  // 4. Filter to bans currently tagged `political` (skip ones manually re-tagged)
  const politicalLinked = new Set<number>()
  for (let i = 0; i < idsArr.length; i += 200) {
    const chunk = idsArr.slice(i, i + 200)
    const { data, error } = await supabase
      .from('ban_reason_links').select('ban_id')
      .in('ban_id', chunk).eq('reason_id', POLITICAL_ID)
    if (error) throw error
    ;(data ?? []).forEach((r: { ban_id: number }) => politicalLinked.add(r.ban_id))
  }

  // 5. Existing reason links per ban (to avoid duplicate inserts)
  const reasonsByBan = new Map<number, Set<number>>()
  for (let i = 0; i < idsArr.length; i += 200) {
    const chunk = idsArr.slice(i, i + 200)
    const { data, error } = await supabase
      .from('ban_reason_links').select('ban_id, reason_id').in('ban_id', chunk)
    if (error) throw error
    ;(data ?? []).forEach((r: { ban_id: number; reason_id: number }) => {
      if (!reasonsByBan.has(r.ban_id)) reasonsByBan.set(r.ban_id, new Set())
      reasonsByBan.get(r.ban_id)!.add(r.reason_id)
    })
  }

  // 6. Author names (for context in prompt). Optional but helps GPT.
  const bookIds = banRows.map(b => b.book_id).filter(Boolean)
  const authorByBook = new Map<number, string>()
  for (let i = 0; i < bookIds.length; i += 200) {
    const chunk = bookIds.slice(i, i + 200)
    const { data } = await supabase
      .from('book_authors')
      .select('book_id, authors(display_name)')
      .in('book_id', chunk)
    type BA = { book_id: number; authors: { display_name: string } | null }
    ;((data ?? []) as unknown as BA[]).forEach(r => {
      if (r.authors && !authorByBook.has(r.book_id))
        authorByBook.set(r.book_id, r.authors.display_name)
    })
  }

  // 7. Process
  let considered = 0, processed = 0, added = 0, droppedPolitical = 0, noText = 0, errors = 0
  for (const ban of banRows) {
    if (processed >= LIMIT) break
    const book = ban.books
    if (!book) continue
    if (!politicalLinked.has(ban.id)) continue // skip if user already cleared political
    considered++

    if (!book.description_book && !book.censorship_context) {
      noText++
      continue
    }

    processed++
    const author = authorByBook.get(book.id) ?? null
    console.log(`\n[${book.title.slice(0, 60)}]${author ? ` — ${author}` : ''} (ban ${ban.id})`)

    const reply = await askGPT(
      openai,
      book.title,
      author,
      book.description_book ?? '',
      book.censorship_context ?? '',
      ban.description ?? '',
    )
    if (!reply) { errors++; continue }

    const existing = reasonsByBan.get(ban.id) ?? new Set<number>()
    const toAdd = reply.reasons
      .map(slug => ({ slug, id: REASON_IDS[slug] }))
      .filter(r => r.id && !existing.has(r.id))

    const nonPoliticalAdds = toAdd.filter(r => r.slug !== 'political')
    const shouldDropPolitical =
      reply.political_target === false && nonPoliticalAdds.length > 0

    console.log(`  GPT: reasons=[${reply.reasons.join(', ') || '∅'}] political_target=${reply.political_target}`)
    if (toAdd.length === 0 && !shouldDropPolitical) {
      console.log(`  → no change`)
      continue
    }
    if (toAdd.length > 0)
      console.log(`  → add: ${toAdd.map(r => r.slug).join(', ')}`)
    if (shouldDropPolitical)
      console.log(`  → drop: political`)

    if (APPLY) {
      if (toAdd.length > 0) {
        const inserts = toAdd.map(r => ({ ban_id: ban.id, reason_id: r.id }))
        const { error: insErr } = await supabase.from('ban_reason_links').insert(inserts)
        if (insErr) { console.error(`  ✗ insert: ${insErr.message}`); errors++; continue }
        added += toAdd.length
      }
      if (shouldDropPolitical) {
        const { error: delErr } = await supabase
          .from('ban_reason_links').delete().eq('ban_id', ban.id).eq('reason_id', POLITICAL_ID)
        if (delErr) { console.error(`  ✗ drop political: ${delErr.message}`); errors++; continue }
        droppedPolitical++
      }
      console.log(`  ✓ done`)
    } else {
      added += toAdd.length
      if (shouldDropPolitical) droppedPolitical++
    }

    if (DELAY > 0) await new Promise(r => setTimeout(r, DELAY))
  }

  console.log(`\n── Summary ──`)
  console.log(`  Candidate bans (political-tagged): ${considered}`)
  console.log(`  Processed:                         ${processed}`)
  console.log(`  Reason links added:                ${added}`)
  console.log(`  Political links dropped:           ${droppedPolitical}`)
  console.log(`  Skipped (no description):          ${noText}`)
  if (errors) console.log(`  Errors:                            ${errors}`)
  if (!APPLY) console.log('\nDRY-RUN — add --apply to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
