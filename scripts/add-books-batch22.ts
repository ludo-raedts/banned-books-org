import { adminClient } from '../src/lib/supabase'

/**
 * Batch 22 — Hong Kong National Security Law (NSL) library removals 2020.
 * The HKPL removed dozens of books for review after NSL enactment (June 2020),
 * primarily political titles on HK independence, democracy, and Tiananmen.
 * Adds HK as a new country, then the confirmed-removed titles.
 *
 * Sources:
 *   - AFP/Guardian reporting on HKPL removals, July–Aug 2020
 *   - Hong Kong Free Press coverage
 *   - PEN International / Index on Censorship
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

async function ensureCountry(code: string, name: string, slug: string, description?: string) {
  const { data } = await supabase.from('countries').select('code').eq('code', code).single()
  if (!data) {
    await supabase.from('countries').insert({ code, name_en: name, slug, description: description ?? null })
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

  const libId = scopeId('public_library')

  // Add Hong Kong as a country
  await ensureCountry(
    'HK', 'Hong Kong', 'hong-kong',
    'Hong Kong\'s public libraries removed dozens of books for review after the National Security Law (NSL) was enacted in June 2020. The Hong Kong Public Libraries (HKPL) system withdrew political titles from shelves pending legal assessment, primarily targeting books on Hong Kong independence, pro-democracy activism, and the 2019 protest movement. Many titles — including works on Tiananmen and Hong Kong autonomy — were permanently removed.'
  )

  const hkfpSource = await upsertSource(
    'Hong Kong Free Press — Libraries remove books',
    'https://hongkongfp.com/2020/07/06/hong-kong-public-libraries-remove-books-by-pro-democracy-advocates-amid-nsl-fears/'
  )
  const guardianHKSource = await upsertSource(
    'The Guardian — Hong Kong libraries pull pro-democracy books',
    'https://www.theguardian.com/world/2020/jul/07/hong-kong-libraries-pull-pro-democracy-books-for-review-under-security-law'
  )

  const NSL_BAN_DESC = 'Removed from Hong Kong Public Libraries for review after the enactment of the National Security Law (June 2020). Withdrawal was deemed necessary to assess potential breach of the new law.'

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
    coverUrl?: string; description?: string
    bans: {
      country: string; scopeId: number; status: string; yearStarted: number
      reasonSlugs: string[]; sourceId: number | null; actor?: string
      description?: string
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
      ...(opts.description ? { description: opts.description } : {}),
    }).select('id').single()
    if (be) { console.error(`  [error] ${opts.title}: ${be.message}`); return }

    existingSlugs.add(opts.slug)
    if (authorId) await supabase.from('book_authors').insert({ book_id: book.id, author_id: authorId })

    for (const ban of opts.bans) {
      const { data: newBan, error: bane } = await supabase.from('bans').insert({
        book_id: book.id, country_code: ban.country, scope_id: ban.scopeId,
        action_type: 'banned', status: ban.status, year_started: ban.yearStarted,
        ...(ban.actor ? { actor: ban.actor } : {}),
        ...(ban.description ? { description: ban.description } : {}),
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
  // HONG KONG — NSL library removals, 2020
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Secret memoirs of former CCP General Secretary Zhao Ziyang, recorded
    // onto hidden cassette tapes while under house arrest after opposing the
    // Tiananmen crackdown. Smuggled out of China and published after his death.
    title: 'Prisoner of the State',
    slug: 'prisoner-of-the-state',
    authorDisplay: 'Zhao Ziyang',
    authorSlug: 'zhao-ziyang',
    year: 2009, genres: ['non-fiction', 'memoir'], lang: 'en', isbn13: '9781439149386',
    description: 'The secret journal of Zhao Ziyang, the Chinese Communist Party\'s General Secretary who was ousted for opposing the Tiananmen Square crackdown in 1989. Placed under house arrest for the final 15 years of his life, he secretly recorded his memoirs onto cassette tapes that were smuggled out of China after his death in 2005. The book provides an insider account of the internal CCP debates that led to the military crackdown.',
    bans: [{
      country: 'HK', scopeId: libId, status: 'active', yearStarted: 2020,
      reasonSlugs: ['political'], sourceId: hkfpSource,
      actor: 'Hong Kong Public Libraries',
      description: NSL_BAN_DESC,
    }],
  })

  await addBook({
    // Louisa Lim's ground-breaking account of how China suppressed memory of
    // Tiananmen, published on the 25th anniversary. Lim, a former BBC correspondent,
    // documented how young Chinese students were unable to recognise the Tank Man photograph.
    title: "People's Republic of Amnesia",
    slug: 'peoples-republic-of-amnesia',
    authorDisplay: 'Louisa Lim',
    authorSlug: 'louisa-lim',
    year: 2014, genres: ['non-fiction'], lang: 'en', isbn13: '9780190227913',
    description: 'A reassessment of the Tiananmen Square massacre on its 25th anniversary, exploring how China has systematically suppressed all memory of the events of June 4, 1989. Former BBC Beijing correspondent Louisa Lim documents how an entire generation of young Chinese citizens — including students at the very university where protests began — have been rendered ignorant of the crackdown.',
    bans: [{
      country: 'HK', scopeId: libId, status: 'active', yearStarted: 2020,
      reasonSlugs: ['political'], sourceId: hkfpSource,
      actor: 'Hong Kong Public Libraries',
      description: NSL_BAN_DESC,
    }],
  })

  await addBook({
    // Wan Chin's 2011 manifesto arguing that Hong Kong should be understood
    // as a city-state with its own distinct identity separate from mainland China.
    // The book became foundational to the HK localist movement and was controversial
    // even before the NSL; the HKPL removed it in 2020.
    title: 'On the Hong Kong City-State',
    slug: 'on-the-hong-kong-city-state',
    authorDisplay: 'Wan Chin',
    authorSlug: 'wan-chin',
    year: 2011, genres: ['non-fiction', 'politics'], lang: 'zh',
    description: 'A political manifesto by Hong Kong scholar and controversialist Wan Chin (陳雲), arguing that Hong Kong should be reconceived as an autonomous city-state rooted in Cantonese culture and resistant to absorption by mainland China. The book became foundational to the Hong Kong localist movement. Its argument for a distinct Hong Kong identity separate from the PRC made it a target of the National Security Law review.',
    bans: [{
      country: 'HK', scopeId: libId, status: 'active', yearStarted: 2020,
      reasonSlugs: ['political'], sourceId: hkfpSource,
      actor: 'Hong Kong Public Libraries',
      description: NSL_BAN_DESC,
    }],
  })

  await addBook({
    // Academic edited volume examining pro-independence arguments in HK.
    // Published by the University of Hong Kong Students\' Union magazine Undergrad,
    // which advocated for HK self-determination. The publication gained notoriety
    // when Beijing's Liaison Office condemned it in 2015.
    title: 'Hong Kong Nationalism',
    slug: 'hong-kong-nationalism',
    authorDisplay: 'Brian Hioe (ed.)',
    authorSlug: 'brian-hioe',
    year: 2015, genres: ['non-fiction', 'politics'], lang: 'zh',
    description: 'An edited collection published by the University of Hong Kong Students\' Union magazine Undergrad exploring arguments for Hong Kong self-determination and nationalism. The publication drew intense criticism from Beijing\'s Liaison Office in Hong Kong, which condemned it in 2015 as advocating independence from China. The HKPL removed it in 2020 under the National Security Law review.',
    bans: [{
      country: 'HK', scopeId: libId, status: 'active', yearStarted: 2020,
      reasonSlugs: ['political'], sourceId: guardianHKSource,
      actor: 'Hong Kong Public Libraries',
      description: NSL_BAN_DESC,
    }],
  })

  await addBook({
    // Benny Tai was the legal scholar and democracy activist who co-founded
    // the Occupy Central movement and later organised the 2020 informal primary
    // election. He was convicted under the NSL in 2024.
    // This book, collecting essays on HK constitutional law, was removed from HKPL.
    title: 'The Future of the Rule of Law in Hong Kong',
    slug: 'the-future-of-the-rule-of-law-in-hong-kong',
    authorDisplay: 'Benny Tai',
    authorSlug: 'benny-tai',
    year: 2015, genres: ['non-fiction', 'law'], lang: 'en',
    description: 'A collection of essays on the future of Hong Kong\'s constitutional system and rule of law, edited by legal scholar and democracy activist Benny Tai. Tai co-founded the Occupy Central with Love and Peace movement in 2014 and was later convicted under the National Security Law in 2024. The book was removed from Hong Kong Public Libraries during the post-NSL review.',
    bans: [{
      country: 'HK', scopeId: libId, status: 'active', yearStarted: 2020,
      reasonSlugs: ['political'], sourceId: hkfpSource,
      actor: 'Hong Kong Public Libraries',
      description: NSL_BAN_DESC,
    }],
  })

  // ════════════════════════════════════════════════════════════════════
  // ALSO ADD CHINA bans for the Zhao Ziyang and Louisa Lim books
  // Both are long-banned on the mainland
  // ════════════════════════════════════════════════════════════════════

  async function addBanIfMissing(
    bookSlug: string, cc: string, year: number, status: string,
    scopeId: number, reasonSlugs: string[], sourceId: number | null,
    actor?: string, description?: string
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
      ...(description ? { description } : {}),
    }).select('id').single()
    if (ban) {
      for (const rs of reasonSlugs) {
        await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId(rs) })
      }
      if (sourceId) await supabase.from('ban_source_links').insert({ ban_id: ban.id, source_id: sourceId })
      console.log(`  Added ${bookSlug} / ${cc} ban`)
    }
  }

  const govId = scopeId('government')

  await addBanIfMissing(
    'prisoner-of-the-state', 'CN', 2009, 'active', govId, ['political'], null,
    'Chinese Communist Party',
    'Banned in mainland China since publication. Zhao Ziyang was a political non-person after his 1989 purge; his name and his account of the Tiananmen leadership debates cannot be discussed in Chinese media.'
  )

  await addBanIfMissing(
    'peoples-republic-of-amnesia', 'CN', 2014, 'active', govId, ['political'], null,
    'Chinese Communist Party',
    'Banned in mainland China. Any account of the Tiananmen massacre that contradicts the official narrative — which frames it as a necessary act to restore order — is suppressed.'
  )

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${count}`)
}

main().catch(console.error)
