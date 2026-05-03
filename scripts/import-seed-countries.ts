/**
 * Import seed ban data for Germany, India, South Africa, and Argentina.
 *
 * Logic per book:
 *  - If book already exists (by slug): add only the new ban
 *  - If book is new: create book + author + ban
 *  - Never create duplicate bans (same book + country + year + action_type)
 *
 * After inserting new books, enriches them:
 *  - Fetches description (Open Library → Google Books)
 *  - Fetches cover (Open Library → Google Books)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-seed-countries.ts
 *     → dry-run: shows what would be inserted, no writes
 *   npx tsx --env-file=.env.local scripts/import-seed-countries.ts --apply
 *     → writes to database
 *   npx tsx --env-file=.env.local scripts/import-seed-countries.ts --country=DE
 *     → process only one country (DE|IN|ZA|AR)
 */

import { adminClient } from '../src/lib/supabase'

const APPLY   = process.argv.includes('--apply')
const countryArg = process.argv.find(a => a.startsWith('--country='))?.split('=')[1]?.toUpperCase()

const OL_HEADERS = { 'User-Agent': 'banned-books.org/1.0 (contact@banned-books.org)' }

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Slug helper ───────────────────────────────────────────────────────────────

function toSlug(s: string): string {
  return s.toLowerCase()
    .replace(/['''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ── Seed data ─────────────────────────────────────────────────────────────────

type BanSeed = {
  title: string
  author: string
  year: number
  reason: string
  description: string
  status: 'active' | 'historical'
  lang?: string  // original_language, defaults to 'en'
}

type CountrySeed = {
  code: string
  scope: string
  sourceUrl: string
  sourceName: string
  bans: BanSeed[]
}

const SEED: CountrySeed[] = [
  {
    code: 'DE',
    scope: 'government',
    sourceName: 'Wikipedia – Book burning in Nazi Germany',
    sourceUrl: 'https://en.wikipedia.org/wiki/Book_burning_in_Nazi_Germany',
    bans: [
      { title: 'All Quiet on the Western Front', author: 'Erich Maria Remarque', year: 1933, reason: 'political', lang: 'de', status: 'historical', description: 'Banned by Nazi regime for its anti-war message and portrayal of German soldiers.' },
      { title: 'The Trial', author: 'Franz Kafka', year: 1933, reason: 'political', lang: 'de', status: 'historical', description: "Banned by Nazi regime. Kafka was Jewish; his works were burned as 'degenerate literature'." },
      { title: 'The Metamorphosis', author: 'Franz Kafka', year: 1933, reason: 'political', lang: 'de', status: 'historical', description: 'Banned by Nazi regime as part of systematic persecution of Jewish authors.' },
      { title: 'Berlin Alexanderplatz', author: 'Alfred Döblin', year: 1933, reason: 'political', lang: 'de', status: 'historical', description: 'Banned by Nazi regime. Döblin was Jewish and fled Germany in 1933.' },
      { title: 'Steppenwolf', author: 'Hermann Hesse', year: 1933, reason: 'political', lang: 'de', status: 'historical', description: 'Banned by Nazi regime for its individualism and anti-nationalist themes.' },
      { title: 'The Origin of Species', author: 'Charles Darwin', year: 1933, reason: 'other', status: 'historical', description: 'Banned by Nazi regime for conflicting with ideological views on race and creation.' },
      { title: 'Ulysses', author: 'James Joyce', year: 1933, reason: 'sexual', status: 'historical', description: 'Banned by Nazi regime as degenerate foreign literature.' },
      { title: 'The Tin Drum', author: 'Günter Grass', year: 1959, reason: 'sexual', lang: 'de', status: 'historical', description: 'Restricted by German authorities (BPjM) for sexual content. Later unbanned.' },
      { title: 'American Psycho', author: 'Bret Easton Ellis', year: 1995, reason: 'sexual', status: 'active', description: 'Indexed by BPjM for extreme violence and sexual content. Sale restricted to adults.' },
    ],
  },
  {
    code: 'IN',
    scope: 'government',
    sourceName: 'Wikipedia – List of books banned in India',
    sourceUrl: 'https://en.wikipedia.org/wiki/List_of_books_banned_in_India',
    bans: [
      { title: 'The Satanic Verses', author: 'Salman Rushdie', year: 1988, reason: 'religious', status: 'active', description: 'Banned by Indian government under Rajiv Gandhi for blasphemy against Islam. First country to ban it.' },
      { title: "The Moor's Last Sigh", author: 'Salman Rushdie', year: 1995, reason: 'political', status: 'historical', description: 'Temporarily restricted in Maharashtra state due to alleged defamation of political figures.' },
      { title: 'The God of Small Things', author: 'Arundhati Roy', year: 1997, reason: 'sexual', status: 'historical', description: 'Faced obscenity charges in Kerala for sexual content. Case later dismissed.' },
      { title: 'Such a Long Journey', author: 'Rohinton Mistry', year: 2010, reason: 'political', status: 'historical', description: 'Removed from Mumbai University syllabus after protests by Shiv Sena over political content.' },
      { title: 'The Polyester Prince', author: 'Hamish McDonald', year: 1998, reason: 'political', status: 'active', description: 'Banned in India following legal pressure. Biography of Dhirubhai Ambani.' },
      { title: 'An Area of Darkness', author: 'V.S. Naipaul', year: 1964, reason: 'political', status: 'historical', description: 'Banned for its critical portrayal of Indian society and culture.' },
      { title: 'The Hindus: An Alternative History', author: 'Wendy Doniger', year: 2014, reason: 'religious', status: 'historical', description: 'Publisher withdrew book under legal pressure from Hindu groups citing religious offense.' },
      { title: 'Great Soul', author: 'Joseph Lelyveld', year: 2011, reason: 'political', status: 'historical', description: "Banned in Gujarat state for alleged disrespectful portrayal of Mahatma Gandhi." },
      { title: 'Nine Hours to Rama', author: 'Stanley Wolpert', year: 1962, reason: 'political', status: 'historical', description: "Banned for its fictional account of Gandhi's assassination." },
    ],
  },
  {
    code: 'ZA',
    scope: 'government',
    sourceName: 'SA History Archive – Banned books in South Africa',
    sourceUrl: 'https://www.sahistory.org.za/article/banned-books-south-africa',
    bans: [
      { title: "Burger's Daughter", author: 'Nadine Gordimer', year: 1979, reason: 'political', status: 'historical', description: 'Banned under apartheid Publications Act for its portrayal of anti-apartheid activism.' },
      { title: "July's People", author: 'Nadine Gordimer', year: 1981, reason: 'political', status: 'historical', description: 'Banned under apartheid for depicting the fall of white rule in South Africa.' },
      { title: 'Kaffir Boy', author: 'Mark Mathabane', year: 1986, reason: 'political', status: 'historical', description: 'Banned under apartheid for its depiction of life under the system and use of language.' },
      { title: 'The Communist Manifesto', author: 'Karl Marx', year: 1950, reason: 'political', lang: 'de', status: 'historical', description: 'Banned under apartheid as communist literature threatening state security.' },
      { title: 'The Wretched of the Earth', author: 'Frantz Fanon', year: 1965, reason: 'political', lang: 'fr', status: 'historical', description: 'Banned under apartheid for its anti-colonial and revolutionary content.' },
      { title: 'The Second Sex', author: 'Simone de Beauvoir', year: 1960, reason: 'sexual', lang: 'fr', status: 'historical', description: 'Banned under apartheid Publications Act for sexual content.' },
      { title: 'Black Beauty', author: 'Anna Sewell', year: 1955, reason: 'other', status: 'historical', description: "Banned under apartheid. The word 'black' in the title was considered politically sensitive." },
      { title: 'Lolita', author: 'Vladimir Nabokov', year: 1960, reason: 'sexual', status: 'historical', description: 'Banned under apartheid Publications Act for sexual content.' },
      { title: "Lady Chatterley's Lover", author: 'D.H. Lawrence', year: 1955, reason: 'sexual', status: 'historical', description: 'Banned under apartheid Publications Act for explicit sexual content.' },
      { title: 'Cry, the Beloved Country', author: 'Alan Paton', year: 1950, reason: 'political', status: 'historical', description: 'Restricted in some contexts under apartheid despite its author being South African.' },
    ],
  },
  {
    code: 'AR',
    scope: 'government',
    sourceName: 'Memoria Abierta – Argentina',
    sourceUrl: 'https://www.memoriaabierta.org.ar',
    bans: [
      { title: 'The Little Prince', author: 'Antoine de Saint-Exupéry', year: 1977, reason: 'political', lang: 'fr', status: 'historical', description: 'Banned by military junta (1976–1983) for alleged subversive content and socialist symbolism.' },
      { title: 'The Trial', author: 'Franz Kafka', year: 1976, reason: 'political', lang: 'de', status: 'historical', description: 'Banned by military junta as subversive literature.' },
      { title: 'The Metamorphosis', author: 'Franz Kafka', year: 1976, reason: 'political', lang: 'de', status: 'historical', description: 'Banned by military junta as part of systematic censorship of leftist-associated authors.' },
      { title: 'The Communist Manifesto', author: 'Karl Marx', year: 1976, reason: 'political', lang: 'de', status: 'historical', description: 'Banned by military junta as communist literature.' },
      { title: 'Open Veins of Latin America', author: 'Eduardo Galeano', year: 1976, reason: 'political', lang: 'es', status: 'historical', description: 'Banned by military junta for its Marxist analysis of Latin American history. Became a symbol of resistance.' },
      { title: 'The Grapes of Wrath', author: 'John Steinbeck', year: 1976, reason: 'political', status: 'historical', description: 'Banned by military junta for its depiction of class struggle and socialist themes.' },
      { title: 'Operacion Masacre', author: 'Rodolfo Walsh', year: 1976, reason: 'political', lang: 'es', status: 'historical', description: 'Banned by military junta. Walsh was later disappeared by the regime in 1977.' },
      { title: 'Brave New World', author: 'Aldous Huxley', year: 1976, reason: 'political', status: 'historical', description: 'Banned by military junta as ideologically subversive.' },
      { title: '1984', author: 'George Orwell', year: 1976, reason: 'political', status: 'historical', description: 'Banned by military junta for its critique of totalitarianism — ironic given the context.' },
      { title: 'For Whom the Bell Tolls', author: 'Ernest Hemingway', year: 1976, reason: 'political', status: 'historical', description: 'Banned by military junta for its portrayal of the Spanish Civil War and anti-fascist themes.' },
    ],
  },
]

// ── Open Library / Google Books enrichment ────────────────────────────────────

async function fetchOLData(title: string, author: string): Promise<{ coverUrl: string | null; workId: string | null; publishYear: number | null }> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${q}&fields=key,cover_i,first_publish_year&limit=1`,
      { headers: OL_HEADERS },
    )
    await sleep(350)
    if (!res.ok) return { coverUrl: null, workId: null, publishYear: null }
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number; first_publish_year?: number }> }
    const doc = json.docs?.[0]
    return {
      coverUrl:    doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      workId:      doc?.key?.replace('/works/', '') ?? null,
      publishYear: doc?.first_publish_year ?? null,
    }
  } catch { return { coverUrl: null, workId: null, publishYear: null } }
}

async function fetchGBDescription(title: string, author: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`intitle:${title} inauthor:${author}`)
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&fields=items(volumeInfo(description))`)
    if (!res.ok) return null
    const json = await res.json() as { items?: Array<{ volumeInfo: { description?: string } }> }
    return json.items?.[0]?.volumeInfo?.description ?? null
  } catch { return null }
}

async function fetchGBCover(title: string, author: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`intitle:${title} inauthor:${author}`)
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&fields=items(volumeInfo(imageLinks))`)
    if (!res.ok) return null
    const json = await res.json() as { items?: Array<{ volumeInfo: { imageLinks?: { thumbnail?: string } } }> }
    const img = json.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
    if (!img) return null
    return img.replace('zoom=1', 'zoom=3').replace('http://', 'https://').replace('&edge=curl', '')
  } catch { return null }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── import-seed-countries (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const supabase = adminClient()

  const countriesToProcess = countryArg
    ? SEED.filter(c => c.code === countryArg)
    : SEED

  if (countryArg && countriesToProcess.length === 0) {
    console.error(`Unknown country: ${countryArg}. Use DE, IN, ZA, or AR.`)
    process.exit(1)
  }

  // Load all existing books (paginated)
  let allExisting: { id: number; slug: string; title: string }[] = []
  let offset = 0
  while (true) {
    const { data } = await supabase.from('books').select('id, slug, title').range(offset, offset + 999)
    if (!data || data.length === 0) break
    allExisting = allExisting.concat(data as typeof allExisting)
    if (data.length < 1000) break
    offset += 1000
  }
  const existingBySlug = new Map(allExisting.map(b => [b.slug, b]))
  const existingByTitleLower = new Map(allExisting.map(b => [b.title.toLowerCase(), b]))

  // Load all existing bans for dedup
  let allBans: { id: number; book_id: number; country_code: string; year_started: number | null; action_type: string }[] = []
  offset = 0
  while (true) {
    const { data } = await supabase
      .from('bans').select('id, book_id, country_code, year_started, action_type').range(offset, offset + 999)
    if (!data || data.length === 0) break
    allBans = allBans.concat(data as typeof allBans)
    if (data.length < 1000) break
    offset += 1000
  }

  // Load scopes
  const { data: scopes } = await supabase.from('scopes').select('id, slug, label_en')
  const scopeBySlug = new Map((scopes ?? []).map(s => [s.slug as string, s.id as number]))
  const scopeByLabel = (label: string) =>
    (scopes ?? []).find(s => (s.label_en as string).toLowerCase().includes(label.toLowerCase()))?.id

  // Load reasons
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const reasonBySlug = new Map((reasons ?? []).map(r => [r.slug as string, r.id as number]))

  // Load existing authors
  const { data: existingAuthors } = await supabase.from('authors').select('id, slug')
  const authorMap = new Map((existingAuthors ?? []).map(a => [a.slug as string, a.id as number]))

  // ── Dry-run analysis ────────────────────────────────────────────────────────

  const summaryLines: string[] = []

  for (const country of countriesToProcess) {
    let newBooks = 0, existingBooks = 0, newBans = 0, dupBans = 0

    for (const ban of country.bans) {
      const slug = toSlug(ban.title)
      const existing = existingBySlug.get(slug) ?? existingByTitleLower.get(ban.title.toLowerCase())
      if (existing) {
        existingBooks++
        const dupBan = allBans.find(b =>
          b.book_id === existing.id &&
          b.country_code === country.code &&
          b.year_started === ban.year &&
          b.action_type === 'banned',
        )
        if (dupBan) dupBans++
        else newBans++
      } else {
        newBooks++
        newBans++
      }
    }

    summaryLines.push(
      `${country.code}: ${country.bans.length} bans → ${newBooks} new books + ${existingBooks} existing books, ${dupBans} duplicate${dupBans !== 1 ? 's' : ''}`,
    )
  }

  console.log('── Analysis ──')
  summaryLines.forEach(l => console.log(l))

  // Show 5 samples per country
  for (const country of countriesToProcess) {
    console.log(`\n── ${country.code} samples ──`)
    country.bans.slice(0, 5).forEach(ban => {
      const slug = toSlug(ban.title)
      const existing = existingBySlug.get(slug) ?? existingByTitleLower.get(ban.title.toLowerCase())
      console.log(`  [${existing ? 'EXISTS' : 'NEW   '}] "${ban.title}" — ${ban.author} (${ban.year})`)
    })
  }

  if (!APPLY) {
    console.log('\n── Dry-run complete. Re-run with --apply to insert. ──\n')
    return
  }

  // ── APPLY ───────────────────────────────────────────────────────────────────

  const govScopeId = scopeBySlug.get('government') ?? scopeByLabel('government') ?? scopeByLabel('national')
  if (!govScopeId) {
    console.error('Could not find government scope. Available:', [...scopeBySlug.keys()])
    process.exit(1)
  }

  let totalNew = 0, totalBansAdded = 0, totalDupSkipped = 0, totalErrors = 0

  for (const country of countriesToProcess) {
    console.log(`\n── ${country.code} ──`)

    // Upsert source
    const { data: sourceRow } = await supabase.from('ban_sources').upsert(
      { source_name: country.sourceName, source_url: country.sourceUrl, source_type: 'web' },
      { onConflict: 'source_url' },
    ).select('id').single()
    const sourceId = (sourceRow as { id: number } | null)?.id ?? null

    for (const ban of country.bans) {
      const slug = toSlug(ban.title)
      let book = existingBySlug.get(slug) ?? existingByTitleLower.get(ban.title.toLowerCase())
      let bookId: number

      try {
        if (book) {
          bookId = book.id
          process.stdout.write(`  [EXISTS] "${ban.title}" `)
        } else {
          // Fetch OL data for new book
          process.stdout.write(`  [NEW   ] "${ban.title}" — fetching... `)
          const ol = await fetchOLData(ban.title, ban.author)

          // Fetch description
          let description: string | null = null
          if (ol.workId) {
            // Try OL description via work API
            try {
              const workRes = await fetch(`https://openlibrary.org/works/${ol.workId}.json`, { headers: OL_HEADERS })
              await sleep(200)
              if (workRes.ok) {
                const workJson = await workRes.json() as { description?: string | { value?: string } }
                description = typeof workJson.description === 'string'
                  ? workJson.description
                  : workJson.description?.value ?? null
              }
            } catch { /* ignore */ }
          }
          if (!description) {
            description = await fetchGBDescription(ban.title, ban.author)
          }

          // Fetch cover if OL didn't return one
          let coverUrl = ol.coverUrl
          if (!coverUrl) {
            coverUrl = await fetchGBCover(ban.title, ban.author)
          }

          // Upsert author
          const authorSlug = toSlug(ban.author)
          let authorId = authorMap.get(authorSlug)
          if (!authorId) {
            const { data: newAuthor, error: ae } = await supabase
              .from('authors')
              .insert({ slug: authorSlug, display_name: ban.author })
              .select('id').single()
            if (ae) {
              const { data: ex } = await supabase.from('authors').select('id').eq('slug', authorSlug).single()
              if (ex) { authorId = (ex as { id: number }).id; authorMap.set(authorSlug, authorId) }
            } else {
              authorId = (newAuthor as { id: number }).id
              authorMap.set(authorSlug, authorId)
            }
          }

          // Insert book
          const { data: newBook, error: be } = await supabase.from('books').insert({
            title: ban.title,
            slug,
            original_language: ban.lang ?? 'en',
            first_published_year: ol.publishYear ?? null,
            ai_drafted: false,
            cover_url: coverUrl,
            openlibrary_work_id: ol.workId,
            description_book: description,
          }).select('id').single()
          if (be) throw new Error(`book insert: ${be.message}`)

          bookId = (newBook as { id: number }).id
          existingBySlug.set(slug, { id: bookId, slug, title: ban.title })

          if (authorId) {
            await supabase.from('book_authors').insert({ book_id: bookId, author_id: authorId })
          }

          totalNew++
          process.stdout.write(`✓ (${ol.coverUrl ? 'cover' : 'no cover'}, ${description ? 'desc' : 'no desc'})\n`)
        }

        // Check for duplicate ban
        const dupBan = allBans.find(b =>
          b.book_id === bookId &&
          b.country_code === country.code &&
          b.year_started === ban.year &&
          b.action_type === 'banned',
        )
        if (dupBan) {
          console.log(`duplicate ban skipped`)
          totalDupSkipped++
          continue
        }

        // Insert ban
        const reasonId = reasonBySlug.get(ban.reason) ?? reasonBySlug.get('other')
        const { data: newBan, error: bane } = await supabase.from('bans').insert({
          book_id: bookId,
          country_code: country.code,
          scope_id: govScopeId,
          action_type: 'banned',
          status: ban.status,
          year_started: ban.year,
          description: ban.description,
        }).select('id').single()
        if (bane) throw new Error(`ban insert: ${bane.message}`)

        const banId = (newBan as { id: number }).id

        if (reasonId) {
          await supabase.from('ban_reason_links').insert({ ban_id: banId, reason_id: reasonId })
        }
        if (sourceId) {
          await supabase.from('ban_source_links').insert({ ban_id: banId, source_id: sourceId })
        }

        // Add to allBans to prevent duplicates within this run
        allBans.push({ id: banId, book_id: bookId, country_code: country.code, year_started: ban.year, action_type: 'banned' })

        if (book) console.log(`ban added`)
        totalBansAdded++
      } catch (err) {
        console.error(`\n  [error] ${err instanceof Error ? err.message : String(err)}`)
        totalErrors++
      }
    }
  }

  console.log('\n── Done ──')
  console.log(`New books inserted:  ${totalNew}`)
  console.log(`Bans added:          ${totalBansAdded}`)
  console.log(`Duplicate bans skip: ${totalDupSkipped}`)
  console.log(`Errors:              ${totalErrors}`)

  // Generate censorship context for any new books
  if (totalNew > 0) {
    console.log('\nGenerating censorship context for newly imported books...')
    // Re-run generate-censorship-context for the new books (they have no context yet)
    const { data: newBookIds } = await supabase
      .from('books')
      .select('id')
      .is('censorship_context', null)
      .not('id', 'is', null)

    console.log(`${newBookIds?.length ?? 0} books still need censorship context — run: npx tsx --env-file=.env.local scripts/generate-censorship-context.ts --apply`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
