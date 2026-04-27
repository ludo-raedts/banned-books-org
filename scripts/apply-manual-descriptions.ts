/**
 * Apply manually researched ban descriptions for 4 books that had no Wikipedia ban section.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/apply-manual-descriptions.ts        # dry-run
 *   npx tsx --env-file=.env.local scripts/apply-manual-descriptions.ts --write
 */

import { adminClient } from '../src/lib/supabase'

const WRITE = process.argv.includes('--write')

const UPDATES: Record<string, string> = {
  'burned':
    `Burned is frequently challenged in American school districts for its explicit depictions of sexual abuse, religious criticism, and mature themes. It falls within a broader pattern of US school censorship targeting Ellen Hopkins' verse novels, driven by parents and school boards citing age-appropriateness concerns.`,

  'the-origin-of-species':
    `On the Origin of Species became a flashpoint in debates over science and religious freedom, with school boards and state governments across the United States seeking to ban or restrict the teaching of evolution from the late 19th century onward. The book's conflict with Biblical creationism reached its defining moment in the 1925 Scopes Trial, where a Tennessee teacher was convicted for teaching evolution — a law struck down only in 1968 by the US Supreme Court.`,

  'one-hundred-years-of-solitude':
    `The novel has been challenged in American school districts for its explicit sexual content and mature themes. It was also banned in Kuwait and other conservative regions, where government censorship bodies objected to its sexual passages and perceived political critique.`,

  'the-trial':
    `The Trial was among the works burned by the Nazi regime in 1933 as part of its suppression of Jewish and modernist authors. Under communist rule in Czechoslovakia after 1948, the novel was banned for its implicit critique of authoritarian bureaucracy — its portrayal of an arbitrary, opaque legal system was seen as a direct challenge to state power.`,
}

async function main() {
  const s = adminClient()
  const slugs = Object.keys(UPDATES)
  const { data: books } = await s.from('books').select('id, title, slug').in('slug', slugs)

  for (const book of books ?? []) {
    const desc = UPDATES[book.slug]
    console.log(`\n[${book.slug}]`)
    console.log(`  ${desc.slice(0, 120)}…`)
    if (WRITE) {
      const { error } = await s.from('books').update({ description_ban: desc }).eq('id', book.id)
      if (error) console.error(`  DB error:`, error.message)
      else console.log(`  ✓ Written`)
    }
  }

  if (!WRITE) console.log('\n[DRY-RUN] Re-run with --write to apply.')
}

main().catch(e => { console.error(e); process.exit(1) })
