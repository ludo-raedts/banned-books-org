/**
 * Apply hand-crafted, Wikipedia-verified ban descriptions for the 11 weak entries.
 * Four books had no real ban info on Wikipedia → description_ban set to null.
 * Seven books got improved descriptions based on Wikipedia ban/censorship sections.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/apply-rewritten-descriptions.ts        # dry-run
 *   npx tsx --env-file=.env.local scripts/apply-rewritten-descriptions.ts --write
 */

import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')

// null = clear the field (no verified ban info found on Wikipedia)
const UPDATES: Record<string, string | null> = {
  // Wrong article (disambiguation page) — no ban info on Wikipedia
  'burned': null,

  // Wikipedia has no documented government bans — only religious/scientific controversy
  'the-origin-of-species': null,

  // Wikipedia documents no real-world banning of this specific book
  'one-hundred-years-of-solitude': null,

  // Wikipedia has no ban/censorship section for this novel
  'the-trial': null,

  // Comprehensive rewrite — current entry only covered Latvia 1995
  'mein-kampf': `Following World War II, Mein Kampf was banned or heavily restricted across Europe. In Germany, the state of Bavaria held the copyright and blocked all publication from 1945 until 2016, when a heavily annotated academic edition was finally released. The book is forbidden in Latvia, banned by court order in the Netherlands since the 1980s, and was declared extremist literature in Russia in 2010.

Source: Wikipedia`,

  // Awkward passive sentence — replaced with full context
  'a-farewell-to-arms': `The novel was banned in the Irish Free State and prohibited in Fascist Italy until 1948, where the regime considered its depiction of the 1917 retreat at Caporetto detrimental to the honor of the armed forces. In the United States the original magazine serialisation was censored and the book was banned from Boston newsstands on accusations of pornographic content.

Source: Wikipedia`,

  // Current text confusingly referenced Ulysses and an incomplete sentence
  'married-love': `The US Customs Service banned Married Love as obscene upon its import, blocking it from American readers until April 1931, when Judge John M. Woolsey ruled it was not obscene. The book was widely condemned by religious institutions for its frank discussion of women's sexuality and birth control.

Source: Wikipedia`,

  // Current text ended with a dangling citation fragment
  'fanny-hill': `Fanny Hill is one of the most prosecuted books in English literary history. Shortly after publication in 1749, author John Cleland was arrested for corrupting the King's subjects and the novel was effectively suppressed in Britain; a Massachusetts court declared it obscene in 1821. The United States Supreme Court finally ruled in 1966 in Memoirs v. Massachusetts that the novel did not meet the legal standard for obscenity, effectively legalizing it.

Source: Wikipedia`,

  // Current text compared it to other books rather than explaining the actual bans
  '1984': `Nineteen Eighty-Four was banned in the Soviet Union from its publication until 1988, when the first publicly available Russian edition appeared; underground samizdat translations circulated among dissidents from the mid-1950s onward. In China the book was restricted to senior officials and politically trusted intellectuals until 1985, and was not available to the general public until 1988. The novel has been broadly challenged as subversive or ideologically corrupting throughout its publication history.

Source: Wikipedia`,

  // Too narrow — only covered Berne 1935; expanded to include German censorship and global spread
  'the-protocols-of-the-elders-of-zion': `In 1935 a Swiss court in Berne declared the Protocols a forgery and "obscene literature," convicting two distributors; publication was blocked in Germany in 1939. Despite being thoroughly debunked as a fabrication, the text continues to circulate widely in the Arab world and online — it was cited in the original 1988 Hamas charter and has been publicly endorsed by various heads of state.

Source: Wikipedia`,

  // Second sentence was about a French film adaptation, not the book
  'lady-chatterleys-lover': `Unable to find a commercial publisher willing to print the unexpurgated text, Lawrence self-published privately in Florence in 1928. The full novel was banned for explicit sexual content in the United States, Canada, Australia, India, and Japan. It was not published openly in the United Kingdom until 1960, when Penguin Books won a landmark obscenity trial and the book sold three million copies within months.

Source: Wikipedia`,
}

async function main() {
  const s = adminClient()

  const slugs = Object.keys(UPDATES)
  const { data: books } = await s.from('books').select('id, title, slug, description_ban').in('slug', slugs)

  for (const book of books ?? []) {
    const newDesc = UPDATES[book.slug]
    console.log(`\n[${book.slug}]`)
    console.log(`  Old: ${book.description_ban?.slice(0, 100)}…`)
    console.log(`  New: ${newDesc === null ? '(clear — no verified ban info)' : newDesc.slice(0, 100) + '…'}`)

    if (WRITE) {
      const { error } = await s.from('books').update({ description_ban: newDesc }).eq('id', book.id)
      if (error) console.error(`  DB error:`, error.message)
      else console.log(`  ✓ Written`)
    }
  }

  if (!WRITE) console.log('\n[DRY-RUN] Re-run with --write to apply.')
}

main().catch(e => { console.error(e); process.exit(1) })
