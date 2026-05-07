/**
 * Editorial classification — startset (40 books).
 *
 * Applies the editorial framework set out in the two essays
 * ("What we document — and why that is a choice" and "Why 'forbidden knowledge'
 * iceberg lists collapse important distinctions") to a curated startset.
 *
 * Schema additions used (migration 013):
 *   - books.warning_level         text 'none'|'context'|'extended'
 *   - books.inclusion_rationale   text — short per-book justification
 *   - books.extended_context      text — markdown, only set for 'extended' tier
 *
 * Behaviour:
 *   - For existing books: only updates warning_level/inclusion_rationale if
 *     they have not been edited yet (warning_level='none' AND rationale IS NULL).
 *     This protects redactional edits made via the admin UI from being clobbered.
 *   - For the 5 new books: creates books, authors (if needed), book_authors links
 *     and at least one ban with reasons + sources, following the batch47 pattern.
 *   - Collection placeholders #23/#30/#39 are intentionally NOT inserted — see
 *     the COLLECTION_PLACEHOLDERS block at the bottom of this file.
 *   - extended_context is left NULL with a TODO marker for the redactie to fill.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/apply-editorial-classification.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/apply-editorial-classification.ts --write
 */

import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')
const supabase = adminClient()

type Tier = 'none' | 'context' | 'extended'

type PatchEntry = {
  slug: string
  warning_level: Tier
  inclusion_rationale: string
  // extended_context is left NULL on purpose — the four extended-tier essays are
  // redactional work and live outside this script (TODO).
}

