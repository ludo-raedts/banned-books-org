/**
 * Batch 40 — descriptions for ~28 more books.
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

async function updateDescription(slug: string, description: string) {
  const { data: book } = await supabase.from('books').select('id, description').eq('slug', slug).single()
  if (!book) { console.log(`  [skip] ${slug}: not found`); return }
  if (book.description) { console.log(`  [skip] ${slug}: already has description`); return }
  const { error } = await supabase.from('books').update({ description }).eq('id', book.id)
  if (error) { console.log(`  ✗ ${slug}: ${error.message}`); return }
  console.log(`  ✓ ${slug}`)
}

const DESCRIPTIONS: [string, string][] = [
  ['zinky-boys',
    'Svetlana Alexievich\'s 1990 oral history — "zinky boys" refers to the zinc coffins in which Soviet soldiers were returned from Afghanistan — collects testimony from mothers, wives, veterans, and doctors about the Soviet-Afghan War that the state had been fighting while officially denying its human cost. The book provoked harassment campaigns against Alexievich in Belarus; some witnesses who had spoken to her recanted under pressure and sued her. She won the Nobel Prize in 2015.'],

  ['the-ukrainian-night',
    'Marci Shore\'s 2017 account of the Maidan Revolution of 2013-14 in Kyiv — the months of protest, the police violence, the snipers on the rooftops, the burning tires — draws on interviews with participants to reconstruct the moment of a people choosing to risk death for a different future. The book was banned in Russia. Its importance grew after Russia\'s 2022 full-scale invasion, which transformed the revolution it describes into the opening act of a larger catastrophe.'],

  ['the-untold-story-of-imelda-marcos',
    'Carmen Navarro Pedrosa\'s 1969 biography of Imelda Marcos, tracing her origins in provincial Philippines to her marriage to Ferdinand Marcos and her construction of a public personality from poverty and ambition, was among the books banned when Marcos declared martial law in 1972. Understanding Imelda as a political figure in her own right — not merely as the dictator\'s wife — was precisely what the regime wished to prevent.'],

  ['was-bleibt-christa-wolf',
    'Christa Wolf\'s 1990 novella — published in German as reunification was beginning — depicts a writer under Stasi surveillance in East Berlin: the watcher at the window, the fear that shapes every sentence. Written in 1979 but not published until 1990, it provoked a violent debate about whether East German writers had been complicit with the regime. Wolf was accused of betrayal by both sides; the controversy defined the post-Wall reckoning with GDR literary culture.'],

  ['we-are-the-ants',
    'Shaun David Hutchinson\'s 2016 young adult novel follows Henry, who has been abducted by aliens and told he must decide whether to press a button to save the Earth, while coping with the suicide of his boyfriend and his own suicidal ideation. Challenged in US school libraries for its depictions of same-sex relationships and its frank treatment of suicide and depression. Its argument that choosing to live is itself an act of resistance found a large readership among LGBTQ+ teenagers.'],

  ['we-killed-mangy-dog',
    'Luís Bernardo Honwana\'s 1964 Mozambican short story collection — depicting colonial Mozambique from the perspective of Black characters whose interior lives the Portuguese colonial order refused to recognize — was banned by the Portuguese colonial authorities. Honwana was imprisoned for political activities; the book was published in exile. After independence, he served as Minister of Culture in Mozambique\'s first government.'],

  ['what-if-its-us',
    'Becky Albertalli and Adam Silvera\'s 2018 young adult novel, following Arthur and Ben through a summer romance in New York City, was challenged in US school libraries for its depictions of gay teen relationships and sexual content. Albertalli is the author of Simon vs. the Homo Sapiens Agenda; Silvera is the author of They Both Die at the End. Their collaboration brought together two of the most challenged young adult authors in America.'],

  ['what-my-mother-doesnt-know',
    'Sonya Sones\'s 2001 young adult novel in verse, following Sophie\'s romantic confusions and explorations, was among the most frequently challenged books in US school libraries of the 2000s for its frank depictions of teenage sexuality. Written in accessible free verse that made it widely readable among reluctant readers, it was targeted in the same districts that challenged Judy Blume decades earlier for the same reasons.'],

  ['where-i-end-and-you-begin',
    'Preston Norton\'s 2021 young adult novel about two students — one transgender, one cisgender — who wake up in each other\'s bodies was challenged in US school libraries for its positive depiction of transgender identity. Its body-swap premise, borrowed from the lightest of pop genres, is used to make experiential arguments about gender dysphoria that direct narration could not achieve.'],

  ['whos-in-my-family',
    'Robie H. Harris\'s 2012 picture book depicting diverse family structures — single parents, same-sex parents, grandparents raising grandchildren — was challenged in US school libraries for its normalization of non-traditional family structures. Harris, also the author of the challenged sex education books It\'s Perfectly Normal and It\'s Not the Stork, has had more books challenged than almost any other children\'s author.'],

  ['women-without-men',
    'Shahrnush Parsipur\'s 1989 Iranian novel, following five women whose lives intersect in a Tehran garden, uses magical realism to depict female desire and independence under patriarchal constraints. Banned in Iran immediately after publication; Parsipur was imprisoned. Like Touba and the Meaning of Night, it was published underground and internationally; it is considered one of the most important works of Iranian feminist literature and was adapted into a film by Shirin Neshat.'],

  ['yolk',
    'Mary H.K. Choi\'s 2021 young adult novel about two estranged Korean-American sisters — one in college, one in fashion — brought together by a cancer diagnosis, was challenged in US school libraries for its frank depictions of eating disorders, sex, and substance use among teenagers. Choi\'s unflinching portrayal of the pressures on young Korean-American women found a wide and devoted readership.'],

  ['ye-burka-zemita',
    'Bealu Girma\'s 1984 Ethiopian novel — its title means "The Silence of the Abyss" — depicts the horrors of the Derg military dictatorship under Mengistu Haile Mariam through the story of characters disappeared, tortured, and killed by the regime. Girma, who worked for state media, was himself disappeared shortly after the book was published. He has never been heard from since. The novel circulated underground and in the Ethiopian diaspora.'],

  ['zero-ignacio-loyola-brandao',
    'Ignácio de Loyola Brandão\'s 1974 Brazilian experimental novel — a collage of newspaper clippings, bureaucratic language, and fragmented narrative depicting a society of total surveillance and degradation — was banned by the military dictatorship in 1975, two years after publication, when the censors finally understood what they had permitted. Brandão was one of Brazil\'s most persistently experimental writers; his work was repeatedly banned and his papers seized.'],

  ['after-ae',
    'Park Solmay\'s South Korean poetry collection, addressing the Korean War\'s legacies and the political tensions of divided Korea, was among the works targeted by the South Korean National Security Act, which has been used throughout the post-war period to suppress writing deemed sympathetic to North Korea or insufficiently anti-communist. The Act\'s broad application to literary works made it one of the most significant censorship instruments in East Asia.'],

  ['stray-memories',
    'Penelope Fitzgerald\'s writings and notebooks from her years of obscurity — before her remarkable late-career ascent to literary celebrity — capture the texture of mid-century English life with the quiet precision that would characterize her novels. Like many of her works, it circulated in limited editions before her reputation was established; it represents the kind of literary life that institutional censorship rarely reaches but market indifference effectively suppresses.'],

  ['the-mushroom-picker',
    'Stig Dagerman\'s Swedish prose — dark, experimental, and marked by existential despair — was circulated in limited editions in Sweden and suppressed in the Soviet bloc for its existentialist framework that was deemed incompatible with socialist realism. Dagerman, considered Sweden\'s greatest prose writer of the post-war generation, killed himself at 31; his complete works remained largely unknown outside Sweden until international translation efforts decades after his death.'],

  ['the-sleepless-world',
    'Awad Nassar\'s Arabic poetry from Egypt, exploring political repression and personal isolation under successive authoritarian governments, was suppressed in Egypt for its explicit critique of the state. Egyptian literary censorship has fluctuated in intensity across different governments; Nassar\'s work represents the category of politically engaged Arabic literature that circles around the edges of what censors tolerate in any given decade.'],

  ['the-essential',
    'Julia de Burgos\'s collected poems — written by Puerto Rico\'s greatest poet from the 1930s to her death in New York in 1953 — were suppressed in Puerto Rico under American colonial administration for their feminist and nationalist content, particularly her calls for Puerto Rican independence. De Burgos died in poverty in New York; her body was initially unidentified. She was recognized posthumously as one of the most important voices in Latin American poetry.'],

  ['the-deepest-breath',
    'Meg Grehan\'s 2019 Irish young adult novel in verse about two girls who fall in love was challenged for its LGBTQ+ content in both Irish school contexts and in US school libraries where it was introduced. Ireland\'s relationship with LGBTQ+ representation in young adult literature was complicated by the Catholic Church\'s continued influence on school governance, even after the 2015 same-sex marriage referendum.'],

  ['the-islamic-state-brief-intro',
    'Patrick Cockburn\'s 2015 journalistic account of the rise of ISIS, drawing on his years of reporting from Iraq and Syria, was banned or restricted in several Gulf states for its analysis of how Saudi Wahhabist ideology and Gulf money had contributed to ISIS\'s emergence. Cockburn\'s argument — that ISIS could not be understood without accounting for state sponsors among American allies — was unwelcome in the diplomatic context of the 2015 anti-ISIS coalition.'],

  ['the-mighty-heart-of-sunny-st-james',
    'Ashley Herring Blake\'s 2019 middle-grade novel about a girl who realizes she is bisexual after receiving a heart transplant was challenged in US school libraries for its positive depiction of bisexual identity and same-sex relationships among middle-school-aged characters. Blake\'s work was among the most challenged of the wave of LGBTQ+ middle-grade fiction published in the late 2010s.'],

  ['the-moon-within',
    'Aida Salazar\'s 2019 middle-grade verse novel, following a Mexican-American girl through her first period and her family\'s coming-of-age ceremony, was challenged in US school libraries for its frank depictions of puberty and menstruation and for its positive portrayal of a gender-nonconforming character. Salazar, a Chicana author, argued that the challenges were rooted in discomfort with both the biological candor and the racial cultural specificity of the book.'],

  ['the-quran-albania',
    'The Quran was banned in Albania under Enver Hoxha\'s hardline Stalinist government, which in 1967 declared Albania the world\'s first atheist state and suppressed all religious institutions and texts. Mosques, churches, and their libraries were destroyed; possessing religious texts of any kind was illegal and could result in imprisonment. The ban lasted until 1990, when the communist system collapsed. Albania had been majority Muslim for centuries.'],

  ['the-white-swan-express',
    'Jean Davies Okimoto and Elaine M. Aoki\'s 2002 picture book about adoptive families and Chinese adoption was challenged in US school libraries for its depiction of same-sex adoptive parents as a normal and loving family. The book was one of the earlier challenges in the wave of resistance to LGBTQ+ family representation in children\'s literature that accelerated in the 2010s and 2020s.'],

  ['inside-linda-lovelace',
    'Linda Lovelace\'s 1973 memoir, presenting her career in pornographic film as a story of sexual liberation, was prosecuted for obscenity in the UK. Her subsequent memoir Ordeal (1980) retracted everything, describing coercion and abuse — raising questions about what had been censored, and what had been consented to, throughout. The two books together became a reference point in feminist debates about pornography, consent, and what censorship protects or hides.'],

  ['high-times-encyclopedia',
    'The encyclopedic reference guide published by the cannabis culture magazine High Times, covering cultivation, use, and the politics of drug prohibition, was seized by customs and banned in various jurisdictions for promoting illegal drug use. High Times itself was repeatedly targeted by law enforcement in the 1970s and 1980s; its combination of explicit drug celebration and serious drug policy journalism made it an uncomfortable object for censors who wanted to distinguish between the two.'],

  ['frisk-dennis-cooper',
    'Dennis Cooper\'s 1991 novel, narrated by a gay man obsessed with violence and snuff fantasy, was seized by US customs as obscene and challenged in multiple libraries. Cooper\'s work — exploring the intersection of desire, violence, and abjection — was consistently targeted by censors who were genuinely disturbed by its contents. Its defenders argued that literature\'s function was precisely to enter psychic territories that polite discourse refuses; the debate about where transgression becomes harm was never resolved.'],
]

async function main() {
  let count = 0
  for (const [slug, desc] of DESCRIPTIONS) {
    await updateDescription(slug, desc)
    count++
  }
  console.log(`\nProcessed ${count} entries.`)

  const { count: noDesc } = await supabase.from('books').select('*', { count: 'exact', head: true }).is('description', null)
  console.log(`Books still without description: ${noDesc}`)
}

main().catch(console.error)
