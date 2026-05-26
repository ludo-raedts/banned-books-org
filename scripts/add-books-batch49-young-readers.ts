/**
 * Batch 49 — Young Readers track classics missing from the books table.
 *
 * Adds two books needed for the /reading-club/young-readers track:
 *   1. Where the Wild Things Are (Sendak, 1963)  — author already present
 *   2. Charlotte's Web (E. B. White, 1952)        — author added in this batch
 *
 * Harry Potter and the Philosopher's Stone is already in the DB (#33,
 * UK-title slug) — no book insert needed; the seed-young-readers.ts run
 * picks it up by exact title match after this script.
 *
 * Sources cited for the ban records (conservative — only well-documented
 * aggregate claims):
 *   ALA  — American Library Association, Office for Intellectual Freedom
 *          frequently-challenged-books archive
 *          https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks
 *   Wiki — Wikipedia, List of most commonly challenged books in the United States
 *          https://en.wikipedia.org/wiki/List_of_most_commonly_challenged_books_in_the_United_States
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/add-books-batch49-young-readers.ts          # dry-run
 *   pnpm tsx --env-file=.env.local scripts/add-books-batch49-young-readers.ts --write
 */

import { adminClient } from '../src/lib/supabase'
import { notifyIndexNowFromScript } from './lib/notify-indexnow'

