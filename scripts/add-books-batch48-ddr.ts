/**
 * Batch 48 — DDR (East Germany) Druckgenehmigung cases.
 *
 * Source 1: Magisterarbeit/essay on DDR literature 1970s–80s
 *           https://webapp.uibk.ac.at/germanistik/histrom/docs/ddraufsatz.html
 * Source 2: Censorship in East Germany (overview)
 *           https://en.wikipedia.org/wiki/Censorship_in_East_Germany
 * Source 3: petersell.de (Wayback) on DDR literature 70s–80s
 *           https://web.archive.org/web/20060111102718/http://www.petersell.de/ddr/2_ueberblick.htm
 *
 * Yield: 4 new books + 4 new bans, plus 1 description-fill on an existing
 * bare ban (Kunze "Die wunderbaren Jahre" — book 703 / ban 769).
 *
 * Country code: 'DD' (East Germany / DDR), already present in countries table.
 * Scope: 'government' (state-level Druckgenehmigung refusal / Verlag pull-back).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/add-books-batch48-ddr.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/add-books-batch48-ddr.ts --write
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

const SRC = {
  uibk:       'https://webapp.uibk.ac.at/germanistik/histrom/docs/ddraufsatz.html',
  wikiDDR:    'https://en.wikipedia.org/wiki/Censorship_in_East_Germany',
  petersell:  'https://web.archive.org/web/20060111102718/http://www.petersell.de/ddr/2_ueberblick.htm',
}

const SRC_META: Record<string, [string, string]> = {
  [SRC.uibk]:      ['Universität Innsbruck — DDR-Literatur 70er/80er Jahre (Druckgenehmigung)', 'academic'],
  [SRC.wikiDDR]:   ['Wikipedia — Censorship in East Germany', 'web'],
  [SRC.petersell]: ['petersell.de — DDR-Literatur Überblick (Wayback)', 'web'],
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
  const addedBookSlugs: string[] = []
  const addedAuthorSlugs: string[] = []

  // ═════════════════════════════════════════════════════════════════════════
  // SECTION A — New authors
  // ═════════════════════════════════════════════════════════════════════════
  type AuthorRow = {
    slug: string
    display_name: string
    birth_year: number | null
    death_year: number | null
  }

  const newAuthors: AuthorRow[] = [
    { slug: 'stefan-heym',     display_name: 'Stefan Heym',     birth_year: 1913, death_year: 2001 },
    { slug: 'joachim-walther', display_name: 'Joachim Walther', birth_year: 1943, death_year: null },
    { slug: 'martin-stade',    display_name: 'Martin Stade',    birth_year: 1931, death_year: null },
  ]

  for (const row of newAuthors) {
    if (authorMap.has(row.slug)) { console.log(`  [exists] author ${row.slug}`); continue }
    console.log(`  [new author] ${row.slug}`)
    if (!WRITE) continue
    const { data, error } = await supabase.from('authors').insert(row).select('id').single()
    if (error || !data) { console.warn(`  [author warn] ${row.slug}: ${error?.message}`); continue }
    authorMap.set(row.slug, data.id)
    addedAuthorSlugs.push(row.slug)
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SECTION B — New books with DDR bans
  // ═════════════════════════════════════════════════════════════════════════
  type BanSpec = {
    country: string
    yearStarted: number
    yearEnded: number | null
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
    description_book: string
    authors: string[]
    bans: BanSpec[]
  }

  const newBooks: BookSpec[] = [
    {
      slug: 'der-koenig-david-bericht-stefan-heym',
      title: 'Der König David Bericht',
      lang: 'de', year: 1972,
      genres: ['literary-fiction', 'historical-fiction'],
      description_book: `Stefan Heym's novel reworks the biblical chronicles of King David's reign as a satirical commentary on the falsification of history by absolute power. A court historian is commissioned to compose the "authorised" record of David's life and discovers, in the process, that what the king demands and what actually happened cannot be reconciled. Widely read as a transparent parable of Stalinism — and of the SED's own management of memory — it became one of the most discussed works of post-Biermann DDR literature.`,
      description_ban: `Heym's manuscript was refused a Druckgenehmigung by the Hauptverwaltung Verlage und Buchhandel in 1972. The novel appeared first in West Germany (Bertelsmann, 1972) and in English translation (1973). An East German edition — heavily revised under pressure from the censors — followed in 1974 from Buchverlag Der Morgen, more than two years after the Western publication.`,
      authors: ['stefan-heym'],
      bans: [{
        country: 'DD', yearStarted: 1972, yearEnded: 1974,
        actionType: 'restricted', status: 'historical', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Druckgenehmigung initially refused by the Hauptverwaltung Verlage und Buchhandel; the novel circulated only in its West German edition for two years. A revised East German edition was eventually licensed in 1974 after extensive editorial concessions. Cited at the time as criticism of "real existing socialism" and read by the censors as a coded attack on Stalin and SED historiography.`,
        sources: [SRC.uibk, SRC.wikiDDR],
      }],
    },
    {
      slug: 'ahasver-stefan-heym',
      title: 'Ahasver',
      lang: 'de', year: 1981,
      genres: ['literary-fiction', 'historical-fiction'],
      description_book: `Heym's late-career novel braids together the medieval legend of Ahasuerus the Wandering Jew, a sixteenth-century Lutheran heresy dispute, and a present-day correspondence between an East-Berlin Marxist professor and his Israeli counterpart. The book is at once a meditation on rebellion in the religious imagination and a coded reckoning with the DDR's relationship to its own dissidents and to the Middle East.`,
      description_ban: `Heym was refused a Druckgenehmigung in 1981; the novel appeared first in West Germany (Bertelsmann, 1981). The East German edition was held back for seven years over passages touching on DDR foreign policy — relations with Iran and references to "arabische Freunde in Beirut" — and contemporary allusions the censors read as too direct. It was finally licensed in 1988 after Erich Honecker personally intervened.`,
      authors: ['stefan-heym'],
      bans: [{
        country: 'DD', yearStarted: 1981, yearEnded: 1988,
        actionType: 'restricted', status: 'historical', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Druckgenehmigung refused in 1981; the West German edition appeared the same year. The Hauptverwaltung Verlage und Buchhandel flagged "Problemstellen" relating to DDR foreign-policy allusions (Iran, Beirut) and to the regime's treatment of dissenters. The East German edition was finally cleared in 1987 and published in 1988 after Honecker personally overruled the censors — a delay of seven years.`,
        sources: [SRC.uibk, SRC.wikiDDR],
      }],
    },
    {
      slug: 'bewerbung-bei-hofe-joachim-walther',
      title: 'Bewerbung bei Hofe',
      lang: 'de', year: 1982,
      genres: ['literary-fiction', 'historical-fiction'],
      description_book: `Joachim Walther's novel transposes the mechanics of literary patronage and surveillance into a stylised early-modern court, where a young writer must navigate a hierarchy of censors, informers and aesthetic doctrines. The parallel with the DDR's own apparatus for managing literature was unmistakable — and was the reason the manuscript stalled for two years between acceptance and publication.`,
      description_ban: `Initially accepted by Buchverlag Der Morgen around 1980, the manuscript was then quietly withdrawn by the publisher, who cited a "changed political situation" and the SED's renewed emphasis on the "ideological class struggle". The book was eventually licensed and published in 1982. The Druckgenehmigung file for this title was among those that "disappeared" from the archive during the Wende.`,
      authors: ['joachim-walther'],
      bans: [{
        country: 'DD', yearStarted: 1980, yearEnded: 1982,
        actionType: 'restricted', status: 'historical', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Publication delayed roughly two years after the publisher's first acceptance. Internal correspondence cited the "verschärfter ideologischer Klassenkampf" of the post-Biermann period and the novel's transparent parallels between its early-modern court and the DDR's own censorship apparatus. The corresponding Druckgenehmigungs-Akte was missing from the Bundesarchiv holdings of the Hauptverwaltung Verlage und Buchhandel after 1989.`,
        sources: [SRC.uibk],
      }],
    },
    {
      slug: 'der-koenig-und-sein-narr-martin-stade',
      title: 'Der König und sein Narr',
      lang: 'de', year: 1975,
      genres: ['literary-fiction', 'historical-fiction'],
      description_book: `Martin Stade's historical novel imagines the relationship between the Prussian "Soldatenkönig" Friedrich Wilhelm I and his court jester Jakob Paul Freiherr von Gundling. The fool's role as the only figure permitted to speak truth to absolute power makes the book a study of the bind facing the intellectual under authoritarian rule — an allegorical reading that did not escape the SED cultural apparatus.`,
      description_ban: `Although the novel was licensed for print in 1975, the West German press reported that East German bookshops were instructed to keep it out of their window displays and not to actively promote it. The covert restriction was characteristic of a softer-than-banning mode of DDR cultural management in the years immediately after the Biermann expatriation.`,
      authors: ['martin-stade'],
      bans: [{
        country: 'DD', yearStarted: 1975, yearEnded: null,
        actionType: 'restricted', status: 'historical', scopeId: SCOPE_GOV,
        reasons: ['political'],
        description: `Per contemporaneous West German press reports, East German bookshops were instructed to keep the novel out of their window displays and not to feature it in active promotion, despite its having received a Druckgenehmigung. The informal restriction reflected the SED's reading of the king-and-fool material as an allegory of the intellectual under authoritarian power in the immediate post-Biermann period.`,
        sources: [SRC.uibk],
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
      description_book: entry.description_book,
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
        year_started: ban.yearStarted,
        year_ended: ban.yearEnded,
        description: ban.description,
        confidence: 'verified',
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
      console.log(`  ✓ ban ${ban.country} ${ban.yearStarted}${ban.yearEnded ? `–${ban.yearEnded}` : ''} ${ban.actionType} (id=${banRow.id})`)
    }
    added++
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SECTION C — Description-fill on the existing bare Kunze ban
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n=== Section C: existing bare-ban fill (Kunze) ===')
  const KUNZE_BAN_ID = 769
  const kunzeDescription =
    `Druckgenehmigung withheld in the GDR; Die wunderbaren Jahre appeared instead in West Germany at S. Fischer Verlag in October 1976, two months before the expatriation of Wolf Biermann. Kunze was expelled from the Schriftstellerverband, placed under intensified Stasi surveillance and subjected to a Berufsverbot. He emigrated to the Federal Republic in April 1977 — the first prominent author to do so in the wave of departures that followed the Biermann affair.`
  const { data: existingKunzeBan } = await supabase.from('bans').select('id, description').eq('id', KUNZE_BAN_ID).maybeSingle()
  if (!existingKunzeBan) {
    console.warn(`  [skip] ban_id=${KUNZE_BAN_ID} not found`)
  } else if (existingKunzeBan.description && existingKunzeBan.description.trim().length > 0) {
    console.log(`  [skip] ban_id=${KUNZE_BAN_ID} already has a description (${existingKunzeBan.description.length} chars) — leaving untouched`)
  } else {
    console.log(`  [update] ban_id=${KUNZE_BAN_ID}: fill description (${kunzeDescription.length} chars)`)
    if (WRITE) {
      const { error: upErr } = await supabase.from('bans').update({
        description: kunzeDescription,
        confidence: 'verified',
      }).eq('id', KUNZE_BAN_ID)
      if (upErr) console.error(`  ✗ update: ${upErr.message}`)
      else {
        // Link to the academic + petersell sources alongside the existing Wikipedia link.
        for (const url of [SRC.uibk, SRC.petersell]) {
          const sid = await getSourceId(url, srcCache)
          if (sid) await linkBanToSource(KUNZE_BAN_ID, sid)
        }
        console.log(`  ✓ ban_id=${KUNZE_BAN_ID} description filled, sources linked`)
      }
    }
  }

  console.log('\n=== Summary ===')
  console.log(`new books added    : ${added}`)
  console.log(`skipped (duplicate): ${skippedDup}`)
  if (!WRITE) console.log('\nDRY-RUN — re-run with --write to apply.')

  await notifyIndexNowFromScript({
    write: WRITE,
    books: addedBookSlugs,
    authors: addedAuthorSlugs,
  })
}

main().catch(e => { console.error(e); process.exit(1) })
