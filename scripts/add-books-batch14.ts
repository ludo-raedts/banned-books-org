import { adminClient } from '../src/lib/supabase'

/**
 * Batch 14 — Singapore, Malaysia, Taiwan, Turkey, Nigeria, Zimbabwe, Belarus
 *             and extra bans for existing books
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

  await ensureCountry('TW', 'Taiwan', 'taiwan')

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
  // SINGAPORE
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Shadrake's exposé of Singapore's use of the death penalty. He was arrested in
    // Singapore on the day of a book launch event, charged with criminal contempt of
    // court, convicted, and sentenced to 6 weeks in prison — a rare case of a book
    // leading directly to the author's imprisonment in a developed country.
    title: 'Once a Jolly Hangman',
    slug: 'once-a-jolly-hangman',
    authorDisplay: 'Alan Shadrake',
    authorSlug: 'alan-shadrake',
    year: 2010, genres: ['non-fiction', 'biography'], lang: 'en',
    bans: [
      { country: 'SG', scopeId: govId, status: 'active', yearStarted: 2010, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // MALAYSIA
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Mahathir Mohamad's treatise on Malay ethnic identity and the reasons for Malay
    // economic underperformance relative to Chinese Malaysians. Considered "incendiary"
    // and banned by his political rivals in the ruling UMNO under Tunku Abdul Rahman.
    // Unbanned in 1981 when Mahathir himself became Prime Minister. One of the most
    // controversial political books in Malaysian history.
    title: 'The Malay Dilemma',
    slug: 'the-malay-dilemma',
    authorDisplay: 'Mahathir Mohamad',
    authorSlug: 'mahathir-mohamad',
    year: 1970, genres: ['non-fiction', 'politics'], lang: 'en',
    bans: [
      { country: 'MY', scopeId: govId, status: 'historical', yearStarted: 1970, reasonSlugs: ['political', 'racial'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // TAIWAN — KMT martial law era (1949–1987)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // George Kerr was a US diplomat in Taiwan who witnessed the February 28 Massacre
    // (1947), when the Nationalist government killed an estimated 10,000–30,000 Taiwanese.
    // His account exposed Chiang Kai-shek's KMT government and was banned in Taiwan
    // throughout the martial law period (1949–1987).
    title: 'Formosa Betrayed',
    slug: 'formosa-betrayed',
    authorDisplay: 'George Kerr',
    authorSlug: 'george-kerr',
    year: 1965, genres: ['non-fiction', 'history'], lang: 'en',
    bans: [
      { country: 'TW', scopeId: govId, status: 'historical', yearStarted: 1965, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Chen Yingzhen was Taiwan's foremost socialist author. He was imprisoned 1968–1977
    // for organizing a reading group to study Marxism. Most of his fiction was banned.
    // This collection, considered his masterwork, includes stories about urban poverty
    // and Taiwan's colonial history.
    title: 'The Last Day of Summer',
    slug: 'the-last-day-of-summer',
    authorDisplay: 'Chen Yingzhen',
    authorSlug: 'chen-yingzhen',
    year: 1967, genres: ['short-stories', 'literary-fiction'], lang: 'zh',
    bans: [
      { country: 'TW', scopeId: govId, status: 'historical', yearStarted: 1968, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // TURKEY — Nâzım Hikmet
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Turkey's greatest poet was a communist who spent 17 years in prison and was
    // stripped of his citizenship in 1951. His poetry was formally banned in Turkey
    // and only rehabilitated posthumously. He wrote this collection while imprisoned.
    // Considered one of the most important poets of the 20th century worldwide.
    title: 'Human Landscapes from My Country',
    slug: 'human-landscapes-from-my-country',
    authorDisplay: 'Nâzım Hikmet',
    authorSlug: 'nazim-hikmet',
    year: 1966, genres: ['poetry'], lang: 'tr',
    bans: [
      { country: 'TR', scopeId: govId, status: 'historical', yearStarted: 1938, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Hikmet wrote this epic poem about the Soviet-Turkish war while imprisoned.
    // Along with all his works, it was banned in Turkey during and after his imprisonment.
    title: 'The Epic of Sheikh Bedreddin',
    slug: 'the-epic-of-sheikh-bedreddin',
    authorDisplay: 'Nâzım Hikmet',
    authorSlug: 'nazim-hikmet',
    year: 1936, genres: ['poetry'], lang: 'tr',
    bans: [
      { country: 'TR', scopeId: govId, status: 'historical', yearStarted: 1938, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  await addBook({
    // Kurdish author and Nobel Prize finalist. His novel about the Kurdish-Turkish
    // conflict was prosecuted under Turkey's anti-terrorism laws; Yaşar Kemal was
    // charged multiple times. The novel depicts the destruction of Kurdish villages.
    title: 'Memed, My Hawk',
    slug: 'memed-my-hawk',
    authorDisplay: 'Yaşar Kemal',
    authorSlug: 'yasar-kemal',
    year: 1955, genres: ['literary-fiction'], lang: 'tr',
    bans: [
      { country: 'TR', scopeId: govId, status: 'historical', yearStarted: 1950, reasonSlugs: ['political'], sourceId: wikpSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // NIGERIA — Abacha era (1993–1998)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Soyinka fled Nigeria during the Abacha dictatorship; in 1994 he was charged with
    // treason and sentenced to death in absentia. His autobiographical account of
    // imprisonment during the Biafra War was banned in Nigeria.
    title: 'The Man Died',
    slug: 'the-man-died',
    authorDisplay: 'Wole Soyinka',
    authorSlug: 'wole-soyinka',
    year: 1972, genres: ['memoir', 'non-fiction'], lang: 'en',
    bans: [
      { country: 'NG', scopeId: govId, status: 'historical', yearStarted: 1972, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  await addBook({
    // Ken Saro-Wiwa's experimental war novel, written in "rotten English" — a creole
    // that was itself a political act. Saro-Wiwa was hanged by the Abacha regime in 1995
    // alongside eight other Ogoni activists. His works were suppressed in Nigeria.
    title: 'Sozaboy',
    slug: 'sozaboy',
    authorDisplay: 'Ken Saro-Wiwa',
    authorSlug: 'ken-saro-wiwa',
    year: 1985, genres: ['literary-fiction', 'war'], lang: 'en',
    bans: [
      { country: 'NG', scopeId: govId, status: 'historical', yearStarted: 1993, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // ZIMBABWE — Mugabe era
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Zimbabwean journalist-turned-novelist's prison memoir about his five-week detention
    // without charge under Mugabe's security forces. The book was banned in Zimbabwe;
    // Hove died in exile in Norway. The novel is considered a key document of Zimbabwean
    // state repression.
    title: 'Bones',
    slug: 'bones-hove',
    authorDisplay: 'Chenjerai Hove',
    authorSlug: 'chenjerai-hove',
    year: 1988, genres: ['literary-fiction', 'memoir'], lang: 'en',
    bans: [
      { country: 'ZW', scopeId: govId, status: 'historical', yearStarted: 1988, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // BELARUS — Lukashenko era
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Belarusian journalist and Nobel Prize winner. Her documentary prose about the
    // Soviet-Afghan War (based on hundreds of interviews) was rejected by Soviet publishers;
    // the KGB confiscated her notes. After publication in the West, it caused a scandal.
    // Her works are effectively banned/suppressed in Lukashenko's Belarus.
    title: 'Zinky Boys',
    slug: 'zinky-boys',
    authorDisplay: 'Svetlana Alexievich',
    authorSlug: 'svetlana-alexievich',
    year: 1989, genres: ['non-fiction', 'war'], lang: 'ru',
    bans: [
      { country: 'BY', scopeId: govId, status: 'active', yearStarted: 2022, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  await addBook({
    // Alexievich's Chernobyl oral history; interviews with survivors, emergency workers,
    // and widows. Her entire body of work was banned in Belarus under Lukashenko;
    // she went into exile in 2020 after the disputed presidential election.
    title: 'Voices from Chernobyl',
    slug: 'voices-from-chernobyl',
    authorDisplay: 'Svetlana Alexievich',
    authorSlug: 'svetlana-alexievich',
    year: 1997, genres: ['non-fiction', 'history'], lang: 'ru',
    bans: [
      { country: 'BY', scopeId: govId, status: 'active', yearStarted: 2022, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // MORE RUSSIA (modern)
  // ════════════════════════════════════════════════════════════════════

  await addBook({
    // Navalny's investigation into corruption at the core of Vladimir Putin's regime.
    // The book and its associated investigative film "He Is Not Dimon to You" (2017)
    // triggered massive protests. Navalny was imprisoned and died in a Russian penal
    // colony in February 2024. All his works are banned in Russia.
    title: 'Patriot',
    slug: 'patriot-navalny',
    authorDisplay: 'Alexei Navalny',
    authorSlug: 'alexei-navalny',
    year: 2023, genres: ['memoir', 'non-fiction'], lang: 'en',
    bans: [
      { country: 'RU', scopeId: govId, status: 'active', yearStarted: 2023, reasonSlugs: ['political'], sourceId: penSource },
    ],
  })

  // ════════════════════════════════════════════════════════════════════
  // EXTRA BANS for existing books
  // ════════════════════════════════════════════════════════════════════

  async function addBanIfMissing(bookSlug: string, countryCode: string, year: number, status: string, reasonSlug: string) {
    const { data: b } = await supabase.from('books').select('id').eq('slug', bookSlug).single()
    if (!b) return
    const { data: existing } = await supabase.from('bans').select('country_code').eq('book_id', b.id)
    if ((existing ?? []).some(e => e.country_code === countryCode)) return
    const { data: ban } = await supabase.from('bans').insert({
      book_id: b.id, country_code: countryCode, scope_id: govId,
      action_type: 'banned', status, year_started: year,
    }).select('id').single()
    if (ban) {
      await supabase.from('ban_reason_links').insert({ ban_id: ban.id, reason_id: reasonId(reasonSlug) })
      console.log(`  Added ${bookSlug} / ${countryCode} ban`)
    }
  }

  // Ulysses — Ireland ban (actually Ireland's censors never formally banned it; skip)
  // Add UK ban for Ulysses (Royal Mail refused; GPO banned mailing copies in 1922)
  await addBanIfMissing('ulysses', 'GB', 1923, 'historical', 'sexual')

  // 1984 additional bans
  await addBanIfMissing('1984', 'SU', 1949, 'historical', 'political')

  // The Satanic Verses — Malaysia ban
  await addBanIfMissing('the-satanic-verses', 'MY', 1989, 'active', 'religious')

  // Harry Potter series bans (if in DB) — Saudi Arabia and UAE banned them
  await addBanIfMissing('harry-potter-and-the-sorcerers-stone', 'SA', 2002, 'active', 'religious')
  await addBanIfMissing('harry-potter-and-the-philosophers-stone', 'SA', 2002, 'active', 'religious')

  // Lady Chatterley's Lover — Australia ban
  await addBanIfMissing('lady-chatterleys-lover', 'AU', 1930, 'historical', 'sexual')

  // The Anarchist Cookbook — Australia ban (RC classification)
  await addBanIfMissing('the-anarchist-cookbook', 'AU', 1995, 'active', 'violence')

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${count}`)
}

main().catch(console.error)
