/**
 * Batch 29 — descriptions for 28 more books, prioritising most-banned/most-known.
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
  ['les-miserables',
    'Victor Hugo\'s 1862 epic follows ex-convict Jean Valjean across decades of flight, redemption, and sacrifice in the tumultuous decades of early 19th-century France. The Catholic Church placed it on the Index of Forbidden Books for its sympathetic portrayal of a criminal, its critique of the Church\'s failures to the poor, and Hugo\'s republican politics. It became one of the bestselling novels in history.'],

  ['lajja',
    'Taslima Nasrin\'s 1993 novel — the title means "Shame" in Bengali — was written in eleven days in response to the Hindu minority\'s persecution in Bangladesh following the demolition of the Babri Masjid in India. Depicting the violence and terror experienced by a Hindu family, it was banned in Bangladesh within weeks. Fatwas were placed on Nasrin\'s head; she fled the country in 1994 and has lived in exile since.'],

  ['leaves-of-grass',
    'Walt Whitman\'s radical 1855 poetry collection, revised and expanded throughout his life, celebrated the human body, democracy, and America in long free-verse lines unlike anything published before. The 1881 edition was threatened with obscenity prosecution by the Boston District Attorney; Whitman\'s employer, the Department of the Interior, fired him for it. The notoriety drove sales.'],

  ['les-fleurs-du-mal',
    'Charles Baudelaire\'s 1857 poetry collection — The Flowers of Evil — explored beauty in sin, decay, and transgression with a precision that scandalized Second Empire France. The French government prosecuted him for obscenity and ordered six poems removed from subsequent editions. The suppressed poems circulated in Belgium; the conviction was not officially overturned until 1949, four decades after Baudelaire\'s death.'],

  ['life-and-fate',
    'Vasily Grossman\'s 1959 masterpiece on the Battle of Stalingrad draws an explicit parallel between Nazism and Stalinism — a comparison that ensured the KGB arrested the manuscript in 1961. The officer who came to seize it told Grossman the book could not be published "for two hundred or three hundred years." A microfilm copy was smuggled to the West and published in 1980, eighteen years after Grossman\'s death.'],

  ['germinal',
    'Émile Zola\'s 1885 novel, the thirteenth in the Rougon-Macquart cycle, follows a miners\' strike in northern France with documentary precision and revolutionary sympathy. The Tsarist Russian government banned it as incitement to class warfare. It was the first mainstream European novel to place the industrial proletariat at its center — and to suggest they might win.'],

  ['kolyma-tales',
    'Varlam Shalamov spent seventeen years in the Soviet Kolyma labour camps in the Far North. His short stories — composed from memory after his release and circulated in samizdat — are deliberately stripped of consolation: survival in Kolyma depended on moral compromises that destroyed the people who made them. Shalamov considered them a warning, not a testament. They are among the most important documents of the Gulag.'],

  ['i-am-malala',
    'Malala Yousafzai\'s 2013 memoir recounts her childhood in Pakistan\'s Swat Valley, where the Taliban banned girls from attending school and eventually shot her in the head on her school bus in 2012. She survived, became the youngest Nobel Peace Prize laureate, and the book she wrote — paradoxically — was banned by several Pakistani schools and right-wing groups for its portrayal of the country.'],

  ['i-write-what-i-like',
    'A collection of essays by Steve Biko, the founder of South Africa\'s Black Consciousness Movement, written between 1969 and 1972 under the pseudonym Frank Talk. Biko was banned by the apartheid government from publishing or speaking publicly; these essays circulated underground. He was arrested, tortured, and beaten to death in police custody in September 1977, aged 30.'],

  ['i-rigoberta-menchu',
    'Rigoberta Menchú\'s 1983 testimonial, told to anthropologist Elisabeth Burgos-Debray, documents the violence of Guatemala\'s military campaigns against the indigenous Maya Quiché community during the civil war — including the killing of her father, mother, and brother. She won the Nobel Peace Prize in 1992. The book was later attacked by anthropologist David Stoll as containing fabrications, sparking an ongoing debate about testimony, memory, and truth.'],

  ['heart-of-a-dog',
    'Mikhail Bulgakov\'s 1925 satirical novella, in which a Soviet scientist transplants a human pituitary gland and testicles into a stray dog, producing a Soviet citizen of terrifying vulgarity. Bulgakov read it aloud at literary gatherings before the secret police confiscated the manuscript in 1926; it was not published in the Soviet Union until 1987.'],

  ['human-landscapes-from-my-country',
    'Nâzım Hikmet\'s unfinished verse epic, composed while he was imprisoned in Turkish jails between 1938 and 1950, is one of the great long poems of the 20th century — a panorama of Turkish life narrated through the voices of prisoners, villagers, and workers sharing a train journey. Hikmet\'s works were banned in Turkey for decades after his escape to the Soviet Union in 1951.'],

  ['gypsy-ballads-lorca',
    'Federico García Lorca\'s 1928 collection fuses Andalusian Romani culture with surrealism, bringing the duende — the dark spirit of Spanish art — into modern poetry. His work was banned under Franco\'s regime following his murder in the first weeks of the Spanish Civil War; he was shot by Nationalist forces near Granada in August 1936 at the age of 38. His grave has never been officially located.'],

  ['fuera-del-juego',
    'Heberto Padilla\'s 1968 poetry collection — Out of the Game — won Cuba\'s national poetry prize despite being denounced by the official jury as counterrevolutionary. The Castro government then arrested Padilla in 1971, imprisoning him for 38 days until he confessed to "ideological crimes" in a show confession modeled on Stalinist practice. The Padilla Affair ended support for the Cuban revolution among many leftist intellectuals worldwide.'],

  ['justine-or-misfortunes-of-virtue',
    'Marquis de Sade\'s 1791 novel follows virtuous Justine through a series of encounters with libertines who reward her goodness with abuse, making the philosophical case that nature rewards cruelty and punishes virtue. Published clandestinely, it was confiscated by police repeatedly. Sade spent much of his adult life in prison, and the word "sadism" derives from his name.'],

  ['lysistrata',
    'Aristophanes\'s 411 BC comedy — written during the disastrous Peloponnesian War — depicts Athenian and Spartan women withholding sex until their husbands agree to make peace. Its frank discussion of sexuality led to its suppression at various times; it was among the books banned by US customs in the 1920s, along with other ancient classics deemed obscene.'],

  ['god-dies-by-the-nile',
    'Egyptian feminist novelist and psychiatrist Nawal El Saadawi\'s 1974 novel exposes the violent oppression of women in an Egyptian village, where the mayor and the Sheikh abuse their authority to destroy a peasant family. Banned in Egypt, it was published in Beirut. El Saadawi faced death threats, was fired from the Egyptian Ministry of Health, and had her name placed on a fundamentalist death list — yet continued writing until her death in 2021.'],

  ['girls-of-riyadh',
    'Rajaa Alsanea\'s 2005 debut novel, written as a series of anonymous emails, follows four young Saudi women navigating love, marriage, and the rigid gender codes of Saudi upper-class society. It was banned in Saudi Arabia for two years before being permitted with revisions; the original Beirut edition circulated underground. The author was 24 when it was published.'],

  ['looking-on-darkness',
    'André Brink\'s 1974 Afrikaans novel — the first Afrikaans novel to be banned by the South African government — follows a Cape Coloured actor who has an affair with a white woman, ending in violence. Brink defied the censorship board by publishing an English translation the same year; the act of translating his own work into the oppressor\'s language was itself a political statement.'],

  ['last-exit-to-brooklyn',
    'Hubert Selby Jr.\'s 1964 novel, set among dockworkers, prostitutes, and drug addicts in the Red Hook neighbourhood of Brooklyn, was prosecuted for obscenity in the United Kingdom following a private member\'s bill in the House of Lords. The 1967 trial became a landmark free speech case; Selby won on appeal in 1968. The book\'s unflinching depictions of gang rape, addiction, and a transgender woman\'s tragedy were unlike anything published before.'],

  ['letters-concerning-the-english-nation',
    'Voltaire\'s 1733 comparative essay praised English religious toleration, empirical philosophy, and parliamentary government — implicitly criticizing France\'s absolutism and the Catholic Church\'s power. The Paris Parlement ordered it burned and issued a warrant for Voltaire\'s arrest. He fled Paris, beginning a pattern of exile that would define his life. The book is credited with introducing Locke and Newton to France.'],

  ['leviathan-hobbes',
    'Thomas Hobbes\'s 1651 philosophical masterwork argues for a powerful sovereign as the only solution to the "war of all against all" in the state of nature. It was condemned by both Parliament and the Church — the former for its materialist philosophy, the latter for its argument that religion should be subordinate to the state. Oxford University burned it; it remained on the Catholic Index until 1966.'],

  ['july-s-people',
    'Nadine Gordimer\'s 1981 novel imagines a near-future South Africa in the aftermath of a Black uprising, where a white liberal family has fled to the village of their servant July. A study in dependency, power, and the liberal delusions of privileged whites, it was banned by the apartheid government and later, briefly, challenged in post-apartheid schools for its language.'],

  ['23-years',
    'Ali Dashti\'s 1974 critical examination of the historical Muhammad and the origins of Islam, arguing that many hadith are unreliable and that the Quran contains linguistic errors incompatible with divine authorship. Written by a prominent Iranian senator and published abroad, it was suppressed after the Islamic Revolution. Dashti was arrested in 1979 and died in custody in 1982 or 1983 under disputed circumstances.'],

  ['haji-agha-hedayat',
    'Sadegh Hedayat\'s 1945 satirical novella depicts a hypocritical Iranian landlord who performs religious piety while exploiting his tenants and collaborating with foreign interests. Published at a moment of relative Iranian press freedom, Hedayat\'s sharp satires of clerical and bourgeois corruption made him enemies in all directions. He died by suicide in Paris in 1951; his books were banned after the Islamic Revolution.'],

  ['kolyma-tales',
    'Already described — skip.'],

  ['i-served-the-king-of-england',
    'Bohumil Hrabal\'s 1971 novel — published only in samizdat in Czechoslovakia — follows a small-minded, ambitious waiter who rises through Czech society from the First Republic through the Nazi occupation and into the communist era, blind to the historic catastrophes happening around him. One of the masterpieces of Central European comic literature.'],

  ['in-praise-of-hatred',
    'Syrian novelist Khaled Khalifa\'s 2006 novel, told through the eyes of a young woman growing up in Aleppo in the 1980s as her family is drawn into the Muslim Brotherhood\'s conflict with Assad\'s Ba\'ath regime — the Hama massacre looming in the background. Banned in Syria, it was shortlisted for the International Prize for Arabic Fiction.'],
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
