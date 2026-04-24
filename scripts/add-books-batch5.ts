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
      coverUrl:    doc?.cover_i            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
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

  const govId    = scopeId('government')
  const schoolId = scopeId('school')
  const libId    = scopeId('public_library')

  const wikpSource = await upsertSource('Wikipedia', 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments')
  const alaSource  = await upsertSource('ALA Office for Intellectual Freedom', 'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks')

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
      title: opts.title, slug: opts.slug,
      original_language: opts.lang ?? 'en',
      first_published_year: opts.year, ai_drafted: false, genres: opts.genres,
      cover_url: ol.coverUrl, openlibrary_work_id: ol.workId,
    }).select('id').single()
    if (be) { console.error(`  [error] ${opts.title}: ${be.message}`); return }
    const bookId = book.id
    existingSlugs.add(opts.slug)

    if (authorId) await supabase.from('book_authors').insert({ book_id: bookId, author_id: authorId })

    for (const ban of opts.bans) {
      const { data: newBan, error: bane } = await supabase.from('bans').insert({
        book_id: bookId, country_code: ban.country, scope_id: ban.scopeId,
        action_type: 'banned', status: ban.status, year_started: ban.yearStarted,
      }).select('id').single()
      if (bane) { console.error(`  [ban error] ${ban.country}: ${bane.message}`); continue }
      for (const rs of ban.reasonSlugs) await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: reasonId(rs) })
      if (ban.sourceId) await supabase.from('ban_source_links').insert({ ban_id: newBan.id, source_id: ban.sourceId })
    }
    console.log(`  [ok] ${opts.title}`)
  }

  // ── ALA challenged classics ───────────────────────────────────────────────

  await addBook({
    title: 'Are You There God? It\'s Me, Margaret', slug: 'are-you-there-god',
    authorDisplay: 'Judy Blume', authorSlug: 'judy-blume',
    year: 1970, genres: ['young-adult', 'coming-of-age'],
    bans: [{ country: 'US', scopeId: schoolId, status: 'historical', yearStarted: 1980, reasonSlugs: ['religious', 'sexual'], sourceId: alaSource }],
  })

  await addBook({
    title: 'Blubber', slug: 'blubber',
    authorDisplay: 'Judy Blume', authorSlug: 'judy-blume',
    year: 1974, genres: ['young-adult'],
    bans: [{ country: 'US', scopeId: schoolId, status: 'historical', yearStarted: 1980, reasonSlugs: ['language', 'moral'], sourceId: alaSource }],
  })

  await addBook({
    title: 'Lord of the Flies', slug: 'lord-of-the-flies',
    authorDisplay: 'William Golding', authorSlug: 'william-golding',
    year: 1954, genres: ['literary-fiction'],
    bans: [
      { country: 'US', scopeId: schoolId, status: 'historical', yearStarted: 1974, reasonSlugs: ['violence', 'language', 'racial'], sourceId: alaSource },
      { country: 'AU', scopeId: schoolId, status: 'historical', yearStarted: 1980, reasonSlugs: ['violence'], sourceId: alaSource },
    ],
  })

  await addBook({
    title: 'It', slug: 'it-stephen-king',
    authorDisplay: 'Stephen King', authorSlug: 'stephen-king',
    year: 1986, genres: ['horror'],
    bans: [{ country: 'US', scopeId: libId, status: 'historical', yearStarted: 1990, reasonSlugs: ['sexual', 'violence', 'language'], sourceId: alaSource }],
  })

  await addBook({
    title: 'Misery', slug: 'misery-stephen-king',
    authorDisplay: 'Stephen King', authorSlug: 'stephen-king',
    year: 1987, genres: ['horror', 'thriller'],
    bans: [{ country: 'US', scopeId: libId, status: 'historical', yearStarted: 1992, reasonSlugs: ['violence', 'language'], sourceId: alaSource }],
  })

  // ── French banned classics ────────────────────────────────────────────────

  await addBook({
    title: 'Les Misérables', slug: 'les-miserables',
    authorDisplay: 'Victor Hugo', authorSlug: 'victor-hugo',
    year: 1862, genres: ['literary-fiction', 'historical-fiction'], lang: 'fr',
    bans: [
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1864, reasonSlugs: ['religious', 'political'], sourceId: wikpSource },
      { country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1939, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    title: 'Les Fleurs du Mal', slug: 'les-fleurs-du-mal',
    authorDisplay: 'Charles Baudelaire', authorSlug: 'charles-baudelaire',
    year: 1857, genres: ['literary-fiction'], lang: 'fr',
    bans: [
      { country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1857, reasonSlugs: ['obscenity', 'moral'], sourceId: wikpSource },
      { country: 'BE', scopeId: govId, status: 'historical', yearStarted: 1857, reasonSlugs: ['obscenity', 'moral'], sourceId: wikpSource },
    ],
  })

  await addBook({
    title: 'Germinal', slug: 'germinal',
    authorDisplay: 'Émile Zola', authorSlug: 'emile-zola',
    year: 1885, genres: ['literary-fiction', 'historical-fiction'], lang: 'fr',
    bans: [
      { country: 'RU', scopeId: govId, status: 'historical', yearStarted: 1885, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    title: 'Sons and Lovers', slug: 'sons-and-lovers',
    authorDisplay: 'D.H. Lawrence', authorSlug: 'dh-lawrence',
    year: 1913, genres: ['literary-fiction'],
    bans: [
      { country: 'AU', scopeId: govId, status: 'historical', yearStarted: 1930, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource },
      { country: 'US', scopeId: govId, status: 'historical', yearStarted: 1930, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource },
    ],
  })

  await addBook({
    title: 'The Stranger', slug: 'the-stranger-camus',
    authorDisplay: 'Albert Camus', authorSlug: 'albert-camus',
    year: 1942, genres: ['literary-fiction'], lang: 'fr',
    bans: [
      { country: 'US', scopeId: schoolId, status: 'historical', yearStarted: 1980, reasonSlugs: ['moral', 'religious'], sourceId: alaSource },
    ],
  })

  // ── Soviet-era banned literature ──────────────────────────────────────────

  await addBook({
    title: 'We', slug: 'we-zamyatin',
    authorDisplay: 'Yevgeny Zamyatin', authorSlug: 'yevgeny-zamyatin',
    year: 1924, genres: ['dystopian', 'literary-fiction'], lang: 'ru',
    bans: [
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1921, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    title: 'Cancer Ward', slug: 'cancer-ward',
    authorDisplay: 'Aleksandr Solzhenitsyn', authorSlug: 'aleksandr-solzhenitsyn',
    year: 1968, genres: ['literary-fiction'], lang: 'ru',
    bans: [
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1966, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    title: 'Life and Fate', slug: 'life-and-fate',
    authorDisplay: 'Vasily Grossman', authorSlug: 'vasily-grossman',
    year: 1980, genres: ['literary-fiction', 'historical-fiction'], lang: 'ru',
    bans: [
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1960, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ── Obscenity bans ────────────────────────────────────────────────────────

  await addBook({
    title: 'The Story of O', slug: 'the-story-of-o',
    authorDisplay: 'Pauline Réage', authorSlug: 'pauline-reage',
    year: 1954, genres: ['literary-fiction'], lang: 'fr',
    bans: [
      { country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1955, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource },
      { country: 'AU', scopeId: govId, status: 'historical', yearStarted: 1960, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource },
    ],
  })

  await addBook({
    title: 'Fanny Hill', slug: 'fanny-hill',
    authorDisplay: 'John Cleland', authorSlug: 'john-cleland',
    year: 1748, genres: ['literary-fiction'],
    bans: [
      { country: 'GB', scopeId: govId, status: 'historical', yearStarted: 1749, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource },
      { country: 'US', scopeId: govId, status: 'historical', yearStarted: 1821, reasonSlugs: ['sexual', 'obscenity'], sourceId: wikpSource },
    ],
  })

  await addBook({
    title: 'Moll Flanders', slug: 'moll-flanders',
    authorDisplay: 'Daniel Defoe', authorSlug: 'daniel-defoe',
    year: 1722, genres: ['literary-fiction'],
    bans: [
      { country: 'US', scopeId: govId, status: 'historical', yearStarted: 1833, reasonSlugs: ['sexual', 'moral'], sourceId: wikpSource },
    ],
  })

  // ── Other notable ─────────────────────────────────────────────────────────

  await addBook({
    title: 'One Thousand and One Nights', slug: 'one-thousand-and-one-nights',
    authorDisplay: 'Anonymous', authorSlug: 'anonymous',
    year: 1706, genres: ['literary-fiction'],
    bans: [
      { country: 'EG', scopeId: govId, status: 'historical', yearStarted: 1985, reasonSlugs: ['sexual', 'religious'], sourceId: wikpSource },
      { country: 'SA', scopeId: govId, status: 'active', yearStarted: 1985, reasonSlugs: ['sexual', 'religious'], sourceId: wikpSource },
    ],
  })

  await addBook({
    title: 'Siddhartha', slug: 'siddhartha',
    authorDisplay: 'Hermann Hesse', authorSlug: 'hermann-hesse',
    year: 1922, genres: ['literary-fiction'], lang: 'de',
    bans: [
      { country: 'US', scopeId: schoolId, status: 'historical', yearStarted: 1975, reasonSlugs: ['religious'], sourceId: alaSource },
    ],
  })

  await addBook({
    title: 'Uncle Tom\'s Cabin', slug: 'uncle-toms-cabin',
    authorDisplay: 'Harriet Beecher Stowe', authorSlug: 'harriet-beecher-stowe',
    year: 1852, genres: ['literary-fiction', 'historical-fiction'],
    bans: [
      { country: 'US', scopeId: govId, status: 'historical', yearStarted: 1852, reasonSlugs: ['racial', 'political'], sourceId: wikpSource },
      { country: 'RU', scopeId: govId, status: 'historical', yearStarted: 1852, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    title: 'The Protocols of the Elders of Zion', slug: 'the-protocols-of-the-elders-of-zion',
    authorDisplay: 'Unknown', authorSlug: 'unknown-author',
    year: 1903, genres: ['non-fiction'],
    bans: [
      { country: 'RU', scopeId: govId, status: 'active', yearStarted: 1993, reasonSlugs: ['racial', 'political'], sourceId: wikpSource },
      { country: 'DE', scopeId: govId, status: 'active', yearStarted: 1945, reasonSlugs: ['racial', 'political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    title: 'The Autobiography of a Yogi', slug: 'autobiography-of-a-yogi',
    authorDisplay: 'Paramahansa Yogananda', authorSlug: 'paramahansa-yogananda',
    year: 1946, genres: ['memoir', 'non-fiction'],
    bans: [
      { country: 'IN', scopeId: govId, status: 'historical', yearStarted: 1966, reasonSlugs: ['religious'], sourceId: wikpSource },
    ],
  })

  // Ensure Belgium exists
  const { data: beCheck } = await supabase.from('countries').select('code').eq('code', 'BE').single()
  if (!beCheck) {
    await supabase.from('countries').insert({ code: 'BE', name_en: 'Belgium', slug: 'belgium' })
    console.log('Added country: Belgium')
  }
  const { data: vaCheck } = await supabase.from('countries').select('code').eq('code', 'VA').single()
  if (!vaCheck) {
    await supabase.from('countries').insert({ code: 'VA', name_en: 'Vatican City', slug: 'vatican-city' })
    console.log('Added country: Vatican City')
  }
  const { data: saCheck } = await supabase.from('countries').select('code').eq('code', 'SA').single()
  if (!saCheck) {
    await supabase.from('countries').insert({ code: 'SA', name_en: 'Saudi Arabia', slug: 'saudi-arabia' })
    console.log('Added country: Saudi Arabia')
  }
  const { data: egCheck } = await supabase.from('countries').select('code').eq('code', 'EG').single()
  if (!egCheck) {
    await supabase.from('countries').insert({ code: 'EG', name_en: 'Egypt', slug: 'egypt' })
    console.log('Added country: Egypt')
  }

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