// ─── 32 EXISTING BOOKS — patch warning_level + inclusion_rationale ──────────
const PATCHES: PatchEntry[] = [
  // Politics & ideology ─────────────────────────────────────────────────────
  {
    slug: 'mein-kampf',
    warning_level: 'extended',
    inclusion_rationale:
      "Foundational text of National Socialist ideology and a textbook case in postwar censorship law (Bavarian copyright suppression 1945–2015, ongoing import restrictions in several countries). Documenting how states have handled this work — and how they have failed to — is core to understanding modern censorship.",
  },
  {
    slug: 'the-communist-manifesto',
    warning_level: 'none',
    inclusion_rationale:
      "Suppressed across a wide spectrum of regimes — Nazi Germany, Suharto's Indonesia, military juntas, Cold-War-era anti-communist states — making it one of the most cross-ideologically banned political pamphlets in modern history.",
  },
  {
    slug: 'the-gulag-archipelago',
    warning_level: 'none',
    inclusion_rationale:
      "Banned throughout the Soviet bloc for documenting the Soviet penal system; possession was prosecutable until perestroika. A defining case of literature suppressed for telling an inconvenient history.",
  },
  {
    slug: '1984',
    warning_level: 'none',
    inclusion_rationale:
      "Banned in the Soviet Union and routinely challenged in US school districts; a perennial example of how a single text accumulates censorship attempts across radically different ideological systems.",
  },
  {
    slug: 'animal-farm',
    warning_level: 'none',
    inclusion_rationale:
      "Suppressed across the Soviet bloc, Cuba, the DPRK and beyond as a satirical attack on Communist Party rule. A clear case of restriction on political literature.",
  },
  {
    slug: 'the-turner-diaries',
    warning_level: 'extended',
    inclusion_rationale:
      "Cited as direct inspiration for the Oklahoma City bombing and removed by major retailers after 2019. The novel sits at the centre of an unresolved debate about fiction, incitement and downstream harm — exactly the kind of difficult case the archive exists to make legible.",
  },
  {
    slug: 'spycatcher',
    warning_level: 'none',
    inclusion_rationale:
      "Banned in the United Kingdom by the Thatcher government using the Official Secrets Act and prior-restraint injunctions; a leading modern example of state secrecy used to suppress a published memoir.",
  },
  {
    slug: 'the-wretched-of-the-earth',
    warning_level: 'none',
    inclusion_rationale:
      "Suppressed in colonial France and apartheid South Africa for arguing the legitimacy of anticolonial revolt; a foundational case of restrictions on political philosophy.",
  },
  {
    slug: 'catch-22',
    warning_level: 'none',
    inclusion_rationale:
      "Removed from US military library systems and challenged in school districts for its anti-war satire and language; a documented case of military and educational censorship of literary fiction.",
  },

  // Religion & blasphemy ────────────────────────────────────────────────────
  {
    slug: 'the-satanic-verses',
    warning_level: 'none',
    inclusion_rationale:
      "Subject of the 1989 Khomeini fatwa and government bans across dozens of countries; the assassination attempt on Rushdie in 2022 confirmed that the threat against the book persists. A defining modern case of religious-political censorship.",
  },
  {
    slug: 'the-last-temptation-of-christ',
    warning_level: 'none',
    inclusion_rationale:
      "Placed on the Roman Catholic Index Librorum Prohibitorum and prompted state bans and protests on multiple continents; a classic 20th-century case of religious censorship of fiction.",
  },
  {
    slug: 'the-jewel-of-medina',
    warning_level: 'none',
    inclusion_rationale:
      "Random House withdrew the book before publication in the US after security threats; the UK publisher's offices were firebombed. A textbook case of pre-emptive self-censorship by a major publisher under threat.",
  },
  {
    slug: 'lajja',
    warning_level: 'none',
    inclusion_rationale:
      "Banned in Bangladesh for blasphemy and incitement; the author has lived in exile under a fatwa since 1994. A continuing example of religious-political censorship of a living writer.",
  },

  // Sexuality, gender & body ────────────────────────────────────────────────
  {
    slug: 'lolita',
    warning_level: 'context',
    inclusion_rationale:
      "Banned in the UK, France, Argentina and South Africa on first publication. A canonical literary novel whose treatment of an abuser's narration is persistently misread; warrants a brief contextual note alongside the entry.",
  },
  {
    slug: 'lady-chatterleys-lover',
    warning_level: 'none',
    inclusion_rationale:
      "Subject of the landmark 1960 UK obscenity trial that effectively reset postwar British censorship law; banned in the United States until 1959. A foundational obscenity-law case.",
  },
  {
    slug: 'tropic-of-cancer',
    warning_level: 'none',
    inclusion_rationale:
      "Banned in the United States until 1961 and in several Commonwealth jurisdictions for decades after; a leading 20th-century obscenity case in literary fiction.",
  },
  {
    slug: 'gender-queer',
    warning_level: 'none',
    inclusion_rationale:
      "The single most-challenged book in US public libraries and schools in 2021–2024, central to the contemporary US wave of LGBTQ-targeted school removals.",
  },
  {
    slug: 'all-boys-arent-blue',
    warning_level: 'none',
    inclusion_rationale:
      "Among the most-removed titles in US schools and public libraries in the 2020s wave; a memoir whose suppression is closely tracked by PEN America and the ALA.",
  },
  {
    slug: 'the-well-of-loneliness',
    warning_level: 'none',
    inclusion_rationale:
      "Found obscene in the UK in 1928 in one of the most consequential lesbian-literature obscenity trials of the 20th century; banned for decades thereafter.",
  },

  // History, conflict & memory ──────────────────────────────────────────────
  {
    slug: 'the-diary-of-a-young-girl',
    warning_level: 'none',
    inclusion_rationale:
      "Removed or restricted in multiple US school districts and challenged in Lebanon and elsewhere; a recurring case of suppression of Holocaust testimony in school settings.",
  },
  {
    slug: 'maus',
    warning_level: 'none',
    inclusion_rationale:
      "Removed from the McMinn County (Tennessee) school curriculum in 2022 and contested in Russia and Poland over its depiction of national wartime memory. A live case in contemporary memory politics.",
  },
  {
    slug: 'persepolis',
    warning_level: 'none',
    inclusion_rationale:
      "Banned in Iran and removed from public schools in Chicago and elsewhere; a graphic memoir whose suppression spans authoritarian and democratic contexts.",
  },
  {
    slug: 'beloved',
    warning_level: 'none',
    inclusion_rationale:
      "Among the most-challenged novels in US schools, central to the 2020s wave of removals targeting works on slavery and Black history.",
  },
  {
    slug: 'black-boy',
    warning_level: 'none',
    inclusion_rationale:
      "Banned in apartheid South Africa and the subject of decades of US school challenges; a foundational case of literature suppressed for its account of Black American life.",
  },

  // Science, medicine, technique ────────────────────────────────────────────
  {
    slug: 'the-origin-of-species',
    warning_level: 'none',
    inclusion_rationale:
      "Suppressed in religious-authoritarian contexts and challenged in US school districts since the Scopes era; a continuing case of religious-motivated restriction on scientific publication.",
  },
  {
    slug: 'the-anarchist-cookbook',
    warning_level: 'extended',
    inclusion_rationale:
      "Subject of FBI investigation, removed by major retailers, and publicly disowned by its own author. The book sits at the contested edge of the archive: instructional content of dubious accuracy whose suppression has nonetheless become a textbook example of post-1970s informal censorship.",
  },
  {
    slug: 'hit-man-technical-manual',
    warning_level: 'extended',
    inclusion_rationale:
      "The subject of Rice v. Paladin Enterprises (1997), the only major US case in which a publisher faced civil liability for a book's downstream use in a contract killing. A unique legal test case of the limits of First Amendment protection for instructional speech.",
  },

  // Literature & novel ──────────────────────────────────────────────────────
  {
    slug: 'doctor-zhivago',
    warning_level: 'none',
    inclusion_rationale:
      "Suppressed in the Soviet Union until 1988, smuggled abroad and used by the CIA in covert distribution programmes; a Cold War literary censorship case of the first order.",
  },
  {
    slug: 'brave-new-world',
    warning_level: 'none',
    inclusion_rationale:
      "Banned in Ireland and India and routinely challenged in US schools; one of the most consistently restricted dystopian novels of the 20th century.",
  },
  {
    slug: 'the-catcher-in-the-rye',
    warning_level: 'none',
    inclusion_rationale:
      "Among the most-challenged novels in US schools for over half a century; a perennial case study in challenges to literary fiction in education.",
  },
  {
    slug: 'fahrenheit-451',
    warning_level: 'none',
    inclusion_rationale:
      "Censored by its own publisher Ballantine in a long-running expurgated edition (revealed publicly only in 1979) and challenged in US schools — an unusually pure case of a book about censorship being itself censored.",
  },
  {
    slug: 'one-day-in-the-life-of-ivan-denisovich',
    warning_level: 'none',
    inclusion_rationale:
      "Initially permitted under Khrushchev and subsequently banned as Brezhnev-era cultural policy tightened; a case of shifting Soviet censorship within a single political generation.",
  },
]

