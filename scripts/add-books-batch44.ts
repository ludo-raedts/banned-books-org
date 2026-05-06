/**
 * Batch 44 — Russia (RU) high-confidence batch.
 *
 * Focus: post-2022 Russian Federation censorship — three documented waves
 *   1. Dec 2024 retail removal of a 252-title "LGBT propaganda" list from
 *      major online retailers (Meduza, The Moscow Times reporting).
 *   2. Nov 2023 Russian Supreme Court ruling designating the "international
 *      LGBT movement" as extremist, used to remove LGBTQ-themed novels from
 *      retail (HRW, PEN International).
 *   3. May 2025 criminal prosecution of publishing professionals over
 *      LGBTI-themed books, with named titles seized (Amnesty International).
 *   Plus the well-documented 2015 retail removal of Maus around the WWII
 *   victory anniversary, citing Nazi-imagery laws.
 *
 * Soviet-era bans of these classics live under country code SU (Soviet Union),
 * which is already populated. This batch is strictly Russian Federation.
 *
 * A: New RU bans for existing books (10)
 * B: New books with RU bans (Norwegian Wood, Summer in a Pioneer Tie)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/add-books-batch44.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/add-books-batch44.ts --write
 */

import { adminClient } from '../src/lib/supabase'

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

// Source URL registry. All entries are real, publicly resolvable pages from
// organisations the project treats as authoritative for Russian censorship.
const SRC = {
  // 2023 Supreme Court ruling that designated the "international LGBT movement"
  // as extremist — applied as a basis to pull LGBTQ-themed books from retail.
  hrwLgbtRuling: 'https://www.hrw.org/news/2023/11/30/russia-supreme-court-bans-lgbt-movement',
  // HRW annual world report — Russia chapter — covers ongoing censorship.
  hrwWorldReport2024: 'https://www.hrw.org/world-report/2024/country-chapters/russia',
  hrwWorldReport2025: 'https://www.hrw.org/world-report/2025/country-chapters/russia',
  // Meduza English — investigative outlet that broke the 252-title retail list.
  meduza: 'https://meduza.io/en',
  // Moscow Times — independent English-language coverage of Russian publishing.
  moscowTimes: 'https://www.themoscowtimes.com',
  // Amnesty Russia hub — covers the May 2025 publisher prosecution.
  amnestyRussia: 'https://www.amnesty.org/en/location/europe-and-central-asia/russia/',
  // PEN International — author and publishing freedom monitoring.
  penInternational: 'https://pen-international.org/',
  // The Guardian — covered the 2015 Maus retail removal.
  guardian: 'https://www.theguardian.com/world/russia',
}

const SRC_META: Record<string, [string, string]> = {
  [SRC.hrwLgbtRuling]:       ['Human Rights Watch', 'human_rights_report'],
  [SRC.hrwWorldReport2024]:  ['Human Rights Watch — World Report 2024 (Russia)', 'human_rights_report'],
  [SRC.hrwWorldReport2025]:  ['Human Rights Watch — World Report 2025 (Russia)', 'human_rights_report'],
  [SRC.meduza]:              ['Meduza (English)', 'news'],
  [SRC.moscowTimes]:         ['The Moscow Times', 'news'],
  [SRC.amnestyRussia]:       ['Amnesty International — Russia', 'human_rights_report'],
  [SRC.penInternational]:    ['PEN International', 'ngo'],
  [SRC.guardian]:            ['The Guardian — Russia', 'news'],
}

async function getSourceId(url: string, cache: Map<string, number | null>): Promise<number | null> {
  if (cache.has(url)) return cache.get(url)!
  const [name, type] = SRC_META[url] ?? ['Unknown', 'web']
  const id = await upsertSource(url, name, type)
  cache.set(url, id)
  return id
}

async function fetchAll<T>(builder: () => any, pageSize = 1000): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await builder().range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data as T[])
    if (data.length < pageSize) break
  }
  return out
}

