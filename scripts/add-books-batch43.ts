/**
 * Batch 43 — IE, NZ, MY, VN, KR entries from CSV.
 *
 * A: Source links for existing IE bans (batch-42 + borstal-boy)
 * B: New NZ bans for existing books
 * C: Source links for existing NZ/VN bans
 * D: New books (IE, NZ, MY, VN, KR)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/add-books-batch43.ts         # dry-run
 *   npx tsx --env-file=.env.local scripts/add-books-batch43.ts --write
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

// NZ ban status: pre-1994 = historical (old IPA), 1994+ = active (FVPC Act 1993)
function nzStatus(year: number): string { return year < 1994 ? 'historical' : 'active' }

function nzBanDesc(year: number): string {
  if (year < 1994) return `Classified as objectionable under the New Zealand Indecent Publications Act 1963. The Act was superseded by the Films, Videos, and Publications Classification Act 1993; classification status treated as historical.`
  return `Classified as objectionable by the New Zealand Office of Film and Literature Classification under the Films, Videos, and Publications Classification Act 1993.`
}

async function main() {
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const { data: existingBooks } = await supabase.from('books').select('id, slug')
  const { data: existingAuthors } = await supabase.from('authors').select('id, slug')

  const scopeId = (slug: string) => scopes!.find(s => s.slug === slug)!.id as number
  const reasonId = (slug: string) => {
    const r = reasons!.find(r => r.slug === slug)
    if (!r) throw new Error(`Reason not found: ${slug}`)
    return r.id as number
  }
  const gov = scopeId('government')

  const bookMap = new Map((existingBooks ?? []).map(b => [b.slug, b.id as number]))
  const authorMap = new Map((existingAuthors ?? []).map(a => [a.slug, a.id as number]))

  // ── Ensure countries ────────────────────────────────────────────────────────
  if (WRITE) {
    await supabase.from('countries').upsert([
      { code: 'IE', name_en: 'Ireland',     slug: 'ireland' },
      { code: 'NZ', name_en: 'New Zealand', slug: 'new-zealand' },
      { code: 'MY', name_en: 'Malaysia',    slug: 'malaysia' },
      { code: 'VN', name_en: 'Vietnam',     slug: 'vietnam' },
      { code: 'KR', name_en: 'South Korea', slug: 'south-korea' },
    ], { onConflict: 'code' })
    console.log('Countries upserted.\n')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION A — Source links for existing IE bans
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('=== Section A: IE source links ===')

  const ieSrc1 = 'https://www.oireachtas.ie/en/debates/question/2025-04-01/574/'
  const ieSrc2 = 'https://www.oireachtas.ie/en/debates/question/2025-04-09/174/'
  const ieSrc3 = 'https://pennyspoetry.fandom.com/wiki/List_of_books_banned_by_governments'

  const ieBanLinks: Array<{ bookSlug: string; sourceUrl: string }> = [
    { bookSlug: 'the-raped-little-runaway',          sourceUrl: ieSrc1 },
    { bookSlug: 'abortion-internationally',           sourceUrl: ieSrc2 },
    { bookSlug: 'abortion-our-struggle-for-control',  sourceUrl: ieSrc2 },
    { bookSlug: 'abortion-right-or-wrong',            sourceUrl: ieSrc2 },
    { bookSlug: 'how-to-drive-your-man-wild-in-bed',  sourceUrl: ieSrc2 },
    { bookSlug: 'borstal-boy',                        sourceUrl: ieSrc3 },
  ]

  const srcIdOireachtas1 = await upsertSource(ieSrc1, 'Oireachtas - Parliamentary Debates', 'government')
  const srcIdOireachtas2 = await upsertSource(ieSrc2, 'Oireachtas - Parliamentary Debates', 'government')
  const srcIdFandom      = await upsertSource(ieSrc3, 'Governments\' Banned Books (Fan Wiki)', 'web')

  const srcMap: Record<string, number | null> = {
    [ieSrc1]: srcIdOireachtas1,
    [ieSrc2]: srcIdOireachtas2,
    [ieSrc3]: srcIdFandom,
  }

  for (const { bookSlug, sourceUrl } of ieBanLinks) {
    const bookId = bookMap.get(bookSlug)
    if (!bookId) { console.log(`  [skip] book not found: ${bookSlug}`); continue }
    const { data: ban } = await supabase.from('bans').select('id').eq('book_id', bookId).eq('country_code', 'IE').maybeSingle()
    if (!ban) { console.log(`  [skip] no IE ban for: ${bookSlug}`); continue }
    console.log(`  [${bookSlug}] → source link`)
    const sid = srcMap[sourceUrl]
    if (sid) await linkBanToSource(ban.id, sid)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION B — New NZ bans for existing books
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== Section B: New NZ bans for existing books ===')

  const fyiUrl = 'https://fyi.org.nz/request/14169-list-of-banned-books'
  const srcIdFyi = await upsertSource(fyiUrl, 'FYI.org.nz - New Zealand Official Information', 'government')

  const newNzBans: Array<{ bookSlug: string; year: number; reasons: string[] }> = [
    { bookSlug: 'nana-zola',              year: 1890, reasons: ['sexual'] },
    { bookSlug: 'married-love',           year: 1918, reasons: ['sexual'] },
    { bookSlug: 'the-well-of-loneliness', year: 1929, reasons: ['sexual'] },
    { bookSlug: 'the-decameron',          year: 1939, reasons: ['sexual'] },
    { bookSlug: 'lady-chatterleys-lover', year: 1928, reasons: ['sexual'] },
    { bookSlug: 'the-communist-manifesto',year: 1942, reasons: ['political'] },
    { bookSlug: 'one-thousand-and-one-nights', year: 1920, reasons: ['sexual'] },
    { bookSlug: 'american-psycho',        year: 1991, reasons: ['sexual', 'violence'] },
  ]

  for (const item of newNzBans) {
    const bookId = bookMap.get(item.bookSlug)
    if (!bookId) { console.log(`  [skip] book not found: ${item.bookSlug}`); continue }

    const { data: existingBan } = await supabase.from('bans')
      .select('id').eq('book_id', bookId).eq('country_code', 'NZ').maybeSingle()
    if (existingBan) {
      console.log(`  [exists] NZ ban for ${item.bookSlug}, adding source link`)
      if (srcIdFyi) await linkBanToSource(existingBan.id, srcIdFyi)
      continue
    }

    const status = nzStatus(item.year)
    console.log(`  [${item.bookSlug}] NZ ban (${item.year}, ${status})`)
    if (!WRITE) continue

    const { data: banRow, error: banErr } = await supabase.from('bans').insert({
      book_id: bookId,
      country_code: 'NZ',
      scope_id: gov,
      action_type: 'banned',
      status,
      year_started: item.year,
      description: nzBanDesc(item.year),
    }).select('id').single()

    if (banErr || !banRow) { console.error(`  ✗ ban insert: ${banErr?.message}`); continue }
    for (const rSlug of item.reasons) {
      await supabase.from('ban_reason_links').insert({ ban_id: banRow.id, reason_id: reasonId(rSlug) })
    }
    if (srcIdFyi) await linkBanToSource(banRow.id, srcIdFyi)
    console.log(`  ✓ done`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION C — Source links for existing NZ/VN bans
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== Section C: Source links for existing NZ/VN bans ===')

  const rfaUrl = 'https://www.rfa.org/english/news/vietnam/books-05232018144944.html'
  const srcIdRfa = await upsertSource(rfaUrl, 'Radio Free Asia', 'news')

  const existingSrcLinks: Array<{ bookSlug: string; cc: string; sourceId: number | null }> = [
    { bookSlug: 'the-anarchist-cookbook',     cc: 'NZ', sourceId: srcIdFyi },
    { bookSlug: 'the-peaceful-pill-handbook', cc: 'NZ', sourceId: srcIdFyi },
    { bookSlug: 'politics-for-everyone',      cc: 'VN', sourceId: srcIdRfa },
  ]

  for (const { bookSlug, cc, sourceId } of existingSrcLinks) {
    const bookId = bookMap.get(bookSlug)
    if (!bookId || !sourceId) { console.log(`  [skip] ${bookSlug}`); continue }
    const { data: ban } = await supabase.from('bans').select('id').eq('book_id', bookId).eq('country_code', cc).maybeSingle()
    if (!ban) { console.log(`  [skip] no ${cc} ban: ${bookSlug}`); continue }
    console.log(`  [${bookSlug}] ${cc} source link`)
    await linkBanToSource(ban.id, sourceId)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION D — New authors
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== Section D: New authors ===')

  const newAuthors: Array<{ slug: string; display_name: string; birth_year: number | null; death_year: number | null }> = [
    { slug: 'liam-o-flaherty',         display_name: 'Liam O\'Flaherty',           birth_year: 1896, death_year: 1984 },
    { slug: 'victoria-cross',          display_name: 'Victoria Cross',             birth_year: 1868, death_year: 1952 },
    { slug: 'sigmund-freud',           display_name: 'Sigmund Freud',              birth_year: 1856, death_year: 1939 },
    { slug: 'richard-francis-burton',  display_name: 'Richard Francis Burton',     birth_year: 1821, death_year: 1890 },
    { slug: 'g-hardy',                 display_name: 'G. Hardy',                   birth_year: null,  death_year: null },
    { slug: 'gertie-wentworth-james',  display_name: 'Gertie de S. Wentworth-James', birth_year: null, death_year: null },
    { slug: 'jean-devanny',            display_name: 'Jean Devanny',               birth_year: 1894, death_year: 1962 },
    { slug: 'emile-burns',             display_name: 'Emile Burns',                birth_year: 1889, death_year: 1972 },
    { slug: 'guy-fitch-phelps',        display_name: 'Guy Fitch Phelps',           birth_year: null,  death_year: null },
    { slug: 'vyacheslav-molotov',      display_name: 'Vyacheslav Molotov',         birth_year: 1890, death_year: 1986 },
    { slug: 'j-r-campbell',            display_name: 'J. R. Campbell',             birth_year: 1894, death_year: 1969 },
    { slug: 'steven-macgregor',        display_name: 'Steven MacGregor',           birth_year: null,  death_year: null },
    { slug: 'arthur-ponsonby',         display_name: 'Arthur Ponsonby',            birth_year: 1871, death_year: 1946 },
    { slug: 'mel-frank',               display_name: 'Mel Frank',                  birth_year: null,  death_year: null },
    { slug: 'ed-rosenthal',            display_name: 'Ed Rosenthal',               birth_year: 1944, death_year: null },
    { slug: 'alex-comfort',            display_name: 'Alex Comfort',               birth_year: 1920, death_year: 2000 },
    { slug: 'david-oliver-cauldwell',  display_name: 'David Oliver Cauldwell',     birth_year: 1897, death_year: 1959 },
    { slug: 'simon-ffuckes',           display_name: 'Simon Ffuckes',              birth_year: null,  death_year: null },
    { slug: 'john-lobell',             display_name: 'John Lobell',                birth_year: null,  death_year: null },
    { slug: 'mimi-lobell',             display_name: 'Mimi Lobell',                birth_year: null,  death_year: null },
    { slug: 'joy-laurey',              display_name: 'Joy Laurey',                 birth_year: null,  death_year: null },
    { slug: 'richard-f-stratton',      display_name: 'Richard F. Stratton',        birth_year: null,  death_year: null },
    { slug: 'milo-manara',             display_name: 'Milo Manara',                birth_year: 1945, death_year: null },
    { slug: 'alina-reyes',             display_name: 'Alina Reyes',                birth_year: 1956, death_year: null },
    { slug: 'jim-hogshire',            display_name: 'Jim Hogshire',               birth_year: null,  death_year: null },
    { slug: 'paul-stamets',            display_name: 'Paul Stamets',               birth_year: 1955, death_year: null },
    { slug: 'uncle-fester',            display_name: 'Uncle Fester',               birth_year: null,  death_year: null },
    // Malaysia
    { slug: 'matthew-s-gordon',        display_name: 'Matthew S. Gordon',          birth_year: null,  death_year: null },
    { slug: 'trudie-crawford',         display_name: 'Trudie Crawford',            birth_year: null,  death_year: null },
    { slug: 'bobby-s-sayyid',          display_name: 'Bobby S. Sayyid',            birth_year: null,  death_year: null },
    { slug: 'anis-shorrosh',           display_name: 'Anis Shorrosh',              birth_year: 1932, death_year: 2015 },
    { slug: 'john-l-esposito',         display_name: 'John L. Esposito',           birth_year: null,  death_year: null },
    { slug: 'christine-mallouhi',      display_name: 'Christine Mallouhi',         birth_year: null,  death_year: null },
    { slug: 'karen-armstrong',         display_name: 'Karen Armstrong',            birth_year: 1944, death_year: null },
    { slug: 'lora-leigh',              display_name: 'Lora Leigh',                 birth_year: null,  death_year: null },
    { slug: 'kamaludin-endol',         display_name: 'Kamaludin Endol',            birth_year: null,  death_year: null },
    { slug: 'amber-stephens',          display_name: 'Amber Stephens',             birth_year: null,  death_year: null },
    { slug: 'asghar-ali-engineer',     display_name: 'Asghar Ali Engineer',        birth_year: 1939, death_year: 2013 },
    { slug: 'jalaluddin-rakhmat',      display_name: 'Jalaluddin Rakhmat',         birth_year: 1949, death_year: 2021 },
    { slug: 'komaruddin-hidayat',      display_name: 'Komaruddin Hidayat',         birth_year: 1953, death_year: null },
    { slug: 'f-w-burleigh',            display_name: 'F. W. Burleigh',             birth_year: null,  death_year: null },
    { slug: 'boon-lin-ngeo',           display_name: 'Boon Lin Ngeo',              birth_year: null,  death_year: null },
    { slug: 'kean-wong',               display_name: 'Kean Wong',                  birth_year: null,  death_year: null },
    { slug: 'robin-smalls',            display_name: 'Robin Smalls',               birth_year: null,  death_year: null },
    { slug: 'benz-ali',                display_name: 'Benz Ali',                   birth_year: null,  death_year: null },
    { slug: 'shamsiah-fakeh',          display_name: 'Shamsiah Fakeh',             birth_year: 1924, death_year: 2008 },
    // Vietnam
    { slug: 'duc-huy',                 display_name: 'Huy Đức',                    birth_year: null,  death_year: null },
    { slug: 'ngoc-tan-bui',            display_name: 'Bùi Ngọc Tấn',              birth_year: 1934, death_year: 2018 },
    // Korea
    { slug: 'noam-chomsky',            display_name: 'Noam Chomsky',               birth_year: 1928, death_year: null },
    { slug: 'ha-joon-chang',           display_name: 'Ha-Joon Chang',              birth_year: 1963, death_year: null },
    { slug: 'gi-yeong-hyeon',          display_name: 'Hyeon Gi-yeong',             birth_year: 1956, death_year: null },
    { slug: 'hans-peter-martin',       display_name: 'Hans-Peter Martin',          birth_year: 1957, death_year: null },
    { slug: 'theodor-storm',           display_name: 'Theodor Storm',              birth_year: 1817, death_year: 1888 },
    { slug: 'gyeong-jin-shin',         display_name: 'Shin Gyeong-jin',            birth_year: 1963, death_year: null },
    { slug: 'inti-chavez-perez',       display_name: 'Inti Chávez Pérez',          birth_year: null,  death_year: null },
  ]

  for (const row of newAuthors) {
    if (authorMap.has(row.slug)) { console.log(`  [exists] ${row.slug}`); continue }
    console.log(`  [new author] ${row.slug}`)
    if (!WRITE) continue
    const { data, error } = await supabase.from('authors').insert({
      slug: row.slug,
      display_name: row.display_name,
      birth_year: row.birth_year,
      death_year: row.death_year,
    }).select('id').single()
    if (error) { console.warn(`  [warn] ${row.slug}: ${error.message}`); continue }
    authorMap.set(row.slug, data.id)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION E — New books
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== Section E: New books ===')

  type BanSpec = {
    cc: string; year: number; yearEnded?: number | null; status: string
    actionType?: string; reasons: string[]; description: string; sourceUrl?: string
  }
  type BookSpec = {
    slug: string; title: string; lang: string; year: number | null
    genres: string[]; description_ban: string
    authors: string[]; bans: BanSpec[]
  }

  // Source URLs used in book bans
  const SRC = {
    fyi:         'https://fyi.org.nz/request/14169-list-of-banned-books',
    irishtimes:  'https://www.irishtimes.com/news/state-s-first-banned-book-to-be-published-for-first-time-in-80-years-1.1425131',
    article19a:  'https://www.article19.org/data/files/pdfs/press/malaysia-18-books-banned.pdf',
    article19b:  'https://www.europeanproceedings.com/article/10.15405/epsbs.2019.10.21',
    article19c:  'https://www.article19.org/resources/malaysia-repeal-the-printing-presses-and-publication-act/',
    article19d:  'https://www.article19.org/resources/malaysia-reverse-ban-and-repeal-printing-presses-and-publications-act/',
    malaymail1:  'https://www.malaymail.com/news/malaysia/2024/01/04/why-court-of-appeal-upheld-gay-is-ok-book-ban-in-2-1-decision/110267',
    malaymail2:  'https://www.malaymail.com/news/malaysia/2020/07/01/home-ministry-bans-book-with-insulting-cover-of-modified-malaysian-coat-of/1880644',
    focusmy:     'https://focusmalaysia.my/unity-govt-bans-its-first-3-books-over-immorality-lbgt-content/',
    rfa:         'https://www.rfa.org/english/news/vietnam/books-05232018144944.html',
    hrcommission:'https://humanrightscommission.house.gov/DFP/Countries/Vietnam/Pham-Doan-Trang',
    apnews:      'https://apnews.com/article/4fca31e2d333865d706841b097a6f603',
    wiki:        'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments',
    koreatimes1: 'https://www.koreatimes.co.kr/southkorea/20101028/ban-on-seditious-books-in-barracks-constitutional',
    koreatimes2: 'https://www.koreatimes.co.kr/southkorea/20080731/military-under-fire-for-banning-books-to-soldiers',
  }

  // Lazy source ID cache
  const srcIdCache = new Map<string, number | null>()
  async function getSourceId(url: string): Promise<number | null> {
    if (srcIdCache.has(url)) return srcIdCache.get(url)!
    const names: Record<string, [string, string]> = {
      [SRC.fyi]:          ['FYI.org.nz - New Zealand Official Information', 'government'],
      [SRC.irishtimes]:   ['Irish Times', 'news'],
      [SRC.article19a]:   ['ARTICLE 19', 'ngo'],
      [SRC.article19b]:   ['European Proceedings (Academic)', 'web'],
      [SRC.article19c]:   ['ARTICLE 19', 'ngo'],
      [SRC.article19d]:   ['ARTICLE 19', 'ngo'],
      [SRC.malaymail1]:   ['Malay Mail', 'news'],
      [SRC.malaymail2]:   ['Malay Mail', 'news'],
      [SRC.focusmy]:      ['Focus Malaysia', 'news'],
      [SRC.rfa]:          ['Radio Free Asia', 'news'],
      [SRC.hrcommission]: ['US Congressional Human Rights Commission', 'government'],
      [SRC.apnews]:       ['Associated Press', 'news'],
      [SRC.wiki]:         ['Wikipedia', 'web'],
      [SRC.koreatimes1]:  ['Korea Times', 'news'],
      [SRC.koreatimes2]:  ['Korea Times', 'news'],
    }
    const [name, type] = names[url] ?? ['Unknown', 'web']
    const id = await upsertSource(url, name, type)
    srcIdCache.set(url, id)
    return id
  }

  // ── IE ─────────────────────────────────────────────────────────────────────
  const IE_BOOKS: BookSpec[] = [
    {
      slug: 'the-house-of-gold', title: 'The House of Gold',
      lang: 'en', year: 1929, genres: ['fiction'],
      description_ban: `Liam O'Flaherty's second novel, banned in Ireland under the Censorship of Publications Act 1929 — the first year the Act was in operation. The novel depicts the moral corruption of a wealthy Galway family. It was not published in Ireland for over eighty years; a new Irish edition appeared in 2013.`,
      authors: ['liam-o-flaherty'],
      bans: [{ cc: 'IE', year: 1929, status: 'historical', reasons: ['sexual', 'moral'],
        description: `Prohibited under the Censorship of Publications Act 1929. One of the earliest books banned under Ireland's new censorship regime. A new Irish edition was published in 2013.`,
        sourceUrl: SRC.irishtimes }],
    },
  ]

  // ── NZ ─────────────────────────────────────────────────────────────────────
  const NZ_BOOKS: BookSpec[] = [
    {
      slug: 'five-nights', title: 'Five Nights',
      lang: 'en', year: 1908, genres: ['fiction'],
      description_ban: `Victoria Cross's 1908 novel, banned in New Zealand as objectionable under the Indecent Publications Act 1963. Cross was a prolific popular novelist whose frank depictions of female desire attracted censorship in multiple jurisdictions.`,
      authors: ['victoria-cross'],
      bans: [{ cc: 'NZ', year: 1908, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1908), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'six-women', title: 'Six Women',
      lang: 'en', year: 1908, genres: ['fiction'],
      description_ban: `Victoria Cross's 1908 novel, banned in New Zealand as objectionable under the Indecent Publications Act 1963. One of several Cross titles prohibited in New Zealand during the same period.`,
      authors: ['victoria-cross'],
      bans: [{ cc: 'NZ', year: 1908, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1908), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'the-yoke', title: 'The Yoke',
      lang: 'en', year: 1907, genres: ['fiction'],
      description_ban: `Victoria Cross's novel, banned in New Zealand as objectionable under the Indecent Publications Act 1963. Cross, the pen name of Annie Sophie Cory, wrote extensively about women's sexuality at a time when such writing was routinely suppressed.`,
      authors: ['victoria-cross'],
      bans: [{ cc: 'NZ', year: 1908, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1908), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'the-interpretation-of-dreams', title: 'The Interpretation of Dreams',
      lang: 'de', year: 1899, genres: ['non-fiction', 'psychology'],
      description_ban: `Sigmund Freud's 1899 foundational work of psychoanalysis, prohibited in New Zealand under the Indecent Publications Act 1963, presumably on grounds relating to its frank analysis of sexual symbolism in dreams. The ban is among the most widely noted examples of scientific literature suppressed under broad obscenity provisions.`,
      authors: ['sigmund-freud'],
      bans: [{ cc: 'NZ', year: 1899, status: 'historical', reasons: ['other'], description: nzBanDesc(1899), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'the-perfumed-garden', title: 'The Perfumed Garden',
      lang: 'ar', year: 1886, genres: ['non-fiction'],
      description_ban: `Richard Francis Burton's 1886 English translation of the 15th-century Arabic erotic manual by Muhammad ibn Muhammad al-Nafzawi, banned in New Zealand as objectionable under the Indecent Publications Act 1963 for explicit sexual content.`,
      authors: ['richard-francis-burton'],
      bans: [{ cc: 'NZ', year: 1886, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1886), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'wise-parenthood', title: 'Wise Parenthood',
      lang: 'en', year: 1918, genres: ['non-fiction'],
      description_ban: `Marie Stopes's 1918 guide to birth control methods, banned in New Zealand as objectionable under the Indecent Publications Act 1963. Stopes's pioneering work on contraception was suppressed in multiple countries as governments sought to restrict access to practical sexual health information.`,
      authors: ['marie-stopes'],
      bans: [{ cc: 'NZ', year: 1918, status: 'historical', reasons: ['sexual', 'moral'], description: nzBanDesc(1918), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'how-to-prevent-pregnancy', title: 'How to Prevent Pregnancy',
      lang: 'en', year: 1921, genres: ['non-fiction'],
      description_ban: `A 1921 birth control pamphlet or guide banned in New Zealand under the Indecent Publications Act 1963. Practical guides to contraception were routinely suppressed in the early 20th century as obscene or immoral.`,
      authors: ['g-hardy'],
      bans: [{ cc: 'NZ', year: 1921, status: 'historical', reasons: ['sexual', 'moral'], description: nzBanDesc(1921), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'over-lifes-edge', title: "Over Life's Edge",
      lang: 'en', year: 1921, genres: ['fiction'],
      description_ban: `Victoria Cross's 1921 novel, banned in New Zealand as objectionable under the Indecent Publications Act 1963. One of several Cross titles prohibited in New Zealand across different decades.`,
      authors: ['victoria-cross'],
      bans: [{ cc: 'NZ', year: 1921, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1921), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'sylvias-marriage', title: "Sylvia's Marriage",
      lang: 'en', year: 1914, genres: ['fiction'],
      description_ban: `Upton Sinclair's 1914 novel dealing with venereal disease and its effects on a marriage, banned in New Zealand as objectionable under the Indecent Publications Act 1963 for its frank treatment of sexual health.`,
      authors: ['upton-sinclair'],
      bans: [{ cc: 'NZ', year: 1921, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1921), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'la-vie-parisienne', title: 'La Vie Parisienne',
      lang: 'fr', year: null, genres: ['non-fiction'],
      description_ban: `A French illustrated magazine and its collected editions, banned in New Zealand in 1921 as objectionable under the Indecent Publications Act 1963 for erotic illustrations and content.`,
      authors: ['anonymous'],
      bans: [{ cc: 'NZ', year: 1921, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1921), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'the-thing-wentworth-james', title: 'The Thing',
      lang: 'en', year: 1921, genres: ['fiction'],
      description_ban: `Gertie de S. Wentworth-James's novel, banned in New Zealand as objectionable under the Indecent Publications Act 1963 for sexual content.`,
      authors: ['gertie-wentworth-james'],
      bans: [{ cc: 'NZ', year: 1921, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1921), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'safe-marriage', title: 'Safe Marriage',
      lang: 'en', year: 1922, genres: ['non-fiction'],
      description_ban: `Ettie Rout's 1922 guide to sexual health and contraception within marriage, banned in New Zealand under the Indecent Publications Act 1963. Rout was a New Zealand social reformer who had campaigned for soldiers' sexual health during the First World War; her frank writing was suppressed at home despite her international reputation.`,
      authors: ['ettie-rout'],
      bans: [{ cc: 'NZ', year: 1923, status: 'historical', reasons: ['sexual', 'moral'], description: nzBanDesc(1923), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'the-butcher-shop', title: 'The Butcher Shop',
      lang: 'en', year: 1926, genres: ['fiction'],
      description_ban: `Jean Devanny's 1926 debut novel, banned in New Zealand as objectionable under the Indecent Publications Act 1963. The novel's frank depiction of sexuality and its socialist critique of marriage made it controversial; it was also banned in the UK, Australia, and Germany. The New Zealand-born Devanny went on to become a prominent communist writer in Australia.`,
      authors: ['jean-devanny'],
      bans: [{ cc: 'NZ', year: 1926, status: 'historical', reasons: ['sexual', 'moral'], description: nzBanDesc(1926), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'a-handbook-of-marxism', title: 'A Handbook of Marxism',
      lang: 'en', year: 1935, genres: ['non-fiction', 'political'],
      description_ban: `Emile Burns's 1935 anthology of Marxist writings, banned in New Zealand during the Second World War as seditious or politically dangerous under the Indecent Publications Act. Part of a wave of left-wing and communist publications prohibited in New Zealand in the late 1930s and 1940s.`,
      authors: ['emile-burns'],
      bans: [{ cc: 'NZ', year: 1935, status: 'historical', reasons: ['political'], description: nzBanDesc(1935), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'the-hindu-art-of-love', title: 'The Hindu Art of Love',
      lang: 'en', year: null, genres: ['non-fiction'],
      description_ban: `An English-language compilation or translation of Hindu erotic texts, banned in New Zealand in 1929 as objectionable under the Indecent Publications Act 1963 for explicit sexual content.`,
      authors: ['anonymous'],
      bans: [{ cc: 'NZ', year: 1929, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1929), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'the-black-prophet', title: 'The Black Prophet',
      lang: 'en', year: 1918, genres: ['fiction', 'political'],
      description_ban: `Guy Fitch Phelps's novel, banned in New Zealand as politically dangerous under wartime provisions or the Indecent Publications Act. Classified during a period of heightened suppression of anti-war and radical political literature in New Zealand.`,
      authors: ['guy-fitch-phelps'],
      bans: [{ cc: 'NZ', year: 1918, status: 'historical', reasons: ['political'], description: nzBanDesc(1918), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'soviet-foreign-policy-finland', title: 'Soviet Foreign Policy: The Meaning of the War in Finland',
      lang: 'en', year: 1940, genres: ['non-fiction', 'political'],
      description_ban: `A 1940 pamphlet by Soviet Foreign Minister Vyacheslav Molotov justifying the Winter War against Finland, banned in New Zealand during the Second World War as pro-Soviet propaganda. Part of a wave of communist and Soviet publications prohibited under wartime censorship.`,
      authors: ['vyacheslav-molotov'],
      bans: [{ cc: 'NZ', year: 1940, status: 'historical', reasons: ['political'], description: nzBanDesc(1940), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'questions-and-answers-on-communism', title: 'Questions and Answers on Communism',
      lang: 'en', year: 1940, genres: ['non-fiction', 'political'],
      description_ban: `A Communist Party of Great Britain educational pamphlet by J. R. Campbell, banned in New Zealand during the Second World War as seditious communist literature.`,
      authors: ['j-r-campbell'],
      bans: [{ cc: 'NZ', year: 1941, status: 'historical', reasons: ['political'], description: nzBanDesc(1941), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'truth-and-mr-chamberlain', title: 'Truth and Mr Chamberlain',
      lang: 'en', year: 1939, genres: ['non-fiction', 'political'],
      description_ban: `A pamphlet banned in New Zealand during the Second World War, criticising the British policy of appeasement associated with Neville Chamberlain. Suppressed under wartime censorship as potentially demoralising or politically subversive.`,
      authors: ['steven-macgregor'],
      bans: [{ cc: 'NZ', year: 1941, status: 'historical', reasons: ['political'], description: nzBanDesc(1941), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'falsehood-in-war-time', title: 'Falsehood in War-Time',
      lang: 'en', year: 1928, genres: ['non-fiction', 'political'],
      description_ban: `Arthur Ponsonby's 1928 study of propaganda and official lies during the First World War, banned in New Zealand during the Second World War as potentially demoralising to the war effort. The book is now considered a foundational text on wartime propaganda.`,
      authors: ['arthur-ponsonby'],
      bans: [{ cc: 'NZ', year: 1940, status: 'historical', reasons: ['political'], description: nzBanDesc(1940), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'marijuana-growers-guide', title: "Marijuana Grower's Guide",
      lang: 'en', year: 1974, genres: ['non-fiction'],
      description_ban: `Mel Frank and Ed Rosenthal's 1974 guide to cannabis cultivation, banned in New Zealand as objectionable under the Films, Videos, and Publications Classification Act 1993 for content that promotes or facilitates illegal drug use.`,
      authors: ['mel-frank', 'ed-rosenthal'],
      bans: [{ cc: 'NZ', year: 1978, status: 'historical', reasons: ['other', 'drugs'], description: nzBanDesc(1978), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'the-joy-of-sex', title: 'The Joy of Sex',
      lang: 'en', year: 1972, genres: ['non-fiction'],
      description_ban: `Alex Comfort's 1972 illustrated sexual self-help guide, one of the bestselling books of the 1970s, banned in New Zealand as objectionable under the Indecent Publications Act 1963 for explicit sexual content and illustrations. Widely suppressed in conservative jurisdictions despite its mainstream commercial success.`,
      authors: ['alex-comfort'],
      bans: [{ cc: 'NZ', year: 1975, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1975), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'more-joy-of-sex', title: 'More Joy of Sex',
      lang: 'en', year: 1973, genres: ['non-fiction'],
      description_ban: `The sequel to The Joy of Sex, banned in New Zealand as objectionable under the Indecent Publications Act 1963 for explicit sexual content.`,
      authors: ['anonymous'],
      bans: [{ cc: 'NZ', year: 1976, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1976), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'intimate-embrace', title: 'Intimate Embrace',
      lang: 'en', year: null, genres: ['non-fiction'],
      description_ban: `A publication by David Oliver Cauldwell, banned in New Zealand under the Indecent Publications Act 1963 for explicit sexual content.`,
      authors: ['david-oliver-cauldwell'],
      bans: [{ cc: 'NZ', year: 1975, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1975), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'snatches-and-lays', title: 'Snatches and Lays',
      lang: 'en', year: 1975, genres: ['fiction'],
      description_ban: `A collection of bawdy verse published under the joint pseudonyms Sebastian Hogbotel and Simon Ffuckes, banned in New Zealand as objectionable under the Indecent Publications Act 1963 for explicit sexual content.`,
      authors: ['simon-ffuckes'],
      bans: [{ cc: 'NZ', year: 1975, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1975), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'john-and-mimi', title: 'John and Mimi',
      lang: 'en', year: 1972, genres: ['non-fiction'],
      description_ban: `John and Mimi Lobell's candid account of their open relationship, banned in New Zealand as objectionable under the Indecent Publications Act 1963 for explicit sexual content.`,
      authors: ['john-lobell', 'mimi-lobell'],
      bans: [{ cc: 'NZ', year: 1975, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1975), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'joy-laurey', title: 'Joy',
      lang: 'en', year: null, genres: ['fiction'],
      description_ban: `Joy Laurey's 1987 publication, banned in New Zealand as objectionable under the Indecent Publications Act 1963 for explicit sexual content.`,
      authors: ['joy-laurey'],
      bans: [{ cc: 'NZ', year: 1987, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1987), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'world-of-american-pit-bull-terrier', title: 'The World of the American Pit Bull Terrier',
      lang: 'en', year: 1983, genres: ['non-fiction'],
      description_ban: `Richard F. Stratton's guide to American pit bull terriers, banned in New Zealand as objectionable under the Films, Videos, and Publications Classification Act 1993, likely on grounds that it facilitates illegal dog fighting or promotes dangerous breeds.`,
      authors: ['richard-f-stratton'],
      bans: [{ cc: 'NZ', year: 1991, status: 'historical', reasons: ['other'], description: nzBanDesc(1991), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'click-manara', title: 'Click',
      lang: 'it', year: 1983, genres: ['graphic-novel'],
      description_ban: `Milo Manara's 1983 Italian erotic graphic novel, banned in New Zealand as objectionable under the Films, Videos, and Publications Classification Act 1993 for explicit sexual content. Manara is one of the most internationally recognised names in erotic comics.`,
      authors: ['milo-manara'],
      bans: [{ cc: 'NZ', year: 1991, status: 'historical', reasons: ['sexual'], description: nzBanDesc(1991), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'boobytraps', title: 'Boobytraps',
      lang: 'en', year: 1965, genres: ['non-fiction'],
      description_ban: `A US Army field manual on the construction and use of booby traps, banned in New Zealand as objectionable under the Films, Videos, and Publications Classification Act 1993 on grounds that it provides technical instructions for causing harm.`,
      authors: ['anonymous'],
      bans: [{ cc: 'NZ', year: 1991, status: 'historical', reasons: ['other'], description: nzBanDesc(1991), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'diva-obsexion', title: 'Diva Obsexion',
      lang: 'it', year: 1995, genres: ['graphic-novel'],
      description_ban: `An Italian erotic graphic novel, banned in New Zealand as objectionable under the Films, Videos, and Publications Classification Act 1993 for explicit sexual content.`,
      authors: ['anonymous'],
      bans: [{ cc: 'NZ', year: 1995, status: 'active', reasons: ['sexual'], description: nzBanDesc(1995), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'the-great-big-narcotics-cookbook', title: 'The Great Big Narcotics Cookbook',
      lang: 'en', year: 1991, genres: ['non-fiction'],
      description_ban: `Banned in New Zealand as objectionable under the Films, Videos, and Publications Classification Act 1993 on grounds that it provides instructions for the manufacture of illegal drugs.`,
      authors: ['anonymous'],
      bans: [{ cc: 'NZ', year: 1995, status: 'active', reasons: ['other', 'drugs'], description: nzBanDesc(1995), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'behind-closed-doors-reyes', title: 'Behind Closed Doors',
      lang: 'fr', year: 1994, genres: ['fiction'],
      description_ban: `Alina Reyes's erotic novel, banned in New Zealand as objectionable under the Films, Videos, and Publications Classification Act 1993 for explicit sexual content.`,
      authors: ['alina-reyes'],
      bans: [{ cc: 'NZ', year: 1996, status: 'active', reasons: ['sexual'], description: nzBanDesc(1996), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'the-seventh-acolyte-reader', title: 'The Seventh Acolyte Reader',
      lang: 'en', year: null, genres: ['non-fiction'],
      description_ban: `Banned in New Zealand as objectionable under the Films, Videos, and Publications Classification Act 1993 for explicit sexual content.`,
      authors: ['anonymous'],
      bans: [{ cc: 'NZ', year: 1996, status: 'active', reasons: ['sexual'], description: nzBanDesc(1996), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'holiday-snapshots', title: 'Holiday Snapshots',
      lang: 'en', year: null, genres: ['non-fiction'],
      description_ban: `Banned in New Zealand as objectionable under the Films, Videos, and Publications Classification Act 1993 for sexual content, likely for photographic content of a sexual nature.`,
      authors: ['anonymous'],
      bans: [{ cc: 'NZ', year: 2000, status: 'active', reasons: ['sexual'], description: nzBanDesc(2000), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'opium-for-the-masses', title: 'Opium for the Masses',
      lang: 'en', year: 1994, genres: ['non-fiction'],
      description_ban: `Jim Hogshire's 1994 guide to extracting opium from poppies, banned in New Zealand as objectionable under the Films, Videos, and Publications Classification Act 1993 on grounds that it promotes and facilitates illegal drug use.`,
      authors: ['jim-hogshire'],
      bans: [{ cc: 'NZ', year: 2002, status: 'active', reasons: ['other', 'drugs'], description: nzBanDesc(2002), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'psilocybin-mushrooms-of-the-world', title: 'Psilocybin Mushrooms of the World',
      lang: 'en', year: 1996, genres: ['non-fiction'],
      description_ban: `Paul Stamets's 1996 field guide to psilocybin mushrooms, banned in New Zealand as objectionable under the Films, Videos, and Publications Classification Act 1993 on grounds that it facilitates illegal drug use.`,
      authors: ['paul-stamets'],
      bans: [{ cc: 'NZ', year: 2002, status: 'active', reasons: ['other', 'drugs'], description: nzBanDesc(2002), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'the-big-book-of-buds', title: 'The Big Book of Buds',
      lang: 'en', year: 2001, genres: ['non-fiction'],
      description_ban: `Ed Rosenthal's illustrated guide to cannabis strains, banned in New Zealand as objectionable under the Films, Videos, and Publications Classification Act 1993 on grounds that it promotes and facilitates illegal drug use.`,
      authors: ['ed-rosenthal'],
      bans: [{ cc: 'NZ', year: 2002, status: 'active', reasons: ['other', 'drugs'], description: nzBanDesc(2002), sourceUrl: SRC.fyi }],
    },
    {
      slug: 'advanced-techniques-clandestine-manufacture', title: 'Advanced Techniques of Clandestine Psychedelic & Amphetamine Manufacture',
      lang: 'en', year: 1997, genres: ['non-fiction'],
      description_ban: `A technical guide to synthesising illegal drugs written under the pseudonym "Uncle Fester," banned in New Zealand as objectionable under the Films, Videos, and Publications Classification Act 1993 on grounds that it provides detailed instructions for manufacturing controlled substances.`,
      authors: ['uncle-fester'],
      bans: [{ cc: 'NZ', year: 2003, status: 'active', reasons: ['other', 'drugs'], description: nzBanDesc(2003), sourceUrl: SRC.fyi }],
    },
  ]

  // ── MY ─────────────────────────────────────────────────────────────────────
  const MY_BOOKS: BookSpec[] = [
    {
      slug: 'the-bargaining-for-israel', title: 'The Bargaining for Israel: In the Shadow of Armageddon',
      lang: 'en', year: null, genres: ['non-fiction'],
      description_ban: `Mona Johulan's book on Israel and Christian eschatology, banned in Malaysia in 2007 by the Home Ministry under the Printing Presses and Publications Act 1984 as part of a wave of 18 books dealing with Islam and interfaith matters. ARTICLE 19 documented the ban as a restriction on freedom of expression.`,
      authors: ['anonymous'],
      bans: [{ cc: 'MY', year: 2007, status: 'active', reasons: ['religious'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984. One of 18 books on Islam and interfaith topics banned simultaneously in 2007.`,
        sourceUrl: SRC.article19a }],
    },
    {
      slug: 'islam-gordon', title: 'Islam',
      lang: 'en', year: 2002, genres: ['non-fiction'],
      description_ban: `Matthew S. Gordon's academic introduction to Islam, banned in Malaysia in 2007 by the Home Ministry under the Printing Presses and Publications Act 1984 as part of a wave of 18 books on Islamic and interfaith topics. ARTICLE 19 documented the ban as a violation of freedom of expression.`,
      authors: ['matthew-s-gordon'],
      bans: [{ cc: 'MY', year: 2007, status: 'active', reasons: ['religious'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984. One of 18 books on Islam and interfaith topics banned simultaneously in 2007.`,
        sourceUrl: SRC.article19a }],
    },
    {
      slug: 'lifting-the-veil', title: 'Lifting the Veil',
      lang: 'en', year: null, genres: ['non-fiction'],
      description_ban: `Trudie Crawford's book on Islam and Muslim women, banned in Malaysia in 2007 by the Home Ministry under the Printing Presses and Publications Act 1984 as part of a wave of 18 books on Islamic and interfaith topics.`,
      authors: ['trudie-crawford'],
      bans: [{ cc: 'MY', year: 2007, status: 'active', reasons: ['religious'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984. One of 18 books on Islam and interfaith topics banned simultaneously in 2007.`,
        sourceUrl: SRC.article19a }],
    },
    {
      slug: 'a-fundamental-fear', title: 'A Fundamental Fear: Eurocentrism and the Emergence of Islamism',
      lang: 'en', year: 1997, genres: ['non-fiction'],
      description_ban: `Bobby S. Sayyid's academic study of Islamism and its relationship to European modernity, banned in Malaysia in 2007 by the Home Ministry under the Printing Presses and Publications Act 1984 as one of 18 books on Islamic and interfaith topics.`,
      authors: ['bobby-s-sayyid'],
      bans: [{ cc: 'MY', year: 2007, status: 'active', reasons: ['religious'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984. One of 18 books on Islam and interfaith topics banned simultaneously in 2007.`,
        sourceUrl: SRC.article19a }],
    },
    {
      slug: 'islam-revealed', title: 'Islam Revealed: A Christian Arab\'s View of Islam',
      lang: 'en', year: 1988, genres: ['non-fiction'],
      description_ban: `Anis Shorrosh's polemical examination of Islam from a Christian perspective, banned in Malaysia in 2007 by the Home Ministry under the Printing Presses and Publications Act 1984 as one of 18 books on Islamic and interfaith topics.`,
      authors: ['anis-shorrosh'],
      bans: [{ cc: 'MY', year: 2007, status: 'active', reasons: ['religious'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984. One of 18 books on Islam and interfaith topics banned simultaneously in 2007.`,
        sourceUrl: SRC.article19a }],
    },
    {
      slug: 'what-everyone-needs-to-know-about-islam', title: 'What Everyone Needs to Know About Islam',
      lang: 'en', year: 2002, genres: ['non-fiction'],
      description_ban: `John L. Esposito's introductory Q&A on Islam aimed at a general audience, banned in Malaysia in 2007 by the Home Ministry under the Printing Presses and Publications Act 1984 as one of 18 books on Islamic and interfaith topics.`,
      authors: ['john-l-esposito'],
      bans: [{ cc: 'MY', year: 2007, status: 'active', reasons: ['religious'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984. One of 18 books on Islam and interfaith topics banned simultaneously in 2007.`,
        sourceUrl: SRC.article19a }],
    },
    {
      slug: 'mini-skirts-mothers-and-muslims', title: 'Mini Skirts, Mothers & Muslims',
      lang: 'en', year: 2004, genres: ['non-fiction'],
      description_ban: `Christine Mallouhi's book on Christian engagement with the Muslim world, banned in Malaysia in 2007 by the Home Ministry under the Printing Presses and Publications Act 1984 as one of 18 books on Islamic and interfaith topics.`,
      authors: ['christine-mallouhi'],
      bans: [{ cc: 'MY', year: 2007, status: 'active', reasons: ['religious'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984. One of 18 books on Islam and interfaith topics banned simultaneously in 2007.`,
        sourceUrl: SRC.article19a }],
    },
    {
      slug: 'the-battle-for-god', title: 'The Battle for God: Fundamentalism in Judaism, Christianity and Islam',
      lang: 'en', year: 2000, genres: ['non-fiction'],
      description_ban: `Karen Armstrong's scholarly study of religious fundamentalism across three traditions, banned in Malaysia in 2007 by the Home Ministry under the Printing Presses and Publications Act 1984 as one of 18 books on Islamic and interfaith topics. Armstrong's books on Islam have been widely praised for their balanced approach; the Malaysian ban was condemned by ARTICLE 19 as an unjustified restriction.`,
      authors: ['karen-armstrong'],
      bans: [{ cc: 'MY', year: 2007, status: 'active', reasons: ['religious'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984. One of 18 books on Islam and interfaith topics banned simultaneously in 2007.`,
        sourceUrl: SRC.article19a }],
    },
    {
      slug: 'hidden-agendas-leigh', title: 'Hidden Agendas',
      lang: 'en', year: null, genres: ['fiction'],
      description_ban: `Lora Leigh's erotic romance novel, banned in Malaysia in 2018 under the Printing Presses and Publications Act 1984 for explicit sexual content.`,
      authors: ['lora-leigh'],
      bans: [{ cc: 'MY', year: 2018, status: 'active', reasons: ['sexual'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984 for explicit sexual content.`,
        sourceUrl: SRC.article19b }],
    },
    {
      slug: 'mengenal-allah-melalui-agama-agama-purba', title: 'Mengenal Allah Melalui Agama-Agama Purba: Gautama Buddha Seorang Nabi?',
      lang: 'ms', year: null, genres: ['non-fiction'],
      description_ban: `Kamaludin Endol's Malay-language book on Islamic theology and the question of the Prophet status of Gautama Buddha, banned in Malaysia in 2018 under the Printing Presses and Publications Act 1984 as potentially deviant from mainstream Islamic teaching.`,
      authors: ['kamaludin-endol'],
      bans: [{ cc: 'MY', year: 2018, status: 'active', reasons: ['religious'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984 for content considered potentially deviant from mainstream Islamic teaching.`,
        sourceUrl: SRC.article19b }],
    },
    {
      slug: 'confessions-a-secret-diary', title: 'Confessions: A Secret Diary',
      lang: 'en', year: null, genres: ['fiction'],
      description_ban: `Amber Stephens's erotic fiction, banned in Malaysia in 2018 under the Printing Presses and Publications Act 1984 for explicit sexual content.`,
      authors: ['amber-stephens'],
      bans: [{ cc: 'MY', year: 2018, status: 'active', reasons: ['sexual'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984 for explicit sexual content.`,
        sourceUrl: SRC.article19b }],
    },
    {
      slug: 'islam-dan-teologi-pembebasan', title: 'Islam Dan Teologi Pembebasan',
      lang: 'id', year: 1999, genres: ['non-fiction'],
      description_ban: `Indonesian translation of Asghar Ali Engineer's work on Islamic liberation theology, banned in Malaysia in 2018 under the Printing Presses and Publications Act 1984 as potentially deviant from official Islamic doctrine.`,
      authors: ['asghar-ali-engineer'],
      bans: [{ cc: 'MY', year: 2018, status: 'active', reasons: ['religious'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984 for content considered potentially deviant from mainstream Islamic teaching.`,
        sourceUrl: SRC.article19b }],
    },
    {
      slug: 'the-road-to-muhammad', title: 'The Road To Muhammad',
      lang: 'id', year: null, genres: ['non-fiction'],
      description_ban: `Jalaluddin Rakhmat's Indonesian-language work on Islamic spirituality, banned in Malaysia in 2018 under the Printing Presses and Publications Act 1984 for content considered potentially deviant from mainstream Sunni doctrine.`,
      authors: ['jalaluddin-rakhmat'],
      bans: [{ cc: 'MY', year: 2018, status: 'active', reasons: ['religious'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984.`,
        sourceUrl: SRC.article19b }],
    },
    {
      slug: 'mutiara-sastra-ali', title: 'Mutiara Sastra Ali: Muhammad Hashem Edisi Surat & Aforisme',
      lang: 'ms', year: null, genres: ['non-fiction'],
      description_ban: `Muhammad Hashem's collection of letters and aphorisms, banned in Malaysia in 2018 under the Printing Presses and Publications Act 1984.`,
      authors: ['anonymous'],
      bans: [{ cc: 'MY', year: 2018, status: 'active', reasons: ['religious'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984.`,
        sourceUrl: SRC.article19b }],
    },
    {
      slug: 'perjalanan-yang-cemerlang', title: 'Perjalanan yang Cemerlang 1930–1980',
      lang: 'ms', year: null, genres: ['non-fiction', 'political'],
      description_ban: `A history of the Malayan Communist Party (PKM) covering 1930–1980, banned in Malaysia in 2018 under the Printing Presses and Publications Act 1984 for communist content.`,
      authors: ['anonymous'],
      bans: [{ cc: 'MY', year: 2018, status: 'active', reasons: ['political'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984 for communist political content.`,
        sourceUrl: SRC.article19b }],
    },
    {
      slug: 'agama-masa-depan', title: 'Agama Masa Depan: Perspektif Filsafat Perennial',
      lang: 'id', year: 1995, genres: ['non-fiction'],
      description_ban: `Komaruddin Hidayat's Indonesian-language work on perennial philosophy and religion, banned in Malaysia in 2018 under the Printing Presses and Publications Act 1984 for content considered potentially deviant from mainstream Islamic teaching.`,
      authors: ['komaruddin-hidayat'],
      bans: [{ cc: 'MY', year: 2018, status: 'active', reasons: ['religious'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984 for content considered potentially deviant from mainstream Islamic teaching.`,
        sourceUrl: SRC.article19b }],
    },
    {
      slug: 'intense-pleasure-leigh', title: 'Intense Pleasure',
      lang: 'en', year: null, genres: ['fiction'],
      description_ban: `Lora Leigh's erotic romance novel, banned in Malaysia in 2018 under the Printing Presses and Publications Act 1984 for explicit sexual content.`,
      authors: ['lora-leigh'],
      bans: [{ cc: 'MY', year: 2018, status: 'active', reasons: ['sexual'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984 for explicit sexual content.`,
        sourceUrl: SRC.article19b }],
    },
    {
      slug: 'its-all-about-muhammad', title: "It's All About Muhammad: A Biography of the World's Most Notorious Prophet",
      lang: 'en', year: 2014, genres: ['non-fiction'],
      description_ban: `F. W. Burleigh's polemical biography of Muhammad, banned in Malaysia in 2018 under the Printing Presses and Publications Act 1984 as offensive to Islam.`,
      authors: ['f-w-burleigh'],
      bans: [{ cc: 'MY', year: 2018, status: 'active', reasons: ['religious', 'blasphemy'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984 as offensive to Islam.`,
        sourceUrl: SRC.article19b }],
    },
    {
      slug: 'gay-is-ok', title: "Gay is OK!: A Christian Perspective",
      lang: 'en', year: 2011, genres: ['non-fiction'],
      description_ban: `Boon Lin Ngeo's 2011 book arguing from a Christian perspective that homosexuality is acceptable, banned in Malaysia under the Printing Presses and Publications Act 1984 for promoting homosexuality. The ban was challenged in court and upheld by Malaysia's Court of Appeal in a 2:1 majority decision in 2024.`,
      authors: ['boon-lin-ngeo'],
      bans: [{ cc: 'MY', year: 2020, status: 'active', reasons: ['lgbtq'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984 for promoting homosexuality. Court of Appeal upheld the ban 2:1 in January 2024.`,
        sourceUrl: SRC.malaymail1 }],
    },
    {
      slug: 'rebirth-reformasi', title: 'Rebirth: Reformasi, Resistance and Hope in New Malaysia',
      lang: 'en', year: 2020, genres: ['non-fiction', 'political'],
      description_ban: `Kean Wong's 2020 essay collection on the reform movement in Malaysia, banned by the Home Ministry in July 2020 for featuring a cover that included a modified Malaysian coat of arms, which was deemed insulting to the national symbol.`,
      authors: ['kean-wong'],
      bans: [{ cc: 'MY', year: 2020, status: 'active', reasons: ['political'],
        description: `Banned by the Malaysian Home Ministry in July 2020 for a cover design that modified the national coat of arms, deemed an insult to the national symbol.`,
        sourceUrl: SRC.malaymail2 }],
    },
    {
      slug: 'the-tale-of-steven', title: 'The Tale of Steven',
      lang: 'en', year: 2022, genres: ['fiction'],
      description_ban: `A children's book featuring LGBTQ+ themes, banned in Malaysia in 2023 as one of the first three books prohibited by the Unity Government under the Printing Presses and Publications Act 1984 for content deemed to promote LGBTQ+ identity.`,
      authors: ['anonymous'],
      bans: [{ cc: 'MY', year: 2023, status: 'active', reasons: ['lgbtq'],
        description: `Banned by the Malaysian Home Ministry in 2023 as one of the first three books banned by the Unity Government. Grounds: content promoting LGBTQ+ identity.`,
        sourceUrl: SRC.focusmy }],
    },
    {
      slug: 'jacobs-room-to-choose', title: "Jacob's Room To Choose",
      lang: 'en', year: 2019, genres: ['fiction'],
      description_ban: `A children's picture book dealing with gender identity, banned in Malaysia in 2023 as one of the first three books prohibited by the Unity Government under the Printing Presses and Publications Act 1984 for content deemed to promote LGBTQ+ identity.`,
      authors: ['anonymous'],
      bans: [{ cc: 'MY', year: 2023, status: 'active', reasons: ['lgbtq'],
        description: `Banned by the Malaysian Home Ministry in 2023 as one of the first three books banned by the Unity Government. Grounds: content promoting LGBTQ+ identity.`,
        sourceUrl: SRC.focusmy }],
    },
    {
      slug: 'aku-malaysia', title: 'Aku',
      lang: 'ms', year: 2022, genres: ['fiction'],
      description_ban: `A Malay-language book banned in Malaysia in 2023 as one of the first three books prohibited by the Unity Government under the Printing Presses and Publications Act 1984 for content deemed to promote LGBTQ+ identity and immorality.`,
      authors: ['anonymous'],
      bans: [{ cc: 'MY', year: 2023, status: 'active', reasons: ['lgbtq'],
        description: `Banned by the Malaysian Home Ministry in 2023 as one of the first three books banned by the Unity Government. Grounds: content promoting LGBTQ+ identity.`,
        sourceUrl: SRC.focusmy }],
    },
    {
      slug: 'marx-sang-pendidik-revolusioner', title: 'Marx Sang Pendidik Revolusioner',
      lang: 'id', year: null, genres: ['non-fiction', 'political'],
      description_ban: `Robin Smalls's Indonesian-language book on Marx as a revolutionary educator, banned in Malaysia in 2023 under the Printing Presses and Publications Act 1984 for communist political content.`,
      authors: ['robin-smalls'],
      bans: [{ cc: 'MY', year: 2023, status: 'active', reasons: ['political'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984 for communist political content.`,
        sourceUrl: SRC.article19c }],
    },
    {
      slug: 'koleksi-puisi-masturbasi', title: 'Koleksi Puisi Masturbasi',
      lang: 'ms', year: null, genres: ['fiction'],
      description_ban: `Benz Ali's Malay-language poetry collection, banned in Malaysia in 2023 under the Printing Presses and Publications Act 1984 for explicit sexual content.`,
      authors: ['benz-ali'],
      bans: [{ cc: 'MY', year: 2023, status: 'active', reasons: ['sexual'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984 for explicit sexual content.`,
        sourceUrl: SRC.article19c }],
    },
    {
      slug: 'memoir-shamsiah-fakeh', title: 'Memoir Shamsiah Fakeh: Dari AWAS ke Rejimen ke-10',
      lang: 'ms', year: 2004, genres: ['non-fiction'],
      description_ban: `The memoir of Shamsiah Fakeh, a founding figure of the Malay nationalist and communist movement, banned in Malaysia under the Printing Presses and Publications Act 1984 for communist political content. Fakeh fought with the Malayan Communist Party's 10th Regiment before returning to Malaysia in 1994.`,
      authors: ['shamsiah-fakeh'],
      bans: [{ cc: 'MY', year: 2026, status: 'active', reasons: ['political'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984 for communist political content.`,
        sourceUrl: SRC.article19d }],
    },
    {
      slug: 'komrad-asi-rejimen-10', title: 'Komrad Asi Rejimen 10: Dalam Denyut Nihilisme Sejarah',
      lang: 'ms', year: null, genres: ['non-fiction', 'political'],
      description_ban: `A Malay-language account of the Malayan Communist Party's 10th Regiment, banned in Malaysia in 2026 under the Printing Presses and Publications Act 1984 for communist political content.`,
      authors: ['anonymous'],
      bans: [{ cc: 'MY', year: 2026, status: 'active', reasons: ['political'],
        description: `Banned by the Malaysian Home Ministry under the Printing Presses and Publications Act 1984 for communist political content.`,
        sourceUrl: SRC.article19d }],
    },
  ]

  // ── VN ─────────────────────────────────────────────────────────────────────
  const VN_BOOKS: BookSpec[] = [
    {
      slug: 'politics-for-the-common-people', title: 'Politics for the Common People',
      lang: 'vi', year: 2017, genres: ['non-fiction', 'political'],
      description_ban: `Pham Doan Trang's 2017 guide to civic engagement and political rights, banned in Vietnam. Trang is a prominent dissident journalist; her publications are systematically suppressed. She was arrested in 2020 and sentenced to nine years in prison.`,
      authors: ['pham-doan-trang'],
      bans: [{ cc: 'VN', year: 2017, status: 'active', reasons: ['political'],
        description: `Banned in Vietnam for political content. Author Pham Doan Trang was arrested in 2020 and sentenced to nine years' imprisonment.`,
        sourceUrl: SRC.hrcommission }],
    },
    {
      slug: 'politics-of-a-police-state', title: 'Politics of a Police State',
      lang: 'vi', year: 2021, genres: ['non-fiction', 'political'],
      description_ban: `Pham Doan Trang's analysis of state security and political repression in Vietnam, banned in the country. Trang was arrested in 2020 before the book's publication; it was distributed by her network and considered by authorities a basis for her prosecution.`,
      authors: ['pham-doan-trang'],
      bans: [{ cc: 'VN', year: 2021, status: 'active', reasons: ['political'],
        description: `Banned in Vietnam. Used as evidence in the prosecution of Pham Doan Trang, who was sentenced to nine years' imprisonment in 2021.`,
        sourceUrl: SRC.apnews }],
    },
    {
      slug: 'handbook-nonviolent-resistance', title: 'A Handbook of Non-violent Resistance Techniques',
      lang: 'vi', year: 2018, genres: ['non-fiction', 'political'],
      description_ban: `Pham Doan Trang's guide to non-violent civil resistance, banned in Vietnam. The book was cited by authorities as subversive literature in Trang's prosecution and nine-year prison sentence.`,
      authors: ['pham-doan-trang'],
      bans: [{ cc: 'VN', year: 2021, status: 'active', reasons: ['political'],
        description: `Banned in Vietnam. Cited as evidence in Pham Doan Trang's prosecution.`,
        sourceUrl: SRC.hrcommission }],
    },
    {
      slug: 'overview-marine-life-disaster-vietnam', title: 'An Overview of Marine Life Disaster in Vietnam',
      lang: 'vi', year: 2016, genres: ['non-fiction'],
      description_ban: `Pham Doan Trang's investigative report on the 2016 Formosa Ha Tinh Steel environmental disaster, which killed marine life along 200 km of Vietnamese coastline, banned in Vietnam for its politically sensitive reporting on government handling of the crisis.`,
      authors: ['pham-doan-trang'],
      bans: [{ cc: 'VN', year: 2021, status: 'active', reasons: ['political'],
        description: `Banned in Vietnam. Cited as evidence in Pham Doan Trang's prosecution.`,
        sourceUrl: SRC.hrcommission }],
    },
    {
      slug: 'handbook-support-prisoners-of-conscience', title: 'A Handbook of How to Support Prisoners of Conscience',
      lang: 'vi', year: 2019, genres: ['non-fiction'],
      description_ban: `Pham Doan Trang's practical guide for supporting political prisoners, banned in Vietnam. Trang was arrested in 2020 and sentenced to nine years' imprisonment; her publications are systematically suppressed.`,
      authors: ['pham-doan-trang'],
      bans: [{ cc: 'VN', year: 2021, status: 'active', reasons: ['political'],
        description: `Banned in Vietnam. Cited as evidence in Pham Doan Trang's prosecution.`,
        sourceUrl: SRC.hrcommission }],
    },
    {
      slug: 'the-winning-side-huy-duc', title: 'The Winning Side',
      lang: 'vi', year: 2012, genres: ['non-fiction', 'political'],
      description_ban: `Huy Đức's two-volume account of post-1975 Vietnam, tracing the Communist Party's consolidation of power and its effects on Vietnamese society, banned in Vietnam for its unauthorised and unflattering portrayal of the Party leadership.`,
      authors: ['duc-huy'],
      bans: [{ cc: 'VN', year: 2012, status: 'active', reasons: ['political'],
        description: `Banned in Vietnam. Distributed via overseas networks. The author was detained in 2024 under Article 331 of the Penal Code.`,
        sourceUrl: SRC.wiki }],
    },
    {
      slug: 'a-tale-for-2000', title: 'A Tale for 2000',
      lang: 'vi', year: 2000, genres: ['fiction'],
      description_ban: `Bùi Ngọc Tấn's autobiographical novel about life in a Vietnamese re-education camp, based on his own imprisonment from 1968 to 1973, banned in Vietnam after publication in 2000 for its portrayal of the Communist Party's treatment of political prisoners.`,
      authors: ['ngoc-tan-bui'],
      bans: [{ cc: 'VN', year: 2000, status: 'active', reasons: ['political'],
        description: `Banned in Vietnam after publication. The author was a survivor of the re-education camp system; the novel drew on his own imprisonment.`,
        sourceUrl: SRC.wiki }],
    },
  ]

  // ── KR ─────────────────────────────────────────────────────────────────────
  const KR_BOOKS: BookSpec[] = [
    {
      slug: 'year-501-chomsky', title: 'Year 501: The Conquest Continues',
      lang: 'en', year: 1993, genres: ['non-fiction', 'political'],
      description_ban: `Noam Chomsky's 1993 critique of US foreign policy and global imperialism, restricted from distribution in South Korean military barracks in 2008. The restriction was one of hundreds applied to politically progressive and left-wing books deemed potentially subversive for military personnel.`,
      authors: ['noam-chomsky'],
      bans: [{ cc: 'KR', year: 2008, status: 'active', actionType: 'restricted', reasons: ['political'],
        description: `Restricted from distribution in South Korean military barracks under the Ministry of National Defense's internal censorship guidelines from 2008. A 2010 Constitutional Court ruling found similar bans constitutional.`,
        sourceUrl: SRC.koreatimes1 }],
    },
    {
      slug: 'what-uncle-sam-really-wants', title: 'What Uncle Sam Really Wants',
      lang: 'en', year: 1993, genres: ['non-fiction', 'political'],
      description_ban: `Noam Chomsky's 1993 overview of US foreign policy since the Second World War, restricted from South Korean military barracks in 2008 as one of hundreds of left-leaning titles barred from distribution among soldiers.`,
      authors: ['noam-chomsky'],
      bans: [{ cc: 'KR', year: 2008, status: 'active', actionType: 'restricted', reasons: ['political'],
        description: `Restricted from distribution in South Korean military barracks from 2008 under Ministry of National Defense internal guidelines.`,
        sourceUrl: SRC.koreatimes2 }],
    },
    {
      slug: 'bad-samaritans', title: 'Bad Samaritans: The Myth of Free Trade and the Secret History of Capitalism',
      lang: 'en', year: 2007, genres: ['non-fiction', 'political'],
      description_ban: `Ha-Joon Chang's 2007 critique of free trade ideology and the World Bank/IMF policy consensus, restricted from South Korean military barracks in 2008. Banned despite — or perhaps because of — the author's own South Korean nationality and affiliation with Cambridge University.`,
      authors: ['ha-joon-chang'],
      bans: [{ cc: 'KR', year: 2008, status: 'active', actionType: 'restricted', reasons: ['political'],
        description: `Restricted from distribution in South Korean military barracks from 2008 under Ministry of National Defense internal guidelines. A 2010 Constitutional Court ruling found similar bans constitutional.`,
        sourceUrl: SRC.koreatimes1 }],
    },
    {
      slug: 'a-spoon-on-earth', title: 'A Spoon on Earth',
      lang: 'ko', year: 2002, genres: ['fiction'],
      description_ban: `Hyeon Gi-yeong's novel, restricted from South Korean military barracks in 2008 as one of hundreds of books deemed politically progressive or subversive for soldiers.`,
      authors: ['gi-yeong-hyeon'],
      bans: [{ cc: 'KR', year: 2008, status: 'active', actionType: 'restricted', reasons: ['political'],
        description: `Restricted from distribution in South Korean military barracks from 2008 under Ministry of National Defense internal guidelines.`,
        sourceUrl: SRC.koreatimes1 }],
    },
    {
      slug: 'guerillas-of-the-kingdom-of-samsung', title: 'Guerillas of the Kingdom of Samsung',
      lang: 'ko', year: 2006, genres: ['non-fiction', 'political'],
      description_ban: `A South Korean exposé of Samsung's corporate power and its relationship to the state, restricted from military barracks in 2008 as politically subversive.`,
      authors: ['anonymous'],
      bans: [{ cc: 'KR', year: 2008, status: 'active', actionType: 'restricted', reasons: ['political'],
        description: `Restricted from distribution in South Korean military barracks from 2008 under Ministry of National Defense internal guidelines.`,
        sourceUrl: SRC.wiki }],
    },
    {
      slug: 'the-global-trap', title: 'The Global Trap',
      lang: 'de', year: 1996, genres: ['non-fiction', 'political'],
      description_ban: `Hans-Peter Martin and Harald Schumann's 1996 critique of economic globalisation, originally published in German as Die Globalisierungsfalle, restricted from South Korean military barracks in 2008 as one of hundreds of left-leaning titles deemed inappropriate for soldiers.`,
      authors: ['hans-peter-martin'],
      bans: [{ cc: 'KR', year: 2008, status: 'active', actionType: 'restricted', reasons: ['political'],
        description: `Restricted from distribution in South Korean military barracks from 2008 under Ministry of National Defense internal guidelines.`,
        sourceUrl: SRC.wiki }],
    },
    {
      slug: 'auf-der-universitat', title: 'Auf der Universität',
      lang: 'de', year: 1863, genres: ['fiction'],
      description_ban: `Theodor Storm's 1863 German novella about a student's troubled love affair, restricted from South Korean military barracks in 2008. The inclusion of a 19th-century German literary classic on a list of books deemed dangerous to soldiers illustrates the broad and indiscriminate character of South Korea's military book bans.`,
      authors: ['theodor-storm'],
      bans: [{ cc: 'KR', year: 2008, status: 'active', actionType: 'restricted', reasons: ['political'],
        description: `Restricted from distribution in South Korean military barracks from 2008. Inclusion of a 19th-century German novella on the banned list drew considerable criticism.`,
        sourceUrl: SRC.wiki }],
    },
    {
      slug: 'slots-shin', title: 'Slots',
      lang: 'ko', year: 2007, genres: ['fiction'],
      description_ban: `Shin Gyeong-jin's novel, restricted from South Korean military barracks in 2011 under the Ministry of National Defense's internal guidelines prohibiting books deemed politically progressive or subversive for military personnel.`,
      authors: ['gyeong-jin-shin'],
      bans: [{ cc: 'KR', year: 2011, status: 'active', actionType: 'restricted', reasons: ['political'],
        description: `Restricted from distribution in South Korean military barracks from 2011 under Ministry of National Defense internal guidelines.`,
        sourceUrl: SRC.wiki }],
    },
    {
      slug: 'respect-chavez-perez', title: 'Respect: Everything a Guy Needs to Know About Sex',
      lang: 'es', year: 2016, genres: ['non-fiction'],
      description_ban: `Inti Chávez Pérez's sexual health guide for young men, restricted from South Korean military barracks in 2024 for sexual content. One of a series of books periodically removed from military libraries under Ministry of National Defense guidelines.`,
      authors: ['inti-chavez-perez'],
      bans: [{ cc: 'KR', year: 2024, status: 'active', actionType: 'restricted', reasons: ['sexual'],
        description: `Restricted from distribution in South Korean military barracks in 2024 under Ministry of National Defense internal guidelines.`,
        sourceUrl: SRC.wiki }],
    },
  ]

  const ALL_BOOKS = [...IE_BOOKS, ...NZ_BOOKS, ...MY_BOOKS, ...VN_BOOKS, ...KR_BOOKS]

  for (const entry of ALL_BOOKS) {
    console.log(`\n[${entry.slug}]`)

    if (bookMap.has(entry.slug)) {
      console.log(`  [skip] already exists`)
      continue
    }

    const primaryAuthor = entry.authors[0] ?? 'anonymous'
    const { coverUrl, workId } = await fetchCover(entry.title, primaryAuthor)
    console.log(`  cover: ${coverUrl ? coverUrl.slice(0, 70) + '…' : 'not found'}`)
    await sleep(250)

    if (!WRITE) continue

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
    console.log(`  ✓ book (id=${bookId})`)

    for (const aSlug of entry.authors) {
      const aId = authorMap.get(aSlug)
      if (!aId) { console.warn(`  [warn] author not found: ${aSlug}`); continue }
      await supabase.from('book_authors').insert({ book_id: bookId, author_id: aId })
    }

    for (const ban of entry.bans) {
      const { data: banRow, error: banErr } = await supabase.from('bans').insert({
        book_id: bookId,
        country_code: ban.cc,
        scope_id: gov,
        action_type: ban.actionType ?? 'banned',
        status: ban.status,
        year_started: ban.year,
        year_ended: ban.yearEnded ?? null,
        description: ban.description,
      }).select('id').single()

      if (banErr || !banRow) { console.error(`  ✗ ban (${ban.cc}): ${banErr?.message}`); continue }

      for (const rSlug of ban.reasons) {
        await supabase.from('ban_reason_links').insert({ ban_id: banRow.id, reason_id: reasonId(rSlug) })
      }

      if (ban.sourceUrl) {
        const sid = await getSourceId(ban.sourceUrl)
        if (sid) await linkBanToSource(banRow.id, sid)
      }

      console.log(`  ✓ ban ${ban.cc} (${ban.status}) — ${ban.reasons.join(', ')}`)
    }
  }

  console.log('\n=== Done ===')
  if (!WRITE) console.log('DRY-RUN — re-run with --write to apply.')
}

main().catch(e => { console.error(e); process.exit(1) })
