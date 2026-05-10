import { adminClient } from '../src/lib/supabase'

async function main() {
  const sb = adminClient()
  // Sample rows for an iconic multi-ban book to see what columns are populated
  const { data: book } = await sb.from('books').select('id, title').eq('slug', 'ulysses').single()
  console.log('Book:', book)
  if (!book) return

  const { data: bans, error } = await sb
    .from('bans')
    .select('*')
    .eq('book_id', (book as { id: number }).id)
  if (error) { console.error(error); return }
  console.log(`Bans on ${(book as { title: string }).title}:`, JSON.stringify(bans, null, 2))

  // Coverage check
  const { data: all } = await sb
    .from('bans')
    .select('action_type, year_ended, year_started, status')
    .limit(200)
  if (all) {
    const arr = all as { action_type: string | null; year_ended: number | null; year_started: number | null; status: string | null }[]
    const total = arr.length
    const withAction = arr.filter(r => r.action_type).length
    const withYearStarted = arr.filter(r => r.year_started != null).length
    const withYearEnded = arr.filter(r => r.year_ended != null).length
    const actionTypes = new Map<string, number>()
    const statuses = new Map<string, number>()
    for (const r of arr) {
      actionTypes.set(r.action_type ?? '(null)', (actionTypes.get(r.action_type ?? '(null)') ?? 0) + 1)
      statuses.set(r.status ?? '(null)', (statuses.get(r.status ?? '(null)') ?? 0) + 1)
    }
    console.log(`\nSample coverage (n=${total}):`)
    console.log(`  action_type non-null:   ${withAction}/${total}`)
    console.log(`  year_started non-null:  ${withYearStarted}/${total}`)
    console.log(`  year_ended   non-null:  ${withYearEnded}/${total}`)
    console.log(`  action_type values:`, Object.fromEntries(actionTypes))
    console.log(`  status values:     `, Object.fromEntries(statuses))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