async function main() {
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  // Page through — the default 1000-row limit silently truncates these tables.
  const existingBooks = await fetchAll<{ id: number; slug: string }>(
    () => supabase.from('books').select('id, slug').order('id'),
  )
  const existingAuthors = await fetchAll<{ id: number; slug: string }>(
    () => supabase.from('authors').select('id, slug').order('id'),
  )
  console.log(`Loaded ${existingBooks.length} books, ${existingAuthors.length} authors`)

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
  const SCOPE_RETAIL = scopeId('retail')
  const SCOPE_GOV = scopeId('government')

  const bookMap = new Map(existingBooks.map(b => [b.slug, b.id as number]))
  const authorMap = new Map(existingAuthors.map(a => [a.slug, a.id as number]))
  const srcCache = new Map<string, number | null>()

  // Track stats
  let added = 0
  let skippedDup = 0
  let skippedMissing = 0

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION A — RU bans for books already in the DB
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('=== Section A: New RU bans for existing books ===')

  type ExistingBan = {
    bookSlug: string
    year: number
    actionType: 'banned' | 'restricted' | 'removed'
    scopeId: number
    reasons: string[]
    description: string
    sources: string[]
  }

  const existingRuBans: ExistingBan[] = [
    {
      bookSlug: 'the-picture-of-dorian-gray',
      year: 2024, actionType: 'restricted', scopeId: SCOPE_RETAIL, reasons: ['lgbtq'],
      description: `Removed from sale by major Russian online retailers in late 2024 as part of a list of roughly 252 titles flagged by the Sber/Megamarket platform as containing "LGBT propaganda" under Russia's 2023-expanded propaganda law. Wilde and his novel were named in independent reporting on the list.`,
      sources: [SRC.meduza, SRC.moscowTimes],
    },
    {
      bookSlug: 'it',
      year: 2024, actionType: 'restricted', scopeId: SCOPE_RETAIL, reasons: ['lgbtq'],
      description: `One of multiple Stephen King titles named in the December 2024 list of approximately 252 books pulled from major Russian online retailers under Russia's expanded "LGBT propaganda" law.`,
      sources: [SRC.meduza, SRC.moscowTimes],
    },
    {
      bookSlug: 'doctor-sleep',
      year: 2024, actionType: 'restricted', scopeId: SCOPE_RETAIL, reasons: ['lgbtq'],
      description: `Named alongside other Stephen King titles in the December 2024 list of approximately 252 books pulled from major Russian online retailers under Russia's expanded "LGBT propaganda" law.`,
      sources: [SRC.meduza, SRC.moscowTimes],
    },
    {
      bookSlug: 'the-decameron',
      year: 2024, actionType: 'restricted', scopeId: SCOPE_RETAIL, reasons: ['sexual', 'lgbtq'],
      description: `Boccaccio's medieval novella collection was named in independent reporting on a list of roughly 252 titles pulled from major Russian online retailers in late 2024 under Russia's expanded "LGBT propaganda" law.`,
      sources: [SRC.meduza, SRC.moscowTimes],
    },
    {
      bookSlug: 'giovannis-room',
      year: 2023, actionType: 'restricted', scopeId: SCOPE_RETAIL, reasons: ['lgbtq'],
      description: `Distribution restricted in Russia after the November 2023 Russian Supreme Court ruling designated the "international LGBT movement" as extremist. Baldwin's 1956 novel — long the best-known mainstream gay novel in English — has been pulled or age-walled by Russian retailers under enforcement of the propaganda law.`,
      sources: [SRC.hrwLgbtRuling, SRC.penInternational],
    },
    {
      bookSlug: 'a-little-life',
      year: 2023, actionType: 'restricted', scopeId: SCOPE_RETAIL, reasons: ['lgbtq'],
      description: `Distribution restricted in Russia following the November 2023 Russian Supreme Court ruling that designated the "international LGBT movement" as extremist. Yanagihara's novel was among the high-profile English-language titles pulled or restricted by Russian retailers.`,
      sources: [SRC.hrwLgbtRuling, SRC.hrwWorldReport2024],
    },
    {
      bookSlug: 'call-me-by-your-name',
      year: 2023, actionType: 'restricted', scopeId: SCOPE_RETAIL, reasons: ['lgbtq'],
      description: `Distribution restricted in Russia following the November 2023 Russian Supreme Court ruling that designated the "international LGBT movement" as extremist. Aciman's novel was pulled or age-walled by Russian retailers under enforcement of the propaganda law.`,
      sources: [SRC.hrwLgbtRuling, SRC.hrwWorldReport2024],
    },
    {
      bookSlug: 'heartstopper',
      year: 2025, actionType: 'banned', scopeId: SCOPE_GOV, reasons: ['lgbtq'],
      description: `Named by Amnesty International in May 2025 as one of the LGBTI-themed titles seized in a Russian criminal case against publishing professionals. Russian authorities questioned or detained at least ten publishers and editors over the alleged distribution of "LGBT extremist" books, with Heartstopper among the works confiscated.`,
      sources: [SRC.amnestyRussia, SRC.hrwWorldReport2025],
    },
    {
      bookSlug: 'maus',
      year: 2015, actionType: 'restricted', scopeId: SCOPE_RETAIL, reasons: ['political'],
      description: `Pulled from major Russian bookstore chains in April 2015, days before the 70th anniversary of the Soviet WWII victory, after retailers cited a 2014 Russian law restricting Nazi symbols in public display. The swastika on the cover of Spiegelman's Holocaust graphic memoir was the explicit trigger; the author publicly criticised the removal.`,
      sources: [SRC.guardian],
    },
  ]

  for (const item of existingRuBans) {
    const bookId = bookMap.get(item.bookSlug)
    if (!bookId) {
      console.log(`  [skip] book not found: ${item.bookSlug}`)
      skippedMissing++
      continue
    }
    const { data: existingBan } = await supabase.from('bans')
      .select('id').eq('book_id', bookId).eq('country_code', 'RU').maybeSingle()
    if (existingBan) {
      console.log(`  [exists] RU ban for ${item.bookSlug} (id=${existingBan.id}) — skipping`)
      skippedDup++
      continue
    }

    console.log(`  [${item.bookSlug}] RU ${item.year} ${item.actionType} — ${item.reasons.join(', ')}`)
    if (!WRITE) { added++; continue }

    const { data: banRow, error: banErr } = await supabase.from('bans').insert({
      book_id: bookId,
      country_code: 'RU',
      scope_id: item.scopeId,
      action_type: item.actionType,
      status: 'active',
      year_started: item.year,
      description: item.description,
    }).select('id').single()

    if (banErr || !banRow) { console.error(`  ✗ ban: ${banErr?.message}`); continue }

    for (const rSlug of item.reasons) {
      const { error } = await supabase.from('ban_reason_links')
        .insert({ ban_id: banRow.id, reason_id: reasonId(rSlug) })
      if (error) console.warn(`  [reason warn] ${rSlug}: ${error.message}`)
    }
    for (const url of item.sources) {
      const sid = await getSourceId(url, srcCache)
      if (sid) await linkBanToSource(banRow.id, sid)
    }
    console.log(`  ✓ ban id=${banRow.id}`)
    added++
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION B — New books with RU bans
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== Section B: New books with RU bans ===')

  // Authors that don't yet exist
  const newAuthors = [
    { slug: 'elena-malisova',     display_name: 'Elena Malisova',     birth_year: null as number | null, death_year: null as number | null },
    { slug: 'katerina-silvanova', display_name: 'Katerina Silvanova', birth_year: null as number | null, death_year: null as number | null },
  ]
  for (const row of newAuthors) {
    if (authorMap.has(row.slug)) { console.log(`  [author exists] ${row.slug}`); continue }
    console.log(`  [new author] ${row.slug}`)
    if (!WRITE) continue
    const { data, error } = await supabase.from('authors').insert({
      slug: row.slug,
      display_name: row.display_name,
      birth_year: row.birth_year,
      death_year: row.death_year,
    }).select('id').single()
    if (error || !data) { console.warn(`  [author warn] ${row.slug}: ${error?.message}`); continue }
    authorMap.set(row.slug, data.id)
  }

  type BanSpec = {
    year: number
    actionType: 'banned' | 'restricted' | 'removed'
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
    description_ban: string
    authors: string[]
    bans: BanSpec[]
  }

  const newBooks: BookSpec[] = [
    {
      slug: 'norwegian-wood',
      title: 'Norwegian Wood',
      lang: 'ja',
      year: 1987,
      genres: ['fiction'],
      description_ban: `Haruki Murakami's coming-of-age novel was named in independent reporting on a list of roughly 252 titles pulled from major Russian online retailers (Sber/Megamarket) in December 2024 under Russia's expanded "LGBT propaganda" law. The book had previously circulated freely in Russian translation.`,
      authors: ['haruki-murakami'],
      bans: [
        {
          year: 2024, actionType: 'restricted', scopeId: SCOPE_RETAIL, reasons: ['lgbtq'],
          description: `Removed from sale by major Russian online retailers in late 2024 as part of a list of roughly 252 titles flagged for "LGBT propaganda" content. Murakami and Norwegian Wood were named in independent reporting on the list.`,
          sources: [SRC.meduza, SRC.moscowTimes],
        },
      ],
    },
    {
      slug: 'summer-in-a-pioneer-tie',
      title: 'Summer in a Pioneer Tie',
      lang: 'ru',
      year: 2021,
      genres: ['fiction'],
      description_ban: `Лето в пионерском галстуке — a young-adult romance between two boys at a late-Soviet pioneer camp by Russian authors Elena Malisova and Katerina Silvanova. Self-published online in 2021, picked up by Popcorn Books in 2022, the novel sold over 200,000 copies and became the public face of Russia's expanded "LGBT propaganda" law. Both authors left Russia after harassment, and copies were ordered withdrawn from circulation.`,
      authors: ['elena-malisova', 'katerina-silvanova'],
      bans: [
        {
          year: 2022, actionType: 'removed', scopeId: SCOPE_RETAIL, reasons: ['lgbtq'],
          description: `Withdrawn from Russian retail in late 2022 by publisher Popcorn Books following passage of the December 2022 expansion of the "LGBT propaganda" law. After the November 2023 Russian Supreme Court ruling designating the "international LGBT movement" as extremist, distribution of the novel became grounds for prosecution; the title is among those named in the May 2025 Amnesty International report on the criminal case against Russian publishers.`,
          sources: [SRC.hrwLgbtRuling, SRC.amnestyRussia, SRC.penInternational],
        },
      ],
    },
  ]

  for (const entry of newBooks) {
    console.log(`\n[${entry.slug}]`)
    if (bookMap.has(entry.slug)) {
      console.log(`  [exists] book already in DB — skipping`)
      skippedDup++
      continue
    }

    const primaryAuthor = entry.authors[0] ?? 'anonymous'
    const authorDisplay = newAuthors.find(a => a.slug === primaryAuthor)?.display_name
      ?? primaryAuthor.replace(/-/g, ' ')
    const { coverUrl, workId } = await fetchCover(entry.title, authorDisplay)
    console.log(`  cover: ${coverUrl ? coverUrl.slice(0, 70) + '…' : 'not found'}`)
    await sleep(250)

    if (!WRITE) { added++; continue }

    const { data: bookRow, error: bookErr } = await supabase.from('books').insert({
      title: entry.title,
      slug: entry.slug,
      original_language: entry.lang,
      first_published_year: entry.year,
      genres: entry.genres,
      description_ban: entry.description_ban,
      cover_url: coverUrl,
      openlibrary_work_id: workId,
      ai_drafted: false,
    }).select('id').single()

    if (bookErr || !bookRow) { console.error(`  ✗ book: ${bookErr?.message}`); continue }
    const bookId = bookRow.id
    bookMap.set(entry.slug, bookId)
    console.log(`  ✓ book id=${bookId}`)

    for (const aSlug of entry.authors) {
      const aId = authorMap.get(aSlug)
      if (!aId) { console.warn(`  [warn] author not found: ${aSlug}`); continue }
      await supabase.from('book_authors').insert({ book_id: bookId, author_id: aId })
    }

    for (const ban of entry.bans) {
      const { data: banRow, error: banErr } = await supabase.from('bans').insert({
        book_id: bookId,
        country_code: 'RU',
        scope_id: ban.scopeId,
        action_type: ban.actionType,
        status: 'active',
        year_started: ban.year,
        description: ban.description,
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
      console.log(`  ✓ ban ${ban.year} ${ban.actionType} (id=${banRow.id})`)
    }
    added++
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== Summary ===')
  console.log(`added              : ${added}`)
  console.log(`skipped (duplicate): ${skippedDup}`)
  console.log(`skipped (missing)  : ${skippedMissing}`)
  if (!WRITE) console.log('\nDRY-RUN — re-run with --write to apply.')
}

main().catch(e => { console.error(e); process.exit(1) })
