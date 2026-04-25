/**
 * Batch 26 — descriptions for 28 more books.
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
  ['ars-amatoria',
    'Ovid\'s witty manual on the art of seduction, written around 1 BC, offended Emperor Augustus so much it was used as one of the justifications for banishing him to a remote Black Sea outpost in 8 AD — where Ovid died nine years later, still pleading to be allowed home. The poem was later placed on the Vatican\'s Index of Forbidden Books.'],

  ['barefoot-gen',
    'Keiji Nakazawa\'s autobiographical manga series, begun in 1973, follows a young boy through the atomic bombing of Hiroshima and its aftermath, drawn from Nakazawa\'s own survival of the blast that killed his father, sister, and brother. It was removed from US school libraries for its graphic depictions of war\'s human cost.'],

  ['before-night-falls',
    'Cuban poet and novelist Reinaldo Arenas wrote this memoir in secret while dying of AIDS in New York, completing it shortly before his suicide in 1990. It chronicles his imprisonment, persecution, and eventual exile by the Castro regime for his homosexuality and dissident writing — a testimony of brutal frankness and literary beauty.'],

  ['beijing-coma',
    'Ma Jian\'s 2008 novel is narrated by a Tiananmen Square survivor who lies in a coma, reliving the 1989 protest movement while his mother tends to his unresponsive body. The internal memories reconstruct the weeks of occupation in forensic detail. The book is banned in China, where the events themselves are officially disappeared from history.'],

  ['being-and-nothingness',
    'Jean-Paul Sartre\'s 1943 philosophical masterwork laying out existentialist ontology — the idea that "existence precedes essence" and that human beings are condemned to be free. Put on the Vatican\'s Index of Forbidden Books in 1948, along with virtually all of Sartre\'s other works, for its atheism and its implications for morality.'],

  ['bells-in-winter',
    'Czesław Miłosz\'s 1978 poetry collection, written in exile in California, meditates on his native Lithuania and Poland with the melancholy distance of someone who knows he cannot return. Miłosz defected from communist Poland in 1951; his work was banned there until the Solidarity era, when it became a touchstone of the Polish underground.'],

  ['bodas-de-sangre',
    'Federico García Lorca\'s 1932 tragedy — Blood Wedding — opens with a wedding interrupted when the bride flees with her former lover, leading to fatal violence in the Spanish countryside. Lorca was shot by Franco\'s Nationalist forces in August 1936 at the beginning of the Spanish Civil War; his body has never been found. His works were banned under Francoism.'],

  ['book-of-songs-heine',
    'Heinrich Heine\'s 1827 collection of lyric poems, one of German Romanticism\'s high-water marks, was among the works burned by the Nazis in their 1933 book burnings. Heine, who was Jewish, had predicted the catastrophe a century earlier: "Where they burn books, they will ultimately burn people also."'],

  ['bread-and-wine-silone',
    'Ignazio Silone\'s 1936 novel follows an Italian communist organizer who returns in disguise from exile to rally the peasants of the Abruzzi against Mussolini\'s regime — and finds the country crushed by fear. Written in exile in Switzerland while Silone was wanted by the Fascist secret police, it was an instant underground classic.'],

  ['cacau-amado',
    'Jorge Amado\'s 1933 debut novel, written when he was nineteen, documents the brutal conditions of cacao plantation workers in the Brazilian state of Bahia. Written from a socialist perspective, it was banned by the Vargas dictatorship and launched Amado — already under police surveillance — into a lifetime of official persecution.'],

  ['captains-of-the-sands',
    'Jorge Amado\'s 1937 novel about street children in Salvador, Brazil, living outside the law in gangs and surviving through petty crime. The Vargas dictatorship had it publicly burned in the city square — a gesture the regime likely intended as a warning but which cemented Amado\'s status as the voice of Brazil\'s poor.'],

  ['christ-stopped-at-eboli',
    'Carlo Levi\'s 1945 memoir of his internal exile by Mussolini\'s regime to a remote village in the Basilicata, where he found a world untouched by modernity or the state. The title phrase — heard from a peasant — captured the abandonment of Southern Italy. The book became one of the defining documents of post-war Italian literature.'],

  ['cities-of-salt',
    'Abdelrahman Munif\'s epic 1984 novel depicts the transformation of an unnamed Arabian peninsula kingdom by the discovery of oil and the arrival of American companies — the destruction of traditional society, the collaboration of local rulers, and the beginnings of resistance. Munif, a Saudi-Iraqi novelist, was stripped of his Saudi citizenship.'],

  ['conversations-with-stalin',
    'Milovan Đilas was one of Tito\'s closest comrades and helped found communist Yugoslavia. This 1962 memoir of his wartime meetings with Stalin — depicting the Soviet leader as a crude, brutal tyrant surrounded by terrified yes-men — was written after Đilas broke with the party and was imprisoned. It remains one of the most vivid portraits of Stalin.'],

  ['das-kapital',
    'Karl Marx\'s foundational analysis of capitalism, first published in 1867, has been banned at various times across the political spectrum — by Tsarist Russia for its revolutionary implications, by Nazi Germany as a Jewish intellectual product, and by various anti-communist regimes throughout the 20th century. Its influence on global politics is incalculable.'],

  ['de-revolutionibus',
    'Nicolaus Copernicus\'s 1543 treatise arguing that the Earth orbits the Sun, not the reverse, was placed on the Vatican\'s Index of Forbidden Books in 1616 — 73 years after publication — when Galileo began using it as a cudgel against Church teaching. It remained on the Index until 1758.'],

  ['devil-on-the-cross',
    'Ngũgĩ wa Thiong\'o wrote this novel in Gikuyu — his first published in his own language rather than English — on toilet paper while imprisoned by Kenya\'s Kenyatta government in 1977–78. A satirical feast depicting corrupt elites competing to exploit their own people, it was written as an act of defiance and circulated in secret.'],

  ['discourse-on-method',
    'Descartes\'s 1637 essay introducing his method of systematic doubt and the famous "cogito ergo sum" ("I think, therefore I am") was placed on the Catholic Index in 1663. Its insistence on reason rather than revelation as the path to truth threatened the Church\'s intellectual authority and helped launch the Age of Reason.'],

  ['emile-or-on-education',
    'Rousseau\'s 1762 treatise on education, arguing that children are born naturally good and corrupted by society, scandalized both secular and religious authorities. The Paris Parlement ordered it burned; the Archbishop of Paris condemned it; Rousseau fled to Switzerland after a warrant for his arrest was issued. Its influence on modern pedagogy was profound.'],

  ['encyclopedie-diderot',
    'The great collaborative project of the French Enlightenment, edited by Denis Diderot and Jean le Rond d\'Alembert, aimed to gather and disseminate all human knowledge while subjecting received wisdom to rational scrutiny. The first volumes were banned by the Paris Parlement in 1752 for containing "principles hostile to royal authority and religion."'],

  ['everything-flows',
    'Vasily Grossman\'s final novel, completed shortly before his death in 1964 and never published in the Soviet Union, follows a survivor returning from thirty years in the Gulag. It includes one of the first literary treatments of the Holodomor — Stalin\'s engineered famine in Ukraine — and a searing indictment of the entire Soviet system.'],

  ['fear-and-loathing',
    'Hunter S. Thompson\'s 1971 "savage journey to the heart of the American Dream" — a hallucinatory account of a road trip to Las Vegas fuelled by an alarming quantity of controlled substances. Written in the "Gonzo" style Thompson pioneered, it was challenged in US schools and libraries for its glorification of drug use and its savage satire of American culture.'],

  ['fontamara',
    'Ignazio Silone\'s 1933 debut novel, written in exile in Switzerland while on the run from Mussolini\'s secret police, depicts the grinding oppression of a fictional peasant village in the Abruzzi under Fascism. Published first in German, it was translated into many languages and read throughout Europe as a parable about the rise of totalitarianism.'],

  ['forbidden-memory-woeser',
    'Tibetan writer Tsering Woeser\'s 2006 book pairs her father\'s photographs from the Cultural Revolution in Tibet — taken while he served as a Chinese military officer — with her own commentary examining the destruction of Tibetan culture. Banned in China, it was published abroad and became a key document of the Cultural Revolution\'s impact on Tibet.'],

  ['freedom-from-fear',
    'The title essay of Aung San Suu Kyi\'s 1991 collection, written while she was under house arrest by Myanmar\'s military junta, argues that fear is the foundation of authoritarian power — and that moral courage is the only response. She was awarded the Nobel Peace Prize the same year while still imprisoned; she spent fifteen of the next twenty-one years under detention.'],

  ['fifty-shades-of-grey',
    'E.L. James\'s 2011 erotic romance — originally Twilight fan fiction — depicts the BDSM relationship between Anastasia Steele and billionaire Christian Grey. It became one of the fastest-selling books in publishing history while being challenged in US libraries for sexually explicit content, becoming an unlikely entrant in the canon of censored literature.'],

  ['fallen-angels',
    'Walter Dean Myers\'s 1988 novel follows seventeen-year-old Richie Perry from Harlem through a Vietnam tour, depicting the randomness and horror of combat and the boredom and racial tensions between tours. One of the most challenged books in US high schools and middle schools for its language and frank depiction of war, drugs, and death.'],

  ['fangirl',
    'Rainbow Rowell\'s 2013 coming-of-age novel about a college freshman who copes with anxiety and family upheaval by writing fan fiction for a fantasy series. Challenged in US schools for mentions of alcohol and sexual content. It captures the experience of growing up in online fan communities with unusual authenticity.'],
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
