/**
 * Batch 4: bio, birth_country, and photo_url for 21 more authors.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/apply-author-bios-4.ts        # dry-run
 *   npx tsx --env-file=.env.local scripts/apply-author-bios-4.ts --write
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

const AUTHORS = [
  {
    slug: 'jung-chang',
    birth_year: 1952, death_year: null, birth_country: 'China',
    wikiTitle: 'Jung Chang',
    bio: `Jung Chang is best known for Wild Swans, a multi-generational memoir about life in China during the 20th century, including the Cultural Revolution. She wrote the book to document personal and national history often suppressed in official narratives. Wild Swans is banned in mainland China due to its critical portrayal of Maoist policies. Chang has remained outspoken about historical truth, arguing that confronting the past is essential for understanding the present.`,
  },
  {
    slug: 'haidar-haidar',
    birth_year: 1936, death_year: 2023, birth_country: 'Syria',
    wikiTitle: 'Haidar Haidar',
    bio: `Haidar Haidar was a Syrian novelist known for A Banquet for Seaweed, a politically charged work exploring ideology and disillusionment. The novel sparked controversy and was banned in several Arab countries for perceived blasphemy and political criticism. Haidar defended his work as a critique of extremism and authoritarianism. His writing blends philosophy with narrative, challenging readers to question dominant ideologies.`,
  },
  {
    slug: 'john-mcgahern',
    birth_year: 1934, death_year: 2006, birth_country: 'Ireland',
    wikiTitle: 'John McGahern',
    bio: `John McGahern is best known for The Dark, a novel that addresses sexuality and authority within Irish society. The book was banned in Ireland for obscenity, and McGahern lost his teaching job as a result. He later reflected critically on censorship, arguing that it stifled both personal and cultural growth. His subsequent works gained wide recognition for their subtlety and depth in exploring rural Irish life and emotional restraint.`,
  },
  {
    slug: 'yan-lianke',
    birth_year: 1958, death_year: null, birth_country: 'China',
    wikiTitle: 'Yan Lianke',
    bio: `Yan Lianke is known for novels such as Dream of Ding Village and Lenin's Kisses, which critique social and political issues in China. Many of his works are banned or restricted in China due to their critical content. Yan has navigated censorship by publishing abroad while continuing to write within China's constraints. He has described censorship as both a limitation and a force that actively shapes his creative strategies.`,
  },
  {
    slug: 'stefan-zweig',
    birth_year: 1881, death_year: 1942, birth_country: 'Austria',
    wikiTitle: 'Stefan Zweig',
    bio: `Stefan Zweig was a prolific Austrian writer known for his novellas, biographies, and the memoir The World of Yesterday. His works were banned and burned by the Nazi regime due to his Jewish heritage and pacifist outlook. Zweig went into exile, eventually settling in Brazil, where he and his wife took their own lives in 1942 in despair at the destruction of European civilization. His writing remains a key document of the intellectual climate of pre-war Europe.`,
  },
  {
    slug: 'bertolt-brecht',
    birth_year: 1898, death_year: 1956, birth_country: 'Germany',
    wikiTitle: 'Bertolt Brecht',
    bio: `Bertolt Brecht is known for plays such as The Threepenny Opera and Mother Courage and Her Children. His work aimed to provoke critical thinking rather than emotional immersion, a technique he called "epic theatre." Brecht fled Nazi Germany, where his works were banned and burned, and later faced scrutiny in the United States during the McCarthy era. His approach to political theatre continues to influence experimental and activist performance worldwide.`,
  },
  {
    slug: 'jesse-andrews',
    birth_year: 1982, death_year: null, birth_country: 'United States',
    wikiTitle: 'Jesse Andrews',
    bio: `Jesse Andrews is known for Me and Earl and the Dying Girl, a novel blending dark humor with serious themes of illness and friendship. The book has been challenged in schools for language and sexual references. Andrews has framed his work as intentionally authentic to teenage voices, using irony and awkwardness to convey genuine emotional depth without sentimentality.`,
  },
  {
    slug: 'gregory-maguire',
    birth_year: 1954, death_year: null, birth_country: 'United States',
    wikiTitle: 'Gregory Maguire',
    bio: `Gregory Maguire is best known for Wicked, a reinterpretation of The Wizard of Oz that reimagines the story from the Wicked Witch's perspective. His books have been challenged for sexual content and complex moral themes. Maguire uses fantasy as a framework for ethical inquiry, inviting readers to reconsider "good" and "evil" as fluid, perspective-dependent concepts rather than fixed truths.`,
  },
  {
    slug: 'rupi-kaur',
    birth_year: 1992, death_year: null, birth_country: 'India',
    wikiTitle: 'Rupi Kaur',
    bio: `Rupi Kaur is known for poetry collections such as Milk and Honey and the sun and her flowers, addressing themes of trauma, love, identity, and healing. Her work has faced bans and criticism for explicit themes and feminist perspectives. Kaur has defended her writing as a form of healing and empowerment. Her minimalist style and social media presence have reshaped contemporary poetry, bringing it to a broader, younger audience.`,
  },
  {
    slug: 'amy-reed',
    birth_year: 1980, death_year: null, birth_country: 'United States',
    wikiTitle: 'Amy Reed (author)',
    bio: `Amy Reed writes young adult novels such as Beautiful and Clean, exploring peer pressure, addiction, and identity. Her books have been challenged for sexual content and language. Reed has emphasized the importance of addressing real teenage experiences honestly, positioning literature as a tool for self-reflection and acknowledging the difficulties young people actually face.`,
  },
  {
    slug: 'mindy-mcginnis',
    birth_year: 1978, death_year: null, birth_country: 'United States',
    wikiTitle: 'Mindy McGinnis',
    bio: `Mindy McGinnis is known for The Female of the Species, a novel addressing violence, justice, and rape culture. Her work has been challenged for graphic content. McGinnis has argued that confronting violence in fiction can spark meaningful discussion, and that sanitizing difficult realities does a disservice to the readers who experience them. Her writing is intentionally direct and morally provocative.`,
  },
  {
    slug: 'stephenie-meyer',
    birth_year: 1973, death_year: null, birth_country: 'United States',
    wikiTitle: 'Stephenie Meyer',
    bio: `Stephenie Meyer is best known for the Twilight series, which redefined modern young adult fiction and sparked widespread interest in vampire romance. Her books have faced challenges in schools for themes of sexuality, unhealthy relationships, and religious undertones. Meyer has largely remained outside direct censorship debates, focusing on storytelling. Her commercial success demonstrates the enormous cultural impact YA fiction can have.`,
  },
  {
    slug: 'shaun-david-hutchinson',
    birth_year: 1978, death_year: null, birth_country: 'United States',
    wikiTitle: 'Shaun David Hutchinson',
    bio: `Shaun David Hutchinson writes young adult novels such as We Are the Ants and At the Edge of the Universe, often addressing LGBTQ+ themes and mental health. His books have been challenged for these subjects. Hutchinson has openly defended inclusive and honest storytelling as essential for readers who see themselves reflected in fiction, arguing that representation is not controversial but necessary.`,
  },
  {
    slug: 'e-r-frank',
    birth_year: 1968, death_year: null, birth_country: 'United States',
    wikiTitle: 'E. R. Frank',
    bio: `E. R. Frank is known for novels like Life Is Funny and America, which explore trauma, recovery, and the complexity of adolescent experience. Her work has been challenged for its unflinching portrayals of abuse, mental health struggles, and difficult subject matter. Frank has emphasized the importance of honesty in depicting the realities young people face, often using multiple perspectives to reflect the fragmented nature of experience.`,
  },
  {
    slug: 'lisa-mcmann',
    birth_year: 1968, death_year: null, birth_country: 'United States',
    wikiTitle: 'Lisa McMann',
    bio: `Lisa McMann is known for the Wake trilogy, which blends psychological fantasy with young adult themes of identity and mental health. Her books have been challenged for content related to violence and mature themes. McMann has defended her work as imaginative yet grounded in real emotional concerns, combining suspense with emotional storytelling that appeals to both YA and crossover audiences.`,
  },
  {
    slug: 'nic-stone',
    birth_year: 1985, death_year: null, birth_country: 'United States',
    wikiTitle: 'Nic Stone',
    bio: `Nic Stone is best known for Dear Martin, a novel addressing racism, police violence, and justice in contemporary America. Her work has been challenged for language and political themes. Stone has actively opposed censorship, emphasizing that diverse voices are not optional but essential in literature — particularly for young readers navigating the same realities the books describe.`,
  },
  {
    slug: 'jandy-nelson',
    birth_year: 1965, death_year: null, birth_country: 'United States',
    wikiTitle: 'Jandy Nelson',
    bio: `Jandy Nelson is known for I'll Give You the Sun, a novel about twin siblings, art, grief, and identity. Her books have been challenged for LGBTQ+ themes. Nelson has framed her work as an exploration of love, creativity, and the ways people construct their inner lives. Her prose is lyrical and emotionally rich, centering artistic expression and personal growth.`,
  },
  {
    slug: 'nicola-yoon',
    birth_year: 1972, death_year: null, birth_country: 'Jamaica',
    wikiTitle: 'Nicola Yoon',
    bio: `Nicola Yoon is known for Everything, Everything and The Sun Is Also a Star, novels exploring race, identity, and the nature of love. Her books have been challenged for themes of race and relationships. Yoon has emphasized representation and inclusivity in storytelling, often focusing on characters from backgrounds underrepresented in mainstream YA fiction. Her narratives combine romance with philosophical questions about fate and choice.`,
  },
  {
    slug: 'alex-gino',
    birth_year: 1977, death_year: null, birth_country: 'United States',
    wikiTitle: 'Alex Gino',
    bio: `Alex Gino is known for Melissa (originally published as George), a novel centering on a transgender child's experience of identity and belonging. The book has been one of the most widely challenged titles in American schools for its LGBTQ+ themes. Gino has strongly defended the need for inclusive literature that allows young readers — especially trans and queer children — to see themselves represented.`,
  },
  {
    slug: 'gillian-flynn',
    birth_year: 1971, death_year: null, birth_country: 'United States',
    wikiTitle: 'Gillian Flynn',
    bio: `Gillian Flynn is known for Gone Girl and Sharp Objects, psychological thrillers that examine deception, marriage, and gendered violence. Her work has been challenged for violence, sexual content, and dark themes. Flynn has embraced complexity in her characters, rejecting the expectation that female protagonists should be likeable or morally straightforward. Her work helped redefine expectations for psychological fiction.`,
  },
  {
    slug: 'james-patterson',
    birth_year: 1947, death_year: null, birth_country: 'United States',
    wikiTitle: 'James Patterson',
    bio: `James Patterson is one of the most commercially successful authors in history, known for the Alex Cross and Maximum Ride series. Some of his works have been challenged in schools for violence and mature content. Patterson has been a vocal advocate for literacy and access to books, particularly for young readers, donating millions to libraries and schools. His prolific output and collaborative writing model have made him a defining figure in popular fiction.`,
  },
]

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const s = adminClient()

  for (const author of AUTHORS) {
    console.log(`\n[${author.slug}]`)
    const photoUrl = await fetchWikipediaPhoto(author.wikiTitle)
    console.log(`  photo: ${photoUrl ? photoUrl.slice(0, 80) + '…' : 'not found'}`)
    await sleep(200)

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
