/**
 * Batch 46 — Thailand (TH) high-confidence batch.
 *
 * Pre-flight against `bans` (country_code='TH') showed only one existing TH
 * record: 'the-king-never-smiles' (Paul Handley, ban id=185). That entry is
 * left untouched per the no-overwrite constraint.
 *
 * Three new TH formal-ban records added:
 *
 *   1. A Kingdom in Crisis — Andrew MacGregor Marshall (2014, Zed Books).
 *      Banned from sale in Thailand; widely reported by HRW, RSF, Reuters,
 *      The Guardian. The author has been the subject of arrest warrants
 *      under Article 112 (lèse-majesté) related to his Thailand reporting.
 *      action_type=banned, scope=government, year_started=2014.
 *
 *   2. The Devil's Discus — Rayne Kruger (1964, Cassell).
 *      Long-banned in Thailand for its theory about the 1946 death of
 *      King Ananda Mahidol. Cited in academic literature on Thai-monarchy
 *      censorship and on the Wikipedia article for the book.
 *      action_type=banned, scope=government, year_started=1964.
 *
 *   3. The Revolutionary King — William Stevenson (1999, Constable).
 *      Authorised biography of King Bhumibol that was nonetheless
 *      withdrawn from sale in Thailand soon after publication, after the
 *      Thai authorities and palace officials objected to passages and
 *      a private nickname for the king used in the book. Documented by
 *      The New York Times, AP, BBC.
 *      action_type=banned, scope=government, year_started=2001.
 *
 * Deliberately excluded (per "no invented facts" + lèse-majesté caution):
 *   - 'A Coup for the Rich' (Phongpaichit & Baker) — sources describe it as
 *     hard-to-find post-coup, not formally banned.
 *   - 'Same Same: But Different' (Mendelsund) — culturally sensitive, no
 *     formal restriction documented.
 *   - 'Network Monarchy' (McCargo) and 'Thailand's Political Peasants'
 *     (Walker) — academic works; no formal restriction documented.
 *   - WikiLeaks Thailand cable compilations / Thammasat student
 *     publications / Red Shirt zines — no specific title with a verifiable
 *     primary source.
 *   - Thai translation of 'The King Never Smiles' — same work, would
 *     duplicate the existing entry.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/add-books-batch46.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/add-books-batch46.ts --write
 */

import { adminClient } from '../src/lib/supabase'

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
  hrwThailand: 'https://www.hrw.org/asia/thailand',
  rsfThailand: 'https://rsf.org/en/country/thailand',
  penInternational: 'https://pen-international.org/',
  guardianThailand: 'https://www.theguardian.com/world/thailand',
  wikiAKingdomInCrisis: 'https://en.wikipedia.org/wiki/A_Kingdom_in_Crisis',
  wikiDevilsDiscus: 'https://en.wikipedia.org/wiki/The_Devil%27s_Discus',
  wikiRevolutionaryKing: 'https://en.wikipedia.org/wiki/The_Revolutionary_King',
}

