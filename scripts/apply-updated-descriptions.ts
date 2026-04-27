/**
 * Apply updated ban descriptions based on user-supplied research.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/apply-updated-descriptions.ts        # dry-run
 *   npx tsx --env-file=.env.local scripts/apply-updated-descriptions.ts --write
 */

import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')

const UPDATES: Record<string, string> = {
  'mein-kampf':
    `After World War II, Mein Kampf was banned across much of Europe. In Germany, the state of Bavaria controlled the copyright from 1945 and refused all publication until it expired in 2015, after which a heavily annotated scholarly edition was permitted to prevent misuse. The book is also banned in the Netherlands under hate speech law, listed as extremist material in Russia since 2010, and restricted in Latvia for incitement of racial hatred.`,

  '1984':
    `Nineteen Eighty-Four was banned in the Soviet Union from its publication until 1988, when the first publicly available Russian edition appeared — underground samizdat copies had circulated among dissidents from the mid-1950s. In China the novel was restricted to trusted officials and intellectuals until the late 1980s, reflecting the government's sensitivity to its themes of surveillance and state control. It has also been periodically challenged in American school districts for its political content and sexual references.`,

  'a-farewell-to-arms':
    `The novel was banned in Fascist Italy in 1929, where Mussolini's government considered its portrayal of the disastrous retreat at Caporetto an insult to national military honour; it remained prohibited until 1948. In Ireland it was banned in 1953 by the Censorship of Publications Board for sexual content and perceived immorality. In the United States, its magazine serialisation was censored and the book was banned from Boston newsstands for language and sexual content.`,

  'fanny-hill':
    `Fanny Hill is one of the most prosecuted books in English literary history. Shortly after publication in 1749, author John Cleland was arrested for corrupting the King's subjects and the novel was effectively suppressed in Britain; a Massachusetts court declared it obscene in 1821. The book was finally legalised in the United States in 1966, when the Supreme Court ruled in Memoirs v. Massachusetts that it did not meet the constitutional standard for obscenity — a landmark decision in defining the limits of literary censorship.`,

  'lady-chatterleys-lover':
    `Unable to find a commercial publisher willing to print the unexpurgated text, Lawrence self-published privately in Florence in 1928. The novel was banned for explicit sexual content in the United States, Canada, Australia, India, and Japan. It was not published openly in the United Kingdom until 1960, when Penguin Books won the landmark trial R v Penguin Books Ltd — a case widely seen as a turning point in British obscenity law that liberalised publishing across the country.`,

  'married-love':
    `Married Love was seized by US Customs under the Comstock laws upon its attempted import, blocking American readers from 1918 until 1931, when Judge John M. Woolsey ruled it could be legally imported for legitimate purposes. The book's frank advocacy of birth control and women's sexual health made it a target of moral censorship in multiple countries and drew condemnation from religious institutions.`,

  'the-protocols-of-the-elders-of-zion':
    `In 1935 a Swiss court in Berne declared the Protocols a forgery and convicted its distributors; despite this, the text continued to circulate and publication was only blocked in Germany in 1939. Modern bans in Russia, Germany, and elsewhere are grounded in hate speech and extremism laws — the text has been listed as extremist material in Russia and remains restricted across much of Europe. Despite being thoroughly debunked, it continues to spread through antisemitic and extremist movements worldwide.`,
}

async function main() {
  const s = adminClient()
  const slugs = Object.keys(UPDATES)
  const { data: books } = await s.from('books').select('id, title, slug, description_ban').in('slug', slugs)

  for (const book of books ?? []) {
    const newDesc = UPDATES[book.slug]
    console.log(`\n[${book.slug}]`)
    console.log(`  Old: ${book.description_ban?.slice(0, 100)}…`)
    console.log(`  New: ${newDesc.slice(0, 100)}…`)
    if (WRITE) {
      const { error } = await s.from('books').update({ description_ban: newDesc }).eq('id', book.id)
      if (error) console.error(`  DB error:`, error.message)
      else console.log(`  ✓ Written`)
    }
  }

  if (!WRITE) console.log('\n[DRY-RUN] Re-run with --write to apply.')
}

main().catch(e => { console.error(e); process.exit(1) })
