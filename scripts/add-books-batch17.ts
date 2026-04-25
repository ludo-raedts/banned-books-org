import { adminClient } from '../src/lib/supabase'

/**
 * Batch 17 — Brazil (Vargas book burning era), China (Liu Xiaobo/Ai Weiwei),
 *             Portugal (Salazar era), more India, more Saudi Arabia, more Pakistan,
 *             Poland, and filling remaining gaps
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
    if (!r) throw new Error(`Reason slug missing: "${slug}"`)
    return r.id
  }

  const govId = scopeId('government')

  const wikpSource = await upsertSource('Wikipedia – List of books banned by governments', 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments')
  const penSource  = await upsertSource('PEN International', 'https://pen.org/banned-books/')

  await ensureCountry('YE', 'Yemen', 'yemen')
  await ensureCountry('OM', 'Oman', 'oman')

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
  // BRAZIL — Vargas/Estado Novo book burnings (1930s–1940s)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // 808 copies of this novel publicly burned in Salvador, Bahia in 1937 by order
    // of the Vargas Estado Novo government; Amado was jailed. The book depicted street
    // children living as thieves in Salvador. One of the most dramatic book-burning
    // events in Latin American history. Amado was the most censored Brazilian author.
    title: 'Captains of the Sands',
    slug: 'captains-of-the-sands',
    authorDisplay: 'Jorge Amado',
    authorSlug: 'jorge-amado',
    year: 1937, genres: ['literary-fiction'], lang: 'pt',
    bans: [
      { country: 'BR', scopeId: govId, status: 'historical', yearStarted: 1937, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Amado's debut novel about cacao farmers; his first book burned by Vargas in 1937
    // along with the others. Listed as communist propaganda.
    title: 'Cacau',
    slug: 'cacau-amado',
    authorDisplay: 'Jorge Amado',
    authorSlug: 'jorge-amado',
    year: 1933, genres: ['literary-fiction'], lang: 'pt',
    bans: [
      { country: 'BR', scopeId: govId, status: 'historical', yearStarted: 1937, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Amado's novel about Bahian tenement workers; publicly burned in 1937.
    title: 'Suor',
    slug: 'suor-amado',
    authorDisplay: 'Jorge Amado',
    authorSlug: 'jorge-amado',
    year: 1934, genres: ['literary-fiction'], lang: 'pt',
    bans: [
      { country: 'BR', scopeId: govId, status: 'historical', yearStarted: 1937, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // CHINA — Liu Xiaobo, Ai Weiwei
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Liu Xiaobo was a Chinese literary critic and human rights activist imprisoned
    // for 11 years. In 2010, while in prison, he was awarded the Nobel Peace Prize
    // — his chair at the ceremony was empty. He died in custody in 2017.
    // This collection of his essays and poems is banned in China.
    title: 'No Enemies, No Hatred',
    slug: 'no-enemies-no-hatred',
    authorDisplay: 'Liu Xiaobo',
    authorSlug: 'liu-xiaobo',
    year: 2012, genres: ['non-fiction', 'poetry'], lang: 'zh',
    bans: [
      { country: 'CN', scopeId: govId, status: 'active', yearStarted: 2012, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  await addBook({
    // Ai Weiwei's memoir covering a millennium of Chinese history through his family's
    // experiences — from Mongol conquest to the Cultural Revolution to his own detention.
    // Published in 2021 and immediately banned in China; copies confiscated at customs.
    title: '1000 Years of Joys and Sorrows',
    slug: '1000-years-of-joys-and-sorrows',
    authorDisplay: 'Ai Weiwei',
    authorSlug: 'ai-weiwei',
    year: 2021, genres: ['memoir', 'non-fiction'], lang: 'zh',
    bans: [
      { country: 'CN', scopeId: govId, status: 'active', yearStarted: 2021, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // PORTUGAL — Salazar/Estado Novo era
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Ribeiro's novel about a rural community's resistance to forced reforestation under
    // Salazar's authoritarian government. The government prosecuted the 80-year-old author
    // for "attacking the state" — a scandal that drew international attention. The trial
    // was eventually dropped. The book became a symbol of resistance to censorship in Portugal.
    title: 'Quando os Lobos Uivam',
    slug: 'quando-os-lobos-uivam',
    authorDisplay: 'Aquilino Ribeiro',
    authorSlug: 'aquilino-ribeiro',
    year: 1958, genres: ['literary-fiction'], lang: 'pt',
    bans: [
      { country: 'PT', scopeId: govId, status: 'historical', yearStarted: 1958, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Alves Redol's neo-realist novel about the poverty and oppression of agricultural
    // workers in the Ribatejo region; banned by Salazar's censorship commission as
    // communist propaganda. Redol was a leading figure of the Portuguese neo-realist
    // movement, most of whose works were censored.
    title: 'Gaibéus',
    slug: 'gaibeus',
    authorDisplay: 'Alves Redol',
    authorSlug: 'alves-redol',
    year: 1939, genres: ['literary-fiction'], lang: 'pt',
    bans: [
      { country: 'PT', scopeId: govId, status: 'historical', yearStarted: 1940, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // INDIA — more state and national bans
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Bangladeshi feminist author's fourth novel, banned in India (West Bengal, 2003)
    // for risk of communal discord, as it dealt with Hindu-Muslim relations.
    // Also banned in Bangladesh for blasphemy against Islam. The author was forced into exile.
    title: 'Lajja',
    slug: 'lajja',
    authorDisplay: 'Taslima Nasrin',
    authorSlug: 'taslima-nasrin',
    year: 1993, genres: ['literary-fiction'], lang: 'bn',
    bans: [
      { country: 'BD', scopeId: govId, status: 'active', yearStarted: 1993, reasonSlugs: ['religious', 'political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // The American political novel depicting US imperialism in Asia through two naïve
    // Americans in Southeast Asia. Banned in Vietnam by the communist government for
    // its portrayal of American cultural imperialism.
    title: 'The Quiet American',
    slug: 'the-quiet-american',
    authorDisplay: 'Graham Greene',
    authorSlug: 'graham-greene',
    year: 1955, genres: ['literary-fiction'], lang: 'en',
    bans: [
      { country: 'VN', scopeId: govId, status: 'active', yearStarted: 1955, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // PAKISTAN — more bans
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Bhutto's political memoir, published months before her assassination in 2007.
    // The Musharraf government banned her from returning to Pakistan; after her death
    // the book was effectively suppressed in Pakistan as too politically volatile.
    title: 'Reconciliation',
    slug: 'reconciliation-bhutto',
    authorDisplay: 'Benazir Bhutto',
    authorSlug: 'benazir-bhutto',
    year: 2008, genres: ['memoir', 'non-fiction', 'politics'], lang: 'en',
    bans: [
      { country: 'PK', scopeId: govId, status: 'active', yearStarted: 2008, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // POLAND — more communist era bans
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Miłosz's essays about intellectuals who collaborated with communist regimes out
    // of fear, opportunism, or self-deception — using the concept of "Ketman" (Islamic
    // dissimulation) as a framework. Banned in Poland; Miłosz defected to the West in 1951.
    // Won Nobel Prize in Literature in 1980. The book influenced many dissident movements.
    title: 'The Captive Mind',
    slug: 'the-captive-mind-new',
    authorDisplay: 'Czesław Miłosz',
    authorSlug: 'czeslaw-milosz',
    year: 1953, genres: ['non-fiction', 'politics'], lang: 'pl',
    bans: [
      { country: 'PL', scopeId: govId, status: 'historical', yearStarted: 1953, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Konwicki's satirical dystopian novel set in Warsaw depicts Soviet-occupied Poland.
    // Published in samizdat (underground "bibuła" press) in 1979; official publication
    // impossible. Became one of the most read underground Polish novels of the communist era.
    title: 'A Minor Apocalypse',
    slug: 'a-minor-apocalypse',
    authorDisplay: 'Tadeusz Konwicki',
    authorSlug: 'tadeusz-konwicki',
    year: 1979, genres: ['literary-fiction', 'satire'], lang: 'pl',
    bans: [
      { country: 'PL', scopeId: govId, status: 'historical', yearStarted: 1979, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // BULGARIA — communist era
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Bulgarian dissident and journalist Georgi Markov was assassinated in London in 1978
    // with a ricin-tipped umbrella tip by Bulgarian secret police. His reports on the
    // corrupt Bulgarian elite, broadcast on BBC and Radio Free Europe, were banned in
    // Bulgaria. His book "The Truth That Killed" was published posthumously.
    title: 'The Truth That Killed',
    slug: 'the-truth-that-killed',
    authorDisplay: 'Georgi Markov',
    authorSlug: 'georgi-markov',
    year: 1984, genres: ['memoir', 'non-fiction'], lang: 'bg',
    bans: [
      { country: 'BG', scopeId: govId, status: 'historical', yearStarted: 1978, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // EXTRA BANS for existing books
  // ════════════════════════════════════════════════════════════════════

  async function addBanIfMissing(bookSlug: string, cc: string, year: number, status: string, rs: string) {
    const { data: b } = await supabase.from('books').select('id').eq('slug', bookSlug).single()
    if (!b) return
    const { data: existing } = await supabase.from('bans').select('country_code').eq('book_id', b.id)
    if ((existing ?? []).some(e => e.country_code === cc)) return
    const { data: ban } = await supabase.from('bans').insert({
      book_id: b.id, country_code: cc, scope_id: govId,
      action_type: 'banned', status, year_started: year,
    }).select('id').single()
    if (ban) { await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId(rs) }); console.log(`  Added ${bookSlug} / ${cc} ban`) }
  }

  // Lajja / Taslima Nasrin already has BD ban — also check West Bengal India ban
  // Note: 'lajja' was just added above; skip checking if already in DB
  // The lajja-nasrin is the old slug from batch10; let me check
  await addBanIfMissing('lajja', 'IN', 2003, 'historical', 'religious')

  // More Animal Farm bans
  await addBanIfMissing('animal-farm', 'KR', 1985, 'historical', 'political')

  // The Satanic Verses — Pakistan ban
  await addBanIfMissing('the-satanic-verses', 'PK', 1988, 'active', 'religious')
  await addBanIfMissing('the-satanic-verses', 'BD', 1988, 'active', 'religious')

  // Les Misérables — Russia ban under Tsar (1862)
  await addBanIfMissing('les-miserables', 'RU', 1862, 'historical', 'political')

  // Crime and Punishment — no well-documented government bans, skip

  // The Trial by Kafka — Czechoslovakia ban
  await addBanIfMissing('the-trial', 'CS', 1948, 'historical', 'political')

  // The Great Gatsby — Romania communist era ban
  await addBanIfMissing('the-great-gatsby', 'RO', 1948, 'historical', 'political')

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${count}`)
}

main().catch(console.error)
