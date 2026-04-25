import { adminClient } from '../src/lib/supabase'

/**
 * Batch 24 — Missing canonical banned books:
 *   Kafka/Metamorphosis, Ellison/Invisible Man, Twain/Tom Sawyer,
 *   Rowling/Harry Potter, Harris/It's Perfectly Normal, Baldwin/Fire Next Time,
 *   Chopin/Awakening, Miller/Death of a Salesman, Gibran/The Prophet,
 *   plus descriptions for ~30 existing books without them.
 */

const supabase = adminClient()
const COVER_DELAY_MS = 300

interface OLResult { coverUrl: string | null; workId: string | null; publishYear: number | null }

async function fetchOL(title: string, author: string): Promise<OLResult> {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key,cover_i,first_publish_year&limit=1`)
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number; first_publish_year?: number }> }
    const doc = json.docs?.[0]
    return {
      coverUrl:    doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      workId:      doc?.key?.replace('/works/', '') ?? null,
      publishYear: doc?.first_publish_year ?? null,
    }
  } catch { return { coverUrl: null, workId: null, publishYear: null } }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function upsertSource(name: string, url: string) {
  const { data } = await supabase.from('ban_sources').upsert(
    { source_name: name, source_url: url, source_type: 'web' },
    { onConflict: 'source_url' }
  ).select('id').single()
  return data?.id as number | null
}

async function main() {
  const { data: scopes }          = await supabase.from('scopes').select('id, slug')
  const { data: reasons }         = await supabase.from('reasons').select('id, slug')
  const { data: existing }        = await supabase.from('books').select('slug')
  const { data: existingAuthors } = await supabase.from('authors').select('id, slug')

  const existingSlugs = new Set((existing ?? []).map(b => b.slug))
  const authorMap     = new Map((existingAuthors ?? []).map(a => [a.slug, a.id as number]))

  const scopeId  = (slug: string) => scopes!.find(s => s.slug === slug)!.id
  const reasonId = (slug: string) => {
    const r = reasons!.find(r => r.slug === slug)
    if (!r) throw new Error(`Reason slug missing: "${slug}"`)
    return r.id
  }

  const govId = scopeId('government')
  const schId = scopeId('school')
  const libId = scopeId('public_library')

  const alaSource = await upsertSource('American Library Association — Banned & Challenged Books', 'https://www.ala.org/advocacy/bbooks/frequentlychallengedbooks')
  const penSource = await upsertSource('PEN America Banned Books', 'https://pen.org/banned-books/')

  async function getOrCreateAuthor(displayName: string, slug: string): Promise<number | null> {
    if (authorMap.has(slug)) return authorMap.get(slug)!
    const { data, error } = await supabase.from('authors').insert({ slug, display_name: displayName }).select('id').single()
    if (error) {
      const { data: ex } = await supabase.from('authors').select('id').eq('slug', slug).single()
      if (ex) { authorMap.set(slug, ex.id); return ex.id }
      return null
    }
    authorMap.set(slug, data.id)
    return data.id
  }

  async function addBook(opts: {
    title: string; slug: string; authorDisplay: string; authorSlug: string
    year: number; genres: string[]; lang?: string; isbn13?: string
    coverUrl?: string; description?: string
    bans: {
      country: string; scopeId: number; status: string; yearStarted: number
      reasonSlugs: string[]; sourceId: number | null; actor?: string; description?: string
    }[]
  }) {
    if (existingSlugs.has(opts.slug)) { console.log(`  [skip] ${opts.title}`); return }
    process.stdout.write(`  ${opts.title}... `)

    let coverUrl = opts.coverUrl ?? null
    let workId: string | null = null
    if (!coverUrl) {
      const ol = await fetchOL(opts.title, opts.authorDisplay)
      await sleep(COVER_DELAY_MS)
      coverUrl = ol.coverUrl
      workId   = ol.workId
    }
    console.log(coverUrl ? 'ok' : 'no cover')

    const authorId = await getOrCreateAuthor(opts.authorDisplay, opts.authorSlug)

    const { data: book, error: be } = await supabase.from('books').insert({
      title: opts.title, slug: opts.slug,
      original_language: opts.lang ?? 'en',
      first_published_year: opts.year, ai_drafted: false, genres: opts.genres,
      cover_url: coverUrl, openlibrary_work_id: workId,
      ...(opts.isbn13 ? { isbn13: opts.isbn13 } : {}),
      ...(opts.description ? { description: opts.description } : {}),
    }).select('id').single()
    if (be) { console.error(`  [error] ${opts.title}: ${be.message}`); return }

    existingSlugs.add(opts.slug)
    if (authorId) await supabase.from('book_authors').insert({ book_id: book.id, author_id: authorId })

    for (const ban of opts.bans) {
      const { data: newBan, error: bane } = await supabase.from('bans').insert({
        book_id: book.id, country_code: ban.country, scope_id: ban.scopeId,
        action_type: 'banned', status: ban.status, year_started: ban.yearStarted,
        ...(ban.actor ? { actor: ban.actor } : {}),
        ...(ban.description ? { description: ban.description } : {}),
      }).select('id').single()
      if (bane) { console.error(`  [ban error] ${ban.country}: ${bane.message}`); continue }
      for (const rs of ban.reasonSlugs) {
        await supabase.from('ban_reason_links').insert({ ban_id: newBan.id, reason_id: reasonId(rs) })
      }
      if (ban.sourceId) await supabase.from('ban_source_links').insert({ ban_id: newBan.id, source_id: ban.sourceId })
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // NEW BOOKS
  // ══════════════════════════════════════════════════════════════════

  await addBook({
    title: 'The Metamorphosis',
    slug: 'the-metamorphosis',
    authorDisplay: 'Franz Kafka',
    authorSlug: 'franz-kafka',
    year: 1915, genres: ['literary-fiction', 'novella'], lang: 'de',
    isbn13: '9780553213690',
    description: 'Franz Kafka\'s novella about travelling salesman Gregor Samsa who wakes one morning to find himself transformed into a monstrous insect. A cornerstone of 20th-century literature, it gave the language the adjective "Kafkaesque." Kafka — a Czech Jew writing in German — was banned under the Nazis (his three sisters died in the Holocaust). The book was suppressed in Soviet-era Eastern Europe and Franco\'s Spain.',
    bans: [
      { country: 'DE', scopeId: govId, status: 'historical', yearStarted: 1933, reasonSlugs: ['political', 'racial'], sourceId: null, actor: 'Nazi Germany — Reich Chamber of Literature', description: 'Kafka was Jewish; his works were among those burned on May 10, 1933 and banned under the Third Reich.' },
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1950, reasonSlugs: ['political'], sourceId: null, actor: 'Soviet censorship', description: 'Kafka\'s absurdist vision of bureaucratic oppression was officially frowned upon in the USSR for its perceived "pessimism" and lack of socialist realism.' },
      { country: 'ES', scopeId: govId, status: 'historical', yearStarted: 1939, reasonSlugs: ['political'], sourceId: null, actor: 'Franco regime', description: 'Banned under Francisco Franco\'s dictatorship as part of broad censorship of modernist and leftist literature.' },
    ],
  })

  await addBook({
    title: 'Invisible Man',
    slug: 'invisible-man-ellison',
    authorDisplay: 'Ralph Ellison',
    authorSlug: 'ralph-ellison',
    year: 1952, genres: ['literary-fiction'], lang: 'en',
    isbn13: '9780679732761',
    description: 'Ralph Ellison\'s National Book Award-winning novel follows a nameless young Black man as he navigates American society from the Jim Crow South to Harlem, experiencing the ways racial prejudice renders him invisible to white America. Written over seven years, it is considered one of the great American novels. Challenged in US schools for its language, sexual content, and frank portrayal of racism.',
    bans: [
      { country: 'US', scopeId: schId, status: 'active', yearStarted: 1994, reasonSlugs: ['racial', 'sexual'], sourceId: alaSource, description: 'Challenged in schools for its language and sexual content; removed from reading lists in several states despite its canonical status in American literature.' },
    ],
  })

  await addBook({
    title: 'The Adventures of Tom Sawyer',
    slug: 'the-adventures-of-tom-sawyer',
    authorDisplay: 'Mark Twain',
    authorSlug: 'mark-twain',
    year: 1876, genres: ['literary-fiction', 'children'], lang: 'en',
    isbn13: '9780140390469',
    description: 'Mark Twain\'s episodic novel of childhood adventure in the fictional town of St. Petersburg, Missouri, following mischievous Tom Sawyer and his friends Huckleberry Finn and Becky Thatcher. Challenged in schools alongside its companion novel The Adventures of Huckleberry Finn for its racial language and stereotyping of Native American characters.',
    bans: [
      { country: 'US', scopeId: schId, status: 'active', yearStarted: 1876, reasonSlugs: ['racial', 'language'], sourceId: alaSource, description: 'Challenged repeatedly in US schools for racial slurs and the portrayal of Native American character "Injun Joe." Removed from reading lists in several districts.' },
    ],
  })

  await addBook({
    title: "Harry Potter and the Philosopher's Stone",
    slug: 'harry-potter-philosophers-stone',
    authorDisplay: 'J.K. Rowling',
    authorSlug: 'jk-rowling',
    year: 1997, genres: ['fantasy', 'children', 'young-adult'], lang: 'en',
    isbn13: '9780439708180',
    description: 'J.K. Rowling\'s debut novel introduces orphaned Harry Potter who discovers on his eleventh birthday that he is a wizard, attending Hogwarts School of Witchcraft and Wizardry. The most challenged book series of the early 2000s in the US, targeted by religious groups who objected to its positive portrayal of witchcraft, sorcery, and occult themes. Banned by some churches and school districts worldwide; the series burned at religious events in the US.',
    bans: [
      { country: 'US', scopeId: schId, status: 'active', yearStarted: 1999, reasonSlugs: ['religious'], sourceId: alaSource, description: 'The ALA\'s most challenged series of 2000–2009. Religious groups argued that the books promoted witchcraft; removed from school libraries in numerous US states.' },
      { country: 'UA', scopeId: govId, status: 'historical', yearStarted: 2002, reasonSlugs: ['religious'], sourceId: null, actor: 'Ukrainian Orthodox Church', description: 'Condemned by Orthodox Church authorities as promoting occultism.' },
      { country: 'AE', scopeId: govId, status: 'active', yearStarted: 2007, reasonSlugs: ['religious'], sourceId: null, actor: 'UAE Ministry of Education', description: 'Removed from school curricula for containing themes of magic and sorcery contradicting Islamic values.' },
    ],
  })

  await addBook({
    title: "It's Perfectly Normal",
    slug: 'its-perfectly-normal',
    authorDisplay: 'Robie H. Harris',
    authorSlug: 'robie-h-harris',
    year: 1994, genres: ['non-fiction', 'children'], lang: 'en',
    isbn13: '9780763644833',
    description: 'A frank sex education picture book for children aged 10 and up, covering puberty, reproduction, sexuality, and relationships with warm, accurate illustrations. Consistently among the top five most challenged books in the US, targeted by parents who object to its frank illustrations of nudity, sexual intercourse, and discussions of homosexuality. Librarians and educators widely defend it as one of the most important health resources available to young people.',
    bans: [
      { country: 'US', scopeId: libId, status: 'active', yearStarted: 1996, reasonSlugs: ['sexual'], sourceId: alaSource, description: 'Among the most consistently challenged books in the US. Parents have objected to its frank, anatomically accurate illustrations of bodies and sex acts, its discussion of homosexuality, and its discussion of abortion.' },
    ],
  })

  await addBook({
    title: 'The Fire Next Time',
    slug: 'the-fire-next-time',
    authorDisplay: 'James Baldwin',
    authorSlug: 'james-baldwin',
    year: 1963, genres: ['non-fiction', 'essays'], lang: 'en',
    isbn13: '9780679744726',
    description: 'James Baldwin\'s prophetic collection of two essays — "My Dungeon Shook," a letter to his teenage nephew, and "Down at the Cross," a meditation on race, religion, and the Nation of Islam — written at the height of the civil rights movement. One of the most powerful American texts on race, it warned of a coming reckoning: "God gave Noah the rainbow sign, No more water, the fire next time." Challenged in US schools for its frank discussion of race and religion.',
    bans: [
      { country: 'US', scopeId: schId, status: 'active', yearStarted: 2021, reasonSlugs: ['racial', 'political'], sourceId: penSource, description: 'Challenged in US schools during the wave of book removals targeting discussions of systemic racism and racial justice.' },
    ],
  })

  await addBook({
    title: 'The Awakening',
    slug: 'the-awakening',
    authorDisplay: 'Kate Chopin',
    authorSlug: 'kate-chopin',
    year: 1899, genres: ['literary-fiction'], lang: 'en',
    isbn13: '9780393970920',
    description: 'Kate Chopin\'s novel follows Edna Pontellier, a wife and mother in late 19th-century New Orleans who gradually awakens to desires — for freedom, artistic expression, and sexual fulfilment — that her society has no framework for and cannot tolerate. On publication it was denounced as immoral and Chopin was ostracised from St. Louis literary society. It was out of print for decades before being rediscovered as a feminist landmark in the 1960s.',
    bans: [
      { country: 'US', scopeId: libId, status: 'historical', yearStarted: 1899, reasonSlugs: ['sexual', 'moral'], sourceId: null, description: 'Removed from the lending library in Chopin\'s home city of St. Louis upon publication. Critics called it "trite and sordid" and Chopin was socially ostracised.' },
      { country: 'US', scopeId: schId, status: 'active', yearStarted: 1990, reasonSlugs: ['sexual'], sourceId: alaSource, description: 'Challenged in high school curricula for its frank depiction of a woman\'s sexuality and its sympathetic portrayal of infidelity and abandonment of family.' },
    ],
  })

  await addBook({
    title: 'Death of a Salesman',
    slug: 'death-of-a-salesman',
    authorDisplay: 'Arthur Miller',
    authorSlug: 'arthur-miller',
    year: 1949, genres: ['drama'], lang: 'en',
    isbn13: '9780140481341',
    description: 'Arthur Miller\'s Pulitzer Prize-winning tragedy follows Willy Loman, an ageing travelling salesman whose faith in the American Dream has brought him only failure and self-delusion. A defining portrait of American capitalism and its casualties. Miller himself was called before the House Un-American Activities Committee in 1956 and convicted of contempt of Congress (later overturned) for refusing to name associates. The play has been challenged in schools for its language and portrayal of suicide.',
    bans: [
      { country: 'US', scopeId: schId, status: 'active', yearStarted: 1963, reasonSlugs: ['political', 'other'], sourceId: alaSource, description: 'Challenged in schools for its language, references to suicide, and its perceived anti-capitalist message.' },
      { country: 'SU', scopeId: govId, status: 'historical', yearStarted: 1950, reasonSlugs: ['political'], sourceId: null, description: 'Miller\'s association with American leftists made his work politically complicated in the Cold War era; Death of a Salesman was not widely performed in the Soviet bloc.' },
    ],
  })

  await addBook({
    title: 'The Prophet',
    slug: 'the-prophet-gibran',
    authorDisplay: 'Kahlil Gibran',
    authorSlug: 'kahlil-gibran',
    year: 1923, genres: ['poetry', 'philosophy'], lang: 'en',
    isbn13: '9780679208242',
    description: 'Kahlil Gibran\'s spiritual masterwork in which the prophet Almustafa, about to sail home after twelve years, is asked by the people of Orphalese to speak on love, marriage, children, joy, sorrow, freedom, and death. One of the best-selling poetry books of the 20th century. Banned in Lebanon and some other Arab countries at various points for perceived blasphemy and for Gibran\'s syncretic mixing of Christian and Sufi Islamic mysticism.',
    bans: [
      { country: 'LB', scopeId: govId, status: 'historical', yearStarted: 1981, reasonSlugs: ['religious', 'blasphemy'], sourceId: null, description: 'Condemned by the Lebanese Maronite Church for Gibran\'s unorthodox, syncretic spirituality. Gibran had earlier been excommunicated by the Maronite Church.' },
    ],
  })

  // ══════════════════════════════════════════════════════════════════
  // DESCRIPTIONS for existing books that lack them
  // ══════════════════════════════════════════════════════════════════

  const descriptionUpdates: Record<string, string> = {
    'of-mice-and-men': 'John Steinbeck\'s Depression-era novella about two displaced migrant ranch workers, the sharp George Milton and his gentle giant friend Lennie Small, who dream of one day owning their own land. One of the most frequently challenged books in American schools, targeted for its profanity, racial slurs (it is set in 1930s California), and its frank treatment of euthanasia. Despite constant challenges, it remains required reading in many curricula.',

    'the-grapes-of-wrath': 'John Steinbeck\'s Pulitzer Prize-winning epic follows the Joad family as they flee the Dust Bowl of Oklahoma for the promised land of California, only to find exploitation and despair. Published in 1939, it was immediately banned in Kern County, California — the very county it depicts — for being "obscene" and portraying conditions too harshly. Steinbeck received death threats; the book was burned publicly. It remains challenged today for profanity and sexuality.',

    'one-flew-over-the-cuckoos-nest': 'Ken Kesey\'s 1962 novel set in a psychiatric ward in Oregon, narrated by "Chief" Bromden, a Native American patient who witnesses the power struggle between the charismatic Randle McMurphy and the authoritarian Nurse Ratched. A countercultural classic about conformity, institutional power, and freedom. Challenged in schools for profanity, sexual content, and its unflattering portrayal of psychiatric treatment; adapted into an Academy Award-winning film by Miloš Forman.',

    'the-bell-jar': 'Sylvia Plath\'s thinly veiled autobiographical novel about Esther Greenwood, a talented young woman who wins a magazine internship in New York before descending into mental illness and attempted suicide. Published under the pseudonym "Victoria Lucas" in England in 1963, the same year Plath died by suicide at 30. Challenged in schools for its frank treatment of depression and suicide, and for its protagonist\'s attitude toward men and marriage.',

    'go-ask-alice': 'Published anonymously in 1971 and long attributed to a real diary of a fifteen-year-old girl\'s descent into drug addiction (the authorship is now credited to therapist Beatrice Sparks, who may have substantially fictionalised it), the book became a classic cautionary tale about teenage drug use. Challenged and banned in schools and libraries for its frank depictions of drug use, sexual content, and profanity — despite, or because of, its anti-drug message.',

    'the-perks-of-being-a-wallflower': 'Stephen Chbosky\'s epistolary coming-of-age novel set in the early 1990s, narrated by Charlie, a sensitive high school freshman dealing with trauma, first love, and questions of identity. One of the most frequently challenged books of the 2000s and 2010s, removed from school curricula and libraries across the US for its frank discussions of sexuality (including same-sex relationships), drug and alcohol use, and sexual abuse.',

    'i-know-why-the-caged-bird-sings': 'Maya Angelou\'s 1969 autobiography of her childhood and adolescence in Stamps, Arkansas and St. Louis, Missouri — including her experience of rape at age eight and its aftermath. One of the most challenged books in American schools, targeted for its frank depiction of sexual abuse, its language, and its unflinching portrait of racism. Angelou always defended it: "I wrote it to say that despite it all, a person can live, can still say yes to life."',

    'native-son': 'Richard Wright\'s 1940 novel about Bigger Thomas, a young Black man from the Chicago South Side whose accidental murder of his white employer\'s daughter triggers a chain of events that reveal the depth of racism in American society. The first novel by a Black author selected by the Book of the Month Club. Challenged for its violence, sexuality, and explicit treatment of race; Wright was the first major American writer to portray white racism from a Black man\'s perspective.',

    'black-boy': 'Richard Wright\'s 1945 autobiography of growing up Black in the Jim Crow South, tracing his journey from childhood in Mississippi to Chicago. One of the most honest accounts of Black life in early 20th-century America. Challenged in schools for its language and frank portrayal of racism and violence; challenged by some for its atheism and communist sympathies. Wright\'s publisher asked him to remove the second half (set in Chicago), which was published separately as "American Hunger."',

    'their-eyes-were-watching-god': 'Zora Neale Hurston\'s 1937 novel about Janie Crawford\'s journey toward self-discovery through three marriages in early 20th-century Florida. Written in the rich vernacular of African-American Southern speech, it was initially dismissed by critics including Richard Wright before being rediscovered and championed by Alice Walker in the 1970s. Challenged in schools for its frank sexual content and language.',

    'the-color-purple': 'Alice Walker\'s Pulitzer Prize and National Book Award-winning novel, told in letters by Celie, a young Black woman in rural Georgia who survives sexual abuse and domestic violence to find her voice, her strength, and love. Banned and challenged in schools across the US for its frank depictions of sexual violence, its portrayal of lesbian relationships, and its depiction of abusive Black men — with some challengers calling it racist against Black men.',

    'for-whom-the-bell-tolls': 'Ernest Hemingway\'s 1940 novel set during the Spanish Civil War, following American Robert Jordan, who joins an anti-fascist guerrilla band in the mountains of Spain to blow up a bridge. One of Hemingway\'s most ambitious works, banned in Spain under Franco for its anti-fascist politics and its depiction of Republican Spain. The title, from John Donne\'s meditation, asks "for whom does the bell toll? It tolls for thee."',

    'the-sun-also-rises': 'Ernest Hemingway\'s 1926 debut novel, the defining portrait of the "Lost Generation" — the disillusioned American and British expatriates who drifted through Europe after World War I. Follows Jake Barnes and Brett Ashley through the cafés of Paris and the bullfighting festivals of Pamplona. Challenged and banned for its frank portrayal of drinking, sexual promiscuity, and its perceived nihilism; Boston\'s city library banned it upon publication.',

    'madame-bovary': 'Gustave Flaubert\'s 1857 masterpiece about Emma Bovary, a provincial doctor\'s wife whose romantic fantasies lead her through a series of ruinous affairs and into financial catastrophe. Flaubert was tried for "offenses against public morals and religion" upon serialisation; his acquittal made the novel famous. The trial record became a landmark in the history of censorship. Challenged in modern curricula for its sexual content.',

    'the-picture-of-dorian-gray': 'Oscar Wilde\'s 1890 novel about Dorian Gray, a beautiful young man whose portrait ages and bears the marks of his sins while Dorian himself remains untouched. A meditation on aestheticism, moral corruption, and the consequences of vanity. Censored upon publication in Lippincott\'s Magazine — the editor removed passages without Wilde\'s knowledge. Used against Wilde in his 1895 trials for "gross indecency," with the prosecution reading passages as evidence of homosexual intent.',

    'one-hundred-years-of-solitude': 'Gabriel García Márquez\'s 1967 novel chronicling seven generations of the Buendía family in the fictional town of Macondo, blending the magical and the mundane in the style that came to define magical realism. Winner of the Nobel Prize in Literature for its author. Banned in various Latin American countries under military dictatorships for its perceived leftist sympathies; challenged in US schools for sexual content.',

    'the-house-of-the-spirits': 'Isabel Allende\'s debut novel, a multigenerational saga of the del Valle/Trueba family in an unnamed (but clearly Chilean) country, tracing love, politics, and clairvoyance through decades of history culminating in a military coup. Published in 1982, written partly as letters to her dying grandfather. Banned in Chile under Pinochet\'s dictatorship. Allende wrote it in exile, and the book was not legally available in Chile until the return to democracy.',

    'the-house-on-mango-street': 'Sandra Cisneros\' 1984 novel-in-vignettes narrated by Esperanza Cordero, a young Chicana girl growing up in a Hispanic neighbourhood of Chicago, navigating poverty, sexuality, and the desire to escape. One of the most widely taught works of Chicana literature. Challenged in schools in Arizona after the 2010 ban on Mexican-American Studies; also challenged for its sexual content including a scene depicting sexual assault.',

    'the-kite-runner': 'Khaled Hosseini\'s debut novel about Amir, the son of a wealthy Kabul merchant, and his friendship with Hassan, the son of his father\'s servant, set against the backdrop of Afghanistan\'s transformation from monarchy to Soviet occupation to Taliban rule. One of the most challenged books in US schools for its depiction of rape, violence, and, in some cases, its religious content (Islamic prayer scenes challenged by parents who found them inappropriate).',

    'as-i-lay-dying': 'William Faulkner\'s 1930 experimental novel narrated by fifteen different characters as the Bundren family transports the body of matriarch Addie Bundren across Mississippi for burial in her hometown. A showcase for stream-of-consciousness technique and black humour. Challenged in schools for its language and the often darkly comic treatment of death and grief. Faulkner won the Nobel Prize in Literature in 1949.',

    'east-of-eden': 'John Steinbeck\'s 1952 epic novel interweaving the story of his family (the Hamiltons) with the fictional Trask family across three generations in California\'s Salinas Valley, retelling the story of Cain and Abel. Steinbeck called it his magnum opus. Challenged in schools for its language, violence, and sexual content — including the character of Cathy Ames, one of American fiction\'s most memorable villains.',

    'the-awakening': 'Kate Chopin\'s 1899 novel follows Edna Pontellier, a wife and mother in New Orleans who gradually awakens to desires for freedom, artistic expression, and sexual fulfilment that her society cannot tolerate. Denounced as immoral on publication and out of print for decades before feminist critics rediscovered it as a landmark of American literature. Challenged in modern schools for its frank portrayal of female sexuality and adultery.',

    'cancer-ward': 'Aleksandr Solzhenitsyn\'s 1968 semi-autobiographical novel set in a Soviet cancer ward in 1955, following the moral and philosophical debates among patients from all walks of Soviet life. Solzhenitsyn himself survived cancer while in the Gulag. The novel was banned in the Soviet Union and circulated only in samizdat; its publication abroad contributed to Solzhenitsyn\'s expulsion from the Soviet Writers\' Union.',

    'children-of-the-alley': 'Naguib Mahfouz\'s 1959 allegorical novel retelling the stories of Gabalawi (God), Adam and Eve, Moses, Jesus, and Muhammad through the lives of successive generations in a Cairo alley. Egypt\'s Al-Azhar Islamic institution condemned it as blasphemous; the novel was banned in Egypt until 2006, despite Mahfouz winning the Nobel Prize in Literature in 1988. In 1994, a young man stabbed Mahfouz in the neck — he survived, aged 82, but lost mobility in his right hand.',

    'ulysses': 'James Joyce\'s 1922 novel following Leopold Bloom through a single day in Dublin on June 16, 1904 (now celebrated as "Bloomsday"), paralleling Homer\'s Odyssey. Written in a dizzying array of styles including stream of consciousness, the book\'s frank sexuality led to one of the defining censorship battles of the 20th century. Serialised in The Little Review, which was convicted of obscenity in 1921. Judge John M. Woolsey\'s 1933 ruling lifting the US ban became a landmark in First Amendment law.',

    'bridge-to-terabithia': 'Katherine Paterson\'s 1977Newbery Medal-winning novel about ten-year-old Jess Aarons and his friendship with the imaginative Leslie Burke, who together create a secret fantasy world in the woods called Terabithia. A profound exploration of friendship, creativity, and grief. One of the most frequently challenged children\'s books in the US: targeted for its language, occult themes (the fantasy world), and its portrayal of death. Paterson wrote it to help her son process the death of his best friend.',

    'flowers-for-algernon': 'Daniel Keyes\' story of Charlie Gordon, a thirty-two-year-old man with an intellectual disability who undergoes an experimental surgical procedure that temporarily makes him a genius. As Charlie\'s intelligence grows, so does his awareness of how he has been treated. Won the Hugo and Nebula Awards. Challenged in schools for sexual content depicting Charlie\'s coming-of-age as his intelligence develops, and for what some critics describe as its pessimistic worldview.',

    'dialogue-galileo': 'Galileo Galilei\'s 1632 dialogue between three characters debating the Ptolemaic versus Copernican models of the solar system. Galileo carefully arranged the dialogue to appear impartial, but the Catholic Church recognised the Copernican argument as superior and summoned him before the Inquisition. Forced to recant under threat of torture, Galileo reportedly muttered "And yet it moves." The book was placed on the Index of Forbidden Books until 1835.',

    'don-quixote': 'Miguel de Cervantes\' 1605 novel — often called the first modern novel — follows the deluded nobleman Alonso Quixada who renames himself Don Quixote and sets out with his squire Sancho Panza to revive chivalry, tilting at windmills he believes are giants. A foundational work of Western literature, it was briefly banned by the Spanish Inquisition for certain passages deemed irreverent. The second volume appeared in 1615 in direct response to an unauthorised sequel.',

    'alice-in-bibleland': 'Alice Joyce Davidson\'s 1981 illustrated retelling of Bible stories in a format inspired by Lewis Carroll\'s Alice in Wonderland, aimed at young children. Despite its Christian content, it was challenged in some US communities for its association with Carroll\'s original — with parents concerned about the fictional framing of Biblical text.',
  }

  console.log('\nUpdating descriptions for existing books...')
  let updated = 0
  for (const [slug, description] of Object.entries(descriptionUpdates)) {
    const { data: book } = await supabase.from('books').select('id, description').eq('slug', slug).single()
    if (!book) { console.log(`  [not found] ${slug}`); continue }
    if (book.description) { continue }
    const { error } = await supabase.from('books').update({ description }).eq('id', book.id)
    if (!error) { console.log(`  ✓ ${slug}`); updated++ }
  }
  console.log(`  ${updated} descriptions added`)

  const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
  console.log(`\nDone. Total books in DB: ${count}`)
}

main().catch(console.error)
