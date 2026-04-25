import { adminClient } from '../src/lib/supabase'

/**
 * Batch 20 — Singapore NLB 2014 episode (White Swan Express, Who's in My Family?,
 *             And Tango Makes Three extra ban), Australia/NZ bans (Peaceful Pill Handbook,
 *             Into the River), + USA school bans from PEN America 2024-2025 list.
 *
 * Action type policy: always 'banned'. Lifted/temporary bans use status: 'historical'.
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

  const govId = scopeId('government')
  const libId = scopeId('public_library')
  const schId = scopeId('school')

  const guardianSource = await upsertSource(
    'The Guardian — Singapore libraries pull gay penguin book',
    'https://www.theguardian.com/world/2014/jul/12/singapore-libraries-pull-gay-penguin-book'
  )
  const auClassSource = await upsertSource(
    'Australian Classification Board — The Peaceful Pill Handbook',
    'https://www.classification.gov.au/titles/peaceful-pill-handbook'
  )
  const nzClassSource = await upsertSource(
    'NZ Classification Office — Into the River',
    'https://www.classificationoffice.govt.nz/news/significant-decisions/into-the-river/'
  )
  const penSource = await upsertSource('PEN America Banned Books', 'https://pen.org/banned-books/')

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
    year: number; genres: string[]; lang?: string; isbn13?: string
    coverUrl?: string
    bans: {
      country: string; scopeId: number; status: string; yearStarted: number
      reasonSlugs: string[]; sourceId: number | null; actor?: string
    }[]
  }) {
    if (existingSlugs.has(opts.slug)) { console.log(`  [skip] ${opts.title}`); return }
    process.stdout.write(`  ${opts.title}... `)

    let coverUrl = opts.coverUrl ?? null
    let workId: string | null = null
    if (!coverUrl) {
      const ol = await fetchOL(opts.title, opts.authorDisplay)
      await sleep(COVER_DELAY_MS)
      coverUrl = ol.coverUrl
      workId   = ol.workId
    }
    console.log(coverUrl ? 'ok' : 'no cover')

    const authorId = await getOrCreateAuthor(opts.authorDisplay, opts.authorSlug)

    const { data: book, error: be } = await supabase.from('books').insert({
      title: opts.title, slug: opts.slug,
      original_language: opts.lang ?? 'en',
      first_published_year: opts.year, ai_drafted: false, genres: opts.genres,
      cover_url: coverUrl, openlibrary_work_id: workId,
      ...(opts.isbn13 ? { isbn13: opts.isbn13 } : {}),
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
    scopeId: number, reasonSlugs: string[], sourceId: number | null, actor?: string
  ) {
    const { data: b } = await supabase.from('books').select('id').eq('slug', bookSlug).single()
    if (!b) { console.error(`  MISSING book ${bookSlug}`); return }
    const { data: existingBans } = await supabase.from('bans').select('country_code').eq('book_id', b.id)
    if ((existingBans ?? []).some(e => e.country_code === cc)) {
      console.log(`  [skip] ${bookSlug}/${cc} already exists`); return
    }
    const { data: ban } = await supabase.from('bans').insert({
      book_id: b.id, country_code: cc, scope_id: scopeId,
      action_type: 'banned', status, year_started: year,
      ...(actor ? { actor } : {}),
    }).select('id').single()
    if (ban) {
      for (const rs of reasonSlugs) {
        await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId(rs) })
      }
      if (sourceId) await supabase.from('ban_source_links').insert({ ban_id: ban.id, source_id: sourceId })
      console.log(`  Added ${bookSlug} / ${cc} ban`)
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // SINGAPORE — National Library Board 2014 episode
  // The NLB removed three picture books featuring same-sex parent families
  // from children's sections. Two were moved to adult sections (later pulped
  // after public criticism of the compromise). The episode sparked a major
  // debate about censorship and LGBTQ+ rights in Singapore.
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    title: 'The White Swan Express',
    slug: 'the-white-swan-express',
    authorDisplay: 'Jean Davies Okimoto',
    authorSlug: 'jean-davies-okimoto',
    year: 2002, genres: ['children'], lang: 'en', isbn13: '9780618164539',
    coverUrl: 'https://covers.openlibrary.org/b/id/393642-L.jpg',
    bans: [{
      country: 'SG', scopeId: libId, status: 'historical', yearStarted: 2014,
      reasonSlugs: ['lgbtq'], sourceId: guardianSource,
      actor: 'National Library Board',
    }],
  })

  await addBook({
    title: "Who's in My Family?",
    slug: 'whos-in-my-family',
    authorDisplay: 'Robie H. Harris',
    authorSlug: 'robie-h-harris',
    year: 2012, genres: ['children'], lang: 'en', isbn13: '9780763636318',
    coverUrl: 'https://covers.openlibrary.org/b/id/7235859-L.jpg',
    bans: [{
      country: 'SG', scopeId: libId, status: 'historical', yearStarted: 2014,
      reasonSlugs: ['lgbtq'], sourceId: guardianSource,
      actor: 'National Library Board',
    }],
  })

  // And Tango Makes Three was part of the same NLB episode
  await addBanIfMissing(
    'and-tango-makes-three', 'SG', 2014, 'historical',
    libId, ['lgbtq'], guardianSource, 'National Library Board'
  )

  // ════════════════════════════════════════════════════════════════════
  // AUSTRALIA / NEW ZEALAND
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Philip Nitschke's euthanasia guide was refused classification in Australia
    // in 2007, making it illegal to sell, hire, or display. New Zealand similarly
    // banned it. Nitschke, a physician and activist, has continued to update and
    // distribute the handbook through his organisation Exit International.
    title: 'The Peaceful Pill Handbook',
    slug: 'the-peaceful-pill-handbook',
    authorDisplay: 'Philip Nitschke',
    authorSlug: 'philip-nitschke',
    year: 2006, genres: ['non-fiction'], lang: 'en', isbn13: '9780978878825',
    coverUrl: 'https://covers.openlibrary.org/b/id/10232618-L.jpg',
    bans: [
      {
        country: 'AU', scopeId: govId, status: 'active', yearStarted: 2007,
        reasonSlugs: ['other'], sourceId: auClassSource,
        actor: 'Australian Classification Board',
      },
      {
        country: 'NZ', scopeId: govId, status: 'active', yearStarted: 2007,
        reasonSlugs: ['other'], sourceId: nzClassSource,
        actor: 'New Zealand Classification Office',
      },
    ],
  })

  await addBook({
    // Ted Dawe's young adult novel won New Zealand's top children's book prize
    // in 2013, then was temporarily banned in 2015 after a complaint about its
    // sexual content — making it the first book banned in New Zealand in over
    // a decade. The ban was lifted the same year after a review panel found it
    // had literary merit. The episode reignited debate about censorship of
    // young adult literature in New Zealand.
    title: 'Into the River',
    slug: 'into-the-river-dawe',
    authorDisplay: 'Ted Dawe',
    authorSlug: 'ted-dawe',
    year: 2012, genres: ['young-adult', 'literary-fiction'], lang: 'en', isbn13: '9780473205089',
    coverUrl: 'https://covers.openlibrary.org/b/id/13088995-L.jpg',
    bans: [{
      // Temporary ban lifted same year → status: historical
      country: 'NZ', scopeId: govId, status: 'historical', yearStarted: 2015,
      reasonSlugs: ['sexual'], sourceId: nzClassSource,
      actor: 'New Zealand Classification Office',
    }],
  })

  // ════════════════════════════════════════════════════════════════════
  // USA SCHOOL BANS — PEN America 2024-2025 most banned list
  // All use scope: school, status: active, country: US, year: 2024
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    title: 'Breathless',
    slug: 'breathless-niven',
    authorDisplay: 'Jennifer Niven',
    authorSlug: 'jennifer-niven',
    year: 2021, genres: ['young-adult', 'romance'], lang: 'en', isbn13: '9781524701970',
    bans: [{ country: 'US', scopeId: schId, status: 'active', yearStarted: 2024, reasonSlugs: ['sexual'], sourceId: penSource }],
  })

  await addBook({
    title: 'Sold',
    slug: 'sold-mccormick',
    authorDisplay: 'Patricia McCormick',
    authorSlug: 'patricia-mccormick',
    year: 2006, genres: ['young-adult'], lang: 'en', isbn13: '9780786851720',
    bans: [{ country: 'US', scopeId: schId, status: 'active', yearStarted: 2024, reasonSlugs: ['sexual', 'violence'], sourceId: penSource }],
  })

  await addBook({
    title: 'Crank',
    slug: 'crank-hopkins',
    authorDisplay: 'Ellen Hopkins',
    authorSlug: 'ellen-hopkins',
    year: 2004, genres: ['young-adult'], lang: 'en', isbn13: '9781416995135',
    bans: [{ country: 'US', scopeId: schId, status: 'active', yearStarted: 2024, reasonSlugs: ['drugs', 'sexual'], sourceId: penSource }],
  })

  await addBook({
    title: 'Damsel',
    slug: 'damsel-arnold',
    authorDisplay: 'Elana K. Arnold',
    authorSlug: 'elana-k-arnold',
    year: 2018, genres: ['young-adult', 'fantasy'], lang: 'en', isbn13: '9780062742344',
    bans: [{ country: 'US', scopeId: schId, status: 'active', yearStarted: 2024, reasonSlugs: ['sexual', 'violence'], sourceId: penSource }],
  })

  // Books already in DB — add 2024 US school ban if not already present
  // (existing bans are from earlier years; PEN lists them as newly banned in 2024)
  await addBanIfMissing('a-clockwork-orange', 'US', 2024, 'active', schId, ['violence', 'sexual'], penSource)
  await addBanIfMissing('last-night-at-the-telegraph-club', 'US', 2024, 'active', schId, ['lgbtq'], penSource)
  await addBanIfMissing('a-court-of-mist-and-fury', 'US', 2024, 'active', schId, ['sexual'], penSource)
  await addBanIfMissing('all-boys-arent-blue', 'US', 2024, 'active', schId, ['lgbtq', 'sexual'], penSource)
  await addBanIfMissing('a-court-of-thorns-and-roses', 'US', 2024, 'active', schId, ['sexual'], penSource)

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${count}`)
}

main().catch(console.error)