// ─── 5 NEW BOOKS — create with classification baked in ────────────────────

type AuthorRow = {
  slug: string
  display_name: string
  birth_year: number | null
  death_year: number | null
}

type BanSpec = {
  country: string                         // 2-letter code (countries.code)
  year: number
  actionType: 'banned' | 'restricted' | 'removed'
  status: 'active' | 'historical'
  scopeSlug: string
  reasons: string[]
  description: string
  sources: { url: string; name: string; type: string }[]
}

type NewBook = {
  slug: string
  title: string
  lang: string
  year: number | null
  genres: string[]
  description_book: string
  description_ban: string
  warning_level: Tier
  inclusion_rationale: string
  authors: AuthorRow[]   // first author is primary
  bans: BanSpec[]
}

const NEW_BOOKS: NewBook[] = [
  // 8. Quotations from Chairman Mao ────────────────────────────────────────
  {
    slug: 'quotations-from-chairman-mao',
    title: 'Quotations from Chairman Mao Tse-tung',
    lang: 'zh',
    year: 1964,
    genres: ['political', 'non-fiction'],
    description_book:
      "A pocket-sized anthology of selected statements by Mao Zedong, first compiled in 1964 by the Chinese People's Liberation Army's General Political Department. Distributed at unprecedented scale during the Cultural Revolution, the volume — colloquially the 'Little Red Book' — became a canonical instrument of Maoist political education.",
    description_ban:
      "Restricted, confiscated or banned in numerous anti-communist states during the Cold War, including Indonesia under Suharto and several Latin American military regimes; possession was used as evidence of subversive sympathies.",
    warning_level: 'none',
    inclusion_rationale:
      "Banned and confiscated as a political-affiliation marker in multiple Cold War-era anti-communist states; a documented case of suppression of a political text on the basis of perceived ideological allegiance.",
    authors: [{ slug: 'mao-zedong', display_name: 'Mao Zedong', birth_year: 1893, death_year: 1976 }],
    bans: [{
      country: 'ID', year: 1966, actionType: 'banned', status: 'historical', scopeSlug: 'government',
      reasons: ['political'],
      description:
        "Possession of Mao's writings was criminalised under Suharto's New Order following the 1965–66 anti-communist purge; copies were confiscated and possession could be treated as evidence of PKI sympathies.",
      sources: [{ url: 'https://en.wikipedia.org/wiki/Quotations_from_Chairman_Mao_Tse-tung', name: 'Wikipedia — Quotations from Chairman Mao Tse-tung', type: 'web' }],
    }],
  },

  // 13. Why I Am Not a Christian ───────────────────────────────────────────
  {
    slug: 'why-i-am-not-a-christian',
    title: 'Why I Am Not a Christian',
    lang: 'en',
    year: 1927,
    genres: ['essays', 'philosophy'],
    description_book:
      "The 1927 essay 'Why I Am Not a Christian', delivered as a lecture to the National Secular Society at Battersea Town Hall and later collected with related pieces, is Bertrand Russell's most widely circulated argument against Christian theology and church authority.",
    description_ban:
      "Restricted in jurisdictions that police anti-religious speech; in 1940 the City College of New York revoked Russell's appointment after a campaign citing this and related writings as morally unfit, in a case widely regarded as a landmark of US academic censorship.",
    warning_level: 'none',
    inclusion_rationale:
      "Restricted across multiple religious-authoritarian jurisdictions and central to the 1940 New York court case that revoked Russell's CCNY appointment — one of the most cited 20th-century cases of academic and religious censorship in the United States.",
    authors: [], // bertrand-russell already exists; resolved at runtime
    bans: [{
      country: 'US', year: 1940, actionType: 'restricted', status: 'historical', scopeSlug: 'government',
      reasons: ['religious'],
      description:
        "In Kay v. Board of Higher Education (1940), the New York Supreme Court voided Russell's CCNY appointment, with the petitioners citing 'Why I Am Not a Christian' and related writings as evidence of moral unfitness. Russell described the ruling as a 'judicial bull of excommunication'.",
      sources: [{ url: 'https://en.wikipedia.org/wiki/Why_I_Am_Not_a_Christian', name: 'Wikipedia — Why I Am Not a Christian', type: 'web' }],
    }],
  },

  // 14. Submission (script) ────────────────────────────────────────────────
  {
    slug: 'submission-hirsi-ali',
    title: 'Submission',
    lang: 'nl',
    year: 2004,
    genres: ['script'],
    description_book:
      "A short film script written by Ayaan Hirsi Ali and directed by Theo van Gogh, broadcast on Dutch public television in August 2004. The work depicts a Muslim woman addressing God about violence against women, with Quranic verses projected onto the actor's body. It was the catalyst for one of the most consequential acts of political violence against artistic expression in 21st-century Europe.",
    description_ban:
      "Theo van Gogh was assassinated in Amsterdam on 2 November 2004; his killer left a note pinned to the body threatening Hirsi Ali. The film has been almost impossible to screen in the Netherlands since, and its sequel was abandoned after the murder. The chilling effect on Dutch artistic discourse has been the subject of sustained debate.",
    warning_level: 'context',
    inclusion_rationale:
      "Catalyst for the 2004 murder of Theo van Gogh and the subsequent de facto withdrawal of the work from Dutch public broadcasting. A defining 21st-century European case of suppression-by-violence; included with a brief contextual note because the work is a script rather than a book.",
    authors: [
      { slug: 'ayaan-hirsi-ali', display_name: 'Ayaan Hirsi Ali', birth_year: 1969, death_year: null },
      { slug: 'theo-van-gogh', display_name: 'Theo van Gogh', birth_year: 1957, death_year: 2004 },
    ],
    bans: [{
      country: 'NL', year: 2004, actionType: 'restricted', status: 'active', scopeSlug: 'retail',
      reasons: ['religious', 'political'],
      description:
        "Following the 2 November 2004 assassination of Theo van Gogh by Mohammed Bouyeri — who pinned a death threat against Hirsi Ali to van Gogh's body — Submission has been effectively withheld from Dutch broadcast and theatrical distribution. No formal government ban exists; the suppression is an enduring case of de facto chilling effect after a violent attack on the filmmakers.",
      sources: [
        { url: 'https://en.wikipedia.org/wiki/Submission_(2004_film)', name: 'Wikipedia — Submission (2004 film)', type: 'web' },
        { url: 'https://en.wikipedia.org/wiki/Assassination_of_Theo_van_Gogh', name: 'Wikipedia — Assassination of Theo van Gogh', type: 'web' },
      ],
    }],
  },

  // 22. Heather Has Two Mommies ────────────────────────────────────────────
  {
    slug: 'heather-has-two-mommies',
    title: 'Heather Has Two Mommies',
    lang: 'en',
    year: 1989,
    genres: ['children', 'lgbtq'],
    description_book:
      "Lesléa Newman's 1989 picture book — illustrated by Diana Souza in its first edition — was one of the first children's books in the United States to depict a child raised by lesbian parents. Self-published in 1989 after rejection by mainstream presses, it was acquired by Alyson Publications for wider distribution in 1990.",
    description_ban:
      "From the early 1990s onward Heather Has Two Mommies became a flagship target of US 'Children of the Rainbow' curriculum disputes, the New York City school-board fights of 1992–93 and the American Library Association's most-challenged-books lists. It is one of the foundational US case studies of LGBTQ school-library censorship.",
    warning_level: 'none',
    inclusion_rationale:
      "One of the earliest and most-challenged LGBTQ-inclusive children's books in the United States; central to the 1990s New York 'Rainbow Curriculum' dispute and to the long-running ALA most-challenged lists.",
    authors: [], // lesl-a-newman already exists; resolved at runtime
    bans: [{
      country: 'US', year: 1992, actionType: 'removed', status: 'historical', scopeSlug: 'school',
      reasons: ['lgbtq'],
      description:
        "Removed from or restricted in numerous US school and public library collections from 1992 onward. The 1992–93 dispute over New York City's 'Children of the Rainbow' first-grade curriculum — which referenced the title in its bibliography — led to the dismissal of Schools Chancellor Joseph Fernandez and became a defining episode in US LGBTQ school-library politics.",
      sources: [
        { url: 'https://en.wikipedia.org/wiki/Heather_Has_Two_Mommies', name: 'Wikipedia — Heather Has Two Mommies', type: 'web' },
        { url: 'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks', name: 'American Library Association — Frequently Challenged Books', type: 'ngo' },
      ],
    }],
  },

  // 32. Our Bodies, Ourselves ──────────────────────────────────────────────
  {
    slug: 'our-bodies-ourselves',
    title: 'Our Bodies, Ourselves',
    lang: 'en',
    year: 1970,
    genres: ['health', 'non-fiction'],
    description_book:
      "First published in 1970 by the Boston Women's Health Book Collective as the stapled newsprint pamphlet 'Women and Their Bodies' and reissued by Simon & Schuster in 1973, Our Bodies, Ourselves is one of the most-translated works of feminist health publishing in the world. Successive editions have been adapted into more than thirty languages.",
    description_ban:
      "Removed from US school and public library collections in repeated waves from the 1970s onward and challenged again in the 2020s; international adaptations have been suppressed in jurisdictions hostile to comprehensive sex education and reproductive health information.",
    warning_level: 'none',
    inclusion_rationale:
      "Among the most-challenged feminist health books in US schools and public libraries since the 1970s; a continuing case of restriction on women's-health and reproductive information.",
    authors: [{ slug: 'boston-womens-health-book-collective', display_name: "Boston Women's Health Book Collective", birth_year: null, death_year: null }],
    bans: [{
      country: 'US', year: 1977, actionType: 'removed', status: 'historical', scopeSlug: 'school',
      reasons: ['sexual', 'moral'],
      description:
        "Removed from school and public library collections in multiple US states from the late 1970s onward following challenges over its frank treatment of sexuality, abortion and lesbian relationships; the book has reappeared on ALA's most-challenged lists in subsequent decades.",
      sources: [
        { url: 'https://en.wikipedia.org/wiki/Our_Bodies,_Ourselves', name: 'Wikipedia — Our Bodies, Ourselves', type: 'web' },
        { url: 'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks', name: 'American Library Association — Frequently Challenged Books', type: 'ngo' },
      ],
    }],
  },
]

