/**
 * Wikipedia-sourced country description updates and missing ban additions.
 *
 * Sources: Wikipedia censorship articles for NZ, MY, IL, VN, PK, CA, SG, RO, IT + others.
 * - Writes descriptions for 8 countries that have none
 * - Improves existing descriptions where Wikipedia provided richer detail
 * - Adds book bans that Wikipedia explicitly documents
 * - Adds new books to the DB where Wikipedia named specific works
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-wikipedia-countries.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/import-wikipedia-countries.ts --apply
 */

import OpenAI from 'openai'
import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

// ── Country description updates ────────────────────────────────────────────────
// Format: { code, name, mode: 'new' | 'improve', description }
// 'new'     → country has no description yet
// 'improve' → replace existing description with richer version

const COUNTRY_UPDATES: { code: string; name: string; mode: 'new' | 'improve'; description: string }[] = [

  // ── Countries with NO existing description ─────────────────────────────────

  {
    code: 'NZ',
    name: 'New Zealand',
    mode: 'new',
    description: `New Zealand has one of the most documented book censorship histories in the English-speaking world. Under the Indecent Publications Act 1910, customs officers applied the strict Hicklin Rule to seize materials deemed indecent. The 1963 Act replaced this with a more nuanced five-member expert Tribunal empowered to weigh literary merit. Works such as *All Quiet on the Western Front* were banned as early as 1930 as anti-war propaganda; *Lolita* was banned in 1960 before being reclassified in 1964 after literary merit hearings. By 2011, the Classification Office had banned 1,319 titles and placed a further 728 under restriction. The country made international news in 2015 when *Into the River* by Ted Dawe became the first novel banned in New Zealand in decades after a conservative-group complaint; the restriction was ultimately lifted. In 2019, the chief censor moved rapidly to classify the Christchurch mosque shooter's manifesto as objectionable, preventing its circulation.`,
  },

  {
    code: 'MY',
    name: 'Malaysia',
    mode: 'new',
    description: `Malaysia's censorship regime is governed primarily by the Printing Presses and Publications Act 1984, which requires annual government permits for all print publications and grants the Home Ministry broad powers to ban any material deemed a threat to public order or Islamic values. Hundreds of books have been prohibited, including works by Salman Rushdie, Chinua Achebe, and Iris Chang, as well as academic titles and translations of Islamic texts deemed to promote non-orthodox interpretations. The 1987 crackdown known as Operation Lalang saw four major newspapers suspended and over a hundred activists detained. Books on homosexuality, criticism of the Prophet Muhammad, and content seen as undermining national unity are routinely refused. In some states, non-Muslims face legal penalties for using Islamic religious terms. Despite constitutional guarantees of free expression, Malaysia ranked 146th of 180 countries on the 2016 World Press Freedom Index.`,
  },

  {
    code: 'IL',
    name: 'Israel',
    mode: 'new',
    description: `Israel's censorship operates primarily through military censors who require journalists to submit defence-related reporting for pre-publication review. During the Israeli military occupation of the West Bank and Gaza, Israeli authorities banned approximately 10,000 books by 1991, including Palestinian cultural, political, and educational works, alongside restrictions on fax machines and other communication technologies. The Oslo Accords significantly relaxed these restrictions in the occupied territories. Within Israel proper, the country has strong constitutional free expression protections, though a small number of works dealing with the Israeli–Arab conflict, Palestinian perspectives, or sensitive historical events have faced legal challenges. Arab-language publications have historically faced additional scrutiny.`,
  },

  {
    code: 'VN',
    name: 'Vietnam',
    mode: 'new',
    description: `Vietnam's press and publishing are tightly controlled by the Communist Party of Vietnam, which owns and directs all major media. Following the 1975 reunification, a "cultural purification" campaign destroyed vast quantities of books from the southern republic. In 2002, Ho Chi Minh City authorities incinerated 7.6 tonnes of books labelled "culturally poisonous." Writers who challenge official narratives face harassment, arrest, and exile: novelist Dương Thu Hương was expelled from the Communist Party in 1990 and arrested in 1991, and most of her works remain banned. Bảo Ninh's acclaimed *The Sorrow of War* won the Vietnam Writers' Association Prize in 1991 before being suppressed as "reactionary"; publications were restricted from 1993 to 2005. Vietnam ranked 174th of 180 countries on the 2021 Reporters Without Borders Press Freedom Index.`,
  },

  {
    code: 'PK',
    name: 'Pakistan',
    mode: 'new',
    description: `Pakistan's censorship is shaped by its blasphemy laws — among the world's most severe — which impose penalties including life imprisonment for defiling the Quran and death for defaming the Prophet Muhammad. The government blocks hundreds of thousands of internet URLs and restricts publications deemed blasphemous, obscene, or anti-state; by 2019 some 900,000 URLs had been blocked. Foreign books require government approval before reprinting. Journalists and writers who criticise the military face intimidation, criminal prosecution, and violence. Pakistan ranked 145th of 180 countries on the 2020 Reporters Without Borders Press Freedom Index, and human rights organisations consistently document the use of blasphemy charges to suppress dissent and minority religious voices.`,
  },

  {
    code: 'CA',
    name: 'Canada',
    mode: 'new',
    description: `Canada has historically restricted publication less through explicit state bans than through customs seizures and obscenity law. During World War I, the War Measures Act enabled banning of approximately 250 publications, particularly Bolshevik and socialist materials. Quebec's 1937 Padlock Law suppressed Communist publications until the Supreme Court struck it down in 1957 as unconstitutional. The 1949 Fulton Bill criminalised the distribution of crime comics. Canada Customs retained broad border-seizure authority through much of the 20th century; a celebrated 1997 Supreme Court case involving Little Sisters Book and Art Emporium confirmed that Customs had systematically targeted LGBT bookstores with discriminatory seizures. Today Canada has strong constitutional free expression protections, though Holocaust denial was criminalised in 2022 and child sexual abuse material in text form was prohibited by statute in 2005.`,
  },

  {
    code: 'SG',
    name: 'Singapore',
    mode: 'new',
    description: `Singapore operates a multi-tier media classification system under the Films Act 1981 and the Infocomm Media Development Authority, with content rated from G through R21 or denied classification entirely. Material promoting homosexuality, challenging government authority, or depicting ethnic and religious conflict is routinely restricted or prohibited. Publishers and journalists practise extensive self-censorship given Singapore's strict defamation laws; news websites covering Singapore must be licensed, post a S$50,000 performance bond, and remove government-flagged content within 24 hours. Music and recordings — including Janet Jackson albums and Katy Perry songs — have been banned from broadcast for "homosexual and sexually explicit themes." A documentary about political exiles was denied classification in 2014 for allegedly containing "distorted accounts." Singapore consistently ranks near the bottom of global press freedom indices.`,
  },

  {
    code: 'RO',
    name: 'Romania',
    mode: 'new',
    description: `Romania's most comprehensive censorship came during the Communist era (1947–1989). Under Nicolae Ceaușescu's increasingly authoritarian rule, the Censorship Directorate reviewed all publications for ideological compliance. Western literature, dissident writing, works touching on the Hungarian minority, and honest accounts of the Holocaust on Romanian territory were systematically suppressed. Writers faced imprisonment or internal exile for works deemed subversive. After the 1989 Revolution, Romania's post-communist Constitution explicitly prohibits censorship. The country has since developed a largely free press, though political pressure on public media, ownership concentration, and self-censorship remain concerns highlighted by press freedom organisations, and Romania's ranking on press freedom indices has declined in recent years.`,
  },

  // ── Countries with existing descriptions — enriched with Wikipedia specifics ─

  {
    code: 'IT',
    name: 'Italy',
    mode: 'improve',
    description: `Italy's most intense period of literary censorship came under Mussolini's Fascist dictatorship (1925–1943). The Ministry of Popular Culture (MinCulPop) exercised comprehensive control over the press, literature, radio, theatre, and cinema; the Italian press self-censored extensively under its direct pressure. A 1930 decree formally banned the distribution of Marxist, Socialist, and Anarchist books, and by 1938 fascist militias were staging public bonfires of forbidden titles while libraries purged works on Jewish culture, freemasonry, and political opposition. Anti-war novels such as *All Quiet on the Western Front* were banned alongside their film adaptations. The Catholic Church's Index of Prohibited Books (enforced until 1966) further shaped what publishers would risk printing. Post-war Italy's 1948 Constitution (Article 21) guarantees press freedom, though a morality clause was added under Catholic pressure. Film censorship was only formally abolished in April 2021. The Berlusconi era (1994–2011) raised international concern over media concentration and political influence at the state broadcaster RAI.`,
  },

  {
    code: 'DE',
    name: 'Germany',
    mode: 'improve',
    description: `Germany's most dramatic episode of book censorship came on 10 May 1933, when Nazi student groups and party officials staged coordinated public burnings in Berlin and across Germany, destroying at least 25,000 books — one-third of total library holdings in Berlin alone. Targets included works by Jewish authors, Marxists, pacifists, and advocates of sexual reform, among them Heinrich Heine, Sigmund Freud, Karl Marx, Magnus Hirschfeld, and Erich Maria Remarque. The Nazi regime's censorship authority extended to banning nearly all works by Jews, communists, or political opponents from publication, sale, or library circulation. Post-war West Germany abolished formal censorship but introduced restrictions on materials promoting Nazism, Holocaust denial, and hatred. East Germany maintained state control through the Office of Head Administration for Publishing, which rejected roughly 250 manuscripts per year. Modern Germany ranks consistently high in global press freedom indices while maintaining targeted restrictions on hate speech, incitement, and Nazi propaganda.`,
  },

  {
    code: 'JP',
    name: 'Japan',
    mode: 'improve',
    description: `Japan's prewar and wartime governments (1930s–1945) imposed strict censorship on publications deemed subversive, pacifist, or contrary to militarist ideology; the 1941 National Mobilization Law revision eliminated press freedom entirely. Under Allied occupation (1945–1952), the Civil Censorship Detachment monitored and suppressed material critical of the occupation itself. Postwar Japan established strong free expression protections under the 1947 Constitution, but Article 175 of the Criminal Code — prohibiting distribution of obscene materials — has been used to restrict literary works, most famously in the 1957 Chatterley Case, in which translator Sei Itō and editor Kyujiro Koyama were convicted by the Supreme Court for publishing a Japanese translation of D. H. Lawrence's *Lady Chatterley's Lover*. The tension between Article 21 (freedom of expression) and Article 175 continues to shape Japanese publishing, particularly regarding manga and graphic content.`,
  },
]

