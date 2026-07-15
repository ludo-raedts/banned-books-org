/**
 * audit-botd-week.ts — weekly pre-flight for the upcoming book-of-the-day picks.
 *
 * Computes the picks for the next N days (default 8: today..+7) via the SAME
 * pickForDates() the /share hub and Bluesky bot use, then reports data gaps on
 * each picked book and its author(s): missing/thin descriptions, template bios,
 * missing socials/wikidata, missing buy links, etc. Report-only on the books
 * side — it writes nothing to books/authors.
 *
 * NOTE: not strictly side-effect-free — pickForDates() freezes today/future
 * picks into bluesky_daily_picks (source='auto', first writer wins), exactly
 * like opening the admin "upcoming" view. That is desirable here: the picks we
 * audit are guaranteed to be the picks that actually run.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/audit-botd-week.ts            # next 8 days
 *   pnpm tsx --env-file=.env.local scripts/audit-botd-week.ts --days=14
 *
 * Consumed by the /botd-week skill (.claude/skills/botd-week/SKILL.md), which
 * fixes the judgment-work gaps (bios, socials) one by one.
 */
import { adminClient } from '../src/lib/supabase'
import { pickForDates, dayNumber } from '../src/lib/bluesky-post'
import {
  bookGaps,
  authorGaps,
  BOOK_HEALTH_SELECT,
  type BookHealthRow as BookRow,
  type AuthorHealthRow as AuthorRow,
} from '../src/lib/botd-health'
import { intFlag } from './lib/cli'

const DAYS = intFlag('days', 8)

async function main() {
  const start = dayNumber(new Date().toISOString().slice(0, 10))
  const dates = Array.from({ length: DAYS }, (_, i) => new Date((start + i) * 86_400_000).toISOString().slice(0, 10))

  const picks = await pickForDates(dates)
  const sb = adminClient()

  console.log(`# Book-of-the-day pre-flight — ${dates[0]} … ${dates[dates.length - 1]}\n`)

  let clean = 0
  const seenBooks = new Set<number>()
  for (let i = 0; i < dates.length; i++) {
    const pick = picks[i]
    if (!pick) {
      console.log(`## ${dates[i]} — ⚠ NO PICK (empty eligible pool?)\n`)
      continue
    }
    const dup = seenBooks.has(pick.id)
    seenBooks.add(pick.id)

    const { data, error } = await sb
      .from('books')
      .select(BOOK_HEALTH_SELECT)
      .eq('id', pick.id)
      .single()
    if (error || !data) {
      console.log(`## ${dates[i]} — ⚠ hydrate failed for book id ${pick.id}: ${error?.message}\n`)
      continue
    }
    const book = data as unknown as BookRow
    const bGaps = bookGaps(book)
    const authors = (book.book_authors ?? []).map(ba => ba.authors).filter((a): a is AuthorRow => !!a)
    const aGaps = authors.map(a => ({ a, gaps: authorGaps(a) }))
    const totalGaps = bGaps.length + aGaps.reduce((n, x) => n + x.gaps.length, 0)

    const birthday = pick.birthday ? ` 🎂 birthday: ${pick.birthday.name}` : ''
    const header = `## ${dates[i]} — “${book.title}” by ${pick.author} (/books/${book.slug}, id ${book.id})${birthday}${dup ? ' ⚠ DUPLICATE within window' : ''}`

    if (totalGaps === 0) {
      clean++
      console.log(`${header}\n✓ clean (${pick.banCount} bans, ${pick.countryCount} countries)\n`)
      continue
    }
    console.log(header)
    console.log(`bans: ${pick.banCount} in ${pick.countryCount} countries — ${pick.countries.join(', ')}`)
    if (bGaps.length) console.log(`- BOOK: ${bGaps.join(' | ')}`)
    for (const { a, gaps } of aGaps) {
      if (gaps.length) console.log(`- AUTHOR ${a.display_name} (/authors/${a.slug}, id ${a.id}): ${gaps.join(' | ')}`)
      else console.log(`- AUTHOR ${a.display_name} (/authors/${a.slug}, id ${a.id}): ✓ clean`)
    }
    console.log('')
  }

  console.log(`---\n${clean}/${dates.length} picks fully clean.`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
