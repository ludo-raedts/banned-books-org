/**
 * Batch 37 — descriptions for ~28 more books.
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
  ['the-land-of-green-plums',
    'Herta Müller\'s 1994 novel, narrated by one of five Romanian German friends navigating Ceaușescu\'s totalitarian state, depicts the surveillance, informers, and psychological disintegration that characterize life under the Securitate. Three of the five friends die in circumstances that the state rules suicide; the narrator survives by emigrating. Müller won the Nobel Prize in 2009; this is widely considered her masterpiece.'],

  ['the-power-and-the-glory',
    'Graham Greene\'s 1940 novel follows a "whisky priest" — the last Catholic priest in a Mexican state where the Church has been banned — as he is hunted by a leftist police lieutenant. The Mexican government banned it; it was also placed on the Catholic Index of Forbidden Books, where the Vatican found its portrait of a flawed, sinning priest insufficiently edifying. The contradiction said everything: a novel condemned by both the state persecuting its subject and the institution he represented.'],

  ['the-power-of-the-powerless',
    'Václav Havel\'s 1978 essay, written for a samizdat anthology in communist Czechoslovakia, argues that citizens living "within the truth" — refusing the small lies that maintain totalitarian power — can erode the system from within. The essay was smuggled to Poland and became a key text for Solidarity activists. Havel distributed it knowing he would be interrogated; the authorities found it so dangerous they imprisoned some of the samizdat distributors.'],

  ['the-prince-machiavelli',
    'Niccolò Machiavelli\'s 1532 handbook for princes — arguing that morality must sometimes yield to political effectiveness and that it is better for a ruler to be feared than loved — was placed on the Catholic Index of Forbidden Books in 1559, where it remained for centuries. Its frank acknowledgment that power operates by different rules than private ethics made it either a cynical justification for tyranny or the first work of modern political science, depending on who was reading it.'],

  ['the-quiet-american',
    'Graham Greene\'s 1955 novel set during the French-Vietnamese War follows a naive American CIA operative whose well-meaning interventions cause catastrophe, prefiguring America\'s involvement in Vietnam with unsettling accuracy. The CIA pressured the film adaptation of 1958 to alter the ending; the novel was effectively banned in South Vietnam by the pro-American government. Greene was accused of anti-Americanism; he considered it among his best novels.'],

  ['the-rainbow-dh-lawrence',
    'D.H. Lawrence\'s 1915 novel — following three generations of the Brangwen family from Victorian England through World War I — was prosecuted for obscenity in Britain shortly after publication; all 1,011 copies were destroyed by court order. The ban made the novel unpublishable in Britain until 1926. Its frank treatment of sexuality — including a lesbian relationship — and its rejection of industrial capitalism\'s dehumanization were equally objectionable to the prosecution.'],

  ['the-red-and-the-black',
    'Stendhal\'s 1830 novel of ambition follows Julien Sorel, a carpenter\'s son who uses seduction and calculated social performance to rise in Restoration France, only to destroy himself through an act of violent passion. The Catholic Church placed it on the Index of Forbidden Books for its sympathetic portrayal of social climbing through seduction and its critique of clerical hypocrisy. It is now regarded as the first great political novel of modern France.'],

  ['the-social-contract',
    'Rousseau\'s 1762 treatise arguing that legitimate political authority derives from a social contract among citizens — not from divine right or heredity — was burned by the Paris Parlement and banned in Geneva, where Rousseau had dedicated it. His argument that sovereignty resides in "the general will" of the people was used to justify both democratic revolution and totalitarian rule; it remains one of the most consequential and contested texts in political philosophy.'],

  ['the-palace-of-dreams',
    'Ismail Kadare\'s 1981 Albanian novel — set in the Ottoman Empire, where an entire Ministry exists to interpret the Sultan\'s dreams — was allowed by Enver Hoxha\'s government for a brief period before being banned when officials recognized its allegorical critique of Albania\'s own totalitarian interpretation of the leader\'s will. Kadare was briefly sent to a provincial "re-education" posting; the novel was rehabilitated after he published a socialist-realist work to restore his standing.'],

  ['the-palace-of-the-white-skunks',
    'Reinaldo Arenas\'s 1990 Cuban novel, written and rewritten across years in Cuba and completed in the United States, depicts a young man\'s coming of age in the last years of the Batista dictatorship through a hallucinatory mixture of voices and time frames. Like all of Arenas\'s work, it was banned in Cuba; he had been imprisoned and harassed for years for his homosexuality and his refusal to produce socialist literature.'],

  ['the-patience-stone',
    'Afghan-French author Atiq Rahimi\'s 2008 novel — winner of the Prix Goncourt — shows a woman caring for her comatose husband while speaking every truth she has suppressed through their marriage: his sexual failures, her desires, the reality of their lives under the Taliban. Banned in Afghanistan for its frank treatment of female sexuality and its implicit critique of Islamic gender relations. Written in French, Rahimi\'s adopted language after fleeing Afghanistan.'],

  ['the-noodle-maker',
    'Ma Jian\'s 2004 novel, structured as stories within stories told by two urban wanderers in contemporary China, depicts the absurd and brutal consequences of a society that has replaced political ideology with naked commercialism. Like Beijing Coma, it was banned in China for its frank portrayal of the post-Tiananmen world in which material success has been purchased with moral vacancy.'],

  ['the-open-sore-of-a-continent',
    'Wole Soyinka\'s 1996 account of Nigeria\'s descent into military dictatorship under Sani Abacha — who had just executed Ken Saro-Wiwa and eight other Ogoni activists — indicts not just Abacha but the international community\'s complicity through oil dependency. Soyinka fled Nigeria in 1994 after Abacha\'s government charged him with treason; he returned only after Abacha\'s death in 1998.'],

  ['the-oath-of-the-barbarians',
    'Boualem Sansal\'s 2008 Algerian novel, set in a fictional near-future Algeria dominated by an Islamist state, depicts the totalitarian logic of religious fundamentalism with the attention to bureaucratic detail of a dystopian classic. Sansal — Algeria\'s most prominent novelist — has faced death threats for his work; his novels are not sold in Algeria though they are occasionally tolerated. In 2024 he was arrested by Algerian authorities while traveling from France.'],

  ['the-protocols-of-the-elders-of-zion',
    'A fabricated antisemitic text purporting to document a Jewish conspiracy for world domination, created by the Russian Tsarist secret police around 1903, has been repeatedly exposed as a forgery yet continues to circulate globally. Banned in many countries for hate speech — Germany, France, Russia, Switzerland, and others — it remains in active circulation in parts of the Arab world, South America, and online. It catalogs itself here because censorship\'s record cannot be complete without the texts censors also use.'],

  ['the-seizure-of-power',
    'Czesław Miłosz\'s 1953 debut novel, written after his defection from communist Poland, depicts the Soviet-backed communists\' seizure of Poland at the end of World War II through the eyes of several characters caught in the political transformation. Published in Paris, it was banned in Poland until 1989. Miłosz won the Nobel Prize in 1980; his books were quietly circulated in Poland through the underground network that Solidarity made possible.'],

  ['the-second-chechen-war',
    'Anna Politkovskaya\'s 2003 account of Russian military conduct in Chechnya — the summary executions, the "filtration camps," the torture — was published in Russian and quickly banned from Russian military bases, where soldiers were forbidden to read it. It was one of several books Politkovskaya published on Chechnya before her assassination in 2006. She had been poisoned once before, on a flight to Beslan in 2004 during the school siege.'],

  ['the-power-of-the-powerless',
    'Already described — skip.'],

  ['the-genius-dreiser',
    'Theodore Dreiser\'s 1915 novel follows an artist whose sexual energy is simultaneously the source of his genius and his destruction. The New York Society for the Suppression of Vice had it declared obscene and pressured Dreiser\'s publisher to withdraw it from sale in 1916; it was not republished until 1923. The campaign against it mobilized a generation of American writers in defense of artistic freedom.'],

  ['the-power-and-the-glory',
    'Already described — skip.'],

  ['the-relaxant-approach',
    'Already described — skip.'],

  ['the-reluctant-fundamentalist',
    'Mohsin Hamid\'s 2007 novel, structured as one side of a conversation between a Pakistani man and a silent American stranger in Lahore, follows Changez\'s Ivy League education, his love affair, and his growing radicalization after 9/11. It was challenged in the US for its sympathetic treatment of a character who turns against America, and was briefly removed from reading lists in some Texas schools.'],

  ['the-shadow-of-arms',
    'Hwang Sok-yong\'s 1985 Korean novel about arms smuggling and corruption during the Vietnam War, told from the South Korean perspective, exposed aspects of Korean military involvement that the Korean government preferred not to discuss. Hwang was imprisoned for five years in South Korea in the 1990s — not for this novel but for making an unauthorized visit to North Korea. He is regarded as the most important Korean novelist of his generation.'],

  ['the-palace-of-dreams',
    'Already described — skip.'],

  ['speak-bird-speak-again',
    'Ibrahim Muhawi and Sharif Kanaana\'s 1989 collection of Palestinian folk tales, gathered from storytellers in villages and refugee camps across Israel, the West Bank, and Gaza, was banned in Israel for a period for its framing of Palestinian cultural identity and its implicit claim to a continuous Palestinian presence in the land. It is now recognized as one of the most important collections of Arabic oral literature.'],

  ['the-list-of-things-that-will-not-change',
    'Rebecca Stead\'s 2020 middle-grade novel follows Bea, whose parents are divorced, as she prepares for her father to marry his male partner while processing anxiety, friendship, and family change. Challenged in US school libraries for its positive depiction of same-sex marriage and for its matter-of-fact treatment of a nontraditional family structure.'],

  ['the-magic-fish',
    'Trung Le Nguyen\'s 2020 graphic novel follows Tiến, a Vietnamese-American teenager who reads fairy tales to his mother as a way to discuss his emerging identity and the things they cannot say directly. Challenged in US school libraries for its LGBTQ+ content. Its interweaving of fairy tale and immigration narrative was praised for capturing the emotional complexity of second-generation immigrant life.'],

  ['the-passing-playbook',
    'Isaac Fitzsimons\'s 2021 young adult novel follows Spencer, a transgender boy who moves to a new town and joins the soccer team, navigating identity, belonging, and the moment when his team\'s success comes into conflict with his privacy. Challenged in US school libraries for its depiction of a transgender protagonist and for its discussion of gender identity.'],
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
