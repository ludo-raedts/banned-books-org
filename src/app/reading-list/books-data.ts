export type CategorySlug =
  | 'censorship-book-banning'
  | 'authoritarianism-propaganda'
  | 'education-liberation'
  | 'empire-race-history'
  | 'war-nationalism-memory'
  | 'fiction-censorship'
  | 'conflict-prison-resistance'

export const CATEGORIES: { slug: CategorySlug; heading: string }[] = [
  { slug: 'censorship-book-banning',    heading: 'Books directly about censorship and book banning' },
  { slug: 'authoritarianism-propaganda', heading: 'Authoritarianism, propaganda, and information control' },
  { slug: 'education-liberation',        heading: 'Education, liberation, and who gets to learn' },
  { slug: 'empire-race-history',         heading: 'Empire, race, and contested history' },
  { slug: 'war-nationalism-memory',      heading: 'War, nationalism, and political memory' },
  { slug: 'fiction-censorship',          heading: 'Fiction that exposes censorship and control' },
  { slug: 'conflict-prison-resistance',  heading: 'Voices from conflict, prison, and resistance' },
]

export type ReadingListBook = {
  title: string
  author: string
  category: CategorySlug
  description: string
  whyWeRecommend: string
  tags: string[]
  internalSlug?: string
  isOfficiallyBanned: boolean
}

