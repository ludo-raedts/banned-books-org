/**
 * Generate Bookshop.org curated-list payloads (CSV upload + suggested
 * title / header / footer / layout) for our affiliate storefront.
 *
 * Bookshop's affiliate dashboard accepts up to 50 ISBNs per list as a
 * CSV upload (one ISBN per line). For each themed list we produce:
 *
 *   data/bookshop-lists/{slug}/isbns.csv       — ready to upload
 *   data/bookshop-lists/{slug}/metadata.md     — copy-paste fields
 *
 * Ranking: ban count descending, with bookshop_status='valid' as a hard
 * filter — we never include a book whose Bookshop deep-link 404s, so
 * the resulting list is fully clickable on Bookshop's side.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/export-bookshop-lists.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient } from '../src/lib/supabase'

const OUT_DIR = join(process.cwd(), 'data', 'bookshop-lists')
const PER_LIST_LIMIT = 50

type ListSpec = {
  slug: string
  title: string
  header: string
  footer: string
  reasonsAny?: readonly string[]
}

const FOOTER = `Compiled by banned-books.org — a global database of banned and challenged books. Buying through this list supports independent bookstores. Visit https://banned-books.org for sources, country-level detail, and the full record behind every title.`

const LISTS: readonly ListSpec[] = [
  {
    slug: 'most-banned',
    title: 'The Most Banned Books in the World',
    header: 'A ranking of the most-banned and most-challenged books in the global record we maintain at banned-books.org. Every book on this list has been formally banned, restricted, or removed somewhere in the world — most of them in many places at once.',
    footer: FOOTER,
  },
  {
    slug: 'banned-lgbtq',
    title: 'Banned LGBTQ+ Books',
    header: 'Books banned, challenged, or restricted because they include LGBTQ+ characters, themes, or experiences. The most frequently targeted category in school-library challenges in recent years.',
    footer: FOOTER,
    reasonsAny: ['lgbtq'],
  },
  {
    slug: 'banned-political',
    title: 'Banned Political Books',
    header: 'Books banned for political content — dissent, criticism of governments, accounts of authoritarianism, exiled voices. Documented across democracies and autocracies alike.',
    footer: FOOTER,
    reasonsAny: ['political'],
  },
  {
    slug: 'banned-religious',
    title: 'Banned for Religion or Blasphemy',
    header: 'Books banned for religious content or charges of blasphemy — heretical doctrines, depictions of sacred figures, critiques of established faiths. Some of the longest-running censorship cases in history.',
    footer: FOOTER,
    reasonsAny: ['religious', 'blasphemy'],
  },
  {
    slug: 'banned-race',
    title: 'Books Banned for Race and Racism',
    header: 'Books banned, challenged, or removed because they engage with race, racism, slavery, or racial justice. Targeted across centuries and recently dominant in school-library challenges.',
    footer: FOOTER,
    reasonsAny: ['racial'],
  },
  {
    slug: 'banned-sexuality',
    title: 'Books Banned for Sexual Content',
    header: 'Books banned on charges of sexual content, obscenity, or moral concern — a category that has long absorbed challenges to literature about bodies, desire, and adolescence.',
    footer: FOOTER,
    reasonsAny: ['sexual', 'obscenity', 'moral'],
  },
] as const

type RawBook = {
  id: number
  title: string
  isbn13: string | null
  bookshop_isbn13: string | null
  bookshop_status: 'valid' | 'not_found' | null
  bans: { ban_reason_links: { reasons: { slug: string } | null }[] | null }[] | null
}

type EnrichedBook = {
  id: number
  title: string
  bookshopIsbn: string  // the ISBN to put in the CSV (alt preferred)
  banCount: number
  reasons: Set<string>
}

async function fetchAllValidBooks(): Promise<EnrichedBook[]> {
  const supabase = adminClient()
  const all: RawBook[] = []
  const PAGE = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select(`
        id, title, isbn13, bookshop_isbn13, bookshop_status,
        bans(ban_reason_links(reasons(slug)))
      `)
      .eq('bookshop_status', 'valid')
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    if (!data?.length) break
    all.push(...(data as unknown as RawBook[]))
    if (data.length < PAGE) break
    offset += PAGE
  }

  return all
    .map(b => {
      const bookshopIsbn = b.bookshop_isbn13 ?? b.isbn13
      if (!bookshopIsbn) return null
      const reasons = new Set<string>()
      for (const ban of b.bans ?? []) {
        for (const link of ban.ban_reason_links ?? []) {
          if (link.reasons?.slug) reasons.add(link.reasons.slug)
        }
      }
      return {
        id: b.id,
        title: b.title,
        bookshopIsbn,
        banCount: (b.bans ?? []).length,
        reasons,
      }
    })
    .filter((b): b is EnrichedBook => b != null)
}

function pickList(books: EnrichedBook[], spec: ListSpec): EnrichedBook[] {
  let filtered = books
  if (spec.reasonsAny) {
    const need = new Set(spec.reasonsAny)
    filtered = books.filter(b => {
      for (const r of b.reasons) if (need.has(r)) return true
      return false
    })
  }
  return filtered
    .sort((a, b) => b.banCount - a.banCount || a.id - b.id) // stable tiebreak
    .slice(0, PER_LIST_LIMIT)
}

function writeList(spec: ListSpec, picks: EnrichedBook[]): void {
  const dir = join(OUT_DIR, spec.slug)
  mkdirSync(dir, { recursive: true })

  const csv = picks.map(p => p.bookshopIsbn).join('\n') + '\n'
  writeFileSync(join(dir, 'isbns.csv'), csv)

  const md = `# ${spec.title}

**Layout:** Linear
**Show on shop page:** yes
**Books in list:** ${picks.length}

## Title
\`\`\`
${spec.title}
\`\`\`

## Header text
\`\`\`
${spec.header}
\`\`\`

## Footer text
\`\`\`
${spec.footer}
\`\`\`

## Books (top ${picks.length} by ban count)
${picks.map((p, i) => `${i + 1}. ${p.bookshopIsbn} — ${p.title} (${p.banCount} bans)`).join('\n')}
`
  writeFileSync(join(dir, 'metadata.md'), md)
}

async function main() {
  console.log('\n── export-bookshop-lists ──\n')
  const books = await fetchAllValidBooks()
  console.log(`Books with bookshop_status='valid': ${books.length}\n`)

  for (const spec of LISTS) {
    const picks = pickList(books, spec)
    writeList(spec, picks)
    console.log(`  ${spec.slug.padEnd(20)} → ${String(picks.length).padStart(2)} ISBNs`)
  }

  console.log(`
Output written to ${OUT_DIR}

Next: log in to https://bookshop.org/affiliates/lists, click "Create A New
Book List", paste the title + header + footer from each metadata.md, then
upload the matching isbns.csv via the "Upload CSV" button.
`)
}

main().catch(e => { console.error(e); process.exit(1) })