const WRITE = process.argv.includes('--write')
const supabase = adminClient()

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function fetchCover(title: string, author: string): Promise<{ coverUrl: string | null; workId: string | null }> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key,cover_i&limit=3`)
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number }> }
    const doc = json.docs?.find(d => d.cover_i)
    return {
      coverUrl: doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      workId: doc?.key?.replace('/works/', '') ?? null,
    }
  } catch { return { coverUrl: null, workId: null } }
}

async function upsertSource(url: string, name: string, type: string): Promise<number | null> {
  if (!WRITE) return null
  const { data, error } = await supabase
    .from('ban_sources')
    .upsert({ source_name: name, source_url: url, source_type: type }, { onConflict: 'source_url' })
    .select('id').single()
  if (error) { console.warn(`  [source warn] ${error.message}`); return null }
  return data?.id ?? null
}

async function linkBanToSource(banId: number, sourceId: number) {
  if (!WRITE) return
  const { data: existing } = await supabase.from('ban_source_links')
    .select('ban_id').eq('ban_id', banId).eq('source_id', sourceId).maybeSingle()
  if (existing) return
  const { error } = await supabase.from('ban_source_links').insert({ ban_id: banId, source_id: sourceId })
  if (error) console.warn(`  [link warn] ${error.message}`)
}

const SRC = {
  ala:  'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks',
  wiki: 'https://en.wikipedia.org/wiki/List_of_most_commonly_challenged_books_in_the_United_States',
}

const SRC_META: Record<string, [string, string]> = {
  [SRC.ala]:  ['ALA Office for Intellectual Freedom — Frequently Challenged Books', 'web'],
  [SRC.wiki]: ['Wikipedia — List of most commonly challenged books in the United States', 'web'],
}

async function getSourceId(url: string, cache: Map<string, number | null>): Promise<number | null> {
  if (cache.has(url)) return cache.get(url)!
  const [name, type] = SRC_META[url] ?? ['Unknown', 'web']
  const id = await upsertSource(url, name, type)
  cache.set(url, id)
  return id
}

async function main() {
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')

  const scopeId = (slug: string) => {
    const s = scopes!.find(s => s.slug === slug)
    if (!s) throw new Error(`Scope not found: ${slug}`)
    return s.id as number
  }
  const reasonId = (slug: string) => {
    const r = reasons!.find(r => r.slug === slug)
    if (!r) throw new Error(`Reason not found: ${slug}`)
    return r.id as number
  }
  const SCOPE_SCHOOL = scopeId('school')

  // ── Authors ────────────────────────────────────────────────────────────
  const newAuthors = [
    { slug: 'e-b-white', display_name: 'E. B. White', birth_year: 1899, death_year: 1985 },
  ] as const

  const authorIdBySlug = new Map<string, number>()
  const addedAuthorSlugs: string[] = []
  for (const a of newAuthors) {
    const { data: existing } = await supabase.from('authors').select('id').eq('slug', a.slug).maybeSingle()
    if (existing) {
      console.log(`  [exists] author ${a.slug} #${existing.id}`)
      authorIdBySlug.set(a.slug, existing.id)
      continue
    }
    console.log(`  [new author] ${a.slug} (${a.display_name})`)
    if (!WRITE) continue
    const { data, error } = await supabase.from('authors').insert(a).select('id').single()
    if (error || !data) { console.warn(`  [author warn] ${a.slug}: ${error?.message}`); continue }
    authorIdBySlug.set(a.slug, data.id)
    addedAuthorSlugs.push(a.slug)
  }

  // Pre-existing author Sendak — lookup so we can link Wild Things.
  const { data: sendakRow } = await supabase
    .from('authors').select('id').eq('slug', 'maurice-sendak').maybeSingle()
  if (sendakRow) authorIdBySlug.set('maurice-sendak', sendakRow.id)

  // ── Books ──────────────────────────────────────────────────────────────
  type BanSpec = {
    country: string
    yearStarted: number
    yearEnded: number | null
    actionType: 'banned' | 'restricted' | 'removed'
    status: 'active' | 'historical'
    scopeId: number
    reasons: string[]
    description: string
    sources: string[]
  }
  type BookSpec = {
    slug: string
    title: string
    lang: string
    year: number | null
    genres: string[]
    description_book: string
    description_ban: string
    authors: string[]
    // Known-good OpenLibrary cover_i (used when present; falls back to live
    // OL search otherwise). Hard-coded for famous titles where the live
    // search occasionally misses the cover field.
    olCoverId?: number
    olWorkId?: string
    bans: BanSpec[]
  }

  const newBooks: BookSpec[] = [
    {
      slug: 'where-the-wild-things-are',
      title: 'Where the Wild Things Are',
      lang: 'en',
      year: 1963,
      genres: ['picture-book', 'childrens-literature'],
      description_book:
        `Max, sent to bed without supper for misbehaving, sails through night and day to where the wild things are. He tames them, becomes their king, then sails home to find his supper still warm. Maurice Sendak's 1963 picture book — thirty-eight pages and ten illustrated spreads — is one of the most awarded children's books of the twentieth century and one of the most consistently challenged.`,
      description_ban:
        `On publication in 1963 a number of children's librarians refused to stock the book on the grounds that its monsters and its depiction of an unrepentantly angry child were too frightening, or would encourage children to defy their parents. Sendak later said the early reviews "were practically all terrible" and that the book was kept off many shelves for its first decade. It has appeared on ALA OIF challenged-books tallies in every decade since.`,
      authors: ['maurice-sendak'],
      olCoverId: 50842,
      olWorkId: 'OL2568879W',
      bans: [{
        country: 'US', yearStarted: 1963, yearEnded: null,
        actionType: 'restricted', status: 'active', scopeId: SCOPE_SCHOOL,
        reasons: ['moral', 'violence'],
        description:
          `Restricted and challenged in US school and public-library children's sections since publication. Most frequently cited reasons: that Max's tantrum and unrepentant flight to the wild things would encourage children to defy parents, and that the illustrated monsters were too frightening for the picture-book audience the book was written for. Logged on ALA OIF frequently-challenged tallies across multiple decades.`,
        sources: [SRC.ala, SRC.wiki],
      }],
    },
    {
      slug: 'charlottes-web',
      title: `Charlotte's Web`,
      lang: 'en',
      year: 1952,
      genres: ['childrens-literature', 'middle-grade-fiction'],
      description_book:
        `Fern saves a runt piglet, Wilbur, from being slaughtered. Wilbur is befriended in the barn by a literate spider, Charlotte A. Cavatica, who saves his life a second time by weaving messages about him into her web. Charlotte dies at the end of the summer. E. B. White's 1952 novel is among the most read children's books in English; Eudora Welty's review in the New York Times called it "just about perfect."`,
      description_ban:
        `Challenged in US school districts on two recurring grounds: that talking animals are blasphemous (disrespectful of God's order) and that Charlotte's death and the slaughter of pigs are too disturbing for young children. The most-cited challenges come from school libraries; the book is regularly listed by the ALA OIF among historically challenged children's classics.`,
      authors: ['e-b-white'],
      olCoverId: 8461797,
      olWorkId: 'OL483391W',
      bans: [{
        country: 'US', yearStarted: 1952, yearEnded: null,
        actionType: 'restricted', status: 'active', scopeId: SCOPE_SCHOOL,
        reasons: ['religious', 'moral'],
        description:
          `Challenged in US elementary-school and library settings on religious grounds (talking animals as disrespectful of natural order created by God) and on grounds that Charlotte's death and the references to slaughtering pigs are inappropriate for the young-reader audience. Logged on ALA OIF historical challenged-books tallies.`,
        sources: [SRC.ala, SRC.wiki],
      }],
    },
  ]

  const addedBookSlugs: string[] = []
  const srcCache = new Map<string, number | null>()
  let added = 0, skippedDup = 0

  for (const entry of newBooks) {
    console.log(`\n[${entry.slug}]`)
    const { data: dupCheck } = await supabase.from('books').select('id').eq('slug', entry.slug).maybeSingle()
    if (dupCheck) {
      console.log(`  [exists] book #${dupCheck.id} — skipping`)
      skippedDup++
      continue
    }

    const primaryAuthor = entry.authors[0]!
    const authorDisplay = primaryAuthor === 'maurice-sendak' ? 'Maurice Sendak' : 'E. B. White'
    let coverUrl: string | null = null
    let workId: string | null = null
    if (entry.olCoverId) {
      coverUrl = `https://covers.openlibrary.org/b/id/${entry.olCoverId}-L.jpg`
      workId = entry.olWorkId ?? null
    } else {
      const fetched = await fetchCover(entry.title, authorDisplay)
      coverUrl = fetched.coverUrl
      workId = fetched.workId
      await sleep(250)
    }
    console.log(`  cover: ${coverUrl ? coverUrl.slice(0, 70) + '…' : 'not found'}`)

    if (!WRITE) { added++; continue }

    const { data: bookRow, error: bookErr } = await supabase.from('books').insert({
      title: entry.title,
      slug: entry.slug,
      original_language: entry.lang,
      first_published_year: entry.year,
      genres: entry.genres,
      description_book: entry.description_book,
      description_ban: entry.description_ban,
      cover_url: coverUrl,
      openlibrary_work_id: workId,
      ai_drafted: false,
    }).select('id').single()

    if (bookErr || !bookRow) { console.error(`  ✗ book: ${bookErr?.message}`); continue }
    const bookId = bookRow.id
    addedBookSlugs.push(entry.slug)
    console.log(`  ✓ book id=${bookId}`)

    for (const aSlug of entry.authors) {
      const aId = authorIdBySlug.get(aSlug)
      if (!aId) { console.warn(`  [warn] author not found: ${aSlug}`); continue }
      const { error: linkErr } = await supabase.from('book_authors').insert({ book_id: bookId, author_id: aId })
      if (linkErr) console.warn(`  [book_author warn] ${linkErr.message}`)
    }

    for (const ban of entry.bans) {
      const { data: banRow, error: banErr } = await supabase.from('bans').insert({
        book_id: bookId,
        country_code: ban.country,
        scope_id: ban.scopeId,
        action_type: ban.actionType,
        status: ban.status,
        year_started: ban.yearStarted,
        year_ended: ban.yearEnded,
        description: ban.description,
        confidence: 'verified',
      }).select('id').single()

      if (banErr || !banRow) { console.error(`  ✗ ban: ${banErr?.message}`); continue }

      for (const rSlug of ban.reasons) {
        const { error } = await supabase.from('ban_reason_links')
          .insert({ ban_id: banRow.id, reason_id: reasonId(rSlug) })
        if (error) console.warn(`  [reason warn] ${rSlug}: ${error.message}`)
      }
      for (const url of ban.sources) {
        const sid = await getSourceId(url, srcCache)
        if (sid) await linkBanToSource(banRow.id, sid)
      }
      console.log(`  ✓ ban id=${banRow.id} ${ban.country} ${ban.yearStarted}`)
    }
  }

  console.log(`\n${WRITE ? 'WROTE' : '(dry-run)'} ${added} new books, ${skippedDup} skipped (already present).`)

  await notifyIndexNowFromScript({
    write: WRITE,
    books: addedBookSlugs,
    authors: addedAuthorSlugs,
  })
}

main().catch(err => { console.error(err); process.exit(1) })
