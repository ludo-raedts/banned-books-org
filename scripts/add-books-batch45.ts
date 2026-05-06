/**
 * Batch 45 — India (IN) high-confidence batch.
 *
 * The user's source list contained 12 candidate India titles. A pre-flight
 * check against the `bans` table (country_code='IN') showed 10 of those
 * already have IN ban records:
 *   the-satanic-verses, lajja, the-hindus-an-alternative-history, rama-retold,
 *   the-polyester-prince, great-soul, nine-hours-to-rama, such-a-long-journey,
 *   shivaji-hindu-king-in-islamic-india, an-area-of-darkness.
 *
 * Two are missing and added here:
 *   1. Understanding Islam Through Hadis — Ram Swarup
 *      Banned by the Government of India in 1990 under section 153A of the
 *      Indian Penal Code for content alleged to insult Islam. Publisher
 *      (Voice of India) faced prosecution. National-scope ban, status active.
 *   2. The Red Sari — Javier Moro
 *      Spanish-language biographical novel about Sonia Gandhi (El sari rojo,
 *      2008). Indian publication held back for ~5 years due to legal threats
 *      from associates of the Gandhi family. Per the task brief, this is
 *      "publisher withdrawal / legal intimidation" — NOT a formal national
 *      ban. Modelled as action_type='restricted', status='historical',
 *      year_ended=2015 (Roli Books finally published the Indian edition).
 *
 * Constraints honoured:
 *   - No new entries for the 10 books that already have IN bans (no overwrite).
 *   - No invented court orders or publisher names that aren't widely reported.
 *   - Only top-level URLs from sources the project already treats as
 *     authoritative for India (PEN International, Index on Censorship,
 *     The Hindu, The Guardian — see SRC table below).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/add-books-batch45.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/add-books-batch45.ts --write
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
  // Index on Censorship — covers Indian book bans extensively, including the
  // 1990 prosecution that followed publication of Understanding Islam Through Hadis.
  indexOnCensorship: 'https://www.indexoncensorship.org',
  // PEN International — author and publishing-freedom monitoring.
  penInternational: 'https://pen-international.org/',
  // The Hindu — Indian newspaper of record, covered both cases.
  theHindu: 'https://www.thehindu.com',
  // The Guardian (India desk) — covered Roli Books' eventual 2015 release of
  // The Red Sari and the years of prior legal pressure on Indian publishers.
  guardianIndia: 'https://www.theguardian.com/world/india',
}

const SRC_META: Record<string, [string, string]> = {
  [SRC.indexOnCensorship]: ['Index on Censorship', 'ngo'],
  [SRC.penInternational]:  ['PEN International', 'ngo'],
  [SRC.theHindu]:          ['The Hindu', 'news'],
  [SRC.guardianIndia]:     ['The Guardian — India', 'news'],
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
  // Pre-flight: confirm the 10 already-present titles and report skip count.
  // ═══════════════════════════════════════════════════════════════════════════
  const alreadyCovered = [
    'the-satanic-verses', 'lajja', 'the-hindus-an-alternative-history',
    'rama-retold', 'the-polyester-prince', 'great-soul',
    'nine-hours-to-rama', 'such-a-long-journey',
    'shivaji-hindu-king-in-islamic-india', 'an-area-of-darkness',
  ]
  console.log('=== Pre-flight: already-covered titles in IN ===')
  for (const slug of alreadyCovered) {
    const bookId = bookMap.get(slug)
    if (!bookId) { console.log(`  [warn] expected book missing: ${slug}`); continue }
    const { data } = await supabase.from('bans')
      .select('id').eq('book_id', bookId).eq('country_code', 'IN').maybeSingle()
    if (data) {
      console.log(`  [skip-dup] ${slug} — IN ban id=${data.id}`)
      skippedDup++
    } else {
      console.log(`  [missing-IN-ban] ${slug} — book exists but no IN ban (not in this batch's scope)`)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // New authors (only insert if absent)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== Authors ===')
  const newAuthors = [
    {
      slug: 'ram-swarup',
      display_name: 'Ram Swarup',
      birth_year: 1920,
      death_year: 1998,
      birth_country: 'IN',
    },
    {
      slug: 'javier-moro',
      display_name: 'Javier Moro',
      birth_year: 1955,
      death_year: null as number | null,
      birth_country: 'ES',
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
  // New books with IN bans
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n=== New books with IN bans ===')

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
      slug: 'understanding-islam-through-hadis',
      title: 'Understanding Islam Through Hadis',
      lang: 'en',
      year: 1983,
      genres: ['non-fiction', 'history'],
      description_ban: `Ram Swarup's polemical study of the Hadis (collections of sayings attributed to the Prophet Muhammad) was banned by the Government of India in 1990 for allegedly insulting Islam. The publisher Voice of India faced prosecution under section 153A of the Indian Penal Code (promoting enmity between religious groups), and Swarup himself was charged. The ban remains in force.`,
      authors: ['ram-swarup'],
      bans: [
        {
          year: 1990,
          yearEnded: null,
          actionType: 'banned',
          status: 'active',
          scopeId: SCOPE_GOV,
          region: null,
          actor: 'Government of India',
          reasons: ['religious', 'blasphemy'],
          description: `Banned nationally by the Government of India in 1990 for content alleged to insult Islam, with the publisher Voice of India and the author both prosecuted under section 153A of the Indian Penal Code (promoting enmity between religious groups on grounds of religion). The ban is widely cited in Indian publishing-freedom literature as a benchmark Section 153A case and remains in force.`,
          sources: [SRC.indexOnCensorship, SRC.penInternational],
        },
      ],
    },
    {
      slug: 'the-red-sari',
      title: 'The Red Sari',
      lang: 'es',
      year: 2008,
      genres: ['historical-fiction', 'biography'],
      description_ban: `Javier Moro's biographical novel about Sonia Gandhi — published in Spanish as El sari rojo (2008) and in English in 2010 — was held back from Indian publication for roughly five years following legal threats over alleged unauthorised use of Gandhi's life and supposed factual errors. No formal court order or government ban was ever issued; the suppression was through publisher self-censorship in the face of defamation threats. Roli Books eventually released the Indian edition in 2015.`,
      authors: ['javier-moro'],
      bans: [
        {
          year: 2010,
          yearEnded: 2015,
          actionType: 'restricted',
          status: 'historical',
          scopeId: SCOPE_GOV,
          region: null,
          actor: 'Indian publishers (legal-chill, no formal court order)',
          reasons: ['political', 'other'],
          description: `Indian publication of the English edition was held back for approximately five years after legal threats — including a defamation warning attributed to associates of the Gandhi family — discouraged Indian houses from issuing the book. This was publisher self-censorship, not a formal government ban or court restriction. Roli Books eventually released the Indian edition in 2015. The case is widely cited as an example of legal-intimidation chill on Indian publishing, comparable to the earlier suppression of Hamish McDonald's "The Polyester Prince".`,
          sources: [SRC.guardianIndia, SRC.theHindu],
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
        country_code: 'IN',
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
