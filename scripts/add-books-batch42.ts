/**
 * Batch 42 — 6 books from parliamentary/classification records:
 *   Ireland Censorship Register (parts 1 & 2) + New Zealand Classification Office.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/add-books-batch42.ts        # dry-run
 *   npx tsx --env-file=.env.local scripts/add-books-batch42.ts --write
 */

import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')
const supabase = adminClient()

async function fetchCover(title: string, author: string): Promise<{ coverUrl: string | null; workId: string | null }> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key,cover_i&limit=1`)
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number }> }
    const doc = json.docs?.[0]
    return {
      coverUrl: doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      workId: doc?.key?.replace('/works/', '') ?? null,
    }
  } catch {
    return { coverUrl: null, workId: null }
  }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const { data: existingBooks } = await supabase.from('books').select('id, slug')
  const { data: existingAuthors } = await supabase.from('authors').select('id, slug')

  const scopeId = (slug: string) => {
    const s = scopes!.find(s => s.slug === slug)
    if (!s) throw new Error(`Scope not found: ${slug}`)
    return s.id
  }
  const reasonId = (slug: string) => {
    const r = reasons!.find(r => r.slug === slug)
    if (!r) throw new Error(`Reason not found: ${slug}`)
    return r.id
  }

  const existingBookSlugs = new Set((existingBooks ?? []).map(b => b.slug))
  const authorMap = new Map((existingAuthors ?? []).map(a => [a.slug, a.id as number]))

  const gov = scopeId('government')

  if (WRITE) {
    await supabase.from('countries').upsert([
      { code: 'IE', name_en: 'Ireland',     slug: 'ireland' },
      { code: 'NZ', name_en: 'New Zealand', slug: 'new-zealand' },
    ], { onConflict: 'code' })
    console.log('Countries upserted.')
  }

  const authorRows = [
    { slug: 'jean-martin',      display_name: 'Jean Martin',      birth_year: null, death_year: null },
    { slug: 'dorothy-thurtle',  display_name: 'Dorothy Thurtle',  birth_year: 1901, death_year: 1978 },
    { slug: 'graham-masterton', display_name: 'Graham Masterton', birth_year: 1946, death_year: null },
    { slug: 'ted-dawe',         display_name: 'Ted Dawe',         birth_year: 1950, death_year: null },
    // 'anonymous' already exists from earlier batches
  ]

  for (const row of authorRows) {
    if (authorMap.has(row.slug)) { console.log(`  [author exists] ${row.slug}`); continue }
    console.log(`  [new author] ${row.slug}`)
    if (!WRITE) continue
    const { data, error } = await supabase.from('authors').insert({
      slug: row.slug,
      display_name: row.display_name,
      birth_year: row.birth_year,
      death_year: row.death_year,
    }).select('id').single()
    if (error) { console.warn(`  [author error] ${row.slug}: ${error.message}`); continue }
    authorMap.set(row.slug, data.id)
  }

  type BanData = {
    cc: string; scope: number; actionType: string; status: string
    yearStarted: number | null; yearEnded: number | null
    reasons: string[]; description: string
  }
  type NewBook = {
    book: { title: string; slug: string; original_language: string; first_published_year: number | null; genres: string[]; description_ban: string }
    authorSlugs: string[]
    bans: BanData[]
  }

  const books: NewBook[] = [
    {
      book: {
        title: 'The Raped Little Runaway',
        slug: 'the-raped-little-runaway',
        original_language: 'en',
        first_published_year: null,
        genres: ['fiction'],
        description_ban: `Banned in Ireland under Part I of the Register of Prohibited Publications on grounds that it is "indecent or obscene." A 2025 parliamentary response confirmed the book remains prohibited because it contains child sexual abuse material, and that possession and distribution remain criminal offences. Unlike other register entries, it was not affected by the 2018 removal of abortion-related prohibitions.`,
      },
      authorSlugs: ['jean-martin'],
      bans: [{
        cc: 'IE', scope: gov, actionType: 'banned', status: 'active',
        yearStarted: 2016, yearEnded: null,
        reasons: ['obscenity', 'sexual'],
        description: `Register of Prohibited Publications, Part I. The 2025 minister confirmed possession and distribution remain criminal due to child sexual abuse content.`,
      }],
    },
    {
      book: {
        title: 'Abortion Internationally',
        slug: 'abortion-internationally',
        original_language: 'en',
        first_published_year: null,
        genres: ['non-fiction'],
        description_ban: `Banned in Ireland in 1983 under Part II of the Register of Prohibited Publications for being "indecent or obscene and/or advocating the procurement of abortion or miscarriage." Published by the National Abortion Campaign in London. The abortion-related grounds for prohibition were abolished in 2018 following Ireland's constitutional referendum legalising abortion, but as of 2025 the register had not yet been formally wound down.`,
      },
      authorSlugs: ['anonymous'],
      bans: [{
        cc: 'IE', scope: gov, actionType: 'banned', status: 'active',
        yearStarted: 1983, yearEnded: null,
        reasons: ['moral'],
        description: `Register of Prohibited Publications, Part II. Legal basis (prohibition of abortion advocacy) abolished 2018; register not formally stood down as of 2025.`,
      }],
    },
    {
      book: {
        title: 'Abortion: Our Struggle for Control',
        slug: 'abortion-our-struggle-for-control',
        original_language: 'en',
        first_published_year: null,
        genres: ['non-fiction'],
        description_ban: `Banned in Ireland in 1983 under Part II of the Register of Prohibited Publications for advocating the procurement of abortion or miscarriage. Published by the National Abortion Campaign, London. The legal basis for this prohibition was removed by constitutional amendment in 2018, though the register entry remained formally unresolved as of 2025.`,
      },
      authorSlugs: ['anonymous'],
      bans: [{
        cc: 'IE', scope: gov, actionType: 'banned', status: 'active',
        yearStarted: 1983, yearEnded: null,
        reasons: ['moral'],
        description: `Register of Prohibited Publications, Part II. Legal basis abolished 2018; register not formally stood down as of 2025.`,
      }],
    },
    {
      book: {
        title: 'Abortion: Right or Wrong?',
        slug: 'abortion-right-or-wrong',
        original_language: 'en',
        first_published_year: 1942,
        genres: ['non-fiction'],
        description_ban: `Banned in Ireland in 1942 under Part II of the Register of Prohibited Publications for advocating abortion. Dorothy Thurtle's book was cited by name in a 2025 parliamentary answer as still listed — making it one of the longest-standing entries on the register. The legal basis was abolished in 2018 following Ireland's constitutional change, but the register had not been formally wound down by 2025.`,
      },
      authorSlugs: ['dorothy-thurtle'],
      bans: [{
        cc: 'IE', scope: gov, actionType: 'banned', status: 'active',
        yearStarted: 1942, yearEnded: null,
        reasons: ['moral'],
        description: `Register of Prohibited Publications, Part II. Explicitly cited by name in a 2025 parliamentary answer as still listed; legal basis abolished 2018.`,
      }],
    },
    {
      book: {
        title: 'How to Drive Your Man Wild in Bed',
        slug: 'how-to-drive-your-man-wild-in-bed',
        original_language: 'en',
        first_published_year: 1975,
        genres: ['non-fiction'],
        description_ban: `Banned in Ireland under Part II of the Register of Prohibited Publications on grounds of obscenity. Published by W.H. Allen, London. Cited in parliamentary answers as an example of titles still formally listed on the register — illustrating how sexual self-help literature was routinely suppressed under broad Irish moral censorship provisions. As of 2025 the book remained on the register, which had not been formally wound down.`,
      },
      authorSlugs: ['graham-masterton'],
      bans: [{
        cc: 'IE', scope: gov, actionType: 'banned', status: 'active',
        yearStarted: 1985, yearEnded: null,
        reasons: ['sexual', 'obscenity'],
        description: `Register of Prohibited Publications, Part II. Still formally listed as of the 2025 parliamentary response.`,
      }],
    },
    {
      book: {
        title: 'Into the River',
        slug: 'into-the-river',
        original_language: 'en',
        first_published_year: 2012,
        genres: ['young-adult', 'coming-of-age'],
        description_ban: `Classified as unrestricted on publication, then restricted to R14 ("parental advisory explicit content") by the New Zealand Classification Office in 2013. In 2015 the New Zealand Film and Literature Board of Review issued an Interim Restriction Order making possession and distribution a criminal offence — effectively a nationwide ban. After public and legal challenge, the classification was returned to unrestricted. The Classification Office concluded "a restriction would be inconsistent with the right to freedom of expression." The case contributed to a 2017 reform of New Zealand classification law.`,
      },
      authorSlugs: ['ted-dawe'],
      bans: [{
        cc: 'NZ', scope: gov, actionType: 'banned', status: 'historical',
        yearStarted: 2013, yearEnded: 2015,
        reasons: ['sexual', 'violence', 'drugs'],
        description: `Interim Restriction Order 2015 made possession and distribution a criminal offence. Lifted after challenge; returned to unrestricted status. Led to 2017 legislative amendment.`,
      }],
    },
  ]

  for (const entry of books) {
    const { book, authorSlugs, bans } = entry
    console.log(`\n[${book.slug}]`)

    if (existingBookSlugs.has(book.slug)) {
      console.log(`  [skip] already exists`)
      continue
    }

    const { coverUrl, workId } = await fetchCover(book.title, authorSlugs[0] ?? '')
    console.log(`  cover: ${coverUrl ? coverUrl.slice(0, 70) + '…' : 'not found'}`)
    await sleep(300)

    if (!WRITE) continue

    const { data: bookRow, error: bookErr } = await supabase.from('books').insert({
      title: book.title,
      slug: book.slug,
      original_language: book.original_language,
      first_published_year: book.first_published_year,
      genres: book.genres,
      description_ban: book.description_ban,
      cover_url: coverUrl,
      openlibrary_work_id: workId,
      ai_drafted: false,
    }).select('id').single()

    if (bookErr || !bookRow) { console.error(`  ✗ book insert: ${bookErr?.message}`); continue }
    const bookId = bookRow.id
    console.log(`  ✓ book inserted (id=${bookId})`)

    for (const aSlug of authorSlugs) {
      const aId = authorMap.get(aSlug)
      if (!aId) { console.warn(`  [warn] author not found: ${aSlug}`); continue }
      const { error: baErr } = await supabase.from('book_authors').insert({ book_id: bookId, author_id: aId })
      if (baErr) console.warn(`  [warn] book_authors: ${baErr.message}`)
    }

    for (const ban of bans) {
      const { data: banRow, error: banErr } = await supabase.from('bans').insert({
        book_id: bookId,
        country_code: ban.cc,
        scope_id: ban.scope,
        action_type: ban.actionType,
        status: ban.status,
        year_started: ban.yearStarted,
        year_ended: ban.yearEnded,
        description: ban.description,
      }).select('id').single()

      if (banErr || !banRow) { console.error(`  ✗ ban insert (${ban.cc}): ${banErr?.message}`); continue }

      for (const rSlug of ban.reasons) {
        const { error: rlErr } = await supabase.from('ban_reason_links').insert({ ban_id: banRow.id, reason_id: reasonId(rSlug) })
        if (rlErr) console.warn(`  [warn] reason link (${rSlug}): ${rlErr.message}`)
      }
      console.log(`  ✓ ban ${ban.cc} (${ban.status}) — reasons: ${ban.reasons.join(', ')}`)
    }
  }

  if (!WRITE) console.log('\n[DRY-RUN] Re-run with --write to apply.')
}

main().catch(e => { console.error(e); process.exit(1) })
