import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

async function fetchCover(title: string, author: string): Promise<{ coverUrl: string | null; workId: string | null }> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key,cover_i&limit=1`)
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number }> }
    const doc = json.docs?.[0]
    return {
      coverUrl: doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      workId: doc?.key?.replace('/works/', '') ?? null,
    }
  } catch {
    return { coverUrl: null, workId: null }
  }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const { data: existingBooks } = await supabase.from('books').select('id, slug')
  const { data: existingAuthors } = await supabase.from('authors').select('id, slug')

  const scopeId = (slug: string) => {
    const s = scopes!.find(s => s.slug === slug)
    if (!s) throw new Error(`Scope not found: ${slug}`)
    return s.id
  }
  const reasonId = (slug: string) => {
    const r = reasons!.find(r => r.slug === slug)
    if (!r) throw new Error(`Reason not found: ${slug}`)
    return r.id
  }
  const bookBySlug = (slug: string) => existingBooks!.find(b => b.slug === slug)
  const authorBySlug = (slug: string) => existingAuthors!.find(a => a.slug === slug)

  const school = scopeId('school')
  const gov = scopeId('government')
  const library = scopeId('public_library')

  // ── Countries ──────────────────────────────────────────────────────────────
  await supabase.from('countries').upsert([
    { code: 'ES', name_en: 'Spain', slug: 'spain' },
  ], { onConflict: 'code' })
  console.log('Countries upserted.')

  // ── Authors ────────────────────────────────────────────────────────────────
  const authorRows = [
    { slug: 'erich-maria-remarque', display_name: 'Erich Maria Remarque', birth_year: 1898, death_year: 1970 },
    { slug: 'ernest-hemingway',     display_name: 'Ernest Hemingway',     birth_year: 1899, death_year: 1961 },
    { slug: 'philip-roth',          display_name: 'Philip Roth',          birth_year: 1933, death_year: 2018 },
    { slug: 'malcolm-x',            display_name: 'Malcolm X',            birth_year: 1925, death_year: 1965 },
    { slug: 'alex-haley',           display_name: 'Alex Haley',           birth_year: 1921, death_year: 1992 },
    { slug: 'voltaire',             display_name: 'Voltaire',             birth_year: 1694, death_year: 1778 },
    { slug: 'kate-chopin',          display_name: 'Kate Chopin',          birth_year: 1850, death_year: 1904 },
    { slug: 'f-scott-fitzgerald',   display_name: 'F. Scott Fitzgerald',  birth_year: 1896, death_year: 1940 },
    { slug: 'gunter-grass',         display_name: 'Günter Grass',         birth_year: 1927, death_year: 2015 },
    { slug: 'charles-baudelaire',   display_name: 'Charles Baudelaire',   birth_year: 1821, death_year: 1867 },
  ]

  const authorIds: Record<string, number> = {}

  // Carry over existing authors needed below
  const existingSlug = authorBySlug('richard-wright')
  if (existingSlug) authorIds['richard-wright'] = existingSlug.id

  for (const row of authorRows) {
    const existing = authorBySlug(row.slug)
    if (existing) { authorIds[row.slug] = existing.id; continue }
    const { data, error } = await supabase.from('authors').insert(row).select('id').single()
    if (error) throw error
    authorIds[row.slug] = data.id
  }
  console.log('Authors ready.')

  // ── Books ──────────────────────────────────────────────────────────────────
  type BanData = { cc: string; scope: number; actionType: string; status: string; yearStarted: number; reasons: string[] }
  type NewBook = {
    book: { title: string; slug: string; original_language: string; first_published_year: number; ai_drafted: boolean; genres: string[] }
    authorSlugs: string[]
    bans: BanData[]
    wikiUrl: string
  }

  const newBooks: NewBook[] = [
    {
      book: { title: 'All Quiet on the Western Front', slug: 'all-quiet-on-the-western-front', original_language: 'de', first_published_year: 1929, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['erich-maria-remarque'],
      bans: [{ cc: 'DE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1933, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/All_Quiet_on_the_Western_Front',
    },
    {
      book: { title: 'For Whom the Bell Tolls', slug: 'for-whom-the-bell-tolls', original_language: 'en', first_published_year: 1940, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['ernest-hemingway'],
      bans: [{ cc: 'ES', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1940, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/For_Whom_the_Bell_Tolls',
    },
    {
      book: { title: "Portnoy's Complaint", slug: 'portnoys-complaint', original_language: 'en', first_published_year: 1969, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['philip-roth'],
      bans: [{ cc: 'AU', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1969, reasons: ['sexual'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/Portnoy%27s_Complaint",
    },
    {
      book: { title: 'The Autobiography of Malcolm X', slug: 'the-autobiography-of-malcolm-x', original_language: 'en', first_published_year: 1965, ai_drafted: false, genres: ['memoir', 'non-fiction'] },
      authorSlugs: ['malcolm-x', 'alex-haley'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1994, reasons: ['racial', 'political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Autobiography_of_Malcolm_X',
    },
    {
      book: { title: 'Candide', slug: 'candide', original_language: 'fr', first_published_year: 1759, ai_drafted: false, genres: ['satire', 'literary-fiction'] },
      authorSlugs: ['voltaire'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1929, reasons: ['religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Candide',
    },
    {
      book: { title: 'The Awakening', slug: 'the-awakening', original_language: 'en', first_published_year: 1899, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['kate-chopin'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1988, reasons: ['sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Awakening_(Chopin_novel)',
    },
    {
      book: { title: 'Black Boy', slug: 'black-boy', original_language: 'en', first_published_year: 1945, ai_drafted: false, genres: ['memoir', 'coming-of-age'] },
      authorSlugs: ['richard-wright'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1972, reasons: ['racial', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Black_Boy',
    },
    {
      book: { title: 'The Great Gatsby', slug: 'the-great-gatsby', original_language: 'en', first_published_year: 1925, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['f-scott-fitzgerald'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1987, reasons: ['sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Great_Gatsby',
    },
    {
      book: { title: 'The Tin Drum', slug: 'the-tin-drum', original_language: 'de', first_published_year: 1959, ai_drafted: false, genres: ['literary-fiction', 'satire'] },
      authorSlugs: ['gunter-grass'],
      bans: [{ cc: 'US', scope: library, actionType: 'banned', status: 'historical', yearStarted: 1997, reasons: ['sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Tin_Drum',
    },
    {
      book: { title: 'Les Fleurs du Mal', slug: 'les-fleurs-du-mal', original_language: 'fr', first_published_year: 1857, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['charles-baudelaire'],
      bans: [{ cc: 'FR', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1857, reasons: ['sexual', 'religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Les_Fleurs_du_mal',
    },
  ]

  // ── Insert ─────────────────────────────────────────────────────────────────
  for (const { book: bookData, authorSlugs, bans: banList, wikiUrl } of newBooks) {
    if (bookBySlug(bookData.slug)) {
      console.log(`  [skip] ${bookData.title}`)
      continue
    }

    const firstAuthorName = authorRows.find(a => a.slug === authorSlugs[0])?.display_name ?? ''
    process.stdout.write(`  Fetching cover: ${bookData.title}... `)
    const cover = await fetchCover(bookData.title, firstAuthorName)
    console.log(cover.coverUrl ? 'ok' : 'no cover')
    await sleep(250)

    const { data: newBook, error: be } = await supabase.from('books').insert({
      ...bookData,
      cover_url: cover.coverUrl,
      openlibrary_work_id: cover.workId,
    }).select('id').single()
    if (be) throw be
    const bookId = newBook.id

    for (const slug of authorSlugs) {
      const aId = authorIds[slug]
      if (!aId) throw new Error(`Author ID missing: ${slug}`)
      const { error } = await supabase.from('book_authors').insert({ book_id: bookId, author_id: aId })
      if (error) throw error
    }

    for (const ban of banList) {
      const { data: newBan, error: bane } = await supabase.from('bans').insert({
        book_id: bookId,
        country_code: ban.cc,
        scope_id: ban.scope,
        action_type: ban.actionType,
        status: ban.status,
        year_started: ban.yearStarted,
      }).select('id').single()
      if (bane) throw bane

      for (const rslug of ban.reasons) {
        const { error } = await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: reasonId(rslug) })
        if (error) throw error
      }

      const { data: src, error: se } = await supabase.from('ban_sources').upsert({
        source_name: 'Wikipedia',
        source_url: wikiUrl,
        source_type: 'web',
      }, { onConflict: 'source_url' }).select('id').single()
      if (se) throw se

      const { error: sle } = await supabase.from('ban_source_links').insert({ ban_id: newBan.id, source_id: src.id })
      if (sle) throw sle
    }

    console.log(`  [ok] ${bookData.title}`)
  }

  console.log('\nDone. Run generate-descriptions.ts to fetch descriptions for new books.')
}

main().catch((err) => { console.error(err); process.exit(1) })
