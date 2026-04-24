/**
 * Processes PEN America's school book ban index (2021-2024).
 * Source data already downloaded to /tmp/pen-books-ranked.json by scripts/parse-pen-csv.py.
 * Adds books ranked by number of ban instances, skipping anything already in the DB.
 */

import { adminClient } from '../src/lib/supabase'
import { readFileSync } from 'fs'

const supabase = adminClient()
const BATCH_DELAY_MS = 2000
const COVER_DELAY_MS = 300
const MIN_COUNT = 15          // only books with >= this many ban instances
const MAX_BOOKS  = 400        // safety ceiling

interface RankedBook {
  title: string
  slug: string
  author_display: string
  author_slug: string
  count: number
  status: string
}

interface OLResult {
  coverUrl: string | null
  workId: string | null
  publishYear: number | null
}

async function fetchOL(title: string, author: string): Promise<OLResult> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${q}&fields=key,cover_i,first_publish_year&limit=1`
    )
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number; first_publish_year?: number }> }
    const doc = json.docs?.[0]
    return {
      coverUrl:    doc?.cover_i           ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      workId:      doc?.key?.replace('/works/', '') ?? null,
      publishYear: doc?.first_publish_year ?? null,
    }
  } catch {
    return { coverUrl: null, workId: null, publishYear: null }
  }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function guessGenre(title: string, author: string): string[] {
  const t = title.toLowerCase()
  const a = author.toLowerCase()
  if (/memoir|diary|autobiography|my life|true story|i am/.test(t)) return ['memoir']
  if (/graphic novel|comics/.test(t)) return ['graphic-novel']
  if (/dragon|throne|court|kingdom|empire|ash|flames|stars|realm|crown|magic|fantasy/.test(t)) return ['fantasy', 'romance']
  if (/dystopia|hunger|divergent|maze/.test(t)) return ['dystopian', 'young-adult']
  if (/queer|transgender|gay|lesbian|bisexual|lgbtq/.test(t)) return ['young-adult']
  if (/dark|dead|kill|murder|blood|horror|carrie|it |shining/.test(t)) return ['horror', 'thriller']
  if (/history|war|civil|world war|vietnam|slavery|jim crow/.test(t)) return ['historical-fiction']
  if (/race|racism|antiracism|civil rights|black boy|color purple/.test(t)) return ['non-fiction']
  if (/poems?|poetry|verse|ode|songs?/.test(t)) return ['literary-fiction']
  // Young-adult authors by heuristic
  if (/green|anderson|blume|hinton|crutcher|paulsen|lowry|pilkey|dahl|alexie/.test(a)) return ['young-adult', 'coming-of-age']
  return ['literary-fiction']
}

// Slugs already known to be in the DB (from previous scripts) – for fast pre-filter
// The real check is done against DB-loaded slugs below.
const KNOWN_SKIP_SLUGS = new Set([
  'a-court-of-thorns-and-roses', 'crank', 'looking-for-alaska', 'nineteen-minutes',
  'the-perks-of-being-a-wallflower', 'sold-patricia-mccormick', 'thirteen-reasons-why',
  'the-kite-runner', 'the-handmaids-tale', 'the-bluest-eye', 'the-absolutely-true-diary-of-a-part-time-indian',
  'water-for-elephants', 'all-boys-arent-blue', 'gender-queer', 'the-hate-u-give',
  'beloved', 'the-color-purple', 'speak-laurie-halse-anderson', 'slaughterhouse-five',
  'brave-new-world', 'the-giver', 'drama-telgemeier',
])

async function main() {
  const ranked: RankedBook[] = JSON.parse(readFileSync('/tmp/pen-books-ranked.json', 'utf-8'))

  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const { data: existingBooks } = await supabase.from('books').select('slug')
  const { data: existingAuthors } = await supabase.from('authors').select('id, slug')

  const school = scopes!.find(s => s.slug === 'school')!.id

  // reason id for 'other' — all PEN America bans use this as fallback
  const reasonOther = reasons!.find(r => r.slug === 'other')?.id

  const existingBookSlugs = new Set((existingBooks ?? []).map(b => b.slug))
  const authorMap = new Map((existingAuthors ?? []).map(a => [a.slug, a.id as number]))

  // Filter and deduplicate candidates
  const candidates = ranked
    .filter(b => b.count >= MIN_COUNT)
    .filter(b => {
      // skip if slug already in DB
      if (existingBookSlugs.has(b.slug)) return false
      if (KNOWN_SKIP_SKIP(b.slug)) return false
      return true
    })
    .slice(0, MAX_BOOKS)

  console.log(`Processing ${candidates.length} candidates (count >= ${MIN_COUNT})`)

  const BATCH_SIZE = 20
  let inserted = 0, skipped = 0, errored = 0, noYear = 0

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(candidates.length / BATCH_SIZE)} (${i + 1}–${Math.min(i + BATCH_SIZE, candidates.length)})`)

    for (const b of batch) {
      // re-check against DB (may have been inserted in a previous run)
      if (existingBookSlugs.has(b.slug)) { skipped++; process.stdout.write(`  [skip] ${b.title}\n`); continue }

      try {
        process.stdout.write(`  [${b.count}x] ${b.title} — cover... `)
        const ol = await fetchOL(b.title, b.author_display)
        await sleep(COVER_DELAY_MS)

        const publishYear = ol.publishYear ?? 2000  // fallback — will be obvious to editors
        if (!ol.publishYear) noYear++

        console.log(ol.coverUrl ? `ok (${publishYear})` : `no cover (${publishYear})`)

        // Upsert author
        let authorId = authorMap.get(b.author_slug)
        if (!authorId && b.author_display) {
          const { data: newAuthor, error: ae } = await supabase
            .from('authors')
            .insert({ slug: b.author_slug, display_name: b.author_display, birth_year: null, death_year: null })
            .select('id').single()
          if (ae) {
            // maybe already exists with same slug
            const { data: ex } = await supabase.from('authors').select('id').eq('slug', b.author_slug).single()
            if (ex) { authorId = ex.id; authorMap.set(b.author_slug, ex.id) }
            else { console.warn(`    [warn] author insert: ${ae.message}`); }
          } else {
            authorId = newAuthor.id
            authorMap.set(b.author_slug, authorId)
          }
        }

        // Insert book
        const { data: newBook, error: be } = await supabase.from('books').insert({
          title: b.title,
          slug: b.slug,
          original_language: 'en',
          first_published_year: publishYear,
          ai_drafted: false,
          genres: guessGenre(b.title, b.author_display),
          cover_url: ol.coverUrl,
          openlibrary_work_id: ol.workId,
        }).select('id').single()
        if (be) throw be
        const bookId = newBook.id
        existingBookSlugs.add(b.slug)

        // Link author
        if (authorId) {
          const { error: bae } = await supabase.from('book_authors').insert({ book_id: bookId, author_id: authorId })
          if (bae) console.warn(`    [warn] book_author: ${bae.message}`)
        }

        // Insert ban
        const { data: newBan, error: bane } = await supabase.from('bans').insert({
          book_id: bookId,
          country_code: 'US',
          scope_id: school,
          action_type: 'banned',
          status: b.status,
          year_started: publishYear + 1,  // approximate — often banned shortly after pub
        }).select('id').single()
        if (bane) throw bane

        // Reason
        if (reasonOther) {
          await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: reasonOther })
        }

        // Source
        const { data: src } = await supabase.from('ban_sources').upsert({
          source_name: 'PEN America',
          source_url: 'https://pen.org/book-bans/',
          source_type: 'web',
        }, { onConflict: 'source_url' }).select('id').single()
        if (src) {
          await supabase.from('ban_source_links').insert({ ban_id: newBan.id, source_id: src.id })
        }

        console.log(`  [ok] ${b.title}`)
        inserted++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  [error] ${b.title}: ${msg}`)
        errored++
      }
    }

    if (i + BATCH_SIZE < candidates.length) {
      process.stdout.write(`  waiting ${BATCH_DELAY_MS}ms...\n`)
      await sleep(BATCH_DELAY_MS)
    }
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Done. Inserted: ${inserted}  Skipped: ${skipped}  Errored: ${errored}  NoYear: ${noYear}`)
  console.log('Run: npx tsx --env-file=.env.local scripts/generate-descriptions.ts')
}

function KNOWN_SKIP_SKIP(slug: string): boolean {
  return KNOWN_SKIP_SLUGS.has(slug)
}

main().catch(err => { console.error(err); process.exit(1) })
