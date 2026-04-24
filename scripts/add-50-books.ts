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

  // ── Countries ──────────────────────────────────────────────────────────────
  await supabase.from('countries').upsert([
    { code: 'DE', name_en: 'Germany',     slug: 'germany' },
    { code: 'FR', name_en: 'France',      slug: 'france' },
    { code: 'AU', name_en: 'Australia',   slug: 'australia' },
    { code: 'PH', name_en: 'Philippines', slug: 'philippines' },
  ], { onConflict: 'code' })
  console.log('Countries upserted.')

  // ── Authors ────────────────────────────────────────────────────────────────
  const authorRows = [
    { slug: 'j-d-salinger',          display_name: 'J.D. Salinger',          birth_year: 1919, death_year: 2010 },
    { slug: 'mark-twain',             display_name: 'Mark Twain',             birth_year: 1835, death_year: 1910 },
    { slug: 'john-steinbeck',         display_name: 'John Steinbeck',         birth_year: 1902, death_year: 1968 },
    { slug: 'alice-walker',           display_name: 'Alice Walker',           birth_year: 1944 },
    { slug: 'kurt-vonnegut',          display_name: 'Kurt Vonnegut',          birth_year: 1922, death_year: 2007 },
    { slug: 'ken-kesey',              display_name: 'Ken Kesey',              birth_year: 1935, death_year: 2001 },
    { slug: 'anthony-burgess',        display_name: 'Anthony Burgess',        birth_year: 1917, death_year: 1993 },
    { slug: 'william-golding',        display_name: 'William Golding',        birth_year: 1911, death_year: 1993 },
    { slug: 'ray-bradbury',           display_name: 'Ray Bradbury',           birth_year: 1920, death_year: 2012 },
    { slug: 'maya-angelou',           display_name: 'Maya Angelou',           birth_year: 1928, death_year: 2014 },
    { slug: 'richard-wright',         display_name: 'Richard Wright',         birth_year: 1908, death_year: 1960 },
    { slug: 'anne-frank',             display_name: 'Anne Frank',             birth_year: 1929, death_year: 1945 },
    { slug: 'suzanne-collins',        display_name: 'Suzanne Collins',        birth_year: 1962 },
    { slug: 'stephen-chbosky',        display_name: 'Stephen Chbosky',        birth_year: 1970 },
    { slug: 'laurie-halse-anderson',  display_name: 'Laurie Halse Anderson',  birth_year: 1961 },
    { slug: 'khaled-hosseini',        display_name: 'Khaled Hosseini',        birth_year: 1965 },
    { slug: 'philip-pullman',         display_name: 'Philip Pullman',         birth_year: 1946 },
    { slug: 'j-k-rowling',            display_name: 'J.K. Rowling',           birth_year: 1965 },
    { slug: 'anonymous',              display_name: 'Anonymous' },
    { slug: 's-e-hinton',             display_name: 'S.E. Hinton',            birth_year: 1948 },
    { slug: 'judy-blume',             display_name: 'Judy Blume',             birth_year: 1938 },
    { slug: 'dav-pilkey',             display_name: 'Dav Pilkey',             birth_year: 1966 },
    { slug: 'roald-dahl',             display_name: 'Roald Dahl',             birth_year: 1916, death_year: 1990 },
    { slug: 'katherine-paterson',     display_name: 'Katherine Paterson',     birth_year: 1932, death_year: 2024 },
    { slug: 'daniel-keyes',           display_name: 'Daniel Keyes',           birth_year: 1927, death_year: 2014 },
    { slug: 'sandra-cisneros',        display_name: 'Sandra Cisneros',        birth_year: 1954 },
    { slug: 'joseph-heller',          display_name: 'Joseph Heller',          birth_year: 1923, death_year: 1999 },
    { slug: 'sylvia-plath',           display_name: 'Sylvia Plath',           birth_year: 1932, death_year: 1963 },
    { slug: 'truman-capote',          display_name: 'Truman Capote',          birth_year: 1924, death_year: 1984 },
    { slug: 'harriet-beecher-stowe',  display_name: 'Harriet Beecher Stowe',  birth_year: 1811, death_year: 1896 },
    { slug: 'john-knowles',           display_name: 'John Knowles',           birth_year: 1926, death_year: 2001 },
    { slug: 'vladimir-nabokov',       display_name: 'Vladimir Nabokov',       birth_year: 1899, death_year: 1977 },
    { slug: 'james-joyce',            display_name: 'James Joyce',            birth_year: 1882, death_year: 1941 },
    { slug: 'henry-miller',           display_name: 'Henry Miller',           birth_year: 1891, death_year: 1980 },
    { slug: 'william-s-burroughs',    display_name: 'William S. Burroughs',   birth_year: 1914, death_year: 1997 },
    { slug: 'radclyffe-hall',         display_name: 'Radclyffe Hall',         birth_year: 1880, death_year: 1943 },
    { slug: 'boris-pasternak',        display_name: 'Boris Pasternak',        birth_year: 1890, death_year: 1960 },
    { slug: 'mikhail-bulgakov',       display_name: 'Mikhail Bulgakov',       birth_year: 1891, death_year: 1940 },
    { slug: 'franz-kafka',            display_name: 'Franz Kafka',            birth_year: 1883, death_year: 1924 },
    { slug: 'gustave-flaubert',       display_name: 'Gustave Flaubert',       birth_year: 1821, death_year: 1880 },
    { slug: 'bret-easton-ellis',      display_name: 'Bret Easton Ellis',      birth_year: 1964 },
    { slug: 'james-baldwin',          display_name: 'James Baldwin',          birth_year: 1924, death_year: 1987 },
    { slug: 'jose-rizal',             display_name: 'José Rizal',             birth_year: 1861, death_year: 1896 },
    { slug: 'chinua-achebe',          display_name: 'Chinua Achebe',          birth_year: 1930, death_year: 2013 },
    { slug: 'zora-neale-hurston',     display_name: 'Zora Neale Hurston',     birth_year: 1891, death_year: 1960 },
    { slug: 'karl-marx',              display_name: 'Karl Marx',              birth_year: 1818, death_year: 1883 },
    { slug: 'friedrich-engels',       display_name: 'Friedrich Engels',       birth_year: 1820, death_year: 1895 },
  ]

  const authorIds: Record<string, number> = {}

  // Carry over existing authors
  for (const slug of ['toni-morrison', 'george-orwell', 'salman-rushdie', 'margaret-atwood',
    'harper-lee', 'aldous-huxley', 'dan-brown', 'dh-lawrence', 'justin-richardson', 'peter-parnell']) {
    const a = authorBySlug(slug)
    if (a) authorIds[slug] = a.id
  }

  for (const row of authorRows) {
    const existing = authorBySlug(row.slug)
    if (existing) { authorIds[row.slug] = existing.id; continue }
    const { data, error } = await supabase.from('authors').insert(row).select('id').single()
    if (error) throw error
    authorIds[row.slug] = data.id
  }
  console.log('Authors ready.')

  // ── Book data ──────────────────────────────────────────────────────────────
  type BanData = { cc: string; scope: number; actionType: string; status: string; yearStarted: number; reasons: string[] }
  type NewBook = {
    book: { title: string; slug: string; original_language: string; first_published_year: number; ai_drafted: boolean; genres: string[] }
    authorSlugs: string[]
    bans: BanData[]
    wikiUrl: string
  }

  const newBooks: NewBook[] = [
    // ── US school bans ─────────────────────────────────────────────────────
    {
      book: { title: 'The Catcher in the Rye', slug: 'the-catcher-in-the-rye', original_language: 'en', first_published_year: 1951, ai_drafted: false, genres: ['coming-of-age', 'literary-fiction'] },
      authorSlugs: ['j-d-salinger'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1961, reasons: ['sexual', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Catcher_in_the_Rye',
    },
    {
      book: { title: 'Adventures of Huckleberry Finn', slug: 'adventures-of-huckleberry-finn', original_language: 'en', first_published_year: 1884, ai_drafted: false, genres: ['coming-of-age', 'historical-fiction'] },
      authorSlugs: ['mark-twain'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1885, reasons: ['racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Adventures_of_Huckleberry_Finn',
    },
    {
      book: { title: 'Of Mice and Men', slug: 'of-mice-and-men', original_language: 'en', first_published_year: 1937, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['john-steinbeck'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1989, reasons: ['racial', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Of_Mice_and_Men',
    },
    {
      book: { title: 'The Grapes of Wrath', slug: 'the-grapes-of-wrath', original_language: 'en', first_published_year: 1939, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['john-steinbeck'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1939, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Grapes_of_Wrath',
    },
    {
      book: { title: 'The Color Purple', slug: 'the-color-purple', original_language: 'en', first_published_year: 1982, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['alice-walker'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1984, reasons: ['sexual', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Color_Purple',
    },
    {
      book: { title: 'Beloved', slug: 'beloved', original_language: 'en', first_published_year: 1987, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['toni-morrison'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2007, reasons: ['sexual', 'violence', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Beloved_(novel)',
    },
    {
      book: { title: 'Slaughterhouse-Five', slug: 'slaughterhouse-five', original_language: 'en', first_published_year: 1969, ai_drafted: false, genres: ['literary-fiction', 'satire', 'science-fiction'] },
      authorSlugs: ['kurt-vonnegut'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1973, reasons: ['sexual', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Slaughterhouse-Five',
    },
    {
      book: { title: "One Flew Over the Cuckoo's Nest", slug: 'one-flew-over-the-cuckoos-nest', original_language: 'en', first_published_year: 1962, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['ken-kesey'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1974, reasons: ['sexual', 'violence'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/One_Flew_Over_the_Cuckoo%27s_Nest",
    },
    {
      book: { title: 'A Clockwork Orange', slug: 'a-clockwork-orange', original_language: 'en', first_published_year: 1962, ai_drafted: false, genres: ['dystopian', 'science-fiction'] },
      authorSlugs: ['anthony-burgess'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1976, reasons: ['sexual', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/A_Clockwork_Orange',
    },
    {
      book: { title: 'The Lord of the Flies', slug: 'the-lord-of-the-flies', original_language: 'en', first_published_year: 1954, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['william-golding'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1981, reasons: ['violence', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Lord_of_the_Flies',
    },
    {
      book: { title: 'Fahrenheit 451', slug: 'fahrenheit-451', original_language: 'en', first_published_year: 1953, ai_drafted: false, genres: ['dystopian', 'science-fiction'] },
      authorSlugs: ['ray-bradbury'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1992, reasons: ['other'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Fahrenheit_451',
    },
    {
      book: { title: 'I Know Why the Caged Bird Sings', slug: 'i-know-why-the-caged-bird-sings', original_language: 'en', first_published_year: 1969, ai_drafted: false, genres: ['memoir', 'coming-of-age'] },
      authorSlugs: ['maya-angelou'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1983, reasons: ['sexual', 'racial', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/I_Know_Why_the_Caged_Bird_Sings',
    },
    {
      book: { title: 'Native Son', slug: 'native-son', original_language: 'en', first_published_year: 1940, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['richard-wright'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1988, reasons: ['racial', 'sexual', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Native_Son',
    },
    {
      book: { title: 'The Diary of a Young Girl', slug: 'the-diary-of-a-young-girl', original_language: 'nl', first_published_year: 1947, ai_drafted: false, genres: ['memoir'] },
      authorSlugs: ['anne-frank'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 2010, reasons: ['sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Diary_of_a_Young_Girl',
    },
    {
      book: { title: 'The Hunger Games', slug: 'the-hunger-games', original_language: 'en', first_published_year: 2008, ai_drafted: false, genres: ['dystopian', 'young-adult'] },
      authorSlugs: ['suzanne-collins'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2010, reasons: ['violence', 'religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Hunger_Games',
    },
    {
      book: { title: 'The Perks of Being a Wallflower', slug: 'the-perks-of-being-a-wallflower', original_language: 'en', first_published_year: 1999, ai_drafted: false, genres: ['coming-of-age', 'young-adult'] },
      authorSlugs: ['stephen-chbosky'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2009, reasons: ['sexual', 'drugs'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Perks_of_Being_a_Wallflower',
    },
    {
      book: { title: 'Speak', slug: 'speak', original_language: 'en', first_published_year: 1999, ai_drafted: false, genres: ['young-adult'] },
      authorSlugs: ['laurie-halse-anderson'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2010, reasons: ['sexual', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Speak_(Anderson_novel)',
    },
    {
      book: { title: 'The Kite Runner', slug: 'the-kite-runner', original_language: 'en', first_published_year: 2003, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['khaled-hosseini'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2008, reasons: ['sexual', 'violence', 'religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Kite_Runner',
    },
    {
      book: { title: 'The Golden Compass', slug: 'the-golden-compass', original_language: 'en', first_published_year: 1995, ai_drafted: false, genres: ['fantasy', 'young-adult'] },
      authorSlugs: ['philip-pullman'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2007, reasons: ['religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Northern_Lights_(novel)',
    },
    {
      book: { title: "Harry Potter and the Philosopher's Stone", slug: 'harry-potter-philosophers-stone', original_language: 'en', first_published_year: 1997, ai_drafted: false, genres: ['fantasy', 'young-adult'] },
      authorSlugs: ['j-k-rowling'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2000, reasons: ['religious'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/Harry_Potter_and_the_Philosopher%27s_Stone",
    },
    {
      book: { title: 'Go Ask Alice', slug: 'go-ask-alice', original_language: 'en', first_published_year: 1971, ai_drafted: false, genres: ['young-adult'] },
      authorSlugs: ['anonymous'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1979, reasons: ['drugs', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Go_Ask_Alice',
    },
    {
      book: { title: 'The Outsiders', slug: 'the-outsiders', original_language: 'en', first_published_year: 1967, ai_drafted: false, genres: ['coming-of-age', 'young-adult'] },
      authorSlugs: ['s-e-hinton'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1986, reasons: ['violence', 'drugs'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Outsiders_(novel)',
    },
    {
      book: { title: "Are You There God? It's Me, Margaret", slug: 'are-you-there-god-its-me-margaret', original_language: 'en', first_published_year: 1970, ai_drafted: false, genres: ['coming-of-age', 'young-adult'] },
      authorSlugs: ['judy-blume'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1980, reasons: ['religious', 'sexual'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/Are_You_There_God%3F_It%27s_Me,_Margaret",
    },
    {
      book: { title: 'Forever', slug: 'forever-judy-blume', original_language: 'en', first_published_year: 1975, ai_drafted: false, genres: ['romance', 'young-adult'] },
      authorSlugs: ['judy-blume'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1982, reasons: ['sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Forever_(Blume_novel)',
    },
    {
      book: { title: 'Captain Underpants', slug: 'captain-underpants', original_language: 'en', first_published_year: 1997, ai_drafted: false, genres: ['children'] },
      authorSlugs: ['dav-pilkey'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2012, reasons: ['violence', 'other'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Captain_Underpants',
    },
    {
      book: { title: 'The Witches', slug: 'the-witches', original_language: 'en', first_published_year: 1983, ai_drafted: false, genres: ['fantasy', 'children'] },
      authorSlugs: ['roald-dahl'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1990, reasons: ['religious', 'other'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Witches_(novel)',
    },
    {
      book: { title: 'James and the Giant Peach', slug: 'james-and-the-giant-peach', original_language: 'en', first_published_year: 1961, ai_drafted: false, genres: ['fantasy', 'children'] },
      authorSlugs: ['roald-dahl'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1991, reasons: ['violence', 'drugs', 'other'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/James_and_the_Giant_Peach',
    },
    {
      book: { title: 'Bridge to Terabithia', slug: 'bridge-to-terabithia', original_language: 'en', first_published_year: 1977, ai_drafted: false, genres: ['coming-of-age', 'young-adult'] },
      authorSlugs: ['katherine-paterson'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1986, reasons: ['religious', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Bridge_to_Terabithia_(novel)',
    },
    {
      book: { title: 'Flowers for Algernon', slug: 'flowers-for-algernon', original_language: 'en', first_published_year: 1966, ai_drafted: false, genres: ['science-fiction', 'literary-fiction'] },
      authorSlugs: ['daniel-keyes'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1981, reasons: ['sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Flowers_for_Algernon',
    },
    {
      book: { title: 'The House on Mango Street', slug: 'the-house-on-mango-street', original_language: 'en', first_published_year: 1984, ai_drafted: false, genres: ['literary-fiction', 'coming-of-age'] },
      authorSlugs: ['sandra-cisneros'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2006, reasons: ['sexual', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_House_on_Mango_Street',
    },
    {
      book: { title: 'Catch-22', slug: 'catch-22', original_language: 'en', first_published_year: 1961, ai_drafted: false, genres: ['literary-fiction', 'satire'] },
      authorSlugs: ['joseph-heller'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1972, reasons: ['sexual', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Catch-22',
    },
    {
      book: { title: 'The Bell Jar', slug: 'the-bell-jar', original_language: 'en', first_published_year: 1963, ai_drafted: false, genres: ['literary-fiction', 'coming-of-age'] },
      authorSlugs: ['sylvia-plath'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1977, reasons: ['sexual', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Bell_Jar',
    },
    {
      book: { title: 'In Cold Blood', slug: 'in-cold-blood', original_language: 'en', first_published_year: 1966, ai_drafted: false, genres: ['non-fiction', 'thriller'] },
      authorSlugs: ['truman-capote'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 2000, reasons: ['violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/In_Cold_Blood',
    },
    {
      book: { title: "Uncle Tom's Cabin", slug: 'uncle-toms-cabin', original_language: 'en', first_published_year: 1852, ai_drafted: false, genres: ['historical-fiction'] },
      authorSlugs: ['harriet-beecher-stowe'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1852, reasons: ['political', 'racial'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/Uncle_Tom%27s_Cabin",
    },
    {
      book: { title: 'A Separate Peace', slug: 'a-separate-peace', original_language: 'en', first_published_year: 1959, ai_drafted: false, genres: ['coming-of-age', 'literary-fiction'] },
      authorSlugs: ['john-knowles'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1980, reasons: ['sexual', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/A_Separate_Peace',
    },
    {
      book: { title: 'Their Eyes Were Watching God', slug: 'their-eyes-were-watching-god', original_language: 'en', first_published_year: 1937, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['zora-neale-hurston'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1997, reasons: ['racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Their_Eyes_Were_Watching_God',
    },
    {
      book: { title: 'Things Fall Apart', slug: 'things-fall-apart', original_language: 'en', first_published_year: 1958, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['chinua-achebe'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2012, reasons: ['racial', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Things_Fall_Apart',
    },
    // ── Government bans ────────────────────────────────────────────────────
    {
      book: { title: 'Lolita', slug: 'lolita', original_language: 'en', first_published_year: 1955, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['vladimir-nabokov'],
      bans: [
        { cc: 'FR', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1956, reasons: ['sexual'] },
        { cc: 'GB', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1955, reasons: ['sexual'] },
      ],
      wikiUrl: 'https://en.wikipedia.org/wiki/Lolita',
    },
    {
      book: { title: 'Ulysses', slug: 'ulysses', original_language: 'en', first_published_year: 1922, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['james-joyce'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1921, reasons: ['sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Ulysses_(novel)',
    },
    {
      book: { title: 'Tropic of Cancer', slug: 'tropic-of-cancer', original_language: 'en', first_published_year: 1934, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['henry-miller'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1934, reasons: ['sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Tropic_of_Cancer_(novel)',
    },
    {
      book: { title: 'Naked Lunch', slug: 'naked-lunch', original_language: 'en', first_published_year: 1959, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['william-s-burroughs'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1962, reasons: ['sexual', 'drugs'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Naked_Lunch',
    },
    {
      book: { title: 'The Well of Loneliness', slug: 'the-well-of-loneliness', original_language: 'en', first_published_year: 1928, ai_drafted: false, genres: ['literary-fiction', 'romance'] },
      authorSlugs: ['radclyffe-hall'],
      bans: [{ cc: 'GB', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1928, reasons: ['lgbtq'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Well_of_Loneliness',
    },
    {
      book: { title: 'Doctor Zhivago', slug: 'doctor-zhivago', original_language: 'ru', first_published_year: 1957, ai_drafted: false, genres: ['literary-fiction', 'romance', 'historical-fiction'] },
      authorSlugs: ['boris-pasternak'],
      bans: [{ cc: 'SU', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1957, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Doctor_Zhivago_(novel)',
    },
    {
      book: { title: 'The Master and Margarita', slug: 'the-master-and-margarita', original_language: 'ru', first_published_year: 1967, ai_drafted: false, genres: ['literary-fiction', 'magical-realism', 'satire'] },
      authorSlugs: ['mikhail-bulgakov'],
      bans: [{ cc: 'SU', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1940, reasons: ['political', 'religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Master_and_Margarita',
    },
    {
      book: { title: 'The Trial', slug: 'the-trial', original_language: 'de', first_published_year: 1925, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['franz-kafka'],
      bans: [{ cc: 'DE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1933, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Trial',
    },
    {
      book: { title: 'Madame Bovary', slug: 'madame-bovary', original_language: 'fr', first_published_year: 1857, ai_drafted: false, genres: ['literary-fiction', 'romance'] },
      authorSlugs: ['gustave-flaubert'],
      bans: [{ cc: 'FR', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1857, reasons: ['sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Madame_Bovary',
    },
    {
      book: { title: 'American Psycho', slug: 'american-psycho', original_language: 'en', first_published_year: 1991, ai_drafted: false, genres: ['literary-fiction', 'thriller'] },
      authorSlugs: ['bret-easton-ellis'],
      bans: [{ cc: 'AU', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1991, reasons: ['sexual', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/American_Psycho',
    },
    {
      book: { title: "Giovanni's Room", slug: 'giovannis-room', original_language: 'en', first_published_year: 1956, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['james-baldwin'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1956, reasons: ['lgbtq', 'sexual'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/Giovanni%27s_Room",
    },
    {
      book: { title: 'Noli Me Tángere', slug: 'noli-me-tangere', original_language: 'es', first_published_year: 1887, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction', 'political-fiction'] },
      authorSlugs: ['jose-rizal'],
      bans: [{ cc: 'PH', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1887, reasons: ['political', 'religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Noli_Me_T%C3%A1ngere_(novel)',
    },
    {
      book: { title: 'The Communist Manifesto', slug: 'the-communist-manifesto', original_language: 'de', first_published_year: 1848, ai_drafted: false, genres: ['non-fiction', 'political-fiction'] },
      authorSlugs: ['karl-marx', 'friedrich-engels'],
      bans: [{ cc: 'DE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1933, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Communist_Manifesto',
    },
  ]

  // ── Insert books ───────────────────────────────────────────────────────────
  for (const { book: bookData, authorSlugs, bans: banList, wikiUrl } of newBooks) {
    if (bookBySlug(bookData.slug)) {
      console.log(`  [skip] ${bookData.title}`)
      continue
    }

    const firstAuthorSlug = authorSlugs[0]
    const firstAuthorName = authorRows.find(a => a.slug === firstAuthorSlug)?.display_name ?? ''
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
