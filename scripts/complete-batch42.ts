/**
 * Complete batch 42 books: description, description_book, and cover attempts.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/complete-batch42.ts        # dry-run
 *   npx tsx --env-file=.env.local scripts/complete-batch42.ts --write
 */

import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')
const supabase = adminClient()

async function fetchCoverByQuery(query: string): Promise<{ coverUrl: string | null; workId: string | null }> {
  try {
    const q = encodeURIComponent(query)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key,cover_i,title&limit=3`)
    const json = await res.json() as { docs: Array<{ key?: string; cover_i?: number; title?: string }> }
    const doc = json.docs?.find(d => d.cover_i)
    return {
      coverUrl: doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      workId: doc?.key?.replace('/works/', '') ?? null,
    }
  } catch {
    return { coverUrl: null, workId: null }
  }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

const BOOKS: Array<{
  slug: string
  description: string
  description_book: string
  coverQuery: string | null
}> = [
  {
    slug: 'the-raped-little-runaway',
    coverQuery: null,
    description: `An adult pulp fiction title maintained on Ireland's Register of Prohibited Publications for containing child sexual abuse material, confirmed by the Irish government in 2025.`,
    description_book: `An adult pulp fiction title distributed by STAR Distributors of New York. Almost nothing is documented about its author or original publication date. The book's continued presence on Ireland's Register of Prohibited Publications, confirmed in a 2025 parliamentary answer, is exceptional: unlike most register entries whose legal grounds were removed when abortion provisions were abolished in 2018, this title remains prohibited because it was found to contain child sexual abuse material, and possession or distribution remains a criminal offence.`,
  },
  {
    slug: 'abortion-internationally',
    coverQuery: 'abortion internationally national abortion campaign 1983',
    description: `A 1983 National Abortion Campaign pamphlet surveying abortion law internationally, banned in Ireland for promoting abortion.`,
    description_book: `A reference and advocacy pamphlet published by the National Abortion Campaign in London in 1983. It surveyed the legal status of abortion across different countries, providing an international overview of access, restrictions, and policy at a time when reproductive rights were actively contested in Britain, Ireland, and internationally. The pamphlet was part of the Campaign's broader effort to shift the abortion debate from moral abstraction to comparative legal and medical reality, making international data accessible to activists and health workers.`,
  },
  {
    slug: 'abortion-our-struggle-for-control',
    coverQuery: 'abortion our struggle for control national abortion campaign',
    description: `A 1983 National Abortion Campaign pamphlet framing reproductive rights as a feminist political cause, banned in Ireland.`,
    description_book: `Published by the National Abortion Campaign in London in 1983, this pamphlet framed reproductive rights as a question of political power and bodily autonomy rather than individual morality. It addressed the systematic barriers to abortion access in Britain and Ireland and situated the Campaign's advocacy within a feminist critique of state and medical authority over women's bodies. Like other Campaign publications of the period, it was designed for practical distribution among activists, trade unionists, and health workers engaged in the growing reproductive rights movement.`,
  },
  {
    slug: 'abortion-right-or-wrong',
    coverQuery: 'abortion right or wrong Dorothy Thurtle 1942',
    description: `Dorothy Thurtle's 1942 humanitarian argument for the decriminalisation of abortion, banned in Ireland on publication.`,
    description_book: `Dorothy Thurtle (1901–1978), daughter of Labour leader George Lansbury and a birth control advocate in her own right, argued in this 1942 book for the decriminalisation of abortion on humanitarian and medical grounds. Writing during the Second World War, when poverty and unwanted pregnancy remained severe problems for working-class women, Thurtle drew on clinical evidence and social welfare arguments to challenge the criminal prohibition. Her writing placed abortion within the established birth control movement, associating it with the work of Marie Stopes and others who had already shifted public discourse on contraception. The book was banned in Ireland on publication in the same year it appeared.`,
  },
  {
    slug: 'how-to-drive-your-man-wild-in-bed',
    coverQuery: null,
    description: `Graham Masterton's bestselling 1975 sexual self-help guide, one of the most widely read books of its kind in Britain, banned in Ireland for obscenity.`,
    description_book: `Graham Masterton's 1975 guide was one of the bestselling books of its kind in the United Kingdom, offering candid and practical advice about sexual pleasure with unusual directness for its era. Published in the wake of Alex Comfort's The Joy of Sex (1972), it addressed female sexuality and heterosexual relationships in the frank, instructional style that characterised a wave of 1970s sexual self-help literature. Masterton went on to write horror novels and numerous further sex guides; this title remained his most commercially successful non-fiction work. In Ireland, it was placed on the Register of Prohibited Publications under broad obscenity provisions that routinely targeted practical sexual knowledge alongside explicitly erotic material.`,
  },
  {
    slug: 'into-the-river',
    coverQuery: null,
    description: `Ted Dawe's 2012 New Zealand young adult novel about a young Māori boy's experiences at a prestigious boarding school — the most contested young adult title in New Zealand's history.`,
    description_book: `Ted Dawe's award-winning young adult novel follows Te Arepa Santos, a young Māori boy from a close-knit East Coast village who wins a scholarship to Drake's, a prestigious Auckland boarding school. Removed from his community and cultural identity, Te Arepa encounters a world of privilege and peer pressure, and is gradually drawn into experiences of racism, bullying, alcohol, drugs, and sex. The novel won the New Zealand Post Children's Book of the Year Award in 2013. Its unflinching portrayal of adolescent experience — including several sexually explicit and violent scenes — made it the most contested young adult title in New Zealand's publishing history, triggering a sequence of classification decisions that ended with a temporary nationwide prohibition in 2015 and a subsequent change in New Zealand censorship law.`,
  },
]

async function main() {
  for (const entry of BOOKS) {
    console.log(`\n[${entry.slug}]`)

    const { data: book } = await supabase.from('books').select('id, cover_url').eq('slug', entry.slug).single()
    if (!book) { console.log('  [skip] book not found'); continue }

    let coverUrl = book.cover_url
    if (!coverUrl && entry.coverQuery) {
      const result = await fetchCoverByQuery(entry.coverQuery)
      coverUrl = result.coverUrl
      console.log(`  cover search: ${coverUrl ? coverUrl.slice(0, 70) + '…' : 'not found'}`)
      await sleep(300)
    } else if (coverUrl) {
      console.log(`  cover: already set`)
    } else {
      console.log(`  cover: skipped (no query)`)
    }

    console.log(`  description: ${entry.description.slice(0, 60)}…`)
    console.log(`  description_book: ${entry.description_book.slice(0, 60)}…`)

    if (!WRITE) continue

    const { error } = await supabase.from('books').update({
      description: entry.description,
      description_book: entry.description_book,
      ...(coverUrl !== book.cover_url ? { cover_url: coverUrl } : {}),
    }).eq('id', book.id)

    if (error) console.error(`  ✗ ${error.message}`)
    else console.log(`  ✓ updated`)
  }

  if (!WRITE) console.log('\n[DRY-RUN] Re-run with --write to apply.')
}

main().catch(e => { console.error(e); process.exit(1) })
