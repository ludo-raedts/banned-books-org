/**
 * _audit_split_authors.ts — canonical read-only detector for the
 * "Lastname, Firstname." catalogue-split parser bug (src/lib/wikipedia/parser.ts:567,
 * fixed 2026-05-18 in b159d6e). Rebuilt 2026-08-24: scripts/README.md listed this
 * detector but the file was never actually committed, so the only record of the
 * open clusters was the frozen 2026-05-14/19 snapshot in
 * data/hk-split-authors-review.md. This queries the LIVE database instead.
 *
 * A "fragment" author is a single-token display_name (optionally ending on the
 * source's trailing period): "Han", "Theodore.", "Li", "John.".
 * A "cluster" is a book carrying >= 2 fragment authors — the shape the comma-split
 * produced. Books with exactly one fragment are reported separately (weaker signal:
 * mononym authors like "Homer" or "Colette" are legitimate).
 *
 * Writes nothing. Merges are done by hand-written one-offs (see scripts/archive/
 * for the 6522 and 6527 templates) — a shared fragment row (book_count > 1) gets
 * UNLINKED from the cluster book, an exclusive one (book_count == 1) gets RENAMED.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/_audit_split_authors.ts
 *   pnpm tsx --env-file=.env.local scripts/_audit_split_authors.ts --md > data/split-authors-review-<date>.md
 */
import { adminClient } from '../src/lib/supabase'

const AS_MD = process.argv.includes('--md')
const PAGE = 1000

// Single token, no internal space, optional trailing period. Allows accents,
// hyphens and apostrophes ("O'Brien", "Jean-Luc") so we don't miss non-ASCII rows.
const FRAGMENT = /^[\p{L}][\p{L}'’-]*\.?$/u

type Author = {
  id: number
  slug: string
  display_name: string
  bio: string | null
  is_placeholder: boolean | null
}

async function allAuthors(sb: ReturnType<typeof adminClient>): Promise<Author[]> {
  const out: Author[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('authors')
      .select('id, slug, display_name, bio, is_placeholder')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...((data ?? []) as Author[]))
    if (!data || data.length < PAGE) return out
  }
}

async function main() {
  const sb = adminClient()

  const authors = await allAuthors(sb)
  const fragments = authors.filter((a) => FRAGMENT.test(a.display_name.trim()))
  const byId = new Map(fragments.map((a) => [a.id, a]))
  console.error(`authors scanned: ${authors.length} — single-token fragments: ${fragments.length}`)

  // book_authors for the fragment ids, paginated (an id can carry many books).
  const ids = [...byId.keys()]
  const links: Array<{ book_id: number; author_id: number }> = []
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200)
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from('book_authors')
        .select('book_id, author_id')
        .in('author_id', slice)
        .order('book_id')
        .range(from, from + PAGE - 1)
      if (error) throw error
      links.push(...((data ?? []) as typeof links))
      if (!data || data.length < PAGE) break
    }
  }

  const bookCount = new Map<number, number>()
  for (const l of links) bookCount.set(l.author_id, (bookCount.get(l.author_id) ?? 0) + 1)

  const perBook = new Map<number, number[]>()
  for (const l of links) {
    const arr = perBook.get(l.book_id) ?? []
    arr.push(l.author_id)
    perBook.set(l.book_id, arr)
  }

  const clusterBookIds = [...perBook.entries()].filter(([, a]) => a.length >= 2).map(([b]) => b)
  const loneBookIds = [...perBook.entries()].filter(([, a]) => a.length === 1).map(([b]) => b)

  const books = new Map<number, { id: number; title: string; slug: string }>()
  for (let i = 0; i < clusterBookIds.length; i += 200) {
    const { data, error } = await sb
      .from('books')
      .select('id, title, slug')
      .in('id', clusterBookIds.slice(i, i + 200))
    if (error) throw error
    for (const b of (data ?? []) as any[]) books.set(b.id, b)
  }

  const P = AS_MD ? (s: string) => console.log(s) : (s: string) => console.log(s)

  P(`# Split-authors — live detector run ${new Date().toISOString().slice(0, 10)}\n`)
  P(`${clusterBookIds.length} cluster book(s) (>= 2 single-token authors); ` +
    `${loneBookIds.length} book(s) with exactly one single-token author (weak signal, mononyms live here too).\n`)

  const sorted = clusterBookIds
    .map((id) => ({ book: books.get(id), authorIds: perBook.get(id)! }))
    .sort((a, b) => b.authorIds.length - a.authorIds.length || (a.book?.id ?? 0) - (b.book?.id ?? 0))

  for (const { book, authorIds } of sorted) {
    if (!book) continue
    P(`\n## Book ${book.id} — ${book.title}`)
    P(`https://www.banned-books.org/books/${book.slug}\n`)
    for (const aid of authorIds.sort((x, y) => x - y)) {
      const a = byId.get(aid)!
      const n = bookCount.get(aid) ?? 0
      const action = n > 1 ? 'SHARED → unlink from this book' : 'EXCLUSIVE → safe to rename'
      const dot = a.display_name.trim().endsWith('.') ? ' [trailing-period: bug victim]' : ''
      const bio = a.bio ? ` — bio: "${a.bio.slice(0, 70).replace(/\s+/g, ' ')}…"` : ' — bio: null'
      P(`- **\`${a.display_name}\`** (id=${a.id}, slug=\`${a.slug}\`, ${n} book(s)) — ${action}${dot}${bio}`)
    }
  }

  P(`\n---\n\n## Lone single-token authors (review only — mononyms are legitimate)\n`)
  const lone = loneBookIds.map((b) => perBook.get(b)![0])
  const uniqueLone = [...new Set(lone)].sort((a, b) => a - b)
  P(`${uniqueLone.length} distinct author rows.\n`)
  for (const aid of uniqueLone) {
    const a = byId.get(aid)!
    const dot = a.display_name.trim().endsWith('.') ? ' **[trailing period — bug victim]**' : ''
    P(`- \`${a.display_name}\` (id=${a.id}, slug=\`${a.slug}\`, ${bookCount.get(aid) ?? 0} book(s))${dot}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
