/**
 * Round 3: 20 additional countries — descriptions and new books.
 * Covers: MX, NG, HU, MM, AE, YU, KE, AL, DD, BG, AF, QA, ZW, NL, AT, SE, BD, GT, ET, JO
 * Plus improvements to: PH, NO
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-wikipedia-countries-r3.ts
 *   npx tsx --env-file=.env.local scripts/import-wikipedia-countries-r3.ts --apply
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

const COUNTRY_UPDATES: { code: string; name: string; mode: 'new' | 'improve'; description: string }[] = [

  {
    code: 'MX', name: 'Mexico', mode: 'new',
    description: `Mexico's censorship history stretches from the Spanish colonial Inquisition (established in New Spain in 1569) through post-revolutionary press controls and the authoritarian one-party rule of the PRI (1929–2000). Colonial authorities burned Maya codices and seized over 1,500 books from private libraries for the Holy Office. Under 20th-century authoritarian rule, the Tlatelolco massacre of 1968 was heavily censored, and the PRI managed press coverage through financial dependence on state advertising. Today Mexico faces a severe press freedom crisis driven not by formal state banning but by cartel violence and government intimidation: the country consistently ranks among the world's most dangerous for journalists, with dozens killed or disappeared each year.`,
  },

  {
    code: 'NG', name: 'Nigeria', mode: 'new',
    description: `Nigeria's censorship history is shaped by decades of military rule (1966–1979, 1983–1999), during which publications critical of the government were banned and journalists imprisoned. Wole Soyinka — the first African Nobel laureate in Literature — was detained without charge for two years (1967–1969) during the Biafran Civil War. Under Sani Abacha's dictatorship (1993–1998), independent newspapers were shut down and journalists prosecuted. Writer and activist Ken Saro-Wiwa, who had campaigned against oil pollution in Ogoniland, was executed by the regime in 1995 following a widely condemned trial; nine other activists were killed alongside him. Post-democratisation Nigeria has strengthened press freedom protections, though laws criminalising criticism of the military remain.`,
  },

  {
    code: 'HU', name: 'Hungary', mode: 'new',
    description: `Hungary under Communist rule (1949–1989) maintained comprehensive censorship through the party's Agitprop committee. The 1956 Revolution briefly opened cultural expression before Soviet military intervention restored repression. Writers such as György Konrád and Miklós Haraszti circulated work through underground samizdat networks; Haraszti's study of factory life, *A Worker in a Worker's State*, was banned and he was prosecuted. The peaceful democratic transition of 1989 brought full press freedom. Under Viktor Orbán's government (2010–present), however, media ownership has concentrated significantly in government-allied hands, academic institutions have been pressured, gender studies programmes have been eliminated from universities, and independent newsrooms have been systematically bought out or forced to close.`,
  },

  {
    code: 'MM', name: 'Myanmar', mode: 'new',
    description: `Burma (Myanmar) had one of Asia's freest presses in the 1950s, with 30 daily newspapers, before the 1962 military coup imposed strict censorship. The Press Scrutiny and Registration Division required pre-publication approval of all printed materials for fifty years until it was finally abolished in 2012. The democratic transition of 2010–2021 expanded press freedom significantly. The February 2021 military coup reversed these gains: all independent newspapers were shut down, broadcasting licences revoked, and journalists faced imprisonment under laws targeting "spreading false news." Reporters face prison sentences measured in years for covering military activities or abuses.`,
  },

  {
    code: 'AE', name: 'United Arab Emirates', mode: 'new',
    description: `The United Arab Emirates restricts freedom of expression under cybercrime laws, national security legislation, and blasphemy provisions that prohibit criticism of the government, royal families, or Islam. Internet content is heavily filtered, with hundreds of thousands of websites blocked. Books and publications touching on LGBT themes, political criticism, or content inconsistent with Islamic values are routinely banned from the country's market. Annual book fairs exclude such titles. The UAE ranked 148th of 180 countries on the 2022 Reporters Without Borders Press Freedom Index. Poet Ahmad Mansoor al-Rashid, who advocated for democratic reform, was sentenced to fifteen years in prison in 2017; academic Matthew Hedges was sentenced to life for espionage in 2018 before a diplomatic pardon.`,
  },

  {
    code: 'YU', name: 'Yugoslavia', mode: 'new',
    description: `Socialist Yugoslavia under Josip Broz Tito maintained state censorship while maintaining greater cultural openness than Soviet bloc countries due to its non-aligned stance. After the Tito–Stalin split in 1948, Stalinist-aligned writers and intellectuals were suppressed; later, nationalist and liberal voices faced periodic crackdowns. Milovan Đilas — once one of Tito's closest associates — was imprisoned for political writings and his book *The New Class* (1957), a critique of communist bureaucracy, was banned domestically. The "praxis school" philosophers were suppressed in the 1970s. After Yugoslavia's dissolution in the 1990s, successor regimes, particularly Serbia under Slobodan Milošević, engaged in wartime propaganda and censorship of opposition media.`,
  },

  {
    code: 'KE', name: 'Kenya', mode: 'new',
    description: `Kenya's censorship history spans colonial-era restrictions on African nationalist literature through the authoritarian single-party rule of Jomo Kenyatta and Daniel arap Moi (1978–2002). The Kenya Films and Stage Plays Act 1962 and the Books and Newspapers Act gave authorities broad powers to suppress critical publications. Ngũgĩ wa Thiong'o — Kenya's most internationally celebrated novelist — was detained without trial for a year (1977–1978) after his Gĩkũyũ-language play *Ngaahika Ndeenda* was deemed subversive; he later went into exile and wrote *Detained: A Writer's Prison Diary*. Under Moi, opposition literature circulated clandestinely. Post-2002 Kenya has substantially liberalised, though some political and religious speech remains restricted and defamation laws have been used against journalists.`,
  },

  {
    code: 'AL', name: 'Albania', mode: 'new',
    description: `Albania under Enver Hoxha's communist regime (1944–1985) operated one of the world's most extreme censorship systems. After successive breaks with Yugoslavia (1948), the Soviet Union (1961), and China (1978), the country was almost entirely cut off from all foreign cultural influence. Religious texts were destroyed when Albania declared itself the world's first officially atheist state in 1967. Entire categories of literature — pre-communist Albanian writing, Western modernism, religious works — were banned, and their possession could mean imprisonment or death. Authors who deviated from socialist realism faced persecution. Ismail Kadare, Albania's most internationally recognised writer, navigated these dangers through carefully coded allegorical fiction and eventually defected to France in 1990. The fall of communism in 1991 ended formal censorship.`,
  },

  {
    code: 'DD', name: 'East Germany (DDR)', mode: 'new',
    description: `East Germany's censorship apparatus required all published works to receive approval from the Main Administration for Publishing and Book Trade, which rejected approximately 250 manuscripts per year from around 600 submissions. Beginning in 1946, the regime published lists of books to be removed from libraries (*Liste der auszusondernden Literatur*). Topics systematically excluded included criticism of communism, discussion of the Berlin Wall or escape attempts, Western political ideas, and LGBT content. Writers who published abroad without permission faced prosecution. Singer-songwriter Wolf Biermann's citizenship was revoked after a 1976 West German concert tour, prompting a mass protest by East German intellectuals. Novelist Reiner Kunze was forced to publish his collection *Die wunderbaren Jahre* in West Germany before emigrating. Underground samizdat circulated among trusted readers.`,
  },

  {
    code: 'BG', name: 'Bulgaria', mode: 'new',
    description: `Bulgaria under communist rule (1946–1989) maintained state control over all publications through the Committee on Printing and Publishing. Works were required to conform to socialist realism, and the regime suppressed religious authors, nationalist writers, and critics of the party. Writers who published abroad or produced samizdat faced imprisonment or exile. The most famous case is Georgi Markov, a dissident Bulgarian writer working for the BBC World Service in London; in 1978 he was assassinated on Waterloo Bridge when an agent used a specially engineered umbrella to inject a ricin pellet into his leg — one of the communist world's most notorious targeted killings of a writer. The 1989 transition ended formal censorship, and Bulgaria today has a substantially free press, though media independence remains a concern.`,
  },

  {
    code: 'AF', name: 'Afghanistan', mode: 'new',
    description: `Afghanistan has experienced cycles of extreme censorship under successive regimes. The Soviet-backed Democratic Republic (1978–1992) suppressed anti-communist and Islamic content. The Taliban's first rule (1996–2001) banned music, film, and virtually all secular and non-Islamic literature; women's education — including access to books — was completely prohibited. Following the 2001 US-led intervention, press freedom expanded dramatically, with independent media flourishing. The Taliban's return to power in August 2021 has resulted in renewed suppression: women's education has been banned, girls' schoolbooks and women's publications eliminated, and independent media has been largely shut down. Publishers and journalists have fled the country.`,
  },

  {
    code: 'QA', name: 'Qatar', mode: 'new',
    description: `Qatar restricts freedom of expression under laws that prohibit criticism of the government, the ruling Al Thani family, and Islam. The government controls the majority of domestic media and bans content deemed indecent, blasphemous, or politically sensitive. Poet Muhammad ibn al-Dheeb al-Ajami (also known as Ibn Dheeb) was sentenced to fifteen years in prison in 2012 for poems deemed insulting to the emir and inciting to overthrow the government before being pardoned in 2016. Books and publications on LGBT themes, political dissent, or content contrary to Islamic values are systematically excluded from Qatar's market. Qatar ranks near the bottom of international press freedom indices.`,
  },

  {
    code: 'ZW', name: 'Zimbabwe', mode: 'new',
    description: `Zimbabwe under Robert Mugabe's ZANU-PF government (1980–2017) increasingly restricted press freedom, particularly after 2000 when opposition to land redistribution policies intensified. The Access to Information and Protection of Privacy Act 2002 (AIPPA) required media registration and empowered authorities to close independent publications. *The Daily News* — the country's largest independent newspaper — was shut down. Journalists faced arrest under laws targeting "publishing false news." Works by critical journalists and writers were suppressed, and coverage of electoral fraud, land violence, and human rights abuses was systemically restricted. Post-Mugabe Zimbabwe has seen some improvement in press freedom, though independent journalism remains constrained by legal and economic pressures.`,
  },

  {
    code: 'NL', name: 'Netherlands', mode: 'new',
    description: `The Netherlands has historically been one of Europe's most liberal publishing environments, serving since the 17th century as a refuge for books banned elsewhere — works by Descartes, Locke, Spinoza, and Bayle were first published in Amsterdam or other Dutch cities. Censorship was most active during the Nazi occupation (1940–1945) and briefly during post-war de-Nazification. The post-war constitutional framework strongly protects freedom of expression. Some prosecutions for Holocaust denial and incitement to racial hatred (*groepsbelediging*) have occurred under Dutch law. The 2004 murder of filmmaker Theo van Gogh and related controversies about *Submission*, a film about violence against women in Islam, provoked national debate about the limits of free expression. The Netherlands consistently ranks at the top of global press freedom indices.`,
  },

  {
    code: 'AT', name: 'Austria', mode: 'new',
    description: `Austria's post-war framework prohibits Nazi symbols, Holocaust denial, and incitement under the Verbotsgesetz 1945, which has been used to restrict publications glorifying the Nazi era or denying the genocide. Holocaust denier David Irving was convicted and sentenced to three years in prison in Austria in 2006. Austria's literary tradition is rich, and the country prosecuted playwright and novelist Peter Handke's early works for obscenity in the 1960s. The country generally maintains strong press freedom protections, though defamation suits against journalists and critics of far-right political figures have raised concerns. Austria ranks consistently among the top countries in global press freedom indices.`,
  },

  {
    code: 'SE', name: 'Sweden', mode: 'new',
    description: `Sweden has one of the world's oldest and strongest legal protections for press freedom: the Freedom of the Press Act of 1766 codified the right to publish and prohibited government censorship, and is still in force today as part of Sweden's constitutional law. Sweden abolished blasphemy laws in 1970 and rarely bans books, though prosecutions for incitement to racial hatred (*hets mot folkgrupp*) have occurred under the Swedish Penal Code. The publication of Salman Rushdie's *The Satanic Verses* was defended vigorously in Sweden during the 1989 fatwa crisis. Sweden consistently ranks in the top tier of global press freedom indices, though recent controversies around Quran burnings and their diplomatic consequences have raised questions about the boundaries of permitted expression.`,
  },

  {
    code: 'BD', name: 'Bangladesh', mode: 'new',
    description: `Bangladesh restricts freedom of expression under the Digital Security Act 2018, which criminalises online content deemed defamatory, "tarnishing the image of the nation," or contrary to religious sensibilities, with sentences up to 14 years imprisonment. Secular and atheist bloggers have been murdered by Islamist extremists, and the government has arrested bloggers under blasphemy-adjacent provisions rather than prosecuting the perpetrators. Novelist and activist Taslima Nasrin was forced into exile in 1994 after her novel *Lajja* — addressing communal violence against Hindus — was banned and death threats issued by religious groups; she has been unable to return. Bangladesh's book fairs exclude titles deemed offensive to Islam, and publishers practise significant self-censorship.`,
  },

  {
    code: 'GT', name: 'Guatemala', mode: 'new',
    description: `Guatemala's most intense censorship came during its 36-year civil war (1960–1996), during which military governments suppressed all forms of dissent. The US-backed coup against elected president Jacobo Árbenz in 1954 initiated decades of authoritarian rule that drove writers and intellectuals into exile or silence. Works addressing indigenous rights, land reform, US intervention, or the documented atrocities of state violence were banned or self-censored. Nobel laureate Rigoberta Menchú's autobiography, *I, Rigoberta Menchú* (1983), documented the experiences of Maya people during the civil war and was initially suppressed in Guatemala. The 1996 peace accords brought significant press freedoms, though journalists covering organised crime and corruption continue to face violence.`,
  },

  {
    code: 'ET', name: 'Ethiopia', mode: 'new',
    description: `Ethiopia under the Derg military junta (1974–1991) and subsequently under the EPRDF government (1991–2018) maintained significant press restrictions. The Anti-Terrorism Proclamation 2009 was used extensively to imprison journalists and bloggers; Ethiopia was at one point the world's second-largest jailer of journalists. Authors writing on sensitive ethnic, political, or religious topics faced censorship or prosecution. Prime Minister Abiy Ahmed's 2018 reforms initially expanded press freedom substantially, but the civil war in Tigray (2020–2022) led to severe information suppression, the blocking of internet access in conflict regions, and renewed media restrictions. Ethiopian journalists and international correspondents have been detained or expelled for reporting on the conflict.`,
  },

  {
    code: 'JO', name: 'Jordan', mode: 'new',
    description: `Jordan restricts publications through the Press and Publications Law, which requires media registration and prohibits content deemed offensive to the king or royal family, Islam, or national unity. Books and publications are subject to review by the General Intelligence Directorate. Works on political dissent, LGBT topics, religious criticism, or content perceived as destabilising are banned or not distributed. The country's 1952 constitution guarantees freedom of opinion and expression, but these protections are qualified by laws on public order and official dignity. Jordan ranks consistently around 130th–140th on international press freedom indices, though its publishing environment is more permissive than several of its neighbours in the region.`,
  },

  // ── Improvements to countries with existing descriptions ─────────────────────

  {
    code: 'PH', name: 'Philippines', mode: 'improve',
    description: `Under Spanish colonial rule, Philippine authorities banned Noli Me Tángere and El filibusterismo by José Rizal — novels critical of the colonial government and the Catholic Church — helping spark the Philippine Revolution of 1896. During the American colonial period, publications advocating independence were prosecuted under the Sedition Act and Criminal Libel Act introduced in 1901. During Ferdinand Marcos's martial law (1972–1986), all publications required approval from the Department of Public Information; books including Primitivo Mijares's *The Conjugal Dictatorship of Ferdinand and Imelda Marcos* and Carmen Navarro Pedrosa's *The Untold Story of Imelda Marcos* were banned. The Philippines today has a constitutionally protected free press, though journalists and authors face ongoing pressure from political libel suits and, in some regions, violence from political actors and organised crime.`,
  },

  {
    code: 'NO', name: 'Norway', mode: 'improve',
    description: `Norway has historically restricted publications on grounds of obscenity, with Lady Chatterley's Lover, Lolita, and works by Henry Miller banned for varying periods in the 20th century. The first edition of *Lady Chatterley's Lover* was banned from 1928; Nabokov's *Lolita* was banned briefly in the 1950s before being lifted. Norway today consistently ranks among the top countries in global press freedom indices and has no formal book censorship regime. The country has maintained strong protections for literary freedom and has been a refuge for writers facing censorship elsewhere, including significant support for Salman Rushdie following the 1989 fatwa.`,
  },
]

// ── New books and bans from this round's research ─────────────────────────────

interface NewBan {
  bookSlug: string; countryCode: string; scopeSlug: string
  actionType: string; status: string; yearStarted: number | null
  yearEnded: number | null; institution: string | null; actor: string | null
  description: string | null; reasonSlugs: string[]
}

const NEW_BANS: NewBan[] = [
  // Philippines - Marcos era books
  {
    bookSlug: 'the-conjugal-dictatorship-of-ferdinand-and-imelda-marcos',
    countryCode: 'PH', scopeSlug: 'government', actionType: 'banned',
    status: 'historical', yearStarted: 1976, yearEnded: 1986,
    institution: 'Department of Public Information (Philippines)',
    actor: null,
    description: 'Banned during Ferdinand Marcos\'s martial law for its exposé of the Marcos regime. The author, former Marcos aide Primitivo Mijares, disappeared and was presumed killed after defecting.',
    reasonSlugs: ['political'],
  },
]

interface NewBook {
  title: string; slug: string; authorName: string; authorSlug: string
  language: string; publishYear: number; genres: string[]
  bans: Omit<NewBan, 'bookSlug'>[]
}

const NEW_BOOKS: NewBook[] = [
  {
    title: 'The Conjugal Dictatorship of Ferdinand and Imelda Marcos',
    slug: 'the-conjugal-dictatorship-of-ferdinand-and-imelda-marcos',
    authorName: 'Primitivo Mijares',
    authorSlug: 'primitivo-mijares',
    language: 'en', publishYear: 1976, genres: ['non-fiction'],
    bans: [{
      countryCode: 'PH', scopeSlug: 'government', actionType: 'banned',
      status: 'historical', yearStarted: 1976, yearEnded: 1986,
      institution: 'Department of Public Information (Philippines)',
      actor: null,
      description: 'Banned during Marcos martial law for exposing the regime. The author defected and disappeared; his son was murdered. Banned copies were smuggled into the Philippines.',
      reasonSlugs: ['political'],
    }],
  },
  {
    title: 'I, Rigoberta Menchú',
    slug: 'i-rigoberta-menchu',
    authorName: 'Rigoberta Menchú',
    authorSlug: 'rigoberta-menchu',
    language: 'es', publishYear: 1983, genres: ['memoir', 'non-fiction'],
    bans: [{
      countryCode: 'GT', scopeSlug: 'government', actionType: 'banned',
      status: 'historical', yearStarted: 1983, yearEnded: null,
      institution: 'Guatemalan military government',
      actor: null,
      description: 'Suppressed in Guatemala for documenting atrocities against Maya communities during the civil war. Menchú was awarded the Nobel Peace Prize in 1992 partly for this testimony. The book\'s accuracy was later contested in an academic controversy.',
      reasonSlugs: ['political'],
    }],
  },
  {
    title: 'Lajja',
    slug: 'lajja',
    authorName: 'Taslima Nasrin',
    authorSlug: 'taslima-nasrin',
    language: 'bn', publishYear: 1993, genres: ['literary-fiction'],
    bans: [{
      countryCode: 'BD', scopeSlug: 'government', actionType: 'banned',
      status: 'historical', yearStarted: 1993, yearEnded: null,
      institution: 'Bangladesh government',
      actor: null,
      description: 'Banned in Bangladesh shortly after publication for its depiction of anti-Hindu communal violence following the demolition of the Babri Mosque. Religious groups called for Nasrin\'s execution; she fled Bangladesh in 1994 and has lived in exile since.',
      reasonSlugs: ['religious', 'political'],
    }],
  },
  {
    title: 'The New Class',
    slug: 'the-new-class',
    authorName: 'Milovan Đilas',
    authorSlug: 'milovan-dilas',
    language: 'sr', publishYear: 1957, genres: ['non-fiction'],
    bans: [{
      countryCode: 'YU', scopeSlug: 'government', actionType: 'banned',
      status: 'historical', yearStarted: 1957, yearEnded: null,
      institution: 'Yugoslav government',
      actor: null,
      description: 'Banned in Yugoslavia for its critique of the communist party bureaucracy as a new privileged class. Published in the United States, it was circulated clandestinely in Yugoslavia. Đilas was tried and imprisoned for writing it.',
      reasonSlugs: ['political'],
    }],
  },
  {
    title: 'Detained: A Writer\'s Prison Diary',
    slug: 'detained-a-writers-prison-diary',
    authorName: 'Ngũgĩ wa Thiong\'o',
    authorSlug: 'ngugi-wa-thiongo',
    language: 'en', publishYear: 1981, genres: ['memoir', 'non-fiction'],
    bans: [{
      countryCode: 'KE', scopeSlug: 'government', actionType: 'banned',
      status: 'historical', yearStarted: 1982, yearEnded: null,
      institution: 'Kenya government under Daniel arap Moi',
      actor: null,
      description: 'Banned in Kenya for its account of Ngũgĩ\'s detention without trial in 1977–1978 under the Kenyatta government. The book detailed the political persecution of writers under the authoritarian single-party state.',
      reasonSlugs: ['political'],
    }],
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = adminClient()
  console.log(`\n── import-wikipedia-countries-r3 (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  const { data: scopes }  = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  const scopeMap  = new Map((scopes  ?? []).map(s => [s.slug, s.id as number]))
  const reasonMap = new Map((reasons ?? []).map(r => [r.slug, r.id as number]))

  // ── Country descriptions ───────────────────────────────────────────────────

  console.log(`=== Country descriptions (${COUNTRY_UPDATES.length}) ===\n`)

  for (const upd of COUNTRY_UPDATES) {
    const { data: existing } = await supabase.from('countries')
      .select('description').eq('code', upd.code).single()
    const isNew = !existing?.description

    if (upd.mode === 'new' && !isNew) {
      console.log(`[${upd.code}] SKIP — already has description`)
      continue
    }

    console.log(`[${upd.code}] ${upd.name}: ${isNew ? 'ADDING' : 'IMPROVING'}`)

    if (APPLY) {
      const { error } = await supabase.from('countries')
        .update({ description: upd.description }).eq('code', upd.code)
      if (error) console.error(`  ✗ ${error.message}`)
      else       console.log(`  ✓ written`)
    }
  }

  // ── New bans for existing books ────────────────────────────────────────────

  console.log(`\n=== New bans for existing books (${NEW_BANS.length}) ===\n`)

  for (const ban of NEW_BANS) {
    const { data: books } = await supabase.from('books')
      .select('id, title').eq('slug', ban.bookSlug).limit(1)
    const book = books?.[0]
    if (!book) { console.log(`Book not found: ${ban.bookSlug}`); continue }
    const { data: existing } = await supabase.from('bans')
      .select('id').eq('book_id', book.id).eq('country_code', ban.countryCode).limit(1)
    if (existing?.length) { console.log(`[${ban.countryCode}] ban exists: ${book.title}`); continue }
    const scopeId = scopeMap.get(ban.scopeSlug)
    if (!scopeId) { console.log(`Unknown scope: ${ban.scopeSlug}`); continue }
    console.log(`[${ban.countryCode}] "${book.title}"`)
    if (APPLY) {
      const { data: newBan, error: e } = await supabase.from('bans').insert({
        book_id: book.id, country_code: ban.countryCode, scope_id: scopeId,
        action_type: ban.actionType, status: ban.status, year_started: ban.yearStarted,
        year_ended: ban.yearEnded, institution: ban.institution, actor: ban.actor, description: ban.description,
      }).select('id').single()
      if (e) { console.error(`  ✗ ${e.message}`); continue }
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
    console.log(`"${nb.title}": ${inDb ? 'already in DB' : 'NEW BOOK'}`)
    if (!APPLY) { nb.bans.forEach(b => console.log(`  [${b.countryCode}] ${b.yearStarted ?? '?'}`)); continue }

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
        } else { authorId = newAuthor.id; authorMap.set(nb.authorSlug, newAuthor.id) }
      }
      const { data: newBook, error: be } = await supabase.from('books').insert({
        title: nb.title, slug: nb.slug, original_language: nb.language,
        first_published_year: nb.publishYear, genres: nb.genres, ai_drafted: false,
      }).select('id').single()
      if (be) { console.error(`  ✗ book: ${be.message}`); continue }
      bookId = newBook.id; existingSlugs.add(nb.slug)
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
        action_type: ban.actionType, status: ban.status, year_started: ban.yearStarted,
        year_ended: ban.yearEnded, institution: ban.institution, actor: ban.actor, description: ban.description,
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
