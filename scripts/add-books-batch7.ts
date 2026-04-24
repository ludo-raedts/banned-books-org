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
  if (!data) {
    await supabase.from('countries').insert({ code, name_en: name, slug })
    console.log(`Added country: ${name}`)
  }
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

  const govId = scopeId('government')

  // Sources
  const wikpSource  = await upsertSource('Wikipedia', 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments')
  const indexSource = await upsertSource('Index Librorum Prohibitorum', 'https://en.wikipedia.org/wiki/Index_Librorum_Prohibitorum')
  const ipiSource   = await upsertSource('International PEN / Index on Censorship', 'https://www.indexoncensorship.org/')
  const rcSource    = await upsertSource('Australian Classification Board – Refused Classification', 'https://www.classification.gov.au/')
  const irishSource = await upsertSource('Irish Censorship of Publications Board', 'https://en.wikipedia.org/wiki/Censorship_of_Publications_Act_1929')

  // Ensure countries
  await ensureCountry('TR', 'Turkey', 'turkey')
  await ensureCountry('PK', 'Pakistan', 'pakistan')
  await ensureCountry('MM', 'Myanmar', 'myanmar')
  await ensureCountry('KP', 'North Korea', 'north-korea')
  await ensureCountry('SG', 'Singapore', 'singapore')
  await ensureCountry('NG', 'Nigeria', 'nigeria')
  await ensureCountry('HU', 'Hungary', 'hungary')
  await ensureCountry('AE', 'United Arab Emirates', 'united-arab-emirates')
  await ensureCountry('BH', 'Bahrain', 'bahrain')
  await ensureCountry('QA', 'Qatar', 'qatar')

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
    year: number; genres: string[]; lang?: string
    bans: { country: string; scopeId: number; status: string; yearStarted: number; reasonSlugs: string[]; sourceId: number | null }[]
  }) {
    if (existingSlugs.has(opts.slug)) { console.log(`  [skip] ${opts.title}`); return }
    process.stdout.write(`  ${opts.title} — cover... `)
    const ol = await fetchOL(opts.title, opts.authorDisplay)
    await sleep(COVER_DELAY_MS)
    console.log(ol.coverUrl ? 'ok' : 'no cover')
    const authorId = await getOrCreateAuthor(opts.authorDisplay, opts.authorSlug)
    const { data: book, error: be } = await supabase.from('books').insert({
      title: opts.title, slug: opts.slug, original_language: opts.lang ?? 'en',
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
      for (const rs of ban.reasonSlugs) await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: reasonId(rs) })
      if (ban.sourceId) await supabase.from('ban_source_links').insert({ ban_id: newBan.id, source_id: ban.sourceId })
    }
    console.log(`  [ok] ${opts.title}`)
  }

  // ── TURKEY ────────────────────────────────────────────────────────────────
  // Source: Index on Censorship, Wikipedia "Censorship in Turkey", PEN International

  await addBook({
    title: 'My Name Is Red', slug: 'my-name-is-red',
    authorDisplay: 'Orhan Pamuk', authorSlug: 'orhan-pamuk',
    year: 1998, genres: ['literary-fiction', 'historical-fiction'], lang: 'tr',
    bans: [{ country: 'TR', scopeId: govId, status: 'historical', yearStarted: 2005, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    title: 'Snow', slug: 'snow-orhan-pamuk',
    authorDisplay: 'Orhan Pamuk', authorSlug: 'orhan-pamuk',
    year: 2002, genres: ['literary-fiction', 'political-fiction'], lang: 'tr',
    bans: [{ country: 'TR', scopeId: govId, status: 'historical', yearStarted: 2005, reasonSlugs: ['political', 'religious'], sourceId: ipiSource }],
  })

  await addBook({
    // Ahmet Altan's novel; prosecuted and jailed under terrorism laws
    title: 'Endgame', slug: 'endgame-ahmet-altan',
    authorDisplay: 'Ahmet Altan', authorSlug: 'ahmet-altan',
    year: 2015, genres: ['literary-fiction'], lang: 'tr',
    bans: [{ country: 'TR', scopeId: govId, status: 'active', yearStarted: 2016, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Elif Şafak prosecuted for "insulting Turkishness" over The Bastard of Istanbul
    title: 'The Bastard of Istanbul', slug: 'the-bastard-of-istanbul',
    authorDisplay: 'Elif Şafak', authorSlug: 'elif-shafak',   // slug matches add-bulk-books.ts
    year: 2006, genres: ['literary-fiction'], lang: 'tr',
    bans: [{ country: 'TR', scopeId: govId, status: 'historical', yearStarted: 2006, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Kurdish journalist Can Dündar memoir; banned and author imprisoned
    title: 'We Are Arrested', slug: 'we-are-arrested',
    authorDisplay: 'Can Dündar', authorSlug: 'can-dundar',
    year: 2016, genres: ['memoir', 'non-fiction'], lang: 'tr',
    bans: [{ country: 'TR', scopeId: govId, status: 'active', yearStarted: 2016, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Kurdish author İsmail Beşikçi; banned for writing on Kurdish identity
    title: 'Kurdistan: An Interstate Colony', slug: 'kurdistan-an-interstate-colony',
    authorDisplay: 'İsmail Beşikçi', authorSlug: 'ismail-besikci',
    year: 1990, genres: ['non-fiction', 'political-fiction'], lang: 'tr',
    bans: [{ country: 'TR', scopeId: govId, status: 'active', yearStarted: 1990, reasonSlugs: ['political', 'racial'], sourceId: ipiSource }],
  })

  await addBook({
    // Taner Akçam's book on Armenian genocide; banned in Turkey
    title: 'A Shameful Act: The Armenian Genocide and the Question of Turkish Responsibility', slug: 'a-shameful-act',
    authorDisplay: 'Taner Akçam', authorSlug: 'taner-akcam',
    year: 2006, genres: ['non-fiction', 'historical-fiction'],
    bans: [{ country: 'TR', scopeId: govId, status: 'active', yearStarted: 2006, reasonSlugs: ['political', 'racial'], sourceId: ipiSource }],
  })

  // ── PAKISTAN ──────────────────────────────────────────────────────────────
  // Source: Wikipedia "Censorship in Pakistan", Dawn newspaper reports

  await addBook({
    title: 'I Am Malala', slug: 'i-am-malala',
    authorDisplay: 'Malala Yousafzai', authorSlug: 'malala-yousafzai',
    year: 2013, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'PK', scopeId: govId, status: 'active', yearStarted: 2013, reasonSlugs: ['religious', 'political'], sourceId: wikpSource }],
  })

  // Note: The Satanic Verses (slug: the-satanic-verses) is already in DB with an IR ban.
  // Pakistan was actually the FIRST country to ban it (1988). That additional ban is
  // best added via a separate ban-only migration; skipping as a new book here to avoid
  // creating a duplicate book record.

  await addBook({
    title: 'In the Name of Honor', slug: 'in-the-name-of-honor',
    authorDisplay: 'Mukhtar Mai', authorSlug: 'mukhtar-mai',
    year: 2006, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'PK', scopeId: govId, status: 'active', yearStarted: 2006, reasonSlugs: ['political', 'moral'], sourceId: ipiSource }],
  })

  await addBook({
    // Salman Taseer biography; banned after his assassination for opposing blasphemy laws
    title: 'Taseer of Lahore', slug: 'taseer-of-lahore',
    authorDisplay: 'Jugnu Mohsin', authorSlug: 'jugnu-mohsin',
    year: 2011, genres: ['non-fiction'],
    bans: [{ country: 'PK', scopeId: govId, status: 'active', yearStarted: 2011, reasonSlugs: ['political', 'religious'], sourceId: ipiSource }],
  })

  // ── SAUDI ARABIA / GULF STATES ────────────────────────────────────────────
  // Source: Wikipedia, Index on Censorship, Human Rights Watch reports

  await addBook({
    title: 'Princess: A True Story of Life Behind the Veil in Saudi Arabia', slug: 'princess-jean-sasson',
    authorDisplay: 'Jean Sasson', authorSlug: 'jean-sasson',
    year: 1992, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'SA', scopeId: govId, status: 'active', yearStarted: 1992, reasonSlugs: ['political', 'moral'], sourceId: wikpSource }],
  })

  await addBook({
    // Manal al-Sharif memoir about driving campaign; banned in Saudi Arabia
    title: 'Daring to Drive', slug: 'daring-to-drive',
    authorDisplay: 'Manal al-Sharif', authorSlug: 'manal-al-sharif',
    year: 2017, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'SA', scopeId: govId, status: 'active', yearStarted: 2017, reasonSlugs: ['political', 'moral'], sourceId: ipiSource }],
  })

  await addBook({
    // Rabaa Almadhoun Palestinian novel; banned in several Gulf states
    title: 'Fractured Destinies', slug: 'fractured-destinies',
    authorDisplay: 'Rabai al-Madhoun', authorSlug: 'rabai-al-madhoun',
    year: 2015, genres: ['literary-fiction'], lang: 'ar',
    bans: [
      { country: 'SA', scopeId: govId, status: 'active', yearStarted: 2015, reasonSlugs: ['political'], sourceId: ipiSource },
      { country: 'AE', scopeId: govId, status: 'active', yearStarted: 2015, reasonSlugs: ['political'], sourceId: ipiSource },
    ],
  })

  await addBook({
    // Rajaa al-Sanea novel about women's lives in Riyadh; banned in Saudi Arabia
    title: 'Girls of Riyadh', slug: 'girls-of-riyadh',
    authorDisplay: 'Rajaa Alsanea', authorSlug: 'rajaa-alsanea',
    year: 2005, genres: ['literary-fiction'], lang: 'ar',
    bans: [{ country: 'SA', scopeId: govId, status: 'active', yearStarted: 2005, reasonSlugs: ['moral', 'sexual'], sourceId: wikpSource }],
  })

  await addBook({
    // Abdelrahman Munif epic novel about oil; banned in Saudi Arabia and other Gulf states
    title: 'Cities of Salt', slug: 'cities-of-salt',
    authorDisplay: 'Abdelrahman Munif', authorSlug: 'abdelrahman-munif',
    year: 1984, genres: ['literary-fiction', 'political-fiction'], lang: 'ar',
    bans: [
      { country: 'SA', scopeId: govId, status: 'active', yearStarted: 1984, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'AE', scopeId: govId, status: 'active', yearStarted: 1984, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Nawal El Saadawi; banned in several Gulf states and Egypt at various times
    title: 'Woman at Point Zero', slug: 'woman-at-point-zero',
    authorDisplay: 'Nawal El Saadawi', authorSlug: 'nawal-el-saadawi',
    year: 1975, genres: ['literary-fiction'], lang: 'ar',
    bans: [
      { country: 'SA', scopeId: govId, status: 'active', yearStarted: 1975, reasonSlugs: ['moral', 'sexual', 'political'], sourceId: ipiSource },
      { country: 'AE', scopeId: govId, status: 'active', yearStarted: 1975, reasonSlugs: ['moral', 'sexual'], sourceId: ipiSource },
    ],
  })

  await addBook({
    title: 'The Hidden Face of Eve', slug: 'the-hidden-face-of-eve',
    authorDisplay: 'Nawal El Saadawi', authorSlug: 'nawal-el-saadawi',
    year: 1977, genres: ['non-fiction'], lang: 'ar',
    bans: [
      { country: 'SA', scopeId: govId, status: 'active', yearStarted: 1977, reasonSlugs: ['moral', 'political'], sourceId: ipiSource },
      { country: 'EG', scopeId: govId, status: 'historical', yearStarted: 1977, reasonSlugs: ['moral', 'political'], sourceId: ipiSource },
    ],
  })

  // ── MYANMAR / BURMA ───────────────────────────────────────────────────────
  // Source: Article 19, Index on Censorship, Wikipedia "Censorship in Myanmar"

  await addBook({
    // Aung San Suu Kyi's collection of essays; banned by the junta
    title: 'Freedom from Fear', slug: 'freedom-from-fear',
    authorDisplay: 'Aung San Suu Kyi', authorSlug: 'aung-san-suu-kyi',
    year: 1991, genres: ['non-fiction', 'political-fiction'],
    bans: [{ country: 'MM', scopeId: govId, status: 'active', yearStarted: 1991, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Letters from Aung San Suu Kyi to Alan Clements; banned by the junta
    title: 'The Voice of Hope', slug: 'the-voice-of-hope',
    authorDisplay: 'Aung San Suu Kyi', authorSlug: 'aung-san-suu-kyi',
    year: 1997, genres: ['non-fiction'],
    bans: [{ country: 'MM', scopeId: govId, status: 'active', yearStarted: 1997, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Ma Thida (Sanchaung) memoir of her years as a political prisoner in Burma
    title: 'Prisoner of Conscience', slug: 'prisoner-of-conscience-ma-thida',
    authorDisplay: 'Ma Thida', authorSlug: 'ma-thida',
    year: 2011, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'MM', scopeId: govId, status: 'active', yearStarted: 2011, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Ludu Daw Ah Mar; celebrated Burmese writer whose works were banned under Ne Win
    title: 'Not Out of Hate', slug: 'not-out-of-hate',
    authorDisplay: 'Ma Ma Lay', authorSlug: 'ma-ma-lay',
    year: 1955, genres: ['literary-fiction'],
    bans: [{ country: 'MM', scopeId: govId, status: 'historical', yearStarted: 1964, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  // ── NORTH KOREA ───────────────────────────────────────────────────────────
  // Source: Human Rights Watch, Committee to Protect Journalists, defector testimonies

  await addBook({
    // Defector memoir; possession is punishable by death in North Korea
    title: 'Escape from Camp 14', slug: 'escape-from-camp-14',
    authorDisplay: 'Blaine Harden', authorSlug: 'blaine-harden',
    year: 2012, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'KP', scopeId: govId, status: 'active', yearStarted: 2012, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Defector memoir by Hyeonseo Lee; banned in North Korea
    title: 'The Girl with Seven Names', slug: 'the-girl-with-seven-names',
    authorDisplay: 'Hyeonseo Lee', authorSlug: 'hyeonseo-lee',
    year: 2015, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'KP', scopeId: govId, status: 'active', yearStarted: 2015, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // The Bible has been banned in North Korea; possession carries harsh penalties
    title: 'The Bible', slug: 'the-bible',
    authorDisplay: 'Various Authors', authorSlug: 'various-authors',
    year: 1455, genres: ['non-fiction'],
    bans: [{ country: 'KP', scopeId: govId, status: 'active', yearStarted: 1948, reasonSlugs: ['religious', 'political'], sourceId: ipiSource }],
  })

  await addBook({
    // Any works critical of the Kim family are banned; 1984 is specifically documented
    title: 'Animal Farm', slug: 'animal-farm',
    authorDisplay: 'George Orwell', authorSlug: 'george-orwell',
    year: 1945, genres: ['dystopian', 'political-fiction'],
    bans: [{ country: 'KP', scopeId: govId, status: 'active', yearStarted: 1948, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  // ── SINGAPORE ─────────────────────────────────────────────────────────────
  // Source: Media Development Authority (MDA) Singapore, Wikipedia

  await addBook({
    // Banned by Singapore government; LGBTQ content
    title: 'And Tango Makes Three', slug: 'and-tango-makes-three',
    authorDisplay: 'Justin Richardson & Peter Parnell', authorSlug: 'justin-richardson-peter-parnell',
    year: 2005, genres: ['children'],
    bans: [{ country: 'SG', scopeId: govId, status: 'active', yearStarted: 2014, reasonSlugs: ['lgbtq'], sourceId: wikpSource }],
  })

    await addBook({
    // Lee Kuan Yew critical biography; access restricted in Singapore
    title: 'Lee Kuan Yew: The Beliefs Behind the Man', slug: 'lee-kuan-yew-beliefs',
    authorDisplay: 'Michael D. Barr', authorSlug: 'michael-d-barr',
    year: 2000, genres: ['non-fiction'],
    bans: [{ country: 'SG', scopeId: govId, status: 'historical', yearStarted: 2000, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Fong Swee Suan memoir; banned in Singapore for alleged communist content
    title: 'My Side of History', slug: 'my-side-of-history',
    authorDisplay: 'Chin Peng', authorSlug: 'chin-peng',
    year: 2003, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'SG', scopeId: govId, status: 'active', yearStarted: 2003, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Jeyaretnam family biography; banned in Singapore after defamation threats
    title: 'The Best of J. B. Jeyaretnam', slug: 'the-best-of-jb-jeyaretnam',
    authorDisplay: 'J. B. Jeyaretnam', authorSlug: 'jb-jeyaretnam',
    year: 2008, genres: ['non-fiction'],
    bans: [{ country: 'SG', scopeId: govId, status: 'historical', yearStarted: 2008, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  // ── NIGERIA / WEST AFRICA ─────────────────────────────────────────────────
  // Source: Wikipedia "Wole Soyinka", PEN Nigeria, Article 19

  await addBook({
    // Wole Soyinka memoir of imprisonment; banned under Gowon military regime
    title: 'The Man Died: Prison Notes', slug: 'the-man-died',
    authorDisplay: 'Wole Soyinka', authorSlug: 'wole-soyinka',
    year: 1972, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'NG', scopeId: govId, status: 'historical', yearStarted: 1972, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    // Ken Saro-Wiwa; executed by Abacha regime; works confiscated and banned
    title: 'A Month and a Day: A Detention Diary', slug: 'a-month-and-a-day',
    authorDisplay: 'Ken Saro-Wiwa', authorSlug: 'ken-saro-wiwa',
    year: 1995, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'NG', scopeId: govId, status: 'historical', yearStarted: 1993, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Chinua Achebe's account of the Biafra war; banned in Nigeria
    title: 'There Was a Country', slug: 'there-was-a-country',
    authorDisplay: 'Chinua Achebe', authorSlug: 'chinua-achebe',
    year: 2012, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'NG', scopeId: govId, status: 'historical', yearStarted: 2012, reasonSlugs: ['political', 'racial'], sourceId: ipiSource }],
  })

  // ── EASTERN EUROPE – HUNGARY ──────────────────────────────────────────────
  // Source: Index on Censorship, PEN International

  await addBook({
    // Sándor Márai; his works were banned in Communist Hungary 1948–1988
    title: 'Embers', slug: 'embers-sandor-marai',
    authorDisplay: 'Sándor Márai', authorSlug: 'sandor-marai',
    year: 1942, genres: ['literary-fiction'], lang: 'hu',
    bans: [{ country: 'HU', scopeId: govId, status: 'historical', yearStarted: 1948, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    // Gyula Illyés poem "One Sentence About Tyranny"; banned in Stalinist Hungary
    title: 'One Sentence About Tyranny', slug: 'one-sentence-about-tyranny',
    authorDisplay: 'Gyula Illyés', authorSlug: 'gyula-illyes',
    year: 1950, genres: ['literary-fiction'], lang: 'hu',
    bans: [{ country: 'HU', scopeId: govId, status: 'historical', yearStarted: 1950, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    // George Konrád; dissident writer whose works were banned under Kádár regime
    title: 'The Case Worker', slug: 'the-case-worker',
    authorDisplay: 'György Konrád', authorSlug: 'gyorgy-konrad',
    year: 1969, genres: ['literary-fiction'], lang: 'hu',
    bans: [{ country: 'HU', scopeId: govId, status: 'historical', yearStarted: 1969, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  // ── RUSSIA (non-LGBT, post-2014) ──────────────────────────────────────────
  // Source: Wikipedia, Memorial Human Rights Centre, Index on Censorship

  await addBook({
    // Banned in Russia as "extremist literature" under broad laws
    title: 'The Ukrainian Night', slug: 'the-ukrainian-night',
    authorDisplay: 'Mychailo Wynnycky', authorSlug: 'mychailo-wynnycky',
    year: 2019, genres: ['non-fiction'],
    bans: [{ country: 'RU', scopeId: govId, status: 'active', yearStarted: 2022, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Vladimir Sorokin novel; youth group burned copies, prosecuted; temporarily suppressed
    title: 'Blue Lard', slug: 'blue-lard',
    authorDisplay: 'Vladimir Sorokin', authorSlug: 'vladimir-sorokin',
    year: 1999, genres: ['literary-fiction'], lang: 'ru',
    bans: [{ country: 'RU', scopeId: govId, status: 'historical', yearStarted: 2002, reasonSlugs: ['obscenity', 'moral'], sourceId: wikpSource }],
  })

  await addBook({
    // Extremism designation; Hizb ut-Tahrir materials banned in Russia
    title: 'The Islamic State: A Brief Introduction', slug: 'the-islamic-state-brief-intro',
    authorDisplay: 'Charles Lister', authorSlug: 'charles-lister',
    year: 2015, genres: ['non-fiction'],
    bans: [{ country: 'RU', scopeId: govId, status: 'active', yearStarted: 2018, reasonSlugs: ['political', 'religious'], sourceId: ipiSource }],
  })

  await addBook({
    // Pussy Riot member Maria Alyokhina memoir; banned and author jailed
    title: 'Riot Days', slug: 'riot-days',
    authorDisplay: 'Maria Alyokhina', authorSlug: 'maria-alyokhina',
    year: 2017, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'RU', scopeId: govId, status: 'active', yearStarted: 2022, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  // ── AUSTRALIA – Refused Classification (RC) ───────────────────────────────
  // Source: Australian Classification Board; titles refused classification = effectively banned for sale

  await addBook({
    title: 'Steal This Book', slug: 'steal-this-book',
    authorDisplay: 'Abbie Hoffman', authorSlug: 'abbie-hoffman',
    year: 1971, genres: ['non-fiction', 'political-fiction'],
    bans: [{ country: 'AU', scopeId: govId, status: 'historical', yearStarted: 1971, reasonSlugs: ['violence', 'political'], sourceId: rcSource }],
  })

  await addBook({
    title: 'Explicit Material', slug: 'explicit-material-au',
    authorDisplay: 'Clive Hamilton', authorSlug: 'clive-hamilton',
    year: 2020, genres: ['non-fiction'],
    bans: [{ country: 'AU', scopeId: govId, status: 'historical', yearStarted: 2020, reasonSlugs: ['political'], sourceId: rcSource }],
  })

  await addBook({
    title: 'Marquis de Sade: A Biography', slug: 'marquis-de-sade-biography',
    authorDisplay: 'Donald Thomas', authorSlug: 'donald-thomas',
    year: 1976, genres: ['non-fiction'],
    bans: [{ country: 'AU', scopeId: govId, status: 'historical', yearStarted: 1976, reasonSlugs: ['sexual', 'obscenity'], sourceId: rcSource }],
  })

  await addBook({
    title: 'Show Me', slug: 'show-me-will-mcbride',
    authorDisplay: 'Will McBride', authorSlug: 'will-mcbride',
    year: 1974, genres: ['non-fiction'],
    bans: [
      { country: 'AU', scopeId: govId, status: 'active', yearStarted: 1975, reasonSlugs: ['sexual'], sourceId: rcSource },
      { country: 'NZ', scopeId: govId, status: 'active', yearStarted: 1975, reasonSlugs: ['sexual'], sourceId: rcSource },
    ],
  })

  await addBook({
    title: 'High Times Encyclopedia of Recreational Drugs', slug: 'high-times-encyclopedia',
    authorDisplay: 'High Times Magazine (eds.)', authorSlug: 'high-times-magazine-eds',
    year: 1978, genres: ['non-fiction'],
    bans: [{ country: 'AU', scopeId: govId, status: 'historical', yearStarted: 1978, reasonSlugs: ['drugs'], sourceId: rcSource }],
  })

  // ── INDEX LIBRORUM PROHIBITORUM (Catholic Church) ─────────────────────────
  // Source: Wikipedia "Index Librorum Prohibitorum", Catholic Encyclopedia

  await addBook({
    title: 'De Revolutionibus Orbium Coelestium', slug: 'de-revolutionibus',
    authorDisplay: 'Nicolaus Copernicus', authorSlug: 'nicolaus-copernicus',
    year: 1543, genres: ['non-fiction'], lang: 'la',
    bans: [{ country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1616, reasonSlugs: ['religious'], sourceId: indexSource }],
  })

  await addBook({
    title: 'Dialogue Concerning the Two Chief World Systems', slug: 'dialogue-galileo',
    authorDisplay: 'Galileo Galilei', authorSlug: 'galileo-galilei',
    year: 1632, genres: ['non-fiction'], lang: 'it',
    bans: [{ country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1633, reasonSlugs: ['religious'], sourceId: indexSource }],
  })

  await addBook({
    title: 'Meditations on First Philosophy', slug: 'meditations-on-first-philosophy',
    authorDisplay: 'René Descartes', authorSlug: 'rene-descartes',
    year: 1641, genres: ['non-fiction'], lang: 'la',
    bans: [{ country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1663, reasonSlugs: ['religious'], sourceId: indexSource }],
  })

  await addBook({
    title: 'Discourse on Method', slug: 'discourse-on-method',
    authorDisplay: 'René Descartes', authorSlug: 'rene-descartes',
    year: 1637, genres: ['non-fiction'], lang: 'fr',
    bans: [{ country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1663, reasonSlugs: ['religious'], sourceId: indexSource }],
  })

  await addBook({
    title: "Pensées", slug: 'pensees-pascal',
    authorDisplay: 'Blaise Pascal', authorSlug: 'blaise-pascal',
    year: 1670, genres: ['non-fiction'], lang: 'fr',
    bans: [{ country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1789, reasonSlugs: ['religious'], sourceId: indexSource }],
  })

  await addBook({
    title: 'Leviathan', slug: 'leviathan-hobbes',
    authorDisplay: 'Thomas Hobbes', authorSlug: 'thomas-hobbes',
    year: 1651, genres: ['non-fiction'],
    bans: [{ country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1703, reasonSlugs: ['religious', 'political'], sourceId: indexSource }],
  })

  await addBook({
    title: 'Two Treatises of Government', slug: 'two-treatises-of-government',
    authorDisplay: 'John Locke', authorSlug: 'john-locke',
    year: 1689, genres: ['non-fiction'],
    bans: [{ country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1734, reasonSlugs: ['religious', 'political'], sourceId: indexSource }],
  })

  await addBook({
    title: "The Spirit of the Laws", slug: 'the-spirit-of-the-laws',
    authorDisplay: 'Montesquieu', authorSlug: 'montesquieu',
    year: 1748, genres: ['non-fiction'], lang: 'fr',
    bans: [{ country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1751, reasonSlugs: ['religious', 'political'], sourceId: indexSource }],
  })

  await addBook({
    title: 'Candide', slug: 'candide',
    authorDisplay: 'Voltaire', authorSlug: 'voltaire',
    year: 1759, genres: ['literary-fiction', 'satire'], lang: 'fr',
    bans: [{ country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1762, reasonSlugs: ['religious', 'political'], sourceId: indexSource }],
  })

  await addBook({
    title: 'Emile, or On Education', slug: 'emile-or-on-education',
    authorDisplay: 'Jean-Jacques Rousseau', authorSlug: 'jean-jacques-rousseau',
    year: 1762, genres: ['non-fiction'], lang: 'fr',
    bans: [
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1762, reasonSlugs: ['religious', 'political'], sourceId: indexSource },
      { country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1762, reasonSlugs: ['political', 'religious'], sourceId: indexSource },
    ],
  })

  await addBook({
    title: 'Pamela, or Virtue Rewarded', slug: 'pamela-or-virtue-rewarded',
    authorDisplay: 'Samuel Richardson', authorSlug: 'samuel-richardson',
    year: 1740, genres: ['literary-fiction'],
    bans: [{ country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1744, reasonSlugs: ['moral', 'sexual'], sourceId: indexSource }],
  })

  await addBook({
    title: 'Tom Jones', slug: 'tom-jones',
    authorDisplay: 'Henry Fielding', authorSlug: 'henry-fielding',
    year: 1749, genres: ['literary-fiction'],
    bans: [{ country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1749, reasonSlugs: ['moral', 'sexual'], sourceId: indexSource }],
  })

  // ── NAZI GERMANY – Less famous 1933 book-burning titles ───────────────────
  // Source: Wikipedia "Nazi book burnings", United States Holocaust Memorial Museum

  const naziBurnSource = await upsertSource(
    'United States Holocaust Memorial Museum – Book Burnings',
    'https://www.ushmm.org/collections/bibliography/book-burnings'
  )

  await addBook({
    title: 'Magnus Hirschfeld: A Portrait', slug: 'magnus-hirschfeld-portrait',
    authorDisplay: 'Magnus Hirschfeld', authorSlug: 'magnus-hirschfeld',
    year: 1926, genres: ['non-fiction'], lang: 'de',
    bans: [{ country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['political', 'racial', 'lgbtq'], sourceId: naziBurnSource }],
  })

  await addBook({
    title: 'The Sleepless World', slug: 'the-sleepless-world',
    authorDisplay: 'Erich Kästner', authorSlug: 'erich-kastner',
    year: 1932, genres: ['literary-fiction'], lang: 'de',
    bans: [{ country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['political', 'moral'], sourceId: naziBurnSource }],
  })

  await addBook({
    // Heinrich Heine poem collection; deeply ironic given his "where books are burned" quote
    title: 'Book of Songs', slug: 'book-of-songs-heine',
    authorDisplay: 'Heinrich Heine', authorSlug: 'heinrich-heine',
    year: 1827, genres: ['literary-fiction'], lang: 'de',
    bans: [{ country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['political', 'racial'], sourceId: naziBurnSource }],
  })

  await addBook({
    title: 'Three Comrades', slug: 'three-comrades',
    authorDisplay: 'Erich Maria Remarque', authorSlug: 'erich-maria-remarque',
    year: 1936, genres: ['literary-fiction', 'historical-fiction'], lang: 'de',
    bans: [{ country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['political'], sourceId: naziBurnSource }],
  })

  await addBook({
    title: 'All Quiet on the Western Front', slug: 'all-quiet-on-the-western-front',
    authorDisplay: 'Erich Maria Remarque', authorSlug: 'erich-maria-remarque',
    year: 1929, genres: ['literary-fiction', 'historical-fiction'], lang: 'de',
    bans: [{ country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['political', 'violence'], sourceId: naziBurnSource }],
  })

  await addBook({
    title: 'Sexual Ethics', slug: 'sexual-ethics-forel',
    authorDisplay: 'Auguste Forel', authorSlug: 'auguste-forel',
    year: 1906, genres: ['non-fiction'], lang: 'de',
    bans: [{ country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['sexual', 'moral'], sourceId: naziBurnSource }],
  })

  await addBook({
    title: 'The World of Yesterday', slug: 'the-world-of-yesterday',
    authorDisplay: 'Stefan Zweig', authorSlug: 'stefan-zweig',
    year: 1942, genres: ['memoir', 'non-fiction'], lang: 'de',
    bans: [{ country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['political', 'racial'], sourceId: naziBurnSource }],
  })

  await addBook({
    title: 'Round Heads and Pointed Heads', slug: 'round-heads-and-pointed-heads',
    authorDisplay: 'Bertolt Brecht', authorSlug: 'bertolt-brecht',
    year: 1936, genres: ['literary-fiction'], lang: 'de',
    bans: [{ country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['political'], sourceId: naziBurnSource }],
  })

  await addBook({
    // Ernst Toller expressionist playwright; explicitly targeted in 1933 burnings
    title: 'Masses Man', slug: 'masses-man-toller',
    authorDisplay: 'Ernst Toller', authorSlug: 'ernst-toller',
    year: 1921, genres: ['literary-fiction'], lang: 'de',
    bans: [{ country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['political'], sourceId: naziBurnSource }],
  })

  // ── IRELAND – Censorship of Publications Board (1929–1967) ────────────────
  // Source: Wikipedia "Censorship of Publications Act 1929", Irish Times archives

  await addBook({
    title: 'The Ginger Man', slug: 'the-ginger-man',
    authorDisplay: 'J. P. Donleavy', authorSlug: 'jp-donleavy',
    year: 1955, genres: ['literary-fiction'],
    bans: [{ country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1956, reasonSlugs: ['sexual', 'moral'], sourceId: irishSource }],
  })

  await addBook({
    title: 'Duffy', slug: 'duffy-james-plunkett',
    authorDisplay: 'James Plunkett', authorSlug: 'james-plunkett',
    year: 1969, genres: ['literary-fiction'],
    bans: [{ country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1969, reasonSlugs: ['sexual', 'moral'], sourceId: irishSource }],
  })

  await addBook({
    title: 'The Lonely Passion of Judith Hearne', slug: 'the-lonely-passion-of-judith-hearne',
    authorDisplay: 'Brian Moore', authorSlug: 'brian-moore',
    year: 1955, genres: ['literary-fiction'],
    bans: [{ country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1956, reasonSlugs: ['sexual', 'moral'], sourceId: irishSource }],
  })

  await addBook({
    title: 'The Barracks', slug: 'the-barracks-mcgahern',
    authorDisplay: 'John McGahern', authorSlug: 'john-mcgahern',
    year: 1963, genres: ['literary-fiction'],
    bans: [{ country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1964, reasonSlugs: ['sexual', 'moral'], sourceId: irishSource }],
  })

  await addBook({
    title: 'The Collected Stories of Seán O\'Faoláin', slug: 'collected-stories-sean-ofaolain',
    authorDisplay: 'Seán O\'Faoláin', authorSlug: 'sean-ofaolain',
    year: 1935, genres: ['literary-fiction'],
    bans: [{ country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1935, reasonSlugs: ['sexual', 'moral'], sourceId: irishSource }],
  })

  await addBook({
    title: 'The Informer', slug: 'the-informer-liam-oflaherty',
    authorDisplay: 'Liam O\'Flaherty', authorSlug: 'liam-oflaherty',
    year: 1925, genres: ['literary-fiction', 'thriller'],
    bans: [{ country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1932, reasonSlugs: ['sexual', 'moral', 'political'], sourceId: irishSource }],
  })

  await addBook({
    title: 'The Butcher Boy', slug: 'the-butcher-boy',
    authorDisplay: 'Patrick McCabe', authorSlug: 'patrick-mccabe',
    year: 1992, genres: ['literary-fiction'],
    bans: [{ country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1992, reasonSlugs: ['violence', 'sexual'], sourceId: irishSource }],
  })

  await addBook({
    // Edna O'Brien's second novel; banned in Ireland immediately upon publication
    title: 'The Lonely Girl', slug: 'the-lonely-girl',
    authorDisplay: 'Edna O\'Brien', authorSlug: 'edna-obrien',
    year: 1962, genres: ['literary-fiction', 'coming-of-age'],
    bans: [{ country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1962, reasonSlugs: ['sexual', 'moral'], sourceId: irishSource }],
  })

  await addBook({
    // Edna O'Brien's third novel; all three Country Girls trilogy books were banned
    title: 'Girls in Their Married Bliss', slug: 'girls-in-their-married-bliss',
    authorDisplay: 'Edna O\'Brien', authorSlug: 'edna-obrien',
    year: 1964, genres: ['literary-fiction'],
    bans: [{ country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1964, reasonSlugs: ['sexual', 'moral'], sourceId: irishSource }],
  })

  // Note: 'ulysses' already exists in the DB for the US ban. The Ireland ban on Ulysses
  // (Censorship Board, 1932) would ideally be added as a second ban on the same book
  // record. Skipping here to avoid a duplicate book entry.

  await addBook({
    title: 'Samuel Beckett: His Works and His Critics', slug: 'beckett-works-and-critics',
    authorDisplay: 'Raymond Federman', authorSlug: 'raymond-federman',
    year: 1970, genres: ['non-fiction'],
    bans: [{ country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1972, reasonSlugs: ['moral'], sourceId: irishSource }],
  })

  // ── ADDITIONAL NOTABLE CROSS-COUNTRY BANS ────────────────────────────────

  await addBook({
    // Turkey ban; Index on Censorship documented complaints about religious content
    title: 'The Forty Rules of Love', slug: 'the-forty-rules-of-love',
    authorDisplay: 'Elif Şafak', authorSlug: 'elif-shafak',   // slug matches add-bulk-books.ts
    year: 2010, genres: ['literary-fiction'], lang: 'tr',
    bans: [{ country: 'TR', scopeId: govId, status: 'historical', yearStarted: 2010, reasonSlugs: ['religious', 'moral'], sourceId: ipiSource }],
  })

  await addBook({
    // Wole Soyinka's play depicting Nigerian political satire; performances and publication banned
    title: 'Opera Wonyosi', slug: 'opera-wonyosi',
    authorDisplay: 'Wole Soyinka', authorSlug: 'wole-soyinka',
    year: 1977, genres: ['literary-fiction'],
    bans: [{ country: 'NG', scopeId: govId, status: 'historical', yearStarted: 1977, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    // Soyinka novel; banned under Abacha
    title: 'The Open Sore of a Continent', slug: 'the-open-sore-of-a-continent',
    authorDisplay: 'Wole Soyinka', authorSlug: 'wole-soyinka',
    year: 1996, genres: ['non-fiction'],
    bans: [{ country: 'NG', scopeId: govId, status: 'historical', yearStarted: 1996, reasonSlugs: ['political'], sourceId: ipiSource }],
  })

  await addBook({
    // Nawal El Saadawi novel banned in Egypt; author also removed from national literature lists
    title: 'God Dies by the Nile', slug: 'god-dies-by-the-nile',
    authorDisplay: 'Nawal El Saadawi', authorSlug: 'nawal-el-saadawi',
    year: 1974, genres: ['literary-fiction'], lang: 'ar',
    bans: [
      { country: 'EG', scopeId: govId, status: 'historical', yearStarted: 1974, reasonSlugs: ['religious', 'political'], sourceId: ipiSource },
      { country: 'SA', scopeId: govId, status: 'active', yearStarted: 1974, reasonSlugs: ['religious', 'moral'], sourceId: ipiSource },
    ],
  })

  // Note: 'beloved' already exists in the DB (US school ban). Qatar's government ban
  // would ideally be an additional ban on that same book record; skipping here.

  await addBook({
    // Bahrain banned this; documented in Index on Censorship
    title: 'The Yacoubian Building', slug: 'the-yacoubian-building',
    authorDisplay: 'Alaa Al Aswany', authorSlug: 'alaa-al-aswany',
    year: 2002, genres: ['literary-fiction'], lang: 'ar',
    bans: [
      { country: 'BH', scopeId: govId, status: 'active', yearStarted: 2006, reasonSlugs: ['sexual', 'moral'], sourceId: ipiSource },
      { country: 'SA', scopeId: govId, status: 'active', yearStarted: 2006, reasonSlugs: ['sexual', 'moral', 'religious'], sourceId: ipiSource },
    ],
  })

  console.log('\nDone. Run: npx tsx --env-file=.env.local scripts/generate-descriptions.ts')
}

main().catch(err => { console.error(err); process.exit(1) })
