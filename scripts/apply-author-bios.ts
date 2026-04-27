/**
 * Add bio, birth_country, and photo_url to the authors table.
 * Photos are fetched from Wikipedia page images (most reliable source).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/apply-author-bios.ts        # dry-run
 *   npx tsx --env-file=.env.local scripts/apply-author-bios.ts --write
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
  birth_country: string
  bio: string
  wikiTitle: string | null
}> = [
  {
    slug: 'ellen-hopkins',
    birth_year: 1955, death_year: null, birth_country: 'United States',
    wikiTitle: 'Ellen Hopkins',
    bio: `Ellen Hopkins is an American author best known for her young adult novels written in verse, including Crank, Glass, and Identical. Her work focuses on difficult, often controversial themes such as drug addiction, abuse, and mental health. Crank was inspired by her daughter's struggle with methamphetamine addiction, which explains Hopkins' direct and unfiltered style — she has stated that she wanted to "tell the truth in a way teens would actually hear." Her books have frequently been challenged or banned in schools and libraries in the United States due to explicit language and depictions of sex and drug use. Hopkins has consistently defended her work, arguing that shielding young readers from reality does more harm than good.`,
  },
  {
    slug: 'sarah-j-maas',
    birth_year: 1986, death_year: null, birth_country: 'United States',
    wikiTitle: 'Sarah J. Maas',
    bio: `Sarah J. Maas is a bestselling American fantasy author known for series such as Throne of Glass, A Court of Thorns and Roses, and Crescent City. Her work blends high fantasy with romance and complex character arcs. Maas began writing Throne of Glass as a teenager, initially publishing it online before it became a global success. Her books have faced challenges primarily due to sexual content and mature themes, particularly in school settings. Critics argue that her novels are too explicit for younger audiences, while supporters emphasize their literary merit and emotional depth.`,
  },
  {
    slug: 'colleen-hoover',
    birth_year: 1979, death_year: null, birth_country: 'United States',
    wikiTitle: 'Colleen Hoover',
    bio: `Colleen Hoover is an American author known for contemporary romance and drama, including It Ends with Us, Verity, and Ugly Love. She initially self-published her work, gaining traction through word of mouth and social media before becoming one of the most commercially successful authors of her generation. It Ends with Us was written to explore domestic abuse, inspired in part by Hoover's own family experiences. While widely praised for its emotional impact, her work has also faced bans and challenges due to depictions of abuse, sexual content, and sensitive themes. Hoover has addressed criticism by emphasizing that her goal is to spark understanding and conversation rather than glorify difficult subjects.`,
  },
  {
    slug: 'lauren-myracle',
    birth_year: 1969, death_year: null, birth_country: 'United States',
    wikiTitle: 'Lauren Myracle',
    bio: `Lauren Myracle is an American author best known for her Internet Girls series (ttyl, ttfn, l8r, g8r), which was among the first novels written entirely in instant-message format. Her work explores teenage life with a focus on friendship, sexuality, and identity. Myracle's books have frequently appeared on banned book lists in the United States due to sexual content, language, and perceived age-inappropriateness. She has been openly critical of censorship, arguing that her books reflect real teenage conversations and that book bans amount to a refusal to acknowledge reality rather than a legitimate protection of youth.`,
  },
  {
    slug: 'margaret-atwood',
    birth_year: 1939, death_year: null, birth_country: 'Canada',
    wikiTitle: 'Margaret Atwood',
    bio: `Margaret Atwood is a Canadian novelist, poet, and essayist, globally recognized for The Handmaid's Tale, Oryx and Crake, and Alias Grace. Her work often examines power, gender, and dystopian futures. The Handmaid's Tale was written as a warning about authoritarianism and the control of women's bodies, grounded in historical precedents. Her books have been challenged for sexual content, religious themes, and political commentary. Atwood has responded with sharp criticism of censorship, often pointing out the irony that dystopian warnings are themselves suppressed.`,
  },
  {
    slug: 'stephen-king',
    birth_year: 1947, death_year: null, birth_country: 'United States',
    wikiTitle: 'Stephen King',
    bio: `Stephen King is one of the most prolific and widely read authors of modern fiction, known for works such as Carrie, The Shining, and It. His writing spans horror, suspense, and psychological drama. King's books have been repeatedly banned for violence, sexual content, and language. He has consistently opposed censorship, arguing that fear of ideas is more dangerous than the ideas themselves, and has framed banned books as essential to intellectual freedom.`,
  },
  {
    slug: 'pramoedya-ananta-toer',
    birth_year: 1925, death_year: 2006, birth_country: 'Indonesia',
    wikiTitle: 'Pramoedya Ananta Toer',
    bio: `Pramoedya Ananta Toer was Indonesia's most renowned novelist, best known for the Buru Quartet, including This Earth of Mankind. His work explored colonialism, nationalism, and social injustice. He wrote much of his most famous work while imprisoned by the Indonesian government, dictating stories to fellow prisoners before they were written down. His books were banned in Indonesia for decades due to their political content. Toer resisted censorship through persistence — continuing to write under extreme conditions — and became an international symbol of literary resistance.`,
  },
  {
    slug: 'george-r-r-martin',
    birth_year: 1948, death_year: null, birth_country: 'United States',
    wikiTitle: 'George R. R. Martin',
    bio: `George R. R. Martin is best known for A Song of Ice and Fire, the series behind Game of Thrones. His work is characterized by moral ambiguity, political intrigue, and explicit depictions of violence and sexuality. His books have faced challenges in schools due to mature content. Martin has defended the complexity of his narratives, arguing that history and power are inherently messy and cannot be portrayed honestly without confronting uncomfortable truths.`,
  },
  {
    slug: 'george-orwell',
    birth_year: 1903, death_year: 1950, birth_country: 'India (then British Empire)',
    wikiTitle: 'George Orwell',
    bio: `George Orwell, born Eric Arthur Blair, is best known for 1984 and Animal Farm. His work critiques totalitarianism, propaganda, and political manipulation. 1984 was written as a warning about surveillance and authoritarian control, shaped by his experiences during the Spanish Civil War and World War II. Ironically, his books have been banned or restricted in various countries, including the Soviet Union and at times in China. Orwell himself was a vocal critic of censorship and political repression, advocating for intellectual freedom until his death.`,
  },
  {
    slug: 'laurie-halse-anderson',
    birth_year: 1961, death_year: null, birth_country: 'United States',
    wikiTitle: 'Laurie Halse Anderson',
    bio: `Laurie Halse Anderson is best known for Speak, a novel about sexual assault and trauma written to give a voice to survivors and address silence around the topic. Speak has been challenged for its content, particularly in conservative school districts. Anderson has actively responded to censorship attempts, writing essays and speaking publicly about the importance of confronting difficult subjects rather than suppressing them.`,
  },
  {
    slug: 'taslima-nasrin',
    birth_year: 1962, death_year: null, birth_country: 'Bangladesh',
    wikiTitle: 'Taslima Nasrin',
    bio: `Taslima Nasrin is a Bangladeshi writer and activist known for works such as Lajja (Shame). Her writing criticizes religious extremism and advocates for women's rights. Her work has been banned in Bangladesh, and she has faced death threats and exile. Nasrin has remained outspoken, continuing to write and advocate for secularism and freedom of expression despite significant personal risk.`,
  },
  {
    slug: 'dh-lawrence',
    birth_year: 1885, death_year: 1930, birth_country: 'United Kingdom',
    wikiTitle: 'D. H. Lawrence',
    bio: `D. H. Lawrence is best known for Lady Chatterley's Lover, a novel that challenged social norms around sexuality and class, written to critique industrial society and explore human intimacy. It was banned in multiple countries for obscenity. The 1960 UK obscenity trial — R v Penguin Books Ltd — became a landmark case for literary freedom, ultimately leading to its legal publication and reshaping British obscenity law.`,
  },
  {
    slug: 'aleksandr-solzhenitsyn',
    birth_year: 1918, death_year: 2008, birth_country: 'Russia',
    wikiTitle: 'Aleksandr Solzhenitsyn',
    bio: `Aleksandr Solzhenitsyn was a Russian writer and dissident, known for The Gulag Archipelago and One Day in the Life of Ivan Denisovich. His work exposed the Soviet labor camp system and the mechanisms of political repression. His books were banned in the Soviet Union, and he was expelled from the country in 1974. Solzhenitsyn responded through continued writing and international advocacy, becoming one of the most prominent critics of Soviet repression and a Nobel laureate in Literature.`,
  },
  {
    slug: 'john-green',
    birth_year: 1977, death_year: null, birth_country: 'United States',
    wikiTitle: 'John Green (author)',
    bio: `John Green is known for The Fault in Our Stars and Looking for Alaska. His work explores adolescence, love, and existential questions with honesty and depth. His books have been challenged for sexual content and language. Green has publicly defended young readers' ability to engage with complex themes, often addressing critics directly in essays and interviews and arguing that honest fiction about teenage life is not harmful but necessary.`,
  },
  {
    slug: 'jodi-picoult',
    birth_year: 1966, death_year: null, birth_country: 'United States',
    wikiTitle: 'Jodi Picoult',
    bio: `Jodi Picoult writes novels centered on moral dilemmas, including My Sister's Keeper and Nineteen Minutes. Her work often addresses controversial topics such as euthanasia, reproductive rights, and school violence. Her books have been challenged for sensitive subject matter. Picoult has defended her work as a way to encourage ethical discussion rather than avoid it, arguing that fiction is one of the safest spaces to explore difficult questions.`,
  },
  {
    slug: 'elana-k-arnold',
    birth_year: 1978, death_year: null, birth_country: 'United States',
    wikiTitle: 'Elana K. Arnold',
    bio: `Elana K. Arnold is known for young adult novels like Damsel and What Girls Are Made Of, which explore power, consent, and identity through unflinching narratives. Her work has been challenged for themes of sexuality and violence. Arnold has argued that confronting these themes is essential for meaningful storytelling and reader engagement, and that young adult fiction has a responsibility to take its readers seriously.`,
  },
  {
    slug: 'p-c-cast',
    birth_year: 1960, death_year: null, birth_country: 'United States',
    wikiTitle: 'P. C. Cast',
    bio: `P. C. Cast is best known for the House of Night series, co-written with her daughter Kristin Cast. The series blends mythology, fantasy, and young adult themes around identity and belonging. The books have been challenged for sexual content and depictions of the occult. Cast has defended the series as imaginative fiction that resonates with young readers exploring questions of identity and belonging.`,
  },
  {
    slug: 'cassandra-clare',
    birth_year: 1973, death_year: null, birth_country: 'United States',
    wikiTitle: 'Cassandra Clare',
    bio: `Cassandra Clare is known for The Mortal Instruments series and its expansive Shadowhunter Chronicles, a cornerstone of modern young adult fantasy. Born Judith Rumelt, she grew up partly in Europe before settling in the United States. Her books have faced challenges for sexual content and themes involving relationships. Clare has continued expanding her fictional universe, largely letting her work speak for itself rather than directly engaging in censorship debates.`,
  },
  {
    slug: 'ngugi-wa-thiongo',
    birth_year: 1938, death_year: null, birth_country: 'Kenya',
    wikiTitle: 'Ngũgĩ wa Thiong\'o',
    bio: `Ngũgĩ wa Thiong'o is a Kenyan writer and academic known for works such as Petals of Blood and Weep Not, Child. He shifted from writing in English to Gikuyu as a political act against colonial cultural influence. His work led to imprisonment by the Kenyan government in 1977, and his books were banned due to their political critique. Ngũgĩ responded by continuing to write in exile and advocating for linguistic and cultural independence, becoming one of Africa's most celebrated writers.`,
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

    console.log(`  born: ${author.birth_year} (${author.birth_country})${author.death_year ? `, died: ${author.death_year}` : ''}`)

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
