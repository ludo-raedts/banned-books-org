/**
 * Batch 47 — Wikipedia list-page sweep across DE, CN, IN, IE, NZ.
 *
 * Sources (Wikipedia index pages indexed by https://en.wikipedia.org/wiki/Lists_of_banned_books):
 *   - List of authors banned in Nazi Germany
 *   - Book censorship in China § List of censored books
 *   - Book censorship in the Republic of Ireland § List of banned books
 *   - List of books banned in India
 *   - List of books banned in New Zealand
 *
 * Section A — New country-bans for books already in the DB.
 * Section B — New books with associated bans.
 *
 * Conservative ingestion: only entries that have a stable Wikipedia article (or
 * a well-cited paragraph) and that fill a clear gap in the DB. Many list-page
 * entries (period magazines, pulp serials) are deliberately omitted.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/add-books-batch47.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/add-books-batch47.ts --write
 */

import { adminClient } from '../src/lib/supabase'
import { notifyIndexNowFromScript } from './lib/notify-indexnow'

const WRITE = process.argv.includes('--write')
const supabase = adminClient()

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function fetchCover(title: string, author: string): Promise<{ coverUrl: string | null; workId: string | null }> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key,cover_i&limit=3`)
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number }> }
    const doc = json.docs?.find(d => d.cover_i)
    return {
      coverUrl: doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      workId: doc?.key?.replace('/works/', '') ?? null,
    }
  } catch { return { coverUrl: null, workId: null } }
}

async function upsertSource(url: string, name: string, type: string): Promise<number | null> {
  if (!WRITE) return null
  const { data, error } = await supabase
    .from('ban_sources')
    .upsert({ source_name: name, source_url: url, source_type: type }, { onConflict: 'source_url' })
    .select('id').single()
  if (error) { console.warn(`  [source warn] ${error.message}`); return null }
  return data?.id ?? null
}

async function linkBanToSource(banId: number, sourceId: number) {
  if (!WRITE) return
  const { data: existing } = await supabase.from('ban_source_links')
    .select('ban_id').eq('ban_id', banId).eq('source_id', sourceId).maybeSingle()
  if (existing) return
  const { error } = await supabase.from('ban_source_links').insert({ ban_id: banId, source_id: sourceId })
  if (error) console.warn(`  [link warn] ${error.message}`)
}

// ── Source URLs ──────────────────────────────────────────────────────────────
const SRC = {
  // Wikipedia list-page hubs
  wikiAuthorsNazi:    'https://en.wikipedia.org/wiki/List_of_authors_banned_in_Nazi_Germany',
  wikiChinaCensor:    'https://en.wikipedia.org/wiki/Book_censorship_in_China',
  wikiIrelandCensor:  'https://en.wikipedia.org/wiki/Book_censorship_in_the_Republic_of_Ireland',
  wikiIndiaList:      'https://en.wikipedia.org/wiki/List_of_books_banned_in_India',
  wikiNZList:         'https://en.wikipedia.org/wiki/List_of_books_banned_in_New_Zealand',
  // Authoritative supplementary sources
  ushmmBookBurnings:  'https://www.ushmm.org/collections/bibliography/book-burnings',
  nzClassification:  'https://www.classificationoffice.govt.nz/',
  irishCensorAct:    'https://en.wikipedia.org/wiki/Censorship_of_Publications_Act_1929',
  pen:               'https://pen-international.org/',
  hrwChina:          'https://www.hrw.org/asia/china-and-tibet',
}

const SRC_META: Record<string, [string, string]> = {
  [SRC.wikiAuthorsNazi]:   ['Wikipedia — List of authors banned in Nazi Germany', 'web'],
  [SRC.wikiChinaCensor]:   ['Wikipedia — Book censorship in China', 'web'],
  [SRC.wikiIrelandCensor]: ['Wikipedia — Book censorship in the Republic of Ireland', 'web'],
  [SRC.wikiIndiaList]:     ['Wikipedia — List of books banned in India', 'web'],
  [SRC.wikiNZList]:        ['Wikipedia — List of books banned in New Zealand', 'web'],
  [SRC.ushmmBookBurnings]: ['United States Holocaust Memorial Museum — Book Burnings', 'museum'],
  [SRC.nzClassification]:  ['New Zealand Office of Film and Literature Classification', 'government'],
  [SRC.irishCensorAct]:    ['Irish Censorship of Publications Act 1929', 'web'],
  [SRC.pen]:               ['PEN International', 'ngo'],
  [SRC.hrwChina]:          ['Human Rights Watch — China and Tibet', 'human_rights_report'],
}

async function getSourceId(url: string, cache: Map<string, number | null>): Promise<number | null> {
  if (cache.has(url)) return cache.get(url)!
  const [name, type] = SRC_META[url] ?? ['Unknown', 'web']
  const id = await upsertSource(url, name, type)
  cache.set(url, id)
  return id
}

async function fetchAll<T>(builder: () => any, pageSize = 1000): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await builder().range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data as T[])
    if (data.length < pageSize) break
  }
  return out
}

async function main() {
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const existingBooks = await fetchAll<{ id: number; slug: string }>(
    () => supabase.from('books').select('id, slug').order('id'),
  )
  const existingAuthors = await fetchAll<{ id: number; slug: string }>(
    () => supabase.from('authors').select('id, slug').order('id'),
  )
  console.log(`Loaded ${existingBooks.length} books, ${existingAuthors.length} authors`)

  const scopeId = (slug: string) => {
    const s = scopes!.find(s => s.slug === slug)
    if (!s) throw new Error(`Scope not found: ${slug}`)
    return s.id as number
  }
  const reasonId = (slug: string) => {
    const r = reasons!.find(r => r.slug === slug)
    if (!r) throw new Error(`Reason not found: ${slug}`)
    return r.id as number
  }
  const SCOPE_GOV = scopeId('government')

  const bookMap = new Map(existingBooks.map(b => [b.slug, b.id as number]))
  const authorMap = new Map(existingAuthors.map(a => [a.slug, a.id as number]))
  const srcCache = new Map<string, number | null>()

  let added = 0
  let skippedDup = 0
  let skippedMissing = 0
  const addedBookSlugs: string[] = []
  const addedAuthorSlugs: string[] = []

  // ═════════════════════════════════════════════════════════════════════════
  // SECTION A — New country-bans for existing books
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n=== Section A: New country-bans for existing books ===')

  type ExistingBan = {
    bookSlug: string
    country: string
    year: number
    actionType: 'banned' | 'restricted' | 'removed'
    status: 'active' | 'historical'
    scopeId: number
    reasons: string[]
    description: string
    sources: string[]
  }

  const existingBans: ExistingBan[] = [
    // ── Ireland ──────────────────────────────────────────────────────────
    {
      bookSlug: 'the-catcher-in-the-rye', country: 'IE',
      year: 1951, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
      reasons: ['sexual', 'language', 'moral'],
      description: `Listed by the Irish Censorship of Publications Board on its register of "Prohibited Publications" shortly after publication. Salinger's coming-of-age novel, with its frank treatment of adolescent sexuality and profanity, was among the post-war American titles routinely barred under the 1929 Censorship of Publications Act. Most prohibitions of mid-century literary fiction in Ireland were quietly allowed to lapse decades later.`,
      sources: [SRC.wikiIrelandCensor, SRC.irishCensorAct],
    },
    {
      bookSlug: 'droll-stories', country: 'IE',
      year: 1953, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
      reasons: ['sexual', 'moral'],
      description: `Balzac's bawdy 1832–37 collection of medieval-style tales — long a target of obscenity prosecutions across the Anglosphere — was added to the Irish Register of Prohibited Publications in 1953 under the 1929 Censorship of Publications Act for "obscene material of a sexual nature."`,
      sources: [SRC.wikiIrelandCensor, SRC.irishCensorAct],
    },

    // ── New Zealand ──────────────────────────────────────────────────────
    {
      bookSlug: 'tropic-of-cancer', country: 'NZ',
      year: 1962, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
      reasons: ['sexual', 'obscenity'],
      description: `Henry Miller's 1934 autobiographical novel was prohibited from import into New Zealand by the Indecent Publications Tribunal as indecent within the meaning of the Indecent Publications Act 1963. The decision was part of a wider Tribunal sweep that also caught Miller's Tropic of Capricorn, Black Spring and the Rosy Crucifixion sequence; New Zealand's restrictions on Miller persisted longer than in most other English-speaking jurisdictions.`,
      sources: [SRC.wikiNZList, SRC.nzClassification],
    },
    {
      bookSlug: 'naked-lunch', country: 'NZ',
      year: 1967, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
      reasons: ['sexual', 'obscenity', 'drugs'],
      description: `Burroughs's 1959 cut-up novel was classified indecent by the New Zealand Indecent Publications Tribunal. The Tribunal cited the book's depictions of drug use and sexual violence; its ban was reviewed and progressively relaxed in subsequent decades.`,
      sources: [SRC.wikiNZList, SRC.nzClassification],
    },
    {
      bookSlug: 'last-exit-to-brooklyn', country: 'NZ',
      year: 1967, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
      reasons: ['sexual', 'violence', 'obscenity'],
      description: `Hubert Selby Jr.'s 1964 novel — the subject of a celebrated UK obscenity trial — was prohibited in New Zealand by the Indecent Publications Tribunal in 1967 for its depictions of rape, drug abuse and prostitution in post-war Brooklyn.`,
      sources: [SRC.wikiNZList, SRC.nzClassification],
    },
    {
      bookSlug: 'fanny-hill', country: 'NZ',
      year: 1965, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
      reasons: ['sexual', 'obscenity'],
      description: `John Cleland's 1748–49 erotic novel — formally titled Memoirs of a Woman of Pleasure — was classified indecent by the New Zealand Indecent Publications Tribunal in 1965 under the Indecent Publications Act 1963.`,
      sources: [SRC.wikiNZList, SRC.nzClassification],
    },
    {
      bookSlug: 'the-story-of-o', country: 'NZ',
      year: 1967, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
      reasons: ['sexual', 'obscenity'],
      description: `Pauline Réage's 1954 erotic novel was classified indecent by the New Zealand Indecent Publications Tribunal in 1967, in line with similar bans across the Commonwealth.`,
      sources: [SRC.wikiNZList, SRC.nzClassification],
    },
    {
      bookSlug: 'justine-de-sade', country: 'NZ',
      year: 1965, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
      reasons: ['sexual', 'violence', 'obscenity'],
      description: `The Marquis de Sade's 1791 novel was classified indecent by the New Zealand Indecent Publications Tribunal under the Indecent Publications Act 1963; the Tribunal would later prohibit further Sade titles including The 120 Days of Sodom and Juliette.`,
      sources: [SRC.wikiNZList, SRC.nzClassification],
    },
    {
      bookSlug: 'droll-stories', country: 'NZ',
      year: 1929, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
      reasons: ['sexual', 'obscenity'],
      description: `Balzac's bawdy tales were among the imports prohibited by New Zealand Customs as indecent under the pre-Tribunal regime that applied the strict Hicklin Rule. The collection was a long-standing target of Anglophone obscenity policing throughout the early twentieth century.`,
      sources: [SRC.wikiNZList],
    },
  ]

  for (const item of existingBans) {
    const bookId = bookMap.get(item.bookSlug)
    if (!bookId) {
      console.log(`  [skip] book not found: ${item.bookSlug}`)
      skippedMissing++
      continue
    }
    const { data: dup } = await supabase.from('bans')
      .select('id').eq('book_id', bookId).eq('country_code', item.country).maybeSingle()
    if (dup) {
      console.log(`  [exists] ${item.country} ban for ${item.bookSlug} — skipping`)
      skippedDup++
      continue
    }

    console.log(`  [${item.bookSlug}] ${item.country} ${item.year} ${item.actionType}`)
    if (!WRITE) { added++; continue }

    const { data: banRow, error: banErr } = await supabase.from('bans').insert({
      book_id: bookId,
      country_code: item.country,
      scope_id: item.scopeId,
      action_type: item.actionType,
      status: item.status,
      year_started: item.year,
      description: item.description,
    }).select('id').single()

    if (banErr || !banRow) { console.error(`  ✗ ban: ${banErr?.message}`); continue }

    for (const rSlug of item.reasons) {
      const { error } = await supabase.from('ban_reason_links')
        .insert({ ban_id: banRow.id, reason_id: reasonId(rSlug) })
      if (error) console.warn(`  [reason warn] ${rSlug}: ${error.message}`)
    }
    for (const url of item.sources) {
      const sid = await getSourceId(url, srcCache)
      if (sid) await linkBanToSource(banRow.id, sid)
    }
    console.log(`  ✓ ban id=${banRow.id}`)
    added++
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SECTION B — New books with bans
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n=== Section B: New books with bans ===')

  type AuthorRow = {
    slug: string
    display_name: string
    birth_year: number | null
    death_year: number | null
  }

  const newAuthors: AuthorRow[] = [
    // China
    { slug: 'wang-lixiong',     display_name: 'Wang Lixiong',     birth_year: 1953, death_year: null },
    { slug: 'gao-hua',          display_name: 'Gao Hua',          birth_year: 1954, death_year: 2011 },
    { slug: 'zhang-liang',      display_name: 'Zhang Liang',      birth_year: null, death_year: null },
    { slug: 'mian-mian',        display_name: 'Mian Mian',        birth_year: 1970, death_year: null },
    { slug: 'zhang-yihe',       display_name: 'Zhang Yihe',       birth_year: 1942, death_year: null },
    { slug: 'tan-hecheng',      display_name: 'Tan Hecheng',      birth_year: 1939, death_year: null },
    { slug: 'qin-hui',          display_name: 'Qin Hui',          birth_year: 1953, death_year: null },
    // India
    { slug: 'arthur-koestler',  display_name: 'Arthur Koestler',  birth_year: 1905, death_year: 1983 },
    { slug: 'perumal-murugan',  display_name: 'Perumal Murugan',  birth_year: 1966, death_year: null },
    { slug: 'dwijendra-narayan-jha', display_name: 'D. N. Jha',   birth_year: 1940, death_year: 2021 },
    { slug: 'dominique-lapierre',    display_name: 'Dominique Lapierre', birth_year: 1931, death_year: 2022 },
    { slug: 'javier-moro',           display_name: 'Javier Moro', birth_year: 1955, death_year: null },
    // NZ
    { slug: 'kyle-onstott',     display_name: 'Kyle Onstott',     birth_year: 1887, death_year: 1966 },
    // Germany — banned authors
    { slug: 'thomas-mann',      display_name: 'Thomas Mann',      birth_year: 1875, death_year: 1955 },
    { slug: 'jaroslav-hasek',   display_name: 'Jaroslav Hašek',   birth_year: 1883, death_year: 1923 },
    { slug: 'erich-kastner',    display_name: 'Erich Kästner',    birth_year: 1899, death_year: 1974 },
    { slug: 'lion-feuchtwanger',display_name: 'Lion Feuchtwanger',birth_year: 1884, death_year: 1958 },
    { slug: 'joseph-roth',      display_name: 'Joseph Roth',      birth_year: 1894, death_year: 1939 },
  ]

  for (const row of newAuthors) {
    if (authorMap.has(row.slug)) { continue }
    console.log(`  [new author] ${row.slug}`)
    if (!WRITE) continue
    const { data, error } = await supabase.from('authors').insert(row).select('id').single()
    if (error || !data) { console.warn(`  [author warn] ${row.slug}: ${error?.message}`); continue }
    authorMap.set(row.slug, data.id)
    addedAuthorSlugs.push(row.slug)
  }

  type BanSpec = {
    country: string
    year: number
    actionType: 'banned' | 'restricted' | 'removed'
    status: 'active' | 'historical'
    scopeId: number
    reasons: string[]
    description: string
    sources: string[]
  }
  type BookSpec = {
    slug: string
    title: string
    lang: string
    year: number | null
    genres: string[]
    description_ban: string
    authors: string[]
    bans: BanSpec[]
  }

  const newBooks: BookSpec[] = [
    // ── China ────────────────────────────────────────────────────────────
    {
      slug: 'yellow-peril-wang-lixiong',
      title: 'Yellow Peril',
      lang: 'zh', year: 1991,
      genres: ['fiction', 'political-fiction'],
      description_ban: `Wang Lixiong's near-future political novel imagines the violent collapse of Communist Party rule in China and a chain of events leading to nuclear war. Circulated in samizdat after publication and pirated in Hong Kong, it was banned in mainland China for its scenarios of regime collapse and depictions of senior leaders.`,
      authors: ['wang-lixiong'],
      bans: [{
        country: 'CN', year: 1991, actionType: 'banned', status: 'active', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Banned in the People's Republic of China at publication for depicting the collapse of Communist Party rule. Circulated underground in mainland China; the Hong Kong edition has been periodically intercepted by mainland customs.`,
        sources: [SRC.wikiChinaCensor],
      }],
    },
    {
      slug: 'one-mans-bible',
      title: "One Man's Bible",
      lang: 'zh', year: 1999,
      genres: ['literary-fiction', 'autobiographical'],
      description_ban: `Gao Xingjian's autobiographical novel — written in exile in Paris — interweaves erotic memoir with a child's-eye account of the Cultural Revolution. Together with Soul Mountain, it was cited in Gao's 2000 Nobel Prize in Literature, the first awarded to a Chinese-language writer; both books remained prohibited in mainland China.`,
      authors: ['gao-xingjian'],
      bans: [{
        country: 'CN', year: 1999, actionType: 'banned', status: 'active', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Banned in the People's Republic of China alongside the rest of Gao Xingjian's mature work after his 1989 emigration and his post-Tiananmen denunciation of the Communist Party. The 2000 Nobel Prize award provoked an angry response from the PRC, and references to the laureate were briefly censored across mainland media.`,
        sources: [SRC.wikiChinaCensor, SRC.pen],
      }],
    },
    {
      slug: 'how-the-red-sun-rose',
      title: 'How the Red Sun Rose',
      lang: 'zh', year: 2000,
      genres: ['history', 'non-fiction'],
      description_ban: `Gao Hua's monumental scholarly study of the Yan'an Rectification Movement of 1942–45 — the campaign that consolidated Mao Zedong's personal authority over the Chinese Communist Party — drew on more than a decade of research and interviews. Published in Hong Kong by the Chinese University Press because no mainland publisher would touch it, the book has been called the single most important work on the early CCP written in Chinese.`,
      authors: ['gao-hua'],
      bans: [{
        country: 'CN', year: 2000, actionType: 'banned', status: 'active', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Refused publication in mainland China and prohibited from import; the Hong Kong edition has been seized at customs and the book has never appeared on mainland bookseller listings.`,
        sources: [SRC.wikiChinaCensor],
      }],
    },
    {
      slug: 'the-tiananmen-papers',
      title: 'The Tiananmen Papers',
      lang: 'zh', year: 2001,
      genres: ['history', 'non-fiction'],
      description_ban: `A compilation of internal Chinese Communist Party documents covering the 1989 Tiananmen Square protests and crackdown, smuggled out of China and edited by Andrew J. Nathan, Perry Link and Orville Schell. Published in English by PublicAffairs and in Chinese by Mirror Books, the documents purport to record top-level Politburo deliberations during the protests.`,
      authors: ['zhang-liang'],
      bans: [{
        country: 'CN', year: 2001, actionType: 'banned', status: 'active', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Prohibited in the People's Republic of China at publication. Distribution of the book has been treated as evidence of leaking state secrets; the editor's pseudonym "Zhang Liang" has never been definitively unmasked.`,
        sources: [SRC.wikiChinaCensor],
      }],
    },
    {
      slug: 'candy-mian-mian',
      title: 'Candy',
      lang: 'zh', year: 2000,
      genres: ['literary-fiction'],
      description_ban: `Mian Mian's debut novel — a semi-autobiographical chronicle of heroin addiction, sex work and youthful drift through 1990s Shenzhen — was first published as 糖 in 2000. Translated into English in 2003, it was widely read in pirated form on the mainland after the official ban.`,
      authors: ['mian-mian'],
      bans: [{
        country: 'CN', year: 2000, actionType: 'banned', status: 'active', scopeId: SCOPE_GOV,
        reasons: ['sexual', 'drugs', 'moral'],
        description: `Withdrawn from sale in mainland China shortly after publication and denounced by the Chinese press as "spiritual pollution"; the official campaign also targeted Wei Hui's Shanghai Baby. Both novels remained out of print on the mainland for over a decade.`,
        sources: [SRC.wikiChinaCensor],
      }],
    },
    {
      slug: 'lingren-wangshi',
      title: 'Lingren Wangshi',
      lang: 'zh', year: 2005,
      genres: ['memoir', 'history'],
      description_ban: `Zhang Yihe's collection of biographical sketches of Peking opera artists who were persecuted during the Anti-Rightist Campaign and the Cultural Revolution. Zhang — herself sentenced to twenty years' imprisonment as a "rightist's daughter" — drew on family papers, oral history and her own observation; the book sold out its initial print run before authorities pulled it.`,
      authors: ['zhang-yihe'],
      bans: [{
        country: 'CN', year: 2007, actionType: 'banned', status: 'active', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Removed from sale across mainland China in early 2007 alongside several other politically sensitive titles; the General Administration of Press and Publication's "eight-book ban" became one of the most discussed acts of literary censorship of the Hu Jintao era.`,
        sources: [SRC.wikiChinaCensor, SRC.pen],
      }],
    },
    {
      slug: 'bloody-myth-tan-hecheng',
      title: 'The Killing Wind: A Chinese County\'s Descent into Madness during the Cultural Revolution',
      lang: 'zh', year: 2010,
      genres: ['history', 'non-fiction'],
      description_ban: `Tan Hecheng spent more than two decades documenting the 1967 Daoxian massacre, in which several thousand "class enemies" and their relatives were murdered in southern Hunan during the Cultural Revolution. The Hong Kong edition was published in 2010 as Xuede Shenhua (《血的神话》); the English translation appeared in 2017.`,
      authors: ['tan-hecheng'],
      bans: [{
        country: 'CN', year: 2010, actionType: 'banned', status: 'active', scopeId: SCOPE_GOV,
        reasons: ['political', 'violence'],
        description: `Refused publication in mainland China and prohibited from import; the Hong Kong edition has been treated as a banned title by Chinese customs and has been periodically pulled from online listings on mainland platforms.`,
        sources: [SRC.wikiChinaCensor],
      }],
    },
    {
      slug: 'moving-away-from-the-imperial-regime',
      title: 'Moving Away from the Imperial Regime',
      lang: 'zh', year: 2015,
      genres: ['political', 'non-fiction'],
      description_ban: `Qin Hui — one of China's most prominent liberal intellectuals — argues for the gradual transition of the country from imperial-style rule to constitutional democracy. Published in Hong Kong after Qin found no mainland publisher willing to take it, the book has circulated within mainland intellectual circles in samizdat form.`,
      authors: ['qin-hui'],
      bans: [{
        country: 'CN', year: 2015, actionType: 'banned', status: 'active', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Refused mainland publication and prohibited from import; the Hong Kong edition is treated as politically sensitive by Chinese customs and has been seized from incoming travellers.`,
        sources: [SRC.wikiChinaCensor],
      }],
    },

    // ── India ────────────────────────────────────────────────────────────
    {
      slug: 'the-lotus-and-the-robot',
      title: 'The Lotus and the Robot',
      lang: 'en', year: 1960,
      genres: ['non-fiction', 'travel'],
      description_ban: `Arthur Koestler's polemical travel essay contrasts Indian spirituality with Japanese industrial modernity, treating both as flawed responses to the post-war condition. The book's unflattering portrait of contemporary Indian religion and its dismissive treatment of Gandhi prompted a national-level import ban.`,
      authors: ['arthur-koestler'],
      bans: [{
        country: 'IN', year: 1960, actionType: 'banned', status: 'active', scopeId: SCOPE_GOV,
        reasons: ['religious', 'political'],
        description: `Import banned by the Government of India shortly after publication for its negative portrayal of Gandhi and of Indian religious culture. The book remains on the Customs prohibition list.`,
        sources: [SRC.wikiIndiaList],
      }],
    },
    {
      slug: 'one-part-woman-perumal-murugan',
      title: 'One Part Woman',
      lang: 'ta', year: 2010,
      genres: ['literary-fiction'],
      description_ban: `Perumal Murugan's novel Mathorubhagan (மாதொருபாகன், "One Part Woman") draws on the historical Ardhanarishvara festival at Tiruchengode, where childless women were said to consummate ritual unions with strangers. After Hindu nationalist groups in Tamil Nadu organised street protests in 2014, Murugan announced "the writer Perumal Murugan is dead" and withdrew his books from sale; the Madras High Court later vindicated him in a celebrated 2016 judgment.`,
      authors: ['perumal-murugan'],
      bans: [{
        country: 'IN', year: 2014, actionType: 'restricted', status: 'historical', scopeId: SCOPE_GOV,
        reasons: ['religious', 'sexual'],
        description: `Withdrawn by the author in January 2015 under pressure from Hindu-right groups in Tamil Nadu after copies were burned in Tiruchengode; the Madras High Court restored full publication in July 2016, ruling that the protests amounted to an unconstitutional attempt to impose informal censorship.`,
        sources: [SRC.wikiIndiaList, SRC.pen],
      }],
    },
    {
      slug: 'the-myth-of-the-holy-cow',
      title: 'The Myth of the Holy Cow',
      lang: 'en', year: 2002,
      genres: ['history', 'non-fiction'],
      description_ban: `D. N. Jha's scholarly study draws on Vedic, epic and early Buddhist sources to argue that beef-eating was a regular feature of pre-medieval Indian life. The book's documentation that Brahmanical orthodoxy itself once tolerated cattle slaughter prompted threats against the author and a stay order from a Hyderabad court.`,
      authors: ['dwijendra-narayan-jha'],
      bans: [{
        country: 'IN', year: 2001, actionType: 'restricted', status: 'historical', scopeId: SCOPE_GOV,
        reasons: ['religious'],
        description: `A Hyderabad civil court issued a temporary injunction halting publication in August 2001 after a Hindu petitioner argued the book hurt religious sentiments. The author received death threats; the Indian edition was eventually published in 2002 by Matrix Books.`,
        sources: [SRC.wikiIndiaList],
      }],
    },
    {
      slug: 'five-past-midnight-in-bhopal',
      title: 'Five Past Midnight in Bhopal',
      lang: 'fr', year: 2001,
      genres: ['history', 'non-fiction'],
      description_ban: `Dominique Lapierre and Javier Moro's narrative reconstruction of the December 1984 Union Carbide disaster in Bhopal — the worst industrial accident in history — drew on more than four hundred interviews. A defamation suit by a former Indian Union Carbide official halted the book's Indian sale in 2009, although it remained widely available abroad.`,
      authors: ['dominique-lapierre', 'javier-moro'],
      bans: [{
        country: 'IN', year: 2009, actionType: 'restricted', status: 'historical', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `An Indian court issued an injunction halting domestic publication in 2009 following a defamation suit by Mahindra Singh Kalsi, formerly of Union Carbide India; the order was later lifted and the book resumed circulation.`,
        sources: [SRC.wikiIndiaList],
      }],
    },
    {
      slug: 'azadi-arundhati-roy',
      title: 'Azadi: Freedom. Fascism. Fiction.',
      lang: 'en', year: 2020,
      genres: ['essays', 'political'],
      description_ban: `Arundhati Roy's collection of nine essays — written between the 2019 abrogation of Article 370 and the early COVID-19 pandemic — argues that Hindu-nationalist authoritarianism in India is consolidating into a fully fascist project. Roy returns repeatedly to Kashmir as both subject and metaphor; the volume includes her essay on the Indian state's communications blackout in the Valley.`,
      authors: ['arundhati-roy'],
      bans: [{
        country: 'IN', year: 2025, actionType: 'banned', status: 'active', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Banned in the union territory of Jammu and Kashmir in 2025 as part of a sweep of roughly two dozen titles deemed by the J&K administration to "propagate false narratives" or "promote secessionism". The order followed the central government's reorganisation of the region and was widely criticised by Indian writers' organisations and PEN.`,
        sources: [SRC.wikiIndiaList, SRC.pen],
      }],
    },

    // ── New Zealand ──────────────────────────────────────────────────────
    {
      slug: 'mandingo-kyle-onstott',
      title: 'Mandingo',
      lang: 'en', year: 1957,
      genres: ['historical-fiction'],
      description_ban: `Kyle Onstott's lurid 1957 novel of an antebellum Louisiana slave plantation became a paperback phenomenon in the United States and was the seed of a long Falconhurst sequence. Its graphic sexual violence drew obscenity prosecutions in several Commonwealth jurisdictions.`,
      authors: ['kyle-onstott'],
      bans: [{
        country: 'NZ', year: 1959, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
        reasons: ['sexual', 'violence', 'racial'],
        description: `Prohibited as indecent by New Zealand authorities under the pre-1963 Customs regime and reaffirmed by the Indecent Publications Tribunal after 1963. The Tribunal cited the novel's depictions of interracial rape and torture; the ban was eventually relaxed.`,
        sources: [SRC.wikiNZList, SRC.nzClassification],
      }],
    },

    // ── Germany (Nazi 1933 book burnings) ────────────────────────────────
    {
      slug: 'the-magic-mountain',
      title: 'The Magic Mountain',
      lang: 'de', year: 1924,
      genres: ['literary-fiction'],
      description_ban: `Thomas Mann's 1924 novel — set in a Davos sanatorium on the eve of the First World War — is one of the foundational texts of German modernism. Mann was already in exile when the Nazis seized power and was the most internationally prominent German-language writer to denounce the regime.`,
      authors: ['thomas-mann'],
      bans: [{
        country: 'DE', year: 1933, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Banned by Nazi Germany after Mann's December 1936 stripping of his German citizenship and the formal proscription of his work by the Reich Chamber of Literature. Earlier, on 10 May 1933, Mann's books were among those publicly burned in Berlin's Opernplatz alongside those of his brother Heinrich Mann.`,
        sources: [SRC.wikiAuthorsNazi, SRC.ushmmBookBurnings],
      }],
    },
    {
      slug: 'the-good-soldier-svejk',
      title: 'The Good Soldier Švejk',
      lang: 'cs', year: 1923,
      genres: ['satire', 'literary-fiction'],
      description_ban: `Jaroslav Hašek's unfinished anti-war satire follows the irrepressible Czech soldier Josef Švejk through the absurdities of Habsburg military bureaucracy in the First World War. A foundational text of twentieth-century Central European literature, it became a touchstone of pacifist and anti-militarist writing.`,
      authors: ['jaroslav-hasek'],
      bans: [{
        country: 'DE', year: 1933, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Burned by Nazi student associations on 10 May 1933 as one of the prototypical works of "decadent" pacifist literature; thereafter prohibited under the regime's general suppression of anti-war and Czech-language writing.`,
        sources: [SRC.wikiAuthorsNazi, SRC.ushmmBookBurnings],
      }],
    },
    {
      slug: 'emil-and-the-detectives',
      title: 'Emil and the Detectives',
      lang: 'de', year: 1929,
      genres: ['children', 'fiction'],
      description_ban: `Erich Kästner's 1929 children's novel — about a boy who chases a thief across Berlin with the help of a gang of street children — is one of the most beloved children's books in German. Kästner was the only major German-language writer to attend the 10 May 1933 book burnings in person, watching anonymously from the crowd as his own works were thrown onto the pyre.`,
      authors: ['erich-kastner'],
      bans: [{
        country: 'DE', year: 1933, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Kästner's adult satire was burned on 10 May 1933, and most of his oeuvre was prohibited by the Reich Chamber of Literature. Emil und die Detektive itself was — uniquely — left on shelves for some years because of its enormous popularity, but Kästner was banned from publishing new work and survived the war under intermittent Gestapo surveillance.`,
        sources: [SRC.wikiAuthorsNazi, SRC.ushmmBookBurnings],
      }],
    },
    {
      slug: 'jew-suss-feuchtwanger',
      title: 'Jud Süß',
      lang: 'de', year: 1925,
      genres: ['historical-fiction'],
      description_ban: `Lion Feuchtwanger's 1925 historical novel about the eighteenth-century Württemberg court financier Joseph Süß Oppenheimer became an international bestseller. Feuchtwanger, who was on a US lecture tour when the Nazis took power, was stripped of his citizenship in 1933 and his books were among the most prominent burned that year. The Nazi regime later commissioned a 1940 antisemitic propaganda film of the same name that grotesquely inverted the novel's themes.`,
      authors: ['lion-feuchtwanger'],
      bans: [{
        country: 'DE', year: 1933, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
        reasons: ['political', 'racial'],
        description: `Burned on 10 May 1933 and formally banned by the Reich Chamber of Literature; Feuchtwanger was an early target of Nazi cultural policy and his Berlin home was looted. He spent the war in French internment and US exile.`,
        sources: [SRC.wikiAuthorsNazi, SRC.ushmmBookBurnings],
      }],
    },
    {
      slug: 'the-radetzky-march',
      title: 'The Radetzky March',
      lang: 'de', year: 1932,
      genres: ['literary-fiction', 'historical-fiction'],
      description_ban: `Joseph Roth's elegiac novel traces three generations of the Trotta family across the long decline of the Habsburg empire to its collapse in 1918. Roth — Austrian-Jewish, a journalist and self-described "Catholic monarchist" — left Berlin for Paris on the day Hitler took power and never returned; he drank himself to death in exile in 1939.`,
      authors: ['joseph-roth'],
      bans: [{
        country: 'DE', year: 1933, actionType: 'banned', status: 'historical', scopeId: SCOPE_GOV,
        reasons: ['political', 'racial'],
        description: `Roth's books were among those burned on 10 May 1933 and his entire oeuvre was prohibited by the Reich Chamber of Literature on account of his Jewish ancestry and his outspoken anti-Nazi journalism in exile.`,
        sources: [SRC.wikiAuthorsNazi, SRC.ushmmBookBurnings],
      }],
    },
  ]

  for (const entry of newBooks) {
    console.log(`\n[${entry.slug}]`)
    if (bookMap.has(entry.slug)) {
      console.log(`  [exists] book already in DB — skipping`)
      skippedDup++
      continue
    }

    const primaryAuthor = entry.authors[0] ?? 'anonymous'
    const authorDisplay =
      newAuthors.find(a => a.slug === primaryAuthor)?.display_name
      ?? primaryAuthor.replace(/-/g, ' ')
    const { coverUrl, workId } = await fetchCover(entry.title, authorDisplay)
    console.log(`  cover: ${coverUrl ? coverUrl.slice(0, 70) + '…' : 'not found'}`)
    await sleep(250)

    if (!WRITE) { added++; continue }

    const { data: bookRow, error: bookErr } = await supabase.from('books').insert({
      title: entry.title,
      slug: entry.slug,
      original_language: entry.lang,
      first_published_year: entry.year,
      genres: entry.genres,
      description_ban: entry.description_ban,
      cover_url: coverUrl,
      openlibrary_work_id: workId,
      ai_drafted: false,
    }).select('id').single()

    if (bookErr || !bookRow) { console.error(`  ✗ book: ${bookErr?.message}`); continue }
    const bookId = bookRow.id
    bookMap.set(entry.slug, bookId)
    addedBookSlugs.push(entry.slug)
    console.log(`  ✓ book id=${bookId}`)

    for (const aSlug of entry.authors) {
      const aId = authorMap.get(aSlug)
      if (!aId) { console.warn(`  [warn] author not found: ${aSlug}`); continue }
      await supabase.from('book_authors').insert({ book_id: bookId, author_id: aId })
    }

    for (const ban of entry.bans) {
      const { data: banRow, error: banErr } = await supabase.from('bans').insert({
        book_id: bookId,
        country_code: ban.country,
        scope_id: ban.scopeId,
        action_type: ban.actionType,
        status: ban.status,
        year_started: ban.year,
        description: ban.description,
      }).select('id').single()

      if (banErr || !banRow) { console.error(`  ✗ ban: ${banErr?.message}`); continue }

      for (const rSlug of ban.reasons) {
        const { error } = await supabase.from('ban_reason_links')
          .insert({ ban_id: banRow.id, reason_id: reasonId(rSlug) })
        if (error) console.warn(`  [reason warn] ${rSlug}: ${error.message}`)
      }
      for (const url of ban.sources) {
        const sid = await getSourceId(url, srcCache)
        if (sid) await linkBanToSource(banRow.id, sid)
      }
      console.log(`  ✓ ban ${ban.country} ${ban.year} ${ban.actionType} (id=${banRow.id})`)
    }
    added++
  }

  console.log('\n=== Summary ===')
  console.log(`added              : ${added}`)
  console.log(`skipped (duplicate): ${skippedDup}`)
  console.log(`skipped (missing)  : ${skippedMissing}`)
  if (!WRITE) console.log('\nDRY-RUN — re-run with --write to apply.')

  await notifyIndexNowFromScript({
    write: WRITE,
    books: addedBookSlugs,
    authors: addedAuthorSlugs,
  })
}

main().catch(e => { console.error(e); process.exit(1) })
