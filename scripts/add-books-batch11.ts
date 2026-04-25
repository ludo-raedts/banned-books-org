import { adminClient } from '../src/lib/supabase'

/**
 * Batch 11 — Africa, Latin America, Southeast Asia, Middle East, India
 *
 * Based on agent research covering:
 *  - SE Asia: Vietnam dissident lit, Philippines colonial & Marcos era, Pramoedya House of Glass
 *  - Africa: Ngũgĩ Kenya bans, Mozambique colonial
 *  - Middle East: Egypt (Mahfouz), Jordan, Kuwait, Tunisia, Algeria, UAE
 *  - Brazil: military dictatorship banned literature (1964-1985)
 *  - India: national and state-level bans
 */

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
      coverUrl:    doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      workId:      doc?.key?.replace('/works/', '') ?? null,
      publishYear: doc?.first_publish_year ?? null,
    }
  } catch { return { coverUrl: null, workId: null, publishYear: null } }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function upsertSource(name: string, url: string) {
  const { data } = await supabase.from('ban_sources').upsert(
    { source_name: name, source_url: url, source_type: 'web' },
    { onConflict: 'source_url' }
  ).select('id').single()
  return data?.id as number | null
}

async function ensureCountry(code: string, name: string, slug: string) {
  const { data } = await supabase.from('countries').select('code').eq('code', code).single()
  if (!data) {
    await supabase.from('countries').insert({ code, name_en: name, slug })
    console.log(`Added country: ${name}`)
  }
}

