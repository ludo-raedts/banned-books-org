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

async function enrich() {
  // ── Reference data ───────────────────────────────────────────
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')

  const scopeId = (slug: string) => {
    const s = scopes!.find(s => s.slug === slug)
    if (!s) throw new Error(`Scope not found: ${slug}. Available: ${scopes!.map(s => s.slug).join(', ')}`)
    return s.id
  }
  const reasonId = (slug: string) => {
    const r = reasons!.find(r => r.slug === slug)
    if (!r) throw new Error(`Reason not found: ${slug}. Available: ${reasons!.map(r => r.slug).join(', ')}`)
    return r.id
  }

  const schoolScope = scopeId('school')
  const govScope = scopeId('government')

  // ── Existing data ────────────────────────────────────────────
  const { data: existingBooks } = await supabase.from('books').select('id, slug')
  const { data: existingAuthors } = await supabase.from('authors').select('id, slug')
  const { data: existingBans } = await supabase.from('bans').select('id, book_id, country_code')

  const bookBySlug = (slug: string) => existingBooks!.find(b => b.slug === slug)
  const authorBySlug = (slug: string) => existingAuthors!.find(a => a.slug === slug)
  const banFor = (bookId: number, cc: string) =>
    existingBans!.find(b => b.book_id === bookId && b.country_code === cc)

  // ── New countries ────────────────────────────────────────────
  await supabase.from('countries').upsert([
    { code: 'SU', name_en: 'Soviet Union', slug: 'soviet-union' },
    { code: 'LB', name_en: 'Lebanon',      slug: 'lebanon' },
    { code: 'IE', name_en: 'Ireland',      slug: 'ireland' },
  ], { onConflict: 'code' })
  console.log('Countries upserted.')

  // ── New authors ──────────────────────────────────────────────
  const authorRows = [
    { slug: 'justin-richardson', display_name: 'Justin Richardson' },
    { slug: 'peter-parnell',     display_name: 'Peter Parnell' },
    { slug: 'margaret-atwood',   display_name: 'Margaret Atwood',  birth_year: 1939 },
    { slug: 'dh-lawrence',       display_name: 'D.H. Lawrence',    birth_year: 1885, death_year: 1930 },
    { slug: 'dan-brown',         display_name: 'Dan Brown',         birth_year: 1964 },
    { slug: 'aldous-huxley',     display_name: 'Aldous Huxley',    birth_year: 1894, death_year: 1963 },
    { slug: 'harper-lee',        display_name: 'Harper Lee',        birth_year: 1926, death_year: 2016 },
  ]

  const authorIds: Record<string, number> = {}

  // Carry over George Orwell (already in DB, needed for Animal Farm)
  const orwell = authorBySlug('george-orwell')
  if (!orwell) throw new Error('George Orwell not found in DB')
  authorIds['george-orwell'] = orwell.id

  for (const row of authorRows) {
    const existing = authorBySlug(row.slug)
    if (existing) {
      authorIds[row.slug] = existing.id
      continue
    }
    const { data, error } = await supabase.from('authors').insert(row).select('id').single()
    if (error) throw error
    authorIds[row.slug] = data.id
  }
  console.log('Authors ready.')

  // ── Open Library covers ──────────────────────────────────────
  console.log('Fetching Open Library covers...')
  const covers: Record<string, { coverUrl: string | null; workId: string | null }> = {}

  const toFetch: Array<{ slug: string; title: string; author: string }> = [
    { slug: '1984',                    title: '1984',                    author: 'George Orwell' },
    { slug: 'the-bluest-eye',          title: 'The Bluest Eye',          author: 'Toni Morrison' },
    { slug: 'the-satanic-verses',      title: 'The Satanic Verses',      author: 'Salman Rushdie' },
    { slug: 'and-tango-makes-three',   title: 'And Tango Makes Three',   author: 'Justin Richardson' },
    { slug: 'animal-farm',             title: 'Animal Farm',             author: 'George Orwell' },
    { slug: 'the-handmaids-tale',      title: 'The Handmaids Tale',      author: 'Margaret Atwood' },
    { slug: 'lady-chatterleys-lover',  title: 'Lady Chatterleys Lover',  author: 'DH Lawrence' },
    { slug: 'the-da-vinci-code',       title: 'The Da Vinci Code',       author: 'Dan Brown' },
    { slug: 'brave-new-world',         title: 'Brave New World',         author: 'Aldous Huxley' },
    { slug: 'to-kill-a-mockingbird',   title: 'To Kill a Mockingbird',   author: 'Harper Lee' },
  ]

  for (const { slug, title, author } of toFetch) {
    covers[slug] = await fetchCover(title, author)
    console.log(`  ${title}: ${covers[slug].coverUrl ?? 'no cover'}`)
  }

  // ── Enrich existing books with covers ────────────────────────
  for (const slug of ['1984', 'the-bluest-eye', 'the-satanic-verses']) {
    const book = bookBySlug(slug)
    if (!book) continue
    const { error } = await supabase.from('books').update({
      cover_url: covers[slug].coverUrl,
      openlibrary_work_id: covers[slug].workId,
    }).eq('id', book.id)
    if (error) throw error
  }
  console.log('Existing books enriched with covers.')

  // ── Enrich existing bans: fix GB→US on Bluest Eye, add year + reasons ──
  const existingBanPatches: Array<{
    bookSlug: string; oldCc: string; newCc?: string
    yearStarted: number; reasons: string[]
  }> = [
    { bookSlug: '1984',               oldCc: 'US',             yearStarted: 1981, reasons: ['political'] },
    { bookSlug: 'the-bluest-eye',     oldCc: 'GB', newCc: 'US', yearStarted: 2006, reasons: ['sexual', 'racial'] },
    { bookSlug: 'the-satanic-verses', oldCc: 'IR',             yearStarted: 1988, reasons: ['religious'] },
  ]

  for (const { bookSlug, oldCc, newCc, yearStarted, reasons: rslugs } of existingBanPatches) {
    const book = bookBySlug(bookSlug)
    if (!book) continue
    const ban = banFor(book.id, oldCc)
    if (!ban) { console.warn(`Ban not found: ${bookSlug}/${oldCc}`); continue }

    await supabase.from('bans').update({
      year_started: yearStarted,
      ...(newCc ? { country_code: newCc } : {}),
    }).eq('id', ban.id)

    for (const slug of rslugs) {
      await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId(slug) })
    }
  }
  console.log('Existing bans patched.')

  // ── New books ────────────────────────────────────────────────
  type NewBook = {
    book: { title: string; slug: string; original_language: string; first_published_year: number; ai_drafted: boolean }
    authorSlugs: string[]
    bans: Array<{ cc: string; scope: number; actionType: string; status: string; yearStarted: number; reasons: string[] }>
    wikiUrl: string
  }

  const newBooks: NewBook[] = [
    {
      book: { title: 'And Tango Makes Three', slug: 'and-tango-makes-three', original_language: 'en', first_published_year: 2005, ai_drafted: false },
      authorSlugs: ['justin-richardson', 'peter-parnell'],
      bans: [{ cc: 'US', scope: schoolScope, actionType: 'banned', status: 'active', yearStarted: 2006, reasons: ['lgbtq'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/And_Tango_Makes_Three',
    },
    {
      book: { title: 'Animal Farm', slug: 'animal-farm', original_language: 'en', first_published_year: 1945, ai_drafted: false },
      authorSlugs: ['george-orwell'],
      bans: [{ cc: 'SU', scope: govScope, actionType: 'banned', status: 'historical', yearStarted: 1945, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Animal_Farm',
    },
    {
      book: { title: "The Handmaid's Tale", slug: 'the-handmaids-tale', original_language: 'en', first_published_year: 1985, ai_drafted: false },
      authorSlugs: ['margaret-atwood'],
      bans: [{ cc: 'US', scope: schoolScope, actionType: 'banned', status: 'active', yearStarted: 2021, reasons: ['sexual', 'political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Handmaid%27s_Tale',
    },
    {
      book: { title: "Lady Chatterley's Lover", slug: 'lady-chatterleys-lover', original_language: 'en', first_published_year: 1928, ai_drafted: false },
      authorSlugs: ['dh-lawrence'],
      bans: [{ cc: 'GB', scope: govScope, actionType: 'banned', status: 'historical', yearStarted: 1928, reasons: ['sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Lady_Chatterley%27s_Lover',
    },
    {
      book: { title: 'The Da Vinci Code', slug: 'the-da-vinci-code', original_language: 'en', first_published_year: 2003, ai_drafted: false },
      authorSlugs: ['dan-brown'],
      bans: [{ cc: 'LB', scope: govScope, actionType: 'banned', status: 'active', yearStarted: 2004, reasons: ['religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Da_Vinci_Code',
    },
    {
      book: { title: 'Brave New World', slug: 'brave-new-world', original_language: 'en', first_published_year: 1932, ai_drafted: false },
      authorSlugs: ['aldous-huxley'],
      bans: [{ cc: 'IE', scope: govScope, actionType: 'banned', status: 'historical', yearStarted: 1932, reasons: ['sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Brave_New_World',
    },
    {
      book: { title: 'To Kill a Mockingbird', slug: 'to-kill-a-mockingbird', original_language: 'en', first_published_year: 1960, ai_drafted: false },
      authorSlugs: ['harper-lee'],
      bans: [{ cc: 'US', scope: schoolScope, actionType: 'banned', status: 'active', yearStarted: 1977, reasons: ['racial', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/To_Kill_a_Mockingbird',
    },
  ]

  for (const { book: bookData, authorSlugs, bans: banList, wikiUrl } of newBooks) {
    if (bookBySlug(bookData.slug)) {
      console.log(`Already exists, skipping: ${bookData.title}`)
      continue
    }

    const cover = covers[bookData.slug] ?? { coverUrl: null, workId: null }

    const { data: newBook, error: be } = await supabase.from('books').insert({
      ...bookData,
      cover_url: cover.coverUrl,
      openlibrary_work_id: cover.workId,
    }).select('id').single()
    if (be) throw be

    for (const slug of authorSlugs) {
      const aId = authorIds[slug]
      if (!aId) throw new Error(`Author ID missing: ${slug}`)
      const { error } = await supabase.from('book_authors').insert({ book_id: newBook.id, author_id: aId })
      if (error) throw error
    }

    for (const ban of banList) {
      const { data: newBan, error: bane } = await supabase.from('bans').insert({
        book_id: newBook.id,
        country_code: ban.cc,
        scope_id: ban.scope,
        action_type: ban.actionType,
        status: ban.status,
        year_started: ban.yearStarted,
      }).select('id').single()
      if (bane) throw bane

      for (const rslug of ban.reasons) {
        const { error } = await supabase.from('ban_reason_links').insert({
          ban_id: newBan.id,
          reason_id: reasonId(rslug),
        })
        if (error) throw error
      }

      const { data: src, error: se } = await supabase.from('ban_sources').insert({
        source_name: 'Wikipedia',
        source_url: wikiUrl,
        source_type: 'web',
      }).select('id').single()
      if (se) throw se

      const { error: sle } = await supabase.from('ban_source_links').insert({
        ban_id: newBan.id,
        source_id: src.id,
      })
      if (sle) throw sle
    }

    console.log(`Inserted: ${bookData.title}`)
  }

  console.log('\nEnrichment complete.')
}

enrich().catch((err) => { console.error(err); process.exit(1) })
