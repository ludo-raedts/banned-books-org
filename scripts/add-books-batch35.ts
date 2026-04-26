/**
 * Batch 35 — descriptions for ~28 more books.
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
  ['the-country-girls',
    'Edna O\'Brien\'s 1960 debut novel follows two young women escaping the suffocating pieties of rural Ireland for Dublin. The Censorship Board of Ireland banned it within months; O\'Brien\'s own parish priest publicly burned a copy. All three novels in the Country Girls trilogy were banned; O\'Brien eventually moved to London permanently. Her frank depiction of female desire and Catholic hypocrisy defined a generation of Irish women\'s experience.'],

  ['the-crime-of-father-amaro',
    'José Maria de Eça de Queirós\'s 1875 Portuguese novel — one of the first works of realism in Portuguese literature — follows a young priest who seduces a devout girl, resulting in her death. The Catholic Church condemned it as a scandalous attack on the clergy; the Portuguese government debated banning it. Its frank depiction of clerical corruption and hypocrisy gave it a permanent place in the most-challenged books of the Iberian tradition.'],

  ['the-death-of-artemio-cruz',
    'Carlos Fuentes\'s 1962 Mexican novel follows a dying newspaper magnate whose life story — told in shifting time frames — is simultaneously a history of post-Revolutionary Mexico\'s corruption and betrayal of its ideals. One of the masterpieces of the Latin American Boom, it was suppressed in Mexico under political pressure from powerful families who recognized themselves in its portraits of corruption.'],

  ['the-descent-of-man',
    'Darwin\'s 1871 sequel to On the Origin of Species, which explicitly applied evolutionary theory to human beings and argued for common ancestry with other primates, provoked even greater religious outrage than its predecessor. It was banned by various religious authorities and, more practically, excluded from many school curricula. Its arguments about sexual selection and the biological basis of human moral behavior remain contentious in some communities today.'],

  ['the-factory-ship',
    'Takiji Kobayashi\'s 1929 Japanese proletarian novel about the brutal labor conditions aboard a crab-canning ship in the North Pacific — written from left-wing labor organizing traditions — was immediately suppressed by Japan\'s military government. Kobayashi was arrested in 1933 and tortured to death by police within hours of his detention, becoming a martyr of Japanese proletarian literature. The novel had a surprise bestseller revival in Japan in 2008.'],

  ['the-fat-years',
    'Chan Koonchung\'s 2009 Chinese-language dystopian novel is set in a near-future China where the population has been sedated with a drug that makes them experience inexplicable contentment during a period of history that has been erased from memory. Written in Beijing, it was published in Hong Kong and Taiwan but circulates in mainland China only as a samizdat file. Its central metaphor — the forgetting of a specific month — refers to events the author cannot name.'],

  ['the-first-circle',
    'Aleksandr Solzhenitsyn\'s 1968 novel, set in a Stalinist research prison for scientists and intellectuals, was submitted to Soviet publishers in a censored version and published in the West in its original form. The KGB seized his papers in 1965; the full novel appeared in Russian only in 2006. Named for the first circle of Dante\'s Hell — reserved for the virtuous pagans, the most comfortable of the damned — it is among the most comprehensive portraits of the Gulag system.'],

  ['the-forty-rules-of-love',
    'Elif Şafak\'s 2009 novel interweaves a contemporary woman\'s story with a historical narrative about the friendship between the medieval Sufi poet Rumi and his spiritual guide Shams of Tabriz. Banned in several countries in the Arab and Muslim world for its mystical approach to Islamic spirituality, which conservative authorities found heterodox. Like Şafak\'s other novels, it was prosecuted under Turkish law for its treatment of religious and cultural identity.'],

  ['the-foundation-pit',
    'Andrei Platonov\'s 1930 Soviet novella — written but not submitted for publication because Platonov knew it would be banned — follows workers digging an enormous foundation pit for a house that represents the utopian promise of communism, a pit that keeps expanding while nothing is built. One of the great works of 20th-century Russian literature, it was published in the Soviet Union only in 1987.'],

  ['the-garden-party-havel',
    'Václav Havel\'s 1963 absurdist play satirizes the bureaucratic language of communist Czechoslovakia through the story of a young man who rises through the system by mastering its meaningless idiom until he has no personality left. One of the first works that established Havel — later President of Czechoslovakia and the Czech Republic — as a dissident playwright; his works were banned after the 1968 Soviet invasion.'],

  ['the-general-in-his-labyrinth',
    'Gabriel García Márquez\'s 1989 novel imagines the last journey of Simón Bolívar as he travels down the Magdalena River toward exile and death. It was controversial in several Latin American countries for its demythologizing of the Liberator, portraying him as physically failing, politically abandoned, and humanly frail. Venezuela, where Bolívar is a secular deity, received it with particular discomfort.'],

  ['the-general-of-the-dead-army',
    'Ismail Kadare\'s 1963 debut novel follows an Italian general sent to Albania to retrieve the bones of soldiers killed in World War II, discovering the full weight of the occupation\'s crimes through the families he encounters. Albania\'s communist leader Enver Hoxha was suspicious of the novel but allowed its publication; subsequent Kadare works were banned, and he eventually defected to France in 1990.'],

  ['the-ginger-man',
    'J.P. Donleavy\'s 1955 novel of an American law student\'s drunken, womanizing, and financially reckless existence in Dublin was banned in Ireland and in the US for obscenity. Published in Paris by the Olympia Press — which also published Lolita and Lady Chatterley\'s Lover — it circulated as a contraband classic for years before eventually winning critical acceptance as a comic masterpiece of post-war bohemian literature.'],

  ['the-god-of-small-things',
    'Arundhati Roy\'s 1997 debut novel, set in Kerala, depicts the lives of twins whose family is destroyed by the collision of caste rules, communism, and untouchable love. It won the Booker Prize and was immediately challenged in India for its sexual content — specifically, the relationship between an upper-caste woman and an "Untouchable" man. Roy was charged with obscenity in Kerala; the charges were eventually dropped.'],

  ['the-argumentative-indian',
    'Amartya Sen\'s 2005 collection of essays — by the Nobel Prize-winning economist — argues that India\'s tradition of internal debate, pluralism, and reasoned disagreement is as central to its identity as its religious diversity. Banned in Pakistan for its pro-India framing and its treatment of the subcontinent\'s partition history. Its argument that democracy is a universal value, not a Western imposition, made it unwelcome in several authoritarian states.'],

  ['the-corpse-walker',
    'Liao Yiwu\'s 2008 oral history collects interviews with people at the margins of Chinese society — the corpse walker, the professional mourner, the leper, the former landowner, the underground church elder, the Tiananmen survivor — whose lives are systematically erased from official Chinese history. Banned in China, where Liao Yiwu remained under surveillance until his escape in 2011.'],

  ['the-butcher-boy',
    'Patrick McCabe\'s 1992 Irish novel follows Francie Brady, a troubled boy from a small Irish town, through the collapse of his family into a mental breakdown that ends in violence. Written in Francie\'s own unstable voice — where fantasy and reality blur without warning — it is a forensic portrait of Irish Catholic small-town life in the 1960s. Challenged in Ireland for its violence and its black portrait of Irish social institutions.'],

  ['the-comedians-greene',
    'Graham Greene\'s 1966 novel, set in Haiti under the Tonton Macoutes and François Duvalier\'s dictatorship, was immediately banned by the Haitian government and provoked a formal protest from the Haitian ambassador to Britain. Duvalier himself wrote a pamphlet attacking Greene as "a liar, a cretin, a stool-pigeon, and a spy." Greene wore the insults with some pride.'],

  ['the-case-worker',
    'György Konrád\'s 1969 Hungarian novel, narrated by a Budapest social worker overwhelmed by the impossibility of his work in a system that generates more misery than it can address, was tolerated by Hungarian authorities for a time before being effectively suppressed. Konrád — one of Hungary\'s most important intellectuals — was a leader of the democratic opposition and was arrested and interrogated multiple times.'],

  ['the-canary-and-other-tales-of-martial-law',
    'Marek Nowakowski\'s 1982 collection of short stories about life in Poland under martial law — declared by General Jaruzelski in December 1981 to crush Solidarity — circulated in samizdat and was published officially only after 1989. Nowakowski\'s terse, direct prose captured the everyday texture of surveillance, arrest, and fear that defined the martial law period.'],

  ['the-clergymen-daughter',
    'George Orwell\'s 1935 second novel follows a clergyman\'s daughter who loses her faith and wanders through English society — hop-picking, teaching, living as a vagrant — without finding solid ground. Orwell was deeply dissatisfied with it and refused to allow it to be reprinted after its initial publication. It was banned in several countries for its frank treatment of faith and sexuality.'],

  ['the-conjugal-dictatorship',
    'Primitivo Mijares\'s 1976 exposé of Ferdinand and Imelda Marcos\'s kleptocracy and authoritarianism in the Philippines, written by a former Marcos propaganda chief who defected. Marcos attempted to suppress the book internationally; Mijares disappeared shortly after its publication and was never seen again, presumed killed by the Marcos security apparatus. The book documented the scale of the Marcos theft before Filipinos had a full picture of it.'],

  ['the-forty-rules-of-love',
    'Already described — skip.'],

  ['the-corpse-walker',
    'Already described — skip.'],

  ['the-girl-with-seven-names',
    'Hyeonseo Lee\'s 2015 memoir recounts her escape from North Korea at 17, her twelve years hiding in China as an illegal immigrant, and her eventual resettlement in South Korea — and her return to China to rescue her mother and brother. One of the most vivid accounts of daily life inside North Korea and the extraordinary difficulty of escape, it introduced millions of Western readers to the realities of the Kim regime.'],

  ['the-epic-of-sheikh-bedreddin',
    'Nâzım Hikmet\'s 1936 long poem about an Ottoman-era Islamic-communist revolutionary who led a peasant uprising in the 15th century was written while Hikmet was imprisoned for "inciting naval officers to read communist literature." The Turkish state banned virtually all his works; he spent eleven years in prison before international campaigns secured his release. He spent the rest of his life in Soviet exile.'],

  ['the-fear-peter-godwin',
    'British journalist Peter Godwin\'s 2010 account of Zimbabwe during the violent period following the 2008 elections, when Mugabe\'s ZANU-PF used systematic violence to reverse a clear electoral defeat by Morgan Tsvangirai\'s MDC. Godwin, a Zimbabwean-born journalist, describes witnessing the violence while evading Mugabe\'s security services. The book is banned in Zimbabwe.'],

  ['the-fugitive-pramoedya',
    'Pramoedya Ananta Toer\'s 1950 novel — one of his earliest — is set during the Indonesian revolution against the Dutch. Like most of Pramoedya\'s work, it was banned in Indonesia for long periods: first under Sukarno for its independent political perspective, then for 27 years under Suharto\'s New Order regime. Pramoedya himself was imprisoned for fourteen years on the Buru Island penal colony.'],
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