// ─── COLLECTION PLACEHOLDERS — intentionally NOT inserted ─────────────────
// These are best handled by per-author/per-work entries rather than a single
// "collection" book. They are recorded here so the redactie can pick them up
// in a follow-up batch.
//
// TODO #23 — Russian LGBT-targeted works (post-2013/2023 propaganda law).
//   Examples to consider as individual entries: Eli Bartra, Andrei Tarkovsky's
//   diaries; Russian translations of Maia Kobabe; Akhmed Galeev. Better split
//   per author than collected as one entry.
//
// TODO #30 — "Black books" of state-recognised genocides.
//   Treaty of Sèvres documentation, "The Black Book" (Grossman/Ehrenburg),
//   Cambodian DK-era documentation. Suggest separate entries per work; their
//   suppression histories are not interchangeable.
//
// TODO #39 — DPRK dissident literature.
//   Pyongyang-printed but later-suppressed works versus diaspora/exile works
//   (Bandi's "The Accusation", Hwang Jang-yop's memoirs). Better split.
// ──────────────────────────────────────────────────────────────────────────

async function getOrCreateAuthor(row: AuthorRow): Promise<number | null> {
  const { data: existing } = await supabase
    .from('authors').select('id').eq('slug', row.slug).maybeSingle()
  if (existing) return existing.id as number
  console.log(`    [new author] ${row.slug}`)
  if (!WRITE) return null
  const { data, error } = await supabase
    .from('authors').insert(row).select('id').single()
  if (error || !data) { console.warn(`    [author warn] ${row.slug}: ${error?.message}`); return null }
  return data.id as number
}

