import { adminClient } from '../src/lib/supabase'

const supabase = adminClient()

const GENRES: Record<string, string[]> = {
  'and-tango-makes-three':  ['children'],
  'animal-farm':            ['satire', 'political-fiction'],
  'the-handmaids-tale':     ['dystopian'],
  'lady-chatterleys-lover': ['romance', 'literary-fiction'],
  'the-da-vinci-code':      ['thriller'],
  'brave-new-world':        ['dystopian', 'science-fiction'],
  'to-kill-a-mockingbird':  ['coming-of-age', 'historical-fiction'],
  '1984':                   ['dystopian', 'science-fiction'],
  'the-bluest-eye':         ['literary-fiction'],
  'the-satanic-verses':     ['literary-fiction', 'magical-realism'],
}

async function main() {
  for (const [slug, genres] of Object.entries(GENRES)) {
    const { error } = await supabase
      .from('books')
      .update({ genres })
      .eq('slug', slug)

    if (error) console.warn(`  [error] ${slug}: ${error.message}`)
    else console.log(`  [ok] ${slug}: ${genres.join(', ')}`)
  }
  console.log('\nDone.')
}

main().catch((err) => { console.error(err); process.exit(1) })
