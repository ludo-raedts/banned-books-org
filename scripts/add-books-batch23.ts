import { adminClient } from '../src/lib/supabase'

/**
 * Batch 23 — Remaining Hong Kong NSL library removals (from user's verified table):
 *   Joshua Wong x2, Tanya Chan, Margaret Ng, Ma Ngok, Szeto Wah, Wu Renhua, Roy Kwong.
 * Also fixes batch22 errors:
 *   - Hong Kong Nationalism: author corrected to HKU Undergrad / HKUSU
 *   - The Future of the Rule of Law → The Future of Constitutionalism in Hong Kong (title update)
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

  const libId = scopeId('public_library')

  const hkfpSource = await upsertSource(
    'Hong Kong Free Press — Libraries remove books',
    'https://hongkongfp.com/2020/07/06/hong-kong-public-libraries-remove-books-by-pro-democracy-advocates-amid-nsl-fears/'
  )

  const NSL_BAN_DESC = 'Removed from Hong Kong Public Libraries for review after the enactment of the National Security Law (June 2020). Withdrawal was deemed necessary to assess potential breach of the new law.'

  // ── Fix batch22 errors ──────────────────────────────────────────────

  // Fix 1: Hong Kong Nationalism — update author slug/name
  {
    const { data: book } = await supabase.from('books').select('id').eq('slug', 'hong-kong-nationalism').single()
    if (book) {
      // Remove old author link and add correct one
      const { data: ba } = await supabase.from('book_authors').select('author_id').eq('book_id', book.id)
      if (ba && ba.length > 0) {
        await supabase.from('book_authors').delete().eq('book_id', book.id)
      }
      // Upsert correct author
      const correctSlug = 'hku-undergrad-hkusu'
      const { data: existingAuthor } = await supabase.from('authors').select('id').eq('slug', correctSlug).single()
      let authorId: number
      if (existingAuthor) {
        authorId = existingAuthor.id
      } else {
        const { data: newA } = await supabase.from('authors').insert({
          slug: correctSlug, display_name: 'HKU Undergrad / HKUSU',
        }).select('id').single()
        authorId = newA!.id
      }
      await supabase.from('book_authors').insert({ book_id: book.id, author_id: authorId })
      console.log('Fixed Hong Kong Nationalism author → HKU Undergrad / HKUSU')
    }
  }

  // Fix 2: The Future of Rule of Law → The Future of Constitutionalism in Hong Kong
  {
    const { data: book } = await supabase.from('books').select('id, title').eq('slug', 'the-future-of-the-rule-of-law-in-hong-kong').single()
    if (book && book.title !== 'The Future of Constitutionalism in Hong Kong') {
      await supabase.from('books').update({ title: 'The Future of Constitutionalism in Hong Kong' }).eq('id', book.id)
      console.log('Fixed title: The Future of the Rule of Law → The Future of Constitutionalism in Hong Kong')
    }
  }

  // ── Helper functions ────────────────────────────────────────────────

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
      original_language: opts.lang ?? 'zh',
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
  // HONG KONG — Remaining NSL library removals
  // All from HKFP's documented list of titles removed post-NSL (2020)
  // ════════════════════════════════════════════════════════════════════

  const hkBan = (description = NSL_BAN_DESC) => ({
    country: 'HK', scopeId: libId, status: 'active', yearStarted: 2020,
    reasonSlugs: ['political'], sourceId: hkfpSource,
    actor: 'Hong Kong Public Libraries',
    description,
  })

  await addBook({
    title: 'I Am Not a Kid',
    slug: 'i-am-not-a-kid-wong',
    authorDisplay: 'Joshua Wong',
    authorSlug: 'joshua-wong',
    year: 2017, genres: ['non-fiction', 'memoir'], lang: 'zh',
    description: 'A memoir and political manifesto by Joshua Wong Chi-fung, the Hong Kong student activist who rose to global prominence during the 2014 Umbrella Movement. Wong was secretary-general of the pro-democracy group Demosistō and was repeatedly arrested and imprisoned by Hong Kong authorities. He was sentenced to prison under the National Security Law in 2021.',
    bans: [hkBan()],
  })

  await addBook({
    title: 'I Am Not a Hero',
    slug: 'i-am-not-a-hero-wong',
    authorDisplay: 'Joshua Wong',
    authorSlug: 'joshua-wong',
    year: 2018, genres: ['non-fiction', 'memoir'], lang: 'zh',
    description: 'A follow-up memoir by Hong Kong democracy activist Joshua Wong, reflecting on his evolving role in the pro-democracy movement and the personal cost of political activism. Wong was sentenced to prison under Hong Kong\'s National Security Law in 2021, making his books politically sensitive and leading to their removal from public libraries.',
    bans: [hkBan()],
  })

  await addBook({
    title: 'My Journeys for Food and Justice',
    slug: 'my-journeys-for-food-and-justice',
    authorDisplay: 'Tanya Chan',
    authorSlug: 'tanya-chan',
    year: 2018, genres: ['non-fiction', 'memoir'], lang: 'zh',
    description: 'A memoir by Tanya Chan (陳淑莊), a Hong Kong politician and former member of the Legislative Council. Chan, a barrister and a founding member of the Civic Party, documented her political journey and advocacy work. She was charged with subversion under the National Security Law in 2021, leading to her books being reviewed and removed from public libraries.',
    bans: [hkBan()],
  })

  await addBook({
    title: 'Under the Keystone: 18 Years in Politics',
    slug: 'under-the-keystone',
    authorDisplay: 'Margaret Ng',
    authorSlug: 'margaret-ng',
    year: 2016, genres: ['non-fiction', 'memoir'], lang: 'zh',
    description: 'A memoir by Margaret Ng (吳靄儀), a Hong Kong barrister, journalist, and politician who served eighteen years as a Legislative Council member from 1995 to 2012. Ng was a prominent voice for the rule of law and judicial independence in Hong Kong. She was later charged under the National Security Law in 2021 for her role in the pro-democracy primary elections.',
    bans: [hkBan()],
  })

  await addBook({
    title: 'An Oral History of the Democratic Movement of Hong Kong in the 1980s',
    slug: 'oral-history-democratic-movement-hk',
    authorDisplay: 'Ma Ngok',
    authorSlug: 'ma-ngok',
    year: 2012, genres: ['non-fiction', 'history'], lang: 'zh',
    description: 'An academic oral history of Hong Kong\'s pro-democracy movement during the 1980s, compiled by Ma Ngok (馬岳), a political scientist at the Chinese University of Hong Kong. The book documents the founding of the democratic movement through interviews with key participants. Its historical documentation of the democratic movement made it a target of the post-NSL library review.',
    bans: [hkBan()],
  })

  await addBook({
    title: 'Big Rivers Going to the East',
    slug: 'big-rivers-going-to-the-east',
    authorDisplay: 'Szeto Wah',
    authorSlug: 'szeto-wah',
    year: 2011, genres: ['non-fiction', 'memoir'], lang: 'zh',
    description: 'The memoirs of Szeto Wah (司徒華), one of Hong Kong\'s most revered democracy activists. Szeto was a founder of the Hong Kong Alliance in Support of Patriotic Democratic Movements in China and organised annual Tiananmen vigils for over two decades. The title — a traditional Chinese phrase meaning going forth boldly — reflects his lifelong commitment to democracy. Published posthumously; he died in January 2011.',
    bans: [hkBan(
      'Szeto Wah was one of Hong Kong\'s most prominent pro-democracy figures, and his memoirs — along with the annual Tiananmen vigils he organised — were central to Hong Kong\'s collective memory of June 4. The book was removed from HKPL following the NSL enactment.'
    )],
  })

  await addBook({
    title: 'The Inside Information of the Bloody Crackdown on Tiananmen on June 4',
    slug: 'inside-information-tiananmen-crackdown',
    authorDisplay: 'Wu Renhua',
    authorSlug: 'wu-renhua',
    year: 2009, genres: ['non-fiction', 'history'], lang: 'zh',
    description: 'A detailed forensic account of the Tiananmen Square massacre by Wu Renhua (吳仁華), a student leader who survived June 4, 1989. Based on documents, photographs, and testimony, the book documents the military units involved, the weapons used, and the death toll — one of the most thorough records of events the Chinese government denies. Wu has been threatened and lives in exile.',
    bans: [hkBan(
      'One of the most detailed accounts of the Tiananmen Square crackdown, written by a survivor. Any documentation of June 4 that contradicts Beijing\'s narrative is politically sensitive in Hong Kong under the NSL.'
    )],
  })

  await addBook({
    title: 'There Is a Kind of Happiness Called Forgetting',
    slug: 'there-is-a-kind-of-happiness-called-forgetting',
    authorDisplay: 'Roy Kwong',
    authorSlug: 'roy-kwong',
    year: 2017, genres: ['non-fiction', 'memoir'], lang: 'zh',
    description: 'A collection of personal and political reflections by Roy Kwong (鄺俊宇), a Hong Kong poet and politician who served in the Legislative Council. The title — "There Is a Kind of Happiness Called Forgetting" — is itself a political statement about memory and suppression. Kwong was known for his lyrical approach to political writing and advocacy for LGBTQ+ rights.',
    bans: [hkBan()],
  })

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${count}`)
}

main().catch(console.error)
