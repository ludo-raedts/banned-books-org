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
    { code: 'TH', name_en: 'Thailand',     slug: 'thailand' },
    { code: 'KR', name_en: 'South Korea',  slug: 'south-korea' },
    { code: 'VN', name_en: 'Vietnam',      slug: 'vietnam' },
    { code: 'ID', name_en: 'Indonesia',    slug: 'indonesia' },
    { code: 'AF', name_en: 'Afghanistan',  slug: 'afghanistan' },
    { code: 'BD', name_en: 'Bangladesh',   slug: 'bangladesh' },
    { code: 'LK', name_en: 'Sri Lanka',    slug: 'sri-lanka' },
  ], { onConflict: 'code' })
  console.log('Countries upserted.')

  // ── Authors ────────────────────────────────────────────────────────────────
  const authorRows = [
    { slug: 'ali-dashti',             display_name: 'Ali Dashti',             birth_year: 1894, death_year: 1982 },
    { slug: 'vs-naipaul',             display_name: 'V. S. Naipaul',          birth_year: 1932, death_year: 2018 },
    { slug: 'mahatma-gandhi',         display_name: 'Mahatma Gandhi',         birth_year: 1869, death_year: 1948 },
    { slug: 'james-laine',            display_name: 'James Laine',            birth_year: 1954, death_year: null },
    { slug: 'wei-hui',                display_name: 'Wei Hui',                birth_year: 1973, death_year: null },
    { slug: 'jung-chang-halliday',    display_name: 'Jung Chang',             birth_year: 1952, death_year: null },
    { slug: 'li-zhisui',              display_name: 'Li Zhisui',              birth_year: 1919, death_year: 1995 },
    { slug: 'zhao-ziyang',            display_name: 'Zhao Ziyang',            birth_year: 1919, death_year: 2005 },
    { slug: 'yan-lianke',             display_name: 'Yan Lianke',             birth_year: 1958, death_year: null },
    { slug: 'thomas-piketty',         display_name: 'Thomas Piketty',         birth_year: 1971, death_year: null },
    { slug: 'joshua-wong',            display_name: 'Joshua Wong',            birth_year: 1996, death_year: null },
    { slug: 'vassilis-vassilikos',    display_name: 'Vassilis Vassilikos',     birth_year: 1934, death_year: null },
    { slug: 'camilo-jose-cela',       display_name: 'Camilo José Cela',       birth_year: 1916, death_year: 2002 },
    { slug: 'paul-handley',           display_name: 'Paul Handley',           birth_year: 1960, death_year: null },
    { slug: 'charlotte-bronte',       display_name: 'Charlotte Brontë',       birth_year: 1816, death_year: 1855 },
    { slug: 'elizabeth-smart',        display_name: 'Elizabeth Smart',        birth_year: 1913, death_year: 1986 },
    { slug: 'honore-de-balzac',       display_name: 'Honoré de Balzac',       birth_year: 1799, death_year: 1850 },
    { slug: 'pramoedya-ananta-toer',  display_name: 'Pramoedya Ananta Toer',  birth_year: 1925, death_year: 2006 },
    { slug: 'chen-guidi',             display_name: 'Chen Guidi',             birth_year: 1943, death_year: null },
    { slug: 'li-hongzhi',             display_name: 'Li Hongzhi',             birth_year: 1951, death_year: null },
    { slug: 'water-for-elephants',    display_name: 'Sara Gruen',             birth_year: 1969, death_year: null },
    { slug: 'sara-gruen',             display_name: 'Sara Gruen',             birth_year: 1969, death_year: null },
    { slug: 'jaswant-singh',          display_name: 'Jaswant Singh',          birth_year: 1938, death_year: 2020 },
    { slug: 'alan-moore',             display_name: 'Alan Moore',             birth_year: 1953, death_year: null },
    { slug: 'david-guterson',         display_name: 'David Guterson',         birth_year: 1956, death_year: null },
    { slug: 'chris-crutcher',         display_name: 'Chris Crutcher',         birth_year: 1946, death_year: null },
    { slug: 'walter-dean-myers-2',    display_name: 'Walter Dean Myers',      birth_year: 1937, death_year: 2014 },
    { slug: 'mildred-taylor',         display_name: 'Mildred D. Taylor',      birth_year: 1943, death_year: null },
    { slug: 'rudolfo-anaya',          display_name: 'Rudolfo Anaya',          birth_year: 1937, death_year: 2020 },
    { slug: 'barbara-kingsolver',     display_name: 'Barbara Kingsolver',     birth_year: 1955, death_year: null },
    { slug: 'frank-mccourt',          display_name: 'Frank McCourt',          birth_year: 1930, death_year: 2009 },
    { slug: 'raina-telgemeier',       display_name: 'Raina Telgemeier',       birth_year: 1977, death_year: null },
    { slug: 'daniel-keyes',           display_name: 'Daniel Keyes',           birth_year: 1927, death_year: 2014 },
    { slug: 'liam-obrien',            display_name: 'Tim O\'Brien',           birth_year: 1946, death_year: null },
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
    // ── Iran ──────────────────────────────────────────────────────────────────
    {
      book: { title: '23 Years: A Study of the Prophetic Career of Mohammad', slug: '23-years', original_language: 'fa', first_published_year: 1974, ai_drafted: false, genres: ['non-fiction'] },
      authorSlugs: ['ali-dashti'],
      bans: [{ cc: 'IR', scope: gov, actionType: 'banned', status: 'active', yearStarted: 1979, reasons: ['religious', 'blasphemy'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/23_Years:_A_Study_of_the_Prophetic_Career_of_Mohammad',
    },
    // ── India ─────────────────────────────────────────────────────────────────
    {
      book: { title: 'Hind Swaraj', slug: 'hind-swaraj', original_language: 'gu', first_published_year: 1909, ai_drafted: false, genres: ['non-fiction', 'political-fiction'] },
      authorSlugs: ['mahatma-gandhi'],
      bans: [{ cc: 'IN', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1910, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Hind_Swaraj_or_Indian_Home_Rule',
    },
    {
      book: { title: 'An Area of Darkness', slug: 'an-area-of-darkness', original_language: 'en', first_published_year: 1964, ai_drafted: false, genres: ['non-fiction', 'memoir'] },
      authorSlugs: ['vs-naipaul'],
      bans: [{ cc: 'IN', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1964, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/An_Area_of_Darkness',
    },
    {
      book: { title: 'Shivaji: Hindu King in Islamic India', slug: 'shivaji-hindu-king-in-islamic-india', original_language: 'en', first_published_year: 2003, ai_drafted: false, genres: ['non-fiction', 'historical-fiction'] },
      authorSlugs: ['james-laine'],
      bans: [{ cc: 'IN', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 2004, reasons: ['religious', 'political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Shivaji:_Hindu_King_in_Islamic_India',
    },
    // ── China ─────────────────────────────────────────────────────────────────
    {
      book: { title: 'Shanghai Baby', slug: 'shanghai-baby', original_language: 'zh', first_published_year: 1999, ai_drafted: false, genres: ['literary-fiction', 'romance'] },
      authorSlugs: ['wei-hui'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 2000, reasons: ['sexual', 'political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Shanghai_Baby',
    },
    {
      book: { title: 'Mao: The Unknown Story', slug: 'mao-the-unknown-story', original_language: 'en', first_published_year: 2005, ai_drafted: false, genres: ['non-fiction', 'historical-fiction'] },
      authorSlugs: ['jung-chang'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'active', yearStarted: 2005, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Mao:_The_Unknown_Story',
    },
    {
      book: { title: 'The Private Life of Chairman Mao', slug: 'the-private-life-of-chairman-mao', original_language: 'en', first_published_year: 1994, ai_drafted: false, genres: ['non-fiction', 'memoir'] },
      authorSlugs: ['li-zhisui'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'active', yearStarted: 1994, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Private_Life_of_Chairman_Mao',
    },
    {
      book: { title: "Prisoner of the State", slug: 'prisoner-of-the-state', original_language: 'zh', first_published_year: 2009, ai_drafted: false, genres: ['memoir', 'non-fiction'] },
      authorSlugs: ['zhao-ziyang'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'active', yearStarted: 2009, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Prisoner_of_the_State',
    },
    {
      book: { title: 'Dream of Ding Village', slug: 'dream-of-ding-village', original_language: 'zh', first_published_year: 2006, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['yan-lianke'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'active', yearStarted: 2006, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Dream_of_Ding_Village',
    },
    {
      book: { title: 'Capital and Ideology', slug: 'capital-and-ideology', original_language: 'fr', first_published_year: 2019, ai_drafted: false, genres: ['non-fiction', 'political-fiction'] },
      authorSlugs: ['thomas-piketty'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'active', yearStarted: 2019, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Capital_and_Ideology',
    },
    {
      book: { title: 'Unfree Speech', slug: 'unfree-speech', original_language: 'en', first_published_year: 2020, ai_drafted: false, genres: ['non-fiction', 'memoir'] },
      authorSlugs: ['joshua-wong'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'active', yearStarted: 2020, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Unfree_Speech',
    },
    {
      book: { title: 'Zhuan Falun', slug: 'zhuan-falun', original_language: 'zh', first_published_year: 1993, ai_drafted: false, genres: ['non-fiction'] },
      authorSlugs: ['li-hongzhi'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'active', yearStarted: 1999, reasons: ['religious'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Zhuan_Falun',
    },
    {
      book: { title: 'Will the Boat Sink the Water', slug: 'will-the-boat-sink-the-water', original_language: 'zh', first_published_year: 2004, ai_drafted: false, genres: ['non-fiction'] },
      authorSlugs: ['chen-guidi'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 2004, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Will_the_Boat_Sink_the_Water%3F',
    },
    // ── Jane Eyre banned in China ──────────────────────────────────────────────
    {
      book: { title: 'Jane Eyre', slug: 'jane-eyre', original_language: 'en', first_published_year: 1847, ai_drafted: false, genres: ['literary-fiction', 'romance', 'coming-of-age'] },
      authorSlugs: ['charlotte-bronte'],
      bans: [{ cc: 'CN', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1966, reasons: ['political', 'other'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Jane_Eyre',
    },
    // ── Spain ─────────────────────────────────────────────────────────────────
    {
      book: { title: 'The Hive', slug: 'the-hive', original_language: 'es', first_published_year: 1951, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['camilo-jose-cela'],
      bans: [{ cc: 'ES', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1936, reasons: ['political', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Hive_(Cela_novel)',
    },
    {
      book: { title: 'Homage to Catalonia', slug: 'homage-to-catalonia', original_language: 'en', first_published_year: 1938, ai_drafted: false, genres: ['non-fiction', 'memoir', 'historical-fiction'] },
      authorSlugs: ['george-orwell'],
      bans: [{ cc: 'ES', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1939, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Homage_to_Catalonia',
    },
    // ── Greece ────────────────────────────────────────────────────────────────
    {
      book: { title: 'Z', slug: 'z-vassilikos', original_language: 'el', first_published_year: 1966, ai_drafted: false, genres: ['political-fiction', 'thriller'] },
      authorSlugs: ['vassilis-vassilikos'],
      bans: [{ cc: 'GR', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1967, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Z_(novel)',
    },
    // ── Thailand ──────────────────────────────────────────────────────────────
    {
      book: { title: 'The King Never Smiles', slug: 'the-king-never-smiles', original_language: 'en', first_published_year: 2006, ai_drafted: false, genres: ['non-fiction'] },
      authorSlugs: ['paul-handley'],
      bans: [{ cc: 'TH', scope: gov, actionType: 'banned', status: 'active', yearStarted: 2006, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_King_Never_Smiles',
    },
    // ── Canada ────────────────────────────────────────────────────────────────
    {
      book: { title: 'By Grand Central Station I Sat Down and Wept', slug: 'by-grand-central-station-i-sat-down-and-wept', original_language: 'en', first_published_year: 1945, ai_drafted: false, genres: ['literary-fiction'] },
      authorSlugs: ['elizabeth-smart'],
      bans: [{ cc: 'CA', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1945, reasons: ['sexual', 'moral'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/By_Grand_Central_Station_I_Sat_Down_and_Wept',
    },
    {
      book: { title: 'Droll Stories', slug: 'droll-stories', original_language: 'fr', first_published_year: 1832, ai_drafted: false, genres: ['literary-fiction', 'satire'] },
      authorSlugs: ['honore-de-balzac'],
      bans: [{ cc: 'CA', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1914, reasons: ['sexual', 'obscenity'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Les_Cent_Contes_drolatiques',
    },
    // ── Indonesia ─────────────────────────────────────────────────────────────
    {
      book: { title: 'The Fugitive', slug: 'the-fugitive-pramoedya', original_language: 'id', first_published_year: 1950, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['pramoedya-ananta-toer'],
      bans: [{ cc: 'ID', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1965, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Pramoedya_Ananta_Toer',
    },
    // ── More US school bans ────────────────────────────────────────────────────
    {
      book: { title: 'Water for Elephants', slug: 'water-for-elephants', original_language: 'en', first_published_year: 2006, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['sara-gruen'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 2012, reasons: ['sexual', 'violence', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Water_for_Elephants',
    },
    {
      book: { title: 'Roll of Thunder, Hear My Cry', slug: 'roll-of-thunder-hear-my-cry', original_language: 'en', first_published_year: 1976, ai_drafted: false, genres: ['young-adult', 'historical-fiction'] },
      authorSlugs: ['mildred-taylor'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 1996, reasons: ['language', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Roll_of_Thunder,_Hear_My_Cry',
    },
    {
      book: { title: 'Bless Me, Ultima', slug: 'bless-me-ultima', original_language: 'en', first_published_year: 1972, ai_drafted: false, genres: ['literary-fiction', 'coming-of-age'] },
      authorSlugs: ['rudolfo-anaya'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 1981, reasons: ['sexual', 'religious', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Bless_Me,_Ultima',
    },
    {
      book: { title: "The Poisonwood Bible", slug: 'the-poisonwood-bible', original_language: 'en', first_published_year: 1998, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['barbara-kingsolver'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 2001, reasons: ['political', 'sexual', 'language'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/The_Poisonwood_Bible",
    },
    {
      book: { title: "Angela's Ashes", slug: 'angelas-ashes', original_language: 'en', first_published_year: 1996, ai_drafted: false, genres: ['memoir', 'coming-of-age'] },
      authorSlugs: ['frank-mccourt'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1997, reasons: ['sexual', 'language', 'religious'] }],
      wikiUrl: "https://en.wikipedia.org/wiki/Angela%27s_Ashes",
    },
    {
      book: { title: 'Drama', slug: 'drama-telgemeier', original_language: 'en', first_published_year: 2012, ai_drafted: false, genres: ['young-adult', 'graphic-novel'] },
      authorSlugs: ['raina-telgemeier'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 2012, reasons: ['lgbtq', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Drama_(Telgemeier)',
    },
    {
      book: { title: 'Flowers for Algernon', slug: 'flowers-for-algernon', original_language: 'en', first_published_year: 1966, ai_drafted: false, genres: ['science-fiction', 'literary-fiction'] },
      authorSlugs: ['daniel-keyes'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'active', yearStarted: 1981, reasons: ['sexual', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Flowers_for_Algernon',
    },
    {
      book: { title: 'Snow Falling on Cedars', slug: 'snow-falling-on-cedars', original_language: 'en', first_published_year: 1994, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['david-guterson'],
      bans: [{ cc: 'US', scope: school, actionType: 'challenged', status: 'historical', yearStarted: 1999, reasons: ['sexual', 'language'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Snow_Falling_on_Cedars',
    },
    {
      book: { title: 'Running Loose', slug: 'running-loose', original_language: 'en', first_published_year: 1983, ai_drafted: false, genres: ['young-adult', 'coming-of-age'] },
      authorSlugs: ['chris-crutcher'],
      bans: [{ cc: 'US', scope: school, actionType: 'banned', status: 'active', yearStarted: 1985, reasons: ['language', 'sexual'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Running_Loose',
    },
    // ── Nazi book burnings – notable individual authors ─────────────────────────
    {
      book: { title: 'The Sleepwalkers', slug: 'the-sleepwalkers-broch', original_language: 'de', first_published_year: 1932, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['stefan-zweig'],
      bans: [{ cc: 'DE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1933, reasons: ['political', 'racial'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Book_burnings_in_Nazi_Germany',
    },
    {
      book: { title: "Mother Courage and Her Children", slug: 'mother-courage-and-her-children', original_language: 'de', first_published_year: 1941, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['bertolt-brecht'],
      bans: [{ cc: 'DE', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1933, reasons: ['political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/Mother_Courage_and_Her_Children',
    },
    // ── Russia (modern) ────────────────────────────────────────────────────────
    {
      book: { title: "The Painted Bird", slug: 'the-painted-bird', original_language: 'en', first_published_year: 1965, ai_drafted: false, genres: ['literary-fiction', 'historical-fiction'] },
      authorSlugs: ['jerzy-kosinski'],
      bans: [{ cc: 'PL', scope: gov, actionType: 'banned', status: 'historical', yearStarted: 1965, reasons: ['violence', 'sexual', 'political'] }],
      wikiUrl: 'https://en.wikipedia.org/wiki/The_Painted_Bird',
    },
  ]

  // ── Deduplicate ────────────────────────────────────────────────────────────
  const seenInBatch = new Set<string>()
  const deduped: NewBook[] = []
  for (const entry of books) {
    if (seenInBatch.has(entry.book.slug)) { console.warn(`  [dedup] ${entry.book.slug}`); continue }
    seenInBatch.add(entry.book.slug)
    deduped.push(entry)
  }

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

async function ensureAuthorsAndReasons() {
  // Ensure jerzy-kosinski author exists (used in The Painted Bird)
  const { data: existing } = await supabase.from('authors').select('id, slug').eq('slug', 'jerzy-kosinski').single()
  if (!existing) {
    await supabase.from('authors').insert({ slug: 'jerzy-kosinski', display_name: 'Jerzy Kosiński', birth_year: 1933, death_year: 1991 })
  }

  // Ensure george-orwell exists (used for Homage to Catalonia)
  // It's already in the DB from seed.ts

  // Ensure stefan-zweig and bertolt-brecht exist (already in authorRows of batch1)
}

async function run() {
  await ensureAuthorsAndReasons()
  await main()
}

run().catch((err) => { console.error(err); process.exit(1) })
