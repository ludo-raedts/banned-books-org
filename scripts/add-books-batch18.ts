import { adminClient } from '../src/lib/supabase'

/**
 * Batch 18 — More China (Ma Jian, Chan Koonchung, Liao Yiwu),
 *             Pakistan (Mohammed Hanif), Ireland (Kate O'Brien),
 *             El Salvador (Roque Dalton), Gothic literature,
 *             more extra bans
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
  // CHINA — Ma Jian, Chan Koonchung, Liao Yiwu
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Ma Jian's first novel banned in China in 1987 for "spiritual pollution." He fled
    // to London. The novel is a travelogue of his walk across China from 1983-84;
    // the author searched for personal freedom while the Party tightened control.
    title: 'Red Dust',
    slug: 'red-dust-ma-jian',
    authorDisplay: 'Ma Jian',
    authorSlug: 'ma-jian',
    year: 1987, genres: ['memoir', 'literary-fiction'], lang: 'zh',
    bans: [
      { country: 'CN', scopeId: govId, status: 'active', yearStarted: 1987, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  await addBook({
    // Ma Jian's experimental fiction collection banned for "pornographic content."
    // The title story features a woman who literally sews her husband's ghost into her body.
    // Banned in China; published in the West where it won international prizes.
    title: 'The Noodle Maker',
    slug: 'the-noodle-maker',
    authorDisplay: 'Ma Jian',
    authorSlug: 'ma-jian',
    year: 1991, genres: ['short-stories', 'literary-fiction'], lang: 'zh',
    bans: [
      { country: 'CN', scopeId: govId, status: 'active', yearStarted: 1991, reasonSlugs: ['sexual', 'political'], sourceId: penSource },
    ],
  })

  await addBook({
    // Chan Koonchung's speculative novel imagines China in 2013 after a successful
    // financial crisis. Everyone is prosperous and content — except the protagonist,
    // who cannot understand why. A chilling satire of Chinese state happiness.
    // Banned in mainland China; published in Hong Kong and Taiwan.
    title: 'The Fat Years',
    slug: 'the-fat-years',
    authorDisplay: 'Chan Koonchung',
    authorSlug: 'chan-koonchung',
    year: 2009, genres: ['literary-fiction', 'dystopian', 'satire'], lang: 'zh',
    bans: [
      { country: 'CN', scopeId: govId, status: 'active', yearStarted: 2009, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Liao Yiwu's oral histories of underground Chinese Christians, Tibetan Buddhists,
    // and Muslim minorities. Banned in China before publication; first published abroad.
    // The author escaped to Germany in 2011 and continues to write about religious
    // persecution in China.
    title: 'God Is Red',
    slug: 'god-is-red-liao-yiwu',
    authorDisplay: 'Liao Yiwu',
    authorSlug: 'liao-yiwu',
    year: 2011, genres: ['non-fiction', 'history'], lang: 'zh',
    bans: [
      { country: 'CN', scopeId: govId, status: 'active', yearStarted: 2011, reasonSlugs: ['political', 'religious'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // PAKISTAN
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Mohammed Hanif's darkly comic debut novel about the military dictatorship of
    // Zia ul-Haq, culminating in his death in a plane crash. Banned in Pakistan for
    // its satirical portrayal of the Pakistani military and political establishment.
    title: 'A Case of Exploding Mangoes',
    slug: 'a-case-of-exploding-mangoes',
    authorDisplay: 'Mohammed Hanif',
    authorSlug: 'mohammed-hanif',
    year: 2008, genres: ['literary-fiction', 'satire'], lang: 'en',
    bans: [
      { country: 'PK', scopeId: govId, status: 'active', yearStarted: 2008, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // IRELAND — Censorship Board bans
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // O'Brien's novel was banned by the Irish Censorship Board because a single sentence
    // implied a homosexual embrace between two men. The phrase "she saw what she saw" was
    // deemed sufficient grounds for banning. One of the most notorious examples of
    // Irish censorship's excessive power. The Censorship Board's authority was not
    // appealed until the 1940s reforms.
    title: 'The Land of Spices',
    slug: 'the-land-of-spices',
    authorDisplay: 'Kate O\'Brien',
    authorSlug: 'kate-o-brien',
    year: 1941, genres: ['literary-fiction'], lang: 'en',
    bans: [
      { country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1941, reasonSlugs: ['lgbtq', 'sexual'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Edna O'Brien's follow-up to "The Country Girls," banned by the Irish Censorship
    // Board for its frank treatment of sexuality and a married woman's affair.
    // Like all her books, it was burned by a local priest in her home village of Tuamgraney.
    title: 'The Lonely Girl',
    slug: 'the-lonely-girl',
    authorDisplay: 'Edna O\'Brien',
    authorSlug: 'edna-o-brien',
    year: 1962, genres: ['literary-fiction'], lang: 'en',
    bans: [
      { country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1962, reasonSlugs: ['sexual', 'moral'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // EL SALVADOR
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Roque Dalton was El Salvador's greatest poet and a committed Marxist revolutionary.
    // His poetry, written partly while imprisoned and partly in exile in Cuba, was banned
    // under El Salvador's military governments. He was executed in 1975 by a faction of
    // the PRTC guerrilla organization he belonged to.
    title: 'Clandestine Poems',
    slug: 'clandestine-poems-dalton',
    authorDisplay: 'Roque Dalton',
    authorSlug: 'roque-dalton',
    year: 1975, genres: ['poetry'], lang: 'es',
    bans: [
      { country: 'SV', scopeId: govId, status: 'historical', yearStarted: 1965, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // GOTHIC LITERATURE — historical censorship
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Matthew Lewis's Gothic horror novel, featuring a monk who commits murder and rape
    // after making a pact with the Devil. Caused an immediate scandal; the government
    // pressured Lewis to bowdlerize it. Placed on the Catholic Index.
    // One of the most controversial novels of the 18th century.
    title: 'The Monk',
    slug: 'the-monk-matthew-lewis',
    authorDisplay: 'Matthew Lewis',
    authorSlug: 'matthew-lewis',
    year: 1796, genres: ['literary-fiction', 'horror'], lang: 'en',
    bans: [
      { country: 'GB', scopeId: govId, status: 'historical', yearStarted: 1797, reasonSlugs: ['sexual', 'religious'], sourceId: wikpSource },
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1819, reasonSlugs: ['religious', 'sexual'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // ARGENTINA — more Videla/Proceso era bans
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Cortázar's experimental novel, told through shuffleable chapters that can be
    // read in multiple orders. Banned in Argentina during the military dictatorship
    // (1976–1983) as a Marxist author; Cortázar had gone into exile in Paris.
    // One of the most innovative novels of the 20th century.
    title: 'Hopscotch',
    slug: 'hopscotch-cortazar',
    authorDisplay: 'Julio Cortázar',
    authorSlug: 'julio-cortazar',
    year: 1963, genres: ['literary-fiction'], lang: 'es',
    bans: [
      { country: 'AR', scopeId: govId, status: 'historical', yearStarted: 1976, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Puig's groundbreaking novel told entirely through dialogue and documents, about
    // two cellmates in an Argentine prison: a political prisoner and a gay man.
    // Banned in Argentina for its explicit homosexual content and political critique.
    // Adapted into a successful film and Broadway musical.
    title: 'Kiss of the Spider Woman',
    slug: 'kiss-of-the-spider-woman',
    authorDisplay: 'Manuel Puig',
    authorSlug: 'manuel-puig',
    year: 1976, genres: ['literary-fiction'], lang: 'es',
    bans: [
      { country: 'AR', scopeId: govId, status: 'historical', yearStarted: 1976, reasonSlugs: ['lgbtq', 'political'], sourceId: wikpSource },
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

  // More bans for classic works
  await addBanIfMissing('tropic-of-cancer', 'AU', 1934, 'historical', 'sexual')
  await addBanIfMissing('tropic-of-cancer', 'GB', 1934, 'historical', 'sexual')
  await addBanIfMissing('tropic-of-capricorn', 'AU', 1939, 'historical', 'sexual')
  await addBanIfMissing('tropic-of-capricorn', 'GB', 1939, 'historical', 'sexual')

  // Brave New World — various bans
  await addBanIfMissing('brave-new-world', 'AU', 1932, 'historical', 'sexual')

  // Animal Farm — Cuba and North Korea-adjacent bans (KP doesn't exist, skip)
  await addBanIfMissing('animal-farm', 'MY', 1989, 'active', 'political')

  // The Grapes of Wrath — California (US) government ban - it was banned by some county boards
  // Already has US school ban presumably

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${count}`)
}

main().catch(console.error)
