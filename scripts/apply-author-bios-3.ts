/**
 * Batch 3: bio, birth_country, and photo_url for 8 more authors.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/apply-author-bios-3.ts        # dry-run
 *   npx tsx --env-file=.env.local scripts/apply-author-bios-3.ts --write
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
    slug: 'pablo-neruda',
    birth_year: 1904, death_year: 1973, birth_country: 'Chile',
    wikiTitle: 'Pablo Neruda',
    bio: `Pablo Neruda was a Nobel Prize–winning Chilean poet known for Twenty Love Poems and a Song of Despair and Canto General. His work spans intimate lyric poetry and politically engaged epic writing, shaped by his communist beliefs. His writings were censored in Chile during periods of political repression, and he spent time in exile opposing the government. Neruda remained committed to the idea that poetry should engage with the realities of power and injustice, using verse as both art and resistance.`,
  },
  {
    slug: 'nadine-gordimer',
    birth_year: 1923, death_year: 2014, birth_country: 'South Africa',
    wikiTitle: 'Nadine Gordimer',
    bio: `Nadine Gordimer was a Nobel Prize–winning South African novelist best known for Burger's Daughter and July's People. Her work critically examines apartheid and its moral consequences. Several of her books were banned in apartheid-era South Africa due to their political content. Gordimer remained in the country and actively resisted censorship, aligning herself with the anti-apartheid movement. She believed literature should not only reflect society but actively challenge it.`,
  },
  {
    slug: 'orhan-pamuk',
    birth_year: 1952, death_year: null, birth_country: 'Turkey',
    wikiTitle: 'Orhan Pamuk',
    bio: `Orhan Pamuk is a Nobel Prize–winning Turkish novelist known for My Name Is Red and Snow. His work explores identity, memory, and the tension between East and West. Pamuk has faced legal prosecution in Turkey for public statements about historical events, and his books have been subject to political scrutiny and backlash. He has consistently defended free expression even under threat, positioning storytelling as a space where conflicting identities can coexist.`,
  },
  {
    slug: 'chris-crutcher',
    birth_year: 1945, death_year: null, birth_country: 'United States',
    wikiTitle: 'Chris Crutcher',
    bio: `Chris Crutcher is known for young adult novels such as Whale Talk and Staying Fat for Sarah Byrnes, addressing themes of abuse, racism, and identity. Drawing from his background as a therapist, his stories focus on resilience and moral complexity. His books are among the most frequently challenged in U.S. schools due to language and mature themes. Crutcher has been a vocal opponent of censorship, speaking directly against book bans and arguing that literature is a safe space to confront difficult realities rather than avoid them.`,
  },
  {
    slug: 'walter-dean-myers',
    birth_year: 1937, death_year: 2014, birth_country: 'United States',
    wikiTitle: 'Walter Dean Myers',
    bio: `Walter Dean Myers was a prolific author of children's and young adult literature, best known for Monster. His work explores the experiences of Black youth in America through realism and innovative narrative forms. His books have been challenged for language and depictions of violence. Myers responded by emphasizing the importance of representation, arguing that young readers need to see their realities reflected in literature.`,
  },
  {
    slug: 'erskine-caldwell',
    birth_year: 1903, death_year: 1987, birth_country: 'United States',
    wikiTitle: 'Erskine Caldwell',
    bio: `Erskine Caldwell is known for Tobacco Road and God's Little Acre, novels depicting poverty and hardship in the American South. His work was frequently banned for explicit sexual content and its unflinching portrayal of rural life. Caldwell defended his writing as social realism, arguing that discomfort was necessary to expose injustice. Critics have debated whether his work critiques or exploits its subjects, adding to its enduring complexity.`,
  },
  {
    slug: 'alison-bechdel',
    birth_year: 1960, death_year: null, birth_country: 'United States',
    wikiTitle: 'Alison Bechdel',
    bio: `Alison Bechdel is best known for the graphic memoir Fun Home and for the "Bechdel Test," a measure of female representation in fiction. Her work explores sexuality, family, and identity with remarkable honesty. Fun Home has been challenged in schools and universities for its LGBTQ+ themes and explicit content. Bechdel has defended her work as an honest exploration of personal history, and her influence extends into broader cultural debates about representation in visual storytelling.`,
  },
  {
    slug: 'jason-reynolds',
    birth_year: 1983, death_year: null, birth_country: 'United States',
    wikiTitle: 'Jason Reynolds',
    bio: `Jason Reynolds is known for Long Way Down and Ghost, exploring contemporary issues faced by young people — violence, identity, and aspiration — often through verse and hybrid narrative forms. His books have been challenged for language and themes of violence. Reynolds has actively spoken against censorship, emphasizing that literature can help young readers process real-life experiences. His voice resonates particularly with urban youth audiences.`,
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
