/**
 * Batch 27 — descriptions for 26 more books.
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
  ['blubber',
    'Judy Blume\'s 1974 novel confronts bullying with uncomfortable honesty: Linda is relentlessly tormented by her classmates for being overweight, while the narrator Jill participates rather than intervenes. Unlike most children\'s literature of the era, the bullying goes largely unchallenged and unpunished. Blume\'s unflinching realism made it a perennial target of school challenges.'],

  ['burma-diary',
    'George Orwell\'s first novel, written from his experience as a British colonial police officer in Burma in the 1920s, follows a conflicted timber merchant who witnesses the ugliness of empire from within. Published in 1934 and largely ignored at the time, it prefigures all his later work in its clear-eyed examination of power and self-deception.'],

  ['choke-cp',
    'Chuck Palahniuk\'s 2001 novel follows Victor Mancini, a sex addict who stages choking incidents in restaurants to extract money from the strangers who save him. A darkly comic exploration of shame, dependency, and the lies we construct around identity. Challenged in US schools for sexual content and language.'],

  ['child-of-all-nations',
    'The second volume of Pramoedya Ananta Toer\'s Buru Quartet, composed while the author was imprisoned on the Buru Island penal colony under Suharto\'s New Order regime, follows young journalist Minke as he encounters the full scope of Dutch colonial exploitation in 1900s Java. Pramoedya dictated the novels to fellow prisoners before paper was allowed.'],

  ['el-filibusterismo',
    'José Rizal\'s 1891 sequel to Noli Me Tángere is darker and more revolutionary: the idealistic Crisostomo Ibarra returns in disguise as the jeweler Simoun, plotting violent insurrection against the Spanish colonial regime in the Philippines. The Spanish authorities banned it and used it as evidence at Rizal\'s trial; he was executed by firing squad in 1896, aged 35.'],

  ['embers-sandor-marai',
    'Sándor Márai\'s 1942 masterpiece pits two old men against each other in a candlelit castle — a general who has waited forty-one years for his estranged friend to return, and the friend who finally comes to face the question that has hung between them. Márai fled Hungary in 1948 when the communists took power; his works were banned and his name erased from Hungarian literary history until after his suicide in 1989.'],

  ['endgame-ahmet-altan',
    'Turkish journalist and novelist Ahmet Altan was arrested after the 2016 coup attempt and sentenced to life in prison, accused of sending "subliminal messages" via a TV appearance. He wrote this novel while on trial. A meditation on a writer\'s imprisonment told through alternating time streams, it was published abroad while Altan remained incarcerated.'],

  ['epitaphios-ritsos',
    'Yannis Ritsos\'s 1936 poem, written in grief after the massacre of striking tobacco workers by Greek police in Thessaloniki, became an anthem of the Greek left. The Metaxas dictatorship banned it and had copies publicly burned in 1936. Set to music by Mikis Theodorakis in 1958, it became one of the most beloved Greek songs of the 20th century.'],

  ['escape-from-camp-14',
    'Journalist Blaine Harden\'s account of Shin Dong-hyuk, the only known person to escape from a North Korean "total control zone" — a political prison camp where he was born and where he lived his entire childhood, witnessing executions including that of his own mother. One of the most harrowing documents of daily life inside the North Korean gulag system.'],

  ['family-limitation',
    'Margaret Sanger\'s 1914 pamphlet, quietly distributed through radical labor networks, explained birth control methods in plain English to working-class women. Publishing and distributing it was a federal crime under the Comstock Act. Sanger fled to Europe to avoid prosecution, returning after charges were dropped, and went on to found what became Planned Parenthood.'],

  ['for-bread-alone',
    'Mohamed Choukri\'s autobiography, written in Moroccan Arabic and first translated into English by Paul Bowles in 1973, chronicles a childhood of extraordinary violence and poverty — hunger, abuse, homelessness, prostitution — in Tangier. The visceral honesty of his self-portrayal made it one of the most banned books in the Arab world, considered obscene and morally dangerous.'],

  ['clap-when-you-land',
    'Elizabeth Acevedo\'s 2020 dual-narrative novel in verse follows two teenage girls — one in the Dominican Republic, one in New York — who discover each other after the plane crash that kills the father neither knew was living a double life. Challenged in US schools for language and sexual content, it won the Pura Belpré Award.'],

  ['de-monarchia-dante',
    'Dante\'s 1313 political treatise arguing for a universal secular monarchy independent of papal authority — the Emperor\'s power derived directly from God, not from the Pope. The Church promptly banned it; it appeared on the Index of Forbidden Books for over three centuries. For Dante, the corruption of the Church\'s political power was the root of Italy\'s suffering.'],

  ['droll-stories',
    'Balzac\'s 1832–37 collection of thirty bawdy tales set in the Touraine, written in mock-archaic French and celebrating sensuality, adultery, and clerical hypocrisy with gleeful abandon. Prosecuted for obscenity in France, and banned or challenged repeatedly in the English-speaking world for over a century — which only enhanced their reputation.'],

  ['bones-chenjerai-hove',
    'Zimbabwean novelist Chenjerai Hove\'s 1988 novel, told in a poetic, allusive style that reflects the rhythms of oral Shona storytelling, follows a woman searching for her husband who disappeared into the liberation war. A meditation on the cost of Zimbabwe\'s independence on ordinary people, particularly women. Hove eventually went into voluntary exile after his criticism of Mugabe\'s government.'],

  ['clandestine-poems-dalton',
    'Roque Dalton was El Salvador\'s greatest poet and a committed revolutionary who was executed in 1975 — not by the government, but by his own guerrilla faction, who accused him of being a CIA agent. Published posthumously, these poems combine political urgency with playful formal experimentation, and Dalton\'s murder remains one of the left\'s darkest self-inflicted wounds.'],

  ['conversations-in-sicily',
    'Elio Vittorini\'s 1941 novel, originally serialized in a Fascist journal before being suppressed, follows a Milanese worker returning home to Sicily and gradually awakening from political numbness through conversations with the people he encounters. Written in an oblique, almost musical prose that slipped past the censors for a time, it became a touchstone of Italian anti-Fascist literature.'],

  ['dwikhandita',
    'The second volume of Taslima Nasrin\'s autobiography, meaning "Split in Two," chronicles the period surrounding the 1971 Bangladesh Liberation War and its aftermath. Banned in Bangladesh after the Nasrin controversies of the 1990s, when fundamentalist groups placed a fatwa on her head following the publication of Lajja. Nasrin has lived in exile since 1994.'],

  ['boy-james-hanley',
    'James Hanley\'s 1931 novel follows a thirteen-year-old boy who runs away to sea and is brutally sexually assaulted. Written with unflinching directness, it was prosecuted for obscenity in Britain in 1934, and copies were destroyed by order of a Manchester magistrate. The prosecution effectively ended the first edition and damaged Hanley\'s career for years.'],

  ['de-monarchia-dante',
    'Already described above.'],

  ['dialektik-ohne-dogma',
    'East German physicist Robert Havemann published these 1963–64 lectures — arguing for a humane, reformist socialism over Stalinist dogma — against the explicit orders of the SED regime. He was expelled from the party, fired from his professorship, and his telephone was tapped for the next sixteen years. The lectures circulated in samizdat throughout the Eastern Bloc.'],

  ['from-hell-alan-moore',
    'Alan Moore and Eddie Campbell\'s 1991–96 graphic novel presents the Ripper killings through the perspective of Freemason surgeon Sir William Gull, constructing an elaborate theory of Masonic conspiracy while immersing the reader in the rank poverty of Whitechapel. One of the most researched and footnoted graphic novels ever published, challenged in US libraries for graphic violence and sexual content.'],

  ['el-filibusterismo',
    'Already described — skip.'],

  ['explicit-material-au',
    'Clive Hamilton\'s 2008 book examining the failure of Australian internet filtering policy to actually protect children from harmful material online, while charting the rise of online pornography. Challenged and briefly restricted in Australia for its frank discussion of pornographic content — an irony noted by critics who argued the government was blocking analysis of its own failures.'],

  ['fields-of-castile-machado',
    'Antonio Machado\'s 1912 poetry collection, meditations on the austere landscape of Castile that became central texts of Spanish national identity, was banned under Franco\'s regime because Machado — one of Spain\'s greatest poets — had backed the Republic in the Civil War. He died in French exile in February 1939, days after crossing the border as the Republic collapsed.'],

  ['escape-from-camp-14',
    'Already described — skip.'],
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
