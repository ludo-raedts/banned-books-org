/**
 * Batch 30 — descriptions for ~28 more books.
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
  ['footsteps-pramoedya',
    'The third volume of Pramoedya Ananta Toer\'s Buru Quartet, composed on Buru Island penal colony, follows journalist Minke into the emerging Indonesian nationalist movement at the turn of the 20th century as he loses his Dutch legal status and discovers the full weight of colonial law. The four-volume cycle was banned in Indonesia until after Suharto\'s fall in 1998.'],

  ['house-of-glass-pramoedya',
    'The final volume of Pramoedya Ananta Toer\'s Buru Quartet shifts perspective to Pangemanann, a native policeman assigned to surveil and destroy the nationalist movement from within. The most morally complex of the four books, it examines collaboration and complicity under colonialism. Pramoedya\'s imprisonment — and the ban on his work — lasted 27 years under Suharto.'],

  ['i-am-not-a-hero-wong',
    'Joshua Wong\'s 2017 memoir chronicles his emergence as the teenage face of Hong Kong\'s pro-democracy Umbrella Movement in 2014, when he was just seventeen. Co-founder of the Demosistō party, he was subsequently arrested multiple times and sentenced under the National Security Law. The book\'s frank account of organising for democratic rights made it unwelcome in Hong Kong\'s public libraries after the NSL.'],

  ['i-am-not-a-kid-wong',
    'Joshua Wong\'s account of his early activism and the formation of Scholarism, the student group he co-founded at age fourteen to oppose the Hong Kong government\'s plans to introduce national education — a curriculum Hong Kong parents saw as Chinese Communist Party indoctrination. The campaign succeeded in 2012 in halting the curriculum.'],

  ['goat-days',
    'Benyamin\'s 2008 Malayalam novel, based on the true story of Najeeb Muhammad, a Kerala migrant worker who spent three years as a virtual slave tending goats in the Saudi Arabian desert after being deceived by a labor trafficker. A devastating portrait of the kafala sponsorship system that traps millions of South Asian workers in the Gulf states. Banned in some Gulf countries.'],

  ['into-the-river-dawe',
    'Ted Dawe\'s 2012 New Zealand young adult novel follows Devon, a Māori teenager navigating life at an elite Auckland boarding school. It became the first book banned in New Zealand in 22 years in 2015, when a Christian lobby group obtained a court order preventing its supply to anyone under 14, later upgraded to an interim ban for all ages. The New Zealand public reacted with outrage; the ban was lifted after a review.'],

  ['god-is-red-liao-yiwu',
    'Already described — skip.'],

  ['jinnah-india-partition-independence',
    'Indian politician Jaswant Singh\'s 2009 biography of Muhammad Ali Jinnah, the founder of Pakistan, which controversially praised Jinnah while blaming Nehru and Patel for the Partition. Singh was expelled from the BJP for it, and the book was banned in Gujarat, where it was seen as an insult to Sardar Patel. The ban was challenged in court and eventually overturned.'],

  ['journals-of-resistance-theodorakis',
    'Mikis Theodorakis — whose music became the soundtrack of Greek resistance — kept these journals during the 1967–74 military junta. Arrested and held in concentration camps before international pressure secured his release, he continued to compose and organize from exile. The journals document both the personal experience of detention and the broader struggle against the colonels.'],

  ['justine-de-sade',
    'The 1787 prose version of Sade\'s Justine — shorter and less explicit than the 1791 novel — depicts the same philosophical argument through the misfortunes of its virtuous heroine. Written while Sade was imprisoned in the Bastille, it was confiscated by police on publication. Sade\'s philosophical libertinism — using fiction to argue that nature rewards cruelty — made him the most systematically suppressed writer of the Enlightenment era.'],

  ['ka-taslima-nasrin',
    'Taslima Nasrin\'s 1995 autobiographical novel, published in West Bengal after her exile from Bangladesh, uses explicit descriptions of sexual encounters to indict the hypocrisy of men who preach Islamic virtue while exploiting women. Both Bangladesh and West Bengal banned it; Indian courts upheld the ban under pressure from religious groups. Nasrin continued to live and write in European exile.'],

  ['kurdistan-an-interstate-colony',
    'Turkish sociologist İsmail Beşikçi\'s 1969 academic study of the Kurdish people\'s statelessness, analyzing Kurdistan as a colonial territory divided among Turkey, Iran, Iraq, and Syria. He spent nearly seventeen years in Turkish prisons for his publications on Kurdish identity — more time imprisoned than free between 1971 and 1999. His total prison sentences exceeded 100 years before amnesties.'],

  ['la-regente-de-carthage',
    'Nicolas Beau and Catherine Graciet\'s 2009 investigation of Leïla Trabelsi, wife of Tunisian president Zine El Abidine Ben Ali, and the corrupt business empire she and her family built through extortion and theft of state assets. Published in Paris after Tunisian publishers refused it, it was banned in Tunisia and helped build the international picture of the Ben Ali kleptocracy exposed by the Arab Spring.'],

  ['las-palabras-perdidas',
    'Jesús Díaz\'s 1992 novel, written after he left Cuba for Europe, follows a group of Havana intellectuals in the 1970s who become entangled in the regime\'s crackdown on independent thought following the Padilla Affair. Díaz had been one of Castro\'s cultural supporters; the novel marks his public break with the revolution. He was stripped of Cuban citizenship and died in exile in 2002.'],

  ['lee-kuan-yew-beliefs',
    'Michael D. Barr\'s 2000 scholarly biography of Lee Kuan Yew, Singapore\'s founding Prime Minister, examines the cultural and philosophical roots of his "Asian values" ideology and his authoritarian governing style. Singapore\'s government has long used defamation laws and other legal mechanisms against foreign publications critical of its leaders; this scholarly work faced distribution restrictions.'],

  ['les-120-journees-de-sodome',
    'Sade\'s 1785 manuscript, written on a 12-metre scroll of paper he smuggled out of the Bastille, describes four aristocrats who lock 46 victims in a remote castle and systematically enact every sexual act Sade could imagine, organized with bureaucratic precision. The scroll was lost during the storming of the Bastille and rediscovered only in the early 20th century. It remains the most extreme work in the Western literary canon.'],

  ['les-onze-mille-verges',
    'Guillaume Apollinaire\'s 1907 anonymously published erotic novel satirizes the fin-de-siècle Parisian bourgeoisie through spectacularly transgressive sexual content. Apollinaire denied authorship throughout his life. Prosecuted repeatedly for obscenity in France and banned across Europe and North America for most of the 20th century, it is now recognized as a significant early modernist text.'],

  ['lily-and-dunkin',
    'Donna Gephart\'s 2016 young adult novel follows two young protagonists — one a transgender girl, one a boy with bipolar disorder — navigating middle school in Florida. Challenged in US school libraries for its depiction of gender identity and its frank portrayal of mental illness. The dual perspective structure allows Gephart to show how marginalized young people learn to see and support each other.'],

  ['lord-horror',
    'David Britton\'s 1990 British novel set in an alternate history in which the Nazis won the war, featuring a figure based on the wartime fascist broadcaster Lord Haw-Haw committing extreme violence. The Manchester magistrates convicted Britton of obscenity and he served four months in prison; the book was the last novel to be prosecuted and destroyed under the UK Obscene Publications Act.'],

  ['magnus-hirschfeld-portrait',
    'Magnus Hirschfeld was the founder of the world\'s first gay rights organization and the pioneering researcher who coined the term "transvestite." His Institut für Sexualwissenschaft in Berlin was the first institution to advocate for homosexual and transgender rights. The Nazis burned its library in 1933 — one of the most famous book burnings in history — and Hirschfeld died in exile in 1935.'],

  ['footsteps-pramoedya',
    'Already described — skip.'],

  ['lucky-as',
    'Alice Sebold\'s 1999 memoir recounts her rape as a college freshman at Syracuse University, the investigation that followed, and the trial that ended in her rapist\'s conviction. Frank, survivor-centered, and written without protective distance, it was challenged in US schools for its graphic descriptions of sexual violence. A 2021 revelation that the convicted man was wrongly identified cast a shadow over the book.'],

  ['living-dead-girl',
    'Elizabeth Scott\'s 2008 novel is narrated by a fifteen-year-old girl who was kidnapped at age ten and has spent five years being abused by her captor. Written in a sparse, dissociated style that captures trauma\'s effect on identity, it was challenged in US school libraries for its subject matter — which critics argued was exactly why young readers needed access to it.'],

  ['i-will-marry-when-i-want',
    'Ngũgĩ wa Thiong\'o and Ngũgĩ wa Mĩriĩ\'s 1977 play in Gĩkũyũ depicts the exploitation of Kenyan peasants by land-owning elites and foreign capital. Performed by a community theatre group using villagers as actors, it was so successful the Kenyan government shut down the production and imprisoned Ngũgĩ for a year without trial. The experience led him to abandon English as a literary language.'],

  ['in-our-image',
    'Pulitzer Prize-winning journalist Stanley Karnow\'s 1989 history of American colonialism in the Philippines, from the suppression of the 1899 independence movement through the Marcos era. It won the Pulitzer Prize for History. In the Philippines it was seen as uncomfortably exposing the collaboration between Filipino elites and American colonial interests, which remained politically sensitive.'],

  ['hoa-kiau',
    'Pramoedya Ananta Toer\'s 1960 polemic on the situation of ethnic Chinese Indonesians, written after widespread anti-Chinese violence and forced relocation. Sukarno\'s government banned it. Pramoedya, who had spent years in a Dutch colonial prison and would later spend more years in Suharto\'s, defended the Chinese Indonesian community at a time when almost no Indonesian public figure would.'],

  ['imperialism-kotoku-shusui',
    'Kōtoku Shūsui\'s 1901 anti-war pamphlet, written at the height of Japanese nationalism during the Russo-Japanese War buildup, argued that imperialism served only the ruling class and that workers had no nation worth dying for. The Meiji government suppressed it; Kōtoku was eventually executed in 1911 on fabricated charges of plotting to assassinate the Emperor.'],

  ['in-the-name-of-honor',
    'Mukhtar Mai\'s 2006 memoir recounts how she was gang-raped in 2002 on the orders of a Pakistani village council as punishment for her younger brother\'s alleged offense — and how she refused to die of shame, instead using the compensation money to build schools. Her case became an international cause célèbre; the Pakistani government attempted to prevent her from traveling abroad to speak about it.'],
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
