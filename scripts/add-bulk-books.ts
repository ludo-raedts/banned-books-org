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
  const library = scopeId('public_library')

  // ── Countries ──────────────────────────────────────────────────────────────
  await supabase.from('countries').upsert([
    { code: 'IT', name_en: 'Italy',        slug: 'italy' },
    { code: 'ZA', name_en: 'South Africa', slug: 'south-africa' },
    { code: 'IN', name_en: 'India',        slug: 'india' },
    { code: 'PK', name_en: 'Pakistan',     slug: 'pakistan' },
    { code: 'GR', name_en: 'Greece',       slug: 'greece' },
    { code: 'CL', name_en: 'Chile',        slug: 'chile' },
    { code: 'CN', name_en: 'China',        slug: 'china' },
    { code: 'SU', name_en: 'Soviet Union', slug: 'soviet-union' },
    { code: 'AR', name_en: 'Argentina',    slug: 'argentina' },
    { code: 'BR', name_en: 'Brazil',       slug: 'brazil' },
    { code: 'PT', name_en: 'Portugal',     slug: 'portugal' },
    { code: 'IE', name_en: 'Ireland',      slug: 'ireland' },
    { code: 'CA', name_en: 'Canada',       slug: 'canada' },
    { code: 'JP', name_en: 'Japan',        slug: 'japan' },
    { code: 'NG', name_en: 'Nigeria',      slug: 'nigeria' },
    { code: 'MY', name_en: 'Malaysia',     slug: 'malaysia' },
    { code: 'SG', name_en: 'Singapore',    slug: 'singapore' },
    { code: 'TR', name_en: 'Turkey',       slug: 'turkey' },
    { code: 'IR', name_en: 'Iran',         slug: 'iran' },
    { code: 'SA', name_en: 'Saudi Arabia', slug: 'saudi-arabia' },
    { code: 'EG', name_en: 'Egypt',        slug: 'egypt' },
    { code: 'MX', name_en: 'Mexico',       slug: 'mexico' },
    { code: 'PL', name_en: 'Poland',       slug: 'poland' },
    { code: 'RU', name_en: 'Russia',       slug: 'russia' },
    { code: 'GB', name_en: 'United Kingdom', slug: 'united-kingdom' },
  ], { onConflict: 'code' })
  console.log('Countries upserted.')

  // ── Authors ────────────────────────────────────────────────────────────────
  const authorRows = [
    { slug: 'james-joyce',              display_name: 'James Joyce',              birth_year: 1882, death_year: 1941 },
    { slug: 'henry-miller',             display_name: 'Henry Miller',             birth_year: 1891, death_year: 1980 },
    { slug: 'd-h-lawrence',             display_name: 'D. H. Lawrence',           birth_year: 1885, death_year: 1930 },
    { slug: 'william-s-burroughs',      display_name: 'William S. Burroughs',     birth_year: 1914, death_year: 1997 },
    { slug: 'jean-paul-sartre',         display_name: 'Jean-Paul Sartre',         birth_year: 1905, death_year: 1980 },
    { slug: 'simone-de-beauvoir',       display_name: 'Simone de Beauvoir',       birth_year: 1908, death_year: 1986 },
    { slug: 'albert-camus',             display_name: 'Albert Camus',             birth_year: 1913, death_year: 1960 },
    { slug: 'salman-rushdie',           display_name: 'Salman Rushdie',           birth_year: 1947, death_year: null },
    { slug: 'chinua-achebe',            display_name: 'Chinua Achebe',            birth_year: 1930, death_year: 2013 },
    { slug: 'aleksandr-solzhenitsyn',   display_name: 'Aleksandr Solzhenitsyn',   birth_year: 1918, death_year: 2008 },
    { slug: 'boris-pasternak',          display_name: 'Boris Pasternak',          birth_year: 1890, death_year: 1960 },
    { slug: 'mikhail-bulgakov',         display_name: 'Mikhail Bulgakov',         birth_year: 1891, death_year: 1940 },
    { slug: 'milan-kundera',            display_name: 'Milan Kundera',            birth_year: 1929, death_year: 2023 },
    { slug: 'vaclav-havel',             display_name: 'Václav Havel',             birth_year: 1936, death_year: 2011 },
    { slug: 'arthur-koestler',          display_name: 'Arthur Koestler',          birth_year: 1905, death_year: 1983 },
    { slug: 'gabriel-garcia-marquez',   display_name: 'Gabriel García Márquez',   birth_year: 1927, death_year: 2014 },
    { slug: 'pablo-neruda',             display_name: 'Pablo Neruda',             birth_year: 1904, death_year: 1973 },
    { slug: 'isabel-allende',           display_name: 'Isabel Allende',           birth_year: 1942, death_year: null },
    { slug: 'mario-vargas-llosa',       display_name: 'Mario Vargas Llosa',       birth_year: 1936, death_year: null },
    { slug: 'jorge-amado',              display_name: 'Jorge Amado',              birth_year: 1912, death_year: 2001 },
    { slug: 'nadine-gordimer',          display_name: 'Nadine Gordimer',          birth_year: 1923, death_year: 2014 },
    { slug: 'alan-paton',               display_name: 'Alan Paton',               birth_year: 1903, death_year: 1988 },
    { slug: 'wole-soyinka',             display_name: 'Wole Soyinka',             birth_year: 1934, death_year: null },
    { slug: 'e-m-forster',              display_name: 'E. M. Forster',            birth_year: 1879, death_year: 1970 },
    { slug: 'james-baldwin',            display_name: 'James Baldwin',            birth_year: 1924, death_year: 1987 },
    { slug: 'alice-walker',             display_name: 'Alice Walker',             birth_year: 1944, death_year: null },
    { slug: 'toni-morrison',            display_name: 'Toni Morrison',            birth_year: 1931, death_year: 2019 },
    { slug: 'judy-blume',               display_name: 'Judy Blume',               birth_year: 1938, death_year: null },
    { slug: 'stephen-king',             display_name: 'Stephen King',             birth_year: 1947, death_year: null },
    { slug: 'kurt-vonnegut',            display_name: 'Kurt Vonnegut',            birth_year: 1922, death_year: 2007 },
    { slug: 'joseph-heller',            display_name: 'Joseph Heller',            birth_year: 1923, death_year: 1999 },
    { slug: 'ken-kesey',                display_name: 'Ken Kesey',                birth_year: 1935, death_year: 2001 },
    { slug: 'jack-kerouac',             display_name: 'Jack Kerouac',             birth_year: 1922, death_year: 1969 },
    { slug: 'allen-ginsberg',           display_name: 'Allen Ginsberg',           birth_year: 1926, death_year: 1997 },
    { slug: 'j-d-salinger',             display_name: 'J. D. Salinger',           birth_year: 1919, death_year: 2010 },
    { slug: 'sylvia-plath',             display_name: 'Sylvia Plath',             birth_year: 1932, death_year: 1963 },
    { slug: 'truman-capote',            display_name: 'Truman Capote',            birth_year: 1924, death_year: 1984 },
    { slug: 'gore-vidal',               display_name: 'Gore Vidal',               birth_year: 1925, death_year: 2012 },
    { slug: 'william-faulkner',         display_name: 'William Faulkner',         birth_year: 1897, death_year: 1962 },
    { slug: 'erskine-caldwell',         display_name: 'Erskine Caldwell',         birth_year: 1903, death_year: 1987 },
    { slug: 'john-steinbeck',           display_name: 'John Steinbeck',           birth_year: 1902, death_year: 1968 },
    { slug: 'upton-sinclair',           display_name: 'Upton Sinclair',           birth_year: 1878, death_year: 1968 },
    { slug: 'theodore-dreiser',         display_name: 'Theodore Dreiser',         birth_year: 1871, death_year: 1945 },
    { slug: 'edna-st-vincent-millay',   display_name: 'Edna St. Vincent Millay',  birth_year: 1892, death_year: 1950 },
    { slug: 'thomas-hardy',             display_name: 'Thomas Hardy',             birth_year: 1840, death_year: 1928 },
    { slug: 'oscar-wilde',              display_name: 'Oscar Wilde',              birth_year: 1854, death_year: 1900 },
    { slug: 'gustave-flaubert',         display_name: 'Gustave Flaubert',         birth_year: 1821, death_year: 1880 },
    { slug: 'emile-zola',               display_name: 'Émile Zola',               birth_year: 1840, death_year: 1902 },
    { slug: 'giovanni-boccaccio',       display_name: 'Giovanni Boccaccio',       birth_year: 1313, death_year: 1375 },
    { slug: 'dante-alighieri',          display_name: 'Dante Alighieri',          birth_year: 1265, death_year: 1321 },
    { slug: 'nikolai-gogol',            display_name: 'Nikolai Gogol',            birth_year: 1809, death_year: 1852 },
    { slug: 'fyodor-dostoevsky',        display_name: 'Fyodor Dostoevsky',        birth_year: 1821, death_year: 1881 },
    { slug: 'leo-tolstoy',              display_name: 'Leo Tolstoy',              birth_year: 1828, death_year: 1910 },
    { slug: 'maxim-gorky',              display_name: 'Maxim Gorky',              birth_year: 1868, death_year: 1936 },
    { slug: 'yevgenia-ginzburg',        display_name: 'Yevgenia Ginzburg',        birth_year: 1904, death_year: 1977 },
    { slug: 'anna-akhmatova',           display_name: 'Anna Akhmatova',           birth_year: 1889, death_year: 1966 },
    { slug: 'naguib-mahfouz',           display_name: 'Naguib Mahfouz',           birth_year: 1911, death_year: 2006 },
    { slug: 'arundhati-roy',            display_name: 'Arundhati Roy',            birth_year: 1961, death_year: null },
    { slug: 'khaled-hosseini',          display_name: 'Khaled Hosseini',          birth_year: 1965, death_year: null },
    { slug: 'taslima-nasrin',           display_name: 'Taslima Nasrin',           birth_year: 1962, death_year: null },
    { slug: 'orhan-pamuk',              display_name: 'Orhan Pamuk',              birth_year: 1952, death_year: null },
    { slug: 'elif-shafak',              display_name: 'Elif Şafak',               birth_year: 1971, death_year: null },
    { slug: 'yu-hua',                   display_name: 'Yu Hua',                   birth_year: 1960, death_year: null },
    { slug: 'mo-yan',                   display_name: 'Mo Yan',                   birth_year: 1955, death_year: null },
    { slug: 'robert-cormier',           display_name: 'Robert Cormier',           birth_year: 1925, death_year: 2000 },
    { slug: 'laurie-halse-anderson',    display_name: 'Laurie Halse Anderson',    birth_year: 1961, death_year: null },
    { slug: 'sherman-alexie',           display_name: 'Sherman Alexie',           birth_year: 1966, death_year: null },
    { slug: 'markus-zusak',             display_name: 'Markus Zusak',             birth_year: 1975, death_year: null },
    { slug: 'paulo-coelho',             display_name: 'Paulo Coelho',             birth_year: 1947, death_year: null },
    { slug: 'lois-lowry',               display_name: 'Lois Lowry',               birth_year: 1937, death_year: null },
    { slug: 'madeleine-lengle',         display_name: "Madeleine L'Engle",        birth_year: 1918, death_year: 2007 },
    { slug: 'roald-dahl',               display_name: 'Roald Dahl',               birth_year: 1916, death_year: 1990 },
    { slug: 'chris-crutcher',           display_name: 'Chris Crutcher',           birth_year: 1946, death_year: null },
    { slug: 'walter-dean-myers',        display_name: 'Walter Dean Myers',        birth_year: 1937, death_year: 2014 },
    { slug: 'gary-paulsen',             display_name: 'Gary Paulsen',             birth_year: 1939, death_year: 2021 },
    { slug: 'bret-easton-ellis',        display_name: 'Bret Easton Ellis',        birth_year: 1964, death_year: null },
    { slug: 'vladimir-nabokov',         display_name: 'Vladimir Nabokov',         birth_year: 1899, death_year: 1977 },
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

  // ── Book definitions ───────────────────────────────────────────────────────
  type BanData = { cc: string; scope: number; actionType: string; status: string; yearStarted: number; reasons: string[] }
  type NewBook = {
    book: { title: string; slug: string; original_language: string; first_published_year: number; ai_drafted: boolean; genres: string[] }
    authorSlugs: string[]
    bans: BanData[]
    wikiUrl: string
  }

  const books: NewBook[] = [
    // ── Classic US/UK banned ────────────────────────────────────────────────
    {
      book: { title: 'Ulysses', slug: 'ulysses', original_language: 'en', first_published_year: 1922, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['james-joyce'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1922, reasons: ['sexual', 'obscenity'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Ulysses_(novel)',
    },
    {
      book: { title: 'Tropic of Cancer', slug: 'tropic-of-cancer', original_language: 'en', first_published_year: 1934, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['henry-miller'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1934, reasons: ['sexual', 'obscenity'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Tropic_of_Cancer_(novel)',
    },
    {
      book: { title: "Lady Chatterley's Lover", slug: 'lady-chatterleys-lover', original_language: 'en', first_published_year: 1928, ai_drafted: false, genres: ['literary-fiction', 'romance'] },
      authorSlugs: ['d-h-lawrence'],
      bans: [{ cc: 'GB', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1928, reasons: ['sexual', 'obscenity'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/Lady_Chatterley%27s_Lover",
    },
    {
      book: { title: 'Naked Lunch', slug: 'naked-lunch', original_language: 'en', first_published_year: 1959, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['william-s-burroughs'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1962, reasons: ['sexual', 'obscenity'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Naked_Lunch',
    },
    {
      book: { title: 'The Picture of Dorian Gray', slug: 'the-picture-of-dorian-gray', original_language: 'en', first_published_year: 1890, ai_drafted: false, genres: ['literary-fiction', 'horror'] },
      authorSlugs: ['oscar-wilde'],
      bans: [{ cc: 'GB', scope: gov, actionType: 'challenged', status: 'historical', yearStarted: 1890, reasons: ['sexual', 'moral'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Picture_of_Dorian_Gray',
    },
    {
      book: { title: 'The Catcher in the Rye', slug: 'the-catcher-in-the-rye', original_language: 'en', first_published_year: 1951, ai_drafted: false, genres: ['literary-fiction', 'coming-of-age'] },
      authorSlugs: ['j-d-salinger'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1960, reasons: ['sexual', 'language', 'moral'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Catcher_in_the_Rye',
    },
    {
      book: { title: 'Catch-22', slug: 'catch-22', original_language: 'en', first_published_year: 1961, ai_drafted: false, genres: ['literary-fiction', 'satire', 'historical-fiction'] },
      authorSlugs: ['joseph-heller'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1972, reasons: ['language', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Catch-22',
    },
    {
      book: { title: 'Slaughterhouse-Five', slug: 'slaughterhouse-five', original_language: 'en', first_published_year: 1969, ai_drafted: false, genres: ['literary-fiction', 'science-fiction', 'satire'] },
      authorSlugs: ['kurt-vonnegut'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1972, reasons: ['language', 'sexual', 'political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Slaughterhouse-Five',
    },
    {
      book: { title: "One Flew Over the Cuckoo's Nest", slug: 'one-flew-over-the-cuckoos-nest', original_language: 'en', first_published_year: 1962, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['ken-kesey'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'historical', yearStarted: 1974, reasons: ['sexual', 'language'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/One_Flew_Over_the_Cuckoo%27s_Nest",
    },
    {
      book: { title: 'On the Road', slug: 'on-the-road', original_language: 'en', first_published_year: 1957, ai_drafted: false, genres: ['literary-fiction', 'coming-of-age'] },
      authorSlugs: ['jack-kerouac'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1979, reasons: ['sexual', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/On_the_Road',
    },
    {
      book: { title: 'Howl and Other Poems', slug: 'howl-and-other-poems', original_language: 'en', first_published_year: 1956, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['allen-ginsberg'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1957, reasons: ['sexual', 'obscenity'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Howl_(poem)',
    },
    {
      book: { title: 'The Bell Jar', slug: 'the-bell-jar', original_language: 'en', first_published_year: 1963, ai_drafted: false, genres: ['literary-fiction', 'coming-of-age'] },
      authorSlugs: ['sylvia-plath'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1977, reasons: ['sexual', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Bell_Jar',
    },
    {
      book: { title: 'In Cold Blood', slug: 'in-cold-blood', original_language: 'en', first_published_year: 1966, ai_drafted: false, genres: ['non-fiction', 'thriller'] },
      authorSlugs: ['truman-capote'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1981, reasons: ['violence', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/In_Cold_Blood',
    },
    {
      book: { title: 'The Sound and the Fury', slug: 'the-sound-and-the-fury', original_language: 'en', first_published_year: 1929, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['william-faulkner'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1986, reasons: ['racial', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Sound_and_the_Fury',
    },
    {
      book: { title: 'The Grapes of Wrath', slug: 'the-grapes-of-wrath', original_language: 'en', first_published_year: 1939, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['john-steinbeck'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1939, reasons: ['political', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Grapes_of_Wrath',
    },
    {
      book: { title: 'Of Mice and Men', slug: 'of-mice-and-men', original_language: 'en', first_published_year: 1937, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['john-steinbeck'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1974, reasons: ['language', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Of_Mice_and_Men',
    },
    {
      book: { title: 'The Color Purple', slug: 'the-color-purple', original_language: 'en', first_published_year: 1982, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['alice-walker'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1984, reasons: ['sexual', 'language', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Color_Purple',
    },
    {
      book: { title: 'Beloved', slug: 'beloved', original_language: 'en', first_published_year: 1987, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['toni-morrison'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1987, reasons: ['sexual', 'violence', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Beloved_(novel)',
    },
    {
      book: { title: 'Song of Solomon', slug: 'song-of-solomon', original_language: 'en', first_published_year: 1977, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['toni-morrison'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1995, reasons: ['sexual', 'language', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Song_of_Solomon_(novel)',
    },
    {
      book: { title: 'Go Tell It on the Mountain', slug: 'go-tell-it-on-the-mountain', original_language: 'en', first_published_year: 1953, ai_drafted: false, genres: ['literary-fiction', 'coming-of-age'] },
      authorSlugs: ['james-baldwin'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1980, reasons: ['sexual', 'language', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Go_Tell_It_on_the_Mountain_(novel)',
    },
    // ── Young adult / children challenged ────────────────────────────────────
    {
      book: { title: 'Are You There God? It\'s Me, Margaret', slug: 'are-you-there-god-its-me-margaret', original_language: 'en', first_published_year: 1970, ai_drafted: false, genres: ['young-adult', 'coming-of-age'] },
      authorSlugs: ['judy-blume'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1980, reasons: ['religious', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Are_You_There_God%3F_It%27s_Me%2C_Margaret',
    },
    {
      book: { title: 'Forever', slug: 'forever-judy-blume', original_language: 'en', first_published_year: 1975, ai_drafted: false, genres: ['young-adult', 'romance'] },
      authorSlugs: ['judy-blume'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1982, reasons: ['sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Forever_(Blume_novel)',
    },
    {
      book: { title: 'The Chocolate War', slug: 'the-chocolate-war', original_language: 'en', first_published_year: 1974, ai_drafted: false, genres: ['young-adult'] },
      authorSlugs: ['robert-cormier'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1981, reasons: ['violence', 'language', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Chocolate_War',
    },
    {
      book: { title: 'Speak', slug: 'speak-laurie-halse-anderson', original_language: 'en', first_published_year: 1999, ai_drafted: false, genres: ['young-adult', 'coming-of-age'] },
      authorSlugs: ['laurie-halse-anderson'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 2010, reasons: ['sexual', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Speak_(Anderson_novel)',
    },
    {
      book: { title: 'The Absolutely True Diary of a Part-Time Indian', slug: 'the-absolutely-true-diary-of-a-part-time-indian', original_language: 'en', first_published_year: 2007, ai_drafted: false, genres: ['young-adult', 'coming-of-age'] },
      authorSlugs: ['sherman-alexie'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2010, reasons: ['language', 'racial', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Absolutely_True_Diary_of_a_Part-Time_Indian',
    },
    {
      book: { title: 'The Giver', slug: 'the-giver', original_language: 'en', first_published_year: 1993, ai_drafted: false, genres: ['young-adult', 'dystopian', 'science-fiction'] },
      authorSlugs: ['lois-lowry'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 1994, reasons: ['violence', 'political', 'religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Giver',
    },
    {
      book: { title: 'A Wrinkle in Time', slug: 'a-wrinkle-in-time', original_language: 'en', first_published_year: 1962, ai_drafted: false, genres: ['young-adult', 'fantasy', 'science-fiction'] },
      authorSlugs: ['madeleine-lengle'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1980, reasons: ['religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/A_Wrinkle_in_Time',
    },
    {
      book: { title: 'The Witches', slug: 'the-witches', original_language: 'en', first_published_year: 1983, ai_drafted: false, genres: ['children', 'fantasy'] },
      authorSlugs: ['roald-dahl'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1990, reasons: ['violence', 'religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Witches_(novel)',
    },
    {
      book: { title: 'James and the Giant Peach', slug: 'james-and-the-giant-peach', original_language: 'en', first_published_year: 1961, ai_drafted: false, genres: ['children', 'fantasy'] },
      authorSlugs: ['roald-dahl'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1991, reasons: ['language', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/James_and_the_Giant_Peach',
    },
    {
      book: { title: 'American Psycho', slug: 'american-psycho', original_language: 'en', first_published_year: 1991, ai_drafted: false, genres: ['literary-fiction', 'thriller', 'horror'] },
      authorSlugs: ['bret-easton-ellis'],
      bans: [{ cc: 'AU', scope: gov, actionType: 'restricted', status: 'active', yearStarted: 1991, reasons: ['violence', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/American_Psycho',
    },
    // ── Soviet / Russian ────────────────────────────────────────────────────
    {
      book: { title: 'The Gulag Archipelago', slug: 'the-gulag-archipelago', original_language: 'ru', first_published_year: 1973, ai_drafted: false, genres: ['non-fiction', 'memoir'] },
      authorSlugs: ['aleksandr-solzhenitsyn'],
      bans: [{ cc: 'SU', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1973, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Gulag_Archipelago',
    },
    {
      book: { title: 'One Day in the Life of Ivan Denisovich', slug: 'one-day-in-the-life-of-ivan-denisovich', original_language: 'ru', first_published_year: 1962, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['aleksandr-solzhenitsyn'],
      bans: [{ cc: 'SU', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1974, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/One_Day_in_the_Life_of_Ivan_Denisovich',
    },
    {
      book: { title: 'Doctor Zhivago', slug: 'doctor-zhivago', original_language: 'ru', first_published_year: 1957, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction', 'romance'] },
      authorSlugs: ['boris-pasternak'],
      bans: [{ cc: 'SU', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1958, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Doctor_Zhivago_(novel)',
    },
    {
      book: { title: 'The Master and Margarita', slug: 'the-master-and-margarita', original_language: 'ru', first_published_year: 1967, ai_drafted: false, genres: ['literary-fiction', 'fantasy', 'satire'] },
      authorSlugs: ['mikhail-bulgakov'],
      bans: [{ cc: 'SU', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1940, reasons: ['political', 'religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Master_and_Margarita',
    },
    // ── Eastern European ────────────────────────────────────────────────────
    {
      book: { title: 'The Unbearable Lightness of Being', slug: 'the-unbearable-lightness-of-being', original_language: 'cs', first_published_year: 1984, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['milan-kundera'],
      bans: [{ cc: 'CS', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1984, reasons: ['political', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Unbearable_Lightness_of_Being',
    },
    {
      book: { title: 'Darkness at Noon', slug: 'darkness-at-noon', original_language: 'de', first_published_year: 1940, ai_drafted: false, genres: ['political-fiction', 'historical-fiction'] },
      authorSlugs: ['arthur-koestler'],
      bans: [{ cc: 'SU', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1941, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Darkness_at_Noon',
    },
    // ── French/Continental Europe ────────────────────────────────────────────
    {
      book: { title: 'Madame Bovary', slug: 'madame-bovary', original_language: 'fr', first_published_year: 1857, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['gustave-flaubert'],
      bans: [{ cc: 'FR', scope: gov, actionType: 'challenged', status: 'historical', yearStarted: 1857, reasons: ['sexual', 'moral'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Madame_Bovary',
    },
    {
      book: { title: 'Nana', slug: 'nana-zola', original_language: 'fr', first_published_year: 1880, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['emile-zola'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1880, reasons: ['sexual', 'obscenity'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Nana_(novel)',
    },
    {
      book: { title: 'The Second Sex', slug: 'the-second-sex', original_language: 'fr', first_published_year: 1949, ai_drafted: false, genres: ['non-fiction'] },
      authorSlugs: ['simone-de-beauvoir'],
      bans: [{ cc: 'IT', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1956, reasons: ['religious', 'political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Second_Sex',
    },
    {
      book: { title: 'Being and Nothingness', slug: 'being-and-nothingness', original_language: 'fr', first_published_year: 1943, ai_drafted: false, genres: ['non-fiction'] },
      authorSlugs: ['jean-paul-sartre'],
      bans: [{ cc: 'IT', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1959, reasons: ['religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Being_and_Nothingness',
    },
    {
      book: { title: 'The Stranger', slug: 'the-stranger', original_language: 'fr', first_published_year: 1942, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['albert-camus'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1982, reasons: ['language', 'moral'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Stranger_(Camus_novel)',
    },
    {
      book: { title: 'The Decameron', slug: 'the-decameron', original_language: 'it', first_published_year: 1353, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['giovanni-boccaccio'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1873, reasons: ['sexual', 'obscenity'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Decameron',
    },
    // ── Latin American ───────────────────────────────────────────────────────
    {
      book: { title: 'One Hundred Years of Solitude', slug: 'one-hundred-years-of-solitude', original_language: 'es', first_published_year: 1967, ai_drafted: false, genres: ['literary-fiction', 'magical-realism'] },
      authorSlugs: ['gabriel-garcia-marquez'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1986, reasons: ['sexual', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/One_Hundred_Years_of_Solitude',
    },
    {
      book: { title: 'Canto General', slug: 'canto-general', original_language: 'es', first_published_year: 1950, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['pablo-neruda'],
      bans: [{ cc: 'CL', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1973, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Canto_General',
    },
    {
      book: { title: 'The House of the Spirits', slug: 'the-house-of-the-spirits', original_language: 'es', first_published_year: 1982, ai_drafted: false, genres: ['literary-fiction', 'magical-realism', 'historical-fiction'] },
      authorSlugs: ['isabel-allende'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1995, reasons: ['sexual', 'language', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_House_of_the_Spirits',
    },
    {
      book: { title: 'The War of the End of the World', slug: 'the-war-of-the-end-of-the-world', original_language: 'es', first_published_year: 1981, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['mario-vargas-llosa'],
      bans: [{ cc: 'PE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1982, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_War_of_the_End_of_the_World',
    },
    // ── Africa ───────────────────────────────────────────────────────────────
    {
      book: { title: 'Things Fall Apart', slug: 'things-fall-apart', original_language: 'en', first_published_year: 1958, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['chinua-achebe'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 2009, reasons: ['racial', 'religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Things_Fall_Apart',
    },
    {
      book: { title: "Burger's Daughter", slug: 'burgers-daughter', original_language: 'en', first_published_year: 1979, ai_drafted: false, genres: ['literary-fiction', 'political-fiction'] },
      authorSlugs: ['nadine-gordimer'],
      bans: [{ cc: 'ZA', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1979, reasons: ['political'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/Burger%27s_Daughter",
    },
    {
      book: { title: 'Cry, the Beloved Country', slug: 'cry-the-beloved-country', original_language: 'en', first_published_year: 1948, ai_drafted: false, genres: ['literary-fiction', 'political-fiction'] },
      authorSlugs: ['alan-paton'],
      bans: [{ cc: 'ZA', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1960, reasons: ['political', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Cry,_the_Beloved_Country',
    },
    // ── Middle East / Asia ───────────────────────────────────────────────────
    {
      book: { title: 'The Satanic Verses', slug: 'the-satanic-verses', original_language: 'en', first_published_year: 1988, ai_drafted: false, genres: ['literary-fiction', 'magical-realism'] },
      authorSlugs: ['salman-rushdie'],
      bans: [{ cc: 'IR', scope: gov, actionType: 'banned', status: 'active', yearStarted: 1988, reasons: ['religious', 'blasphemy'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Satanic_Verses',
    },
    {
      book: { title: "Midnight's Children", slug: 'midnights-children', original_language: 'en', first_published_year: 1981, ai_drafted: false, genres: ['literary-fiction', 'magical-realism', 'historical-fiction'] },
      authorSlugs: ['salman-rushdie'],
      bans: [{ cc: 'IN', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1988, reasons: ['political'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/Midnight%27s_Children",
    },
    {
      book: { title: 'The Kite Runner', slug: 'the-kite-runner', original_language: 'en', first_published_year: 2003, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['khaled-hosseini'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 2008, reasons: ['sexual', 'violence', 'religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Kite_Runner',
    },
    {
      book: { title: 'Shame', slug: 'shame-taslima-nasrin', original_language: 'bn', first_published_year: 1993, ai_drafted: false, genres: ['literary-fiction', 'political-fiction'] },
      authorSlugs: ['taslima-nasrin'],
      bans: [{ cc: 'IN', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1993, reasons: ['religious', 'political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Lajja_(novel)',
    },
    {
      book: { title: 'Snow', slug: 'snow-orhan-pamuk', original_language: 'tr', first_published_year: 2002, ai_drafted: false, genres: ['literary-fiction', 'political-fiction'] },
      authorSlugs: ['orhan-pamuk'],
      bans: [{ cc: 'TR', scope: gov, actionType: 'challenged', status: 'historical', yearStarted: 2005, reasons: ['political', 'religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Snow_(Pamuk_novel)',
    },
    {
      book: { title: 'Children of the Alley', slug: 'children-of-the-alley', original_language: 'ar', first_published_year: 1959, ai_drafted: false, genres: ['literary-fiction', 'political-fiction'] },
      authorSlugs: ['naguib-mahfouz'],
      bans: [{ cc: 'EG', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1959, reasons: ['religious', 'blasphemy'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Children_of_the_Alley',
    },
    {
      book: { title: 'To Live', slug: 'to-live-yu-hua', original_language: 'zh', first_published_year: 1993, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['yu-hua'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1994, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/To_Live_(novel)',
    },
    {
      book: { title: 'Red Sorghum', slug: 'red-sorghum', original_language: 'zh', first_published_year: 1987, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['mo-yan'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'challenged', status: 'historical', yearStarted: 1993, reasons: ['political', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Red_Sorghum_Clan',
    },
    // ── India / South Asia ───────────────────────────────────────────────────
    {
      book: { title: 'The God of Small Things', slug: 'the-god-of-small-things', original_language: 'en', first_published_year: 1997, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['arundhati-roy'],
      bans: [{ cc: 'IN', scope: gov, actionType: 'challenged', status: 'historical', yearStarted: 1997, reasons: ['sexual', 'political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_God_of_Small_Things',
    },
    // ── Classic European ─────────────────────────────────────────────────────
    {
      book: { title: 'A Passage to India', slug: 'a-passage-to-india', original_language: 'en', first_published_year: 1924, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['e-m-forster'],
      bans: [{ cc: 'IN', scope: gov, actionType: 'challenged', status: 'historical', yearStarted: 1980, reasons: ['political', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/A_Passage_to_India',
    },
    {
      book: { title: 'Tess of the d\'Urbervilles', slug: 'tess-of-the-durbervilles', original_language: 'en', first_published_year: 1891, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['thomas-hardy'],
      bans: [{ cc: 'GB', scope: gov, actionType: 'challenged', status: 'historical', yearStarted: 1891, reasons: ['sexual', 'moral'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/Tess_of_the_d%27Urbervilles",
    },
    // ── US contemporary / YA ────────────────────────────────────────────────
    {
      book: { title: 'The Book Thief', slug: 'the-book-thief', original_language: 'en', first_published_year: 2005, ai_drafted: false, genres: ['young-adult', 'historical-fiction'] },
      authorSlugs: ['markus-zusak'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 2013, reasons: ['language', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Book_Thief',
    },
    {
      book: { title: 'Whale Talk', slug: 'whale-talk', original_language: 'en', first_published_year: 2001, ai_drafted: false, genres: ['young-adult'] },
      authorSlugs: ['chris-crutcher'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 2001, reasons: ['language', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Whale_Talk',
    },
    {
      book: { title: 'Monster', slug: 'monster-walter-dean-myers', original_language: 'en', first_published_year: 1999, ai_drafted: false, genres: ['young-adult'] },
      authorSlugs: ['walter-dean-myers'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 2001, reasons: ['language', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Monster_(Myers_novel)',
    },
    {
      book: { title: 'The Alchemist', slug: 'the-alchemist', original_language: 'pt', first_published_year: 1988, ai_drafted: false, genres: ['literary-fiction', 'fantasy'] },
      authorSlugs: ['paulo-coelho'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 2001, reasons: ['religious', 'political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Alchemist_(novel)',
    },
    // ── Ireland ──────────────────────────────────────────────────────────────
    {
      book: { title: 'Dubliners', slug: 'dubliners', original_language: 'en', first_published_year: 1914, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['james-joyce'],
      bans: [{ cc: 'IE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1941, reasons: ['sexual', 'moral'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Dubliners',
    },
    // ── Additional US challenged ─────────────────────────────────────────────
    {
      book: { title: 'Native Son', slug: 'native-son', original_language: 'en', first_published_year: 1940, ai_drafted: false, genres: ['literary-fiction', 'political-fiction'] },
      authorSlugs: ['richard-wright'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1988, reasons: ['racial', 'sexual', 'violence'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Native_Son',
    },
    {
      book: { title: 'Tobacco Road', slug: 'tobacco-road', original_language: 'en', first_published_year: 1932, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['erskine-caldwell'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1935, reasons: ['sexual', 'obscenity'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Tobacco_Road_(novel)',
    },
    {
      book: { title: 'An American Tragedy', slug: 'an-american-tragedy', original_language: 'en', first_published_year: 1925, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['theodore-dreiser'],
      bans: [{ cc: 'US', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1927, reasons: ['sexual', 'moral'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/An_American_Tragedy',
    },
    {
      book: { title: 'The Jungle', slug: 'the-jungle', original_language: 'en', first_published_year: 1906, ai_drafted: false, genres: ['literary-fiction', 'political-fiction'] },
      authorSlugs: ['upton-sinclair'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1985, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Jungle',
    },
    {
      book: { title: 'Myra Breckinridge', slug: 'myra-breckinridge', original_language: 'en', first_published_year: 1968, ai_drafted: false, genres: ['literary-fiction', 'satire'] },
      authorSlugs: ['gore-vidal'],
      bans: [{ cc: 'AU', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1968, reasons: ['sexual', 'obscenity'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Myra_Breckinridge',
    },
    // ── Carrie by Stephen King ────────────────────────────────────────────────
    {
      book: { title: 'Carrie', slug: 'carrie-stephen-king', original_language: 'en', first_published_year: 1974, ai_drafted: false, genres: ['horror', 'young-adult'] },
      authorSlugs: ['stephen-king'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 1975, reasons: ['violence', 'language', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Carrie_(novel)',
    },
  ]

  // ── Ensure 'richard-wright' author id is in the map ──────────────────────
  const rwExisting = (existingAuthors ?? []).find(a => a.slug === 'richard-wright')
  if (rwExisting) authorMap.set('richard-wright', rwExisting.id)

  // ── Check for duplicate slug in the input list itself ────────────────────
  const seenInBatch = new Set<string>()
  const deduped: NewBook[] = []
  for (const entry of books) {
    if (seenInBatch.has(entry.book.slug)) {
      console.warn(`  [dedup] skipping duplicate slug in input: ${entry.book.slug}`)
      continue
    }
    seenInBatch.add(entry.book.slug)
    deduped.push(entry)
  }

  // ── Process in batches ────────────────────────────────────────────────────
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
              const { error } = await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: reasonId(rslug) })
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

// Reasons that need to exist in the DB — check/insert if missing
async function ensureReasons() {
  const needed = [
    { slug: 'obscenity',  label_en: 'Obscenity' },
    { slug: 'language',   label_en: 'Offensive language' },
    { slug: 'violence',   label_en: 'Violence' },
    { slug: 'moral',      label_en: 'Immorality' },
    { slug: 'blasphemy',  label_en: 'Blasphemy' },
  ]
  const { data: existing } = await supabase.from('reasons').select('slug')
  const existingSlugs = new Set((existing ?? []).map(r => r.slug))
  for (const r of needed) {
    if (existingSlugs.has(r.slug)) continue
    const { error } = await supabase.from('reasons').insert({ slug: r.slug, label_en: r.label_en })
    if (error) console.warn(`  [reason upsert warn] ${r.slug}: ${error.message}`)
    else console.log(`  [reason added] ${r.slug}`)
  }
}

async function ensureExtraCountries() {
  await supabase.from('countries').upsert([
    { code: 'CS', name_en: 'Czechoslovakia', slug: 'czechoslovakia' },
    { code: 'PE', name_en: 'Peru',           slug: 'peru' },
  ], { onConflict: 'code' })
}

async function run() {
  await ensureReasons()
  await ensureExtraCountries()
  await main()
}

run().catch((err) => { console.error(err); process.exit(1) })
