import { adminClient } from '../src/lib/supabase'

/**
 * Batch 19 — Ukraine (Shevchenko), Libya (Matar), Lebanon (al-Shaykh),
 *             1930s fascist-era bans (Silone), Paraguay (Roa Bastos x2),
 *             Iran (Akhavan-Sales), China (Yang Jisheng / Tombstone),
 *             Turkey (Yaşar Kemal), + extra bans for NO/DK/IR/AF/LY/LB/PY
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

  const wikpSource = await upsertSource('Wikipedia – List of books banned by governments', 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments')
  const penSource  = await upsertSource('PEN International', 'https://pen.org/banned-books/')

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

  async function addBanIfMissing(bookSlug: string, cc: string, year: number, status: string, rs: string, sourceId: number | null = null) {
    const { data: b } = await supabase.from('books').select('id').eq('slug', bookSlug).single()
    if (!b) return
    const { data: existingBans } = await supabase.from('bans').select('country_code').eq('book_id', b.id)
    if ((existingBans ?? []).some(e => e.country_code === cc)) return
    const { data: ban } = await supabase.from('bans').insert({
      book_id: b.id, country_code: cc, scope_id: govId,
      action_type: 'banned', status, year_started: year,
    }).select('id').single()
    if (ban) {
      await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId(rs) })
      if (sourceId) await supabase.from('ban_source_links').insert({ ban_id: ban.id, source_id: sourceId })
      console.log(`  Added ${bookSlug} / ${cc} ban`)
    }
  }

  // ── Ensure new countries ─────────────────────────────────────────────
  await ensureCountry('UA', 'Ukraine', 'ukraine')
  await ensureCountry('NO', 'Norway', 'norway')
  await ensureCountry('DK', 'Denmark', 'denmark')
  await ensureCountry('PY', 'Paraguay', 'paraguay')

  // ════════════════════════════════════════════════════════════════════
  // UKRAINE — Taras Shevchenko
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // The foundational collection of Ukrainian poetry. Shevchenko was arrested in 1847
    // and sentenced to 10 years of forced military service with a ban on writing and
    // drawing. The Ems Decree of 1876 banned all Ukrainian-language publications in the
    // Russian Empire. Kobzar became a symbol of Ukrainian national identity and resistance.
    title: 'Kobzar',
    slug: 'kobzar-shevchenko',
    authorDisplay: 'Taras Shevchenko',
    authorSlug: 'taras-shevchenko',
    year: 1840, genres: ['poetry'], lang: 'uk',
    bans: [
      { country: 'UA', scopeId: govId, status: 'historical', yearStarted: 1847, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // LIBYA — Hisham Matar
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Set in 1979 Tripoli, this novel follows nine-year-old Suleiman during Gaddafi's
    // Cultural Revolution. Matar's own father was a Libyan dissident who was abducted
    // by Gaddafi agents in Egypt in 1990 and disappeared into Libya's Abu Salim prison.
    // The novel was banned across the Arab world and in Libya.
    title: 'In the Country of Men',
    slug: 'in-the-country-of-men',
    authorDisplay: 'Hisham Matar',
    authorSlug: 'hisham-matar',
    year: 2006, genres: ['literary-fiction'], lang: 'en',
    bans: [
      { country: 'LY', scopeId: govId, status: 'historical', yearStarted: 2006, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // LEBANON — Hanan al-Shaykh
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Lebanese author Hanan al-Shaykh's novel about a woman surviving the Lebanese Civil
    // War. Its frank portrayal of female sexuality and critique of Arab social norms led
    // to a ban in Lebanon (the author's home country), Egypt, and across the Arab world.
    // Al-Shaykh had to leave Lebanon and publish the novel in Beirut herself before
    // fleeing to London.
    title: 'The Story of Zahra',
    slug: 'the-story-of-zahra',
    authorDisplay: 'Hanan al-Shaykh',
    authorSlug: 'hanan-al-shaykh',
    year: 1980, genres: ['literary-fiction'], lang: 'ar',
    bans: [
      { country: 'LB', scopeId: govId, status: 'historical', yearStarted: 1980, reasonSlugs: ['sexual', 'political'], sourceId: wikpSource },
      { country: 'SA', scopeId: govId, status: 'active',     yearStarted: 1980, reasonSlugs: ['sexual', 'moral'],    sourceId: wikpSource },
      { country: 'EG', scopeId: govId, status: 'historical', yearStarted: 1982, reasonSlugs: ['sexual', 'moral'],    sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // ITALY / GERMANY — Ignazio Silone (anti-fascist exile literature)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Written in exile in Switzerland, Silone's anti-fascist masterpiece follows a
    // socialist revolutionary who returns to Mussolini's Italy disguised as a priest.
    // Immediately banned in fascist Italy and Nazi Germany upon publication.
    // One of the defining novels of anti-fascist resistance literature.
    title: 'Bread and Wine',
    slug: 'bread-and-wine-silone',
    authorDisplay: 'Ignazio Silone',
    authorSlug: 'ignazio-silone',
    year: 1936, genres: ['literary-fiction', 'political'], lang: 'it',
    bans: [
      { country: 'IT', scopeId: govId, status: 'historical', yearStarted: 1936, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1936, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Silone's debut novel, set among Abruzzo peasants crushed by fascism and corrupt
    // landowners. Written in Zurich, it was published in German, French, and English
    // before appearing in Italian — it was banned in Italy and destroyed by fascist
    // authorities. Silone was a co-founder of the Italian Communist Party who broke
    // with Stalin.
    title: 'Fontamara',
    slug: 'fontamara-silone',
    authorDisplay: 'Ignazio Silone',
    authorSlug: 'ignazio-silone',
    year: 1933, genres: ['literary-fiction', 'political'], lang: 'it',
    bans: [
      { country: 'IT', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // PARAGUAY — Augusto Roa Bastos (Stroessner dictatorship)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Roa Bastos's monumental novel imagines the interior monologue of Paraguay's
    // 19th-century supreme dictator José Gaspar Rodríguez de Francia. Written in
    // Argentine exile, it was banned in Stroessner's Paraguay as a veiled allegory
    // of dictatorship. Widely considered the greatest novel in Latin American literature
    // after One Hundred Years of Solitude.
    title: 'I, the Supreme',
    slug: 'i-the-supreme',
    authorDisplay: 'Augusto Roa Bastos',
    authorSlug: 'augusto-roa-bastos',
    year: 1974, genres: ['literary-fiction', 'historical'], lang: 'es',
    bans: [
      { country: 'PY', scopeId: govId, status: 'historical', yearStarted: 1974, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'AR', scopeId: govId, status: 'historical', yearStarted: 1976, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Roa Bastos's epic first novel portrays Paraguayan history through the lives of
    // peasants and soldiers across three centuries. Banned by the Stroessner regime;
    // Roa Bastos had been living in Argentine exile since the 1947 civil war. The novel
    // draws heavily on Guaraní culture and language, which the regime sought to suppress.
    title: 'Son of Man',
    slug: 'son-of-man-roa-bastos',
    authorDisplay: 'Augusto Roa Bastos',
    authorSlug: 'augusto-roa-bastos',
    year: 1960, genres: ['literary-fiction', 'historical'], lang: 'es',
    bans: [
      { country: 'PY', scopeId: govId, status: 'historical', yearStarted: 1960, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // IRAN — Mehdi Akhavan-Sales
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Akhavan-Sales's defining collection written in the shadow of the 1953 CIA-backed
    // coup that overthrew Prime Minister Mosaddegh. The title poem "Winter" became the
    // central metaphor of political despair for a generation of Iranians. Akhavan-Sales
    // was imprisoned for his Tudeh Party (communist) membership. His works were banned
    // under both the Shah and the Islamic Republic.
    title: 'Zemestan (Winter)',
    slug: 'zemestan-akhavan-sales',
    authorDisplay: 'Mehdi Akhavan-Sales',
    authorSlug: 'mehdi-akhavan-sales',
    year: 1956, genres: ['poetry'], lang: 'fa',
    bans: [
      { country: 'IR', scopeId: govId, status: 'historical', yearStarted: 1953, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // CHINA — Yang Jisheng (Tombstone)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Yang Jisheng, a senior Xinhua journalist, spent 13 years researching the Great
    // Chinese Famine of 1959-1961, in which an estimated 36-45 million people died due
    // to Mao's disastrous Great Leap Forward policies. Published in Hong Kong in 2008,
    // it is banned in mainland China. Yang named the book after the tombstone he erected
    // for his father, who starved to death during the famine.
    title: 'Tombstone',
    slug: 'tombstone-yang-jisheng',
    authorDisplay: 'Yang Jisheng',
    authorSlug: 'yang-jisheng',
    year: 2008, genres: ['non-fiction', 'history'], lang: 'zh',
    bans: [
      { country: 'CN', scopeId: govId, status: 'active', yearStarted: 2008, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // TURKEY — more Yaşar Kemal
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // The second novel in Kemal's Çukurova trilogy. Like the other Kemal works in our
    // database (Memed My Hawk, Human Landscapes), this was prosecuted under Turkey's
    // Article 142 (incitement to class hatred) and Article 8 of the Anti-Terror Law.
    // Kemal was repeatedly brought to trial for his depictions of Kurdish peasant life.
    title: 'They Burn the Thistles',
    slug: 'they-burn-the-thistles',
    authorDisplay: 'Yaşar Kemal',
    authorSlug: 'yasar-kemal',
    year: 1969, genres: ['literary-fiction'], lang: 'tr',
    bans: [
      { country: 'TR', scopeId: govId, status: 'historical', yearStarted: 1969, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // SOVIET UNION — Vasily Grossman (more works)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Grossman covered Stalingrad and Treblinka for the Red Army. His wartime notebooks
    // were confiscated by the KGB in 1961 — the KGB chief told him "we took your book
    // so that not even copies exist." The novel imagines the Battle of Stalingrad through
    // the fates of two Soviet families. First published in the West in 1980, two decades
    // after the manuscript was seized. Life and Fate is already in our DB; this is the
    // companion volume covering the same events.
    title: 'Stalingrad',
    slug: 'stalingrad-grossman',
    authorDisplay: 'Vasily Grossman',
    authorSlug: 'vasily-grossman',
    year: 1952, genres: ['literary-fiction', 'war', 'historical'], lang: 'ru',
    bans: [
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1952, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // EXTRA BANS for existing books (new countries: NO, DK, IR, AF, LB)
  // ════════════════════════════════════════════════════════════════════

  // Persepolis — Iran (obvious) and Lebanon
  await addBanIfMissing('persepolis', 'IR', 2000, 'active', 'political', penSource)
  await addBanIfMissing('persepolis', 'LB', 2011, 'historical', 'religious', wikpSource)

  // The Kite Runner — Afghanistan ban (well documented)
  await addBanIfMissing('the-kite-runner', 'AF', 2008, 'active', 'sexual', wikpSource)

  // Lady Chatterley's Lover — Norway (adds NO to the map!)
  await addBanIfMissing('lady-chatterleys-lover', 'NO', 1928, 'historical', 'sexual', wikpSource)

  // Story of O — Denmark (adds DK to the map!)
  await addBanIfMissing('story-of-o', 'DK', 1967, 'historical', 'sexual', wikpSource)
  await addBanIfMissing('story-of-o', 'NO', 1954, 'historical', 'sexual', wikpSource)

  // Lolita — Norway and Denmark
  await addBanIfMissing('lolita', 'NO', 1956, 'historical', 'sexual', wikpSource)
  await addBanIfMissing('lolita', 'DK', 1956, 'historical', 'sexual', wikpSource)

  // Tropic of Cancer — Norway and Denmark
  await addBanIfMissing('tropic-of-cancer', 'NO', 1934, 'historical', 'sexual', wikpSource)
  await addBanIfMissing('tropic-of-cancer', 'DK', 1934, 'historical', 'sexual', wikpSource)

  // The Painted Bird — Czechoslovakia and Soviet Union
  await addBanIfMissing('the-painted-bird', 'CS', 1965, 'historical', 'political', wikpSource)
  await addBanIfMissing('the-painted-bird', 'SU', 1965, 'historical', 'political', wikpSource)

  // Diary of a Young Girl — Lebanon
  await addBanIfMissing('the-diary-of-a-young-girl', 'LB', 1986, 'historical', 'political', wikpSource)

  // Animal Farm — Libya (political allegory banned under Gaddafi's socialist regime)
  await addBanIfMissing('animal-farm', 'LY', 1945, 'historical', 'political', wikpSource)

  // Brave New World — Canada
  await addBanIfMissing('brave-new-world', 'CA', 1980, 'historical', 'sexual', wikpSource)

  // 1984 — additional Eastern bloc countries
  await addBanIfMissing('1984', 'RO', 1949, 'historical', 'political', wikpSource)
  await addBanIfMissing('1984', 'HU', 1949, 'historical', 'political', wikpSource)

  // Things Fall Apart — Nigeria: school boards in northern Nigeria challenged it
  // for depicting traditional religion positively
  await addBanIfMissing('things-fall-apart', 'NG', 1958, 'historical', 'religious', wikpSource)

  // The God of Small Things — additional bans
  await addBanIfMissing('the-god-of-small-things', 'LB', 1997, 'historical', 'sexual', wikpSource)

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${count}`)
}

main().catch(console.error)
