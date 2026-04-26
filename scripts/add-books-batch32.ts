/**
 * Batch 32 — descriptions for ~28 more books.
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
  ['the-origin-of-species',
    'Darwin\'s 1859 argument that all species of life descended from common ancestors through natural selection was placed on the Vatican\'s Index of Forbidden Books and denounced from pulpits across the English-speaking world for contradicting Genesis. It was banned in Yugoslavia in 1935 and burned by the Nazis. The Scopes "Monkey Trial" of 1925 — testing whether evolution could be taught in Tennessee schools — demonstrated that the controversy was still alive sixty-six years later.'],

  ['persepolis',
    'Marjane Satrapi\'s 2000–2003 autobiographical graphic novel recounts growing up in Iran during the Islamic Revolution, the Iran-Iraq War, and her teenage years in Europe. Its clear-eyed account of how revolution can consume its own children made it essential reading and a target: banned in Chicago public schools in 2013 (later reinstated) and in several countries in the Middle East for its depictions of torture, religious hypocrisy, and female resistance.'],

  ['oryx-and-crake',
    'Margaret Atwood\'s 2003 speculative novel, set in a post-pandemic world caused by a bioengineered plague, is narrated by the possibly-last human survivor piecing together how the world ended. The first in the MaddAddam trilogy, it extrapolates current trends in genetic engineering, corporate sovereignty, and social stratification to their logical conclusions. Challenged in US schools for language and sexual content.'],

  ['putins-russia',
    'Russian journalist Anna Politkovskaya\'s 2004 investigation of war crimes in Chechnya and the criminalization of the Russian state under Putin was published while she was receiving death threats. She was shot dead in the elevator of her Moscow apartment building on October 7, 2006 — Putin\'s birthday. The Russian authorities denied involvement; no one with authority over the gunman was ever convicted.'],

  ['reading-lolita-in-tehran',
    'Azar Nafisi\'s 2003 memoir of the secret literature seminar she held with seven female students after resigning from the University of Tehran, where she had refused to wear a veil. The group read Nabokov, Fitzgerald, James, and Austen. Nafisi uses their readings to illuminate what it means to live under a regime that tries to control the imagination. Banned in Iran, it became a global bestseller.'],

  ['patriot-navalny',
    'Alexei Navalny\'s prison memoir, published posthumously in 2024, was written from Russian penal colonies where he spent his final years. Russia\'s most prominent opposition leader, he was first poisoned with Novichok in 2020, survived, returned to Russia, and was imprisoned until his death in February 2024 in the Arctic penal colony IK-6 Melekhovo. The book\'s title reflects his central argument: that he, not Putin, was the true patriot.'],

  ['petals-of-blood',
    'Ngũgĩ wa Thiong\'o\'s 1977 novel, his last in English, follows four characters in a small Kenyan town as they journey to Nairobi in the post-independence years and discover that the colonial system has merely been replaced by a local elite. Ngũgĩ was arrested without charge the day after its publication and held for a year. The experience led him to abandon English as a literary language and write exclusively in Gĩkũyũ.'],

  ['paradise-of-the-blind',
    'Dương Thu Hương\'s 1988 Vietnamese novel, the first to be published in the US in English translation, follows three women across North Vietnam during collectivization and into the market-reform era. Banned in Vietnam for its depiction of Communist Party corruption and collectivization\'s human cost, it was published in France and the US while its author was imprisoned for seven months without trial.'],

  ['one-sentence-about-tyranny',
    'Gyula Illyés\'s 1950 poem, written immediately after a performance of Bartók\'s Bluebeard\'s Castle, remained unpublished until 1956 when it appeared briefly in a Hungarian literary journal during the brief thaw before the Soviet invasion. Its extended catalog of how tyranny penetrates every aspect of life — bed, table, family, silence — made it one of the defining poems of the communist era in Eastern Europe.'],

  ['my-century-aleksander-wat',
    'Polish poet Aleksander Wat\'s extended oral memoir, recorded in conversations with Czesław Miłosz in Berkeley in 1965, covers his journey from Warsaw futurism through commitment to communism, arrest by the Soviet NKVD in 1940, years in Soviet prisons and Kazakhstan, and eventual disillusionment. One of the great testimonies to the intellectual\'s entanglement with and destruction by totalitarianism.'],

  ['niki-story-of-a-dog',
    'Tibor Déry\'s 1956 short novel, written by a Hungarian communist who had become disillusioned with Stalinism, follows a dog whose owner is imprisoned for vague political offenses. Published just before the Hungarian Uprising, it was read as a transparent allegory of life under the Rákosi regime. Déry was arrested after the uprising and sentenced to nine years; he was released in 1960 following international pressure from writers.'],

  ['not-out-of-hate',
    'Ma Ma Lay\'s 1955 Burmese novel follows a young woman caught between traditional family expectations and the freedoms offered by modernization, set in the final years of British colonialism. One of the most influential Burmese women writers of the 20th century, Ma Ma Lay\'s work navigated the difficult space between colonial modernity and national tradition. Her later writing was suppressed under Ne Win\'s military dictatorship.'],

  ['nine-hours-to-rama',
    'Stanley Wolpert\'s 1962 novel depicts the final hours before the assassination of Mahatma Gandhi, following both the assassin Nathuram Godse and Gandhi himself through January 30, 1948. The Indian government banned it for its sympathetic portrayal of Godse\'s psychology and its implicit critique of the Indian National Congress government\'s failures. The ban was applied to both the book and the 1963 film adaptation.'],

  ['once-a-jolly-hangman',
    'British journalist Alan Shadrake\'s 2010 investigation of Singapore\'s use of mandatory death sentences for drug trafficking, profiling the country\'s hangman and exposing inconsistencies in how the death penalty was applied to foreigners and locals. Singapore\'s Attorney General charged Shadrake with "scandalising the court"; he served five weeks in prison. The episode drew international attention to Singapore\'s extraordinary sensitivity to legal criticism.'],

  ['opera-wonyosi',
    'Wole Soyinka\'s 1977 Brechtian satire, a Nigerian adaptation of The Beggar\'s Opera, aimed at the kleptocracy of military ruler Olusegun Obasanjo\'s Nigeria. Soyinka was Nigeria\'s most prominent playwright and later Nobel laureate; he had already been imprisoned without charge during the Biafran War. His caustic treatments of Nigerian military and political corruption made him a perpetual target of successive governments.'],

  ['oliver-twist',
    'Dickens\'s 1838 novel depicting the criminal underworld of London through the eyes of an orphan boy was condemned for its vivid portrayal of criminals as sympathetic figures. Its character of Fagin — a Jewish fence and teacher of child pickpockets — has been criticized since publication as antisemitic, leading to challenges and modifications in various adaptations. The BBC serialization was challenged for its depictions of child abuse.'],

  ['girls-in-their-married-bliss',
    'The third book in Edna O\'Brien\'s Country Girls trilogy, published in 1964, follows Kate and Baba into London adulthood, marriage, and disillusionment. All three books in the trilogy were banned in Ireland by the Censorship Board as "in general tendency indecent." O\'Brien has said that copies were burned in her home parish in County Clare. Her treatment of female desire and Catholic hypocrisy made her a particular target of Irish censorship.'],

  ['philosophical-dictionary-voltaire',
    'Voltaire\'s 1764 alphabetically-arranged compendium of Enlightenment arguments — against intolerance, superstition, and the Church — was written in part during his time as Frederick the Great\'s court philosopher in Prussia. The Paris Parlement ordered it burned; it was banned across Catholic Europe and placed on the Index of Forbidden Books. Voltaire published it anonymously and denied authorship until his death.'],

  ['peyton-place',
    'Grace Metalious\'s 1956 debut novel, set in a small New England town and exposing the hypocrisy beneath its respectable surface — incest, abortion, rape, class snobbery — was rejected by nine publishers before finding one willing to print it. It sold 60,000 copies in the first ten days, spent 59 weeks on the bestseller list, and was banned in several US states and in Canada. Metalious, a struggling housewife, became briefly famous and famous for her refusal to be respectable.'],

  ['ragazzi-di-vita',
    'Pier Paolo Pasolini\'s 1955 debut novel, written in Roman working-class dialect, follows young men in the post-war Roman borgate — the slum outskirts — through petty crime, odd jobs, and survival. Prosecuted for obscenity in Italy in 1955, the case was eventually dropped. Pasolini was already marked by the Italian establishment: he had been expelled from the Communist Party for homosexuality in 1949. He was murdered in 1975 in circumstances that remain disputed.'],

  ['republic-of-fear',
    'Kanan Makiya\'s 1989 scholarly examination of the Ba\'ath Party\'s systematic use of terror in Iraq — published under the pseudonym Samir al-Khalil because Makiya feared reprisals — was the first detailed account in English of Saddam Hussein\'s methods. Written before the first Gulf War, it was read after the invasion of Kuwait as essential context. Makiya later controversially supported the 2003 US invasion.'],

  ['pensees-pascal',
    'Blaise Pascal\'s unfinished defense of Christian faith — collected posthumously from loose papers in 1670 — is one of the great works of European prose. The Jesuits placed it on the Index of Forbidden Books for Pascal\'s fierce attacks on Jesuit casuistry and his insistence that faith was a matter of the heart rather than clever argument. The "Pascal\'s Wager" argument for belief appears here for the first time.'],

  ['pamela-or-virtue-rewarded',
    'Samuel Richardson\'s 1740 epistolary novel — the first great work of English fiction — follows servant girl Pamela whose virtue in resisting her employer\'s repeated attempts at seduction is eventually rewarded when he proposes marriage. Its erotic charge beneath the moral surface was immediately noticed: Henry Fielding\'s parody Shamela appeared within months, and the novel was banned in several European countries.'],

  ['red-dust-ma-jian',
    'Ma Jian\'s 1990 memoir of three years wandering through remote Tibet and China following his breakup with a woman and disillusionment with Beijing\'s cultural bureaucracy. Banned in China for its frank portrayal of rural poverty, official corruption, and Tibetan culture. Ma Jian, already under surveillance by the time he completed it, left China in 1987 before the book was published.'],

  ['reborn-farrokhzad',
    'Forough Farrokhzad\'s 1964 poetry collection — her last before her death at 32 in a car crash — is considered the high point of modern Persian poetry. Her frank exploration of female desire, divorce, and the body had already brought condemnation from Iranian conservatives; these later poems moved beyond personal experience toward visionary social critique. She is now regarded as the greatest Iranian poet of the 20th century.'],

  ['reconciliation-bhutto',
    'Benazir Bhutto\'s final book, completed just before her return to Pakistan in 2007, argues for a reconciliation between Islam and democracy. She was assassinated at a political rally in Rawalpindi on December 27, 2007, two months after her return from eight years of exile. Pakistan\'s Inter-Services Intelligence was widely suspected of involvement; the official investigation produced no convincing conclusion.'],

  ['paper-towns',
    'John Green\'s 2008 mystery novel follows Quentin\'s obsessive search for Margo Roth Spiegelman, the girl next door who disappeared after one night of adventure. Like all of Green\'s novels, it uses the quest structure to examine how we construct fantasies about other people. Challenged in US schools for language and for a brief scene involving alcohol, it has also been acclaimed for its honest treatment of teenage imagination and self-deception.'],
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
