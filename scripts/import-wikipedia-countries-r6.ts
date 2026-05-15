/**
 * Round 6: enrich thin descriptions on high-traffic country pages.
 *
 * After R1–R5 every country with ≥1 ban has a description, but several
 * heavy-traffic pages are short (HK 605 bans / 439 chars, US 3981 bans /
 * 454 chars, etc.). This round rewrites 15 of those in the same thorough
 * style as the R1 'improve' entries — concrete laws, dated milestones,
 * named authors/works, post-democratisation context.
 *
 * Sources: Wikipedia censorship articles (Book_censorship_in_…, Index on
 * Censorship country pages) and the Wikipedia per-country sections of
 * List_of_books_banned_by_governments.
 *
 * Usage:
 *   pnpm tsx scripts/import-wikipedia-countries-r6.ts          # dry-run
 *   pnpm tsx scripts/import-wikipedia-countries-r6.ts --apply
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvLocal() {
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    if (process.env[key]) continue
    process.env[key] = trimmed.slice(eq + 1)
  }
}
loadEnvLocal()

const APPLY = process.argv.includes('--apply')

type Update = { code: string; name: string; description: string }

const UPDATES: Update[] = [
  {
    code: 'HK',
    name: 'Hong Kong',
    description: `Hong Kong long served as the freest publishing hub in the Chinese-speaking world, distributing Chinese-language editions of titles banned across the mainland — particularly histories of the Cultural Revolution, the Great Leap Forward famine, the Tiananmen Square massacre, and biographies of Communist Party leaders. The 2015 abduction of five staff from Causeway Bay Books, a small publisher of gossipy political titles about Beijing's elite, signalled a sharp turn. After Beijing imposed the National Security Law (NSL) on 30 June 2020, the Hong Kong Public Libraries (HKPL) system pulled hundreds of titles for "review", including works by activists Joshua Wong, Tanya Chan and Chin Wan, while school authorities removed textbooks discussing civil disobedience and the separation of powers. The June 4th Museum, dedicated to Tiananmen, was forced to close in 2021. The 2024 Article 23 ordinance added new offences for sedition and "external interference", further compressing the space for political publishing; multiple independent bookshops and the pro-democracy newspapers Apple Daily and Stand News have been shut down since 2021.`,
  },

  {
    code: 'US',
    name: 'United States',
    description: `The First Amendment to the United States Constitution gives writers and publishers some of the strongest legal protections in the world, and federal book bans are essentially unknown — but enforcement has historically run through customs, the post office, and obscenity prosecutions. Anthony Comstock's Suppression of Vice campaigns (Comstock Act, 1873) banned literature, contraceptive information, and works by authors including Margaret Sanger; James Joyce's Ulysses was barred from import until United States v. One Book Called "Ulysses" (1933); customs and postal bans were dismantled through Roth v. United States (1957) and Memoirs v. Massachusetts (1966). Modern censorship runs through school districts and public libraries: the American Library Association's Office for Intellectual Freedom has tracked challenges since 1990, and PEN America's School Book Bans index counted more than 10,000 removals in the 2023–2024 school year alone. State laws in Florida, Texas, Iowa, Missouri and Tennessee (2022–2024) have expanded the legal grounds for removing books on race, gender, sexuality and U.S. history. The most-challenged titles are now disproportionately by LGBTQ+ authors and authors of colour — Maia Kobabe's Gender Queer, Toni Morrison's The Bluest Eye, Alison Bechdel's Fun Home, George M. Johnson's All Boys Aren't Blue and Jonathan Evison's Lawn Boy lead the ALA's recent annual lists.`,
  },

  {
    code: 'GB',
    name: 'United Kingdom',
    description: `The United Kingdom prosecuted authors and publishers under the Obscene Publications Acts of 1857 and 1959, with notable cases including The Well of Loneliness (1928, banned for portraying lesbianism), Boy by James Hanley (1934) and the seminal R v Penguin Books Ltd trial of 1960 in which Penguin was acquitted for publishing the unexpurgated Lady Chatterley's Lover by D. H. Lawrence — the verdict effectively ending literary obscenity prosecutions. Spycatcher by ex-MI5 officer Peter Wright was banned in the UK from 1985 to 1988 under interim injunctions for breach of confidence, even as it was openly sold in Australia and the United States. The Race Relations Act 1965 and later the Public Order Act 1986 introduced limits on incitement to racial hatred; the Terrorism Act 2006 criminalised the "encouragement of terrorism", which has been used against publishers of jihadi material. Northern Ireland imposed broadcast bans on Sinn Féin (1988–1994). Holocaust denial is not a crime in the UK, distinguishing it from much of continental Europe. The UK has strong press freedom in formal terms but its libel laws (until the Defamation Act 2013) and Official Secrets Act 1989 remain frequently cited concerns.`,
  },

  {
    code: 'IE',
    name: 'Ireland',
    description: `The Censorship of Publications Act 1929 created the Censorship of Publications Board, a small committee that for four decades reviewed books referred to it by customs officers or members of the public and banned anything deemed "indecent or obscene" or advocating contraception or abortion. By the late 1950s more than 1,700 titles had been prohibited each year on average, including James Joyce's Stephen Hero, Edna O'Brien's The Country Girls trilogy, Samuel Beckett's More Pricks than Kicks, Brendan Behan's Borstal Boy, John McGahern's The Dark, Frank O'Connor, Sean O'Casey, Kate O'Brien, Liam O'Flaherty and Brian Moore — effectively the entire generation of mid-century Irish literature. McGahern was dismissed from his teaching post in 1965 after his novel was banned. The Censorship of Publications Act 1967 introduced a twelve-year limit on bans, releasing thousands of titles at a stroke. Contraceptive information was decriminalised in 1979–1985 and abortion information in 1995; the Censorship Board still technically exists but has banned only a handful of books since the 1990s. Defamation, blasphemy (formally repealed in 2018) and incitement laws have replaced morality-based censorship as the active legal constraints on publishing.`,
  },

  {
    code: 'FR',
    name: 'France',
    description: `France's most famous obscenity trials all came in a single year: Gustave Flaubert was prosecuted (and acquitted) for Madame Bovary in 1857, and Charles Baudelaire was convicted in the same year for Les Fleurs du Mal, with six poems ordered struck from the collection (the verdict was formally quashed only in 1949). The Catholic Index banned Voltaire, Rousseau, Diderot and Stendhal during the ancien régime. The 16 July 1949 Law on Publications Aimed at Youth allowed the Interior Ministry to ban any publication deemed dangerous to minors and was applied for decades to titles including Boris Vian's J'irai cracher sur vos tombes, Henry Miller's Tropic of Cancer and Pauline Réage's Story of O. The 29 July 1881 Press Law (still in force) and the Loi Pleven of 1972 criminalise incitement to racial, religious and ethnic hatred; the Gayssot Act 1990 makes Holocaust denial a criminal offence. The most notorious recent banning concerned Le Grand Secret (1996), former presidential physician Claude Gubler's account of François Mitterrand's hidden cancer — banned for breach of medical confidentiality, then released for sale in 2005 after a European Court of Human Rights ruling against France. France today ranks consistently in the top quartile of global press freedom indices.`,
  },

  {
    code: 'SU',
    name: 'Soviet Union',
    description: `The Soviet Union operated one of the most extensive state censorship apparatuses in history. The Main Administration for Literary and Publishing Affairs (Главлит / Glavlit), founded in 1922, pre-cleared every book, newspaper, film script, theatre programme and even matchbox label produced in the USSR; the Writers' Union (founded 1932) enforced Socialist Realism and could strip dissenting writers of the right to publish or work. Works deemed politically subversive, religious, "formalist" or insufficiently optimistic were systematically suppressed. Boris Pasternak was forced to refuse the 1958 Nobel Prize in Literature after Doctor Zhivago was smuggled to Italy for publication; Aleksandr Solzhenitsyn was expelled in 1974 after One Day in the Life of Ivan Denisovich and The Gulag Archipelago broke the silence around the labour camps; Vasily Grossman was told his novel Life and Fate would not be published for "two or three hundred years". Joseph Brodsky was tried for "social parasitism" in 1964 and exiled; Andrei Sinyavsky and Yuli Daniel were sentenced to hard labour in 1966 for publishing abroad under pseudonyms. An entire underground publishing system, samizdat, emerged to circulate banned works typed on carbon paper. Glavlit was formally abolished in 1991 alongside the Soviet state itself.`,
  },

  {
    code: 'IR',
    name: 'Iran',
    description: `Iran has maintained strict state censorship since the Islamic Revolution of 1979. The Ministry of Culture and Islamic Guidance (Ershad) must approve every published book before printing under the Press Law of 1985 and its subsequent revisions; manuscripts deemed contrary to Islamic values, critical of the Islamic Republic, sexually explicit or favourable to monarchy, Baha'i belief or secularism are denied permits or ordered to make extensive cuts. Ershad has periodically purged entire publishers' back catalogues, requiring books already in print to be re-cleared — most aggressively after the 2005 election of Mahmoud Ahmadinejad. The 14 February 1989 fatwa issued by Ayatollah Khomeini against Salman Rushdie for The Satanic Verses imposed a death sentence on the author, his translators and publishers; Rushdie's Japanese translator Hitoshi Igarashi was murdered in 1991, his Italian translator stabbed and Norwegian publisher shot, and Rushdie himself was nearly killed on stage in New York in August 2022. Writers including Houshang Golshiri, Mahmoud Dowlatabadi, Simin Daneshvar and Shahrnoush Parsipour have had works banned for years at a time; the poet Hashem Shaabani was executed in 2014 for his writings in defence of Iran's Arab minority. Iran consistently ranks in the bottom ten of the Reporters Without Borders World Press Freedom Index.`,
  },

  {
    code: 'AU',
    name: 'Australia',
    description: `Australia operated one of the strictest book censorship regimes in the English-speaking world for most of the twentieth century. The Customs Act 1901 empowered customs officers to seize "blasphemous, indecent or obscene" material and, from 1933, a confidential Banned Books List was maintained; at its peak in the 1950s more than 5,000 titles were prohibited from import, including Lady Chatterley's Lover, Lolita, Catcher in the Rye, Brave New World, Ulysses, Norman Lindsay's Redheap (1930, written by an Australian), and Philip Roth's Portnoy's Complaint. Public outcry over the 1970 prosecution of Penguin Books for distributing Portnoy's Complaint effectively ended large-scale literary censorship. The Classification (Publications, Films and Computer Games) Act 1995 today empowers the Classification Board to refuse classification ("RC") to a publication, which is the legal equivalent of a ban; American Psycho was sold shrink-wrapped and restricted to over-18 sales for decades, and Bret Easton Ellis's novel was banned in Queensland from 1991 to 2011. Books glorifying terrorism, child abuse or drug use can be refused classification; The Peaceful Pill Handbook (euthanasia) and several Islamist titles have been banned in the 2000s. Australia consistently ranks in the top 30 of the World Press Freedom Index.`,
  },

  {
    code: 'KR',
    name: 'South Korea',
    description: `South Korea censored books heavily under successive military and authoritarian governments — Syngman Rhee (1948–1960), Park Chung-hee (1961–1979) and Chun Doo-hwan (1980–1987) — using the National Security Law (NSL, 국가보안법, 1948 and amendments) and Anti-Communist Law (1961) to prohibit any work deemed sympathetic to North Korea or the socialist bloc. Marx, Lenin, the works of the dissident poet Kim Chi-ha, novelist Hwang Sok-yong (imprisoned 1993–1998 for visiting Pyongyang), and the philosopher Ri Yong-hi all had titles banned. The Park government's 1975 Emergency Decree No. 9 made any criticism of the constitution itself an imprisonable offence. The 1987 democratic transition restored press freedom and the Constitutional Court has progressively narrowed the NSL, but the law remains in force: the Defence Ministry's 2008 "unfit-for-troops" list of 23 books — including Noam Chomsky's writings and Naomi Klein's The Shock Doctrine — was upheld by the Constitutional Court in 2010, and prosecutions for "praising the enemy" continue to be brought against book sellers and online commentators. South Korea ranks in the top 50 of the World Press Freedom Index but has slipped in recent years over media-law amendments and defamation prosecutions.`,
  },

  {
    code: 'ZA',
    name: 'South Africa',
    description: `Under apartheid (1948–1994) South Africa built one of the most legally formalised book censorship systems in the world. The Publications and Entertainments Act 1963 created a Publications Control Board with the power to declare any publication "undesirable"; the 1974 Publications Act replaced it with a system of publication committees and a final Publications Appeal Board, eventually banning more than 20,000 titles. Targets included the African National Congress's literature, Nelson Mandela's autobiographical writings, Black Consciousness texts by Steve Biko, novels by Nadine Gordimer (Burger's Daughter, 1979 — banned then unbanned within months), André Brink (Looking on Darkness, the first Afrikaans novel ever banned), Breyten Breytenbach, Dennis Brutus, Alex La Guma, Es'kia Mphahlele, Bessie Head and the entirety of the Drum magazine generation, as well as Lenin, Trotsky, Black Panther writings and even Anna Sewell's Black Beauty (briefly, due to the title). The Section 20(1)(c) "anti-state" clause was the standard catch-all. The Internal Security Act 1982 added further banning powers used against figures including Govan Mbeki. The 1996 Constitution's Bill of Rights guarantees freedom of expression in unusually broad terms, and the Films and Publications Act 1996 replaced banning with age-classification; formal book censorship has effectively ceased.`,
  },

  {
    code: 'AR',
    name: 'Argentina',
    description: `Argentina's military dictatorship known as the Process of National Reorganisation (Proceso de Reorganización Nacional, 1976–1983) banned thousands of books — among them works by Karl Marx, Sigmund Freud, Mario Benedetti, Eduardo Galeano, Julio Cortázar, Pablo Neruda, Antoine de Saint-Exupéry's Le Petit Prince (briefly, for alleged Marxist sympathies) and even Mafalda comic strips by Quino. Decree 538/77 banned Paulo Freire's Pedagogy of the Oppressed; the children's book La Torre de Cubos by Laura Devetach was banned in 1979 for "unlimited imagination". Booksellers were ordered to burn entire stocks: a notorious 24 June 1980 bonfire at the Centro Editor de América Latina warehouse in Avellaneda destroyed 1.5 million books and pamphlets. Roughly 30,000 people were "disappeared" during the dictatorship, among them writers, journalists and publishers — including Rodolfo Walsh, the journalist-novelist murdered by death squads in 1977 the day after publishing his Open Letter to the Military Junta. The return of democracy under Raúl Alfonsín in December 1983 ended formal censorship, and the 1994 constitutional reform entrenched freedom of expression. Argentina ranks in the upper half of the World Press Freedom Index, though concerns over media concentration and journalist safety persist.`,
  },

  {
    code: 'ID',
    name: 'Indonesia',
    description: `Under Suharto's New Order government (1966–1998), Indonesia's Attorney General's Office maintained an extensive list of banned books — at least 2,000 titles by 1998 — covering anything deemed communist, leftist, atheistic or threatening to national unity. The 1966 MPRS Decree XXV outlawed Marxism-Leninism and the Indonesian Communist Party (PKI); its provisions remain on the statute book. Pramoedya Ananta Toer, Indonesia's most internationally celebrated novelist, was imprisoned without trial on Buru Island from 1969 to 1979 and dictated the Buru Quartet (This Earth of Mankind, Child of All Nations, Footsteps, House of Glass) to fellow prisoners; the books were banned in Indonesia from 1981 until the post-Suharto Reformasi era. Books examining the 1965–66 anti-communist massacres in which 500,000–1,000,000 people were killed were also prohibited, including translations of John Roosa's Pretext for Mass Murder. The Attorney General's banning power was struck down by the Constitutional Court in 2010, but blasphemy convictions (under Article 156a of the Criminal Code) and the 2008 Information and Electronic Transactions (ITE) Law have since become the primary censorship instruments; Salman Rushdie's The Satanic Verses, books on Ahmadiyya theology, and works deemed to promote LGBT identity remain effectively unavailable.`,
  },

  {
    code: 'TR',
    name: 'Turkey',
    description: `Turkey has banned thousands of books under successive laws criminalising "insulting Turkishness" (Article 301 of the Penal Code, 2005, formerly Article 159), incitement to hatred (Article 216), separatist propaganda (Anti-Terror Law / Law 3713 of 1991) and insulting the President (Article 299). Works on the Armenian Genocide of 1915, Kurdish history and identity, Kemalism, and political Islam have been the most frequent targets. Nobel laureate Orhan Pamuk was prosecuted under Article 301 in 2005 for telling a Swiss newspaper that "thirty thousand Kurds and a million Armenians were killed in this country"; charges were dropped under EU pressure but private prosecutions continued. Elif Şafak was prosecuted in 2006 for The Bastard of Istanbul; Yaşar Kemal was repeatedly tried for his novels and journalism on the Kurdish question; the Armenian-Turkish editor Hrant Dink was prosecuted under Article 301 in 2005 and assassinated outside his Istanbul office in January 2007. After the July 2016 coup attempt, the post-coup state of emergency decrees closed 29 publishing houses and shut down or seized more than 150 media outlets; tens of thousands of books were pulped from public libraries, including titles by Fethullah Gülen's network, and journalists and writers were jailed in record numbers. Turkey ranks near the bottom of the World Press Freedom Index, typically below 150th.`,
  },

  {
    code: 'RU',
    name: 'Russia',
    description: `The Russian Empire's General Directorate for Press Affairs reviewed every book published in Russian from 1865 onwards, suppressing or expurgating works by Tolstoy (The Kreutzer Sonata, 1889), Dostoevsky, Chernyshevsky, Pushkin and Lermontov on grounds of religion, morality or political subversion; the Holy Synod added a parallel ecclesiastical censorship. Soviet censorship (1922–1991) operated through Glavlit and the Writers' Union (see Soviet Union). Post-Soviet Russia liberalised dramatically through the 1990s but reversed sharply under Vladimir Putin: Federal Law 114-FZ on extremism (2002) and the Federal List of Extremist Materials maintained by the Justice Ministry now run to more than 5,000 entries including Mein Kampf, Jehovah's Witness publications, Hizb ut-Tahrir literature and academic works on history; the "LGBT propaganda" laws of 2013 and 2023 (now extended to all ages, with the "LGBT movement" declared extremist) forced the withdrawal of hundreds of titles including young-adult fiction. The Foreign Agents Law (2012, expanded 2017 and 2022) brands independent writers and outlets as agents and requires onerous labelling. Since the 24 February 2022 invasion of Ukraine, Federal Law 32-FZ has criminalised "discrediting the armed forces" with sentences of up to fifteen years; bookshops have pulled titles by Boris Akunin, Lyudmila Ulitskaya, Dmitry Bykov and others now in exile. Russia ranks in the bottom ten of the World Press Freedom Index.`,
  },

  {
    code: 'ES',
    name: 'Spain',
    description: `Spain's longest period of literary censorship came under Francisco Franco's dictatorship (1939–1975). The Press Law of 22 April 1938, drafted by Ramón Serrano Suñer, imposed prior censorship of every printed text and was replaced by the 1966 Press Law (Ley Fraga), which substituted self-censorship under sweeping vaguely worded offences for the prior-permission regime but retained heavy penalties. The Catholic Church's Index of Prohibited Books continued to apply within Spain until 1966. The regime banned thousands of titles by Republican exiles — Rafael Alberti, Luis Cernuda, Jorge Guillén, Pedro Salinas, Max Aub, Francisco Ayala, Ramón J. Sender — and tightly restricted works in Catalan, Basque and Galician as part of Franco's policy of imposing a single Castilian Spanish national culture. Federico García Lorca had been executed by Nationalist forces in August 1936; his Romancero gitano remained partially censored. Camilo José Cela's La familia de Pascual Duarte (1942) was banned by Falangists shortly after publication; Miguel Delibes, Carmen Martín Gaite, Luis Martín-Santos (Tiempo de silencio) and the early novels of Juan Goytisolo all faced cuts or import bans. Censorship was formally abolished by Decree-Law 24/1977 in the months after Franco's death, and the 1978 Constitution entrenched freedom of expression in Article 20. Spain today consistently ranks in the upper third of global press freedom indices.`,
  },
]

async function main() {
  const { adminClient } = await import('../src/lib/supabase')
  const supabase = adminClient()

  console.log(`\n── import-wikipedia-countries-r6 (${APPLY ? 'APPLY' : 'DRY-RUN'}) ──\n`)
  console.log(`${UPDATES.length} countries to enrich:\n`)

  let changed = 0
  let unchanged = 0
  let errors = 0

  for (const upd of UPDATES) {
    const { data: existing, error: fetchErr } = await supabase
      .from('countries')
      .select('code, name_en, description')
      .eq('code', upd.code)
      .single()

    if (fetchErr || !existing) {
      console.log(`[${upd.code}] ${upd.name}: NOT FOUND in countries table — skip`)
      errors++
      continue
    }

    const oldLen = (existing.description ?? '').length
    const newLen = upd.description.length

    if ((existing.description ?? '').trim() === upd.description.trim()) {
      console.log(`[${upd.code}] ${upd.name}: identical — skip`)
      unchanged++
      continue
    }

    console.log(`[${upd.code}] ${upd.name}: ${oldLen} → ${newLen} chars`)
    console.log(`  before: ${(existing.description ?? '').slice(0, 100)}…`)
    console.log(`  after:  ${upd.description.slice(0, 100)}…`)

    if (APPLY) {
      const { error: ue } = await supabase
        .from('countries')
        .update({ description: upd.description })
        .eq('code', upd.code)
      if (ue) {
        console.error(`  ✗ ${ue.message}`)
        errors++
      } else {
        console.log(`  ✓ written`)
        changed++
      }
    }
    console.log('')
  }

  console.log(`\nSummary: ${changed} written, ${unchanged} unchanged, ${errors} errors.`)
  if (!APPLY) console.log('\nDRY-RUN — re-run with --apply to write.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
