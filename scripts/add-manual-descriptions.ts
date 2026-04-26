/**
 * Apply hand-written descriptions for books that automated enrichment couldn't fill.
 * - description_book: only set where currently NULL (keeps longer OL text otherwise)
 * - description_ban:  set for all entries (all currently NULL)
 */
import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

const entries: { slug: string; book: string; ban: string }[] = [
  {
    slug: 'all-your-perfects',
    book: 'A contemporary romance novel that explores the emotional complexities of marriage, infertility, and the fragile balance between love and resentment. Through alternating timelines, the story contrasts a couple\'s early passion with the strain that builds over time.',
    ban: 'Challenged in some U.S. school libraries due to its sexual content and mature relationship themes.',
  },
  {
    slug: 'angelas-ashes',
    book: 'Frank McCourt\'s memoir recounts his childhood in Ireland, marked by extreme poverty, family instability, and the influence of religion. Told with a mix of stark realism and dark humor, the book captures both hardship and resilience as McCourt grows up in Limerick.',
    ban: 'Challenged in schools in the United States and elsewhere for explicit language, sexual references, and depictions of alcoholism and poverty.',
  },
  {
    slug: 'cemetery-boys',
    book: 'A young adult fantasy about a transgender boy who summons a ghost to prove his identity within a traditional Latinx family. The novel combines supernatural elements with themes of identity, belonging, and acceptance.',
    ban: 'Removed or challenged in several U.S. school districts due to LGBTQ+ representation and gender identity themes.',
  },
  {
    slug: 'forever-judy-blume',
    book: 'A coming-of-age novel that follows two teenagers experiencing their first serious romantic relationship. The story is known for its direct and realistic portrayal of teenage sexuality, emotions, and the uncertainty of young love.',
    ban: 'Frequently challenged and removed from school libraries in the U.S. for explicit sexual content and candid discussions of teenage relationships. It has appeared on multiple lists of most challenged books.',
  },
  {
    slug: 'ghost-boys',
    book: 'A middle-grade novel about a Black boy who is shot by police and becomes a ghost, observing the aftermath of his death. The story addresses racism, injustice, and empathy.',
    ban: 'Challenged in some schools for its depictions of police violence and discussions of systemic racism.',
  },
  {
    slug: 'grown',
    book: 'A young adult novel inspired by real-world abuse cases in the music industry. It follows a teenage singer manipulated by a powerful adult figure, exposing exploitation and power dynamics.',
    ban: 'Challenged in school settings for sexual abuse themes and mature subject matter.',
  },
  {
    slug: 'lawn-boy',
    book: 'A semi-autobiographical novel about a young man navigating work, identity, and class in contemporary America. The narrative blends humor with social commentary.',
    ban: 'Widely challenged and removed in U.S. schools for sexual content, including passages critics consider inappropriate for minors.',
  },
  {
    slug: 'man-o-war',
    book: 'A young adult novel about a nonbinary teen reconnecting with their estranged father during a sailing journey. It explores gender identity, family relationships, and self-discovery.',
    ban: 'Challenged in schools due to gender identity themes and LGBTQ+ representation.',
  },
  {
    slug: 'marriage-and-morals',
    book: 'A philosophical work by Bertrand Russell examining traditional views on marriage, sexuality, and morality. Russell critiques conventional norms and argues for more progressive attitudes toward relationships.',
    ban: 'Controversial upon publication in 1929 for its progressive views on sexuality. It contributed to Russell losing a teaching appointment in New York after a court ruled his views morally unfit.',
  },
  {
    slug: 'maximum-ride',
    book: 'A young adult science fiction series following a group of genetically engineered children with wings as they evade capture and uncover the truth about their origins. The narrative blends action, suspense, and themes of identity and belonging.',
    ban: 'Occasionally challenged in schools due to violence and language, though it has not faced widespread or sustained bans.',
  },
  {
    slug: 'native-son',
    book: 'A landmark novel in American literature telling the story of Bigger Thomas, a young Black man navigating systemic racism in 1930s Chicago. The novel explores themes of inequality, fear, and social injustice.',
    ban: 'Repeatedly challenged and restricted in schools for racial language, sexual content, and violence, despite its widespread recognition as a work of historical and literary significance.',
  },
  {
    slug: 'speak',
    book: 'A young adult novel about a high school student who becomes socially isolated after a traumatic experience. The story follows her struggle to process what happened and to find her voice again.',
    ban: 'Challenged in several U.S. school districts due to themes of sexual assault, though many educators defend its role in addressing important issues faced by young people.',
  },
  {
    slug: 'the-alchemist',
    book: 'A philosophical novel following a young Andalusian shepherd\'s journey across North Africa in search of a buried treasure, discovering along the way that the real goal is self-knowledge and following one\'s personal destiny.',
    ban: 'Reportedly restricted or banned in some countries where its spiritual themes—drawn from multiple religious traditions—have been considered contrary to dominant beliefs.',
  },
  {
    slug: 'the-chocolate-war',
    book: 'A dark novel set in a Catholic boarding school where a student\'s quiet refusal to participate in a chocolate sale triggers a campaign of psychological manipulation and abuse orchestrated by a secret student society.',
    ban: 'Frequently challenged for violence, language, and sexual references, as well as its bleak portrayal of institutional authority and peer cruelty.',
  },
  {
    slug: 'the-nowhere-girls',
    book: 'Three girls form a collective to confront a culture of silence around sexual violence in their community. The novel explores activism, solidarity, and the complexities of speaking out.',
    ban: 'Challenged in some schools for sexual content, strong language, and discussions of rape culture and feminism.',
  },
  {
    slug: 'unravel-me',
    book: 'The second book in a dystopian series, continuing the story of a girl with dangerous abilities as she struggles with trust, identity, and her role in a resistance movement.',
    ban: 'Occasionally challenged for romantic and sexual elements, though it is not widely banned and generally remains accessible in schools and libraries.',
  },
  {
    slug: 'watchmen',
    book: 'A graphic novel set in an alternate 1985 America where masked vigilantes have been outlawed. Through morally complex characters and political themes, it deconstructs the superhero genre and asks hard questions about power, justice, and violence. Widely regarded as one of the most influential graphic novels ever written.',
    ban: 'Challenged and removed from some school libraries for graphic violence, nudity, and mature themes.',
  },
]

async function main() {
  let updated = 0, failed = 0

  for (const { slug, book, ban } of entries) {
    // Check whether description_book is already populated
    const { data: existing } = await supabase
      .from('books')
      .select('id, description_book')
      .eq('slug', slug)
      .single()

    if (!existing) {
      console.log(`  [skip] ${slug}: not found`)
      continue
    }

    const patch: Record<string, string> = { description_ban: ban }
    if (!existing.description_book) patch.description_book = book

    const { error } = await supabase
      .from('books')
      .update(patch)
      .eq('id', existing.id)

    if (error) {
      console.log(`  ✗ ${slug}: ${error.message}`)
      failed++
    } else {
      const fields = Object.keys(patch).join(', ')
      console.log(`  ✓ ${slug} [${fields}]`)
      updated++
    }
  }

  console.log(`\nDone. Updated: ${updated}  Failed: ${failed}`)
}

main().catch(console.error)