// ── New book bans for books already in DB ────────────────────────────────────
// These are bans explicitly documented in Wikipedia articles

interface NewBan {
  bookSlug:     string
  countryCode:  string
  scopeSlug:    string  // school | public_library | prison | government | retail | customs
  actionType:   string
  status:       string
  yearStarted:  number | null
  yearEnded:    number | null
  institution:  string | null
  actor:        string | null
  description:  string | null
  reasonSlugs:  string[]  // political | religious | sexual | obscenity | ...
}

const NEW_BANS: NewBan[] = [
  {
    bookSlug:    'all-quiet-on-the-western-front',
    countryCode: 'IT',
    scopeSlug:   'government',
    actionType:  'banned',
    status:      'historical',
    yearStarted: 1930,
    yearEnded:   1945,
    institution: 'Ministry of Popular Culture (MinCulPop)',
    actor:       null,
    description: 'Banned by the fascist regime alongside the 1930 film adaptation; deemed subversive anti-war propaganda.',
    reasonSlugs: ['political'],
  },
  {
    bookSlug:    'all-quiet-on-the-western-front',
    countryCode: 'NZ',
    scopeSlug:   'customs',
    actionType:  'banned',
    status:      'historical',
    yearStarted: 1930,
    yearEnded:   null,
    institution: 'Comptroller of Customs',
    actor:       null,
    description: 'Banned as anti-war propaganda under the Indecent Publications Act 1910.',
    reasonSlugs: ['political'],
  },
  {
    bookSlug:    'the-origin-of-species',
    countryCode: 'MY',
    scopeSlug:   'government',
    actionType:  'banned',
    status:      'active',
    yearStarted: 2006,
    yearEnded:   null,
    institution: 'Internal Security Ministry',
    actor:       null,
    description: 'The Indonesian-language translation was banned for content deemed incompatible with Islamic beliefs.',
    reasonSlugs: ['religious'],
  },
  {
    bookSlug:    'lady-chatterleys-lover',
    countryCode: 'JP',
    scopeSlug:   'government',
    actionType:  'banned',
    status:      'historical',
    yearStarted: 1950,
    yearEnded:   null,
    institution: 'Supreme Court of Japan',
    actor:       null,
    description: 'The 1950 Japanese translation was prosecuted under Article 175 of the Criminal Code. Translator Sei Itō and editor Kyujiro Koyama were convicted by the Supreme Court in 1957 in the landmark Chatterley Case.',
    reasonSlugs: ['obscenity', 'sexual'],
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

function toSlug(s: string): string {
  return s.toLowerCase()
    .replace(/['''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const NEW_BOOKS: NewBook[] = [
  {
    title:       'The Sorrow of War',
    slug:        'the-sorrow-of-war',
    authorName:  'Bảo Ninh',
    authorSlug:  'bao-ninh',
    language:    'vi',
    publishYear: 1991,
    genres:      ['literary-fiction'],
    bans: [
      {
        countryCode: 'VN',
        scopeSlug:   'government',
        actionType:  'banned',
        status:      'historical',
        yearStarted: 1993,
        yearEnded:   2006,
        institution: 'Communist Party of Vietnam',
        actor:       null,
        description: 'Suppressed as "reactionary" by veterans and party officials who accused it of distorting the military\'s image. Publications were restricted from 1993 to 2005; the restriction was lifted in 2006.',
        reasonSlugs: ['political'],
      },
    ],
  },
  {
    title:       'The Line of Beauty',
    slug:        'the-line-of-beauty',
    authorName:  'Alan Hollinghurst',
    authorSlug:  'alan-hollinghurst',
    language:    'en',
    publishYear: 2004,
    genres:      ['literary-fiction'],
    bans: [
      {
        countryCode: 'MY',
        scopeSlug:   'government',
        actionType:  'banned',
        status:      'active',
        yearStarted: 2014,
        yearEnded:   null,
        institution: 'Home Ministry of Malaysia',
        actor:       null,
        description: 'Banned for promoting homosexuality.',
        reasonSlugs: ['lgbtq'],
      },
    ],
  },
  {
    title:       'The Vagina Monologues',
    slug:        'the-vagina-monologues',
    authorName:  'Eve Ensler',
    authorSlug:  'eve-ensler',
    language:    'en',
    publishYear: 1996,
    genres:      ['literary-fiction'],
    bans: [
      {
        countryCode: 'MY',
        scopeSlug:   'government',
        actionType:  'banned',
        status:      'active',
        yearStarted: null,
        yearEnded:   null,
        institution: 'Home Ministry of Malaysia',
        actor:       null,
        description: 'Banned for sexual content deemed contrary to public morality.',
        reasonSlugs: ['sexual'],
      },
    ],
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = adminClient()

  console.log(`\n── import-wikipedia-countries (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  // Load lookup tables
  const { data: scopes }  = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const scopeMap  = new Map((scopes  ?? []).map(s => [s.slug, s.id as number]))
  const reasonMap = new Map((reasons ?? []).map(r => [r.slug, r.id as number]))

  // ── 1. Country descriptions ─────────────────────────────────────────────────

  console.log(`\n=== Country descriptions (${COUNTRY_UPDATES.length}) ===\n`)

  for (const upd of COUNTRY_UPDATES) {
    const { data: existing } = await supabase.from('countries')
      .select('description').eq('code', upd.code).single()

    const currentDesc = existing?.description ?? null
    const isNew = !currentDesc

    if (upd.mode === 'new' && !isNew) {
      console.log(`[${upd.code}] ${upd.name}: SKIP — already has description`)
      continue
    }

    console.log(`[${upd.code}] ${upd.name}: ${isNew ? 'ADDING' : 'IMPROVING'} description`)
    console.log(`  → ${upd.description.slice(0, 120)}…\n`)

    if (APPLY) {
      const { error } = await supabase.from('countries')
        .update({ description: upd.description })
        .eq('code', upd.code)
      if (error) console.error(`  ✗ ${error.message}`)
      else       console.log(`  ✓ written`)
    }
  }

  // ── 2. New bans for existing books ──────────────────────────────────────────

  console.log(`\n=== New bans for existing books (${NEW_BANS.length}) ===\n`)

  for (const ban of NEW_BANS) {
    // Find book
    const { data: books } = await supabase.from('books')
      .select('id, title').eq('slug', ban.bookSlug).limit(1)
    const book = books?.[0]
    if (!book) { console.log(`[${ban.countryCode}] Book not found: ${ban.bookSlug}`); continue }

    // Check if ban already exists
    const { data: existing } = await supabase.from('bans')
      .select('id').eq('book_id', book.id).eq('country_code', ban.countryCode).limit(1)
    if (existing?.length) {
      console.log(`[${ban.countryCode}] "${book.title}": ban already exists — skip`)
      continue
    }

    const scopeId = scopeMap.get(ban.scopeSlug)
    if (!scopeId) { console.log(`Unknown scope: ${ban.scopeSlug}`); continue }

    console.log(`[${ban.countryCode}] "${book.title}" — ${ban.yearStarted ?? '?'} ${ban.institution ?? ''}`)
    console.log(`  reason: ${ban.reasonSlugs.join(', ')}  status: ${ban.status}`)

    if (APPLY) {
      const { data: newBan, error: banErr } = await supabase.from('bans').insert({
        book_id:      book.id,
        country_code: ban.countryCode,
        scope_id:     scopeId,
        action_type:  ban.actionType,
        status:       ban.status,
        year_started: ban.yearStarted,
        year_ended:   ban.yearEnded,
        institution:  ban.institution,
        actor:        ban.actor,
        description:  ban.description,
      }).select('id').single()

      if (banErr) { console.error(`  ✗ ban: ${banErr.message}`); continue }

      for (const rSlug of ban.reasonSlugs) {
        const reasonId = reasonMap.get(rSlug)
        if (reasonId) {
          await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: reasonId })
        }
      }
      console.log(`  ✓ ban written`)
    }
  }

  // ── 3. New books with bans ───────────────────────────────────────────────────

  console.log(`\n=== New books (${NEW_BOOKS.length}) ===\n`)

  // Load existing books and authors
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
    if (existingSlugs.has(nb.slug)) {
      console.log(`"${nb.title}": already in DB — checking bans…`)
      // Still check/add bans
    } else {
      console.log(`"${nb.title}" by ${nb.authorName}: NEW BOOK`)
    }

    if (!APPLY) {
      nb.bans.forEach(b => console.log(`  [${b.countryCode}] ${b.yearStarted ?? '?'} ${b.institution ?? ''}`))
      continue
    }

    let bookId: number | null = null

    if (!existingSlugs.has(nb.slug)) {
      // Author
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

      // Book
      const { data: newBook, error: be } = await supabase.from('books').insert({
        title: nb.title, slug: nb.slug,
        original_language: nb.language,
        first_published_year: nb.publishYear,
        genres: nb.genres,
        ai_drafted: false,
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
        book_id:      bookId,
        country_code: ban.countryCode,
        scope_id:     scopeId,
        action_type:  ban.actionType,
        status:       ban.status,
        year_started: ban.yearStarted,
        year_ended:   ban.yearEnded,
        institution:  ban.institution,
        actor:        ban.actor,
        description:  ban.description,
      }).select('id').single()

      if (banErr) { console.error(`  ✗ ban: ${banErr.message}`); continue }

      for (const rSlug of ban.reasonSlugs) {
        const reasonId = reasonMap.get(rSlug)
        if (reasonId) {
          await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: reasonId })
        }
      }
      console.log(`  ✓ [${ban.countryCode}] ban written`)
    }
  }

  console.log(`\nDone.${!APPLY ? '\nDRY-RUN — add --apply to write.' : ''}`)
}

main().catch(e => { console.error(e); process.exit(1) })
