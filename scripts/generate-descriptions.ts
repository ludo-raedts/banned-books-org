import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

async function fetchDescription(workId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org/works/${workId}.json`)
    if (!res.ok) return null
    const json = await res.json() as { description?: string | { value: string } }
    const raw = json.description
    if (!raw) return null
    const text = typeof raw === 'string' ? raw : raw.value
    return text.slice(0, 500)
  } catch {
    return null
  }
}

async function main() {
  const { data: books, error } = await supabase
    .from('books')
    .select('id, title, openlibrary_work_id')
    .is('description', null)
    .not('openlibrary_work_id', 'is', null)

  if (error) throw error
  if (!books || books.length === 0) {
    console.log('No books need descriptions.')
    return
  }

  console.log(`Fetching descriptions for ${books.length} book(s)...`)

  let updated = 0
  let skipped = 0

  for (const book of books as { id: number; title: string; openlibrary_work_id: string }[]) {
    const description = await fetchDescription(book.openlibrary_work_id)
    if (!description) {
      console.log(`  [skip] ${book.title} — no description found`)
      skipped++
      continue
    }

    const { error: ue } = await supabase
      .from('books')
      .update({ description, ai_drafted: false })
      .eq('id', book.id)

    if (ue) {
      console.warn(`  [error] ${book.title}: ${ue.message}`)
      skipped++
    } else {
      console.log(`  [ok] ${book.title}`)
      updated++
    }
  }

  console.log(`\nDone. Updated: ${updated}, skipped: ${skipped}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
