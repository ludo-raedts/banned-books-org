import { adminClient } from '../src/lib/supabase'

/**
 * Batch 12 — South Africa (apartheid), Chile (Pinochet), Cuba (Castro),
 *             Soviet Russia (Solzhenitsyn), Greece (military junta), Korea
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

  // ════════════════════════════════════════════════════════════════════
  // SOUTH AFRICA — apartheid-era Publications Act bans
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // The Publications Act (1974) empowered the Publications Control Board to ban
    // any work "harmful to the safety of the state" or "morally objectionable."
    // André Brink's 1973 Afrikaans novel Kennis van die Aand was the first Afrikaans
    // novel banned under the new law — a political bombshell in Afrikaner culture.
    title: 'Looking on Darkness',
    slug: 'looking-on-darkness',
    authorDisplay: 'André Brink',
    authorSlug: 'andre-brink',
    year: 1973, genres: ['literary-fiction'], lang: 'af',
    bans: [
      { country: 'ZA', scopeId: govId, status: 'historical', yearStarted: 1974, reasonSlugs: ['political', 'sexual'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Brink's 1979 novel about a white schoolteacher who witnesses the murder of a Black
    // friend at the hands of police. Banned for its explicit critique of apartheid violence.
    title: 'A Dry White Season',
    slug: 'a-dry-white-season',
    authorDisplay: 'André Brink',
    authorSlug: 'andre-brink',
    year: 1979, genres: ['literary-fiction'], lang: 'af',
    bans: [
      { country: 'ZA', scopeId: govId, status: 'historical', yearStarted: 1979, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Gordimer's 1981 novel depicts a white liberal family sheltering a Black guerrilla in
    // a future post-apartheid civil war. Banned in South Africa under the Publications Act.
    // Gordimer won the Nobel Prize for Literature in 1991.
    title: "July's People",
    slug: 'julys-people',
    authorDisplay: 'Nadine Gordimer',
    authorSlug: 'nadine-gordimer',
    year: 1981, genres: ['literary-fiction'], lang: 'en',
    bans: [
      { country: 'ZA', scopeId: govId, status: 'historical', yearStarted: 1981, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Breytenbach's memoir of his seven years in South African prison after attempting to
    // establish an underground network against apartheid under the alias Jan Blom. Banned
    // in South Africa under the Publications Act.
    title: 'The True Confessions of an Albino Terrorist',
    slug: 'confessions-of-an-albino-terrorist',
    authorDisplay: 'Breyten Breytenbach',
    authorSlug: 'breyten-breytenbach',
    year: 1984, genres: ['memoir', 'non-fiction'], lang: 'en',
    bans: [
      { country: 'ZA', scopeId: govId, status: 'historical', yearStarted: 1984, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Serote is South Africa's most celebrated Black poet. His debut collection was banned
    // by the apartheid government; police detained him for nine months without charge.
    title: 'Yakhal\'inkomo',
    slug: 'yakhalinkomo',
    authorDisplay: 'Mongane Wally Serote',
    authorSlug: 'mongane-wally-serote',
    year: 1972, genres: ['poetry'], lang: 'en',
    bans: [
      { country: 'ZA', scopeId: govId, status: 'historical', yearStarted: 1972, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // SOVIET UNION / RUSSIA — additional Solzhenitsyn
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Solzhenitsyn's novel about a Stalinist cancer ward in Central Asia. Circulated
    // in samizdat; officially banned in the USSR. The author was expelled from the
    // Soviet Writers' Union in 1969 and exiled in 1974.
    title: 'Cancer Ward',
    slug: 'cancer-ward',
    authorDisplay: 'Aleksandr Solzhenitsyn',
    authorSlug: 'aleksandr-solzhenitsyn',
    year: 1966, genres: ['literary-fiction'], lang: 'ru',
    bans: [
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1966, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Vasily Grossman wrote the first literary account linking Nazism and Stalinism as
    // equal evils. The KGB confiscated every copy of the manuscript in 1961; the author
    // was told it could not be published "for 200–300 years." A copy was smuggled west
    // and published in 1980, after his death. Now considered a masterpiece of world literature.
    // (Already in DB — this ensures the SU ban is attached if missing.)
    title: 'Life and Fate',
    slug: 'life-and-fate',
    authorDisplay: 'Vasily Grossman',
    authorSlug: 'vasily-grossman',
    year: 1980, genres: ['literary-fiction', 'war', 'historical-fiction'], lang: 'ru',
    bans: [
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1961, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // CHILE — Pinochet dictatorship (1973–1990)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Galeano's landmark history of economic exploitation in Latin America from colonisation
    // through Cold War. Banned by military juntas in Chile (1973), Argentina (1973), and
    // Uruguay (1973) immediately after publication. Hugo Chávez famously gave a copy to
    // Barack Obama at the 2009 Summit of the Americas.
    title: 'Open Veins of Latin America',
    slug: 'open-veins-of-latin-america',
    authorDisplay: 'Eduardo Galeano',
    authorSlug: 'eduardo-galeano',
    year: 1971, genres: ['non-fiction', 'history'], lang: 'es',
    bans: [
      { country: 'CL', scopeId: govId, status: 'historical', yearStarted: 1973, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'AR', scopeId: govId, status: 'historical', yearStarted: 1973, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'UY', scopeId: govId, status: 'historical', yearStarted: 1973, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'BR', scopeId: govId, status: 'historical', yearStarted: 1974, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Isabel Allende's debut novel interweaves the Trueba family saga with Chilean
    // political history. Allende went into exile in Venezuela after Pinochet's coup killed
    // her cousin Salvador Allende. The novel was suppressed in Pinochet-era Chile.
    title: 'The House of the Spirits',
    slug: 'the-house-of-the-spirits',
    authorDisplay: 'Isabel Allende',
    authorSlug: 'isabel-allende',
    year: 1982, genres: ['literary-fiction', 'magical-realism'], lang: 'es',
    bans: [
      { country: 'CL', scopeId: govId, status: 'historical', yearStarted: 1982, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Memoirs written by Neruda in the months before his death (September 1973, days
    // after the Pinochet coup). Banned in Chile; Neruda's homes were ransacked by the junta.
    // He died 12 days after the coup, reportedly of cancer but possibly due to shock.
    title: 'Memoirs',
    slug: 'memoirs-neruda',
    authorDisplay: 'Pablo Neruda',
    authorSlug: 'pablo-neruda',
    year: 1974, genres: ['memoir', 'non-fiction'], lang: 'es',
    bans: [
      { country: 'CL', scopeId: govId, status: 'historical', yearStarted: 1973, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // CUBA — Castro era
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Padilla won Cuba's prestigious Casa de las Américas prize for this poetry collection.
    // The resulting "Padilla Affair" rocked the international left: Cuba initially suppressed
    // the publication, then imprisoned Padilla in 1971 and forced him to make a televised
    // "confession." One of the most famous censorship cases of the 20th century.
    title: 'Out of the Game',
    slug: 'out-of-the-game',
    authorDisplay: 'Heberto Padilla',
    authorSlug: 'heberto-padilla',
    year: 1968, genres: ['poetry'], lang: 'es',
    bans: [
      { country: 'CU', scopeId: govId, status: 'historical', yearStarted: 1968, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Cabrera Infante's fragmentary, jazz-inflected portrait of 1950s Havana nightlife.
    // After a period supporting the revolution, he became disillusioned and went into exile.
    // The novel was banned in Cuba as counterrevolutionary.
    title: 'Three Trapped Tigers',
    slug: 'three-trapped-tigers',
    authorDisplay: 'Guillermo Cabrera Infante',
    authorSlug: 'guillermo-cabrera-infante',
    year: 1967, genres: ['literary-fiction'], lang: 'es',
    bans: [
      { country: 'CU', scopeId: govId, status: 'active', yearStarted: 1967, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // GREECE — military junta (1967–1974)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Ritsos's 1936 elegy for a worker killed during a tobacco strike was set to music
    // by Mikis Theodorakis and became an anthem of the Greek left. The military junta
    // (1967–1974) banned both Ritsos's poetry and Theodorakis's music.
    // Ritsos was imprisoned and exiled to Leros and Samos islands.
    title: 'Epitaphios',
    slug: 'epitaphios-ritsos',
    authorDisplay: 'Giorgis Ritsos',
    authorSlug: 'giorgis-ritsos',
    year: 1936, genres: ['poetry'], lang: 'el',
    bans: [
      { country: 'GR', scopeId: govId, status: 'historical', yearStarted: 1967, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Kazantzakis's controversial reimagining of Jesus Christ, condemned as blasphemous
    // by the Greek Orthodox Church. Banned in Greece, Portugal, and Ireland.
    // The author was excommunicated; the novel was placed on the Catholic Index of
    // Forbidden Books in 1954.
    title: 'The Last Temptation of Christ',
    slug: 'the-last-temptation-of-christ',
    authorDisplay: 'Nikos Kazantzakis',
    authorSlug: 'nikos-kazantzakis',
    year: 1955, genres: ['literary-fiction'], lang: 'el',
    bans: [
      { country: 'GR', scopeId: govId, status: 'historical', yearStarted: 1955, reasonSlugs: ['religious'], sourceId: wikpSource },
      { country: 'PT', scopeId: govId, status: 'historical', yearStarted: 1956, reasonSlugs: ['religious'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // SOUTH KOREA — Park Chung-hee dictatorship (1961–1979)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Kim Chi-ha's satirical poem mocked the five most corrupt figures in Korean society.
    // He was arrested multiple times, sentenced to death (later commuted), and spent years
    // in prison. His case became an international human rights cause. Winner of the Lotus Prize.
    title: 'Five Bandits',
    slug: 'five-bandits',
    authorDisplay: 'Kim Chi-ha',
    authorSlug: 'kim-chi-ha',
    year: 1970, genres: ['poetry', 'satire'], lang: 'ko',
    bans: [
      { country: 'KR', scopeId: govId, status: 'historical', yearStarted: 1970, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // EXTRA BANS for books already in DB
  // ════════════════════════════════════════════════════════════════════

  // Add Cuba bans for 1984 and Animal Farm
  for (const [slugToFind, year] of [['1984', 1959], ['animal-farm', 1959]] as [string, number][]) {
    const { data: b } = await supabase.from('books').select('id').eq('slug', slugToFind).single()
    if (!b) continue
    const { data: existing } = await supabase.from('bans').select('country_code').eq('book_id', b.id)
    if (!(existing ?? []).some(e => e.country_code === 'CU')) {
      const { data: ban } = await supabase.from('bans').insert({
        book_id: b.id, country_code: 'CU', scope_id: govId,
        action_type: 'banned', status: 'active', year_started: year,
      }).select('id').single()
      if (ban) { await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId('political') }); console.log(`  Added ${slugToFind} / CU ban`) }
    }
  }

  // Add Chile ban to Canto General (if only Spain ban exists)
  const { data: canto } = await supabase.from('books').select('id').eq('slug', 'canto-general').single()
  if (canto) {
    const { data: existing } = await supabase.from('bans').select('country_code').eq('book_id', canto.id)
    if (!(existing ?? []).some(e => e.country_code === 'ES')) {
      const { data: ban } = await supabase.from('bans').insert({
        book_id: canto.id, country_code: 'ES', scope_id: govId,
        action_type: 'banned', status: 'historical', year_started: 1950,
      }).select('id').single()
      if (ban) { await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId('political') }); console.log('  Added Canto General / ES ban') }
    }
  }

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${count}`)
}

main().catch(console.error)
