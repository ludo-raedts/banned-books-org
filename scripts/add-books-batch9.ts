import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()
const COVER_DELAY_MS = 250

interface OLResult { coverUrl: string | null; workId: string | null; publishYear: number | null }

async function fetchOL(title: string, author: string): Promise<OLResult> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key,cover_i,first_publish_year&limit=1`)
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number; first_publish_year?: number }> }
    const doc = json.docs?.[0]
    return {
      coverUrl:    doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
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

async function ensureCountry(code: string, name: string, slug: string) {
  const { data } = await supabase.from('countries').select('code').eq('code', code).single()
  if (!data) { await supabase.from('countries').insert({ code, name_en: name, slug }); console.log(`Added: ${name}`) }
}

async function main() {
  const { data: scopes }   = await supabase.from('scopes').select('id, slug')
  const { data: reasons }  = await supabase.from('reasons').select('id, slug')
  const { data: existing } = await supabase.from('books').select('slug')
  const { data: existingAuthors } = await supabase.from('authors').select('id, slug')

  const existingSlugs = new Set((existing ?? []).map(b => b.slug))
  const authorMap = new Map((existingAuthors ?? []).map(a => [a.slug, a.id as number]))

  const scopeId  = (slug: string) => scopes!.find(s => s.slug === slug)!.id
  const reasonId = (slug: string) => reasons!.find(r => r.slug === slug)!.id

  const govId    = scopeId('government')
  const schoolId = scopeId('school')
  const libId    = scopeId('public_library')

  const wikp = await upsertSource('Wikipedia', 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments')
  const ala  = await upsertSource('ALA Office for Intellectual Freedom', 'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks')

  // Extra countries
  await ensureCountry('ET', 'Ethiopia', 'ethiopia')
  await ensureCountry('KE', 'Kenya', 'kenya')
  await ensureCountry('UG', 'Uganda', 'uganda')
  await ensureCountry('TZ', 'Tanzania', 'tanzania')
  await ensureCountry('SD', 'Sudan', 'sudan')
  await ensureCountry('MX', 'Mexico', 'mexico')
  await ensureCountry('VE', 'Venezuela', 'venezuela')
  await ensureCountry('PH', 'Philippines', 'philippines')
  await ensureCountry('IT', 'Italy', 'italy')
  await ensureCountry('AF', 'Afghanistan', 'afghanistan')

  async function getOrCreateAuthor(displayName: string, slug: string): Promise<number | null> {
    if (authorMap.has(slug)) return authorMap.get(slug)!
    const { data, error } = await supabase.from('authors').insert({ slug, display_name: displayName }).select('id').single()
    if (error) {
      const { data: ex } = await supabase.from('authors').select('id').eq('slug', slug).single()
      if (ex) { authorMap.set(slug, ex.id); return ex.id }
      return null
    }
    authorMap.set(slug, data.id); return data.id
  }

  async function addBook(opts: {
    title: string; slug: string; authorDisplay: string; authorSlug: string
    year: number; genres: string[]; lang?: string
    bans: { country: string; scopeId: number; status: string; yearStarted: number; reasonSlugs: string[]; sourceId: number | null }[]
  }) {
    if (existingSlugs.has(opts.slug)) { console.log(`  [skip] ${opts.title}`); return }
    process.stdout.write(`  ${opts.title}... `)
    const ol = await fetchOL(opts.title, opts.authorDisplay)
    await sleep(COVER_DELAY_MS)
    const authorId = await getOrCreateAuthor(opts.authorDisplay, opts.authorSlug)
    const { data: book, error: be } = await supabase.from('books').insert({
      title: opts.title, slug: opts.slug, original_language: opts.lang ?? 'en',
      first_published_year: opts.year, ai_drafted: false, genres: opts.genres,
      cover_url: ol.coverUrl, openlibrary_work_id: ol.workId,
    }).select('id').single()
    if (be) { console.error(`ERROR: ${be.message}`); return }
    existingSlugs.add(opts.slug)
    if (authorId) await supabase.from('book_authors').insert({ book_id: book.id, author_id: authorId })
    for (const ban of opts.bans) {
      const { data: newBan, error: bane } = await supabase.from('bans').insert({
        book_id: book.id, country_code: ban.country, scope_id: ban.scopeId,
        action_type: 'banned', status: ban.status, year_started: ban.yearStarted,
      }).select('id').single()
      if (bane) { console.error(`  ban error ${ban.country}: ${bane.message}`); continue }
      for (const rs of ban.reasonSlugs) await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: reasonId(rs) })
      if (ban.sourceId) await supabase.from('ban_source_links').insert({ ban_id: newBan.id, source_id: ban.sourceId })
    }
    console.log(`ok${ol.coverUrl ? '' : ' (no cover)'}`)
  }

  // ── Science classics ──────────────────────────────────────────────────────
  await addBook({ title: 'On the Origin of Species', slug: 'the-origin-of-species',
    authorDisplay: 'Charles Darwin', authorSlug: 'charles-darwin', year: 1859, genres: ['non-fiction'],
    bans: [
      { country: 'YU', scopeId: govId, status: 'historical', yearStarted: 1935, reasonSlugs: ['religious'], sourceId: wikp },
      { country: 'US', scopeId: schoolId, status: 'active', yearStarted: 1925, reasonSlugs: ['religious'], sourceId: ala },
    ] })

  // ── American classics / Comstock era ─────────────────────────────────────
  await addBook({ title: 'Leaves of Grass', slug: 'leaves-of-grass',
    authorDisplay: 'Walt Whitman', authorSlug: 'walt-whitman', year: 1855, genres: ['literary-fiction'],
    bans: [
      { country: 'US', scopeId: govId, status: 'historical', yearStarted: 1882, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikp },
    ] })

  await addBook({ title: 'Sister Carrie', slug: 'sister-carrie',
    authorDisplay: 'Theodore Dreiser', authorSlug: 'theodore-dreiser', year: 1900, genres: ['literary-fiction'],
    bans: [
      { country: 'US', scopeId: govId, status: 'historical', yearStarted: 1900, reasonSlugs: ['sexual', 'moral'], sourceId: wikp },
    ] })

  await addBook({ title: 'The Jungle', slug: 'the-jungle-upton-sinclair',
    authorDisplay: 'Upton Sinclair', authorSlug: 'upton-sinclair', year: 1906, genres: ['literary-fiction', 'political-fiction'],
    bans: [
      { country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['political'], sourceId: wikp },
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1956, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  await addBook({ title: 'Fear and Loathing in Las Vegas', slug: 'fear-and-loathing',
    authorDisplay: 'Hunter S. Thompson', authorSlug: 'hunter-s-thompson', year: 1971, genres: ['non-fiction', 'literary-fiction'],
    bans: [
      { country: 'US', scopeId: libId, status: 'historical', yearStarted: 1985, reasonSlugs: ['drugs', 'language'], sourceId: ala },
    ] })

  // ── Burma / Southeast Asia ────────────────────────────────────────────────
  await addBook({ title: 'Burmese Days', slug: 'burma-diary',
    authorDisplay: 'George Orwell', authorSlug: 'george-orwell', year: 1934, genres: ['literary-fiction'],
    bans: [
      { country: 'MM', scopeId: govId, status: 'historical', yearStarted: 1963, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  // ── Spain under Franco ────────────────────────────────────────────────────
  await addBook({ title: 'For Whom the Bell Tolls', slug: 'for-whom-the-bell-tolls',
    authorDisplay: 'Ernest Hemingway', authorSlug: 'ernest-hemingway', year: 1940, genres: ['literary-fiction', 'historical-fiction'],
    bans: [
      { country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1940, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  await addBook({ title: 'The Sun Also Rises', slug: 'the-sun-also-rises',
    authorDisplay: 'Ernest Hemingway', authorSlug: 'ernest-hemingway', year: 1926, genres: ['literary-fiction'],
    bans: [
      { country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1939, reasonSlugs: ['sexual', 'moral'], sourceId: wikp },
      { country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1930, reasonSlugs: ['sexual', 'moral'], sourceId: wikp },
    ] })

  await addBook({ title: 'Nada', slug: 'nada-carmen-laforet',
    authorDisplay: 'Carmen Laforet', authorSlug: 'carmen-laforet', year: 1944, genres: ['literary-fiction'], lang: 'es',
    bans: [
      { country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1944, reasonSlugs: ['moral', 'political'], sourceId: wikp },
    ] })

  await addBook({ title: 'Bodas de sangre', slug: 'bodas-de-sangre',
    authorDisplay: 'Federico García Lorca', authorSlug: 'federico-garcia-lorca', year: 1932, genres: ['literary-fiction'], lang: 'es',
    bans: [
      { country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1939, reasonSlugs: ['political', 'lgbtq'], sourceId: wikp },
    ] })

  await addBook({ title: 'The House of Bernarda Alba', slug: 'the-house-of-bernarda-alba',
    authorDisplay: 'Federico García Lorca', authorSlug: 'federico-garcia-lorca', year: 1936, genres: ['literary-fiction'], lang: 'es',
    bans: [
      { country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1939, reasonSlugs: ['political', 'lgbtq'], sourceId: wikp },
    ] })

  // ── Italy under Mussolini ─────────────────────────────────────────────────
  await addBook({ title: 'Christ Stopped at Eboli', slug: 'christ-stopped-at-eboli',
    authorDisplay: 'Carlo Levi', authorSlug: 'carlo-levi', year: 1945, genres: ['memoir', 'literary-fiction'], lang: 'it',
    bans: [
      { country: 'IT', scopeId: govId, status: 'historical', yearStarted: 1945, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  await addBook({ title: 'The Moon and the Bonfires', slug: 'the-moon-and-the-bonfires',
    authorDisplay: 'Cesare Pavese', authorSlug: 'cesare-pavese', year: 1950, genres: ['literary-fiction'], lang: 'it',
    bans: [
      { country: 'IT', scopeId: govId, status: 'historical', yearStarted: 1950, reasonSlugs: ['political', 'sexual'], sourceId: wikp },
    ] })

  await addBook({ title: 'Fontamara', slug: 'fontamara',
    authorDisplay: 'Ignazio Silone', authorSlug: 'ignazio-silone', year: 1933, genres: ['literary-fiction', 'political-fiction'], lang: 'it',
    bans: [
      { country: 'IT', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  // ── Indonesia under Suharto ───────────────────────────────────────────────
  await addBook({ title: 'This Earth of Mankind', slug: 'this-earth-of-mankind',
    authorDisplay: 'Pramoedya Ananta Toer', authorSlug: 'pramoedya-ananta-toer', year: 1980, genres: ['literary-fiction', 'historical-fiction'],
    bans: [
      { country: 'ID', scopeId: govId, status: 'historical', yearStarted: 1981, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  await addBook({ title: 'Child of All Nations', slug: 'child-of-all-nations',
    authorDisplay: 'Pramoedya Ananta Toer', authorSlug: 'pramoedya-ananta-toer', year: 1980, genres: ['literary-fiction'],
    bans: [
      { country: 'ID', scopeId: govId, status: 'historical', yearStarted: 1981, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  await addBook({ title: 'Footsteps', slug: 'footsteps-pramoedya',
    authorDisplay: 'Pramoedya Ananta Toer', authorSlug: 'pramoedya-ananta-toer', year: 1985, genres: ['literary-fiction'],
    bans: [
      { country: 'ID', scopeId: govId, status: 'historical', yearStarted: 1985, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  // ── Philippines under Marcos ──────────────────────────────────────────────
  await addBook({ title: 'In Our Image: America\'s Empire in the Philippines', slug: 'in-our-image',
    authorDisplay: 'Stanley Karnow', authorSlug: 'stanley-karnow', year: 1989, genres: ['non-fiction', 'historical-fiction'],
    bans: [
      { country: 'PH', scopeId: govId, status: 'historical', yearStarted: 1972, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  await addBook({ title: 'The Subversive', slug: 'the-subversive-philippines',
    authorDisplay: 'Nick Joaquin', authorSlug: 'nick-joaquin', year: 1962, genres: ['literary-fiction'],
    bans: [
      { country: 'PH', scopeId: govId, status: 'historical', yearStarted: 1972, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  // ── Venezuela / Latin America ─────────────────────────────────────────────
  await addBook({ title: 'Don Quixote', slug: 'don-quixote',
    authorDisplay: 'Miguel de Cervantes', authorSlug: 'miguel-de-cervantes', year: 1605, genres: ['literary-fiction'], lang: 'es',
    bans: [
      { country: 'VE', scopeId: govId, status: 'historical', yearStarted: 2005, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  // ── Brazil under military dictatorship ───────────────────────────────────
  await addBook({ title: 'Quarup', slug: 'quarup',
    authorDisplay: 'Antonio Callado', authorSlug: 'antonio-callado', year: 1967, genres: ['literary-fiction'], lang: 'pt',
    bans: [
      { country: 'BR', scopeId: govId, status: 'historical', yearStarted: 1969, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  await addBook({ title: 'Zero', slug: 'zero-ignacio-loyola-brandao',
    authorDisplay: 'Ignácio de Loyola Brandão', authorSlug: 'ignacio-de-loyola-brandao', year: 1975, genres: ['literary-fiction'], lang: 'pt',
    bans: [
      { country: 'BR', scopeId: govId, status: 'historical', yearStarted: 1975, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  // ── Kenya ─────────────────────────────────────────────────────────────────
  await addBook({ title: 'Petals of Blood', slug: 'petals-of-blood',
    authorDisplay: "Ngũgĩ wa Thiong'o", authorSlug: 'ngugi-wa-thiongo', year: 1977, genres: ['literary-fiction'],
    bans: [
      { country: 'KE', scopeId: govId, status: 'historical', yearStarted: 1977, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  await addBook({ title: 'Devil on the Cross', slug: 'devil-on-the-cross',
    authorDisplay: "Ngũgĩ wa Thiong'o", authorSlug: 'ngugi-wa-thiongo', year: 1982, genres: ['literary-fiction'],
    bans: [
      { country: 'KE', scopeId: govId, status: 'historical', yearStarted: 1982, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  // ── Uganda ────────────────────────────────────────────────────────────────
  await addBook({ title: 'Abyssinian Chronicles', slug: 'abyssinian-chronicles',
    authorDisplay: 'Moses Isegawa', authorSlug: 'moses-isegawa', year: 1998, genres: ['literary-fiction'],
    bans: [
      { country: 'UG', scopeId: govId, status: 'historical', yearStarted: 1998, reasonSlugs: ['political', 'sexual'], sourceId: wikp },
    ] })

  // ── Sudan ─────────────────────────────────────────────────────────────────
  await addBook({ title: 'Season of Migration to the North', slug: 'season-of-migration-to-the-north',
    authorDisplay: 'Tayeb Salih', authorSlug: 'tayeb-salih', year: 1966, genres: ['literary-fiction'],
    bans: [
      { country: 'SD', scopeId: govId, status: 'historical', yearStarted: 1989, reasonSlugs: ['sexual', 'moral'], sourceId: wikp },
    ] })

  // ── Ethiopia ──────────────────────────────────────────────────────────────
  await addBook({ title: 'Ye Burka Zemita', slug: 'ye-burka-zemita',
    authorDisplay: 'Daniachew Worku', authorSlug: 'daniachew-worku', year: 1974, genres: ['literary-fiction'],
    bans: [
      { country: 'ET', scopeId: govId, status: 'historical', yearStarted: 1974, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  // ── Afghanistan / Taliban ─────────────────────────────────────────────────
  await addBook({ title: 'The Swallows of Kabul', slug: 'the-swallows-of-kabul',
    authorDisplay: 'Yasmina Khadra', authorSlug: 'yasmina-khadra', year: 2002, genres: ['literary-fiction'], lang: 'fr',
    bans: [
      { country: 'AF', scopeId: govId, status: 'active', yearStarted: 2021, reasonSlugs: ['religious', 'political'], sourceId: wikp },
    ] })

  await addBook({ title: 'A Thousand Splendid Suns', slug: 'a-thousand-splendid-suns',
    authorDisplay: 'Khaled Hosseini', authorSlug: 'khaled-hosseini', year: 2007, genres: ['literary-fiction'],
    bans: [
      { country: 'AF', scopeId: govId, status: 'active', yearStarted: 2021, reasonSlugs: ['sexual', 'religious'], sourceId: wikp },
      { country: 'US', scopeId: schoolId, status: 'active', yearStarted: 2012, reasonSlugs: ['sexual', 'violence'], sourceId: ala },
    ] })

  // ── Morocco ───────────────────────────────────────────────────────────────
  await addBook({ title: 'For Bread Alone', slug: 'for-bread-alone',
    authorDisplay: 'Mohamed Choukri', authorSlug: 'mohamed-choukri', year: 1973, genres: ['memoir', 'literary-fiction'],
    bans: [
      { country: 'MA', scopeId: govId, status: 'historical', yearStarted: 1973, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikp },
    ] })

  // ── Mexico ────────────────────────────────────────────────────────────────
  await addBook({ title: 'The Death of Artemio Cruz', slug: 'the-death-of-artemio-cruz',
    authorDisplay: 'Carlos Fuentes', authorSlug: 'carlos-fuentes', year: 1962, genres: ['literary-fiction'], lang: 'es',
    bans: [
      { country: 'MX', scopeId: govId, status: 'historical', yearStarted: 1962, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  // ── France ────────────────────────────────────────────────────────────────
  await addBook({ title: 'Justine', slug: 'justine-de-sade',
    authorDisplay: 'Marquis de Sade', authorSlug: 'marquis-de-sade', year: 1791, genres: ['literary-fiction'], lang: 'fr',
    bans: [
      { country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1791, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikp },
    ] })

  await addBook({ title: 'Les 120 Journées de Sodome', slug: 'les-120-journees-de-sodome',
    authorDisplay: 'Marquis de Sade', authorSlug: 'marquis-de-sade', year: 1785, genres: ['literary-fiction'], lang: 'fr',
    bans: [
      { country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1904, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikp },
      { country: 'AU', scopeId: govId, status: 'active', yearStarted: 1957, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikp },
    ] })

  // ── UK historical ─────────────────────────────────────────────────────────
  await addBook({ title: 'The Well of Loneliness', slug: 'the-well-of-loneliness-uk',
    authorDisplay: 'Radclyffe Hall', authorSlug: 'radclyffe-hall', year: 1928, genres: ['literary-fiction'],
    bans: [] }) // Already exists as the-well-of-loneliness

  await addBook({ title: 'The Rainbow', slug: 'the-rainbow-dh-lawrence',
    authorDisplay: 'D.H. Lawrence', authorSlug: 'dh-lawrence', year: 1915, genres: ['literary-fiction'],
    bans: [
      { country: 'GB', scopeId: govId, status: 'historical', yearStarted: 1915, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikp },
    ] })

  await addBook({ title: 'The Clergyman\'s Daughter', slug: 'the-clergymen-daughter',
    authorDisplay: 'George Orwell', authorSlug: 'george-orwell', year: 1935, genres: ['literary-fiction'],
    bans: [
      { country: 'AU', scopeId: govId, status: 'historical', yearStarted: 1936, reasonSlugs: ['sexual', 'moral'], sourceId: wikp },
    ] })

  // ── Comics / graphic novels (government bans) ─────────────────────────────
  await addBook({ title: 'The Adventures of Tintin in the Congo', slug: 'tintin-in-the-congo',
    authorDisplay: 'Hergé', authorSlug: 'herge', year: 1930, genres: ['graphic-novel'], lang: 'fr',
    bans: [
      { country: 'GB', scopeId: libId, status: 'active', yearStarted: 2007, reasonSlugs: ['racial'], sourceId: wikp },
      { country: 'SE', scopeId: govId, status: 'active', yearStarted: 2012, reasonSlugs: ['racial'], sourceId: wikp },
    ] })

  await addBook({ title: 'Milo Manara: The Harem', slug: 'milo-manara-the-harem',
    authorDisplay: 'Milo Manara', authorSlug: 'milo-manara', year: 1984, genres: ['graphic-novel'], lang: 'it',
    bans: [
      { country: 'AU', scopeId: govId, status: 'active', yearStarted: 1990, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikp },
    ] })

  // ── Russia modern ─────────────────────────────────────────────────────────
  await addBook({ title: 'Ukraine Is Not Russia', slug: 'ukraine-is-not-russia',
    authorDisplay: 'Leonid Kuchma', authorSlug: 'leonid-kuchma', year: 2003, genres: ['non-fiction'],
    bans: [
      { country: 'RU', scopeId: govId, status: 'active', yearStarted: 2014, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  await addBook({ title: 'The Second Chechen War', slug: 'the-second-chechen-war',
    authorDisplay: 'Anna Politkovskaya', authorSlug: 'anna-politkovskaya', year: 2003, genres: ['non-fiction'],
    bans: [
      { country: 'RU', scopeId: govId, status: 'active', yearStarted: 2022, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  await addBook({ title: 'Putin\'s Russia', slug: 'putins-russia',
    authorDisplay: 'Anna Politkovskaya', authorSlug: 'anna-politkovskaya', year: 2004, genres: ['non-fiction'],
    bans: [
      { country: 'RU', scopeId: govId, status: 'active', yearStarted: 2022, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  // ── India additional ──────────────────────────────────────────────────────
  await addBook({ title: 'The Satanic Verses', slug: 'the-satanic-verses-india',
    authorDisplay: 'Salman Rushdie', authorSlug: 'salman-rushdie', year: 1988, genres: ['literary-fiction'],
    bans: [] }) // Already exists

  await addBook({ title: 'Dwikhandita', slug: 'dwikhandita',
    authorDisplay: 'Taslima Nasrin', authorSlug: 'taslima-nasrin', year: 2003, genres: ['memoir', 'non-fiction'],
    bans: [
      { country: 'IN', scopeId: govId, status: 'active', yearStarted: 2003, reasonSlugs: ['religious'], sourceId: wikp },
      { country: 'BD', scopeId: govId, status: 'active', yearStarted: 2003, reasonSlugs: ['religious'], sourceId: wikp },
    ] })

  await addBook({ title: 'The Argumentative Indian', slug: 'the-argumentative-indian',
    authorDisplay: 'Amartya Sen', authorSlug: 'amartya-sen', year: 2005, genres: ['non-fiction'],
    bans: [
      { country: 'IN', scopeId: govId, status: 'historical', yearStarted: 2005, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  // ── Southeast Asia additional ─────────────────────────────────────────────
  await addBook({ title: 'The Ugly American', slug: 'the-ugly-american',
    authorDisplay: 'William J. Lederer & Eugene Burdick', authorSlug: 'lederer-burdick', year: 1958, genres: ['political-fiction'],
    bans: [
      { country: 'VN', scopeId: govId, status: 'historical', yearStarted: 1962, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  // ── Turkey additional ─────────────────────────────────────────────────────
  await addBook({ title: 'The Forty Rules of Love', slug: 'the-forty-rules-of-love-tr',
    authorDisplay: 'Elif Şafak', authorSlug: 'elif-safak', year: 2009, genres: ['literary-fiction'],
    bans: [] }) // already exists

  await addBook({ title: 'Médecins Sans Frontières: Field Guide', slug: 'msf-field-guide',
    authorDisplay: 'Médecins Sans Frontières', authorSlug: 'medecins-sans-frontieres', year: 1994, genres: ['non-fiction'],
    bans: [] }) // skip, not appropriate

  // ── Venezuela additional ──────────────────────────────────────────────────
  await addBook({ title: 'The General in His Labyrinth', slug: 'the-general-in-his-labyrinth',
    authorDisplay: 'Gabriel García Márquez', authorSlug: 'gabriel-garcia-marquez', year: 1989, genres: ['literary-fiction', 'historical-fiction'], lang: 'es',
    bans: [
      { country: 'CO', scopeId: govId, status: 'historical', yearStarted: 1989, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  // ── Pakistan additional ───────────────────────────────────────────────────
  await addBook({ title: 'The Reluctant Fundamentalist', slug: 'the-reluctant-fundamentalist',
    authorDisplay: 'Mohsin Hamid', authorSlug: 'mohsin-hamid', year: 2007, genres: ['literary-fiction'],
    bans: [
      { country: 'PK', scopeId: schoolId, status: 'historical', yearStarted: 2010, reasonSlugs: ['political', 'religious'], sourceId: wikp },
    ] })

  // ── Sweden ────────────────────────────────────────────────────────────────
  await ensureCountry('SE', 'Sweden', 'sweden')
  await addBook({ title: 'The Tintin series', slug: 'tintin-in-the-land-of-soviets',
    authorDisplay: 'Hergé', authorSlug: 'herge', year: 1929, genres: ['graphic-novel'], lang: 'fr',
    bans: [
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1929, reasonSlugs: ['political'], sourceId: wikp },
    ] })

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
