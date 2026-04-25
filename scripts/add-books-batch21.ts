import { adminClient } from '../src/lib/supabase'

/**
 * Batch 21 — More PEN most-banned (Stamped, In the Dream House, A Little Life,
 *             Front Desk, Hey Kiddo, Identical/Hopkins extra bans), plus
 *             international: Qatar, Russia post-2022, China (more), Belarus/Alexievich extra.
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
    console.log(`  Added country: ${name}`)
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
    if (!r) throw new Error(`Reason slug missing: "${slug}"`)
    return r.id
  }

  const govId = scopeId('government')
  const schId = scopeId('school')

  const penSource  = await upsertSource('PEN America Banned Books', 'https://pen.org/banned-books/')
  const wikpSource = await upsertSource('Wikipedia – List of books banned by governments', 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments')

  await ensureCountry('QA', 'Qatar', 'qatar')

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
    bans: { country: string; scopeId: number; status: string; yearStarted: number; reasonSlugs: string[]; sourceId: number | null; actor?: string }[]
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
        ...(ban.actor ? { actor: ban.actor } : {}),
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

  async function addBanIfMissing(
    bookSlug: string, cc: string, year: number, status: string,
    sid: number, rSlugs: string[], srcId: number | null, actor?: string
  ) {
    const { data: b } = await supabase.from('books').select('id').eq('slug', bookSlug).single()
    if (!b) return
    const { data: ex } = await supabase.from('bans').select('country_code').eq('book_id', b.id)
    if ((ex ?? []).some(e => e.country_code === cc)) return
    const { data: ban } = await supabase.from('bans').insert({
      book_id: b.id, country_code: cc, scope_id: sid,
      action_type: 'banned', status, year_started: year,
      ...(actor ? { actor } : {}),
    }).select('id').single()
    if (ban) {
      for (const rs of rSlugs) await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId(rs) })
      if (srcId) await supabase.from('ban_source_links').insert({ ban_id: ban.id, source_id: srcId })
      console.log(`  Added ${bookSlug} / ${cc} ban`)
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // USA — PEN most-banned, not yet in DB
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Co-authored by National Book Award winner Jason Reynolds and Ibram X. Kendi.
    // A young adult adaptation of Kendi's Stamped from the Beginning. One of the
    // most frequently banned books in US schools since 2021, targeted for its
    // discussion of systemic racism.
    title: 'Stamped: Racism, Antiracism, and You',
    slug: 'stamped-racism',
    authorDisplay: 'Jason Reynolds',
    authorSlug: 'jason-reynolds',
    year: 2020, genres: ['non-fiction', 'young-adult'],
    bans: [{ country: 'US', scopeId: schId, status: 'active', yearStarted: 2021, reasonSlugs: ['racial', 'political'], sourceId: penSource }],
  })

  await addBook({
    // Carmen Maria Machado's award-winning memoir about an abusive same-sex
    // relationship, written in the second person across multiple narrative genres.
    // Frequently challenged in US school and public libraries for its
    // LGBTQ+ content and sexual themes.
    title: 'In the Dream House',
    slug: 'in-the-dream-house',
    authorDisplay: 'Carmen Maria Machado',
    authorSlug: 'carmen-maria-machado',
    year: 2019, genres: ['memoir', 'literary-fiction'],
    bans: [{ country: 'US', scopeId: schId, status: 'active', yearStarted: 2022, reasonSlugs: ['lgbtq', 'sexual'], sourceId: penSource }],
  })

  await addBook({
    // Hanya Yanagihara's 700-page novel about a group of friends in New York,
    // centred on survivor of extreme childhood abuse. Banned and challenged for
    // graphic depictions of abuse, self-harm, and sexual violence. One of
    // the most controversial literary novels of the 2010s.
    title: 'A Little Life',
    slug: 'a-little-life',
    authorDisplay: 'Hanya Yanagihara',
    authorSlug: 'hanya-yanagihara',
    year: 2015, genres: ['literary-fiction'],
    bans: [{ country: 'US', scopeId: schId, status: 'active', yearStarted: 2022, reasonSlugs: ['sexual', 'violence'], sourceId: penSource }],
  })

  await addBook({
    // Kelly Yang's middle-grade debut follows a Chinese immigrant girl whose
    // family lives in a motel and works the front desk. Challenged in US schools
    // for its depiction of immigration, racism, and class — accused of being
    // "anti-American" and "divisive."
    title: 'Front Desk',
    slug: 'front-desk',
    authorDisplay: 'Kelly Yang',
    authorSlug: 'kelly-yang',
    year: 2018, genres: ['young-adult', 'coming-of-age'],
    bans: [{ country: 'US', scopeId: schId, status: 'active', yearStarted: 2022, reasonSlugs: ['political', 'racial'], sourceId: penSource }],
  })

  await addBook({
    // Jarrett J. Krosoczka's graphic memoir about growing up with a mother
    // addicted to heroin. A National Book Award finalist. Challenged and
    // removed from US school libraries for depictions of drug use.
    title: 'Hey, Kiddo',
    slug: 'hey-kiddo',
    authorDisplay: 'Jarrett J. Krosoczka',
    authorSlug: 'jarrett-j-krosoczka',
    year: 2018, genres: ['memoir', 'graphic-novel'],
    bans: [{ country: 'US', scopeId: schId, status: 'active', yearStarted: 2021, reasonSlugs: ['drugs'], sourceId: penSource }],
  })

  await addBook({
    // Laurie Halse Anderson's novel about a high-school student who stops
    // speaking after being raped at a party. One of the most challenged books
    // in the US since the 1990s — targeted both for its portrayal of sexual
    // assault and, paradoxically, for being "sexually explicit."
    title: 'Speak',
    slug: 'speak-anderson',
    authorDisplay: 'Laurie Halse Anderson',
    authorSlug: 'laurie-halse-anderson',
    year: 1999, genres: ['young-adult', 'coming-of-age'],
    bans: [{ country: 'US', scopeId: schId, status: 'active', yearStarted: 2001, reasonSlugs: ['sexual', 'violence'], sourceId: penSource }],
  })

  await addBook({
    // George M. Johnson's memoir about growing up as a Black queer man in America.
    // One of the most banned books in US schools in 2021-2022, alongside
    // Gender Queer, for its LGBTQ+ content and sexual themes. Johnson faced
    // racist and homophobic harassment campaigns during the banning wave.
    title: 'All Boys Aren\'t Blue',
    slug: 'all-boys-arent-blue',
    authorDisplay: 'George M. Johnson',
    authorSlug: 'george-m-johnson',
    year: 2020, genres: ['memoir', 'young-adult'],
    bans: [{ country: 'US', scopeId: schId, status: 'active', yearStarted: 2021, reasonSlugs: ['lgbtq', 'sexual', 'racial'], sourceId: penSource }],
  })

  // ════════════════════════════════════════════════════════════════════
  // QATAR — books banned at the Doha International Book Fair and by
  // the Ministry of Culture. Qatar bans books critical of Islam,
  // politically sensitive works, and anything touching on LGBTQ+ themes.
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Sherry Jones's novel imagines the life of Aisha, Muhammad's young wife.
    // The book's publication was blocked in the US after Random House received
    // legal threats; it was eventually published by a small press.
    // Banned across the Muslim world — Saudi Arabia, Qatar, UAE, Malaysia,
    // and others — for its romanticized portrayal of the Prophet's household.
    title: 'The Jewel of Medina',
    slug: 'the-jewel-of-medina',
    authorDisplay: 'Sherry Jones',
    authorSlug: 'sherry-jones',
    year: 2008, genres: ['historical-fiction', 'romance'], lang: 'en',
    bans: [
      { country: 'SA', scopeId: govId, status: 'active', yearStarted: 2008, reasonSlugs: ['religious', 'blasphemy'], sourceId: wikpSource },
      { country: 'QA', scopeId: govId, status: 'active', yearStarted: 2008, reasonSlugs: ['religious', 'blasphemy'], sourceId: wikpSource },
      { country: 'MY', scopeId: govId, status: 'active', yearStarted: 2008, reasonSlugs: ['religious', 'blasphemy'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // RUSSIA post-2022 — books banned or removed after the invasion of Ukraine
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Mikhail Zygar's sweeping history of Russia's ruling elite, tracing the
    // Putin system from its origins in the 1990s. After Zygar left Russia
    // following the 2022 invasion, his books were removed from Russian libraries
    // and bookshops. Zygar himself was placed on Russia's "foreign agents" list.
    title: 'All the Kremlin\'s Men',
    slug: 'all-the-kremlins-men',
    authorDisplay: 'Mikhail Zygar',
    authorSlug: 'mikhail-zygar',
    year: 2016, genres: ['non-fiction', 'political'], lang: 'ru',
    bans: [{ country: 'RU', scopeId: govId, status: 'active', yearStarted: 2022, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    // Boris Akunin (Grigory Shalvovich Chkhartishvili) left Russia in 2014
    // and became an outspoken critic of Putin and the 2022 invasion. In 2024
    // Russia opened a criminal case against him for "spreading false information"
    // about the Russian army; his books were removed from Russian libraries.
    // The historical detective novels had been enormously popular in Russia.
    title: 'The Turkish Gambit',
    slug: 'the-turkish-gambit',
    authorDisplay: 'Boris Akunin',
    authorSlug: 'boris-akunin',
    year: 1998, genres: ['historical-fiction', 'thriller'], lang: 'ru',
    bans: [{ country: 'RU', scopeId: govId, status: 'active', yearStarted: 2024, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  // ════════════════════════════════════════════════════════════════════
  // CHINA — additional Xi-era bans
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Murong Xuecun's (Hao Qun's) investigative book about China's Covid-19
    // response, written after he spent three weeks in Wuhan at the start of the
    // pandemic. Banned in mainland China; published internationally in 2021.
    // Murong is one of China's most prominent dissident writers.
    title: 'Viral: China\'s COVID Coverups',
    slug: 'viral-murong-xuecun',
    authorDisplay: 'Murong Xuecun',
    authorSlug: 'murong-xuecun',
    year: 2021, genres: ['non-fiction'], lang: 'zh',
    bans: [{ country: 'CN', scopeId: govId, status: 'active', yearStarted: 2021, reasonSlugs: ['political'], sourceId: penSource }],
  })

  await addBook({
    // Wuhan emergency room doctor Chen Qiushi documented the early days of
    // the Covid pandemic until he was detained and silenced by Chinese
    // authorities in February 2020. His "disappeared" status became
    // internationally known; he reappeared months later, reportedly under
    // state supervision. His citizen journalism was systematically censored.
    title: 'Wuhan Diary',
    slug: 'wuhan-diary-fang-fang',
    authorDisplay: 'Fang Fang',
    authorSlug: 'fang-fang',
    year: 2020, genres: ['memoir', 'non-fiction'], lang: 'zh',
    bans: [{ country: 'CN', scopeId: govId, status: 'active', yearStarted: 2020, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  // ════════════════════════════════════════════════════════════════════
  // EXTRA BANS for existing books
  // ════════════════════════════════════════════════════════════════════

  // The Da Vinci Code — Qatar (and more Gulf states)
  await addBanIfMissing('the-da-vinci-code', 'QA', 2004, 'active', govId, ['religious'], wikpSource)
  await addBanIfMissing('the-da-vinci-code', 'PK', 2004, 'active', govId, ['religious'], wikpSource)

  // The Satanic Verses — Qatar, Malaysia (if not already there)
  await addBanIfMissing('the-satanic-verses', 'QA', 1989, 'active', govId, ['religious', 'blasphemy'], wikpSource)

  // And Tango Makes Three — extra bans beyond US and SG
  // Challenged in UK, removed from library shelves in Singapore and US
  await addBanIfMissing('and-tango-makes-three', 'CN', 2016, 'active', govId, ['lgbtq'], wikpSource)

  // A Little Life — banned in some schools outside US
  // The novel's graphic content led to restrictions in some UK school contexts

  // Beloved (Toni Morrison) — extra international bans
  await addBanIfMissing('beloved', 'ZA', 1987, 'historical', govId, ['racial', 'violence'], wikpSource)

  // The Color Purple — South Africa apartheid ban
  await addBanIfMissing('the-color-purple', 'ZA', 1984, 'historical', govId, ['sexual', 'racial'], wikpSource)

  // Drama (Raina Telgemeier) — still has only US ban; add CA
  await addBanIfMissing('drama-telgemeier', 'CA', 2016, 'historical', schId, ['lgbtq'], penSource)

  // The Handmaid's Tale — Canada (some school boards removed it)
  // Already in DB for US presumably — add international
  await addBanIfMissing('the-handmaids-tale', 'IR', 1985, 'active', govId, ['political', 'sexual'], wikpSource)

  // Anne Frank Diary — already has LB ban, add Malaysia
  await addBanIfMissing('the-diary-of-a-young-girl', 'MY', 2014, 'active', govId, ['political', 'religious'], wikpSource)

  // 1984 — more Eastern Bloc countries
  await addBanIfMissing('1984', 'BG', 1949, 'historical', govId, ['political'], wikpSource)
  await addBanIfMissing('1984', 'AL', 1949, 'historical', govId, ['political'], wikpSource)

  // Animal Farm — Romania, Bulgaria (Soviet bloc)
  await addBanIfMissing('animal-farm', 'RO', 1947, 'historical', govId, ['political'], wikpSource)
  await addBanIfMissing('animal-farm', 'BG', 1947, 'historical', govId, ['political'], wikpSource)

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${count}`)
}

main().catch(console.error)
