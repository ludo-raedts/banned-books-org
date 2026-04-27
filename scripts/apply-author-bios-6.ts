/**
 * Batch 6: bio, birth_country, and photo_url for 9 more authors.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/apply-author-bios-6.ts        # dry-run
 *   npx tsx --env-file=.env.local scripts/apply-author-bios-6.ts --write
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
    slug: 'charles-darwin',
    birth_year: 1809, death_year: 1882, birth_country: 'United Kingdom',
    wikiTitle: 'Charles Darwin',
    bio: `Charles Darwin is best known for On the Origin of Species (1859), a foundational scientific work that introduced the theory of evolution by natural selection. Darwin's motivation was grounded in decades of observation, particularly during his voyage on the HMS Beagle, where he gathered evidence that challenged prevailing views of fixed species. Although not always formally "banned" in the traditional literary sense, Darwin's work has been restricted, removed from curricula, or opposed in various countries and regions due to religious objections. The theory of evolution directly challenged dominant creationist beliefs, making it a focal point in debates about science, education, and ideology. Darwin himself anticipated controversy and delayed publication for years, carefully assembling evidence before releasing his work. His response to criticism was methodical rather than confrontational — he refined his arguments in later editions and correspondence. The enduring resistance to his ideas illustrates how knowledge that reshapes worldviews is often treated as a threat rather than an advancement.`,
  },
  {
    slug: 'svetlana-alexievich',
    birth_year: 1948, death_year: null, birth_country: 'Ukraine',
    wikiTitle: 'Svetlana Alexievich',
    bio: `Svetlana Alexievich is a Nobel Prize–winning writer known for works such as Voices from Chernobyl and Secondhand Time. Her writing blends journalism and literature, constructing narratives from interviews to capture collective memory. Her books have faced censorship and criticism in Belarus and Russia due to their unflinching portrayal of Soviet and post-Soviet realities. Authorities have often viewed her work as politically sensitive because it gives voice to individuals rather than official narratives. Alexievich has consistently defended her approach, arguing that history is not only shaped by events but by how people experience and remember them. Her work challenges the idea that a single, controlled narrative can define truth, positioning literature as a counterweight to state-controlled memory.`,
  },
  {
    slug: 'ismail-kadare',
    birth_year: 1936, death_year: 2024, birth_country: 'Albania',
    wikiTitle: 'Ismail Kadare',
    bio: `Ismail Kadare was one of Albania's most internationally recognized writers, known for novels such as The Palace of Dreams and Broken April. His work often uses allegory and historical settings to critique authoritarianism. Under the communist regime of Enver Hoxha, Kadare's works were subject to censorship, and some were banned for their implicit criticism of state power. Despite this, he continued to publish, often embedding political commentary within layered narratives that could evade direct suppression. Kadare later lived in exile in France, where he continued writing with greater freedom. His career reflects a strategic negotiation with censorship — writing in a way that speaks truth while navigating the boundaries imposed by authority.`,
  },
  {
    slug: 'duong-thu-huong',
    birth_year: 1947, death_year: null, birth_country: 'Vietnam',
    wikiTitle: 'Dương Thu Hương',
    bio: `Dương Thu Hương is known for novels such as Paradise of the Blind, which critique postwar Vietnamese society and the impact of political ideology on individual lives. Her works are banned in Vietnam due to their criticism of the government and socialist system. She was expelled from the Communist Party and later imprisoned for her views. After her release, she continued writing, with her works published primarily abroad. Her persistence highlights a recurring pattern in censored literature: when local systems suppress voices, those voices often find international platforms, amplifying their reach rather than silencing them.`,
  },
  {
    slug: 'andre-brink',
    birth_year: 1935, death_year: 2015, birth_country: 'South Africa',
    wikiTitle: 'André Brink',
    bio: `André Brink was a prominent South African writer known for anti-apartheid novels such as A Dry White Season. His work directly confronted racial segregation and state violence. Several of his books were banned under apartheid due to their political content. Brink responded by continuing to write in both Afrikaans and English, deliberately reaching broader audiences and resisting linguistic as well as political boundaries. He viewed literature as a form of resistance, arguing that storytelling could expose injustice in ways that political discourse alone could not. His work contributed to international awareness of apartheid and its human consequences.`,
  },
  {
    slug: 'nazim-hikmet',
    birth_year: 1902, death_year: 1963, birth_country: 'Turkey',
    wikiTitle: 'Nâzım Hikmet',
    bio: `Nâzım Hikmet was one of Turkey's most influential poets, known for his revolutionary and politically engaged poetry. His work often addressed themes of justice, freedom, and human dignity. Hikmet's writings were banned in Turkey, and he spent many years in prison due to his political beliefs. His poetry circulated clandestinely, becoming a symbol of resistance. Even in exile, he continued to write and advocate for social justice. His work demonstrates how poetry — often perceived as abstract — can become a powerful political force when it resonates with collective struggle.`,
  },
  {
    slug: 'yasar-kemal',
    birth_year: 1923, death_year: 2015, birth_country: 'Turkey',
    wikiTitle: 'Yaşar Kemal',
    bio: `Yaşar Kemal is best known for Memed, My Hawk, a novel depicting rural life and resistance against oppression in Turkey. His work draws heavily on oral storytelling traditions. Kemal faced censorship and prosecution for his political views, particularly his advocacy for Kurdish rights. Some of his writings were restricted or scrutinized by authorities. He remained committed to writing about marginalized communities, arguing that literature should give voice to those excluded from dominant narratives. His work bridges folklore and political critique, making it both culturally rich and socially engaged.`,
  },
  {
    slug: 'augusto-roa-bastos',
    birth_year: 1917, death_year: 2005, birth_country: 'Paraguay',
    wikiTitle: 'Augusto Roa Bastos',
    bio: `Augusto Roa Bastos is best known for I, the Supreme, a novel exploring dictatorship and power in Latin America. His work reflects Paraguay's political history and authoritarian regimes. He lived in exile for decades due to political repression, and his works were restricted in Paraguay. Roa Bastos used literature to dissect the psychology of power, often portraying dictators not just as figures of authority but as systems of control. His writing is dense and experimental, reflecting the complexity of political reality. He viewed literature as a means of preserving historical memory against attempts to rewrite or erase it.`,
  },
  {
    slug: 'boris-akunin',
    birth_year: 1956, death_year: null, birth_country: 'Russia',
    wikiTitle: 'Boris Akunin',
    bio: `Boris Akunin (pen name of Grigory Chkhartishvili) is known for historical detective novels such as the Erast Fandorin series. His work combines literary style with popular genre fiction. In recent years, his books have faced restrictions in Russia due to his outspoken criticism of the government. He has lived abroad and continued writing, with his works sometimes removed from circulation domestically. Akunin has argued that literature cannot be separated from civic responsibility. His trajectory illustrates how even commercially successful authors can become targets when they challenge political authority.`,
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
