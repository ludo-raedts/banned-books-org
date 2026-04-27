/**
 * Batch 5: bio, birth_country, and photo_url for 10 more authors.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/apply-author-bios-5.ts        # dry-run
 *   npx tsx --env-file=.env.local scripts/apply-author-bios-5.ts --write
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
    slug: 'jennifer-niven',
    birth_year: 1968, death_year: null, birth_country: 'United States',
    wikiTitle: 'Jennifer Niven',
    bio: `Jennifer Niven is an American author best known for All the Bright Places (2015), a young adult novel exploring grief, mental illness, and suicide through the relationship of two teenagers. Niven has stated the novel was partly inspired by personal experience and a desire to open conversations around depression among young readers who often feel unseen. The book has been challenged in several U.S. school districts for its explicit handling of suicide. Niven has responded by emphasizing that avoiding such topics isolates readers rather than protects them, advocating for contextual guidance over removal.`,
  },
  {
    slug: 'jazz-jennings',
    birth_year: 2000, death_year: null, birth_country: 'United States',
    wikiTitle: 'Jazz Jennings',
    bio: `Jazz Jennings is an American author, television personality, and LGBTQ+ activist best known for the children's book I Am Jazz (2014), which explains transgender identity for young audiences drawing from Jennings' own life. The book has been widely challenged and banned in school systems for its subject matter. Jennings has consistently responded to censorship by advocating for visibility and inclusion, engaging directly with educators and policymakers to argue that early education shapes inclusive societies.`,
  },
  {
    slug: 'simone-elkeles',
    birth_year: 1963, death_year: null, birth_country: 'United States',
    wikiTitle: 'Simone Elkeles',
    bio: `Simone Elkeles is best known for her Perfect Chemistry trilogy, which explores cross-cultural relationships, identity, and socioeconomic divides among teenagers. Her novels have been challenged in schools for sexual content, strong language, and depictions of teenage relationships. Elkeles has defended her work by emphasizing its realism, arguing that her characters reflect the actual experiences of many young people. Her writing embeds themes of immigration, class, and identity within the emotional journeys of her characters rather than treating them as abstract concepts.`,
  },
  {
    slug: 'meg-cabot',
    birth_year: 1967, death_year: null, birth_country: 'United States',
    wikiTitle: 'Meg Cabot',
    bio: `Meg Cabot is a bestselling author known for The Princess Diaries series, blending humor, romance, and coming-of-age themes. Some of her books have been challenged for references to sexuality, relationships, and teenage independence. Cabot's work consistently normalizes adolescent concerns — identity, belonging, and self-expression — within a light narrative framework, reinforcing autonomy and personal growth beneath the accessible surface of her storytelling.`,
  },
  {
    slug: 'sonya-sones',
    birth_year: 1958, death_year: null, birth_country: 'United States',
    wikiTitle: 'Sonya Sones',
    bio: `Sonya Sones is known for young adult novels written in free verse, including What My Mother Doesn't Know. Her work focuses on teenage identity, relationships, and sexuality through an intimate, first-person voice. Her books have been frequently challenged in U.S. schools for sexual content. Sones has defended her work as an honest portrayal of teenage experience, arguing that young readers deserve literature that reflects their realities rather than sanitizes them. Her use of verse creates immediacy that amplifies both the impact of her work and the reactions it provokes.`,
  },
  {
    slug: 'sharon-m-draper',
    birth_year: 1948, death_year: null, birth_country: 'United States',
    wikiTitle: 'Sharon Draper',
    bio: `Sharon M. Draper is an award-winning author and educator known for Out of My Mind, which explores the life of a girl with cerebral palsy, and Out of Darkness, addressing race and violence. Some of her books have been challenged for language and content addressing systemic injustice. Draper has been an outspoken advocate for inclusive education, arguing that literature should broaden perspectives. Her writing gives voice to characters rarely centered in mainstream fiction, approaching storytelling as both an educational and emotional tool.`,
  },
  {
    slug: 'jerry-craft',
    birth_year: 1963, death_year: null, birth_country: 'United States',
    wikiTitle: 'Jerry Craft',
    bio: `Jerry Craft is best known for New Kid, a Newbery Medal–winning graphic novel addressing race, class, and identity through the experiences of a Black student at a predominantly white private school. Despite its critical acclaim, New Kid has been banned or restricted in some school districts for its discussion of race and systemic inequality. Craft has responded publicly, arguing such bans reflect discomfort with the subject matter rather than legitimate content concerns. His work makes complex social issues accessible to younger readers through humor and visual storytelling.`,
  },
  {
    slug: 'jean-jacques-rousseau',
    birth_year: 1712, death_year: 1778, birth_country: 'Switzerland',
    wikiTitle: 'Jean-Jacques Rousseau',
    bio: `Jean-Jacques Rousseau was a philosopher and writer whose works, including The Social Contract and Emile, profoundly influenced political and educational thought. His ideas about individual freedom and the legitimacy of authority were considered radical, and his writings were banned and condemned by both religious and political authorities across Europe. Rousseau faced exile and persecution, yet his work ultimately underpins modern democratic theory — demonstrating that societies built on authority often most fear the concepts of freedom and critical thought.`,
  },
  {
    slug: 'elif-shafak',
    birth_year: 1971, death_year: null, birth_country: 'France',
    wikiTitle: 'Elif Şafak',
    bio: `Elif Şafak is a Turkish-British novelist known for The Bastard of Istanbul and 10 Minutes 38 Seconds in This Strange World. Her writing explores identity, memory, and cultural tension. She has faced legal prosecution in Turkey under laws criminalizing "insulting national identity," particularly due to references to the Armenian genocide in her fiction. Although acquitted, the case illustrated the risks faced by writers addressing sensitive historical subjects. Şafak has consistently defended freedom of expression, positioning literature as a space for confronting uncomfortable truths.`,
  },
  {
    slug: 'rene-descartes',
    birth_year: 1596, death_year: 1650, birth_country: 'France',
    wikiTitle: 'René Descartes',
    bio: `René Descartes, often called the father of modern philosophy, is best known for Meditations on First Philosophy and his principle "Cogito, ergo sum" ("I think, therefore I am"). His writings were placed on the Catholic Church's Index of Forbidden Books for challenging established doctrine through radical doubt and the primacy of reason. Descartes responded cautiously but persistently — continuing to publish while carefully navigating censorship. His work ultimately reshaped Western thought, demonstrating that intellectual progress often begins with questioning accepted truths.`,
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
