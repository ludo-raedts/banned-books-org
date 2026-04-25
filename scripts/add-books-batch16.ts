import { adminClient } from '../src/lib/supabase'

/**
 * Batch 16 — Enlightenment-era censored classics (Voltaire, Rousseau, Paine,
 *             Diderot, d'Holbach), more modern global bans
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
    if (!r) throw new Error(`Reason slug missing: "${slug}"`)
    return r.id
  }

  const govId    = scopeId('government')
  const customsId = scopeId('customs') ?? govId

  const wikpSource   = await upsertSource('Wikipedia – List of books banned by governments', 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments')
  const indexSource  = await upsertSource('Index Librorum Prohibitorum', 'https://en.wikipedia.org/wiki/Index_Librorum_Prohibitorum')

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
      original_language: opts.lang ?? 'fr',
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
  // ENLIGHTENMENT ERA — France, UK, Vatican
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Diderot's monumental encyclopedia was the intellectual weapon of the French
    // Enlightenment. The Paris Parlement banned it in 1759 on behalf of the Jesuits
    // for attacking religion and morality. Royal privilege revoked; Diderot continued
    // the work in secret. A 1765 edition was burned. Placed on the Catholic Index.
    title: "Encyclopédie",
    slug: 'encyclopedie-diderot',
    authorDisplay: 'Denis Diderot',
    authorSlug: 'denis-diderot',
    year: 1751, genres: ['non-fiction'], lang: 'fr',
    bans: [
      { country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1759, reasonSlugs: ['religious', 'political'], sourceId: wikpSource },
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1759, reasonSlugs: ['religious'], sourceId: indexSource },
    ],
  })

  await addBook({
    // Voltaire's satirical novel mocking organized religion and metaphysical optimism was
    // immediately condemned by the Geneva authorities and burned. Banned in France, Geneva,
    // and placed on the Catholic Index. Voltaire denied authorship, calling it
    // "a piece of nonsense" — but clearly wrote it. Probably the most banned work of the
    // French Enlightenment alongside the Encyclopédie.
    title: 'Philosophical Dictionary',
    slug: 'philosophical-dictionary-voltaire',
    authorDisplay: 'Voltaire',
    authorSlug: 'voltaire',
    year: 1764, genres: ['non-fiction', 'satire'], lang: 'fr',
    bans: [
      { country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1765, reasonSlugs: ['religious', 'political'], sourceId: wikpSource },
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1765, reasonSlugs: ['religious'], sourceId: indexSource },
    ],
  })

  await addBook({
    // Rousseau's treatise on education was burned by order of the Paris Parlement and
    // the Geneva authorities on the same day (June 11, 1762). Rousseau fled France.
    // The Catholic Church banned it. The book argued that children should learn through
    // direct experience rather than religious instruction — revolutionary and threatening.
    title: 'Emile, or On Education',
    slug: 'emile-or-on-education',
    authorDisplay: 'Jean-Jacques Rousseau',
    authorSlug: 'jean-jacques-rousseau',
    year: 1762, genres: ['non-fiction'], lang: 'fr',
    bans: [
      { country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1762, reasonSlugs: ['religious', 'political'], sourceId: wikpSource },
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1762, reasonSlugs: ['religious'], sourceId: indexSource },
    ],
  })

  await addBook({
    // Paine's defence of the French Revolution against Edmund Burke sold over 200,000
    // copies in Britain. The British government prosecuted him for seditious libel in 1792;
    // he fled to France. Part II, calling for the abolition of monarchy, led to the
    // prosecution of booksellers. The work was effectively banned in Britain.
    title: 'Rights of Man',
    slug: 'rights-of-man',
    authorDisplay: 'Thomas Paine',
    authorSlug: 'thomas-paine',
    year: 1791, genres: ['non-fiction', 'politics'], lang: 'en',
    bans: [
      { country: 'GB', scopeId: govId, status: 'historical', yearStarted: 1792, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Paine's deist critique of organized religion and the Bible. The British government
    // imprisoned printer Richard Carlile for six years (1819) for publishing it.
    // Multiple publishers were prosecuted. Banned or suppressed throughout the 19th century.
    title: 'The Age of Reason',
    slug: 'the-age-of-reason-paine',
    authorDisplay: 'Thomas Paine',
    authorSlug: 'thomas-paine',
    year: 1794, genres: ['non-fiction'], lang: 'en',
    bans: [
      { country: 'GB', scopeId: govId, status: 'historical', yearStarted: 1797, reasonSlugs: ['religious'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Baron d'Holbach's anonymously published work was the first explicitly atheist
    // manifesto in Western history. The Paris Parlement burned it publicly in 1770.
    // Placed on the Index. Hugely influential on the French Revolutionary generation.
    title: 'The System of Nature',
    slug: 'the-system-of-nature',
    authorDisplay: 'Baron d\'Holbach',
    authorSlug: 'baron-d-holbach',
    year: 1770, genres: ['non-fiction', 'philosophy'], lang: 'fr',
    bans: [
      { country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1770, reasonSlugs: ['religious', 'political'], sourceId: wikpSource },
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1770, reasonSlugs: ['religious'], sourceId: indexSource },
    ],
  })

  await addBook({
    // Voltaire's anonymous satirical attack on King Louis XV and the French political system.
    // The Paris Parlement condemned and burned it. Voltaire was already in exile in Prussia.
    // One of the most bitter satires of the Ancien Régime.
    title: 'Letters Concerning the English Nation',
    slug: 'letters-concerning-the-english-nation',
    authorDisplay: 'Voltaire',
    authorSlug: 'voltaire',
    year: 1733, genres: ['non-fiction', 'satire'], lang: 'fr',
    bans: [
      { country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1734, reasonSlugs: ['political', 'religious'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // MORE HISTORICAL — Islamic and medieval
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Averroës (Ibn Rushd) was the Islamic world's greatest Aristotelian philosopher.
    // In 1195, the Caliph al-Mansur ordered his works burned and banned throughout
    // Al-Andalus (Islamic Spain) after conservative religious scholars accused him of
    // apostasy. He was briefly exiled. His works survived through Latin translations
    // and profoundly influenced Thomas Aquinas and the Scholastic tradition.
    title: 'The Incoherence of the Incoherence',
    slug: 'the-incoherence-of-the-incoherence',
    authorDisplay: 'Ibn Rushd (Averroës)',
    authorSlug: 'ibn-rushd-averroes',
    year: 1180, genres: ['non-fiction', 'philosophy'], lang: 'ar',
    bans: [
      { country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1195, reasonSlugs: ['religious'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // RUSSIA (2022 Ukraine war era)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Akunin (pseudonym of Grigory Shalvovich Chkhartishvili) is Russia's most popular
    // mystery novelist. He fled Russia in 2014 after speaking out against Putin and
    // the annexation of Crimea. His books were pulled from Russian bookstores following
    // his outspoken opposition to the 2022 invasion of Ukraine.
    title: 'The Winter Queen',
    slug: 'the-winter-queen',
    authorDisplay: 'Boris Akunin',
    authorSlug: 'boris-akunin',
    year: 1998, genres: ['mystery', 'historical-fiction'], lang: 'ru',
    bans: [
      { country: 'RU', scopeId: govId, status: 'active', yearStarted: 2022, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Dmitry Glukhovsky's dystopian novel set in Moscow's subway system became an
    // international phenomenon. After speaking out against the 2022 Ukraine invasion,
    // Glukhovsky was charged in absentia under Russia's wartime censorship laws.
    // He was sentenced to 8 years in prison in absentia; all his books were removed
    // from Russian stores.
    title: 'Metro 2033',
    slug: 'metro-2033',
    authorDisplay: 'Dmitry Glukhovsky',
    authorSlug: 'dmitry-glukhovsky',
    year: 2002, genres: ['science-fiction', 'dystopian'], lang: 'ru',
    bans: [
      { country: 'RU', scopeId: govId, status: 'active', yearStarted: 2022, reasonSlugs: ['political'], sourceId: wikpSource },
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

  // Candide — France ban (Paris Parlement burned it 1759)
  await addBanIfMissing('candide', 'FR', 1759, 'historical', 'religious')
  await addBanIfMissing('candide', 'VA', 1762, 'historical', 'religious')

  // Naked Lunch — UK (Obscene Publications prosecution 1964)
  await addBanIfMissing('naked-lunch', 'GB', 1964, 'historical', 'sexual')

  // The Origin of Species — Greece (1937)
  await addBanIfMissing('the-origin-of-species', 'GR', 1937, 'historical', 'religious')

  // The Social Contract — Switzerland (Geneva burned it 1762)
  // FR and VA already in DB; add Geneva via Switzerland (CH)
  await addBanIfMissing('the-social-contract', 'GB', 1793, 'historical', 'political')

  // The Great Gatsby — add any bans?
  // Actually no well-documented government bans for Gatsby

  // Lolita — additional bans
  await addBanIfMissing('lolita', 'FR', 1956, 'historical', 'sexual')
  await addBanIfMissing('lolita', 'GB', 1955, 'historical', 'sexual')
  await addBanIfMissing('lolita', 'AU', 1955, 'historical', 'sexual')
  await addBanIfMissing('lolita', 'NZ', 1960, 'historical', 'sexual')
  await addBanIfMissing('lolita', 'AR', 1960, 'historical', 'sexual')

  // The Story of O — additional bans (UK prosecuted it)
  await addBanIfMissing('story-of-o', 'GB', 1956, 'historical', 'sexual')

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${count}`)
}

main().catch(console.error)
