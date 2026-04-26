/**
 * Import [slug] Description. lines into description_ban.
 * Usage: npx tsx --env-file=.env.local scripts/import-ban-descriptions.ts /path/to/batch.txt
 *
 * Parses every line matching:  [slug] Some text here.
 * Skips blank lines, headers, and anything else.
 * Skips slugs that already have a description_ban set.
 */
import { adminClient } from '../src/lib/supabase'
import { readFileSync } from 'fs'

const supabase = adminClient()

function parse(text: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of text.split('\n')) {
    const m = line.match(/^\[([a-z0-9][a-z0-9-]*)\]\s+(.+)/)
    if (m) map.set(m[1], m[2].trim())
  }
  return map
}

async function main() {
  const file = process.argv[2]
  if (!file) { console.error('Usage: import-ban-descriptions.ts <file>'); process.exit(1) }

  const text = readFileSync(file, 'utf8')
  const entries = parse(text)
  console.log(`Parsed ${entries.size} entries from ${file}\n`)

  let inserted = 0, skipped = 0, notFound = 0

  for (const [slug, description] of entries) {
    const { data: book } = await supabase
      .from('books')
      .select('id, description_ban')
      .eq('slug', slug)
      .single()

    if (!book) {
      console.log(`  [not found] ${slug}`)
      notFound++
      continue
    }
    if (book.description_ban) {
      skipped++
      continue
    }

    const { error } = await supabase
      .from('books')
      .update({ description_ban: description })
      .eq('id', book.id)

    if (error) {
      console.log(`  ✗ ${slug}: ${error.message}`)
    } else {
      console.log(`  ✓ ${slug}`)
      inserted++
    }
  }

  console.log(`\nInserted: ${inserted}  Skipped (already set): ${skipped}  Not found: ${notFound}`)
}

main().catch(console.error)
