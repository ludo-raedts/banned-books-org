import { adminClient } from '../src/lib/supabase'
async function main() {
  const s = adminClient()
  const { data: books } = await s.from('books').select('slug, title, description').is('description', null).order('title')
  // Look for well-known titles
  const wellKnown = [
    'alice', 'clockwork', 'wrinkle', 'passage', 'catch', 'mockingbird',
    'brave-new', 'fahrenheit', 'grapes', 'catcher', 'lord-of-the-flies',
    'color-purple', 'beloved', 'harry', 'harry-potter', 'gatsby',
    'handmaid', 'scarlet', 'chatterley', 'ulysses', 'catch-22',
    'slaughterhouse', 'tropic', 'naked', 'flowers-for-algernon',
    'little-life', 'all-boys', 'speak', 'stamped', 'dream-house',
    'front-desk', 'hey-kiddo', 'sold', 'breathless', 'crank', 'damsel',
    'jewel-of-medina', 'kremlin', 'turkish-gambit', 'viral', 'wuhan'
  ]
  
  books?.forEach(b => {
    if (wellKnown.some(k => b.slug.includes(k) || b.title.toLowerCase().includes(k.replace(/-/g, ' ')))) {
      console.log(`  ${b.slug}: "${b.title}"`)
    }
  })
}
main().catch(console.error)
