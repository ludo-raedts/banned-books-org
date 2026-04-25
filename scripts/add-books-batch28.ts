/**
 * Batch 28 — descriptions for ~28 more books.
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
  ['hopscotch-cortazar',
    'Julio Cortázar\'s 1963 experimental novel can be read in two ways: linearly, as the story of an Argentine expatriate in Paris and Buenos Aires, or in a scrambled order using a "Table of Instructions." A landmark of the Latin American Boom, it was suppressed in Cortázar\'s native Argentina under the military dictatorships for its radical formal and political sensibility.'],

  ['kiss-of-the-spider-woman',
    'Manuel Puig\'s 1976 novel unfolds entirely in dialogue between two Buenos Aires cellmates: a gay window dresser and a Marxist revolutionary. The revolutionary is contemptuous of his cellmate\'s taste for Hollywood escapism; through their shared storytelling, both are changed. Banned under Argentina\'s military dictatorship, it later became a celebrated film and Broadway musical.'],

  ['kobzar-shevchenko',
    'Taras Shevchenko\'s 1840 poetry collection established modern Ukrainian literary language and became the foundational text of Ukrainian national consciousness. The Tsarist government banned it, sentenced Shevchenko to serve as a common soldier, and specifically forbade him from writing or drawing for ten years. His suffering only deepened his symbolic importance to Ukraine.'],

  ['in-the-country-of-men',
    'Hisham Matar\'s 2006 debut novel, set in Gaddafi\'s Libya, is narrated by nine-year-old Suleiman, who begins to understand the terror that governs his world as his father\'s dissident activities draw the attention of the secret police. Based partly on Matar\'s own childhood; his father was abducted in Cairo in 1990 and disappeared into Libyan prisons.'],

  ['the-story-of-zahra',
    'Lebanese novelist Hanan al-Shaykh\'s 1980 novel follows Zahra, a scarred and fragile woman moving between war-torn Beirut and a revolutionary Arab country in exile, finding an unexpected freedom in the chaos of the Lebanese Civil War. Banned across the Arab world for its frank depiction of female sexuality, it is one of the most important novels of the Arab feminist tradition.'],

  ['i-the-supreme',
    'Augusto Roa Bastos\'s 1974 masterpiece is an interior monologue of José Gaspar Rodríguez de Francia, Paraguay\'s Supreme Dictator from 1814–1840, examining the nature of absolute power through the despot\'s own documents, orders, and self-justifications. Written in exile in Argentina, it was banned by Paraguay\'s Stroessner dictatorship as subversive.'],

  ['son-of-man-roa-bastos',
    'Augusto Roa Bastos\'s 1960 novel, structured as interconnected stories spanning a century of Paraguayan history from the colonial era to the Chaco War, depicts the suffering of the poor with mythological force. Banned under the Stroessner dictatorship along with all of Roa Bastos\'s works; he spent nearly forty years in exile.'],

  ['they-burn-the-thistles',
    'The second novel in Yaşar Kemal\'s Memed, My Hawk cycle, following the bandit hero\'s further battles against the feudal landowners of the Taurus Mountains. Kemal, Turkey\'s greatest novelist and a three-time Nobel nominee, was repeatedly prosecuted for his political and cultural writings; his works were banned in Turkey for decades.'],

  ['the-monk-matthew-lewis',
    'Matthew Lewis\'s 1796 Gothic shocker follows Ambrosio, a celebrated Spanish monk whose spiritual pride collapses into rape, murder, incest, and diabolism. Published when Lewis was nineteen, it was an immediate scandal and bestseller. Attacked from pulpits and in Parliament, it was revised under pressure to remove its most inflammatory passages, though copies of the original circulated widely.'],

  ['zemestan-akhavan-sales',
    'Mehdi Akhavan Sales\'s 1956 poetry collection — its title means "Winter" — is one of the masterworks of modern Persian verse, using classical forms to express the bleak aftermath of the 1953 CIA-backed coup that overthrew Prime Minister Mosaddegh and restored the Shah. The collection was suppressed under the Shah and later under the Islamic Republic.'],

  ['stalingrad-grossman',
    'Vasily Grossman\'s 1952 novel about the Battle of Stalingrad, the precursor to his masterpiece Life and Fate, was initially celebrated by Soviet authorities and then fell into disfavor. Where Life and Fate was arrested by the KGB, Stalingrad was merely censored into compliance — the gap between the two novels reveals how Grossman\'s disillusionment with the Soviet project deepened.'],

  ['god-is-red-liao-yiwu',
    'Liao Yiwu\'s 2011 oral history documents the underground Christian church in China through interviews with believers who have survived persecution across multiple eras — land reform, the Cultural Revolution, and the crackdowns of the 1990s and 2000s. Liao escaped China in 2011 by crossing into Vietnam on foot; he has lived in Berlin since.'],

  ['hopscotch-cortazar',
    'Already described — skip.'],

  ['the-land-of-spices',
    'Kate O\'Brien\'s 1941 novel, set in a Belgian convent school in early 20th-century Ireland, includes a single sentence describing a man embracing another man "in an embrace of love." The Censorship Board of Ireland banned it on grounds of obscenity for this one sentence. The ban was eventually lifted in 1971 — thirty years after publication.'],

  ['formosa-betrayed',
    'American diplomat George Kerr\'s 1965 account of the 228 Incident — the February 28, 1947 massacre in which the Kuomintang government killed tens of thousands of Taiwanese civilians — and the subsequent decades of White Terror under martial law. Banned in Taiwan until democratization, it was a key text for the Taiwanese independence movement.'],

  ['fractured-destinies',
    'Palestinian novelist Rabai al-Madhoun\'s 2015 novel tells the story of a Palestinian family dispersed by the Nakba across continents, weaving between multiple narrators and time periods to reconstruct a community\'s loss. It won the International Prize for Arabic Fiction in 2016 and was banned in several Arab countries for its unconventional narrative approach to the Palestinian experience.'],

  ['amar-meyebela',
    'The first volume of Taslima Nasrin\'s autobiography — the title means "My Girlhood" in Bengali — chronicles her childhood in Bangladesh with unflinching honesty about the violence, religious coercion, and oppression of women in Muslim middle-class society. After the fatwas and riots following her 1994 novel Lajja, Nasrin fled Bangladesh; this memoir was banned there.'],

  ['angarey',
    'This 1932 Urdu short story collection by four young writers — including Sajjad Zaheer, Ahmad Ali, and Rashid Jahan — shocked British India with its attacks on religious hypocrisy, caste, and gender oppression in Muslim society. The British colonial government banned it for obscenity within months; the authors were threatened with violence by religious mobs. It launched the Progressive Writers\' Movement.'],

  ['el-monte-lydia-cabrera',
    'Cuban anthropologist Lydia Cabrera\'s 1954 encyclopedic study of Afro-Cuban religious traditions — Santería, Palo Monte, and Abakuá — based on decades of fieldwork with practitioners. The Castro revolution dismissed these traditions as superstition; Cabrera went into exile in Miami in 1960. Her work is now recognized as the foundational document of Afro-Cuban cultural studies.'],

  ['feliz-ano-novo',
    'Rubem Fonseca\'s 1975 Brazilian short story collection, infamous for its violence and explicit sexuality, was banned by the military dictatorship of General Geisel months after publication. The title story follows two slum dwellers planning a robbery on New Year\'s Eve; the collection\'s unflinching realism about Brazilian poverty and crime made the military government deeply uncomfortable.'],

  ['em-camara-lenta',
    'Renato Tapajós\'s 1977 Brazilian novel about a generation of leftists who took up arms against the military dictatorship, written partly from prison experience. One of the most direct fictional treatments of armed resistance and torture under the regime, it was immediately seized by the dictatorship\'s censors and its author detained.'],

  ['ate-amanha-camaradas',
    'A novel by Manuel Tiago — the pen name of Álvaro Cunhal, leader of the Portuguese Communist Party — written during his twelve years in Salazar\'s prisons. Published in 1974 just after the Carnation Revolution that ended the Estado Novo dictatorship, it was one of the first works to document the lives of communist resisters under Salazar.'],

  ['autobiografia-de-federico-sanchez',
    'Jorge Semprún\'s 1977 autobiographical novel examines his years as a secret communist organizer inside Francoist Spain — he used the alias Federico Sánchez — and the growing disillusionment that led to his expulsion from the Spanish Communist Party. Written after Franco\'s death, it won the Premio Planeta and was a reckoning with the moral costs of political commitment.'],

  ['campo-cerrado-max-aub',
    'Max Aub\'s 1943 novel, first in his Magic Labyrinth cycle, follows a young man\'s political awakening in Spain during the 1920s and 1930s leading to the Civil War. Aub fled Spain after the Republican defeat; his novels were banned under Franco, and he spent the rest of his life in Mexican exile, unable to return to Spain until a brief visit in 1969.'],

  ['axion-esti',
    'Odysseas Elytis\'s 1959 long poem — its title means "Worthy It Is" in Greek — is a celebration of light, sea, and Greek civilization structured as a Byzantine liturgy. Winner of the Nobel Prize in 1979, it was composed partly during the years when the Greek junta banned his work, and its final publication became a symbol of Greek cultural resilience.'],

  ['agostino-moravia',
    'Alberto Moravia\'s 1944 novella follows thirteen-year-old Agostino\'s traumatic sexual awakening during a summer holiday, precipitated by his mother\'s love affair and his encounters with street boys. The Catholic Church placed virtually all of Moravia\'s work on the Index of Forbidden Books; Mussolini\'s censors had earlier prevented him from publishing under his real name.'],
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