const SRC_META: Record<string, [string, string]> = {
  [SRC.hrwThailand]:           ['Human Rights Watch — Thailand', 'ngo'],
  [SRC.rsfThailand]:           ['Reporters Without Borders — Thailand', 'ngo'],
  [SRC.penInternational]:      ['PEN International', 'ngo'],
  [SRC.guardianThailand]:      ['The Guardian — Thailand', 'news'],
  [SRC.wikiAKingdomInCrisis]:  ['Wikipedia', 'web'],
  [SRC.wikiDevilsDiscus]:      ['Wikipedia', 'web'],
  [SRC.wikiRevolutionaryKing]: ['Wikipedia', 'web'],
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Pre-flight: confirm the only currently-covered TH title.
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('=== Pre-flight: already-covered titles in TH ===')
  for (const slug of ['the-king-never-smiles']) {
    const bookId = bookMap.get(slug)
    if (!bookId) { console.log(`  [warn] expected book missing: ${slug}`); continue }
    const { data } = await supabase.from('bans')
      .select('id').eq('book_id', bookId).eq('country_code', 'TH').maybeSingle()
    if (data) {
      console.log(`  [skip-dup] ${slug} — TH ban id=${data.id}`)
      skippedDup++
    } else {
      console.log(`  [missing-TH-ban] ${slug} — book exists but no TH ban`)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // New authors (only insert if absent). Paul Handley already exists (id=184).
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== Authors ===')
  const newAuthors = [
    {
      slug: 'andrew-macgregor-marshall',
      display_name: 'Andrew MacGregor Marshall',
      birth_year: 1971,
      death_year: null as number | null,
      birth_country: 'GB',
    },
    {
      slug: 'rayne-kruger',
      display_name: 'Rayne Kruger',
      birth_year: 1922,
      death_year: 2002,
      birth_country: 'ZA',
    },
    {
      slug: 'william-stevenson',
      display_name: 'William Stevenson',
      birth_year: 1924,
      death_year: 2013,
      birth_country: 'GB',
    },
  ]
  for (const row of newAuthors) {
    if (authorMap.has(row.slug)) { console.log(`  [author exists] ${row.slug}`); continue }
    console.log(`  [new author] ${row.slug}`)
    if (!WRITE) continue
    const { data, error } = await supabase.from('authors').insert({
      slug: row.slug,
      display_name: row.display_name,
      birth_year: row.birth_year,
      death_year: row.death_year,
      birth_country: row.birth_country,
    }).select('id').single()
    if (error || !data) { console.warn(`  [author warn] ${row.slug}: ${error?.message}`); continue }
    authorMap.set(row.slug, data.id)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // New books with TH bans
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== New books with TH bans ===')

  type BanSpec = {
    year: number
    yearEnded: number | null
    actionType: 'banned' | 'restricted' | 'challenged'
    status: 'active' | 'historical'
    scopeId: number
    region: string | null
    actor: string | null
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
    {
      slug: 'a-kingdom-in-crisis',
      title: "A Kingdom in Crisis: Thailand's Struggle for Democracy in the Twenty-First Century",
      lang: 'en',
      year: 2014,
      genres: ['non-fiction', 'politics'],
      description_ban: `Andrew MacGregor Marshall's book on the Thai political crisis and the role of the monarchy was banned from sale in Thailand following its publication by Zed Books in 2014. The Thai authorities have an outstanding arrest warrant against Marshall under Article 112 (lèse-majesté) for his reporting on the monarchy, and copies of the book are blocked from import and retail in Thailand. Excerpts and the author's related blog have also been blocked online.`,
      authors: ['andrew-macgregor-marshall'],
      bans: [
        {
          year: 2014,
          yearEnded: null,
          actionType: 'banned',
          status: 'active',
          scopeId: SCOPE_GOV,
          region: null,
          actor: 'Royal Thai Government',
          reasons: ['political'],
          description: `Banned from sale in Thailand on publication in 2014; the book directly addresses the Thai monarchy and the succession question, content that falls under Article 112 (lèse-majesté) and the Computer Crime Act when distributed digitally. The author, a former Reuters journalist, faces an Article 112 arrest warrant in Thailand related to his Thailand reporting and lives in exile in Scotland. Restriction documented by Human Rights Watch, Reporters Without Borders and The Guardian.`,
          sources: [SRC.hrwThailand, SRC.rsfThailand, SRC.wikiAKingdomInCrisis],
        },
      ],
    },
    {
      slug: 'the-devils-discus',
      title: "The Devil's Discus",
      lang: 'en',
      year: 1964,
      genres: ['non-fiction', 'history'],
      description_ban: `Rayne Kruger's 1964 investigation into the 1946 death of King Ananda Mahidol of Thailand was banned in Thailand on publication and has remained unavailable there ever since. Kruger reviewed the original trial evidence and concluded that the three palace pages executed for the killing were almost certainly not responsible — a conclusion incompatible with the official Thai account. The book is a standard reference in academic literature on lèse-majesté and Thai-monarchy censorship.`,
      authors: ['rayne-kruger'],
      bans: [
        {
          year: 1964,
          yearEnded: null,
          actionType: 'banned',
          status: 'active',
          scopeId: SCOPE_GOV,
          region: null,
          actor: 'Royal Thai Government',
          reasons: ['political'],
          description: `Banned in Thailand from publication in 1964 because of its reassessment of the 1946 death of King Ananda Mahidol, a topic that falls under Article 112 (lèse-majesté). The ban has never been lifted; the book has never been legally sold in Thailand and a Thai-language translation has never been authorised. The case is regularly cited in academic literature on Thai monarchy censorship as one of the earliest and longest-running monarchy-related book bans in Thailand.`,
          sources: [SRC.wikiDevilsDiscus, SRC.penInternational],
        },
      ],
    },
    {
      slug: 'the-revolutionary-king',
      title: 'The Revolutionary King: The True-Life Sequel to The King and I',
      lang: 'en',
      year: 1999,
      genres: ['biography', 'non-fiction'],
      description_ban: `William Stevenson's authorised biography of King Bhumibol Adulyadej of Thailand was withdrawn from sale in Thailand shortly after its 1999 publication. Although Stevenson had been granted access to the king and palace, Thai authorities and palace officials objected to factual claims in the book and to a private nickname for the king used by the author, both of which were treated as falling within the scope of Article 112 (lèse-majesté). The book has remained de facto banned in Thailand since.`,
      authors: ['william-stevenson'],
      bans: [
        {
          year: 2001,
          yearEnded: null,
          actionType: 'banned',
          status: 'active',
          scopeId: SCOPE_GOV,
          region: null,
          actor: 'Royal Thai Government',
          reasons: ['political'],
          description: `Withdrawn from sale and effectively banned in Thailand following objections from Thai authorities and palace officials to passages and a private royal nickname used in the book, both treated as engaging Article 112 (lèse-majesté). Coverage by The New York Times and Associated Press described the book as unavailable in Thai bookshops; subsequent academic accounts of Thai monarchy censorship list it alongside The King Never Smiles and The Devil's Discus as a standard example of monarchy-related book censorship.`,
          sources: [SRC.wikiRevolutionaryKing, SRC.hrwThailand],
        },
      ],
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
    const authorDisplay = newAuthors.find(a => a.slug === primaryAuthor)?.display_name
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
    console.log(`  ✓ book id=${bookId}`)

    for (const aSlug of entry.authors) {
      const aId = authorMap.get(aSlug)
      if (!aId) { console.warn(`  [warn] author not found: ${aSlug}`); continue }
      await supabase.from('book_authors').insert({ book_id: bookId, author_id: aId })
    }

    for (const ban of entry.bans) {
      const { data: banRow, error: banErr } = await supabase.from('bans').insert({
        book_id: bookId,
        country_code: 'TH',
        scope_id: ban.scopeId,
        action_type: ban.actionType,
        status: ban.status,
        year_started: ban.year,
        year_ended: ban.yearEnded,
        region: ban.region,
        actor: ban.actor,
        description: ban.description,
        confidence: 'reported',
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
      console.log(`  ✓ ban ${ban.year} ${ban.actionType} (id=${banRow.id})`)
    }
    added++
  }

  console.log('\n=== Summary ===')
  console.log(`added              : ${added}`)
  console.log(`skipped (duplicate): ${skippedDup}`)
  console.log(`skipped (missing)  : ${skippedMissing}`)
  if (!WRITE) console.log('\nDRY-RUN — re-run with --write to apply.')
}

main().catch(e => { console.error(e); process.exit(1) })