export const BOOKS: ReadingListBook[] = [
  // ── A. Books directly about censorship and book banning ──────────────────
  {
    title: 'On Book Banning',
    author: 'Ira Wells',
    category: 'censorship-book-banning',
    description:
      'A scholarly yet accessible study of how and why books get banned in democratic societies. Wells traces the history of censorship from the earliest printed texts through to today\'s school board battles, arguing that book banning is never really about protecting readers — it is about controlling who has access to ideas. Drawing on legal theory, literary history, and political philosophy, he examines how the same arguments recur across centuries: that certain books are dangerous to children, destabilising to society, or offensive to community standards.',
    whyWeRecommend:
      'Wells gives you the conceptual vocabulary to argue back against censorship. He shows that bans are rarely spontaneous — they follow patterns, reuse scripts, and serve predictable interests. If you want to understand the structural logic of book banning rather than just cataloguing its instances, this is the place to start.',
    tags: ['censorship', 'book banning', 'democracy', 'legal theory', 'history of reading'],
    isOfficiallyBanned: false,
  },
  {
    title: "You Can't Say That!",
    author: 'Leonard S. Marcus',
    category: 'censorship-book-banning',
    description:
      'Children\'s literature historian Leonard Marcus interviews writers and illustrators whose books for young readers have been challenged or banned — from Judy Blume to Roald Dahl to Toni Morrison. The result is both a defence of children\'s literature and a damning portrait of the adults who try to restrict it. Marcus shows how often banning is driven by adult anxieties rather than any real harm to children, and how the books that get challenged most are often the ones that matter most: books about race, sexuality, family, death, and freedom.',
    whyWeRecommend:
      "This book makes the case for children's literature as a site of genuine political contest. It reminds us that banning books aimed at young readers is never really about protecting children — it is about deciding which realities they are permitted to know exist.",
    tags: ["children's literature", 'censorship', 'young adult', 'book banning'],
    isOfficiallyBanned: false,
  },
  {
    title: "Banned Books: The World's Most Controversial Books",
    author: 'DK',
    category: 'censorship-book-banning',
    description:
      'A visually striking reference guide that documents some of the most famous banned and challenged books in history, from Galileo\'s astronomical treatises to contemporary novels. Each entry explains the context of the ban, the charges levelled, the authorities behind it, and — often — the irony that the attempt to suppress the book only increased its fame. Spanning religious censorship, political repression, obscenity prosecutions, and school board challenges, this is a broad survey that works as both an introduction and a reference.',
    whyWeRecommend:
      "An excellent starting point if you want the full sweep of censorship history in one volume. DK's format is often underestimated — this is genuinely informative, with enough depth in each entry to spark further reading on any case that catches your attention.",
    tags: ['reference', 'history', 'censorship', 'book banning', 'world history'],
    isOfficiallyBanned: false,
  },

  // ── B. Authoritarianism, propaganda, and information control ─────────────
  {
    title: 'Autocracy, Inc.',
    author: 'Anne Applebaum',
    category: 'authoritarianism-propaganda',
    description:
      "Applebaum's urgent analysis of how modern autocracies co-operate across borders to entrench their power. Where earlier authoritarianism depended on ideology, today's autocrats — from Moscow to Beijing to Caracas — share tactics, money, technology, and propaganda techniques, creating an international infrastructure of repression. This is not a book about book banning specifically, but it is essential to understanding the political systems within which censorship thrives and survives.",
    whyWeRecommend:
      "To understand why books get banned, you need to understand the governments that ban them. Applebaum provides the clearest analysis of how contemporary authoritarian systems actually work and sustain themselves — indispensable context for anyone trying to make sense of global censorship data.",
    tags: ['authoritarianism', 'democracy', 'propaganda', 'geopolitics', 'Russia', 'China'],
    isOfficiallyBanned: false,
  },
  {
    title: 'How Propaganda Works',
    author: 'Jason Stanley',
    category: 'authoritarianism-propaganda',
    description:
      'Yale philosopher Jason Stanley offers a rigorous philosophical analysis of how propaganda functions in democratic societies — not just in obvious totalitarian settings. He distinguishes between the sincere and demagogic use of language, and shows how certain political speech undermines the epistemic commons that democracy depends on. An essential theoretical grounding for why controlling the information environment is so central to political power.',
    whyWeRecommend:
      'Stanley gives you the philosophical tools to see propaganda where it would otherwise be invisible. Most propaganda does not announce itself — it works by seeming reasonable. This book trains your eye for the subtle forms of information control that operate inside democracies, not just in obvious dictatorships.',
    tags: ['philosophy', 'propaganda', 'democracy', 'language', 'information control'],
    isOfficiallyBanned: false,
  },
  {
    title: 'Twilight of Democracy',
    author: 'Anne Applebaum',
    category: 'authoritarianism-propaganda',
    description:
      "A short, personal, and devastating book about the rise of authoritarianism within Applebaum's own social circle — among intellectuals and journalists who have turned from liberalism toward nationalist populism. She traces what she calls the \"clerisy\" appeal of authoritarian politics: the comfort of simple narratives, the pleasure of belonging, the satisfaction of having enemies. Especially sharp on Poland and Hungary, and on how democracies hollow themselves out from the inside.",
    whyWeRecommend:
      'Essential reading on how cultural and intellectual elites make peace with authoritarian politics. The chapters on Hungary and Poland are particularly relevant to censorship: these are countries where state control of cultural institutions, publishing, and education has been systematically expanded in recent years.',
    tags: ['authoritarianism', 'populism', 'Poland', 'Hungary', 'democracy', 'intellectuals'],
    isOfficiallyBanned: false,
  },
  {
    title: 'The Road to Unfreedom',
    author: 'Timothy Snyder',
    category: 'authoritarianism-propaganda',
    description:
      "Historian Timothy Snyder traces the ideological roots of Russia's 21st-century authoritarianism, from the fascist philosopher Ivan Ilyin to the information warfare of recent elections. Snyder argues that Russia has developed a coherent politics of \"eternity\" — a propaganda system based not on truth or lies but on the abolition of factuality itself. Where earlier totalitarianism demanded that you believe the propaganda, this system demands only that you stop believing anything.",
    whyWeRecommend:
      "Essential for understanding the most sophisticated form of information control operating today. Russia's media ecosystem is not simply censored — it is designed to make citizens epistemically helpless. Snyder's analysis helps explain why truth-telling is itself a political act under these conditions.",
    tags: ['Russia', 'propaganda', 'information warfare', 'history', 'politics', 'Ukraine'],
    isOfficiallyBanned: false,
  },

  // ── C. Education, liberation, and who gets to learn ─────────────────────
  {
    title: 'Pedagogy of the Oppressed',
    author: 'Paulo Freire',
    category: 'education-liberation',
    description:
      'First published in 1968, this foundational text of critical pedagogy argues that traditional education functions as a tool of oppression — what Freire calls the "banking model", in which passive students receive deposits of information from authoritative teachers. True education, he argues, begins with dialogue and with treating the student\'s own experience as a valid subject of inquiry. Deeply influential on educators, liberation theologians, and social movements worldwide, and itself banned under several authoritarian regimes.',
    whyWeRecommend:
      'Freire is essential reading because censorship of the curriculum is, at root, a pedagogical question: who gets to decide what is worth knowing? His framework helps you see why controlling what children read in school is always also about controlling how they think.',
    tags: ['education', 'liberation', 'Brazil', 'critical pedagogy', 'politics', 'banned'],
    isOfficiallyBanned: true,
  },
  {
    title: 'Teaching to Transgress',
    author: 'bell hooks',
    category: 'education-liberation',
    description:
      'bell hooks argues that education should be a practice of freedom — but that this requires teachers and students willing to transgress comfortable boundaries. Drawing on her own experience as a Black woman in predominantly white classrooms, she describes the political stakes of what gets taught, how it gets taught, and who gets to speak. A deeply personal and rigorous argument for why whose knowledge counts as knowledge is never a neutral question.',
    whyWeRecommend:
      'Hooks grounds the abstract questions of educational freedom in the specific experience of race, gender, and class in American classrooms. An essential complement to Freire — concrete where he is abstract, personal where he is theoretical, and specific about the power relations that shape every curriculum.',
    tags: ['education', 'race', 'gender', 'liberation', 'feminism', 'pedagogy'],
    isOfficiallyBanned: false,
  },

  // ── D. Empire, race, and contested history ───────────────────────────────
  {
    title: 'Orientalism',
    author: 'Edward W. Said',
    category: 'empire-race-history',
    description:
      "Said's landmark 1978 study of how Western scholarship, literature, and political discourse constructed \"the Orient\" — not as a factual description but as a system of knowledge that justified imperial domination. Orientalism shows how representation is never neutral: to name, categorise, and describe a culture is also to claim authority over it. Arguably the most influential academic book of the past fifty years, and intensely controversial precisely because it exposes the political function of intellectual categories.",
    whyWeRecommend:
      "Said provides the analytical vocabulary for understanding how dominant cultures suppress or distort other cultures' self-representation. To understand which books get banned and which histories get suppressed, you need to understand whose knowledge has been treated as authoritative — and why.",
    tags: ['postcolonialism', 'empire', 'representation', 'Middle East', 'Islam', 'literature'],
    isOfficiallyBanned: false,
  },
  {
    title: 'How to Hide an Empire',
    author: 'Daniel Immerwahr',
    category: 'empire-race-history',
    description:
      "A brilliantly written history of the United States' territorial empire — the colonies, bases, and territories that most Americans neither know about nor think of when they imagine their country. Immerwahr shows how \"America\" as typically imagined erases the experiences of tens of millions of people who live under US jurisdiction but lack full political rights. A model of how official national narratives are constructed by what they deliberately omit.",
    whyWeRecommend:
      'This is a book about historical censorship in the broadest sense: the active suppression of inconvenient facts from the national story. Essential reading for anyone interested in why certain histories are erased, simplified, or never told — and who benefits from the erasure.',
    tags: ['American history', 'empire', 'colonialism', 'race', 'territorial history'],
    isOfficiallyBanned: false,
  },
  {
    title: 'White Tears/Brown Scars',
    author: 'Ruby Hamad',
    category: 'empire-race-history',
    description:
      'Australian journalist Ruby Hamad argues that the weaponisation of white feminine fragility against people of colour is a systemic mechanism of racial control, not a collection of individual incidents. Drawing on history from colonial violence to contemporary social media, she traces how emotion, vulnerability, and innocence have been instrumentalised to suppress people of colour and their accounts of their own lives across centuries.',
    whyWeRecommend:
      "Directly relevant to contemporary book banning: many of the challenges to books about race in American schools are framed in terms of protecting the emotional wellbeing of white children. Hamad's analysis makes visible the exact dynamics driving these removals.",
    tags: ['race', 'whiteness', 'feminism', 'colonialism', 'Australia'],
    isOfficiallyBanned: false,
  },
  {
    title: 'The New Jim Crow',
    author: 'Michelle Alexander',
    category: 'empire-race-history',
    description:
      'Legal scholar Michelle Alexander argues that mass incarceration in the United States functions as a new racial caste system, maintaining the social subordination of Black Americans through criminal law rather than Jim Crow statutes. One of the most frequently banned books in American schools — targeted precisely because it makes a structural rather than individual argument about race in America.',
    whyWeRecommend:
      'The frequency with which this book appears on banned lists is itself significant. When schools remove it, they are performing exactly the kind of historical erasure Alexander describes. This book is simultaneously about the suppression of a people and is itself an object of that suppression.',
    tags: ['race', 'mass incarceration', 'criminal justice', 'American history', 'banned'],
    isOfficiallyBanned: true,
  },
  {
    title: 'Stamped from the Beginning',
    author: 'Ibram X. Kendi',
    category: 'empire-race-history',
    description:
      'A comprehensive history of racist ideas in America, tracing how ideas about Black inferiority were constructed and deployed across five centuries. Kendi argues that racist ideas were not the cause of racist policies but their justification — created after the fact to rationalise exploitation and segregation. One of the most challenged books in American education, frequently removed from school curricula for the directness of its historical argument.',
    whyWeRecommend:
      "Another book that is both about the suppression of Black history and is itself suppressed. Kendi's historical methodology is exceptional — this is scholarship, not polemic. The consistency with which it appears on banned lists makes it essential reading on its own terms.",
    tags: ['race', 'American history', 'racism', 'history of ideas', 'banned'],
    isOfficiallyBanned: true,
  },

  // ── E. War, nationalism, and political memory ────────────────────────────
  {
    title: 'Notes on Nationalism',
    author: 'George Orwell',
    category: 'war-nationalism-memory',
    description:
      'This 1945 essay is one of the most precise analyses of how nationalism distorts the capacity to think. Orwell distinguishes nationalism — the aggressive identification with a power unit — from patriotism, and shows how nationalism requires the selective suppression of facts that contradict the national myth. Short, dense, and prescient about how political loyalty corrupts intellectual honesty across ideological lines.',
    whyWeRecommend:
      "An essential text for understanding why nationalist governments suppress inconvenient histories and censor books that undermine the national story. Orwell's analysis of how loyalty to a collective prevents clear thinking applies directly to contemporary curriculum battles and book banning controversies.",
    tags: ['nationalism', 'Orwell', 'politics', 'war', 'patriotism', 'censorship'],
    isOfficiallyBanned: false,
  },
  {
    title: 'Why War?',
    author: 'Richard Overy',
    category: 'war-nationalism-memory',
    description:
      'Historian Richard Overy returns to the exchange of letters between Freud and Einstein on the origins of war, using it as a launching point for a broad survey of how different disciplines — psychology, biology, political science, history — have attempted to explain why humans wage war. Methodical, sober, and rich in historical examples, it shows how every era must answer the question anew.',
    whyWeRecommend:
      "War is one of the great drivers of censorship — governments consistently suppress information about the costs, motives, and failures of military conflict. Overy's analysis of how we justify and explain violence illuminates why military history is so contested and why so many war books end up challenged or banned.",
    tags: ['war', 'history', 'psychology', 'political science'],
    isOfficiallyBanned: false,
  },
  {
    title: 'The Forever War',
    author: 'Nick Bryant',
    category: 'war-nationalism-memory',
    description:
      "British journalist Nick Bryant's account of American political decline — covering polarisation, institutional breakdown, and the unravelling of shared reality, from the vantage point of a long-term foreign correspondent. Bryant is particularly astute on how the American political system produces paralysis, and on the way facts themselves have become contested in the contemporary information environment.",
    whyWeRecommend:
      "Bryant documents the information environment in which contemporary book banning flourishes: a media ecosystem so fractured that there is no shared factual basis from which to dispute whether a given book is harmful. Essential context for understanding why American school board battles over books have become so intense.",
    tags: ['America', 'democracy', 'media', 'polarisation', 'politics'],
    isOfficiallyBanned: false,
  },
  {
    title: 'The Jakarta Method',
    author: 'Vincent Bevins',
    category: 'war-nationalism-memory',
    description:
      "Bevins uncovers one of the most significant episodes of Cold War violence to be almost entirely absent from mainstream Western history: the 1965 mass killings in Indonesia, orchestrated with US support, in which as many as a million suspected communists were murdered. He shows how this event — and similar US-backed massacres across the Global South — were erased from Western consciousness through systematic propaganda and deliberate historical omission.",
    whyWeRecommend:
      'A book about the deliberate construction of ignorance: how certain historical events are buried so deep that entire generations never know they happened. The process by which inconvenient histories disappear is structurally identical to the process by which inconvenient books are removed from school shelves.',
    tags: ['Cold War', 'Indonesia', 'United States', 'propaganda', 'history', 'mass violence'],
    isOfficiallyBanned: false,
  },

  // ── F. Fiction that exposes censorship and control ───────────────────────
  {
    title: "The Handmaid's Tale",
    author: 'Margaret Atwood',
    category: 'fiction-censorship',
    description:
      "Set in the near-future theocracy of Gilead, Atwood's 1985 novel follows Offred, a handmaid assigned to bear children for an elite family in a world where women are stripped of their names, property, and reproductive autonomy. One of the most frequently banned books in North America, targeted for sexual content, perceived anti-Christian sentiment, and profanity. The regularity of its banning only affirms what the novel itself predicts.",
    whyWeRecommend:
      'The canonical novel about institutionalised censorship and bodily control — written before the word "intersectionality" existed but acutely conscious of how race, class, and gender determine who survives. That it is among the most banned books in America makes it more, not less, essential to read.',
    tags: ['dystopia', 'feminism', 'theocracy', 'reproductive rights', 'Canada', 'banned'],
    internalSlug: 'the-handmaids-tale',
    isOfficiallyBanned: true,
  },
  {
    title: '1984',
    author: 'George Orwell',
    category: 'fiction-censorship',
    description:
      "Orwell's foundational portrait of totalitarian surveillance and information control. In the superstate of Oceania, history is continuously rewritten, language is weaponised through Newspeak, and independent thought is a crime. Published in 1949, it gave us a vocabulary — Big Brother, doublethink, memory hole, Thought Police — that has never stopped being useful. Simultaneously the most prescribed and the most frequently banned novel of the twentieth century.",
    whyWeRecommend:
      "Impossible to understand the literature of censorship without it. Orwell's portrait of how a regime maintains power through the control of language and memory is as relevant now as it was in 1949. The irony of its regular banning from school libraries is its own kind of tribute.",
    tags: ['totalitarianism', 'surveillance', 'language', 'dystopia', 'UK', 'banned'],
    internalSlug: '1984',
    isOfficiallyBanned: true,
  },
  {
    title: 'Fahrenheit 451',
    author: 'Ray Bradbury',
    category: 'fiction-censorship',
    description:
      "Bradbury's 1953 novel imagines a future America where television has replaced reading and books are burned by firemen to prevent the discomfort they cause. Montag, a fireman who begins to question his role, is a parable of the reader who wakes up. Among the great ironies of modern censorship: Fahrenheit 451 has repeatedly been banned and challenged in US schools for language and content — a book about the burning of books, being burned.",
    whyWeRecommend:
      "The essential novel about intellectual conformity and the violence done to readers by a culture that fears books. Bradbury was writing about his own present as much as any imagined future — his warning about conformity and anti-intellectualism has been vindicated repeatedly.",
    tags: ['dystopia', 'censorship', 'book burning', 'America', 'banned'],
    internalSlug: 'fahrenheit-451',
    isOfficiallyBanned: true,
  },
  {
    title: "The Book Censor's Library",
    author: 'Bothayna Al-Essa',
    category: 'fiction-censorship',
    description:
      "Kuwaiti novelist Bothayna Al-Essa's sharp satirical fable about a state censor assigned to review a vast library of banned books. As he works through the stacks, the books begin to work on him — undermining his certainty, complicating his loyalties, and ultimately transforming the censor himself. A beautifully constructed novella that explores the fundamental paradox of all censorship: the censor must read what the public must not.",
    whyWeRecommend:
      "One of the most elegant recent novels about censorship itself. Al-Essa writes from within a culture in which censorship is routine and state-sanctioned, and her insider knowledge gives the satire its edge. A book that could only have been written by someone who lives with censorship, not merely observes it.",
    tags: ['censorship', 'satire', 'Kuwait', 'Middle East', 'fiction'],
    isOfficiallyBanned: false,
  },
  {
    title: 'The Memory Police',
    author: 'Yoko Ogawa',
    category: 'fiction-censorship',
    description:
      "On a nameless island, objects disappear one by one — ribbons, birds, bells — and with them the memory of what they were. The secret police hunt down those who remember the vanished things. Ogawa's haunting 1994 Japanese novel is one of the great literary meditations on state-sanctioned forgetting and the violence of enforced amnesia, translated into English and widely read two decades after its first publication.",
    whyWeRecommend:
      "Where 1984 shows information control as brutal and deliberate, Ogawa imagines something more frightening: gradual, consensual, almost gentle. The Memory Police captures how societies lose the capacity to remember — not always through force but through accumulated forgetting that nobody chooses to resist.",
    tags: ['Japan', 'dystopia', 'memory', 'censorship', 'literary fiction'],
    isOfficiallyBanned: false,
  },
  {
    title: 'The Satanic Verses',
    author: 'Salman Rushdie',
    category: 'fiction-censorship',
    description:
      "Rushdie's 1988 novel, a turbulent magical-realist exploration of migration, faith, and identity, triggered one of the most extreme censorship episodes in modern history: a fatwa calling for Rushdie's death, issued by Ayatollah Khomeini. The novel was banned in multiple countries, bookshops were bombed, translators were attacked, and Rushdie spent years in hiding. Whatever one thinks of the novel's content, the response to it is one of the defining episodes in the history of literary censorship.",
    whyWeRecommend:
      "No reading list about censorship can omit The Satanic Verses. The violence directed at Rushdie and his publishers was a fundamental attack on the principle of free expression — and the debate it triggered, about the limits of religious sensitivity and the rights of authors, has never been fully resolved.",
    tags: ['Islam', 'censorship', 'India', 'UK', 'religious censorship', 'freedom of expression', 'banned'],
    internalSlug: 'the-satanic-verses',
    isOfficiallyBanned: true,
  },

  // ── G. Voices from conflict, prison, and resistance ──────────────────────
  {
    title: 'Freedom Is a Constant Struggle',
    author: 'Angela Y. Davis',
    category: 'conflict-prison-resistance',
    description:
      'A collection of essays, speeches, and interviews in which Davis connects Black liberation movements in America with Palestinian solidarity, prison abolition, and global anti-capitalist struggle. Davis argues that these fights are not parallel but intersecting — that the same structures of state power that enabled chattel slavery now enable mass incarceration, militarism, and occupation.',
    whyWeRecommend:
      "Davis writes from decades of experience as both target and critic of state censorship. Her analysis of how the prison-industrial complex, media ownership, and educational policy function as interconnected systems of social control is essential reading for anyone thinking about the structural dimensions of who gets silenced.",
    tags: ['race', 'prison abolition', 'feminism', 'Palestine', 'activism', 'United States'],
    isOfficiallyBanned: false,
  },
  {
    title: 'Political Girl',
    author: 'Maria Alyokhina',
    category: 'conflict-prison-resistance',
    description:
      'The memoir of Masha Alyokhina, founding member of the feminist punk collective Pussy Riot. From the 2012 Cathedral of Christ the Saviour performance that led to her arrest, through years of imprisonment and harassment, to her escape from Russia in 2022, Alyokhina documents what it means to resist an autocratic state through cultural expression — with precision, dark humour, and without self-pity.',
    whyWeRecommend:
      "Alyokhina is one of the clearest contemporary examples of state censorship through criminal prosecution — imprisoned not for violence but for a ninety-second song. Her account of Russian prison conditions and the Kafkaesque legal proceedings against her makes abstract debates about artistic freedom viscerally real.",
    tags: ['Russia', 'feminism', 'punk', 'imprisonment', 'Pussy Riot', 'censorship'],
    isOfficiallyBanned: false,
  },
  {
    title: 'The Eyes of Gaza',
    author: 'Plestia Alaqad',
    category: 'conflict-prison-resistance',
    description:
      'Palestinian journalist Plestia Alaqad documented the Israeli bombardment of Gaza from inside it, first on social media and then in this memoir. Her account covers months of displacement, the deaths of family members, and the systematic destruction of Gaza\'s cultural and educational infrastructure — its universities, libraries, and schools. A firsthand account of what the destruction of a population\'s cultural life looks like from within.',
    whyWeRecommend:
      'A necessary book for anyone thinking about censorship and cultural destruction in extreme circumstances. The deliberate targeting of libraries, universities, and cultural institutions in conflict zones is one of the most severe forms of censorship — and one of the least discussed. Alaqad puts a face to what statistics cannot.',
    tags: ['Palestine', 'Gaza', 'journalism', 'war', 'censorship', 'cultural destruction'],
    isOfficiallyBanned: false,
  },
  {
    title: 'I Am Malala',
    author: 'Malala Yousafzai',
    category: 'conflict-prison-resistance',
    description:
      'The memoir of Malala Yousafzai, the Pakistani activist who was shot by the Taliban for advocating girls\' education and went on to become the youngest Nobel Peace Prize laureate. Her account of growing up in the Swat Valley — where schools for girls were destroyed, music was banned, and books were burned — is one of the most direct accounts of what a society without educational freedom looks like from the inside.',
    whyWeRecommend:
      "Malala's story is the most widely known example of what happens when the right to education is contested by violence. But the book is also a careful account of the political conditions that produced the Taliban's campaign against girls' literacy — essential reading, and itself banned in some Pakistani schools.",
    tags: ['Pakistan', 'Taliban', "girls' education", 'censorship', 'Nobel Prize', 'memoir'],
    isOfficiallyBanned: true,
  },
  {
    title: 'Reading Lolita in Tehran',
    author: 'Azar Nafisi',
    category: 'conflict-prison-resistance',
    description:
      'Iranian-American literary scholar Azar Nafisi describes a secret book club she conducted in Tehran after the Islamic Revolution — gathering a small group of female students to read Western novels that were banned or stigmatised by the new regime. A meditation on what reading means when it is dangerous, and on literature as a form of private resistance that the state cannot fully extinguish.',
    whyWeRecommend:
      "One of the most intimate accounts of what censorship does to the interior life of its subjects. Nafisi shows how the Islamic Republic's attempt to control the cultural environment created a kind of double consciousness — an outer life of compliance and an inner life of reading. A beautiful argument for the irreducibility of individual imagination.",
    tags: ['Iran', 'Islamic Republic', 'literature', 'women', 'censorship', 'memoir'],
    isOfficiallyBanned: false,
  },
]
