/**
 * Batch 34 — descriptions for ~28 more books.
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
  ['the-adventures-of-huckleberry-finn',
    'Mark Twain\'s 1884 novel — following the runaway slave Jim and young Huck down the Mississippi — is one of the most challenged books in American literary history, and one of its most important. Banned on publication by the Concord Public Library for its "coarse language" (meaning Jim\'s dialect), it has been challenged ever since: by segregationists for its sympathetic Black character, by civil rights advocates for its use of racial slurs, and by schools uncertain how to teach it. Twain called it "a book of mine where a sound heart and a deformed conscience come into conflict."'],

  ['tess-of-the-durbervilles',
    'Thomas Hardy\'s 1891 novel, subtitled "A Pure Woman," follows a young woman\'s rape, her subsequent social destruction, and her eventual execution for killing her attacker. Hardy\'s insistence on Tess\'s moral innocence in the face of Victorian sexual double standards provoked outrage; serialization required extensive bowdlerizing before book publication. It effectively ended his career as a novelist — he turned to poetry for the remaining forty years of his life.'],

  ['tintin-in-the-congo',
    'Hergé\'s 1931 Tintin album, drawn at the height of Belgian colonialism, depicts Congolese characters as childlike, primitive, and in need of European guidance. Now recognized as a document of colonial racism, it has been banned or restricted in several countries and carries warning labels in the few markets where it remains available. The album reveals how thoroughly racist assumptions were woven into mainstream European popular culture of the era.'],

  ['the-age-of-reason-paine',
    'Thomas Paine\'s 1794 deist polemic attacked both the Bible and organized religion with the same clarity he had brought to political revolution in Common Sense. Prosecuted for blasphemy in Britain, it was widely read in revolutionary France and circulated underground in America. Paine died in poverty and near-obscurity, having been too radical even for the republic he helped found.'],

  ['the-anarchist-cookbook',
    'William Powell\'s 1971 manual for making explosives, drugs, and disrupting telecommunications was written by a 19-year-old in protest against the Vietnam War and has never gone out of print. Powell himself spent the last decades of his life trying to have it suppressed, disavowing its contents. It appears on the ALA\'s most-challenged list repeatedly; no government has successfully banned it in the US, though it has been seized in the UK and Australia.'],

  ['the-barracks-mcgahern',
    'John McGahern\'s 1963 debut novel follows a police sergeant\'s wife in rural Ireland, dying of cancer, watching her life narrow to its essential questions of faith, love, and endurance. The Censorship Board of Ireland banned it, and McGahern was fired from his teaching position — the Catholic Church having more authority over Irish state employment than the state itself. McGahern later called it "the best education I could have received."'],

  ['the-bastard-of-istanbul',
    'Elif Şafak\'s 2006 Turkish novel, which brings together an Armenian-American family and a Turkish family in Istanbul, became the vehicle for Turkey\'s most famous recent literary prosecution. Şafak was charged under Article 301 for "insulting Turkishness" because characters in the novel discuss the Armenian Genocide — a charge that carried up to three years in prison. The prosecution was eventually dropped, but the case drew international attention to Turkey\'s laws restricting historical discussion.'],

  ['the-blind-owl',
    'Sadeq Hedayat\'s 1937 novella — a hallucinatory fever dream of obsession, murder, and fragmented identity — was published in a tiny private edition in Bombay because publication in Iran was impossible. Now recognized as the greatest work of Persian modernist prose, it was suppressed after the Islamic Revolution as decadent and nihilistic. Hedayat killed himself in Paris in 1951; his influence on subsequent Iranian literature is incalculable.'],

  ['the-book-of-laughter-and-forgetting',
    'Milan Kundera\'s 1979 novel, structured as seven variations on the themes of memory, forgetting, and laughter, was written after the Czechoslovak government stripped him of his citizenship following the Warsaw Pact invasion. The book begins with a Communist Party official having a man airbrushed from a photograph — prefiguring the digital manipulations of a later era. Kundera did not return to Czechoslovakia after 1975.'],

  ['the-captive-mind',
    'Czesław Miłosz\'s 1953 analysis of how intellectuals accommodate themselves to totalitarian systems — written after his defection from People\'s Republic of Poland — is one of the essential texts of 20th-century political thought. Through four composite portraits he explores the self-deceiving mental gymnastics — "Ketman" — that allow talented people to serve regimes that violate their values. Banned in Eastern Europe until 1989.'],

  ['the-colonel-dowlatabadi',
    'Mahmoud Dowlatabadi\'s most politically direct novel, written in the 1980s but not published in Iran until 2009, follows a retired military colonel through a single night of grief after the Islamic Revolution has destroyed everything he believed in — including his five children, each of whom represents a different Iranian political tendency. The delay of nearly thirty years before Iranian publication says everything about its contents.'],

  ['quarup',
    'Antonio Callado\'s 1967 Brazilian novel follows a Jesuit priest\'s journey from the Amazon to armed resistance against the military dictatorship that took power in 1964. One of the key political novels of the Brazilian dictatorship era, it was seized and banned by the military government. Its title refers to an indigenous Xingu festival of mourning for the dead — which became Callado\'s metaphor for Brazil under military rule.'],

  ['round-heads-and-pointed-heads',
    'Brecht\'s 1936 allegorical play, written in Danish exile, transforms Shakespeare\'s Measure for Measure into a fable about Nazi racism — the "round heads" and "pointed heads" standing for Aryan and Jewish. Brecht shows that class solidarity is destroyed by racial ideology, which serves the powerful by preventing the poor from recognizing their common interests. The Nazis\' burning of his books in 1933 had preceded his writing of this play by three years.'],

  ['satans-stones-ravanipur',
    'Moniru Ravanipur\'s 1990 Iranian novel, set in a southern fishing village that modernity is destroying through oil money and corruption, was banned in Iran for its frank treatment of sexuality and its bleak portrait of traditional society\'s dissolution. Ravanipur is one of Iran\'s most important women writers; her magical realist style and her refusal to idealize either pre-revolutionary Iran or the Islamic Republic made her work continuously controversial.'],

  ['suor-amado',
    'Jorge Amado\'s 1934 novel, set in a São Paulo boarding house for factory workers, depicts the brutal lives of the Brazilian urban poor with socialist conviction. The second novel by Amado — who was nineteen when Cacau was published — it was banned by the Vargas dictatorship as communist propaganda and earned him the attention of the political police. He would be arrested and exiled in the years that followed.'],

  ['tango-slawomir-mrozek',
    'Sławomir Mrożek\'s 1964 absurdist play depicts a young man who becomes disgusted by his family\'s bohemian liberalism and attempts to restore traditional order — only to find that the vacuum he creates is immediately filled by the most brutish and anti-intellectual force available. A perfect parable of how authoritarian reaction follows decadent permissiveness, it was immediately understood in communist Poland as a political allegory.'],

  ['tessa-a-gata',
    'Cassandra Rios\'s 1948 Brazilian novel — one of her more than forty books depicting lesbian relationships — was banned under the military dictatorship for its explicit lesbian content. Rios was the first Brazilian author to write openly about lesbian desire, reaching enormous readerships in a country whose dictatorships banned her repeatedly but whose publishers kept printing her because she sold.'],

  ['the-age-of-reason-paine',
    'Already described — skip.'],

  ['snow-falling-on-cedars',
    'David Guterson\'s 1994 mystery novel about a Japanese-American salmon fisherman charged with murder in 1950s Washington state interweaves the trial with a love story reaching back to before the wartime internment. Winner of the PEN/Faulkner Award, it has been challenged in US schools for a brief sex scene — ironically, given that its central subject is the racism that destroyed a community.'],

  ['prisoners-of-the-state',
    'Xu Zhiyong\'s account of China\'s "stability maintenance" apparatus — the vast system of petitions offices, black jails, and forced psychiatric commitment used to suppress dissidents and prevent complaints from reaching higher authorities. Xu, a legal scholar and co-founder of the New Citizens Movement, was imprisoned in 2014 and again in 2023, sentenced to fourteen years. The book is banned in China.'],

  ['quando-os-lobos-uivam',
    'Aquilino Ribeiro\'s 1958 Portuguese novel about rural peasants resisting forced collectivization was immediately banned by Salazar\'s censorship apparatus. The regime went further: it prosecuted Ribeiro himself for "offending the dignity of the state." The trial — against Portugal\'s most celebrated living novelist — was such an embarrassment that the charges were eventually dropped, but the book remained banned until the Carnation Revolution.'],

  ['o-delfim',
    'José Cardoso Pires\'s 1968 Portuguese novel, a Faulknerian mystery set in a Tagus marshland estate investigating the death of a landowner, is also a meditation on the end of Portuguese rural aristocracy and the coming collapse of the Salazar regime. Under the Estado Novo, Pires was a target of PIDE surveillance throughout his career; O Delfim is widely considered his masterpiece.'],

  ['my-side-of-history',
    'Chin Peng\'s 2003 memoir by the lifelong leader of the Malayan Communist Party recounts his decades of guerrilla warfare against British colonialism and then the Malaysian and Singaporean governments from 1948 into the 1980s. Both Malaysia and Singapore refused to allow him to return to die in his homeland; the book is banned in Malaysia. It offers the guerrilla perspective on a conflict Malaysian official history has been reluctant to examine.'],

  ['the-bible',
    'The world\'s most widely distributed book has also been one of the most frequently banned — by Roman emperors, medieval Church authorities who wanted a Latin monopoly, Reformation-era Catholic authorities who burned vernacular translations, and 20th-century communist governments that banned all religious texts. The Qin dynasty banned and burned texts that threatened state authority; subsequent dynasties regulated which religious texts could be distributed. In the 21st century it remains restricted in North Korea and parts of China.'],

  ['the-captive-mind',
    'Already described — skip.'],

  ['sexual-ethics-forel',
    'Auguste Forel\'s 1906 Swiss psychiatric study of human sexuality — covering homosexuality, masturbation, and birth control with scientific detachment rather than moral condemnation — was put on the Vatican\'s Index of Forbidden Books and seized by US customs as obscene. Forel was one of Europe\'s most eminent neurologists; his book reached millions of readers in dozens of languages and helped shift scientific opinion on homosexuality.'],

  ['slaughterhouse-five-the-graphic-novel',
    'Ryan North and Albert Monteys\'s 2020 graphic adaptation of Vonnegut\'s anti-war masterpiece followed its source novel onto challenged-books lists in US schools, where the original has been banned periodically since its 1969 publication. The graphic novel\'s visual representation of the Dresden firebombing and its unstuck-in-time structure were challenged in the same terms used against Vonnegut\'s prose original.'],
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
