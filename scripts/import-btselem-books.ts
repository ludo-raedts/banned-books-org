/**
 * Import B'Tselem / IDF prohibited books — West Bank and Ketziot Prison lists.
 *
 * All 23 book records were previously inserted as stubs. This script:
 *  1. Creates missing authors and links them to books
 *  2. Creates a ban_sources record for the B'Tselem source
 *  3. Creates IL bans for all 23 books (West Bank = scope government, Ketziot = scope prison)
 *  4. Links each ban to the source via ban_source_links
 *  5. Updates book metadata: year, language, description_book, censorship_context
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-btselem-books.ts           # dry-run
 *   npx tsx --env-file=.env.local scripts/import-btselem-books.ts --apply
 *
 * Uncertain metadata flags are printed to console even in dry-run.
 */

import { adminClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')
const supabase = adminClient()

// ── Scope IDs from DB ────────────────────────────────────────────────────────
const SCOPE_GOVERNMENT = 4
const SCOPE_PRISON     = 3

// ── Reason IDs from DB ───────────────────────────────────────────────────────
const REASON_POLITICAL = 2
const REASON_OTHER     = 8

// ── Existing author IDs (confirmed from DB) ──────────────────────────────────
const EXISTING_AUTHORS: Record<string, number> = {
  'Aleksandr Solzhenitsyn': 76,
  'Jack London':            164,
  'Mahmoud Darwish':        530,
}

// ── Author records to create ─────────────────────────────────────────────────
interface AuthorDef {
  display_name:  string
  slug:          string
  birth_year?:   number
  death_year?:   number
  birth_country?: string
  uncertain?:    string  // printed as a warning
}

const AUTHORS_TO_CREATE: AuthorDef[] = [
  { display_name: 'William Shakespeare',      slug: 'william-shakespeare',       birth_year: 1564, death_year: 1616, birth_country: 'GB' },
  { display_name: 'J.R.R. Tolkien',           slug: 'jrr-tolkien',               birth_year: 1892, death_year: 1973, birth_country: 'GB' },
  { display_name: 'Mikhail Sholokhov',         slug: 'mikhail-sholokhov',         birth_year: 1905, death_year: 1984, birth_country: 'RU' },
  { display_name: 'Alexander Fadeyev',         slug: 'alexander-fadeyev',         birth_year: 1901, death_year: 1956, birth_country: 'RU' },
  { display_name: 'Hendrik Willem van Loon',   slug: 'hendrik-willem-van-loon',   birth_year: 1882, death_year: 1944, birth_country: 'NL' },
  { display_name: 'Henri Troyat',              slug: 'henri-troyat',              birth_year: 1911, death_year: 2007, birth_country: 'FR' },
  { display_name: 'Ghassan Kanafani',          slug: 'ghassan-kanafani',          birth_year: 1936, death_year: 1972, birth_country: 'PS' },
  { display_name: 'Isaac Deutscher',           slug: 'isaac-deutscher',           birth_year: 1907, death_year: 1967, birth_country: 'PL' },
  { display_name: 'Danny Rubinstein',          slug: 'danny-rubinstein',          birth_country: 'IL' },
  { display_name: 'Amnon Rubinstein',          slug: 'amnon-rubinstein',          birth_year: 1931, death_year: 2020, birth_country: 'IL' },
  { display_name: 'Ezer Weizman',              slug: 'ezer-weizman',              birth_year: 1924, death_year: 2005, birth_country: 'IL' },
  // Uncertain transliterations — flagged below
  { display_name: 'Alouph Har Even',           slug: 'alouph-har-even',           uncertain: 'Transliteration of Hebrew name uncertain; may appear as "Alouph Hareven" or "Shulamith Hareven"' },
  { display_name: 'P.P. Bartholdy',            slug: 'pp-bartholdy',              uncertain: 'Author identity uncertain; initials only in source. May be a German historian; full name unconfirmed.' },
  { display_name: 'Roger Delorus',             slug: 'roger-delorus',             uncertain: 'Spelling uncertain; may be "Roger Delors" or a transliteration variant. Author otherwise unverified.' },
  { display_name: 'Adnan al-Maluhi',           slug: 'adnan-al-maluhi',           uncertain: 'Transliteration uncertain; Arab-language author identity unverified.' },
  { display_name: 'Hanna Salah',               slug: 'hanna-salah',               uncertain: 'Author identity uncertain; common name with multiple possible attributions. Needs manual verification.' },
  { display_name: 'Anonymous',                 slug: 'anonymous' },
]

// ── Book definitions ──────────────────────────────────────────────────────────
interface BookDef {
  id:                  number
  slug:                string
  title:               string
  authorName:          string   // must match AUTHORS_TO_CREATE.display_name or EXISTING_AUTHORS key
  banList:             'west_bank' | 'ketziot'
  firstPublishedYear?: number
  originalLanguage?:   string
  descriptionBook?:    string
  censorshipContext:   string
}

const BOOKS: BookDef[] = [
  // ── West Bank / IDF list ───────────────────────────────────────────────────
  {
    id: 3578, slug: 'can-the-palestinian-problem-be-solved',
    title: 'Can the Palestinian Problem be Solved?',
    authorName: 'Alouph Har Even',
    banList: 'west_bank',
    originalLanguage: 'he',
    censorshipContext: 'Reported by B\'Tselem as prohibited by the IDF in the West Bank. The book addresses the Palestinian question from an Israeli perspective, and its suppression in the occupied territories reflects IDF policy of restricting political texts that could be read as sympathetic to or critical of Israeli governance.',
  },
  {
    id: 3579, slug: 'the-battle-for-peace',
    title: 'The Battle for Peace',
    authorName: 'Ezer Weizman',
    banList: 'west_bank',
    firstPublishedYear: 1981,
    originalLanguage: 'he',
    descriptionBook: 'Ezer Weizman\'s account of the Egyptian–Israeli peace negotiations he participated in as Israel\'s Defence Minister, leading to the 1978 Camp David Accords and the 1979 peace treaty. Weizman later served as President of Israel.',
    censorshipContext: 'Reported by B\'Tselem as prohibited by the IDF in the West Bank. The prohibition of a memoir by Israel\'s own Defence Minister — documenting peace negotiations — illustrates the broad and at times inconsistent scope of IDF censorship in the occupied territories during the first Intifada period.',
  },
  {
    id: 3580, slug: 'studies-in-the-history-of-palestine-during-the-middle-ages',
    title: 'Studies in the History of Palestine During the Middle Ages',
    authorName: 'P.P. Bartholdy',
    banList: 'west_bank',
    originalLanguage: 'de',
    censorshipContext: 'Reported by B\'Tselem as prohibited by the IDF in the West Bank. The suppression of academic historical scholarship on Palestine reflects the IDF\'s broad application of censorship to any material touching on Palestinian territorial and national history.',
  },
  {
    id: 3581, slug: 'at-the-end-of-the-night',
    title: 'At the End of the Night',
    authorName: 'Mahmoud Darwish',
    banList: 'west_bank',
    originalLanguage: 'ar',
    censorshipContext: 'Reported by B\'Tselem as prohibited by the IDF in the West Bank. Mahmoud Darwish, widely regarded as the Palestinian national poet, was a particularly targeted author; his work was seen by Israeli military authorities as a vehicle for Palestinian national sentiment and political resistance.',
  },
  {
    id: 3582, slug: 'selected-poems-mahmud-darwish',
    title: 'Selected Poems',
    authorName: 'Mahmoud Darwish',
    banList: 'west_bank',
    originalLanguage: 'ar',
    censorshipContext: 'Reported by B\'Tselem as prohibited by the IDF in the West Bank. Multiple collections by Mahmoud Darwish were banned in the occupied territories. His poetry — invoking land, exile, and Palestinian identity — was considered politically inflammatory by the Israeli military administration.',
  },
  {
    id: 3583, slug: 'the-non-jewish-jew',
    title: 'The Non-Jewish Jew',
    authorName: 'Isaac Deutscher',
    banList: 'west_bank',
    firstPublishedYear: 1968,
    originalLanguage: 'en',
    descriptionBook: 'A collection of essays by Isaac Deutscher, the Polish-born British historian and biographer of Trotsky and Stalin, examining Jewish identity outside orthodox religion and nationality. Deutscher argues that history\'s greatest Jewish thinkers — Spinoza, Heine, Marx, Rosa Luxemburg, Trotsky — transcended the boundaries of Jewish parochialism.',
    censorshipContext: 'Reported by B\'Tselem as prohibited by the IDF in the West Bank. Deutscher\'s Marxist critique of Zionism and Jewish nationalism made this collection politically sensitive; its prohibition reflects the IDF\'s suppression of material critical of Israeli state ideology in the occupied territories.',
  },
  {
    id: 3584, slug: 'i-accuse-roger-delorus',
    title: 'I Accuse',
    authorName: 'Roger Delorus',
    banList: 'west_bank',
    censorshipContext: 'Reported by B\'Tselem as prohibited by the IDF in the West Bank. Note: the author\'s name is uncertain in transliteration; the book\'s exact content is unverified. The evocative title — recalling Zola\'s "J\'Accuse" — suggests political polemic, which would explain IDF prohibition under occupation-era censorship.',
  },
  {
    id: 3585, slug: 'watergate-adnan-al-maluhi',
    title: 'Watergate',
    authorName: 'Adnan al-Maluhi',
    banList: 'west_bank',
    originalLanguage: 'ar',
    censorshipContext: 'Reported by B\'Tselem as prohibited by the IDF in the West Bank. An Arab-language work on the Watergate scandal; its prohibition likely reflects the broad IDF practice of restricting Arabic-language political literature in the occupied territories regardless of specific content.',
  },
  {
    id: 3586, slug: 'afghanistan-the-revolution',
    title: 'Afghanistan - The Revolution',
    authorName: 'Hanna Salah',
    banList: 'west_bank',
    originalLanguage: 'ar',
    censorshipContext: 'Reported by B\'Tselem as prohibited by the IDF in the West Bank. The book\'s coverage of revolutionary politics in Afghanistan placed it within the IDF\'s broad restriction of left-wing and anti-imperialist political literature from the occupied territories\' libraries and bookshops.',
  },
  {
    id: 3587, slug: 'the-lover-ghassan-kanafani',
    title: 'The Lover',
    authorName: 'Ghassan Kanafani',
    banList: 'west_bank',
    firstPublishedYear: 1966,
    originalLanguage: 'ar',
    descriptionBook: 'A novella by Palestinian writer Ghassan Kanafani, set in Haifa, exploring the tangled relationship between two Palestinian men through themes of exile, identity, and betrayal. Kanafani was assassinated by a Mossad car bomb in Beirut in 1972.',
    censorshipContext: 'Reported by B\'Tselem as prohibited by the IDF in the West Bank. Ghassan Kanafani was a founding member of the Popular Front for the Liberation of Palestine and one of the most important voices in Palestinian literature; his works were systematically prohibited by the IDF in the occupied territories.',
  },
  {
    id: 3588, slug: 'gush-emunim-the-true-face-of-zionism',
    title: 'Gush Emunim, The True Face of Zionism',
    authorName: 'Danny Rubinstein',
    banList: 'west_bank',
    firstPublishedYear: 1982,
    originalLanguage: 'he',
    descriptionBook: 'An investigation by Israeli journalist Danny Rubinstein into Gush Emunim, the settler movement that drove Jewish settlement of the West Bank from the 1970s onward. Rubinstein examines the religious ideology, political connections, and long-term vision of the settler leadership.',
    censorshipContext: 'Reported by B\'Tselem as prohibited by the IDF in the West Bank. The IDF\'s prohibition of a critical examination of its own settler movement — by an Israeli journalist — illustrates the internal contradictions of occupation-era censorship: even Israeli critics of settlement policy had their books suppressed in the occupied territories.',
  },

  // ── Ketziot Prison list ────────────────────────────────────────────────────
  {
    id: 3589, slug: 'hamlet',
    title: 'Hamlet',
    authorName: 'William Shakespeare',
    banList: 'ketziot',
    firstPublishedYear: 1603,
    originalLanguage: 'en',
    descriptionBook: 'Shakespeare\'s tragedy of Prince Hamlet of Denmark, who is charged by his father\'s ghost with avenging his murder at the hands of Hamlet\'s uncle, now the king. One of the most performed plays in the history of theatre, and a foundational text of Western literature.',
    censorshipContext: 'Reported as prohibited in Ketziot Prison (also known as Ansar III), the Israeli military detention facility in the Negev desert established in 1988 during the first Intifada. The restriction of Shakespeare\'s canonical tragedy — alongside political histories and legal texts — illustrates the sweeping nature of prison censorship, which curtailed Palestinian detainees\' access to literature, education, and law.',
  },
  {
    id: 3590, slug: 'the-story-of-mankind',
    title: 'The Story of Mankind',
    authorName: 'Hendrik Willem van Loon',
    banList: 'ketziot',
    firstPublishedYear: 1921,
    originalLanguage: 'en',
    descriptionBook: 'Hendrik Willem van Loon\'s sweeping, illustrated history of human civilisation from prehistoric times to the early twentieth century. It was the first book awarded the Newbery Medal in 1922 and became an internationally popular introduction to world history for young and adult readers alike.',
    censorshipContext: 'Reported as prohibited in Ketziot Prison during the first Intifada. The restriction of a widely read general history of world civilisation illustrates how Ketziot\'s book prohibitions extended far beyond political or legal writing to block Palestinian detainees\' access to general education and culture.',
  },
  {
    id: 3591, slug: 'tolstoy-henri-troyat',
    title: 'Tolstoy',
    authorName: 'Henri Troyat',
    banList: 'ketziot',
    firstPublishedYear: 1965,
    originalLanguage: 'fr',
    descriptionBook: 'Henri Troyat\'s landmark biography of Leo Tolstoy, the Russian novelist. Drawing on letters, diaries, and unpublished memoirs, Troyat traces Tolstoy\'s life from his aristocratic childhood through his literary career and his late spiritual crisis, producing a comprehensive portrait of one of the nineteenth century\'s towering literary figures.',
    censorshipContext: 'Reported as prohibited in Ketziot Prison during the first Intifada. The restriction of a literary biography of Tolstoy — a work with no political connection to the Israeli–Palestinian conflict — exemplifies how Ketziot\'s censorship regime denied Palestinian detainees access to mainstream world literature and cultural history.',
  },
  {
    id: 3592, slug: 'constitutional-law-amnon-rubinstein',
    title: 'Constitutional Law',
    authorName: 'Amnon Rubinstein',
    banList: 'ketziot',
    originalLanguage: 'he',
    descriptionBook: 'Amnon Rubinstein\'s standard Israeli legal textbook on constitutional and administrative law, widely used in Israeli universities. Rubinstein was a law professor at Tel Aviv University and later a member of the Israeli Knesset.',
    censorshipContext: 'Reported as prohibited in Ketziot Prison during the first Intifada. The prohibition of an Israeli legal textbook authored by a Knesset member is especially notable: Palestinian detainees held in military detention were denied access to the very legal framework governing their incarceration, illustrating the deliberate effort to restrict prisoners\' legal knowledge and self-advocacy capacity.',
  },
  {
    id: 574, slug: 'cancer-ward',
    title: 'Cancer Ward',
    authorName: 'Aleksandr Solzhenitsyn',
    banList: 'ketziot',
    censorshipContext: 'Reported as prohibited in Ketziot Prison during the first Intifada. Solzhenitsyn\'s work was widely censored across authoritarian regimes; its restriction in Ketziot — alongside Shakespeare and legal textbooks — reflects the broad, politically motivated character of Israeli military prison censorship, which targeted Soviet dissident literature alongside Palestinian political writing.',
  },
  {
    id: 3593, slug: 'august-1914',
    title: 'August, 1914',
    authorName: 'Aleksandr Solzhenitsyn',
    banList: 'ketziot',
    firstPublishedYear: 1971,
    originalLanguage: 'ru',
    descriptionBook: 'The first novel in Alexander Solzhenitsyn\'s multi-volume historical cycle The Red Wheel, tracing Russia\'s catastrophic entry into the First World War. It centres on the Battle of Tannenberg (1914), in which German forces encircled and destroyed two Russian armies.',
    censorshipContext: 'Reported as prohibited in Ketziot Prison during the first Intifada. Like the simultaneously prohibited Cancer Ward, Solzhenitsyn\'s historical fiction was barred from the prison; its restriction alongside legal texts and literary classics illustrates the indiscriminate scope of Ketziot\'s censorship regime.',
  },
  {
    id: 3594, slug: 'the-lord-of-the-rings',
    title: 'The Lord of the Rings',
    authorName: 'J.R.R. Tolkien',
    banList: 'ketziot',
    firstPublishedYear: 1954,
    originalLanguage: 'en',
    descriptionBook: 'J.R.R. Tolkien\'s epic fantasy trilogy following the hobbit Frodo Baggins and the Fellowship of the Ring on a quest to destroy the One Ring and defeat the dark lord Sauron. First published in three volumes in 1954–55, it is among the best-selling novels ever written.',
    censorshipContext: 'Reported as prohibited in Ketziot Prison during the first Intifada. The restriction of Tolkien\'s fantasy epic — one of the best-selling novels in history — underlines the arbitrary breadth of Ketziot\'s book prohibitions, which blocked Palestinian detainees from escapist fiction alongside political history and legal writing.',
  },
  {
    id: 3595, slug: 'the-sea-wolf',
    title: 'The Sea Wolf',
    authorName: 'Jack London',
    banList: 'ketziot',
    firstPublishedYear: 1904,
    originalLanguage: 'en',
    descriptionBook: 'Jack London\'s adventure novel in which a mild-mannered literary critic, Humphrey Van Weyden, is rescued from a shipwreck by the ruthless schooner captain Wolf Larsen and forced to serve as crew aboard a seal-hunting vessel. London uses the confrontation between the two men to explore themes of Nietzschean individualism, social Darwinism, and human dignity.',
    censorshipContext: 'Reported as prohibited in Ketziot Prison during the first Intifada. The restriction of a century-old American adventure novel illustrates the indiscriminate nature of book prohibitions at Ketziot, where Palestinian detainees were denied access to world literature at large rather than just political texts.',
  },
  {
    id: 3596, slug: 'and-quiet-flows-the-don',
    title: 'And Quiet Flows the Don',
    authorName: 'Mikhail Sholokhov',
    banList: 'ketziot',
    firstPublishedYear: 1928,
    originalLanguage: 'ru',
    descriptionBook: 'Mikhail Sholokhov\'s Nobel Prize-winning epic following the Melekhov family of Cossacks on the Don River through the turmoil of the First World War, the Russian Revolution, and the Civil War. A monumental work of Soviet literature, it was translated into over forty languages.',
    censorshipContext: 'Reported as prohibited in Ketziot Prison during the first Intifada. Sholokhov\'s Soviet epic — a Nobel Prize winner — was banned alongside Shakespeare and Tolkien, reflecting a censorship policy that targeted Soviet literature broadly and denied Palestinian detainees access to canonical world fiction.',
  },
  {
    id: 3597, slug: 'virgin-ground-upturned',
    title: 'Virgin Ground Upturned',
    authorName: 'Mikhail Sholokhov',
    banList: 'ketziot',
    firstPublishedYear: 1932,
    originalLanguage: 'ru',
    descriptionBook: 'Mikhail Sholokhov\'s novel depicting Soviet collectivisation in the Don Cossack region of Russia in the early 1930s, as a Communist activist attempts to reorganise a village into a collective farm. Published in two parts (1932 and 1960), it is a major work of Soviet literary realism.',
    censorshipContext: 'Reported as prohibited in Ketziot Prison during the first Intifada. Like the simultaneously banned And Quiet Flows the Don, this Sholokhov novel was restricted in Ketziot; the prohibition of both major works by the same Soviet author illustrates the broad sweep of the prison\'s censorship regime.',
  },
  {
    id: 3598, slug: 'the-young-guardia',
    title: 'The Young Guardia',
    authorName: 'Alexander Fadeyev',
    banList: 'ketziot',
    firstPublishedYear: 1945,
    originalLanguage: 'ru',
    descriptionBook: 'Alexander Fadeyev\'s Soviet novel based on the real Molodaya Gvardiya (Young Guard), a group of young Soviet partisans who organised resistance against Nazi occupation in Krasnodon, Ukraine, before being captured and executed in 1942–43. Note: the title is more commonly rendered in English as "The Young Guard"; the transliteration "The Young Guardia" follows the source list.',
    censorshipContext: 'Reported as prohibited in Ketziot Prison during the first Intifada. A Soviet anti-fascist war novel, its presence on the prohibited list alongside Shakespeare and Tolkien underlines that Ketziot\'s censorship was not limited to political texts but extended to world fiction broadly.',
  },
  {
    id: 3599, slug: 'collection-of-classic-fairy-tales',
    title: 'Collection of Classic Fairy Tales',
    authorName: 'Anonymous',
    banList: 'ketziot',
    censorshipContext: 'Reported as prohibited in Ketziot Prison during the first Intifada. The restriction of a collection of classic fairy tales — among the most culturally neutral texts conceivable — is perhaps the starkest illustration of how comprehensively Ketziot\'s censorship regime denied Palestinian detainees access to ordinary literature and culture.',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function upsertAuthor(def: AuthorDef): Promise<number> {
  const { data, error } = await supabase
    .from('authors')
    .upsert({ display_name: def.display_name, slug: def.slug, birth_year: def.birth_year ?? null, death_year: def.death_year ?? null, birth_country: def.birth_country ?? null }, { onConflict: 'slug' })
    .select('id')
    .single()
  if (error) throw new Error(`Author upsert failed for ${def.display_name}: ${error.message}`)
  return (data as { id: number }).id
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── import-btselem-books (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)

  // ── Warn about uncertain metadata ──────────────────────────────────────────
  console.log('⚠ UNCERTAIN METADATA — requires manual verification:')
  for (const a of AUTHORS_TO_CREATE) {
    if (a.uncertain) console.log(`  • ${a.display_name}: ${a.uncertain}`)
  }
  const youngGuard = BOOKS.find(b => b.id === 3598)
  console.log(`  • "The Young Guardia" (id 3598): commonly "The Young Guard" in English — transliteration follows source`)
  console.log()

  // ── Step 1: Build author ID map ────────────────────────────────────────────
  const authorIdMap = new Map<string, number>(Object.entries(EXISTING_AUTHORS))

  console.log('Step 1: Authors')
  for (const def of AUTHORS_TO_CREATE) {
    // Skip if name already resolved
    if (authorIdMap.has(def.display_name)) {
      console.log(`  ✓ already exists: ${def.display_name} (id ${authorIdMap.get(def.display_name)})`)
      continue
    }
    if (APPLY) {
      const id = await upsertAuthor(def)
      authorIdMap.set(def.display_name, id)
      console.log(`  ✓ created: ${def.display_name} (id ${id})${def.uncertain ? ' ⚠ uncertain' : ''}`)
    } else {
      console.log(`  DRY: would create author "${def.display_name}" (slug: ${def.slug})${def.uncertain ? ' ⚠ uncertain' : ''}`)
    }
  }
  console.log()

  // ── Step 2: Upsert ban_source ──────────────────────────────────────────────
  console.log('Step 2: Ban source')
  let sourceId: number | null = null
  const sourceDef = {
    source_name: "B'Tselem — List of books prohibited by IDF in the West Bank and Ketziot Prison",
    source_url:  null as string | null,
    source_type: 'human_rights_report',
  }
  if (APPLY) {
    // Try to find existing source first
    const { data: existing } = await supabase
      .from('ban_sources')
      .select('id')
      .eq('source_name', sourceDef.source_name)
      .maybeSingle()
    if (existing) {
      sourceId = (existing as { id: number }).id
      console.log(`  ✓ source already exists (id ${sourceId})`)
    } else {
      const { data, error } = await supabase
        .from('ban_sources')
        .insert({ source_name: sourceDef.source_name, source_url: sourceDef.source_url, source_type: sourceDef.source_type })
        .select('id')
        .single()
      if (error) { console.error(`  ✗ ${error.message}`); sourceId = null }
      else { sourceId = (data as { id: number }).id; console.log(`  ✓ created source (id ${sourceId})`) }
    }
  } else {
    console.log(`  DRY: would create source "${sourceDef.source_name}"`)
    console.log(`  ⚠ source_url: NULL — must be filled manually once the exact B'Tselem report URL is confirmed`)
  }
  console.log()

  // ── Step 3: Create bans + links ────────────────────────────────────────────
  console.log('Step 3: Bans')
  let bansCreated = 0, bansSkipped = 0

  for (const book of BOOKS) {
    const banBase = book.banList === 'west_bank'
      ? {
          book_id:     book.id,
          country_code: 'IL' as const,
          scope_id:    SCOPE_GOVERNMENT,
          action_type: 'banned',
          status:      'historical',
          region:      'West Bank',
          actor:       'IDF / Israeli military authorities',
          description: "Reported by B'Tselem as prohibited by the IDF in the West Bank",
          confidence:  'reported',
        }
      : {
          book_id:     book.id,
          country_code: 'IL' as const,
          scope_id:    SCOPE_PRISON,
          action_type: 'banned',
          status:      'historical',
          institution: 'Ketziot Prison (Ansar III)',
          actor:       'Israeli Prison Service / IDF',
          description: "Reported as prohibited in Ketziot Prison (Ansar III), Negev, Israel",
          confidence:  'reported',
        }

    // Check if an IL ban already exists for this book
    const { data: existing } = await supabase
      .from('bans')
      .select('id')
      .eq('book_id', book.id)
      .eq('country_code', 'IL')
      .maybeSingle()

    if (existing) {
      console.log(`  ✓ ban already exists for "${book.title}" (ban id ${(existing as {id:number}).id})`)
      bansSkipped++
      continue
    }

    console.log(`  ${APPLY ? '+' : 'DRY'} ban for "${book.title}" [${book.banList}]`)

    if (APPLY) {
      const { data: banRow, error: banErr } = await supabase
        .from('bans')
        .insert(banBase)
        .select('id')
        .single()

      if (banErr) { console.error(`    ✗ ban: ${banErr.message}`); continue }
      const banId = (banRow as { id: number }).id
      bansCreated++

      // Reason link
      await supabase.from('ban_reason_links').insert({ ban_id: banId, reason_id: REASON_POLITICAL })

      // Source link
      if (sourceId) {
        await supabase.from('ban_source_links').insert({ ban_id: banId, source_id: sourceId })
      }

      console.log(`    ✓ ban id ${banId} + reason(political) + source link`)
    }
  }
  if (!APPLY) bansCreated = BOOKS.length
  console.log(`  Bans created: ${bansCreated}  Skipped (already exist): ${bansSkipped}`)
  console.log()

  // ── Step 4: Link authors to books ─────────────────────────────────────────
  console.log('Step 4: Author–book links')
  let linksCreated = 0

  for (const book of BOOKS) {
    const authorId = authorIdMap.get(book.authorName)
    if (!authorId) {
      console.log(`  ⚠ no author ID for "${book.authorName}" — link skipped`)
      continue
    }

    // Check if link already exists
    const { data: existing } = await supabase
      .from('book_authors')
      .select('book_id')
      .eq('book_id', book.id)
      .eq('author_id', authorId)
      .maybeSingle()

    if (existing) {
      console.log(`  ✓ link already exists: "${book.title}" → ${book.authorName}`)
      continue
    }

    if (APPLY) {
      const { error } = await supabase
        .from('book_authors')
        .insert({ book_id: book.id, author_id: authorId, role: 'author' })
      if (error) { console.error(`  ✗ link "${book.title}" → ${book.authorName}: ${error.message}`); continue }
      console.log(`  ✓ linked: "${book.title}" → ${book.authorName} (id ${authorId})`)
    } else {
      console.log(`  DRY: would link "${book.title}" → ${book.authorName} (id ${authorId})`)
    }
    linksCreated++
  }
  console.log()

  // ── Step 5: Update book metadata ──────────────────────────────────────────
  console.log('Step 5: Book metadata (year, language, description_book, censorship_context)')
  let metaUpdated = 0

  for (const book of BOOKS) {
    const updates: Record<string, unknown> = {}
    if (book.firstPublishedYear) updates.first_published_year = book.firstPublishedYear
    if (book.originalLanguage)  updates.original_language    = book.originalLanguage
    if (book.descriptionBook)   updates.description_book     = book.descriptionBook
    if (book.censorshipContext) updates.censorship_context   = book.censorshipContext

    if (Object.keys(updates).length === 0) continue

    console.log(`  ${APPLY ? '~' : 'DRY'} update "${book.title}": ${Object.keys(updates).join(', ')}`)

    if (APPLY) {
      const { error } = await supabase
        .from('books')
        .update(updates)
        .eq('id', book.id)
      if (error) console.error(`    ✗ ${error.message}`)
      else metaUpdated++
    }
  }
  console.log()

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('── Summary ──')
  console.log(`  Books targeted : ${BOOKS.length}`)
  console.log(`  Bans created   : ${bansCreated}`)
  console.log(`  Author links   : ${linksCreated}`)
  console.log(`  Meta updated   : ${APPLY ? metaUpdated : `${BOOKS.filter(b => b.firstPublishedYear || b.originalLanguage || b.descriptionBook || b.censorshipContext).length} (DRY-RUN)`}`)

  if (!APPLY) {
    console.log()
    console.log('DRY-RUN complete. Re-run with --apply to write.')
  }

  console.log()
  console.log('⚠ Manual follow-up required:')
  console.log('  1. Verify and add source_url to the B\'Tselem ban_sources record once the exact report URL is confirmed')
  console.log('  2. Verify transliterations: Alouph Har Even, P.P. Bartholdy, Roger Delorus, Adnan al-Maluhi, Hanna Salah')
  console.log('  3. Confirm whether "The Young Guardia" should be corrected to "The Young Guard"')
  console.log('  4. Add country record for PS (Palestinian Territory) if you want to surface these bans under a Palestine page')
}

main().catch(e => { console.error(e); process.exit(1) })
