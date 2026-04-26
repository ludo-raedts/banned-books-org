/**
 * Import [slug] Description. lines into description_ban.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-ban-descriptions.ts <file>
 *   npx tsx --env-file=.env.local scripts/import-ban-descriptions.ts <file> --overwrite
 *
 * Parsing rules:
 *   - Matches lines starting with [slug]
 *   - Strips "Source confidence: ..." metadata appended by ChatGPT
 *   - Strips trailing markdown link references like ([Text][n])
 *   - Skips entries starting with "Needs verification:"
 *   - By default skips slugs already with description_ban; --overwrite replaces them
 */
import { adminClient } from '../src/lib/supabase'
import { readFileSync } from 'fs'

const supabase = adminClient()

function cleanDescription(raw: string): string | null {
  // Skip entries flagged as unverified
  if (/^needs verification:/i.test(raw.trim())) return null

  let text = raw
  // Strip "Source confidence: ..." and everything after (ChatGPT metadata)
  text = text.replace(/\s*Source confidence:.*$/is, '')
  // Strip trailing markdown link references like ([Source Name][1])
  text = text.replace(/\s*\(\[[^\]]+\]\[\d+\]\)\s*$/g, '').trim()
  // Strip bare trailing link refs like [1]
  text = text.replace(/\s*\[\d+\]\s*$/g, '').trim()

  return text.length >= 20 ? text : null
}

function parse(text: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of text.split('\n')) {
    const m = line.match(/^\[([a-z0-9][a-z0-9-]*)\]\s+(.+)/)
    if (!m) continue
    const cleaned = cleanDescription(m[2])
    if (cleaned) map.set(m[1], cleaned)
  }
  return map
}

async function main() {
  const file = process.argv[2]
  const overwrite = process.argv.includes('--overwrite')
  if (!file) {
    console.error('Usage: import-ban-descriptions.ts <file> [--overwrite]')
    process.exit(1)
  }

  const text = readFileSync(file, 'utf8')
  const entries = parse(text)
  console.log(`Parsed ${entries.size} entries from ${file}${overwrite ? ' (overwrite mode)' : ''}\n`)

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
    if (book.description_ban && !overwrite) {
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

  console.log(`\nInserted/updated: ${inserted}  Skipped (already set): ${skipped}  Not found: ${notFound}`)
}

main().catch(console.error)
