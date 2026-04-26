/**
 * Batch 31 — descriptions for ~28 more books.
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
  ['mein-kampf',
    'Adolf Hitler\'s 1925 autobiography and political manifesto, written during his imprisonment after the failed Beer Hall Putsch, outlines his racial ideology, antisemitism, and vision of German expansion. After World War II it was banned in Germany, Austria, and many other countries for decades. Its 2015 German re-publication with scholarly annotations, following the expiry of Bavaria\'s copyright, sparked fierce debate about whether annotation neutralizes the text\'s danger.'],

  ['open-veins-of-latin-america',
    'Eduardo Galeano\'s 1971 sweeping indictment of five centuries of European and American exploitation of Latin America became one of the defining texts of the Latin American left. Banned by military dictatorships in Brazil, Argentina, and Uruguay after 1973. Galeano himself was imprisoned and exiled. Hugo Chávez\'s gift of a copy to Barack Obama at the 2009 Summit of the Americas sent it to the top of Amazon\'s bestseller list overnight.'],

  ['my-name-is-red',
    'Orhan Pamuk\'s 2001 novel, set in 16th-century Ottoman Istanbul, investigates the murder of a miniaturist through multiple narrators including the corpse itself. A meditation on the clash between Eastern and Western artistic traditions, identity, and faith. Pamuk won the Nobel Prize in 2006; he had already been prosecuted in Turkey under Article 301 for stating that "thirty thousand Kurds and a million Armenians were killed in these lands" — a charge eventually dropped.'],

  ['memoirs-neruda',
    'Pablo Neruda\'s 1974 autobiography, published posthumously days after his death — possibly hastened by the shock of Pinochet\'s coup that killed his friend Allende. Neruda was Chile\'s greatest poet and a committed communist; his writings were banned by the Pinochet regime, which also confiscated his houses and destroyed his library. The memoir is characteristically sensual, political, and defiant.'],

  ['memory-for-forgetfulness',
    'Palestinian poet Mahmoud Darwish\'s 1982 prose meditation on a single day during the Israeli siege of Beirut — August 6th, Hiroshima Day — weaves between the immediacy of bombardment and longer meditations on exile, memory, and Palestinian identity. Darwish, who could not return to Israel after joining the PLO, became the unofficial poet laureate of the Palestinian people.'],

  ['married-love',
    'Marie Stopes\'s 1918 guide to sexual satisfaction and birth control in marriage, written for couples who received no sex education, was immediately condemned by the Catholic Church and refused by numerous British publishers. It sold out within a fortnight of its first publication. Stopes followed it with a clinic providing free birth control advice to working-class women — the first in Britain — and spent decades fighting censorship and religious opposition.'],

  ['matigari',
    'Ngũgĩ wa Thiong\'o\'s 1987 allegorical novel in Gĩkũyũ follows a freedom fighter who, having buried his weapons after independence, searches for "truth and justice" in post-colonial Kenya only to find the country\'s resources captured by a new elite in alliance with foreign capital. Kenya\'s security forces issued a warrant for the arrest of the novel\'s protagonist — before realizing he was fictional. Ngũgĩ left Kenya and did not return for 22 years.'],

  ['marks-of-identity',
    'Juan Goytisolo\'s 1966 novel — the first in his Álvaro Mendiola trilogy — is a formal assault on Francoist Spain through the fragmented memories of an exile in Paris, mixing voices, times, and modes of address. Goytisolo, Spain\'s greatest experimental novelist, lived in voluntary exile from 1956 until Franco\'s death; his novels were banned in Spain for their homosexual content and political critique.'],

  ['morning-in-jenin',
    'Susan Abulhawa\'s 2010 debut novel follows four generations of a Palestinian family from their village in 1948 through the refugee camps of Jenin and into the diaspora, structured around the Nakba and the 2002 Israeli military operation in Jenin. Banned in several Arab countries for its frank portrayal of suicide bombing, it was nevertheless widely read throughout the Arab world.'],

  ['mother-courage-and-her-children',
    'Bertolt Brecht\'s 1941 anti-war play follows a canteen woman who follows the Thirty Years\' War with her wagon, profiting from the conflict while losing all three of her children to it. Written in Brecht\'s exile from Nazi Germany, it was first performed in neutral Zurich. East Germany\'s SED government, which should have been Brecht\'s patron, was uncomfortable with his insistence on staging the play without a heroic conclusion.'],

  ['midnight-in-the-century',
    'Victor Serge\'s 1939 novel, written in exile after his expulsion from the Soviet Union, follows Trotskyist prisoners and exiles in Soviet Central Asia as they wrestle with whether resistance is still possible in a system that has consumed revolution. Serge had been a committed anarchist and Bolshevik who witnessed the revolution\'s corruption from within; his novels were banned in the USSR and in France by communist publishers.'],

  ['misery-stephen-king',
    'Stephen King\'s 1987 novel, in which romance novelist Paul Sheldon is held captive by his "number one fan" Annie Wilkes after a car accident, was challenged in US school libraries for language and violence. King has said it is partly about his own struggle with addiction — Annie is his drug of choice, demanding one more book. It remains his most allegorically transparent work.'],

  ['moll-flanders',
    'Daniel Defoe\'s 1722 novel, narrated by a woman who survives poverty through theft, prostitution, and multiple marriages, was regularly condemned for its frank depiction of female criminality and sexuality. Despite presenting itself as a moral cautionary tale, readers grasped that Moll\'s ingenuity and resilience were the actual point. It was banned by US customs in the 1930s along with other 18th-century classics.'],

  ['nada-carmen-laforet',
    'Carmen Laforet\'s 1944 debut novel — winner of Spain\'s inaugural Nadal Prize — follows a young woman arriving in post-war Barcelona to study, living in a decaying apartment with her ruined family. The city and the household are haunted by the Civil War\'s consequences without ever naming them directly; the oblique approach was the only way to publish truthfully under Francoism. It was one of the first great novels of the post-war Spanish novel.'],

  ['napoleon-le-petit',
    'Victor Hugo\'s 1852 political pamphlet, written immediately after Louis-Napoleon\'s coup d\'état, demolishes the new Emperor through savage irony and moral indignation. Hugo smuggled the manuscript to Brussels for publication, then sent 5,000 copies into France hidden inside barrels, busts of Napoleon I, and bales of hay. He lived in exile for nineteen years rather than accept Napoleon III\'s amnesty.'],

  ['no-enemies-no-hatred',
    'Liu Xiaobo\'s collected essays and poems, published abroad in 2012 while he was serving an eleven-year prison sentence for "inciting subversion." Co-author of Charter 08 — China\'s democracy manifesto — Liu was awarded the Nobel Peace Prize in 2010; his chair at the Oslo ceremony was left empty. He died in state custody in 2017, the first Nobel Peace laureate to die in government hands since Carl von Ossietzky under the Nazis.'],

  ['novel-without-a-name',
    'Vietnamese novelist Dương Thu Hương\'s 1995 account of the Vietnam War, narrated by a soldier who has spent ten years fighting a war he increasingly cannot understand, was banned in Vietnam for its refusal to mythologize the conflict. Dương had herself fought as a volunteer and spent seven years in prison for her political writings; she was expelled from the Communist Party and lived under house arrest for years.'],

  ['on-islam-kasravi',
    'Ahmad Kasravi\'s 1944 critical examination of Islamic practice and Shiite orthodoxy in Iran, arguing that religious superstition kept Iranians poor and subjugated. Kasravi was a lawyer, historian, and one of Iran\'s most original secular thinkers. He was assassinated in 1946 by members of the Fedayan-e Islam, a radical Islamist group, in the Tehran courthouse where he was being tried for blasphemy.'],

  ['one-thousand-and-one-nights',
    'The Arabic story collection known in English as the Arabian Nights — incorporating Persian, Indian, and Arab tales accumulated over centuries — has been banned or restricted repeatedly across the Arab world for its erotic content, including the frame story of Scheherazade\'s thousand and one nights of storytelling. Its English translations by Edward Lane (expurgated) and Richard Burton (unexpurgated) set off Victorian censorship battles of their own.'],

  ['oromay',
    'Bealu Girma\'s 1983 Ethiopian novel, a biting satire of the Derg military regime\'s propaganda and incompetence during the famine years, was published just as the government was organizing its "1984 revolution" celebrations. Girma was a senior official in the state media; shortly after publication, he disappeared, presumed killed by the Derg. The novel had sold out its entire print run before the authorities could suppress it.'],

  ['memed-my-hawk',
    'Yaşar Kemal\'s 1955 debut novel follows Memed, a shepherd\'s son who becomes a bandit hero fighting the feudal landowners of the Taurus Mountains. One of the most celebrated Turkish novels ever written, it was the beginning of a lifelong persecution of Kemal by the Turkish state for his defense of Kurdish rights and his left-wing politics. He was repeatedly prosecuted under Turkey\'s anti-terror laws well into his seventies.'],

  ['meditations-on-first-philosophy',
    'Descartes\'s 1641 philosophical masterwork, which attempts to establish certain knowledge by systematically doubting everything, reached the conclusion that only the thinking self and God could be known with certainty. Placed on the Catholic Index of Forbidden Books in 1663 for its suggestion that reason rather than revelation was the foundation of knowledge — directly challenging Church authority over what counts as truth.'],

  ['my-uncle-napoleon',
    'Iraj Pezeshkzad\'s 1973 Persian comic novel follows a wealthy Tehran family dominated by "Dear Uncle Napoleon," a pompous patriarch who believes the British are behind every misfortune in his life. A satirical portrait of paranoia and self-delusion in Iranian society, it became one of the most beloved Persian novels of the 20th century. After the Islamic Revolution, the BBC Persian service dramatized it as a radio play reaching millions of Iranians inside Iran.'],

  ['my-happy-days-in-hell',
    'Hungarian poet György Faludy\'s 1962 memoir, written in exile in London, recounts his three years in the Hungarian communist labor camp at Recsk — a camp so secret it did not officially exist. Beautifully written with characteristic wit even in extremity, it became one of the key documents of the Hungarian Gulag experience. Faludy had earlier survived exile from Horthy\'s Hungary, service in the US Army, and McCarthy-era surveillance.'],

  ['on-clowns-norman-manea',
    'Romanian novelist Norman Manea\'s 1992 collection of essays examines the relationship between writers and totalitarian power, centered on a famous essay about Mircea Eliade\'s Iron Guard involvement. Manea fled Romania in 1986; in Communist Romania virtually all his work was banned or heavily censored. His examination of how writers collaborate with, resist, or are destroyed by dictatorships remains one of the most searching essays in the genre.'],

  ['morning-in-jenin',
    'Already described — skip.'],

  ['nostalgia-mircea-cartarescu',
    'Mircea Cărtărescu\'s 1989 debut novella collection, written during the last years of Ceaușescu\'s Romania, fuses dreamlike surrealism with the specific textures of Bucharest life. The original version was heavily censored before publication; the full text was published only after the revolution. Cărtărescu is now widely regarded as one of the great European novelists of his generation.'],

  ['metro-2033',
    'Dmitry Glukhovsky\'s 2002 post-apocalyptic novel, originally published chapter by chapter online, is set in the Moscow Metro system where survivors of nuclear war have built civilization in the tunnels. The freely distributed online version created a massive Russian readership before conventional publication. Adapted into a successful video game franchise; the novel\'s bleak portrayal of human tribalism under extreme stress was read as political allegory by many Russian readers.'],
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
