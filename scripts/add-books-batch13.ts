import { adminClient } from '../src/lib/supabase'

/**
 * Batch 13 — Eastern Europe (Czechoslovakia, Romania, East Germany),
 *             Middle East (Iraq, Syria, Iran), more Soviet literature
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

  await ensureCountry('IQ', 'Iraq', 'iraq')
  await ensureCountry('SY', 'Syria', 'syria')
  await ensureCountry('LY', 'Libya', 'libya')
  await ensureCountry('BY', 'Belarus', 'belarus')

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
  // CZECHOSLOVAKIA — Communist censorship
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Kundera's first novel satirizes a man ruined by a joke written on a postcard.
    // Published in 1967 during the Prague Spring; banned and pulped after the Soviet
    // invasion in 1968. Kundera's entire backlist was banned in Czechoslovakia until 1989.
    title: 'The Joke',
    slug: 'the-joke-kundera',
    authorDisplay: 'Milan Kundera',
    authorSlug: 'milan-kundera',
    year: 1967, genres: ['literary-fiction', 'satire'], lang: 'cs',
    bans: [
      { country: 'CS', scopeId: govId, status: 'historical', yearStarted: 1968, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Hrabal's novel about a man who spends 35 years in a paper compactor, rescuing
    // great books from destruction. Circulated in samizdat from 1976; not officially
    // published until 1989. A love letter to literature under censorship.
    title: 'Too Loud a Solitude',
    slug: 'too-loud-a-solitude',
    authorDisplay: 'Bohumil Hrabal',
    authorSlug: 'bohumil-hrabal',
    year: 1976, genres: ['literary-fiction'], lang: 'cs',
    bans: [
      { country: 'CS', scopeId: govId, status: 'historical', yearStarted: 1976, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Havel's most famous play uses the absurdist premise of a gardener who becomes a
    // bureaucratic target for speaking too plainly. Written 1963; banned after 1968
    // along with all of Havel's other works. He was imprisoned multiple times.
    // (Checking if already in DB via [skip] guard)
    title: 'The Memorandum',
    slug: 'the-memorandum-havel',
    authorDisplay: 'Václav Havel',
    authorSlug: 'vaclav-havel',
    year: 1966, genres: ['drama', 'satire'], lang: 'cs',
    bans: [
      { country: 'CS', scopeId: govId, status: 'historical', yearStarted: 1968, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // ROMANIA — Ceaușescu era
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Herta Müller's debut collection about Romanian ethnic German life under the Securitate.
    // Censored and partially suppressed in Romania; the author was interrogated by the Securitate.
    // She fled to West Germany in 1987. Nobel Prize in Literature 2009.
    title: 'Nadirs',
    slug: 'nadirs-muller',
    authorDisplay: 'Herta Müller',
    authorSlug: 'herta-muller',
    year: 1982, genres: ['short-stories', 'literary-fiction'], lang: 'de',
    bans: [
      { country: 'RO', scopeId: govId, status: 'historical', yearStarted: 1982, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  await addBook({
    // Müller's second novel, suppressed in Romania; published uncensored in West Germany.
    // Depicts life under surveillance by the Securitate secret police.
    title: 'The Land of Green Plums',
    slug: 'the-land-of-green-plums',
    authorDisplay: 'Herta Müller',
    authorSlug: 'herta-muller',
    year: 1994, genres: ['literary-fiction'], lang: 'de',
    bans: [
      { country: 'RO', scopeId: govId, status: 'historical', yearStarted: 1982, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // EAST GERMANY — DDR censorship
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Biermann was East Germany's most famous dissident poet. The regime banned his
    // performances from 1965. In 1976, while on a concert tour of West Germany,
    // he was stripped of his East German citizenship — causing a wave of intellectual
    // emigration from the DDR. This collection was published in West Germany and was
    // strictly banned in the East.
    title: 'Wire Harp',
    slug: 'wire-harp-biermann',
    authorDisplay: 'Wolf Biermann',
    authorSlug: 'wolf-biermann',
    year: 1965, genres: ['poetry'], lang: 'de',
    bans: [
      { country: 'DD', scopeId: govId, status: 'historical', yearStarted: 1965, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // MIDDLE EAST — Iraq (Saddam Hussein era)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Published under the pseudonym "Samir al-Khalil" for safety reasons; reveals the
    // mechanics of terror under Ba'athist Iraq. Became the definitive text on how
    // Saddam Hussein built and maintained his dictatorship through pervasive fear.
    // Banned in Iraq; Makiya's identity was eventually revealed.
    title: 'Republic of Fear',
    slug: 'republic-of-fear',
    authorDisplay: 'Kanan Makiya',
    authorSlug: 'kanan-makiya',
    year: 1989, genres: ['non-fiction', 'politics'], lang: 'en',
    bans: [
      { country: 'IQ', scopeId: govId, status: 'historical', yearStarted: 1989, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // MIDDLE EAST — Syria (Assad regime)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Syria's most celebrated novelist was banned by the Assad regime. This novel about
    // sectarian hatred won the International Prize for Arabic Fiction in 2008.
    // Khalifa was previously arrested for his political activity.
    title: 'In Praise of Hatred',
    slug: 'in-praise-of-hatred',
    authorDisplay: 'Khaled Khalifa',
    authorSlug: 'khaled-khalifa',
    year: 2006, genres: ['literary-fiction'], lang: 'ar',
    bans: [
      { country: 'SY', scopeId: govId, status: 'active', yearStarted: 2006, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  await addBook({
    // Syrian dissident journalist's memoir of torture and imprisonment under Assad.
    // She fled Syria in 2012 and continued writing from France. Banned in Syria.
    title: 'A Woman in the Crossfire',
    slug: 'a-woman-in-the-crossfire',
    authorDisplay: 'Samar Yazbek',
    authorSlug: 'samar-yazbek',
    year: 2011, genres: ['memoir', 'non-fiction'], lang: 'ar',
    bans: [
      { country: 'SY', scopeId: govId, status: 'active', yearStarted: 2011, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // IRAN — Islamic Republic censorship
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // The most popular Iranian novel of the 20th century; the satirical family saga was
    // adapted into Iran's most watched TV series (1974–1975). After the 1979 revolution,
    // the book and the TV series were banned for depicting the aristocracy and for its
    // perceived mockery of revolutionary values.
    title: 'My Uncle Napoleon',
    slug: 'my-uncle-napoleon',
    authorDisplay: 'Iraj Pezeshkzad',
    authorSlug: 'iraj-pezeshkzad',
    year: 1973, genres: ['literary-fiction', 'satire'], lang: 'fa',
    bans: [
      { country: 'IR', scopeId: govId, status: 'active', yearStarted: 1979, reasonSlugs: ['political', 'moral'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Nafisi's memoir about teaching banned Western literature in Tehran recounts the
    // censorship of Nabokov, Fitzgerald, and James. The book itself is banned in Iran
    // as a work perceived to be hostile to the Islamic Republic.
    title: 'Reading Lolita in Tehran',
    slug: 'reading-lolita-in-tehran',
    authorDisplay: 'Azar Nafisi',
    authorSlug: 'azar-nafisi',
    year: 2003, genres: ['memoir', 'non-fiction'], lang: 'en',
    bans: [
      { country: 'IR', scopeId: govId, status: 'active', yearStarted: 2003, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // MEXICO — anti-clerical era
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Graham Greene set this novel in Mexico during the Cristero War (1926–1929) when
    // the government banned the Catholic Church. The whisky priest protagonist was seen
    // as an affront to revolutionary Mexico. The Catholic Church placed the novel on the
    // Index of Forbidden Books; Mexico itself restricted its distribution.
    title: 'The Power and the Glory',
    slug: 'the-power-and-the-glory',
    authorDisplay: 'Graham Greene',
    authorSlug: 'graham-greene',
    year: 1940, genres: ['literary-fiction'], lang: 'en',
    bans: [
      { country: 'MX', scopeId: govId, status: 'historical', yearStarted: 1940, reasonSlugs: ['religious', 'political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // SOVIET UNION — additional titles
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Grossman's unfinished philosophical novel confronting Stalinism and the Holocaust.
    // Written through the 1950s; Grossman gave copies to trusted friends.
    // Confiscated by the KGB along with Life and Fate in 1961.
    // First published in full in 1989 (Russia) and 1970 (West Germany fragment).
    title: 'Everything Flows',
    slug: 'everything-flows',
    authorDisplay: 'Vasily Grossman',
    authorSlug: 'vasily-grossman',
    year: 1970, genres: ['literary-fiction', 'historical-fiction'], lang: 'ru',
    bans: [
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1961, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Platonov's most experimental prose — absurdist allegories of collectivisation and
    // the destruction of the Russian peasantry. Stalin personally annotated a copy with
    // the note "scum" (svoloch). Banned during Platonov's lifetime; he died in poverty.
    title: 'The Foundation Pit',
    slug: 'the-foundation-pit',
    authorDisplay: 'Andrei Platonov',
    authorSlug: 'andrei-platonov',
    year: 1930, genres: ['literary-fiction'], lang: 'ru',
    bans: [
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1930, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Serge's semi-autobiographical novel of a Trotskyist revolutionary in Soviet prison.
    // Written in 1934 while Serge was under GPU surveillance; smuggled out to France.
    // Banned in the Soviet Union; Serge was exiled internally then expelled.
    title: 'Midnight in the Century',
    slug: 'midnight-in-the-century',
    authorDisplay: 'Victor Serge',
    authorSlug: 'victor-serge',
    year: 1939, genres: ['literary-fiction', 'historical-fiction'], lang: 'fr',
    bans: [
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1934, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // EXTRA BANS for existing books
  // ════════════════════════════════════════════════════════════════════

  // Add Iran ban for The Da Vinci Code
  const { data: daVinci } = await supabase.from('books').select('id').eq('slug', 'the-da-vinci-code').single()
  if (daVinci) {
    const { data: existing } = await supabase.from('bans').select('country_code').eq('book_id', daVinci.id)
    if (!(existing ?? []).some(e => e.country_code === 'IR')) {
      const { data: ban } = await supabase.from('bans').insert({
        book_id: daVinci.id, country_code: 'IR', scope_id: govId,
        action_type: 'banned', status: 'active', year_started: 2004,
      }).select('id').single()
      if (ban) { await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId('religious') }); console.log('  Added Da Vinci Code / IR ban') }
    }
  }

  // Add Czechoslovakia bans for Unbearable Lightness and The Captive Mind
  for (const [slugToFind, year] of [['the-unbearable-lightness-of-being', 1968], ['the-captive-mind', 1953]] as [string, number][]) {
    const { data: b } = await supabase.from('books').select('id').eq('slug', slugToFind).single()
    if (!b) continue
    const { data: existing } = await supabase.from('bans').select('country_code').eq('book_id', b.id)
    const codes = new Set((existing ?? []).map(e => e.country_code))
    if (!codes.has('CS')) {
      const { data: ban } = await supabase.from('bans').insert({
        book_id: b.id, country_code: 'CS', scope_id: govId,
        action_type: 'banned', status: 'historical', year_started: year,
      }).select('id').single()
      if (ban) { await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId('political') }); console.log(`  Added ${slugToFind} / CS ban`) }
    }
  }

  // Add The Tin Drum (Grass) ban in Poland (communist-era)
  const { data: tinDrum } = await supabase.from('books').select('id').eq('slug', 'the-tin-drum').single()
  if (tinDrum) {
    const { data: existing } = await supabase.from('bans').select('country_code').eq('book_id', tinDrum.id)
    if (!(existing ?? []).some(e => e.country_code === 'PL')) {
      const { data: ban } = await supabase.from('bans').insert({
        book_id: tinDrum.id, country_code: 'PL', scope_id: govId,
        action_type: 'banned', status: 'historical', year_started: 1959,
      }).select('id').single()
      if (ban) { await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId('political') }); console.log('  Added The Tin Drum / PL ban') }
    }
  }

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${count}`)
}

main().catch(console.error)
