/**
 * Round 2: Australia, New Zealand, Ireland, and additional countries.
 * Sources: Wikipedia censorship articles for AU, NZ, IE.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-wikipedia-countries-r2.ts
 *   npx tsx --env-file=.env.local scripts/import-wikipedia-countries-r2.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

// ── New bans for existing books ────────────────────────────────────────────────

interface NewBan {
  bookSlug:     string
  countryCode:  string
  scopeSlug:    string
  actionType:   string
  status:       string
  yearStarted:  number | null
  yearEnded:    number | null
  institution:  string | null
  actor:        string | null
  description:  string | null
  reasonSlugs:  string[]
}

const NEW_BANS: NewBan[] = [
  {
    bookSlug:    'borstal-boy',
    countryCode: 'AU',
    scopeSlug:   'customs',
    actionType:  'banned',
    status:      'historical',
    yearStarted: 1958,
    yearEnded:   null,
    institution: 'Australian Government',
    actor:       null,
    description: 'Banned by Australian customs following the Irish ban of 1958 for obscenity and content sympathetic to the IRA.',
    reasonSlugs: ['obscenity', 'political'],
  },
  {
    bookSlug:    'the-decameron',
    countryCode: 'AU',
    scopeSlug:   'customs',
    actionType:  'banned',
    status:      'historical',
    yearStarted: 1927,
    yearEnded:   null,
    institution: 'Australian Government',
    actor:       null,
    description: 'Banned under obscenity provisions; one of the earliest books banned under Australian customs import restrictions.',
    reasonSlugs: ['obscenity', 'sexual'],
  },
  {
    bookSlug:    'brave-new-world',
    countryCode: 'AU',
    scopeSlug:   'customs',
    actionType:  'banned',
    status:      'historical',
    yearStarted: 1932,
    yearEnded:   null,
    institution: 'Australian Government',
    actor:       null,
    description: 'Banned on publication in 1932 for its depictions of promiscuity and drug use; the ban was not widely enforced.',
    reasonSlugs: ['sexual', 'drugs'],
  },
]

// ── New books to add ──────────────────────────────────────────────────────────

interface NewBook {
  title:        string
  slug:         string
  authorName:   string
  authorSlug:   string
  language:     string
  publishYear:  number
  genres:       string[]
  bans:         Omit<NewBan, 'bookSlug'>[]
}

const NEW_BOOKS: NewBook[] = [
  {
    title:       'Another Country',
    slug:        'another-country',
    authorName:  'James Baldwin',
    authorSlug:  'james-baldwin',
    language:    'en',
    publishYear: 1962,
    genres:      ['literary-fiction'],
    bans: [
      {
        countryCode: 'AU',
        scopeSlug:   'customs',
        actionType:  'banned',
        status:      'historical',
        yearStarted: 1963,
        yearEnded:   null,
        institution: 'Commonwealth Customs Department',
        actor:       null,
        description: 'Banned by Commonwealth Customs in 1963 for "indecent language" and its frank treatment of interracial relationships and homosexuality.',
        reasonSlugs: ['sexual', 'racial'],
      },
    ],
  },
  {
    title:       'Forever Amber',
    slug:        'forever-amber',
    authorName:  'Kathleen Winsor',
    authorSlug:  'kathleen-winsor',
    language:    'en',
    publishYear: 1944,
    genres:      ['historical-fiction'],
    bans: [
      {
        countryCode: 'AU',
        scopeSlug:   'customs',
        actionType:  'banned',
        status:      'historical',
        yearStarted: 1945,
        yearEnded:   null,
        institution: 'Australian Government',
        actor:       null,
        description: 'Banned in 1945 for "sex obsession"; the novel\'s frank treatment of its protagonist\'s sexual relationships was deemed obscene.',
        reasonSlugs: ['sexual', 'obscenity'],
      },
      {
        countryCode: 'NZ',
        scopeSlug:   'customs',
        actionType:  'banned',
        status:      'historical',
        yearStarted: null,
        yearEnded:   null,
        institution: 'Comptroller of Customs',
        actor:       null,
        description: 'Banned by New Zealand customs under the Indecent Publications Act for sexual content.',
        reasonSlugs: ['sexual', 'obscenity'],
      },
    ],
  },
  {
    title:       'The 120 Days of Sodom',
    slug:        'the-120-days-of-sodom',
    authorName:  'Marquis de Sade',
    authorSlug:  'marquis-de-sade',
    language:    'fr',
    publishYear: 1904,
    genres:      ['literary-fiction'],
    bans: [
      {
        countryCode: 'AU',
        scopeSlug:   'customs',
        actionType:  'banned',
        status:      'historical',
        yearStarted: 1957,
        yearEnded:   null,
        institution: 'Australian Government',
        actor:       null,
        description: 'Banned in Australia in 1957 for extreme obscenity; the book depicts graphic sexual violence and torture.',
        reasonSlugs: ['obscenity', 'sexual', 'violence'],
      },
    ],
  },
  {
    title:       'The World Is Full of Married Men',
    slug:        'the-world-is-full-of-married-men',
    authorName:  'Jackie Collins',
    authorSlug:  'jackie-collins',
    language:    'en',
    publishYear: 1968,
    genres:      ['literary-fiction'],
    bans: [
      {
        countryCode: 'AU',
        scopeSlug:   'customs',
        actionType:  'banned',
        status:      'historical',
        yearStarted: 1968,
        yearEnded:   null,
        institution: 'Australian Government',
        actor:       null,
        description: 'Banned on publication for sexual content. Collins\' debut novel was considered too explicit for Australian customs.',
        reasonSlugs: ['sexual'],
      },
    ],
  },
  {
    title:       'The Stud',
    slug:        'the-stud-jackie-collins',
    authorName:  'Jackie Collins',
    authorSlug:  'jackie-collins',
    language:    'en',
    publishYear: 1969,
    genres:      ['literary-fiction'],
    bans: [
      {
        countryCode: 'AU',
        scopeSlug:   'customs',
        actionType:  'banned',
        status:      'historical',
        yearStarted: 1969,
        yearEnded:   null,
        institution: 'Australian Government',
        actor:       null,
        description: 'Banned in Australia for sexual content; banned in consecutive years alongside Collins\'s previous novel.',
        reasonSlugs: ['sexual'],
      },
    ],
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = adminClient()

  console.log(`\n── import-wikipedia-countries-r2 (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const { data: scopes }  = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const scopeMap  = new Map((scopes  ?? []).map(s => [s.slug, s.id as number]))
  const reasonMap = new Map((reasons ?? []).map(r => [r.slug, r.id as number]))

  // ── New bans for existing books ────────────────────────────────────────────

  console.log(`=== Bans for existing books (${NEW_BANS.length}) ===\n`)

  for (const ban of NEW_BANS) {
    const { data: books } = await supabase.from('books')
      .select('id, title').eq('slug', ban.bookSlug).limit(1)
    const book = books?.[0]
    if (!book) { console.log(`Book not found: ${ban.bookSlug}`); continue }

    const { data: existing } = await supabase.from('bans')
      .select('id').eq('book_id', book.id).eq('country_code', ban.countryCode).limit(1)
    if (existing?.length) {
      console.log(`[${ban.countryCode}] "${book.title}": ban exists — skip`)
      continue
    }

    const scopeId = scopeMap.get(ban.scopeSlug)
    if (!scopeId) { console.log(`Unknown scope: ${ban.scopeSlug}`); continue }

    console.log(`[${ban.countryCode}] "${book.title}" — ${ban.yearStarted ?? '?'} ${ban.institution ?? ''}`)

    if (APPLY) {
      const { data: newBan, error: banErr } = await supabase.from('bans').insert({
        book_id: book.id, country_code: ban.countryCode, scope_id: scopeId,
        action_type: ban.actionType, status: ban.status,
        year_started: ban.yearStarted, year_ended: ban.yearEnded,
        institution: ban.institution, actor: ban.actor, description: ban.description,
      }).select('id').single()
      if (banErr) { console.error(`  ✗ ${banErr.message}`); continue }
      for (const rSlug of ban.reasonSlugs) {
        const rId = reasonMap.get(rSlug)
        if (rId) await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: rId })
      }
      console.log(`  ✓ written`)
    }
  }

  // ── New books ────────────────────────────────────────────────────────────────

  console.log(`\n=== New books (${NEW_BOOKS.length}) ===\n`)

  let existingSlugs = new Set<string>()
  let offset = 0
  while (true) {
    const { data } = await supabase.from('books').select('slug').range(offset, offset + 999)
    if (!data || data.length === 0) break
    data.forEach(b => existingSlugs.add(b.slug))
    if (data.length < 1000) break
    offset += 1000
  }
  const { data: existingAuthors } = await supabase.from('authors').select('id, slug')
  const authorMap = new Map((existingAuthors ?? []).map(a => [a.slug, a.id as number]))

  for (const nb of NEW_BOOKS) {
    const inDb = existingSlugs.has(nb.slug)
    console.log(`"${nb.title}" by ${nb.authorName}: ${inDb ? 'already in DB' : 'NEW BOOK'}`)

    if (!APPLY) {
      nb.bans.forEach(b => console.log(`  [${b.countryCode}] ${b.yearStarted ?? '?'} — ${b.institution ?? ''}`))
      continue
    }

    let bookId: number | null = null

    if (!inDb) {
      let authorId = authorMap.get(nb.authorSlug)
      if (!authorId) {
        const { data: newAuthor, error: ae } = await supabase.from('authors').insert({
          slug: nb.authorSlug, display_name: nb.authorName,
        }).select('id').single()
        if (ae) {
          const { data: ex } = await supabase.from('authors').select('id').eq('slug', nb.authorSlug).single()
          if (ex) { authorId = ex.id; authorMap.set(nb.authorSlug, ex.id) }
          else { console.error(`  ✗ author: ${ae.message}`); continue }
        } else {
          authorId = newAuthor.id
          authorMap.set(nb.authorSlug, newAuthor.id)
        }
      }

      const { data: newBook, error: be } = await supabase.from('books').insert({
        title: nb.title, slug: nb.slug,
        original_language: nb.language,
        first_published_year: nb.publishYear,
        genres: nb.genres, ai_drafted: false,
      }).select('id').single()
      if (be) { console.error(`  ✗ book: ${be.message}`); continue }

      bookId = newBook.id
      existingSlugs.add(nb.slug)
      await supabase.from('book_authors').insert({ book_id: bookId, author_id: authorId })
      console.log(`  ✓ book created (id:${bookId})`)
    } else {
      const { data: existing } = await supabase.from('books').select('id').eq('slug', nb.slug).single()
      bookId = existing?.id ?? null
    }

    if (!bookId) { console.error(`  ✗ no book id`); continue }

    for (const ban of nb.bans) {
      const { data: existingBan } = await supabase.from('bans')
        .select('id').eq('book_id', bookId).eq('country_code', ban.countryCode).limit(1)
      if (existingBan?.length) { console.log(`  [${ban.countryCode}] ban already exists`); continue }

      const scopeId = scopeMap.get(ban.scopeSlug)
      if (!scopeId) { console.log(`  Unknown scope: ${ban.scopeSlug}`); continue }

      const { data: newBan, error: banErr } = await supabase.from('bans').insert({
        book_id: bookId, country_code: ban.countryCode, scope_id: scopeId,
        action_type: ban.actionType, status: ban.status,
        year_started: ban.yearStarted, year_ended: ban.yearEnded,
        institution: ban.institution, actor: ban.actor, description: ban.description,
      }).select('id').single()
      if (banErr) { console.error(`  ✗ ban: ${banErr.message}`); continue }

      for (const rSlug of ban.reasonSlugs) {
        const rId = reasonMap.get(rSlug)
        if (rId) await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: rId })
      }
      console.log(`  ✓ [${ban.countryCode}] ban written`)
    }
  }

  console.log(`\nDone.${!APPLY ? '\nDRY-RUN — add --apply to write.' : ''}`)
}

main().catch(e => { console.error(e); process.exit(1) })
