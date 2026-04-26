/**
 * Batch 33 — descriptions for ~28 more books.
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
  ['requiem-akhmatova',
    'Anna Akhmatova\'s cycle of poems about the Great Terror, written between 1935 and 1940 while her son Lev was imprisoned in the Gulag, could not be written down: Akhmatova and her friends memorized each poem and burned the paper. Published in the West in 1963, they appeared in the Soviet Union only in 1987. The sequence, including the shattering "Crucifixion," is one of the great monuments of witness literature.'],

  ['rights-of-man',
    'Thomas Paine\'s 1791 defense of the French Revolution against Edmund Burke\'s attack — and his argument that revolution was justified when governments violated natural rights — led to his prosecution in Britain for seditious libel. He fled to France before the trial and was convicted in absentia. The book was circulated underground in Britain by radical working-class organizations and was the key text of the democratic reform movement.'],

  ['prisoner-of-the-state',
    'Zhao Ziyang was General Secretary of the Chinese Communist Party who opposed the military crackdown on Tiananmen Square protesters in 1989; he was removed from office, placed under house arrest, and never appeared in public again until his death in 2005. These memoirs were smuggled out on cassette tapes hidden in ordinary-looking cases. Published in 2009, they remain banned in China.'],

  ['season-of-migration-to-the-north',
    'Tayeb Salih\'s 1966 Sudanese novel follows a narrator who returns from Oxford to his Nile village and discovers a mysterious neighbor — Mustafa Sa\'eed — whose life of sexual conquest in London mirrors and inverts the colonial encounter. Widely regarded as the greatest Arabic novel of the 20th century, it was banned in several Arab countries for its frank treatment of sexuality and its postcolonial argument about who actually colonizes whom.'],

  ['siddhartha',
    'Hermann Hesse\'s 1922 novel follows the spiritual journey of a young man in ancient India who rejects institutional religion — including the Buddha\'s teachings — in search of direct experience of enlightenment. Placed on banned lists by the Nazis for Hesse\'s pacifism and his embrace of Eastern philosophy, it became a counterculture touchstone in 1960s America and has never stopped selling.'],

  ['sister-carrie',
    'Theodore Dreiser\'s 1900 debut novel about a young woman from the country who rises in Chicago and New York society through relationships with men — without being punished for it — was suppressed by its own publisher after printing, who found its frank materialism and moral ambiguity intolerable. The full text was not widely available until 1981. It is now recognized as one of the foundational texts of American realism.'],

  ['sons-and-lovers',
    'D.H. Lawrence\'s 1913 autobiographical novel of a young man in the Midlands coalfields, caught between his possessive mother and his desire for independence through love, was rejected by three publishers before Heinemann agreed to print a censored version. Lawrence\'s frank treatment of sexuality and the psychological dynamics of family life would lead to legal battles over Lady Chatterley\'s Lover fifteen years later. Sons and Lovers is now studied as a classic in schools worldwide.'],

  ['steal-this-book',
    'Abbie Hoffman\'s 1971 countercultural manual — containing instructions for living free by shoplifting, squatting, hitchhiking, and obtaining goods through any means but payment — was refused by thirty publishers before being self-published. Stores refused to carry a book whose title was an instruction. Hoffman, co-founder of the Yippies and defendant in the Chicago Seven trial, embodied the spirit of gleeful provocation the book represents.'],

  ['sozaboy',
    'Ken Saro-Wiwa\'s 1985 Nigerian novel, narrated in "rotten English" — a pidgin-inflected mixture of Nigerian English, pidgin, and standard English — follows a young man who naively enlists in the Biafran War and discovers only devastation. Saro-Wiwa\'s linguistic choice was itself political: the novel could be read by anyone who spoke any version of English in Nigeria. He was executed a decade later for his environmental activism.'],

  ['roll-of-thunder-hear-my-cry',
    'Mildred D. Taylor\'s 1976 Newbery Medal-winning novel follows the Black Logan family in Depression-era Mississippi as they struggle to hold onto their land against racist violence and economic pressure. Challenged in US schools for language — particularly its historical use of racial slurs — and for its depiction of racial violence. Critics of these challenges argue that sanitizing the novel erases exactly the history it is trying to preserve.'],

  ['serve-the-people-yan-lianke',
    'Yan Lianke\'s 2005 novella — its title appropriates Mao\'s famous slogan — depicts a sexual affair between an officer\'s wife and his orderly in a Chinese military base during the Cultural Revolution, using Mao\'s writings as their pillow talk and burning a copy of the collected works during an argument. Banned in China within weeks of publication for its political and sexual content, it was published internationally to considerable acclaim.'],

  ['rights-of-man',
    'Already described — skip.'],

  ['requiem-akhmatova',
    'Already described — skip.'],

  ['politics-for-everyone',
    'Pham Doan Trang\'s 2018 Vietnamese political philosophy textbook, written for ordinary citizens without academic background, explains democratic theory, civil society, the rule of law, and how to analyze political systems. Written and distributed underground in Vietnam, it led to her arrest in 2020; she was sentenced to nine years in prison in 2022 for "propaganda against the state."'],

  ['prisoner-of-conscience-ma-thida',
    'Ma Thida — pen name of Sanchaung — is a Burmese doctor and writer who was sentenced to twenty years in prison in 1993 for her short stories and her role as personal aide to Aung San Suu Kyi. Released in 1999 after international pressure, she became a prominent voice for freedom of expression in Myanmar. This collection documents her prison experience and its medical dimensions.'],

  ['princess-jean-sasson',
    'Jean Sasson\'s 1992 account of a Saudi princess\'s life — her arranged marriage, her family\'s wealth and brutality, and the severe restrictions on women under Saudi law — was published under the princess\'s pseudonym "Sultana." One of the first widely-read accounts of life inside the Saudi royal family, it was banned in Saudi Arabia and became an international bestseller that helped shift Western understanding of women\'s rights in the Gulf states.'],

  ['riot-days',
    'Maria Alyokhina\'s 2017 account of her imprisonment following the Pussy Riot protest in Moscow\'s Cathedral of Christ the Saviour in 2012, when she and other members performed a "punk prayer" calling on the Virgin Mary to rid Russia of Putin. Sentenced to two years in a Siberian penal colony, Alyokhina\'s defiant memoir documents her hunger strikes and legal battles from inside the Russian prison system.'],

  ['rainbow-trilogy',
    'Alex Sanchez\'s three interconnected novels — Rainbow Boys (2001), Rainbow High (2003), and Rainbow Road (2005) — follow three gay high school students navigating coming out, relationships, and HIV in contemporary America. Among the most frequently challenged books in US school libraries of the 2000s for their frank depictions of gay teen sexuality and relationships.'],

  ['rangila-rasul',
    'M.A. Chamupati\'s 1927 Punjabi pamphlet depicted the Prophet Muhammad in an unflattering light, triggering widespread riots across British India. A Muslim publisher was arrested for printing it; the Hindu publisher who had commissioned it was assassinated. The British colonial government, unwilling to be seen as taking sides, passed legislation criminalizing attacks on religious beliefs — a law whose descendants still shape Pakistan\'s blasphemy laws today.'],

  ['masa-alyokhina',
    'Already described — skip.'],

  ['nadirs-muller',
    'Herta Müller\'s 1982 debut short story collection, written in Romanian German and depicting the claustrophobic rural world of the Banat Swabians in communist Romania, was published in a censored version by the Romanian state. The full text appeared in West Germany in 1984. Müller, who had refused to become an informer for the Securitate, was fired from her job and subjected to years of harassment before emigrating in 1987. She won the Nobel Prize in 2009.'],

  ['season-of-migration-to-the-north',
    'Already described — skip.'],

  ['rama-retold',
    'Aubrey Menen\'s 1954 satirical retelling of the Ramayana — portraying the Hindu epic\'s divine characters as very human in their motivations, with ironic modern commentary — was immediately banned in India for offending Hindu religious sentiment. One of the first books banned by the Republic of India after independence, it established a pattern that would continue with The Satanic Verses and countless others.'],

  ['gaibeus',
    'Alves Redol\'s 1940 Portuguese novel — the first work of Portuguese neo-realism — depicts the lives of seasonal agricultural workers in the Ribatejo region, documenting their brutal working conditions with documentary precision. Published during the Salazar dictatorship and immediately subject to censorship, it established the tradition of socially committed literature that would flourish in the Portuguese underground until the Carnation Revolution.'],

  ['livro-sexto-sophia',
    'Sophia de Mello Breyner Andresen\'s 1962 poetry collection, the sixth in her series, was among the works monitored and censored by Salazar\'s PIDE secret police for their political undercurrents. Portugal\'s greatest 20th-century poet, Andresen navigated the dictatorship through classical clarity and mythological metaphor; her later poems became more directly political as the regime fell.'],

  ['marinero-en-tierra',
    'Rafael Alberti\'s 1925 debut collection — its title means "Sailor Ashore" — won Spain\'s National Poetry Prize and established him as one of the Generation of \'27\'s leading voices. Alberti\'s later communism and Republican allegiance led to his exile after Franco\'s victory in 1939; he spent 38 years in exile in Argentina and Italy, and all his works were banned under Francoism.'],

  ['masses-man-toller',
    'Ernst Toller\'s 1921 Expressionist drama depicts a woman\'s attempt to stop a war through mass protest and her destruction by both the ruling class and her own allies on the left. Toller had led the short-lived Bavarian Soviet Republic in 1919 and spent five years in prison for it. The Nazis burned his books in 1933; he died by suicide in New York in 1939, unable to stop the war he had spent his life trying to prevent.'],

  ['memoirs-of-hecate-county',
    'Edmund Wilson\'s 1946 short story collection, including the explicitly sexual novella "The Princess with the Golden Hair," led to the publisher being convicted of obscenity in New York. The Supreme Court, deadlocked 4-4, let the conviction stand. Wilson was one of America\'s most respected literary critics; the prosecution of his book was seen as an embarrassment to American claims about freedom of expression.'],
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
