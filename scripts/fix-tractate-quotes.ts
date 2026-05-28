/**
 * One-shot: strip overbodige single-quotes om de hele titel van
 * book 6694 — `'Tractate on Idolatry from the Mishneh Torah with notes
 * by Dionysius Vossius'` → `Tractate on Idolatry …`.
 *
 * Bron-bug: scraper heeft de titel uit een geciteerde context overgenomen
 * en de surrounding single-quotes meegenomen. De 6 andere QUOTED_OPEN-hits
 * (Chinese pinyin transliteraties + 13940 Saggi sulla...) zijn legitieme
 * embedded quotes — die blijven ongemoeid.
 *
 *   pnpm tsx --env-file=.env.local scripts/fix-tractate-quotes.ts         # dry-run
 *   pnpm tsx --env-file=.env.local scripts/fix-tractate-quotes.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const BOOK_ID = 6694

async function main() {
  const sb = adminClient()
  console.log(`── fix-tractate-quotes ── (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

  const { data: book, error } = await sb.from('books')
    .select('id, slug, title')
    .eq('id', BOOK_ID)
    .maybeSingle()
  if (error || !book) throw error ?? new Error(`book ${BOOK_ID} not found`)

  const stripped = book.title
    .replace(/^['‘](.*)['’]$/, '$1')
    .trim()

  if (stripped === book.title) {
    console.log(`No change needed — title doesn't match leading-and-trailing single-quote pattern.`)
    console.log(`  current: ${JSON.stringify(book.title)}`)
    return
  }

  console.log(`book ${book.id} · ${book.slug}`)
  console.log(`  FROM: ${book.title}`)
  console.log(`  →     ${stripped}`)
  console.log('')

  if (!APPLY) {
    console.log(`── Dry-run. Re-run with --apply. ──`)
    return
  }

  const { error: ue } = await sb.from('books')
    .update({ title: stripped })
    .eq('id', BOOK_ID)
  if (ue) throw ue
  console.log(`  ✓ updated`)
}

main().catch(err => { console.error(err); process.exit(1) })
