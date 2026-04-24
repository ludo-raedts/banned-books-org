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

  const govId    = scopeId('government')
  const schoolId = scopeId('school')

  const wikpSource = await upsertSource('Wikipedia', 'https://en.wikipedia.org/wiki/List_of_books_banned_by_governments')
  const alaSource  = await upsertSource('ALA Office for Intellectual Freedom', 'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks')
  const penSource  = await upsertSource('PEN America', 'https://pen.org/book-bans/')

  // Ensure missing countries
  await ensureCountry('MM', 'Myanmar', 'myanmar')
  await ensureCountry('UY', 'Uruguay', 'uruguay')
  await ensureCountry('SV', 'El Salvador', 'el-salvador')
  await ensureCountry('BA', 'Bosnia and Herzegovina', 'bosnia-and-herzegovina')
  await ensureCountry('MU', 'Mauritius', 'mauritius')

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

  // ── Nazi Germany ─────────────────────────────────────────────────────────

  await addBook({
    title: 'Oliver Twist', slug: 'oliver-twist',
    authorDisplay: 'Charles Dickens', authorSlug: 'charles-dickens',
    year: 1839, genres: ['literary-fiction'],
    bans: [{ country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['racial'], sourceId: wikpSource }],
  })

  // ── Soviet / Russian literature ───────────────────────────────────────────

  await addBook({
    title: 'Heart of a Dog', slug: 'heart-of-a-dog',
    authorDisplay: 'Mikhail Bulgakov', authorSlug: 'mikhail-bulgakov',
    year: 1925, genres: ['literary-fiction'], lang: 'ru',
    bans: [{ country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1925, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    title: 'The White Guard', slug: 'the-white-guard',
    authorDisplay: 'Mikhail Bulgakov', authorSlug: 'mikhail-bulgakov',
    year: 1925, genres: ['literary-fiction', 'historical-fiction'], lang: 'ru',
    bans: [{ country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1929, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    title: 'The First Circle', slug: 'the-first-circle',
    authorDisplay: 'Aleksandr Solzhenitsyn', authorSlug: 'aleksandr-solzhenitsyn',
    year: 1968, genres: ['literary-fiction'], lang: 'ru',
    bans: [{ country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1968, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    title: 'Requiem', slug: 'requiem-akhmatova',
    authorDisplay: 'Anna Akhmatova', authorSlug: 'anna-akhmatova',
    year: 1963, genres: ['literary-fiction'], lang: 'ru',
    bans: [{ country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1963, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  // ── China ─────────────────────────────────────────────────────────────────

  await addBook({
    title: "Alice's Adventures in Wonderland", slug: 'alice-in-wonderland',
    authorDisplay: 'Lewis Carroll', authorSlug: 'lewis-carroll',
    year: 1865, genres: ['literary-fiction'],
    bans: [{ country: 'CN', scopeId: govId, status: 'historical', yearStarted: 1931, reasonSlugs: ['moral'], sourceId: wikpSource }],
  })

  // ── South Africa ──────────────────────────────────────────────────────────

  await addBook({
    title: "July's People", slug: 'julys-people',
    authorDisplay: 'Nadine Gordimer', authorSlug: 'nadine-gordimer',
    year: 1981, genres: ['literary-fiction'],
    bans: [{ country: 'ZA', scopeId: govId, status: 'historical', yearStarted: 1981, reasonSlugs: ['political'], sourceId: wikpSource }],
  })

  await addBook({
    title: 'I Write What I Like', slug: 'i-write-what-i-like',
    authorDisplay: 'Steve Biko', authorSlug: 'steve-biko',
    year: 1978, genres: ['non-fiction'],
    bans: [{ country: 'ZA', scopeId: govId, status: 'historical', yearStarted: 1978, reasonSlugs: ['political', 'racial'], sourceId: wikpSource }],
  })

  // ── Iran ──────────────────────────────────────────────────────────────────

  await addBook({
    title: 'The Blind Owl', slug: 'the-blind-owl',
    authorDisplay: 'Sadeq Hedayat', authorSlug: 'sadeq-hedayat',
    year: 1937, genres: ['literary-fiction'], lang: 'fa',
    bans: [{ country: 'IR', scopeId: govId, status: 'active', yearStarted: 1979, reasonSlugs: ['sexual', 'moral'], sourceId: wikpSource }],
  })

  await addBook({
    title: 'Women Without Men', slug: 'women-without-men',
    authorDisplay: 'Shahrnush Parsipur', authorSlug: 'shahrnush-parsipur',
    year: 1989, genres: ['literary-fiction'], lang: 'fa',
    bans: [{ country: 'IR', scopeId: govId, status: 'active', yearStarted: 1992, reasonSlugs: ['sexual', 'moral'], sourceId: wikpSource }],
  })

  await addBook({
    title: 'Lajja', slug: 'lajja',
    authorDisplay: 'Taslima Nasrin', authorSlug: 'taslima-nasrin',
    year: 1993, genres: ['literary-fiction'],
    bans: [
      { country: 'BD', scopeId: govId, status: 'active', yearStarted: 1993, reasonSlugs: ['religious', 'political'], sourceId: wikpSource },
      { country: 'IR', scopeId: govId, status: 'active', yearStarted: 1994, reasonSlugs: ['religious'], sourceId: wikpSource },
    ],
  })

  // ── Ireland (Censorship of Publications Board) ────────────────────────────

  await addBook({
    title: 'The Tailor and Ansty', slug: 'the-tailor-and-ansty',
    authorDisplay: 'Eric Cross', authorSlug: 'eric-cross',
    year: 1942, genres: ['literary-fiction'],
    bans: [{ country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1942, reasonSlugs: ['sexual', 'moral'], sourceId: wikpSource }],
  })

  await addBook({
    title: 'East of Eden', slug: 'east-of-eden',
    authorDisplay: 'John Steinbeck', authorSlug: 'john-steinbeck',
    year: 1952, genres: ['literary-fiction'],
    bans: [{ country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1953, reasonSlugs: ['sexual', 'moral'], sourceId: wikpSource }],
  })

  await addBook({
    title: 'Elmer Gantry', slug: 'elmer-gantry',
    authorDisplay: 'Sinclair Lewis', authorSlug: 'sinclair-lewis',
    year: 1927, genres: ['literary-fiction'],
    bans: [
      { country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1927, reasonSlugs: ['religious', 'sexual'], sourceId: wikpSource },
      { country: 'US', scopeId: govId, status: 'historical', yearStarted: 1927, reasonSlugs: ['religious'], sourceId: wikpSource },
    ],
  })

  await addBook({
    title: 'Married Love', slug: 'married-love',
    authorDisplay: 'Marie Stopes', authorSlug: 'marie-stopes',
    year: 1918, genres: ['non-fiction'],
    bans: [
      { country: 'IE', scopeId: govId, status: 'historical', yearStarted: 1931, reasonSlugs: ['moral'], sourceId: wikpSource },
      { country: 'US', scopeId: govId, status: 'historical', yearStarted: 1918, reasonSlugs: ['moral'], sourceId: wikpSource },
    ],
  })

  // ── Latin America ─────────────────────────────────────────────────────────

  await addBook({
    title: 'The Open Veins of Latin America', slug: 'the-open-veins-of-latin-america',
    authorDisplay: 'Eduardo Galeano', authorSlug: 'eduardo-galeano',
    year: 1971, genres: ['non-fiction', 'historical-fiction'], lang: 'es',
    bans: [
      { country: 'CL', scopeId: govId, status: 'historical', yearStarted: 1973, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'UY', scopeId: govId, status: 'historical', yearStarted: 1973, reasonSlugs: ['political'], sourceId: wikpSource },
      { country: 'AR', scopeId: govId, status: 'historical', yearStarted: 1976, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ── Russia post-2022 (LGBT propaganda law) ────────────────────────────────

  await addBook({
    title: 'Aristotle and Dante Discover the Secrets of the Universe', slug: 'aristotle-and-dante',
    authorDisplay: 'Benjamin Alire Sáenz', authorSlug: 'benjamin-alire-saenz',
    year: 2012, genres: ['young-adult', 'coming-of-age'],
    bans: [
      { country: 'RU', scopeId: govId, status: 'active', yearStarted: 2023, reasonSlugs: ['lgbtq'], sourceId: wikpSource },
      { country: 'US', scopeId: schoolId, status: 'active', yearStarted: 2015, reasonSlugs: ['lgbtq'], sourceId: penSource },
    ],
  })

  // ── Malaysia ──────────────────────────────────────────────────────────────

  await addBook({
    title: 'Fifty Shades of Grey', slug: 'fifty-shades-of-grey',
    authorDisplay: 'E.L. James', authorSlug: 'el-james',
    year: 2011, genres: ['literary-fiction'],
    bans: [{ country: 'MY', scopeId: govId, status: 'active', yearStarted: 2015, reasonSlugs: ['sexual', 'moral'], sourceId: wikpSource }],
  })

  await addBook({
    title: 'What If It\'s Us', slug: 'what-if-its-us',
    authorDisplay: 'Becky Albertalli & Adam Silvera', authorSlug: 'becky-albertalli-adam-silvera',
    year: 2018, genres: ['young-adult'],
    bans: [
      { country: 'MY', scopeId: govId, status: 'active', yearStarted: 2019, reasonSlugs: ['lgbtq'], sourceId: wikpSource },
      { country: 'US', scopeId: schoolId, status: 'active', yearStarted: 2020, reasonSlugs: ['lgbtq'], sourceId: penSource },
    ],
  })

  // ── Bangladesh ────────────────────────────────────────────────────────────

  await addBook({
    title: 'Amar Meyebela', slug: 'amar-meyebela',
    authorDisplay: 'Taslima Nasrin', authorSlug: 'taslima-nasrin',
    year: 1999, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'BD', scopeId: govId, status: 'active', yearStarted: 1999, reasonSlugs: ['religious', 'political'], sourceId: wikpSource }],
  })

  await addBook({
    title: 'Ka', slug: 'ka-taslima-nasrin',
    authorDisplay: 'Taslima Nasrin', authorSlug: 'taslima-nasrin',
    year: 2003, genres: ['memoir', 'non-fiction'],
    bans: [{ country: 'BD', scopeId: govId, status: 'active', yearStarted: 2003, reasonSlugs: ['religious', 'sexual'], sourceId: wikpSource }],
  })

  // ── Catholic Index / Enlightenment bans ───────────────────────────────────

  await addBook({
    title: 'The Social Contract', slug: 'the-social-contract',
    authorDisplay: 'Jean-Jacques Rousseau', authorSlug: 'jean-jacques-rousseau',
    year: 1762, genres: ['non-fiction'], lang: 'fr',
    bans: [
      { country: 'VA', scopeId: govId, status: 'historical', yearStarted: 1762, reasonSlugs: ['religious', 'political'], sourceId: wikpSource },
      { country: 'FR', scopeId: govId, status: 'historical', yearStarted: 1762, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ── Germany / Austria historic ────────────────────────────────────────────

  await addBook({
    title: 'The Sorrows of Young Werther', slug: 'the-sorrows-of-young-werther',
    authorDisplay: 'Johann Wolfgang von Goethe', authorSlug: 'johann-wolfgang-von-goethe',
    year: 1774, genres: ['literary-fiction'], lang: 'de',
    bans: [
      { country: 'AT', scopeId: govId, status: 'historical', yearStarted: 1775, reasonSlugs: ['moral'], sourceId: wikpSource },
      { country: 'IT', scopeId: govId, status: 'historical', yearStarted: 1775, reasonSlugs: ['moral'], sourceId: wikpSource },
    ],
  })

  // ── North America ─────────────────────────────────────────────────────────

  await addBook({
    title: 'Peyton Place', slug: 'peyton-place',
    authorDisplay: 'Grace Metalious', authorSlug: 'grace-metalious',
    year: 1956, genres: ['literary-fiction'],
    bans: [
      { country: 'CA', scopeId: govId, status: 'historical', yearStarted: 1956, reasonSlugs: ['sexual', 'moral'], sourceId: wikpSource },
      { country: 'AU', scopeId: govId, status: 'historical', yearStarted: 1957, reasonSlugs: ['sexual', 'moral'], sourceId: wikpSource },
    ],
  })

  await addBook({
    title: 'Fallen Angels', slug: 'fallen-angels',
    authorDisplay: 'Walter Dean Myers', authorSlug: 'walter-dean-myers',
    year: 1988, genres: ['young-adult', 'historical-fiction'],
    bans: [{ country: 'US', scopeId: schoolId, status: 'historical', yearStarted: 1990, reasonSlugs: ['violence', 'language'], sourceId: alaSource }],
  })

  await addBook({
    title: 'Melissa', slug: 'melissa-alex-gino',
    authorDisplay: 'Alex Gino', authorSlug: 'alex-gino',
    year: 2015, genres: ['young-adult'],
    bans: [{ country: 'US', scopeId: schoolId, status: 'active', yearStarted: 2015, reasonSlugs: ['lgbtq'], sourceId: penSource }],
  })

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
