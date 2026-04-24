import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()
const BATCH_DELAY_MS = 2000
const COVER_DELAY_MS = 250

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

  const existingBookSlugs = new Set((existingBooks ?? []).map(b => b.slug))
  const authorMap = new Map((existingAuthors ?? []).map(a => [a.slug, a.id as number]))

  const school = scopeId('school')
  const gov = scopeId('government')

  // ── Countries ──────────────────────────────────────────────────────────────
  await supabase.from('countries').upsert([
    { code: 'GT', name_en: 'Guatemala',  slug: 'guatemala' },
    { code: 'LB', name_en: 'Lebanon',    slug: 'lebanon' },
    { code: 'AL', name_en: 'Albania',    slug: 'albania' },
    { code: 'MA', name_en: 'Morocco',    slug: 'morocco' },
    { code: 'ER', name_en: 'Eritrea',    slug: 'eritrea' },
  ], { onConflict: 'code' })
  console.log('Countries upserted.')

  // ── Authors ────────────────────────────────────────────────────────────────
  const authorRows = [
    { slug: 'stephen-chbosky',          display_name: 'Stephen Chbosky',          birth_year: 1970, death_year: null },
    { slug: 'maia-kobabe',              display_name: 'Maia Kobabe',              birth_year: 1988, death_year: null },
    { slug: 'john-green',               display_name: 'John Green',               birth_year: 1977, death_year: null },
    { slug: 'jay-asher',                display_name: 'Jay Asher',                birth_year: 1975, death_year: null },
    { slug: 'art-spiegelman',           display_name: 'Art Spiegelman',           birth_year: 1948, death_year: null },
    { slug: 'george-m-johnson',         display_name: 'George M. Johnson',        birth_year: 1990, death_year: null },
    { slug: 'angie-thomas',             display_name: 'Angie Thomas',             birth_year: 1988, death_year: null },
    { slug: 'maya-angelou',             display_name: 'Maya Angelou',             birth_year: 1928, death_year: 2014 },
    { slug: 'philip-pullman',           display_name: 'Philip Pullman',           birth_year: 1946, death_year: null },
    { slug: 'dav-pilkey',               display_name: 'Dav Pilkey',               birth_year: 1966, death_year: null },
    { slug: 'marjane-satrapi',          display_name: 'Marjane Satrapi',          birth_year: 1969, death_year: null },
    { slug: 'rainbow-rowell',           display_name: 'Rainbow Rowell',           birth_year: 1973, death_year: null },
    { slug: 'zora-neale-hurston',       display_name: 'Zora Neale Hurston',       birth_year: 1891, death_year: 1960 },
    { slug: 'ralph-ellison',            display_name: 'Ralph Ellison',            birth_year: 1913, death_year: 1994 },
    { slug: 'tim-obrien',               display_name: 'Tim O\'Brien',             birth_year: 1946, death_year: null },
    { slug: 'chuck-palahniuk',          display_name: 'Chuck Palahniuk',          birth_year: 1962, death_year: null },
    { slug: 'alison-bechdel',           display_name: 'Alison Bechdel',           birth_year: 1960, death_year: null },
    { slug: 'orson-scott-card',         display_name: 'Orson Scott Card',         birth_year: 1951, death_year: null },
    { slug: 'patricia-mccormick',       display_name: 'Patricia McCormick',       birth_year: 1956, death_year: null },
    { slug: 'ellen-hopkins',            display_name: 'Ellen Hopkins',            birth_year: 1955, death_year: null },
    { slug: 'sarah-j-maas',             display_name: 'Sarah J. Maas',            birth_year: 1986, death_year: null },
    { slug: 'jodi-picoult',             display_name: 'Jodi Picoult',             birth_year: 1966, death_year: null },
    { slug: 'ibram-x-kendi',            display_name: 'Ibram X. Kendi',           birth_year: 1982, death_year: null },
    { slug: 'jason-reynolds',           display_name: 'Jason Reynolds',           birth_year: 1983, death_year: null },
    { slug: 'jung-chang',               display_name: 'Jung Chang',               birth_year: 1952, death_year: null },
    { slug: 'gao-xingjian',             display_name: 'Gao Xingjian',             birth_year: 1940, death_year: null },
    { slug: 'yang-jisheng',             display_name: 'Yang Jisheng',             birth_year: 1940, death_year: 2022 },
    { slug: 'nien-cheng',               display_name: 'Nien Cheng',               birth_year: 1915, death_year: 2009 },
    { slug: 'lewis-carroll',            display_name: 'Lewis Carroll',            birth_year: 1832, death_year: 1898 },
    { slug: 'munro-leaf',               display_name: 'Munro Leaf',               birth_year: 1905, death_year: 1976 },
    { slug: 'aristophanes',             display_name: 'Aristophanes',             birth_year: -446, death_year: -386 },
    { slug: 'miguel-angel-asturias',    display_name: 'Miguel Ángel Asturias',    birth_year: 1899, death_year: 1974 },
    { slug: 'edna-obrien',              display_name: 'Edna O\'Brien',            birth_year: 1930, death_year: 2024 },
    { slug: 'brendan-behan',            display_name: 'Brendan Behan',            birth_year: 1923, death_year: 1964 },
    { slug: 'john-mcgahern',            display_name: 'John McGahern',            birth_year: 1934, death_year: 2006 },
    { slug: 'bertrand-russell',         display_name: 'Bertrand Russell',         birth_year: 1872, death_year: 1970 },
    { slug: 'norman-mailer',            display_name: 'Norman Mailer',            birth_year: 1923, death_year: 2007 },
    { slug: 'william-styron',           display_name: 'William Styron',           birth_year: 1925, death_year: 2006 },
    { slug: 'mark-mathabane',           display_name: 'Mark Mathabane',           birth_year: 1960, death_year: null },
    { slug: 'ariel-dorfman',            display_name: 'Ariel Dorfman',            birth_year: 1942, death_year: null },
    { slug: 'haidar-haidar',            display_name: 'Haidar Haidar',            birth_year: 1936, death_year: null },
    { slug: 'ismail-kadare',            display_name: 'Ismail Kadare',            birth_year: 1936, death_year: 2024 },
    { slug: 'dan-brown',                display_name: 'Dan Brown',                birth_year: 1964, death_year: null },
    { slug: 'stefan-zweig',             display_name: 'Stefan Zweig',             birth_year: 1881, death_year: 1942 },
    { slug: 'bertolt-brecht',           display_name: 'Bertolt Brecht',           birth_year: 1898, death_year: 1956 },
    { slug: 'jack-london',              display_name: 'Jack London',              birth_year: 1876, death_year: 1916 },
    { slug: 'h-g-wells',                display_name: 'H. G. Wells',              birth_year: 1866, death_year: 1946 },
    { slug: 'alvin-schwartz',           display_name: 'Alvin Schwartz',           birth_year: 1927, death_year: 1992 },
    { slug: 'jeanette-walls',           display_name: 'Jeannette Walls',          birth_year: 1960, death_year: null },
    { slug: 'barbara-ehrenreich',       display_name: 'Barbara Ehrenreich',       birth_year: 1941, death_year: 2022 },
    { slug: 'beatrice-sparks',          display_name: 'Beatrice Sparks',          birth_year: 1917, death_year: 2012 },
  ]

  for (const row of authorRows) {
    if (authorMap.has(row.slug)) continue
    const { data, error } = await supabase.from('authors').insert({
      slug: row.slug,
      display_name: row.display_name,
      birth_year: row.birth_year,
      death_year: row.death_year,
    }).select('id').single()
    if (error) {
      console.warn(`  [author error] ${row.slug}: ${error.message}`)
      continue
    }
    authorMap.set(row.slug, data.id)
  }
  console.log('Authors ready.')

  type BanData = { cc: string; scope: number; actionType: string; status: string; yearStarted: number; reasons: string[] }
  type NewBook = {
    book: { title: string; slug: string; original_language: string; first_published_year: number; ai_drafted: boolean; genres: string[] }
    authorSlugs: string[]
    bans: BanData[]
    wikiUrl: string
  }

  const books: NewBook[] = [
    // ── ALA Top Challenged – US School Bans ───────────────────────────────────
    {
      book: { title: 'The Perks of Being a Wallflower', slug: 'the-perks-of-being-a-wallflower', original_language: 'en', first_published_year: 1999, ai_drafted: false, genres: ['young-adult', 'coming-of-age'] },
      authorSlugs: ['stephen-chbosky'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2001, reasons: ['sexual', 'language', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Perks_of_Being_a_Wallflower',
    },
    {
      book: { title: 'Gender Queer: A Memoir', slug: 'gender-queer', original_language: 'en', first_published_year: 2019, ai_drafted: false, genres: ['memoir', 'graphic-novel'] },
      authorSlugs: ['maia-kobabe'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2021, reasons: ['sexual', 'lgbtq'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Gender_Queer',
    },
    {
      book: { title: 'Looking for Alaska', slug: 'looking-for-alaska', original_language: 'en', first_published_year: 2005, ai_drafted: false, genres: ['young-adult', 'coming-of-age'] },
      authorSlugs: ['john-green'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2012, reasons: ['sexual', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Looking_for_Alaska',
    },
    {
      book: { title: 'Thirteen Reasons Why', slug: 'thirteen-reasons-why', original_language: 'en', first_published_year: 2007, ai_drafted: false, genres: ['young-adult'] },
      authorSlugs: ['jay-asher'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2012, reasons: ['violence', 'sexual', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Thirteen_Reasons_Why',
    },
    {
      book: { title: 'Maus', slug: 'maus', original_language: 'en', first_published_year: 1991, ai_drafted: false, genres: ['graphic-novel', 'memoir', 'historical-fiction'] },
      authorSlugs: ['art-spiegelman'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2022, reasons: ['language', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Maus',
    },
    {
      book: { title: 'All Boys Aren\'t Blue', slug: 'all-boys-arent-blue', original_language: 'en', first_published_year: 2020, ai_drafted: false, genres: ['memoir', 'young-adult'] },
      authorSlugs: ['george-m-johnson'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2021, reasons: ['sexual', 'lgbtq'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/All_Boys_Aren%27t_Blue",
    },
    {
      book: { title: 'The Hate U Give', slug: 'the-hate-u-give', original_language: 'en', first_published_year: 2017, ai_drafted: false, genres: ['young-adult', 'political-fiction'] },
      authorSlugs: ['angie-thomas'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2017, reasons: ['political', 'language', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Hate_U_Give',
    },
    {
      book: { title: 'I Know Why the Caged Bird Sings', slug: 'i-know-why-the-caged-bird-sings', original_language: 'en', first_published_year: 1969, ai_drafted: false, genres: ['memoir', 'coming-of-age'] },
      authorSlugs: ['maya-angelou'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1983, reasons: ['sexual', 'racial', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/I_Know_Why_the_Caged_Bird_Sings',
    },
    {
      book: { title: 'The Golden Compass', slug: 'the-golden-compass', original_language: 'en', first_published_year: 1995, ai_drafted: false, genres: ['fantasy', 'young-adult'] },
      authorSlugs: ['philip-pullman'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 2001, reasons: ['religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Northern_Lights_(novel)',
    },
    {
      book: { title: 'Captain Underpants', slug: 'captain-underpants', original_language: 'en', first_published_year: 1997, ai_drafted: false, genres: ['children'] },
      authorSlugs: ['dav-pilkey'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 2000, reasons: ['language', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Captain_Underpants',
    },
    {
      book: { title: 'Persepolis', slug: 'persepolis', original_language: 'fr', first_published_year: 2000, ai_drafted: false, genres: ['memoir', 'graphic-novel', 'historical-fiction'] },
      authorSlugs: ['marjane-satrapi'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2013, reasons: ['political', 'violence', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Persepolis_(comics)',
    },
    {
      book: { title: 'Eleanor & Park', slug: 'eleanor-and-park', original_language: 'en', first_published_year: 2013, ai_drafted: false, genres: ['young-adult', 'romance'] },
      authorSlugs: ['rainbow-rowell'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 2013, reasons: ['language', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Eleanor_%26_Park',
    },
    {
      book: { title: 'Their Eyes Were Watching God', slug: 'their-eyes-were-watching-god', original_language: 'en', first_published_year: 1937, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['zora-neale-hurston'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1997, reasons: ['sexual', 'language', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Their_Eyes_Were_Watching_God',
    },
    {
      book: { title: 'Invisible Man', slug: 'invisible-man', original_language: 'en', first_published_year: 1952, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['ralph-ellison'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1975, reasons: ['language', 'racial', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Invisible_Man',
    },
    {
      book: { title: 'The Things They Carried', slug: 'the-things-they-carried', original_language: 'en', first_published_year: 1990, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['tim-obrien'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 1994, reasons: ['language', 'violence', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Things_They_Carried',
    },
    {
      book: { title: 'Fight Club', slug: 'fight-club', original_language: 'en', first_published_year: 1996, ai_drafted: false, genres: ['literary-fiction', 'thriller'] },
      authorSlugs: ['chuck-palahniuk'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 1999, reasons: ['violence', 'language', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Fight_Club',
    },
    {
      book: { title: 'Fun Home', slug: 'fun-home', original_language: 'en', first_published_year: 2006, ai_drafted: false, genres: ['memoir', 'graphic-novel'] },
      authorSlugs: ['alison-bechdel'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 2014, reasons: ['sexual', 'lgbtq'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Fun_Home',
    },
    {
      book: { title: "Ender's Game", slug: 'enders-game', original_language: 'en', first_published_year: 1985, ai_drafted: false, genres: ['science-fiction', 'young-adult'] },
      authorSlugs: ['orson-scott-card'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1999, reasons: ['language', 'violence', 'sexual'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/Ender%27s_Game",
    },
    {
      book: { title: 'Sold', slug: 'sold-patricia-mccormick', original_language: 'en', first_published_year: 2006, ai_drafted: false, genres: ['young-adult'] },
      authorSlugs: ['patricia-mccormick'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2012, reasons: ['sexual', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Sold_(McCormick_novel)',
    },
    {
      book: { title: 'Crank', slug: 'crank', original_language: 'en', first_published_year: 2004, ai_drafted: false, genres: ['young-adult'] },
      authorSlugs: ['ellen-hopkins'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2006, reasons: ['sexual', 'language', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Crank_(novel)',
    },
    {
      book: { title: 'A Court of Thorns and Roses', slug: 'a-court-of-thorns-and-roses', original_language: 'en', first_published_year: 2015, ai_drafted: false, genres: ['fantasy', 'romance'] },
      authorSlugs: ['sarah-j-maas'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2022, reasons: ['sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/A_Court_of_Thorns_and_Roses',
    },
    {
      book: { title: 'Nineteen Minutes', slug: 'nineteen-minutes', original_language: 'en', first_published_year: 2007, ai_drafted: false, genres: ['thriller', 'literary-fiction'] },
      authorSlugs: ['jodi-picoult'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 2012, reasons: ['sexual', 'violence', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Nineteen_Minutes',
    },
    {
      book: { title: 'Stamped: Racism, Antiracism, and You', slug: 'stamped-racism-antiracism-and-you', original_language: 'en', first_published_year: 2020, ai_drafted: false, genres: ['non-fiction', 'young-adult'] },
      authorSlugs: ['ibram-x-kendi', 'jason-reynolds'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2020, reasons: ['political', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Stamped:_Racism,_Antiracism,_and_You',
    },
    {
      book: { title: 'Go Ask Alice', slug: 'go-ask-alice', original_language: 'en', first_published_year: 1971, ai_drafted: false, genres: ['young-adult', 'memoir'] },
      authorSlugs: ['beatrice-sparks'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1971, reasons: ['sexual', 'language', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Go_Ask_Alice',
    },
    {
      book: { title: 'Scary Stories to Tell in the Dark', slug: 'scary-stories-to-tell-in-the-dark', original_language: 'en', first_published_year: 1981, ai_drafted: false, genres: ['children', 'horror'] },
      authorSlugs: ['alvin-schwartz'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 1990, reasons: ['violence', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Scary_Stories_to_Tell_in_the_Dark',
    },
    {
      book: { title: 'The Glass Castle', slug: 'the-glass-castle', original_language: 'en', first_published_year: 2005, ai_drafted: false, genres: ['memoir'] },
      authorSlugs: ['jeanette-walls'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 2012, reasons: ['sexual', 'violence', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Glass_Castle',
    },
    {
      book: { title: 'Nickel and Dimed', slug: 'nickel-and-dimed', original_language: 'en', first_published_year: 2001, ai_drafted: false, genres: ['non-fiction'] },
      authorSlugs: ['barbara-ehrenreich'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 2010, reasons: ['political', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Nickel_and_Dimed',
    },
    {
      book: { title: 'The Sun Also Rises', slug: 'the-sun-also-rises', original_language: 'en', first_published_year: 1926, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['ernest-hemingway'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1960, reasons: ['sexual', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Sun_Also_Rises',
    },
    {
      book: { title: 'A Farewell to Arms', slug: 'a-farewell-to-arms', original_language: 'en', first_published_year: 1929, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['ernest-hemingway'],
      bans: [{ cc: 'IE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1929, reasons: ['sexual', 'moral'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/A_Farewell_to_Arms',
    },
    {
      book: { title: 'Kaffir Boy', slug: 'kaffir-boy', original_language: 'en', first_published_year: 1986, ai_drafted: false, genres: ['memoir', 'coming-of-age'] },
      authorSlugs: ['mark-mathabane'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1995, reasons: ['language', 'racial', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Kaffir_Boy',
    },
    {
      book: { title: 'The Naked and the Dead', slug: 'the-naked-and-the-dead', original_language: 'en', first_published_year: 1948, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['norman-mailer'],
      bans: [{ cc: 'CA', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1949, reasons: ['sexual', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Naked_and_the_Dead',
    },
    {
      book: { title: "Sophie's Choice", slug: 'sophies-choice', original_language: 'en', first_published_year: 1979, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['william-styron'],
      bans: [{ cc: 'LB', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1979, reasons: ['political'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/Sophie%27s_Choice",
    },
    // ── International Government Bans ─────────────────────────────────────────
    {
      book: { title: 'Wild Swans', slug: 'wild-swans', original_language: 'en', first_published_year: 1991, ai_drafted: false, genres: ['memoir', 'historical-fiction'] },
      authorSlugs: ['jung-chang'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'active', yearStarted: 1991, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Wild_Swans',
    },
    {
      book: { title: 'Soul Mountain', slug: 'soul-mountain', original_language: 'zh', first_published_year: 1990, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['gao-xingjian'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'active', yearStarted: 1989, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Soul_Mountain',
    },
    {
      book: { title: 'Tombstone', slug: 'tombstone-yang-jisheng', original_language: 'zh', first_published_year: 2008, ai_drafted: false, genres: ['non-fiction', 'historical-fiction'] },
      authorSlugs: ['yang-jisheng'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'active', yearStarted: 2008, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Tombstone_(book)',
    },
    {
      book: { title: "Life and Death in Shanghai", slug: 'life-and-death-in-shanghai', original_language: 'en', first_published_year: 1987, ai_drafted: false, genres: ['memoir', 'historical-fiction'] },
      authorSlugs: ['nien-cheng'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'active', yearStarted: 1987, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Life_and_Death_in_Shanghai',
    },
    {
      book: { title: "Alice's Adventures in Wonderland", slug: 'alices-adventures-in-wonderland', original_language: 'en', first_published_year: 1865, ai_drafted: false, genres: ['children', 'fantasy'] },
      authorSlugs: ['lewis-carroll'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1931, reasons: ['other'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/Alice%27s_Adventures_in_Wonderland",
    },
    {
      book: { title: 'The Communist Manifesto', slug: 'the-communist-manifesto', original_language: 'de', first_published_year: 1848, ai_drafted: false, genres: ['non-fiction', 'political-fiction'] },
      authorSlugs: ['karl-marx', 'friedrich-engels'],
      bans: [{ cc: 'DE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1933, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Communist_Manifesto',
    },
    {
      book: { title: 'The Story of Ferdinand', slug: 'the-story-of-ferdinand', original_language: 'en', first_published_year: 1936, ai_drafted: false, genres: ['children'] },
      authorSlugs: ['munro-leaf'],
      bans: [{ cc: 'DE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1936, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Story_of_Ferdinand',
    },
    {
      book: { title: 'Lysistrata', slug: 'lysistrata', original_language: 'el', first_published_year: -411, ai_drafted: false, genres: ['literary-fiction', 'satire'] },
      authorSlugs: ['aristophanes'],
      bans: [{ cc: 'GR', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1967, reasons: ['political', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Lysistrata',
    },
    {
      book: { title: 'El Señor Presidente', slug: 'el-senor-presidente', original_language: 'es', first_published_year: 1946, ai_drafted: false, genres: ['literary-fiction', 'political-fiction'] },
      authorSlugs: ['miguel-angel-asturias'],
      bans: [{ cc: 'GT', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1946, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/El_Se%C3%B1or_Presidente',
    },
    {
      book: { title: 'The Country Girls', slug: 'the-country-girls', original_language: 'en', first_published_year: 1960, ai_drafted: false, genres: ['literary-fiction', 'coming-of-age'] },
      authorSlugs: ['edna-obrien'],
      bans: [{ cc: 'IE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1960, reasons: ['sexual', 'moral'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Country_Girls',
    },
    {
      book: { title: 'Borstal Boy', slug: 'borstal-boy', original_language: 'en', first_published_year: 1958, ai_drafted: false, genres: ['memoir', 'coming-of-age'] },
      authorSlugs: ['brendan-behan'],
      bans: [{ cc: 'IE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1958, reasons: ['political', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Borstal_Boy',
    },
    {
      book: { title: 'The Dark', slug: 'the-dark-mcgahern', original_language: 'en', first_published_year: 1965, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['john-mcgahern'],
      bans: [{ cc: 'IE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1965, reasons: ['sexual', 'moral'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Dark_(novel)',
    },
    {
      book: { title: 'Marriage and Morals', slug: 'marriage-and-morals', original_language: 'en', first_published_year: 1929, ai_drafted: false, genres: ['non-fiction'] },
      authorSlugs: ['bertrand-russell'],
      bans: [{ cc: 'IE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1931, reasons: ['sexual', 'moral'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Marriage_and_Morals',
    },
    {
      book: { title: 'How to Read Donald Duck', slug: 'how-to-read-donald-duck', original_language: 'es', first_published_year: 1971, ai_drafted: false, genres: ['non-fiction', 'political-fiction'] },
      authorSlugs: ['ariel-dorfman'],
      bans: [{ cc: 'CL', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1973, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/How_to_Read_Donald_Duck',
    },
    {
      book: { title: 'A Feast for the Seaweeds', slug: 'a-feast-for-the-seaweeds', original_language: 'ar', first_published_year: 1983, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['haidar-haidar'],
      bans: [{ cc: 'EG', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 2000, reasons: ['religious', 'blasphemy'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/A_Feast_for_Seaweed',
    },
    {
      book: { title: 'The Da Vinci Code', slug: 'the-da-vinci-code', original_language: 'en', first_published_year: 2003, ai_drafted: false, genres: ['thriller'] },
      authorSlugs: ['dan-brown'],
      bans: [{ cc: 'LB', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 2004, reasons: ['religious', 'blasphemy'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Da_Vinci_Code',
    },
    {
      book: { title: 'The Iron Heel', slug: 'the-iron-heel', original_language: 'en', first_published_year: 1908, ai_drafted: false, genres: ['political-fiction', 'dystopian', 'science-fiction'] },
      authorSlugs: ['jack-london'],
      bans: [{ cc: 'DE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1933, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Iron_Heel',
    },
  ]

  // ── Deduplicate against DB and within batch ────────────────────────────────
  const seenInBatch = new Set<string>()
  const deduped: NewBook[] = []
  for (const entry of books) {
    if (seenInBatch.has(entry.book.slug)) { console.warn(`  [dedup] ${entry.book.slug}`); continue }
    seenInBatch.add(entry.book.slug)
    deduped.push(entry)
  }

  // ── Process in batches ─────────────────────────────────────────────────────
  const BATCH_SIZE = 20
  let inserted = 0, skipped = 0, errored = 0

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE)
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(deduped.length / BATCH_SIZE)} (books ${i + 1}–${Math.min(i + BATCH_SIZE, deduped.length)})`)

    for (const { book: bookData, authorSlugs, bans: banList, wikiUrl } of batch) {
      if (existingBookSlugs.has(bookData.slug)) {
        process.stdout.write(`  [skip] ${bookData.title}\n`)
        skipped++
        continue
      }

      try {
        const firstAuthorRow = authorRows.find(a => a.slug === authorSlugs[0])
        const firstAuthorName = firstAuthorRow?.display_name ?? ''
        process.stdout.write(`  Fetching cover: ${bookData.title}... `)
        const cover = await fetchCover(bookData.title, firstAuthorName)
        console.log(cover.coverUrl ? 'ok' : 'no cover')
        await sleep(COVER_DELAY_MS)

        const { data: newBook, error: be } = await supabase.from('books').insert({
          ...bookData,
          cover_url: cover.coverUrl,
          openlibrary_work_id: cover.workId,
        }).select('id').single()
        if (be) throw be
        const bookId = newBook.id
        existingBookSlugs.add(bookData.slug)

        for (const slug of authorSlugs) {
          const aId = authorMap.get(slug)
          if (!aId) { console.warn(`    [warn] author id missing: ${slug}`); continue }
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
            try {
              const rId = reasonId(rslug)
              const { error } = await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: rId })
              if (error) console.warn(`    [warn] reason link: ${error.message}`)
            } catch {
              console.warn(`    [warn] reason '${rslug}' not found, skipping`)
            }
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
        inserted++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  [error] ${bookData.title}: ${msg}`)
        errored++
      }
    }

    if (i + BATCH_SIZE < deduped.length) {
      console.log(`  Waiting ${BATCH_DELAY_MS}ms before next batch...`)
      await sleep(BATCH_DELAY_MS)
    }
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Done. Inserted: ${inserted}  Skipped: ${skipped}  Errored: ${errored}`)
  console.log('Run: npx tsx --env-file=.env.local scripts/generate-descriptions.ts')
}

async function ensureReasons() {
  const needed = [
    { slug: 'lgbtq',    label_en: 'LGBTQ+ content' },
    { slug: 'language', label_en: 'Offensive language' },
    { slug: 'violence', label_en: 'Violence' },
  ]
  const { data: existing } = await supabase.from('reasons').select('slug')
  const existingSlugs = new Set((existing ?? []).map(r => r.slug))
  for (const r of needed) {
    if (existingSlugs.has(r.slug)) continue
    const { error } = await supabase.from('reasons').insert({ slug: r.slug, label_en: r.label_en })
    if (error) console.warn(`  [reason warn] ${r.slug}: ${error.message}`)
    else console.log(`  [reason added] ${r.slug}`)
  }
}

async function run() {
  await ensureReasons()
  await main()
}

run().catch((err) => { console.error(err); process.exit(1) })
