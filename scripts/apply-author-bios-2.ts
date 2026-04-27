/**
 * Batch 2: bio, birth_country, and photo_url for 22 more authors.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/apply-author-bios-2.ts        # dry-run
 *   npx tsx --env-file=.env.local scripts/apply-author-bios-2.ts --write
 */

import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')

async function fetchWikipediaPhoto(wikiTitle: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=pageimages&pithumbsize=400&pilicense=any&format=json`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'banned-books-org/1.0' } })
    const data = await res.json() as any
    const pages = data.query?.pages ?? {}
    const page = Object.values(pages)[0] as any
    return page?.thumbnail?.source ?? null
  } catch {
    return null
  }
}

const AUTHORS: Array<{
  slug: string
  birth_year: number | null
  death_year: number | null
  birth_country: string | null
  bio: string
  wikiTitle: string | null
}> = [
  {
    slug: 'salman-rushdie',
    birth_year: 1947, death_year: null, birth_country: 'India (British citizen)',
    wikiTitle: 'Salman Rushdie',
    bio: `Salman Rushdie is a British-Indian novelist best known for Midnight's Children and The Satanic Verses. His work blends magical realism with political and historical commentary. The Satanic Verses (1988) triggered global controversy, leading to bans in multiple countries and a 1989 fatwa issued by Iran's Ayatollah Khomeini calling for his death. Rushdie lived under police protection for years. He has consistently defended freedom of expression, stating that literature must be allowed to question belief systems without fear of violence.`,
  },
  {
    slug: 'richard-wright',
    birth_year: 1908, death_year: 1960, birth_country: 'United States',
    wikiTitle: 'Richard Wright (author)',
    bio: `Richard Wright was an American author known for Native Son and Black Boy, which examine systemic racism and social injustice. His work was shaped by his experiences growing up in the segregated American South. His books were frequently challenged in schools for their depictions of violence and racism. Wright saw literature as a political tool and did not shy away from controversy, arguing that confronting injustice required confronting uncomfortable truths.`,
  },
  {
    slug: 'khaled-hosseini',
    birth_year: 1965, death_year: null, birth_country: 'Afghanistan',
    wikiTitle: 'Khaled Hosseini',
    bio: `Khaled Hosseini is best known for The Kite Runner, A Thousand Splendid Suns, and And the Mountains Echoed. His novels explore Afghan history, exile, and personal relationships. The Kite Runner has been challenged and banned in some school districts for sexual violence and political themes. Hosseini has emphasized that his work aims to humanize Afghan experiences and foster empathy rather than controversy.`,
  },
  {
    slug: 'anonymous',
    birth_year: null, death_year: null, birth_country: null,
    wikiTitle: null,
    bio: `"Anonymous" refers to works with unknown or uncredited authorship, often due to safety concerns, censorship, or tradition. Many historically banned texts — from political pamphlets to erotic literature — were published anonymously to avoid persecution. Authorities have often treated anonymous works with particular suspicion, leading to bans or suppression. The use of anonymity itself is a response to censorship, allowing ideas to circulate even when authors cannot safely claim them.`,
  },
  {
    slug: 'roald-dahl',
    birth_year: 1916, death_year: 1990, birth_country: 'United Kingdom',
    wikiTitle: 'Roald Dahl',
    bio: `Roald Dahl is known for children's classics such as Matilda, The BFG, and Charlie and the Chocolate Factory. His stories combine dark humor with imaginative storytelling. His books have been challenged for language, violence, and perceived inappropriate themes. Dahl's work has also sparked ongoing debates about posthumous editing of texts — a form of censorship he would not have consented to.`,
  },
  {
    slug: 'chinua-achebe',
    birth_year: 1930, death_year: 2013, birth_country: 'Nigeria',
    wikiTitle: 'Chinua Achebe',
    bio: `Chinua Achebe is best known for Things Fall Apart, a foundational work of African literature written to counter colonial narratives about Africa. The book has been challenged in schools for violence and colonial themes. Achebe argued that reclaiming narrative power was essential to African identity and resisted censorship by continuing to write critically about colonial and postcolonial societies.`,
  },
  {
    slug: 'james-joyce',
    birth_year: 1882, death_year: 1941, birth_country: 'Ireland',
    wikiTitle: 'James Joyce',
    bio: `James Joyce, author of Ulysses and A Portrait of the Artist as a Young Man, revolutionized modernist literature with his experimental explorations of consciousness and language. Ulysses was banned in the United States and the United Kingdom for obscenity until a landmark 1933 U.S. court ruling allowed its publication. Joyce resisted censorship through persistence and by publishing abroad, primarily in Paris.`,
  },
  {
    slug: 'henry-miller',
    birth_year: 1891, death_year: 1980, birth_country: 'United States',
    wikiTitle: 'Henry Miller',
    bio: `Henry Miller is known for Tropic of Cancer, a semi-autobiographical novel exploring sexuality and artistic freedom. The book was banned in the United States for decades due to explicit sexual content until court rulings in the 1960s overturned the obscenity judgments. Miller defended his work as an honest portrayal of human experience and artistic life.`,
  },
  {
    slug: 'franz-kafka',
    birth_year: 1883, death_year: 1924, birth_country: 'Austria-Hungary (now Czech Republic)',
    wikiTitle: 'Franz Kafka',
    bio: `Franz Kafka is known for The Trial and The Metamorphosis, works that explore alienation, bureaucracy, and the absurdity of power. His works were banned and burned under Nazi regimes due to his Jewish heritage. Kafka himself died before this censorship — he did not live to see his writing suppressed — but his legacy became emblematic of literature persecuted by authoritarian states.`,
  },
  {
    slug: 'jose-rizal',
    birth_year: 1861, death_year: 1896, birth_country: 'Philippines',
    wikiTitle: 'José Rizal',
    bio: `José Rizal wrote Noli Me Tangere and El Filibusterismo, novels that sharply criticized Spanish colonial rule in the Philippines. His works were banned by colonial authorities, and Rizal was executed in 1896 for sedition and rebellion. His writing directly contributed to the Philippine independence movement, and he is today honored as the country's national hero.`,
  },
  {
    slug: 'karl-marx',
    birth_year: 1818, death_year: 1883, birth_country: 'Germany',
    wikiTitle: 'Karl Marx',
    bio: `Karl Marx, author of The Communist Manifesto and Das Kapital, shaped modern political and economic thought worldwide. His work critiques capitalism and advocates for class struggle and collective ownership. His writings have been banned in various political contexts — both in capitalist countries fearing revolution and in authoritarian regimes enforcing ideological conformity. Marx himself faced exile and censorship during his lifetime.`,
  },
  {
    slug: 'erich-maria-remarque',
    birth_year: 1898, death_year: 1970, birth_country: 'Germany',
    wikiTitle: 'Erich Maria Remarque',
    bio: `Erich Maria Remarque is best known for All Quiet on the Western Front, a stark anti-war novel based on his First World War experiences. The book was banned and publicly burned by the Nazi regime in 1933 for its anti-militaristic stance and its challenge to German nationalist mythology. Remarque fled Germany and continued writing in exile, later settling in the United States.`,
  },
  {
    slug: 'lois-lowry',
    birth_year: 1937, death_year: null, birth_country: 'United States',
    wikiTitle: 'Lois Lowry',
    bio: `Lois Lowry is known for The Giver, a dystopian novel exploring conformity, memory, and the cost of a controlled society. The book has been repeatedly challenged in schools for its themes of euthanasia and authoritarian control. Lowry has defended it as a way to encourage critical thinking in young readers, arguing that discomfort is precisely the point.`,
  },
  {
    slug: 'emile-zola',
    birth_year: 1840, death_year: 1902, birth_country: 'France',
    wikiTitle: 'Émile Zola',
    bio: `Émile Zola was a leading figure in literary naturalism, known for Germinal, Thérèse Raquin, and the Rougon-Macquart cycle. His works were censored for explicit content and unflinching social critique. Zola famously defended justice in the Dreyfus Affair with his open letter J'Accuse, reinforcing his lifelong stance against suppression and state power.`,
  },
  {
    slug: 'gabriel-garcia-marquez',
    birth_year: 1927, death_year: 2014, birth_country: 'Colombia',
    wikiTitle: 'Gabriel García Márquez',
    bio: `Gabriel García Márquez is best known for One Hundred Years of Solitude, a cornerstone of magical realism and winner of the Nobel Prize in Literature. His work blends political history with myth and the surreal. His novels have been restricted in some political contexts due to their critique of power and authority. García Márquez maintained a complex relationship with politics while consistently defending artistic freedom.`,
  },
  {
    slug: 'art-spiegelman',
    birth_year: 1948, death_year: null, birth_country: 'United States',
    wikiTitle: 'Art Spiegelman',
    bio: `Art Spiegelman is best known for Maus, a Pulitzer Prize-winning graphic novel about the Holocaust told through the metaphor of mice and cats. Maus has been banned or removed from school curricula for language and imagery, most notably by a Tennessee school board in 2022. Spiegelman has strongly criticized such decisions, calling them dangerous distortions of historical memory.`,
  },
  {
    slug: 'marjane-satrapi',
    birth_year: 1969, death_year: null, birth_country: 'Iran',
    wikiTitle: 'Marjane Satrapi',
    bio: `Marjane Satrapi is known for Persepolis, a graphic memoir about growing up during the Iranian Revolution. The book has been banned in Iran and challenged in school districts in the United States and elsewhere for its political content and imagery. Satrapi has defended it as a personal and political testimony, arguing that her individual story illuminates a broader historical truth.`,
  },
  {
    slug: 'chuck-palahniuk',
    birth_year: 1962, death_year: null, birth_country: 'United States',
    wikiTitle: 'Chuck Palahniuk',
    bio: `Chuck Palahniuk is best known for Fight Club, a novel exploring consumerism, masculinity, and identity. His works have been challenged for violence, explicit content, and transgressive themes. Palahniuk has embraced controversy as part of his literary identity, arguing that literature should unsettle readers and challenge their assumptions about society.`,
  },
  {
    slug: 'mark-twain',
    birth_year: 1835, death_year: 1910, birth_country: 'United States',
    wikiTitle: 'Mark Twain',
    bio: `Mark Twain, author of Adventures of Huckleberry Finn and The Adventures of Tom Sawyer, used satire to critique racism, hypocrisy, and social convention. Huckleberry Finn has been one of the most repeatedly banned books in American history, challenged for its use of racial slurs. The irony is sharp: a novel written to critique racism has been censored by those offended by its honest portrayal of it.`,
  },
  {
    slug: 'victor-hugo',
    birth_year: 1802, death_year: 1885, birth_country: 'France',
    wikiTitle: 'Victor Hugo',
    bio: `Victor Hugo is known for Les Misérables and The Hunchback of Notre-Dame. His works were controversial for their political themes, social criticism, and advocacy for the poor. Hugo lived in exile for nearly twenty years after opposing Louis-Napoleon Bonaparte's coup, continuing to write and publish from abroad. His personal resistance to authoritarian rule mirrored the themes of his fiction.`,
  },
  {
    slug: 'neil-gaiman',
    birth_year: 1960, death_year: null, birth_country: 'United Kingdom',
    wikiTitle: 'Neil Gaiman',
    bio: `Neil Gaiman is known for American Gods, The Sandman, and Coraline. His work blends mythology, fantasy, and dark storytelling. His books have faced challenges for sexual content, violence, and occult themes. Gaiman has publicly and consistently defended libraries and opposed censorship, often emphasizing the importance of access to diverse stories and the right of readers — especially young readers — to encounter difficult ideas.`,
  },
  {
    slug: 'thomas-paine',
    birth_year: 1737, death_year: 1809, birth_country: 'England',
    wikiTitle: 'Thomas Paine',
    bio: `Thomas Paine wrote Common Sense and The Rights of Man, influential pamphlets that helped shape the American and French Revolutions by advocating for democracy and human rights. His works were banned in Britain for sedition. Paine faced persecution and imprisonment for his writings, yet continued to defend revolutionary ideas throughout his life, embodying the principle that political truth must be spoken regardless of consequence.`,
  },
]

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const s = adminClient()

  for (const author of AUTHORS) {
    console.log(`\n[${author.slug}]`)

    let photoUrl: string | null = null
    if (author.wikiTitle) {
      photoUrl = await fetchWikipediaPhoto(author.wikiTitle)
      console.log(`  photo: ${photoUrl ? photoUrl.slice(0, 80) + '…' : 'not found'}`)
      await sleep(200)
    }

    console.log(`  born: ${author.birth_year ?? '?'} (${author.birth_country ?? 'unknown'})${author.death_year ? `, died: ${author.death_year}` : ''}`)

    if (WRITE) {
      const { error } = await s
        .from('authors')
        .update({
          bio: author.bio,
          birth_country: author.birth_country,
          birth_year: author.birth_year,
          death_year: author.death_year,
          photo_url: photoUrl,
        })
        .eq('slug', author.slug)
      if (error) console.error(`  DB error:`, error.message)
      else console.log(`  ✓ Written`)
    }
  }

  if (!WRITE) console.log('\n[DRY-RUN] Re-run with --write to apply.')
}

main().catch(e => { console.error(e); process.exit(1) })
