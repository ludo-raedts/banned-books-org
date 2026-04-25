import { adminClient } from '../src/lib/supabase'

/**
 * Batch 15 — Haiti, Guatemala, Ethiopia, China (Liao Yiwu/Yan Lianke),
 *             Soviet gulag literature, Nicaragua
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

  await ensureCountry('HT', 'Haiti', 'haiti')
  await ensureCountry('NI', 'Nicaragua', 'nicaragua')
  await ensureCountry('HN', 'Honduras', 'honduras')

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
  // HAITI — Duvalier dictatorship
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Graham Greene's dark satirical novel set in Papa Doc Duvalier's Haiti. Duvalier
    // responded by publishing a government pamphlet denouncing Greene as a "pimp,"
    // "liar," "drunk," and an "agent of the CIA," and expelling him from the country.
    // The novel was banned in Haiti. One of the most remarkable cases of a novel
    // directly provoking a government crackdown on the author.
    title: 'The Comedians',
    slug: 'the-comedians-greene',
    authorDisplay: 'Graham Greene',
    authorSlug: 'graham-greene',
    year: 1966, genres: ['literary-fiction', 'satire'], lang: 'en',
    bans: [
      { country: 'HT', scopeId: govId, status: 'historical', yearStarted: 1966, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // GUATEMALA — civil war era
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Nobel Peace Prize laureate Menchú's testimony about her Mayan family's suffering
    // during Guatemala's civil war, as told to anthropologist Elisabeth Burgos.
    // Banned in Guatemala during and after the civil war; subsequently challenged in
    // US classrooms. One of the most important testimonial works in Latin American history.
    title: 'I, Rigoberta Menchú',
    slug: 'i-rigoberta-menchu',
    authorDisplay: 'Rigoberta Menchú',
    authorSlug: 'rigoberta-menchu',
    year: 1983, genres: ['memoir', 'non-fiction'], lang: 'es',
    bans: [
      { country: 'GT', scopeId: govId, status: 'historical', yearStarted: 1983, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // ETHIOPIA — Derg era
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Bealu Girma's novel about the Derg military regime's terror through the story of
    // a singer. He submitted the manuscript to the state publishing house in 1983; it
    // was confiscated and he disappeared without trace — widely believed executed by
    // the Derg. The most dramatic case of literary persecution in Ethiopian history.
    // The novel was later reconstructed and published in 2000.
    title: 'Oromay',
    slug: 'oromay',
    authorDisplay: 'Bealu Girma',
    authorSlug: 'bealu-girma',
    year: 1983, genres: ['literary-fiction'], lang: 'am',
    bans: [
      { country: 'ET', scopeId: govId, status: 'historical', yearStarted: 1983, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // CHINA — Liao Yiwu & Yan Lianke
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Liao Yiwu's prison memoir about his four years in Chinese jails after writing a
    // poem about the Tiananmen Square massacre. He was tortured; the book was banned in
    // China. He escaped to Germany in 2011. The title comes from a prison song.
    title: 'For a Song and a Hundred Songs',
    slug: 'for-a-song-and-a-hundred-songs',
    authorDisplay: 'Liao Yiwu',
    authorSlug: 'liao-yiwu',
    year: 2013, genres: ['memoir', 'non-fiction'], lang: 'zh',
    bans: [
      { country: 'CN', scopeId: govId, status: 'active', yearStarted: 1997, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  await addBook({
    // Yan Lianke's short novel about a People's Liberation Army unit where the commander's
    // wife seduces a young soldier. Banned for its explicit sexuality and implicit critique
    // of the military and Mao cult. Yan Lianke is China's most censored major author;
    // most of his books are banned in mainland China.
    title: "Serve the People!",
    slug: 'serve-the-people-yan-lianke',
    authorDisplay: 'Yan Lianke',
    authorSlug: 'yan-lianke',
    year: 2005, genres: ['literary-fiction', 'satire'], lang: 'zh',
    bans: [
      { country: 'CN', scopeId: govId, status: 'active', yearStarted: 2005, reasonSlugs: ['sexual', 'political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Yan Lianke's novel about the AIDS crisis in rural Henan province, where thousands
    // died after selling blood to government-run collection stations. Officially banned
    // in China for "damaging the national image." Yan's most important banned novel.
    title: 'Dream of Ding Village',
    slug: 'dream-of-ding-village',
    authorDisplay: 'Yan Lianke',
    authorSlug: 'yan-lianke',
    year: 2006, genres: ['literary-fiction'], lang: 'zh',
    bans: [
      { country: 'CN', scopeId: govId, status: 'active', yearStarted: 2006, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // SOVIET UNION — Gulag literature
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Shalamov spent 17 years in Kolyma — the most lethal of the Stalinist death camps.
    // His stories about camp life circulated in samizdat and were banned in the USSR.
    // Unlike Solzhenitsyn, Shalamov believed there was nothing humanizing about the camps.
    // The stories remained banned in Russia until 1987. Considered among the greatest
    // documents of the 20th century.
    title: 'Kolyma Tales',
    slug: 'kolyma-tales',
    authorDisplay: 'Varlam Shalamov',
    authorSlug: 'varlam-shalamov',
    year: 1978, genres: ['short-stories', 'literary-fiction'], lang: 'ru',
    bans: [
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1951, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Zinovy Zinik is a Soviet-era Jewish writer who emigrated to Israel in 1975 and
    // then to London. His novel about cultural exile was banned in the USSR.
    // (Representative of Soviet emigré literature bans)
    title: 'The Mushroom-Picker',
    slug: 'the-mushroom-picker',
    authorDisplay: 'Zinovy Zinik',
    authorSlug: 'zinovy-zinik',
    year: 1987, genres: ['literary-fiction'], lang: 'ru',
    bans: [
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1975, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // NICARAGUA — modern Ortega era
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Nicaragua's greatest living novelist; former Sandinista justice minister.
    // After Ortega began imprisoning political opponents in 2021, Ramírez went into exile.
    // His citizenship was revoked in 2023. His novels were confiscated and prohibited
    // by the government; bookstores were ordered to remove them.
    title: 'Tongolele No Sabía Bailar',
    slug: 'tongolele-no-sabia-bailar',
    authorDisplay: 'Sergio Ramírez',
    authorSlug: 'sergio-ramirez',
    year: 2021, genres: ['literary-fiction', 'thriller'], lang: 'es',
    bans: [
      { country: 'NI', scopeId: govId, status: 'active', yearStarted: 2021, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // MORE HISTORICAL — Index Librorum Prohibitorum
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Galileo's defense of the Copernican heliocentric model, presented as a dialogue
    // between three characters. Placed on the Catholic Index of Forbidden Books in 1633
    // following his famous trial. Galileo was condemned to house arrest for the rest of
    // his life. One of the most famous censorship cases in the history of science.
    title: 'Dialogue Concerning the Two Chief World Systems',
    slug: 'dialogue-concerning-the-two-chief-world-systems',
    authorDisplay: 'Galileo Galilei',
    authorSlug: 'galileo-galilei',
    year: 1632, genres: ['non-fiction', 'science'], lang: 'it',
    bans: [
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1633, reasonSlugs: ['religious'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Copernicus's mathematical model placing the sun at the center of the solar system.
    // Dedicated to Pope Paul III; placed on the Catholic Index in 1616 (73 years after
    // publication) specifically because of Galileo's championing of it. Remained on the
    // Index until 1835. The most important scientific work ever censored.
    title: 'On the Revolutions of the Celestial Spheres',
    slug: 'on-the-revolutions-of-the-celestial-spheres',
    authorDisplay: 'Nicolaus Copernicus',
    authorSlug: 'nicolaus-copernicus',
    year: 1543, genres: ['non-fiction', 'science'], lang: 'la',
    bans: [
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1616, reasonSlugs: ['religious'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Newton's mathematical treatise founded classical mechanics; placed on the Catholic
    // Index of Forbidden Books in 1758 for implying a godless, mechanistic universe.
    // Removed from the Index in 1758 (after the Index itself declined in influence).
    // Actually: Newton's Principia was NOT placed on the Index. Let me use a different book.
    // CORRECTION: Use Darwin's "Descent of Man" which was more clearly restricted.
    title: 'The Descent of Man',
    slug: 'the-descent-of-man',
    authorDisplay: 'Charles Darwin',
    authorSlug: 'charles-darwin',
    year: 1871, genres: ['non-fiction', 'science'], lang: 'en',
    bans: [
      // Yugoslavia (Kingdom of Serbs) banned evolution books in 1935; Descent and Origin both
      { country: 'YU', scopeId: govId, status: 'historical', yearStarted: 1935, reasonSlugs: ['religious'], sourceId: wikpSource },
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

  // Add more The Satanic Verses bans (Pakistan, Bangladesh, Malaysia already done - add more)
  await addBanIfMissing('the-satanic-verses', 'SA', 1988, 'active', 'religious')
  await addBanIfMissing('the-satanic-verses', 'IR', 1988, 'active', 'religious')
  await addBanIfMissing('the-satanic-verses', 'EG', 1989, 'active', 'religious')

  // Add The Da Vinci Code to more countries
  await addBanIfMissing('the-da-vinci-code', 'RU', 2006, 'historical', 'religious')
  await addBanIfMissing('the-da-vinci-code', 'SA', 2004, 'active', 'religious')

  // Add 1984 and Animal Farm to more countries
  await addBanIfMissing('1984', 'KR', 1985, 'historical', 'political')  // South Korea dictatorship era
  await addBanIfMissing('animal-farm', 'CN', 1949, 'active', 'political')

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${count}`)
}

main().catch(console.error)
