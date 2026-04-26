/**
 * Batch 36 — descriptions for ~28 more books.
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
  ['the-gospel-according-to-jesus-christ',
    'José Saramago\'s 1991 novel reimagines the life of Jesus as a fully human figure — with a human father and human doubts — in a way that caused the Portuguese government, under pressure from the Catholic Church, to withdraw the novel from the European Literary Prize shortlist. Saramago, already under political pressure for his communism, moved to the Canary Islands in voluntary exile and lived there until his death. He won the Nobel Prize in 1998.'],

  ['the-hate-u-give',
    'Angie Thomas\'s 2017 debut novel — inspired by the Black Lives Matter movement — follows Starr Carter, who witnesses the police shooting of her unarmed best friend Khalil and must decide whether to speak out. One of the most challenged books in US schools in its first years of publication, targeted by school boards in conservative districts for its depictions of police violence and its political perspectives on race in America.'],

  ['the-hidden-face-of-eve',
    'Nawal El Saadawi\'s 1977 feminist examination of Arab women\'s oppression — covering female genital mutilation, sexual violence, prostitution, and the patriarchal structures of both religion and medicine — was banned in Egypt and across the Arab world for its frank discussion of topics that official culture required to remain invisible. El Saadawi, a psychiatrist, had already been fired from the Egyptian Ministry of Health for publishing earlier feminist work.'],

  ['the-house-of-bernarda-alba',
    'Federico García Lorca\'s 1936 play — his last, completed two months before his murder — depicts five daughters imprisoned in their house for eight years of mourning under the tyranny of their mother, Bernarda, whose rigid honor code destroys them all. Lorca never saw it performed; it premiered in Buenos Aires in 1945, nine years after his execution. Franco\'s regime banned all his works; Bernarda Alba was not performed in Spain until 1964.'],

  ['the-joke-kundera',
    'Milan Kundera\'s 1967 debut novel follows Ludvik, whose sarcastic postcard gets him expelled from the Communist Party and sent to the mines, and his twenty-year plan of revenge. Kundera wrote it before the Prague Spring; after the 1968 Soviet invasion, it was banned in Czechoslovakia, his citizenship was eventually revoked, and all his books were removed from Czech libraries. He emigrated to France in 1975.'],

  ['the-last-temptation-of-christ',
    'Nikos Kazantzakis\'s 1955 Greek novel imagines a Jesus who dreams, at the moment of crucifixion, of escaping the cross and living a normal human life — marrying Mary Magdalene, having children, growing old. The Greek Orthodox Church excommunicated Kazantzakis for it and pressured governments across Europe to ban it. Martin Scorsese\'s 1988 film adaptation provoked riots and bombings in France.'],

  ['the-little-red-schoolbook',
    'Søren Hansen and Jesper Jensen\'s 1969 Danish handbook for students, advising them on sex, drugs, school authority, and their legal rights, was prosecuted in multiple countries. In the UK, publisher Richard Handyside was convicted of obscenity — the European Court of Human Rights eventually found that this violated freedom of expression in a landmark 1976 ruling that remains foundational to European press freedom law.'],

  ['the-man-died',
    'Wole Soyinka\'s 1972 memoir of his imprisonment without trial by Nigeria\'s military government during the Biafran War — including twenty months in solitary confinement, much of it in complete darkness. Soyinka had tried to negotiate a ceasefire and had written to newspapers criticizing the war. The book is one of the most harrowing prison memoirs in world literature. He won the Nobel Prize in 1986.'],

  ['the-memorandum-havel',
    'Václav Havel\'s 1965 absurdist play depicts an organization that introduces an artificial language — Ptydepe — designed for maximum precision and minimum human communication, satirizing communist bureaucracy\'s relationship to actual meaning. Performed in Prague until 1968, it was banned after the Soviet invasion and performed only underground until 1989. Havel went on to lead Czechoslovakia\'s Velvet Revolution.'],

  ['the-moon-and-the-bonfires',
    'Cesare Pavese\'s 1950 final novel — completed months before his suicide — follows a man returning to his native Piedmont village after years in America, discovering how little of his past survived the war and the partisan struggles. One of the masterpieces of Italian 20th-century literature, its haunted tone reflects both Italy\'s traumatic reckoning with Fascism and Pavese\'s own approaching death. Pavese had been imprisoned for antifascist activities in the 1930s.'],

  ['the-naked-and-the-dead',
    'Norman Mailer\'s 1948 debut novel, based on his World War II service in the Pacific, was one of the first major American novels to depict combat with sustained obscenity and without heroic sentimentality. Banned in Australia for its language and sexual content. Mailer was forced to substitute the word "fug" for "fuck" throughout, leading Dorothy Parker to greet him: "So you\'re the young man who can\'t spell."'],

  ['the-new-class-djilas',
    'Milovan Đilas\'s 1957 analysis — arguing that communist revolution had produced not a classless society but a new ruling class of party bureaucrats who exploited workers as ruthlessly as capitalists had — was published in the West while he was imprisoned in Yugoslavia for an earlier offense. His country sentenced him to seven more years for it. The book became one of the foundational texts of anti-communist thought, taken seriously by both left and right.'],

  ['the-incoherence-of-the-incoherence',
    'Ibn Rushd\'s 12th-century philosophical refutation of al-Ghazali\'s attack on Aristotelian philosophy was itself condemned by Islamic religious authorities in 1195, when the Almohad Caliph ordered the burning of philosophical books and the banishment of Ibn Rushd from Córdoba. His fate established the precedent — Greek rationalism versus revelation — that would define Islamic intellectual controversy for centuries, and his works were preserved by European scholars who called him "The Commentator."'],

  ['the-malay-dilemma',
    'Mahathir Mohamad\'s 1970 book arguing that Malay economic backwardness required affirmative action and that Malays had culturally and historically been disadvantaged by colonialism was banned in Malaysia for promoting racial division — by the government of which he was a member. The ban was lifted when Mahathir became Prime Minister in 1981; he governed Malaysia for 22 years, implementing the Bumiputera policies the book advocated.'],

  ['the-dwarf-cho-se-hui',
    'Cho Se-hui\'s 1978 Korean novel — structured as interconnected stories — follows a dwarf and his family as they are displaced from their Seoul shantytown by urban redevelopment, losing everything to developers who symbolize South Korea\'s brutal industrialization. One of the most celebrated works of modern Korean literature, it was suppressed under Park Chung-hee\'s authoritarian government for its critique of the human cost of economic development.'],

  ['the-forging-of-a-rebel',
    'Arturo Barea\'s autobiographical trilogy, covering his Spanish childhood, service in the Rif War in Morocco, and the Spanish Civil War, was written in exile after he fled Franco\'s victory. It is one of the great documents of the Spanish 20th century from a working-class Republican perspective — the perspective that Francoism systematically suppressed for forty years. The books were banned in Spain until after Franco\'s death.'],

  ['the-informer-liam-oflaherty',
    'Liam O\'Flaherty\'s 1925 novel about an IRA informer in Dublin who betrays his comrade for twenty pounds and spends the night being hunted down while guilt unravels his mind was banned in Ireland for its depictions of violence and its ambiguous portrait of the Republican movement. O\'Flaherty was a committed communist whose novels were suppressed by the Irish Censorship Board throughout the 1930s and 1940s.'],

  ['the-guinea-pigs-vaculik',
    'Ludvík Vaculík\'s 1973 Czech novel — composed after his expulsion from the Communist Party for the 1968 "Two Thousand Words" manifesto — is narrated by a bank employee who conducts increasingly disturbing experiments on his family\'s guinea pigs. A barely veiled allegory of what power does to those who hold it, it was banned in Czechoslovakia and published in Austria; it circulated in samizdat throughout the 1970s.'],

  ['the-best-of-jb-jeyaretnam',
    'J. B. Jeyaretnam was Singapore\'s first opposition Member of Parliament, elected in 1981 after years of electoral manipulation by Lee Kuan Yew\'s PAP. He was subsequently subjected to defamation suits, disbarred, and bankrupted through legal proceedings that Amnesty International described as politically motivated. This collection of his speeches and writings documents both his advocacy and the legal apparatus used to silence him.'],

  ['the-last-day-of-summer',
    'Chen Yingzhen\'s 1960 Taiwanese short story collection explores the psychological legacy of Japanese colonialism and the political repressions of the KMT White Terror through the inner lives of small-town characters. Chen, a committed socialist, was imprisoned from 1968 to 1977 under Taiwan\'s martial law for "organizing a reading group" — effectively, for discussing Marxism. His work was suppressed in Taiwan for decades.'],

  ['the-lonely-passion-of-judith-hearne',
    'Brian Moore\'s 1955 debut novel follows a middle-aged Belfast spinster whose alcoholism and religious faith are two sides of the same hopeless self-deception. The Censorship Board of Ireland banned it within a year of publication. Moore, a Catholic who had left both the faith and Belfast, described the Irish censorship system as "a strange mixture of repression and hypocrisy"; the ban confirmed everything he had escaped.'],

  ['the-lonely-girl',
    'The second volume of Edna O\'Brien\'s Country Girls trilogy, following Kate and Baba into their Dublin working lives and first relationships, was banned in Ireland by the Censorship Board immediately upon publication in 1962, joining the first book on the prohibited list. O\'Brien has said the ban meant the books were widely read in Ireland via contraband copies — the Irish have always known how to find banned books.'],

  ['the-gospel-according-to-jesus-christ',
    'Already described — skip.'],

  ['the-hate-u-give',
    'Already described — skip.'],

  ['collected-stories-sean-ofaolain',
    'Seán O\'Faoláin\'s short stories about Irish rural and provincial life — politically complex, sexually frank for the era, and deeply skeptical of both nationalism and Catholicism — were repeatedly targeted by the Irish Censorship Board from the 1930s through the 1950s. O\'Faoláin became one of the board\'s most persistent critics, writing extensively about how censorship was throttling Irish intellectual life.'],

  ['autobiography-of-a-yogi',
    'Paramahansa Yogananda\'s 1946 spiritual autobiography introduces Western readers to yoga and Hindu philosophy through the story of his training under Bengali masters and his encounter with American culture. Banned in the Soviet Union as religious propaganda during the atheist campaigns. Despite this, the book has never gone out of print; Steve Jobs arranged for it to be distributed as a PDF to guests at his memorial.'],

  ['the-forging-of-a-rebel',
    'Already described — skip.'],

  ['show-me-will-mcbride',
    'Will McBride\'s 1974 West German sex education book for children, featuring explicit photographs of naked children and adults including sexual acts, was intended as a guide for young readers to understand their bodies. It became deeply controversial in multiple countries; Australia and various US jurisdictions banned it as child pornography. The debate about where sex education ends and exploitation begins remains unresolved.'],
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