async function main() {
  const { data: scopes }          = await supabase.from('scopes').select('id, slug')
  const { data: reasons }         = await supabase.from('reasons').select('id, slug')
  const { data: existing }        = await supabase.from('books').select('slug')
  const { data: existingAuthors } = await supabase.from('authors').select('id, slug')

  const existingSlugs = new Set((existing ?? []).map(b => b.slug))
  const authorMap     = new Map((existingAuthors ?? []).map(a => [a.slug, a.id as number]))

  const scopeId  = (slug: string) => scopes!.find(s => s.slug === slug)!.id
  const reasonId = (slug: string) => {
    const r = reasons!.find(r => r.slug === slug)
    if (!r) throw new Error(`Reason slug missing from DB: "${slug}"`)
    return r.id
  }

  const govId = scopeId('government')
  const libId = scopeId('public_library')

  const wikpSource = await upsertSource('Wikipedia – List of books banned by governments', 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments')
  const penSource  = await upsertSource('PEN International', 'https://pen.org/banned-books/')

  // Countries
  await ensureCountry('MZ', 'Mozambique', 'mozambique')
  await ensureCountry('JO', 'Jordan', 'jordan')
  await ensureCountry('KW', 'Kuwait', 'kuwait')
  await ensureCountry('TN', 'Tunisia', 'tunisia')
  await ensureCountry('DZ', 'Algeria', 'algeria')
  await ensureCountry('MM', 'Myanmar', 'myanmar')

  async function getOrCreateAuthor(displayName: string, slug: string): Promise<number | null> {
    if (authorMap.has(slug)) return authorMap.get(slug)!
    const { data, error } = await supabase.from('authors').insert({
      slug, display_name: displayName,
    }).select('id').single()
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
    year: number; genres: string[]; lang?: string
    bans: { country: string; scopeId: number; status: string; yearStarted: number; reasonSlugs: string[]; sourceId: number | null }[]
  }) {
    if (existingSlugs.has(opts.slug)) { console.log(`  [skip] ${opts.title}`); return }
    process.stdout.write(`  ${opts.title}... `)
    const ol = await fetchOL(opts.title, opts.authorDisplay)
    await sleep(COVER_DELAY_MS)
    console.log(ol.coverUrl ? 'ok' : 'no cover')

    const authorId = await getOrCreateAuthor(opts.authorDisplay, opts.authorSlug)

    const { data: book, error: be } = await supabase.from('books').insert({
      title: opts.title, slug: opts.slug,
      original_language: opts.lang ?? 'en',
      first_published_year: opts.year, ai_drafted: false, genres: opts.genres,
      cover_url: ol.coverUrl, openlibrary_work_id: ol.workId,
    }).select('id').single()
    if (be) { console.error(`  [error] ${opts.title}: ${be.message}`); return }

    existingSlugs.add(opts.slug)
    if (authorId) await supabase.from('book_authors').insert({ book_id: book.id, author_id: authorId })

    for (const ban of opts.bans) {
      const { data: newBan, error: bane } = await supabase.from('bans').insert({
        book_id: book.id, country_code: ban.country, scope_id: ban.scopeId,
        action_type: 'banned', status: ban.status, year_started: ban.yearStarted,
      }).select('id').single()
      if (bane) { console.error(`  [ban error] ${ban.country}: ${bane.message}`); continue }
      for (const rs of ban.reasonSlugs) {
        await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: reasonId(rs) })
      }
      if (ban.sourceId) {
        await supabase.from('ban_source_links').insert({ ban_id: newBan.id, source_id: ban.sourceId })
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // SOUTHEAST ASIA — Philippines
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // José Rizal's sequel to Noli Me Tángere; both works got Rizal executed in 1896
    // and helped spark Philippine revolution against Spanish colonial rule.
    title: 'El Filibusterismo',
    slug: 'el-filibusterismo',
    authorDisplay: 'José Rizal',
    authorSlug: 'jose-rizal',
    year: 1891, genres: ['literary-fiction', 'historical-fiction'], lang: 'es',
    bans: [
      { country: 'PH', scopeId: govId, status: 'historical', yearStarted: 1891, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Marcos's former press secretary turned whistleblower. Book stripped from US stores;
    // banned in the Philippines. Mijares disappeared in 1977.
    title: 'The Conjugal Dictatorship of Ferdinand and Imelda Marcos',
    slug: 'the-conjugal-dictatorship',
    authorDisplay: 'Primitivo Mijares',
    authorSlug: 'primitivo-mijares',
    year: 1976, genres: ['non-fiction', 'biography'], lang: 'en',
    bans: [
      { country: 'PH', scopeId: govId, status: 'historical', yearStarted: 1976, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Critical biography of Imelda Marcos; immediately banned under Marcos Martial Law 1972
    title: 'The Untold Story of Imelda Marcos',
    slug: 'the-untold-story-of-imelda-marcos',
    authorDisplay: 'Carmen Navarro Pedrosa',
    authorSlug: 'carmen-navarro-pedrosa',
    year: 1969, genres: ['non-fiction', 'biography'], lang: 'en',
    bans: [
      { country: 'PH', scopeId: govId, status: 'historical', yearStarted: 1972, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // SOUTHEAST ASIA — Vietnam
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // 40,000 copies sold before seizure. Dương Thu Hương was a Communist Party member
    // who fought in the Vietnam War — her dissident works made her an outcast.
    title: 'Paradise of the Blind',
    slug: 'paradise-of-the-blind',
    authorDisplay: 'Dương Thu Hương',
    authorSlug: 'duong-thu-huong',
    year: 1988, genres: ['literary-fiction'], lang: 'vi',
    bans: [
      { country: 'VN', scopeId: govId, status: 'active', yearStarted: 1988, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Critical of Vietnam War from dissident perspective. Author expelled from Communist Party
    // and imprisoned without trial after publication.
    title: 'Novel Without a Name',
    slug: 'novel-without-a-name',
    authorDisplay: 'Dương Thu Hương',
    authorSlug: 'duong-thu-huong',
    year: 1990, genres: ['literary-fiction', 'war'], lang: 'vi',
    bans: [
      { country: 'VN', scopeId: govId, status: 'active', yearStarted: 1990, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Handbook on political activism; blogger and journalist Pham Doan Trang was sentenced
    // to 9 years in prison in 2021 for this and other works.
    title: 'Politics for Everyone',
    slug: 'politics-for-everyone',
    authorDisplay: 'Pham Doan Trang',
    authorSlug: 'pham-doan-trang',
    year: 2019, genres: ['non-fiction', 'politics'], lang: 'vi',
    bans: [
      { country: 'VN', scopeId: govId, status: 'active', yearStarted: 2019, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // SOUTHEAST ASIA — Indonesia (Pramoedya 4th volume)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Fourth and final volume of the Buru Quartet; completes the story of Minke's life.
    // Banned on publication; the entire Buru Quartet was banned 1981–2000.
    title: 'House of Glass',
    slug: 'house-of-glass-pramoedya',
    authorDisplay: 'Pramoedya Ananta Toer',
    authorSlug: 'pramoedya-ananta-toer',
    year: 1988, genres: ['literary-fiction', 'historical-fiction'], lang: 'id',
    bans: [
      { country: 'ID', scopeId: govId, status: 'historical', yearStarted: 1988, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Pramoedya's non-fiction exposé of government discrimination against ethnic Chinese.
    // He was jailed without trial for this book, spending 14 years on Buru Island.
    title: 'Hoa Kiau',
    slug: 'hoa-kiau',
    authorDisplay: 'Pramoedya Ananta Toer',
    authorSlug: 'pramoedya-ananta-toer',
    year: 1960, genres: ['non-fiction', 'politics'], lang: 'id',
    bans: [
      { country: 'ID', scopeId: govId, status: 'historical', yearStarted: 1960, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // AFRICA — Kenya (Ngũgĩ wa Thiong'o)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Play co-written with Ngũgĩ wa Mirii; staged in Gĩkũyũ language at community center.
    // Both playwrights were imprisoned by the Kenyan government; play banned 6 weeks after opening.
    title: "I Will Marry When I Want",
    slug: 'i-will-marry-when-i-want',
    authorDisplay: 'Ngũgĩ wa Thiong\'o',
    authorSlug: 'ngugi-wa-thiongo',
    year: 1977, genres: ['drama', 'literary-fiction'], lang: 'sw',
    bans: [
      { country: 'KE', scopeId: govId, status: 'historical', yearStarted: 1977, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Ngũgĩ wrote this novel in the Gĩkũyũ language in prison. Police reportedly
    // mistook the fictional hero Matigari for a real dissident and ordered copies seized.
    title: 'Matigari',
    slug: 'matigari',
    authorDisplay: 'Ngũgĩ wa Thiong\'o',
    authorSlug: 'ngugi-wa-thiongo',
    year: 1986, genres: ['literary-fiction'], lang: 'sw',
    bans: [
      { country: 'KE', scopeId: govId, status: 'historical', yearStarted: 1987, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // AFRICA — Mozambique
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Honwana's debut story collection; banned by Portuguese colonial authorities (PIDE).
    // The title story depicts a Black child and a white dog — an allegory for colonial violence.
    // Author was arrested and imprisoned 1964–1967.
    title: 'We Killed Mangy-Dog and Other Stories',
    slug: 'we-killed-mangy-dog',
    authorDisplay: 'Luís Bernardo Honwana',
    authorSlug: 'luis-bernardo-honwana',
    year: 1964, genres: ['short-stories', 'literary-fiction'], lang: 'pt',
    bans: [
      { country: 'MZ', scopeId: govId, status: 'historical', yearStarted: 1964, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // MIDDLE EAST — Egypt
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Mahfouz's allegorical novel depicting Islamic prophets as human characters.
    // Al-Azhar condemned it as blasphemous; banned in Egypt 1959–2006.
    // Mahfouz won the Nobel Prize in 1988; a Muslim extremist stabbed him in 1994
    // (though he survived), partly in reaction to this novel.
    title: "Children of the Alley",
    slug: 'children-of-the-alley',
    authorDisplay: 'Naguib Mahfouz',
    authorSlug: 'naguib-mahfouz',
    year: 1959, genres: ['literary-fiction'], lang: 'ar',
    bans: [
      { country: 'EG', scopeId: govId, status: 'historical', yearStarted: 1959, reasonSlugs: ['religious'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Syrian novel reprinted in Egypt in 2000; caused violent protests at Al-Azhar University.
    // Egyptian government banned it following student demonstrations.
    title: 'A Banquet for Seaweed',
    slug: 'a-banquet-for-seaweed',
    authorDisplay: 'Haidar Haidar',
    authorSlug: 'haidar-haidar',
    year: 1983, genres: ['literary-fiction'], lang: 'ar',
    bans: [
      { country: 'EG', scopeId: govId, status: 'active', yearStarted: 2000, reasonSlugs: ['religious'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // MIDDLE EAST — Jordan, Kuwait
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Palestinian-American author's novel about a Palestinian family across generations.
    // Arabic translation banned in Jordan. One of the most important Palestinian narratives.
    title: 'Morning in Jenin',
    slug: 'morning-in-jenin',
    authorDisplay: 'Susan Abulhawa',
    authorSlug: 'susan-abulhawa',
    year: 2010, genres: ['literary-fiction', 'historical-fiction'], lang: 'en',
    bans: [
      { country: 'JO', scopeId: govId, status: 'active', yearStarted: 2011, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Kuwaiti author banned in his own country. Part of a mass banning of 4,300+ books
    // by the Kuwaiti Ministry of Information 2013–2018.
    title: 'Stray Memories',
    slug: 'stray-memories',
    authorDisplay: 'Abdullah Al Busais',
    authorSlug: 'abdullah-al-busais',
    year: 2013, genres: ['literary-fiction'], lang: 'ar',
    bans: [
      { country: 'KW', scopeId: govId, status: 'active', yearStarted: 2014, reasonSlugs: ['moral'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // MIDDLE EAST — Tunisia, Algeria
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Exposé of Ben Ali's wife Leila Trabelsi's role in Tunisian politics.
    // Banned immediately; freely available after the 2011 Jasmine Revolution.
    title: 'La Régente de Carthage',
    slug: 'la-regente-de-carthage',
    authorDisplay: 'Nicolas Beau',
    authorSlug: 'nicolas-beau',
    year: 2009, genres: ['non-fiction', 'politics'], lang: 'fr',
    bans: [
      { country: 'TN', scopeId: govId, status: 'historical', yearStarted: 2009, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Algerian author's debut novel about the government's brutal suppression of Islamists.
    // Banned for revealing too much about security forces. Sansal later fell afoul of French-
    // Algerian tensions and was arrested in Algeria in 2024.
    title: 'The Oath of the Barbarians',
    slug: 'the-oath-of-the-barbarians',
    authorDisplay: 'Boualem Sansal',
    authorSlug: 'boualem-sansal',
    year: 1999, genres: ['literary-fiction', 'thriller'], lang: 'fr',
    bans: [
      { country: 'DZ', scopeId: govId, status: 'historical', yearStarted: 2000, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // MIDDLE EAST — UAE
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Malayalam novel about an Indian migrant's ordeal as a slave laborer in the Gulf.
    // The Arabic translation was banned in Saudi Arabia and UAE; the author himself was
    // detained briefly in the UAE in 2015. "Aatujeevitham" means "goat life."
    title: 'Goat Days',
    slug: 'goat-days',
    authorDisplay: 'Benyamin',
    authorSlug: 'benyamin',
    year: 2008, genres: ['literary-fiction'], lang: 'ml',
    bans: [
      { country: 'AE', scopeId: govId, status: 'active', yearStarted: 2014, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'SA', scopeId: govId, status: 'active', yearStarted: 2014, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // BRAZIL — military dictatorship (1964–1985)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Rubem Fonseca's short story collection. The graphic violence in the title story
    // "Feliz Ano Novo" led to the book being banned under Decree-Law 1077. The ban was
    // revoked in 1989 after redemocratization.
    title: 'Feliz Ano Novo',
    slug: 'feliz-ano-novo',
    authorDisplay: 'Rubem Fonseca',
    authorSlug: 'rubem-fonseca',
    year: 1975, genres: ['short-stories', 'literary-fiction'], lang: 'pt',
    bans: [
      { country: 'BR', scopeId: govId, status: 'historical', yearStarted: 1976, reasonSlugs: ['violence', 'moral'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Novel depicting guerrilla resistance to the Brazilian military regime; author
    // Renato Tapajós was imprisoned upon publication. Based in part on his own experience.
    title: 'Em Câmara Lenta',
    slug: 'em-camara-lenta',
    authorDisplay: 'Renato Tapajós',
    authorSlug: 'renato-tapajos',
    year: 1977, genres: ['literary-fiction', 'politics'], lang: 'pt',
    bans: [
      { country: 'BR', scopeId: govId, status: 'historical', yearStarted: 1977, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Pioneer of Brazilian LGBT literature. The military dictatorship banned 36 of
    // Cassandra Rios's books; she was the most banned author in Brazilian history.
    // This was among her first banned titles.
    title: 'Tessa, a Gata',
    slug: 'tessa-a-gata',
    authorDisplay: 'Cassandra Rios',
    authorSlug: 'cassandra-rios',
    year: 1965, genres: ['literary-fiction'], lang: 'pt',
    bans: [
      { country: 'BR', scopeId: govId, status: 'historical', yearStarted: 1968, reasonSlugs: ['lgbtq', 'sexual'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // INDIA — national and state-level bans
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Pamphlet depicting the Prophet Muhammad's marriages in satirical terms; its publication
    // caused communal riots. One of the first formal book bans in British India.
    title: 'Rangila Rasul',
    slug: 'rangila-rasul',
    authorDisplay: 'M.A. Chamupati',
    authorSlug: 'ma-chamupati',
    year: 1924, genres: ['non-fiction'], lang: 'hi',
    bans: [
      { country: 'IN', scopeId: govId, status: 'historical', yearStarted: 1924, reasonSlugs: ['religious'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Urdu short story collection by Progressive Writers Association founders;
    // criticized religious hypocrisy. Banned by British colonial India under pressure
    // from Muslim religious leaders following public protests.
    title: 'Angarey',
    slug: 'angarey',
    authorDisplay: 'Sajjad Zaheer',
    authorSlug: 'sajjad-zaheer',
    year: 1932, genres: ['short-stories', 'literary-fiction'], lang: 'ur',
    bans: [
      { country: 'IN', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['religious'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Satirical retelling of the Ramayana; import prohibited in India for offending
    // Hindu religious sentiments. Menen was an Anglo-Indian novelist.
    title: 'Rama Retold',
    slug: 'rama-retold',
    authorDisplay: 'Aubrey Menen',
    authorSlug: 'aubrey-menen',
    year: 1954, genres: ['literary-fiction', 'satire'], lang: 'en',
    bans: [
      { country: 'IN', scopeId: govId, status: 'historical', yearStarted: 1955, reasonSlugs: ['religious'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Stanley Wolpert's fictional account of Gandhi's assassination. Indian government
    // banned it for depicting security lapses; the film adaptation was also banned.
    title: 'Nine Hours to Rama',
    slug: 'nine-hours-to-rama',
    authorDisplay: 'Stanley Wolpert',
    authorSlug: 'stanley-wolpert',
    year: 1962, genres: ['historical-fiction'], lang: 'en',
    bans: [
      { country: 'IN', scopeId: govId, status: 'historical', yearStarted: 1962, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // James Laine's scholarly biography of Maratha king Shivaji; included disputed remarks
    // about his parentage. Maharashtra state banned it; the Supreme Court revoked the ban in 2010.
    // The Bhandarkar Oriental Research Institute, which provided source material, was vandalized.
    title: 'Shivaji: Hindu King in Islamic India',
    slug: 'shivaji-hindu-king',
    authorDisplay: 'James Laine',
    authorSlug: 'james-laine',
    year: 2003, genres: ['non-fiction', 'biography'], lang: 'en',
    bans: [
      { country: 'IN', scopeId: govId, status: 'historical', yearStarted: 2004, reasonSlugs: ['religious', 'political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // BJP politician Jaswant Singh's sympathetic portrayal of Muhammad Ali Jinnah.
    // Gujarat state banned it and expelled Singh from the party. The Gujarat High Court
    // overturned the ban.
    title: 'Jinnah: India, Partition, Independence',
    slug: 'jinnah-india-partition-independence',
    authorDisplay: 'Jaswant Singh',
    authorSlug: 'jaswant-singh',
    year: 2009, genres: ['non-fiction', 'biography'], lang: 'en',
    bans: [
      { country: 'IN', scopeId: govId, status: 'historical', yearStarted: 2009, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // EXTRA BANS for books already in DB
  // ════════════════════════════════════════════════════════════════════

  // Add Animal Farm bans in Vietnam, UAE, Philippines if book exists
  const { data: animalFarm } = await supabase.from('books').select('id').eq('slug', 'animal-farm').single()
  if (animalFarm) {
    const { data: existingAfBans } = await supabase.from('bans').select('country_code').eq('book_id', animalFarm.id)
    const afCountries = new Set((existingAfBans ?? []).map(b => b.country_code))

    if (!afCountries.has('VN')) {
      const { data: ban } = await supabase.from('bans').insert({
        book_id: animalFarm.id, country_code: 'VN', scope_id: govId,
        action_type: 'banned', status: 'active', year_started: 1945,
      }).select('id').single()
      if (ban) { await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId('political') }); console.log('  Added Animal Farm / VN ban') }
    }
    if (!afCountries.has('AE')) {
      const { data: ban } = await supabase.from('bans').insert({
        book_id: animalFarm.id, country_code: 'AE', scope_id: libId,
        action_type: 'banned', status: 'active', year_started: 2002,
      }).select('id').single()
      if (ban) { await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId('political') }); console.log('  Added Animal Farm / AE ban') }
    }
  }

  // Add A Farewell to Arms ban in Italy (1929 Mussolini)
  const { data: farewell } = await supabase.from('books').select('id').eq('slug', 'a-farewell-to-arms').single()
  if (farewell) {
    const { data: existingFBans } = await supabase.from('bans').select('country_code').eq('book_id', farewell.id)
    const fCountries = new Set((existingFBans ?? []).map(b => b.country_code))
    if (!fCountries.has('IT')) {
      const { data: ban } = await supabase.from('bans').insert({
        book_id: farewell.id, country_code: 'IT', scope_id: govId,
        action_type: 'banned', status: 'historical', year_started: 1929,
      }).select('id').single()
      if (ban) { await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId('political') }); console.log('  Added A Farewell to Arms / IT ban') }
    }
  }

  // Add One Hundred Years of Solitude ban in Kuwait
  const { data: solitude } = await supabase.from('books').select('id').eq('slug', 'one-hundred-years-of-solitude').single()
  if (solitude) {
    const { data: existingOBans } = await supabase.from('bans').select('country_code').eq('book_id', solitude.id)
    const oCountries = new Set((existingOBans ?? []).map(b => b.country_code))
    if (!oCountries.has('KW')) {
      const { data: ban } = await supabase.from('bans').insert({
        book_id: solitude.id, country_code: 'KW', scope_id: govId,
        action_type: 'banned', status: 'active', year_started: 2014,
      }).select('id').single()
      if (ban) { await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId('sexual') }); console.log('  Added 100 Years of Solitude / KW ban') }
    }
  }

  // Add The Satanic Verses bans in India, Kenya, Tanzania if not present
  const { data: satanic } = await supabase.from('books').select('id').eq('slug', 'the-satanic-verses').single()
  if (satanic) {
    const { data: existingSBans } = await supabase.from('bans').select('country_code').eq('book_id', satanic.id)
    const sCountries = new Set((existingSBans ?? []).map(b => b.country_code))
    for (const [cc, year] of [['IN', 1988], ['KE', 1989], ['TZ', 1989], ['ID', 1989]] as [string, number][]) {
      if (!sCountries.has(cc)) {
        const { data: ban } = await supabase.from('bans').insert({
          book_id: satanic.id, country_code: cc, scope_id: govId,
          action_type: 'banned', status: 'active', year_started: year,
        }).select('id').single()
        if (ban) { await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId('religious') }); console.log(`  Added The Satanic Verses / ${cc} ban`) }
      }
    }
  }

  // Add The Da Vinci Code ban in Jordan
  const { data: davinci } = await supabase.from('books').select('id').eq('slug', 'the-da-vinci-code').single()
  if (davinci) {
    const { data: existingDBans } = await supabase.from('bans').select('country_code').eq('book_id', davinci.id)
    const dCountries = new Set((existingDBans ?? []).map(b => b.country_code))
    if (!dCountries.has('JO')) {
      const { data: ban } = await supabase.from('bans').insert({
        book_id: davinci.id, country_code: 'JO', scope_id: govId,
        action_type: 'banned', status: 'active', year_started: 2006,
      }).select('id').single()
      if (ban) { await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId('religious') }); console.log('  Added Da Vinci Code / JO ban') }
    }
  }

  const { data: finalCount } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${finalCount}`)
}

main().catch(console.error)
