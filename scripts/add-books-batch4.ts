import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()
const COVER_DELAY_MS = 300

interface OLResult { coverUrl: string | null; workId: string | null; publishYear: number | null }

async function fetchOL(title: string, author: string): Promise<OLResult> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key,cover_i,first_publish_year&limit=1`)
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number; first_publish_year?: number }> }
    const doc = json.docs?.[0]
    return {
      coverUrl:    doc?.cover_i            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      workId:      doc?.key?.replace('/works/', '') ?? null,
      publishYear: doc?.first_publish_year ?? null,
    }
  } catch { return { coverUrl: null, workId: null, publishYear: null } }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function upsertSource(name: string, url: string) {
  const { data } = await supabase.from('ban_sources').upsert({ source_name: name, source_url: url, source_type: 'web' }, { onConflict: 'source_url' }).select('id').single()
  return data?.id as number | null
}

async function main() {
  const { data: scopes }   = await supabase.from('scopes').select('id, slug')
  const { data: reasons }  = await supabase.from('reasons').select('id, slug')
  const { data: existing } = await supabase.from('books').select('slug')
  const { data: existingAuthors } = await supabase.from('authors').select('id, slug')

  const existingSlugs = new Set((existing ?? []).map(b => b.slug))
  const authorMap = new Map((existingAuthors ?? []).map(a => [a.slug, a.id as number]))

  const scopeId  = (slug: string) => scopes!.find(s => s.slug === slug)!.id
  const reasonId = (slug: string) => {
    const r = reasons!.find(r => r.slug === slug)
    if (!r) throw new Error(`Reason missing: ${slug}`)
    return r.id
  }

  const govId    = scopeId('government')
  const schoolId = scopeId('school')
  const libId    = scopeId('public_library')

  const wikpSource = await upsertSource('Wikipedia', 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments')
  const alaSource  = await upsertSource('ALA Office for Intellectual Freedom', 'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks')
  const penSource  = await upsertSource('PEN America', 'https://pen.org/book-bans/')

  async function getOrCreateAuthor(displayName: string, slug: string): Promise<number | null> {
    if (authorMap.has(slug)) return authorMap.get(slug)!
    const { data, error } = await supabase.from('authors').insert({ slug, display_name: displayName, birth_year: null, death_year: null }).select('id').single()
    if (error) {
      const { data: ex } = await supabase.from('authors').select('id').eq('slug', slug).single()
      if (ex) { authorMap.set(slug, ex.id); return ex.id }
      return null
    }
    authorMap.set(slug, data.id)
    return data.id
  }

  async function addBook(opts: {
    title: string; slug: string; authorDisplay: string; authorSlug: string
    year: number; genres: string[]
    bans: { country: string; scopeId: number; action?: string; status: string; yearStarted?: number; reasonSlugs: string[]; sourceId: number | null }[]
  }) {
    if (existingSlugs.has(opts.slug)) { console.log(`  [skip] ${opts.title}`); return }

    process.stdout.write(`  ${opts.title} — cover... `)
    const ol = await fetchOL(opts.title, opts.authorDisplay)
    await sleep(COVER_DELAY_MS)
    console.log(ol.coverUrl ? 'ok' : 'no cover')

    const authorId = await getOrCreateAuthor(opts.authorDisplay, opts.authorSlug)

    const { data: book, error: be } = await supabase.from('books').insert({
      title: opts.title, slug: opts.slug, original_language: 'en',
      first_published_year: opts.year, ai_drafted: false, genres: opts.genres,
      cover_url: ol.coverUrl, openlibrary_work_id: ol.workId,
    }).select('id').single()
    if (be) { console.error(`  [error] ${opts.title}: ${be.message}`); return }
    const bookId = book.id
    existingSlugs.add(opts.slug)

    if (authorId) await supabase.from('book_authors').insert({ book_id: bookId, author_id: authorId })

    for (const ban of opts.bans) {
      const { data: newBan, error: bane } = await supabase.from('bans').insert({
        book_id: bookId, country_code: ban.country, scope_id: ban.scopeId,
        action_type: ban.action ?? 'banned', status: ban.status,
        year_started: ban.yearStarted ?? opts.year + 1,
      }).select('id').single()
      if (bane) { console.error(`  [ban error] ${bane.message}`); continue }
      for (const rs of ban.reasonSlugs) {
        await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: reasonId(rs) })
      }
      if (ban.sourceId) await supabase.from('ban_source_links').insert({ ban_id: newBan.id, source_id: ban.sourceId })
    }
    console.log(`  [ok] ${opts.title}`)
  }

  // ── Books ────────────────────────────────────────────────────────────────

  // Nineteen Eighty-Four
  await addBook({
    title: 'Nineteen Eighty-Four', slug: 'nineteen-eighty-four',
    authorDisplay: 'George Orwell', authorSlug: 'george-orwell',
    year: 1949, genres: ['dystopian', 'political-fiction'],
    bans: [
      { country: 'SU', scopeId: govId, status: 'lifted', yearStarted: 1950, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'CN', scopeId: govId, status: 'active', yearStarted: 1985, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'US', scopeId: schoolId, status: 'challenged', yearStarted: 1981, reasonSlugs: ['political'], sourceId: alaSource },
    ],
  })

  // Mein Kampf
  await addBook({
    title: 'Mein Kampf', slug: 'mein-kampf',
    authorDisplay: 'Adolf Hitler', authorSlug: 'adolf-hitler',
    year: 1925, genres: ['non-fiction', 'political-fiction'],
    bans: [
      { country: 'DE', scopeId: govId, status: 'lifted', yearStarted: 1945, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
      { country: 'AT', scopeId: govId, status: 'active', yearStarted: 1945, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
      { country: 'NL', scopeId: govId, status: 'active', yearStarted: 1945, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
      { country: 'RU', scopeId: govId, status: 'active', yearStarted: 2009, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
      { country: 'CZ', scopeId: govId, status: 'active', yearStarted: 1945, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
    ],
  })

  // The Anarchist Cookbook
  await addBook({
    title: 'The Anarchist Cookbook', slug: 'the-anarchist-cookbook',
    authorDisplay: 'William Powell', authorSlug: 'william-powell',
    year: 1971, genres: ['non-fiction'],
    bans: [
      { country: 'AU', scopeId: govId, status: 'active', yearStarted: 1972, reasonSlugs: ['violence'], sourceId: wikpSource },
      { country: 'GB', scopeId: govId, status: 'active', yearStarted: 2007, reasonSlugs: ['violence'], sourceId: wikpSource },
      { country: 'NZ', scopeId: govId, status: 'active', yearStarted: 1972, reasonSlugs: ['violence'], sourceId: wikpSource },
    ],
  })

  // The Turner Diaries
  await addBook({
    title: 'The Turner Diaries', slug: 'the-turner-diaries',
    authorDisplay: 'William Luther Pierce', authorSlug: 'william-luther-pierce',
    year: 1978, genres: ['political-fiction'],
    bans: [
      { country: 'DE', scopeId: govId, status: 'active', yearStarted: 1979, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
      { country: 'CA', scopeId: govId, status: 'active', yearStarted: 1980, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
    ],
  })

  // Das Kapital
  await addBook({
    title: 'Das Kapital', slug: 'das-kapital',
    authorDisplay: 'Karl Marx', authorSlug: 'karl-marx',
    year: 1867, genres: ['non-fiction', 'political-fiction'],
    bans: [
      { country: 'ES', scopeId: govId, status: 'lifted', yearStarted: 1939, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'PT', scopeId: govId, status: 'lifted', yearStarted: 1933, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'KR', scopeId: govId, status: 'lifted', yearStarted: 1948, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // Spycatcher
  await addBook({
    title: 'Spycatcher', slug: 'spycatcher',
    authorDisplay: 'Peter Wright', authorSlug: 'peter-wright',
    year: 1987, genres: ['non-fiction', 'memoir'],
    bans: [
      { country: 'GB', scopeId: govId, status: 'lifted', yearStarted: 1987, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'AU', scopeId: govId, status: 'lifted', yearStarted: 1987, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // The Adventures of Huckleberry Finn
  await addBook({
    title: 'The Adventures of Huckleberry Finn', slug: 'the-adventures-of-huckleberry-finn',
    authorDisplay: 'Mark Twain', authorSlug: 'mark-twain',
    year: 1884, genres: ['literary-fiction', 'coming-of-age'],
    bans: [
      { country: 'US', scopeId: schoolId, status: 'challenged', yearStarted: 1885, reasonSlugs: ['racial', 'language'], sourceId: alaSource },
      { country: 'US', scopeId: libId, status: 'challenged', yearStarted: 1957, reasonSlugs: ['racial', 'language'], sourceId: alaSource },
    ],
  })

  // Giovanni's Room
  await addBook({
    title: "Giovanni's Room", slug: 'giovannis-room',
    authorDisplay: 'James Baldwin', authorSlug: 'james-baldwin',
    year: 1956, genres: ['literary-fiction'],
    bans: [
      { country: 'US', scopeId: schoolId, status: 'challenged', yearStarted: 1960, reasonSlugs: ['lgbtq', 'sexual'], sourceId: alaSource },
      { country: 'ZA', scopeId: govId, status: 'lifted', yearStarted: 1966, reasonSlugs: ['lgbtq', 'sexual'], sourceId: wikpSource },
    ],
  })

  // A Clockwork Orange
  await addBook({
    title: 'A Clockwork Orange', slug: 'a-clockwork-orange',
    authorDisplay: 'Anthony Burgess', authorSlug: 'anthony-burgess',
    year: 1962, genres: ['dystopian', 'literary-fiction'],
    bans: [
      { country: 'AU', scopeId: govId, status: 'lifted', yearStarted: 1973, reasonSlugs: ['violence', 'language'], sourceId: wikpSource },
      { country: 'US', scopeId: schoolId, status: 'challenged', yearStarted: 1976, reasonSlugs: ['violence', 'language'], sourceId: alaSource },
    ],
  })

  // Native Son
  await addBook({
    title: 'Native Son', slug: 'native-son',
    authorDisplay: 'Richard Wright', authorSlug: 'richard-wright',
    year: 1940, genres: ['literary-fiction'],
    bans: [
      { country: 'US', scopeId: schoolId, status: 'challenged', yearStarted: 1972, reasonSlugs: ['racial', 'sexual', 'violence'], sourceId: alaSource },
      { country: 'US', scopeId: libId, status: 'challenged', yearStarted: 1955, reasonSlugs: ['racial'], sourceId: alaSource },
    ],
  })

  // Tropic of Cancer
  await addBook({
    title: 'Tropic of Cancer', slug: 'tropic-of-cancer',
    authorDisplay: 'Henry Miller', authorSlug: 'henry-miller',
    year: 1934, genres: ['literary-fiction'],
    bans: [
      { country: 'US', scopeId: govId, status: 'lifted', yearStarted: 1934, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource },
      { country: 'GB', scopeId: govId, status: 'lifted', yearStarted: 1934, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource },
      { country: 'AU', scopeId: govId, status: 'lifted', yearStarted: 1934, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource },
    ],
  })

  // The Well of Loneliness
  await addBook({
    title: 'The Well of Loneliness', slug: 'the-well-of-loneliness',
    authorDisplay: 'Radclyffe Hall', authorSlug: 'radclyffe-hall',
    year: 1928, genres: ['literary-fiction'],
    bans: [
      { country: 'GB', scopeId: govId, status: 'lifted', yearStarted: 1928, reasonSlugs: ['lgbtq', 'obscenity'], sourceId: wikpSource },
      { country: 'US', scopeId: govId, status: 'lifted', yearStarted: 1929, reasonSlugs: ['lgbtq', 'obscenity'], sourceId: wikpSource },
    ],
  })

  // The God of Small Things
  await addBook({
    title: 'The God of Small Things', slug: 'the-god-of-small-things',
    authorDisplay: 'Arundhati Roy', authorSlug: 'arundhati-roy',
    year: 1997, genres: ['literary-fiction'],
    bans: [
      { country: 'IN', scopeId: govId, status: 'challenged', yearStarted: 1997, reasonSlugs: ['sexual', 'moral'], sourceId: wikpSource },
    ],
  })

  // Son
  await addBook({
    title: 'Son', slug: 'son-lois-lowry',
    authorDisplay: 'Lois Lowry', authorSlug: 'lois-lowry',
    year: 2012, genres: ['dystopian', 'young-adult'],
    bans: [
      { country: 'US', scopeId: schoolId, status: 'challenged', yearStarted: 2013, reasonSlugs: ['violence', 'other'], sourceId: penSource },
    ],
  })

  // Flowers for Algernon
  await addBook({
    title: 'Flowers for Algernon', slug: 'flowers-for-algernon',
    authorDisplay: 'Daniel Keyes', authorSlug: 'daniel-keyes',
    year: 1966, genres: ['literary-fiction', 'coming-of-age'],
    bans: [
      { country: 'US', scopeId: schoolId, status: 'challenged', yearStarted: 1981, reasonSlugs: ['sexual', 'language'], sourceId: alaSource },
    ],
  })

  // Of Mice and Men
  await addBook({
    title: 'Of Mice and Men', slug: 'of-mice-and-men',
    authorDisplay: 'John Steinbeck', authorSlug: 'john-steinbeck',
    year: 1937, genres: ['literary-fiction'],
    bans: [
      { country: 'US', scopeId: schoolId, status: 'challenged', yearStarted: 1974, reasonSlugs: ['language', 'racial'], sourceId: alaSource },
    ],
  })

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
