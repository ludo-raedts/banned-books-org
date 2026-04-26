/**
 * Strip Open Library bibliographic metadata that leaked into description_book.
 * OL work descriptions sometimes append "Also contained in:", "Contains:",
 * "See also:", etc. after a ---------- separator. Strip everything from that
 * separator onward.
 *
 * Special case: eleanor-and-park — the entire description is structured with
 * Markdown headers (## Eleanor ##) after the separator; re-fetch and clean.
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

// Separator pattern: a line of 3+ dashes/underscores/equals,
// optionally surrounded by whitespace/tabs.
const SEPARATOR_RE = /\n[\s\t]*[-─=]{3,}[\s\t]*(\n|$)/

function stripNoise(text: string): string | null {
  const m = text.search(SEPARATOR_RE)
  if (m === -1) return null       // no separator — nothing to do
  const clean = text.slice(0, m).trimEnd()
  return clean.length >= 80 ? clean : null  // too short after stripping → signal for re-fetch
}

async function fetchOlFull(workId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org/works/${workId}.json`, {
      headers: { 'User-Agent': 'banned-books-org/1.0' },
    })
    if (!res.ok) return null
    const json = await res.json() as Record<string, unknown>
    const raw = json.description
    if (!raw) return null
    const text = typeof raw === 'string' ? raw :
      typeof (raw as Record<string, unknown>).value === 'string'
        ? (raw as Record<string, unknown>).value as string : null
    return text?.trim() ?? null
  } catch { return null }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/__(.+?)__/gs, '$1')
    .replace(/_(.+?)_/gs, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim()
}

// For eleanor-and-park the OL description is formatted as:
//   [42-char intro]\n----------\n## Eleanor ##\n[prose]\n## Park ##\n[prose]
// We want to strip the separator + section headers and collect all prose.
function extractSectionedDescription(raw: string): string | null {
  const parts = raw.split(SEPARATOR_RE)
  // Combine all parts, strip markdown headers, clean up
  const combined = parts.join('\n')
  const cleaned = stripMarkdown(combined)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return cleaned.length >= 80 ? cleaned : null
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const { data: books } = await supabase
    .from('books')
    .select('id, slug, title, description_book, openlibrary_work_id')

  if (!books) { console.error('No data'); process.exit(1) }

  let fixed = 0, skipped = 0

  for (const book of books) {
    if (!book.description_book) continue
    const stripped = stripNoise(book.description_book as string)
    if (stripped === null && !SEPARATOR_RE.test(book.description_book as string)) continue

    // Has separator — needs fixing
    if (stripped && stripped.length >= 80) {
      // Clean strip was sufficient
      const { error } = await supabase.from('books').update({ description_book: stripped }).eq('id', book.id)
      if (error) { console.log(`✗ ${book.slug}: ${error.message}`); continue }
      console.log(`✓ ${book.slug}: ${(book.description_book as string).length} → ${stripped.length} chars`)
      fixed++
    } else {
      // Strip left < 80 chars — try to extract prose from structured description
      const raw = book.description_book as string
      const extracted = extractSectionedDescription(raw)
      if (extracted) {
        const { error } = await supabase.from('books').update({ description_book: extracted }).eq('id', book.id)
        if (error) { console.log(`✗ ${book.slug}: ${error.message}`); continue }
        console.log(`✓ ${book.slug} (sectioned): extracted ${extracted.length} chars`)
        fixed++
      } else {
        // Last resort: re-fetch from OL if we have a work ID
        if (book.openlibrary_work_id) {
          await sleep(500)
          const fresh = await fetchOlFull(book.openlibrary_work_id as string)
          if (fresh) {
            const reclean = stripMarkdown(fresh.split(SEPARATOR_RE)[0].trimEnd())
            if (reclean.length >= 80) {
              const { error } = await supabase.from('books').update({ description_book: reclean }).eq('id', book.id)
              if (error) { console.log(`✗ ${book.slug}: ${error.message}`); continue }
              console.log(`✓ ${book.slug} (re-fetch): ${reclean.length} chars`)
              fixed++
              continue
            }
          }
        }
        console.log(`— ${book.slug}: could not recover, leaving as-is`)
        skipped++
      }
    }
  }

  console.log(`\nDone. Fixed: ${fixed}  Skipped: ${skipped}`)
}

main().catch(console.error)