async function upsertSource(url: string, name: string, type: string): Promise<number | null> {
  if (!WRITE) return null
  const { data, error } = await supabase
    .from('ban_sources')
    .upsert({ source_name: name, source_url: url, source_type: type }, { onConflict: 'source_url' })
    .select('id').single()
  if (error) { console.warn(`    [source warn] ${error.message}`); return null }
  return data?.id ?? null
}

async function linkBanToSource(banId: number, sourceId: number) {
  if (!WRITE) return
  const { data: existing } = await supabase.from('ban_source_links')
    .select('ban_id').eq('ban_id', banId).eq('source_id', sourceId).maybeSingle()
  if (existing) return
  const { error } = await supabase.from('ban_source_links').insert({ ban_id: banId, source_id: sourceId })
  if (error) console.warn(`    [link warn] ${error.message}`)
}

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

async function main() {
  console.log(`Editorial-classification seed — ${WRITE ? 'WRITE MODE' : 'DRY-RUN'}\n`)

  // Look up scope + reason ids once
  const { data: scopes } = await supabase.from('scopes').select('id, slug')
  const { data: reasons } = await supabase.from('reasons').select('id, slug')
  if (!scopes || !reasons) throw new Error('Failed to load scopes/reasons')
  const scopeId = (slug: string) => {
    const s = scopes.find(s => s.slug === slug)
    if (!s) throw new Error(`Scope not found: ${slug}`)
    return s.id as number
  }
  const reasonId = (slug: string) => {
    const r = reasons.find(r => r.slug === slug)
    if (!r) throw new Error(`Reason not found: ${slug}`)
    return r.id as number
  }

  let patchedFresh = 0
  let patchedSkipped = 0
  let patchedMissing = 0
  let createdBooks = 0
  let createdBookSkipped = 0

  // ═══ PART A — patch existing books ════════════════════════════════════
  console.log('=== Part A: patch existing books ===')
  for (const p of PATCHES) {
    const { data: book, error } = await supabase
      .from('books')
      .select('id, slug, title, warning_level, inclusion_rationale')
      .eq('slug', p.slug)
      .maybeSingle()
    if (error) { console.warn(`  [error] ${p.slug}: ${error.message}`); continue }
    if (!book) { console.log(`  [missing] ${p.slug}`); patchedMissing++; continue }

    const alreadyEdited = book.warning_level !== 'none' || book.inclusion_rationale !== null
    if (alreadyEdited) {
      console.log(`  [keep]  ${p.slug.padEnd(42)} (already classified: ${book.warning_level})`)
      patchedSkipped++
      continue
    }

    console.log(`  [patch] ${p.slug.padEnd(42)} → ${p.warning_level}`)
    if (!WRITE) { patchedFresh++; continue }

    const { error: upErr } = await supabase
      .from('books')
      .update({
        warning_level: p.warning_level,
        inclusion_rationale: p.inclusion_rationale,
        // extended_context intentionally NOT touched — left NULL with TODO
      })
      .eq('id', book.id)
    if (upErr) { console.warn(`    [warn] ${upErr.message}`); continue }
    patchedFresh++
  }

  // ═══ PART B — create 5 new books ══════════════════════════════════════
  console.log('\n=== Part B: create 5 new books ===')
  for (const nb of NEW_BOOKS) {
    console.log(`\n[${nb.slug}]  warning_level=${nb.warning_level}`)
    const { data: existing } = await supabase
      .from('books').select('id').eq('slug', nb.slug).maybeSingle()
    if (existing) {
      console.log(`  [exists] book already in DB — skipping creation, attempting patch`)
      const { data: row } = await supabase
        .from('books').select('warning_level, inclusion_rationale').eq('id', existing.id).single()
      if (row && row.warning_level === 'none' && !row.inclusion_rationale) {
        if (WRITE) {
          await supabase.from('books').update({
            warning_level: nb.warning_level, inclusion_rationale: nb.inclusion_rationale,
          }).eq('id', existing.id)
        }
        console.log(`  [patch] applied to existing book id=${existing.id}`)
        patchedFresh++
      } else {
        console.log(`  [keep]  existing classification preserved`)
        patchedSkipped++
      }
      createdBookSkipped++
      continue
    }

    // Resolve authors — create where missing, otherwise look up by slug
    const authorIds: number[] = []
    if (nb.authors.length > 0) {
      for (const a of nb.authors) {
        const id = await getOrCreateAuthor(a)
        if (id) authorIds.push(id)
      }
    } else {
      // Fallback: legacy authors expected to exist by slug derived from filename
      // (handled per-book below, see SPECIAL_AUTHORS)
    }
    // Special-case: books that rely on already-existing authors
    if (nb.slug === 'why-i-am-not-a-christian') {
      const { data: a } = await supabase.from('authors').select('id').eq('slug', 'bertrand-russell').maybeSingle()
      if (a?.id) authorIds.push(a.id as number)
    }
    if (nb.slug === 'heather-has-two-mommies') {
      const { data: a } = await supabase.from('authors').select('id').eq('slug', 'lesl-a-newman').maybeSingle()
      if (a?.id) authorIds.push(a.id as number)
    }

    const primaryAuthor = nb.authors[0]?.display_name ?? 'unknown'
    const { coverUrl, workId } = await fetchCover(nb.title, primaryAuthor)
    console.log(`  cover: ${coverUrl ? coverUrl.slice(0, 70) + '…' : 'not found'}`)

    if (!WRITE) {
      console.log(`  [dry] would create book + ${nb.bans.length} ban(s) + ${authorIds.length} author link(s)`)
      createdBooks++
      continue
    }

    const { data: bookRow, error: bookErr } = await supabase.from('books').insert({
      title: nb.title,
      slug: nb.slug,
      original_language: nb.lang,
      first_published_year: nb.year,
      genres: nb.genres,
      description_book: nb.description_book,
      description_ban: nb.description_ban,
      cover_url: coverUrl,
      openlibrary_work_id: workId,
      ai_drafted: false,
      warning_level: nb.warning_level,
      inclusion_rationale: nb.inclusion_rationale,
      // extended_context: left NULL — none of the 5 are extended-tier
    }).select('id').single()

    if (bookErr || !bookRow) { console.error(`  ✗ book: ${bookErr?.message}`); continue }
    const bookId = bookRow.id as number
    console.log(`  ✓ book id=${bookId}`)

    for (const aid of authorIds) {
      const { error } = await supabase.from('book_authors').insert({ book_id: bookId, author_id: aid })
      if (error) console.warn(`    [book_author warn] ${error.message}`)
    }

    for (const ban of nb.bans) {
      const { data: banRow, error: banErr } = await supabase.from('bans').insert({
        book_id: bookId,
        country_code: ban.country,
        scope_id: scopeId(ban.scopeSlug),
        action_type: ban.actionType,
        status: ban.status,
        year_started: ban.year,
        description: ban.description,
      }).select('id').single()
      if (banErr || !banRow) { console.error(`  ✗ ban: ${banErr?.message}`); continue }
      const banId = banRow.id as number

      for (const rSlug of ban.reasons) {
        const { error } = await supabase.from('ban_reason_links')
          .insert({ ban_id: banId, reason_id: reasonId(rSlug) })
        if (error) console.warn(`    [reason warn] ${rSlug}: ${error.message}`)
      }
      for (const src of ban.sources) {
        const sid = await upsertSource(src.url, src.name, src.type)
        if (sid) await linkBanToSource(banId, sid)
      }
      console.log(`  ✓ ban ${ban.country} ${ban.year} ${ban.actionType} (id=${banId})`)
    }
    createdBooks++
  }

  console.log('\n=== Summary ===')
  console.log(`patched fresh         : ${patchedFresh}`)
  console.log(`patched skipped (kept): ${patchedSkipped}`)
  console.log(`patched missing       : ${patchedMissing}`)
  console.log(`new books created     : ${createdBooks}`)
  console.log(`new books pre-existed : ${createdBookSkipped}`)
  if (!WRITE) console.log('\nDRY-RUN — re-run with --write to apply.')
}

main().catch(e => { console.error(e); process.exit(1) })
