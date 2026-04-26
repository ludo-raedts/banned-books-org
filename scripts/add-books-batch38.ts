/**
 * Batch 38 — descriptions for ~28 more books.
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
  ['the-tin-drum',
    'Günter Grass\'s 1959 debut novel follows Oskar Matzerath, who at age three decides to stop growing and expresses his horror at the adult world by beating his tin drum and shattering glass with his voice. Spanning the Nazi rise to power, the war, and the post-war German "economic miracle," Oskar\'s unreliable perspective allows Grass to depict atrocity through the distorting lens of a grotesque child-narrator. It was one of several works that established Grass as a major voice of German moral reckoning; he won the Nobel Prize in 1999.'],

  ['the-things-they-carried',
    'Tim O\'Brien\'s 1990 linked story collection, narrated by a character named "Tim O\'Brien," interweaves realistic depictions of Vietnam War combat with meditations on the nature of truth and storytelling. Frequently challenged in US schools for its language, violence, and sexual content, it is simultaneously a war novel and a book about what war stories do. O\'Brien\'s insistence that "story-truth" can be truer than "happening-truth" unsettled school boards as much as any specific passage.'],

  ['the-sorrows-of-young-werther',
    'Goethe\'s 1774 epistolary novel about a young artist who falls hopelessly in love with an engaged woman and shoots himself has one of the most alarming literary legacies in history: it triggered a wave of copycat suicides across Europe, prompting several countries to ban it. The "Werther Effect" — the phenomenon of suicide contagion through media depiction — was named for this novel. Goethe himself, who had survived the period it depicted, later expressed ambivalence about having written it.'],

  ['the-story-of-o',
    'Published in 1954 under the pseudonym Pauline Réage — later revealed to be Anne Desclos — this French novel depicts a woman\'s willing submission to increasingly extreme sexual domination. Seized by French police and prosecuted for obscenity, it nonetheless won the Prix des Deux Magots in 1955. Its exploration of female desire, submission, and identity became one of the founding texts of serious literary erotic fiction; its authorship by a woman complicated critical attempts to classify it as straightforward degradation.'],

  ['the-spirit-of-the-laws',
    'Montesquieu\'s 1748 comparative analysis of different forms of government and the social conditions that sustain them — including his famous argument for separation of powers — was placed on the Catholic Index of Forbidden Books and banned in France. Its influence on the United States Constitution\'s framers was direct and acknowledged; Jefferson cited it, Hamilton cited it, Madison built on it. The absolute monarchs of Europe feared it for good reason.'],

  ['the-sound-and-the-fury',
    'William Faulkner\'s 1929 novel, narrated in four sections by the disintegrating Compson family of Mississippi — including the stream-of-consciousness of Benjy, who has an intellectual disability — was banned in some US school districts for its language and its despairing portrait of the post-Civil War Southern aristocracy. The novel\'s fragmented chronology and multiple unreliable narrators make it one of the technical masterpieces of 20th-century fiction.'],

  ['the-ugly-american',
    'William Lederer and Eugene Burdick\'s 1958 novel, depicting incompetent and culturally oblivious American diplomats failing in the fictional Southeast Asian country of Sarkhan while the Communists build popular support through patient grassroots work, became a bestseller and influenced US foreign policy. It was banned in several Southeast Asian countries that recognized themselves in its portraits. John F. Kennedy sent a copy to every senator before taking office.'],

  ['the-white-guard',
    'Mikhail Bulgakov\'s 1925 novel of the Turbin family — White Guard officers in Kiev during the chaos of 1918 as Bolsheviks, Ukrainian nationalists, and German forces fight for the city — was one of the first Soviet-era novels to treat the White cause with human sympathy. Stalin is said to have seen the stage adaptation twenty times, but Bulgakov remained in a precarious position throughout his life, his novels unpublishable. The Master and Margarita was his final revenge; The White Guard was his beginning.'],

  ['uncle-toms-cabin',
    'Harriet Beecher Stowe\'s 1852 abolitionist novel, serialized before book publication, became the bestselling American novel of the 19th century and is credited with shifting Northern public opinion against slavery. Abraham Lincoln reportedly said to Stowe: "So you\'re the little woman who wrote the book that started this great war." Banned in the American South for threatening the social order; its sentimental portrayal of enslaved people was later criticized by James Baldwin and others for its condescension even as its anti-slavery purpose was recognized.'],

  ['theologico-political-treatise',
    'Spinoza\'s 1670 anonymous treatise arguing that the Bible should be read as a historical document rather than divine revelation, that freedom of thought is compatible with political stability, and that organized religion is primarily an instrument of social control was immediately banned in Amsterdam and placed on the Catholic Index. Spinoza had already been excommunicated from the Amsterdam Jewish community. The treatise\'s argument for secular democracy and biblical criticism laid foundations for the Enlightenment.'],

  ['two-treatises-of-government',
    'John Locke\'s 1689 treatise arguing that legitimate government derives from the consent of the governed and that citizens have the right to overthrow tyrannical rulers was published anonymously for fear of prosecution. It directly influenced the American Declaration of Independence and the French Revolution\'s ideologists. Its argument that natural rights — to life, liberty, and property — precede and constrain government authority remains the foundational text of liberal political philosophy.'],

  ['the-system-of-nature',
    'Baron d\'Holbach\'s 1770 French materialist manifesto, published under a pseudonym, argued that nature is the only reality, that the soul is a fiction, that God does not exist, and that human beings are determined by physical causation. Called "the Bible of Atheism" by contemporaries, it was burned by the Paris Parlement and is one of the most thoroughgoing works of atheist philosophy produced by the Enlightenment. Voltaire, who rejected atheism, found it too radical.'],

  ['the-world-of-yesterday',
    'Stefan Zweig\'s 1942 memoir, completed shortly before his suicide in Brazilian exile, reconstructs the cosmopolitan European world of his youth — the Vienna of 1900, the literary culture of the Belle Époque, the progressive destruction of that world by two wars and fascism. Zweig, one of the most widely translated authors of the 1930s, was stripped of his German citizenship, had his books burned, and watched his world disappear. The memoir is both a document of loss and one of the most beautiful evocations of a civilization.'],

  ['three-comrades',
    'Erich Maria Remarque\'s 1937 novel, set in Weimar Germany during the inflation and political violence of the late 1920s, was banned by the Nazis along with all his other works. Remarque had already fled Germany after All Quiet on the Western Front; the Nazis revoked his citizenship and later executed his sister Elfriede Scholz, officially for "undermining morale." The novel\'s depiction of friendship and love amid political disintegration carries the weight of everything Remarque had already lost.'],

  ['tobacco-road',
    'Erskine Caldwell\'s 1932 novel of the destitute Georgia sharecropper Jeeter Lester and his family — degraded, hopeless, and grotesquely comic — was banned in several American states for obscenity. The Broadway dramatization ran for 3,182 performances, one of the longest runs in Broadway history, while remaining banned in various cities. Caldwell and Dorothea Lange\'s subsequent photo-essay You Have Seen Their Faces confirmed that the novel\'s poverty was documentary, not exaggerated.'],

  ['tom-jones',
    'Henry Fielding\'s 1749 comic novel following the foundling Tom Jones through English society — including frank depictions of sexual adventure — was condemned by the Bishop of London as contributing to the moral degeneracy that caused an earthquake in 1750. Samuel Richardson, whose competing novel Clarissa offered the virtuous alternative, found it scandalous. It is now regarded as one of the founding texts of the English novel and its good-natured hero as a template for comic literature.'],

  ['too-loud-a-solitude',
    'Bohumil Hrabal\'s 1976 Czech novella, published only in samizdat under communist Czechoslovakia, is narrated by Haňta, who operates a compacting machine and has spent thirty-five years rescuing books from destruction, wrapping bales of condemned literature around secretly salvaged works. Written in a single extended lyrical sentence, it is simultaneously a love letter to books, a portrait of cultural loss under totalitarianism, and one of the most beautiful works of Czech literature.'],

  ['the-yacoubian-building',
    'Alaa Al Aswany\'s 2002 Egyptian novel, set in a Cairo apartment building that houses the full social spectrum of Egyptian society, was controversial across the Arab world for its frank depictions of corruption, homosexuality, and political Islam. A bestseller throughout the Arab world despite — or because of — its controversies, it was banned in several countries and challenged in Egypt for its portrayal of both official corruption and religious extremism. Al Aswany became one of the Arab world\'s most prominent public intellectuals.'],

  ['zorba-the-greek',
    'Nikos Kazantzakis\'s 1946 novel, narrating the friendship between a bookish intellectual narrator and the life-force embodiment Zorba, a Cretan laborer who embraces physical reality and rejects the narrator\'s hesitations, was part of the body of work that caused the Greek Orthodox Church to campaign against Kazantzakis and attempt to have him excommunicated. The church also pressured the Nobel Committee not to award him the prize, which he narrowly missed. Zorba himself was a real person.'],

  ['z-vassilikos',
    'Vassilis Vassilikos\'s 1966 Greek novel, reconstructing the 1963 assassination of left-wing politician Grigoris Lambrakis and the subsequent cover-up by the Greek right and police establishment, was banned by the Greek military junta that took power in 1967. Costa-Gavras\'s 1969 film adaptation brought international attention to the assassination and the junta\'s suppression of democratic opposition. The novel and film contributed to international isolation of the military regime.'],

  ['voices-from-chernobyl',
    'Svetlana Alexievich\'s 1997 oral history collects testimony from survivors of the 1986 Chernobyl nuclear disaster — firefighters, evacuees, liquidators, widows, and officials — creating a polyphonic portrait of the disaster and its aftermath that also documents the Soviet state\'s systematic concealment of the truth. Belarus, where Alexievich lived, banned the book for years; she won the Nobel Prize in 2015. She later left Belarus after the 2020 disputed election.'],

  ['the-tragic-sense-of-life',
    'Miguel de Unamuno\'s 1913 Spanish philosophical essay argues that the human longing for immortality — the refusal to accept death as final — is the root of all serious thought and the source of genuine religious feeling. Its rejection of systematic philosophy in favor of personal existential anguish made it controversial within both the Church and secular academia. Unamuno was exiled during Primo de Rivera\'s dictatorship and then by Franco; he died under house arrest in Salamanca in 1936.'],

  ['the-wonderful-years-reiner-kunze',
    'Reiner Kunze\'s 1976 prose poems and sketches of adolescent life in East Germany — the conformism demanded of young people, the petty violence of the state youth organizations, the crushing of individual temperament — were published in West Germany and immediately banned in the GDR, where they had been written. The Stasi placed Kunze under systematic surveillance; after emigrating to West Germany in 1977, he published a documentary record of what they had written about him.'],

  ['the-wire-harp-wolf-biermann',
    'Wolf Biermann\'s 1965 debut collection of political songs and poems — satirizing the East German state with the directness that made him the GDR\'s most dangerous cultural figure — was published in West Germany while Biermann remained in East Berlin. The SED banned him from performing publicly in 1965, making him an internal exile in his own country for eleven years before expelling him in 1976, triggering mass protests that produced some of the GDR\'s most significant dissident voices.'],

  ['the-swallows-of-kabul',
    'Yasmina Khadra\'s 2002 Algerian-French novel, set in Taliban-controlled Kabul, follows two couples whose lives intersect at an execution ground, one a Taliban enforcer whose wife the other\'s husband accidentally causes to be condemned. Written before 9/11 brought Afghanistan to international attention, it depicts the Taliban\'s Afghanistan through the experiences of people trapped inside it, banned in Afghanistan for its implicit critique of religious totalitarianism.'],

  ['woman-at-point-zero',
    'Nawal El Saadawi\'s 1975 Egyptian novel, based on interviews with a woman on death row for killing her pimp, was banned in Egypt for its frank examination of how women are driven by poverty and male violence into prostitution and then criminalized for it. El Saadawi was the Arab world\'s most prominent feminist; her books were repeatedly banned in Egypt and across the Arab world. She was fired from government positions, imprisoned under Sadat, and faced a fatwa; she kept writing until her death in 2021.'],

  ['the-stone-virgins',
    'Yvonne Vera\'s 2002 Zimbabwean novel, set during the Gukurahundi massacres of the early 1980s when Robert Mugabe\'s Fifth Brigade killed an estimated 20,000 civilians in Matabeleland, was not banned but created enormous political tension in Zimbabwe for breaking what was effectively official silence around the atrocities. Vera, director of the National Gallery of Zimbabwe, wrote about the massacres when doing so required courage; the Mugabe government did not officially acknowledge the killings.'],

  ['three-trapped-tigers',
    'Guillermo Cabrera Infante\'s 1967 Cuban novel — a baroque, pun-filled linguistic experiment depicting Havana nightlife in the last years of Batista — was published in Spain after Castro\'s government refused it. Cabrera Infante, who had initially supported the revolution, broke with Castro in 1965 and lived in London exile until his death in 2005. Like most Cuban exiles\' work, it was banned in Cuba; unlike most, its style was so untranslatable it was a challenge everywhere.'],
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
