/**
 * Batch 39 — descriptions for ~28 more books.
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
  ['the-turner-diaries',
    'William Luther Pierce\'s 1978 novel, written under the pseudonym Andrew Macdonald, depicts a white supremacist revolution in the United States that ends in the genocide of Jewish people and non-white people. Long circulated in neo-Nazi circles as an inspiration text, it was the blueprint for Timothy McVeigh\'s 1995 Oklahoma City bombing. Banned in Germany and Canada as hate speech, it remains legally available in the United States. It is included here because censorship\'s record is incomplete without the texts that censors are also right to fear.'],

  ['did-six-million-really-die',
    'Richard Verrall\'s 1974 Holocaust denial pamphlet, published by the British neo-Nazi organization National Front under the pseudonym Richard Harwood, became the foundational text of organized Holocaust denial and has been widely distributed by far-right organizations worldwide. Banned in Germany, France, and many other countries under laws prohibiting Holocaust denial. It is catalogued here because the record of censorship includes texts that are censored for good reason as well as those censored unjustly.'],

  ['hit-man-technical-manual',
    'Rex Feral\'s 1983 manual, marketed as fiction and instructing readers in professional killing techniques, became the subject of a landmark US case when the family of a murder victim sued the publisher for product liability. The Fourth Circuit Court of Appeals ruled in 1997 that the First Amendment did not protect it; the publisher agreed to destroy remaining copies before the Supreme Court could rule. It tests the absolute limits of the First Amendment at the point where speech merges into operational instruction.'],

  ['the-peaceful-pill-handbook',
    'Philip Nitschke and Fiona Stewart\'s guide to end-of-life options — including lethal medications and their acquisition — is banned in Australia, where Nitschke\'s euthanasia advocacy organization Exit International has faced repeated legal challenges. It circulates online and through international mail. Nitschke, sometimes called "Dr. Death," was stripped of his Australian medical license; he argues that the right to a peaceful death is a fundamental freedom that governments have no right to withhold.'],

  ['the-voice-of-hope',
    'Aung San Suu Kyi\'s 1997 extended interview with journalist Alan Clements, recorded during her years under house arrest in Rangoon, presents her political philosophy of nonviolent resistance, Buddhism, and democratic governance in Burma. It was banned by Myanmar\'s military junta, which regarded Suu Kyi herself as banned from public life for most of the period between 1989 and her final re-arrest in 2021. She won the Nobel Peace Prize in 1991; she could not collect it until 2012.'],

  ['the-square-choi-in-hun',
    'Choi In-hun\'s 1961 Korean novel follows a man caught between North and South Korea during the Korean War — his idealism about the North disappointed by its reality, his experience of the South equally disillusioning — who chooses a third country and death rather than either compromise. One of the most important novels in Korean literary history, it was censored in South Korea for its balanced and therefore suspicious view of the North. In the North, it was suppressed for its rejection of the revolutionary state.'],

  ['the-subversive-philippines',
    'Jose Lansang\'s 1971 collection of essays analyzing the structural contradictions of Philippine society under Ferdinand Marcos — the land reform that never happened, the democratic institutions gutted by martial law — was banned by the Marcos regime when martial law was declared in 1972. Lansang was one of the most incisive critics of the Marcos kleptocracy; the book circulated underground and among the Filipino diaspora.'],

  ['the-passive-organ-paul-goma',
    'Paul Goma\'s 1971 Romanian novel about sexual obsession and political compromise under Ceaușescu\'s Romania was suppressed by the Romanian censorship apparatus before it could be published in Romania; it appeared in West Germany. Goma, the most prominent Romanian dissident of the 1970s, organized an open letter supporting the Helsinki Accords in 1977, was imprisoned, and eventually expelled to Paris, where he continued writing until his death in 2020.'],

  ['sumatoha-radichkov',
    'Yordan Radichkov\'s Bulgarian prose — dense with folk myth, the surreal, and the tragicomic voice of the Bulgarian peasant confronting modernity — was always in a complicated relationship with the communist authorities, who alternately promoted and suppressed it. Radichkov, considered Bulgaria\'s greatest 20th-century prose writer, navigated censorship by retreating into myth and the subconscious in ways that were officially ambiguous but culturally subversive.'],

  ['taseer-of-lahore',
    'Syed Nur Ahmad\'s account of the life and journalism of Mian Bashir Ahmad Taseer, the pioneering Pakistani newspaper editor and liberal intellectual, was suppressed in Pakistan for its frank treatment of the political turbulence of Pakistani media and public life. The Taseer family\'s later prominence — his son Salman Taseer became Governor of Punjab before his assassination in 2011 for opposing blasphemy law — gave the book renewed significance.'],

  ['there-was-a-country',
    'Chinua Achebe\'s 2012 memoir and personal history of Biafra, drawing on his experiences during the 1967-1970 Nigerian Civil War, provoked immediate controversy in Nigeria for his harsh criticism of Obafemi Awolowo, whom he accused of deliberately causing the Biafran famine through blockade policy. The book reopened wounds that Nigerian official discourse had tried to close; Achebe, author of Things Fall Apart, argued that the war\'s history had never been honestly reckoned with.'],

  ['things-fall-apart',
    'Chinua Achebe\'s 1958 debut novel, depicting the life of Okonkwo in a traditional Igbo village as British colonialism destroys its culture, is the most widely read African novel in the world — taught across Africa, Europe, and North America. It has been challenged in US schools by parents who found its depictions of tribal customs and colonial violence inappropriate for young readers; the irony of banning a novel about cultural erasure was not lost on its defenders.'],

  ['this-earth-of-mankind',
    'Pramoedya Ananta Toer\'s 1980 first novel of the Buru Quartet — narrating the colonial education and loves of a Javanese intellectual in Dutch-ruled Java around 1900 — was composed aloud in the Buru Island prison camp, memorized by fellow prisoners, and written down only after Pramoedya\'s release. Banned in Indonesia by Suharto\'s government for "spreading Marxist-Leninist ideology," it was published by an underground press. The ban, which lasted until 2000, was enforced by confiscating copies and arresting sellers.'],

  ['time-of-silence-martin-santos',
    'Luis Martín-Santos\'s 1962 Spanish novel, following a research scientist in 1940s Madrid whose professional ambitions are destroyed by a single night\'s entanglement with the city\'s underworld, used interior monologue and baroque satire to produce the most important novel to emerge from Francoist Spain. The regime\'s censors allowed it — perhaps not fully understanding its indictment of the intellectual and social climate they had created. Martín-Santos died in a car accident in 1964, aged 39.'],

  ['tintin-in-the-land-of-soviets',
    'Hergé\'s 1930 debut Tintin album, originally serialized in a Belgian Catholic newspaper, depicts the Soviet Union as a land of propaganda, forced labor, and systematic deception — the reality behind the communist façade. It was largely based on a Belgian anti-communist pamphlet; its accuracy was limited but its directness was not. Banned in the Soviet Union, it was largely unavailable in official Hergé compilations for decades as an embarrassment to his publisher, who found its crude politics an awkward opening to the series.'],

  ['to-all-the-boys-ive-loved-before',
    'Jenny Han\'s 2014 young adult novel, following Korean-American teenager Lara Jean Song Covey after her secret love letters are accidentally mailed, was challenged in US schools and libraries for its sexual content and depiction of teenage romance. The Netflix film adaptations brought the book to a vastly wider audience; it was challenged in some districts precisely because its Korean-American protagonist normalized non-white teen romance for school-age readers.'],

  ['tongolele-no-sabia-bailar',
    'Sergio Ramírez\'s 2021 Nicaraguan novel, written in exile after Daniel Ortega\'s government charged him with treason, depicts a detective investigating a political assassination in a fictional Central American country that is transparently Nicaragua. Ramírez, the former Sandinista Vice President who became one of Nicaragua\'s most celebrated novelists, was stripped of his citizenship while in Spain. The book is banned in Nicaragua.'],

  ['touba-and-the-meaning-of-night',
    'Shahrnush Parsipur\'s 1989 Iranian novel — a multigenerational magical realist epic following a woman\'s spiritual journey through a century of Iranian history — was banned in Iran after the Islamic Revolution for its frank treatment of female sexuality and its mystical framework that diverged from approved religious interpretation. Parsipur was imprisoned twice in post-revolutionary Iran; she eventually emigrated to the United States. Her work is one of the central achievements of modern Persian literature.'],

  ['too-bright-to-see',
    'Kyle Lukoff\'s 2021 middle-grade novel, in which a child named Bug begins to understand they are transgender after their dead uncle starts sending messages, was challenged in US school libraries for its positive depiction of gender nonconformity and transgender identity. It won the Newbery Honor Award; the American Library Association recorded it as one of the most frequently challenged books of 2022.'],

  ['tilt-eh',
    'Ellen Hopkins\'s verse novel follows three teenagers whose lives intersect around sexual trauma, addiction, and identity. Like Hopkins\'s other works — Crank, Burned, Identical — it was among the most frequently challenged books in US school libraries for its frank treatment of teenage sexuality, drug use, and abuse. Hopkins, whose verse novels are written in a style that mirrors the fragmented interiority of her teenage characters, became a prominent defender of intellectual freedom.'],

  ['the-truth-about-alice-a-novel',
    'Jennifer Mathieu\'s 2014 young adult novel, told in multiple first-person voices, examines the social destruction of Alice Franklin by her high school community through rumors about her sexual behavior. Challenged in US school libraries for sexual content and for language. Its subject — the way social media and peer cruelty combine to destroy a young woman — is precisely the kind of contemporary reality that its defenders argued school libraries should be prepared to discuss.'],

  ['the-truth-that-killed',
    'Georgi Markov\'s memoir of his life in communist Bulgaria and his escape to the West was being assembled when Bulgarian secret service agents assassinated him with a ricin-tipped umbrella on Waterloo Bridge in London in 1978. Markov had been broadcasting for the BBC World Service and Radio Free Europe, reaching Bulgarian audiences with accounts of the Zhivkov regime\'s corruption that the regime found intolerable. His murder became one of the Cold War\'s most notorious political killings.'],

  ['the-notebook',
    'Ágota Kristóf\'s 1986 French-language Swiss novel, written by a Hungarian refugee, follows twin brothers surviving wartime occupation through a diary of methodical cruelties and ethical self-training. Its cold, flat prose strips moral language from the description of atrocity in a way that implicates the reader. Banned in several countries for its depictions of violence and sexual abuse among children; in Hungary, where Kristóf\'s language of origin was spoken, it received a complicated reception as the work of a refugee.'],

  ['ukraine-is-not-russia',
    'Leonid Kuchma\'s 2003 book — written by Ukraine\'s then-President as an argument for Ukrainian cultural and national distinctiveness from Russia — became one of the most ironic titles in recent political history when Russia invaded Ukraine in 2022 on the premise that Ukrainian distinctiveness was either fictional or irrelevant. Banned in Russia as a provocation. Its argument, once a statement of political pride, became existential.'],

  ['we-are-arrested',
    'Can Dündar\'s 2016 account of his imprisonment in Turkey after Cumhuriyet, the newspaper he edited, published evidence that Turkish intelligence was supplying weapons to Syrian Islamist groups. Dündar was charged with espionage; Erdoğan personally called for his conviction. He was shot and wounded outside the courthouse, fled to Germany while on bail, and was convicted in absentia. The book documents the destruction of Turkey\'s independent press under Erdoğan.'],

  ['we-uyghurs-have-no-say',
    'Rahile Dawut\'s writings, compiled in this 2022 volume, document the destruction of Uyghur cultural heritage in Xinjiang — the sacred sites, the oral traditions, the living memory of a people — that she had spent her career studying as an academic folklorist at Xinjiang University. Dawut was detained in 2017 and has not been heard from since; she is believed to be in one of the detention facilities the Chinese government calls "vocational training centers."'],

  ['we-zamyatin',
    'Yevgeny Zamyatin\'s 1921 Russian dystopian novel — depicting a totalitarian future state called the One State where people have numbers instead of names, all windows are transparent, and the Great Benefactor rules by mathematical certainty — was the first manuscript rejected by Soviet censorship in 1924. Published in English in 1924, it directly influenced Aldous Huxley\'s Brave New World and George Orwell\'s Nineteen Eighty-Four. Zamyatin wrote to Stalin personally requesting permission to leave the country; Stalin granted it.'],

  ['yakhalinkomo',
    'Mtutuzeli Matshoba\'s 1980 South African short story collection, depicting the daily humiliations of apartheid life in the townships — the pass laws, the police harassment, the economic exploitation — was banned by the South African Publications Control Board. Matshoba was a member of the Staffrider generation of Black Consciousness-era writers who turned the constraints of township life into the material of a new South African literary tradition.'],
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
