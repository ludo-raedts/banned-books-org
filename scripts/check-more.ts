import { adminClient } from '../src/lib/supabase'
async function main() {
  const s = adminClient()
  const toCheck = [
    'of-mice-and-men','the-grapes-of-wrath','go-ask-alice',
    'the-perks-of-being-a-wallflower','one-flew-over-the-cuckoos-nest',
    'the-bell-jar','i-know-why-the-caged-bird-sings','their-eyes-were-watching-god',
    'the-house-on-mango-street','one-hundred-years-of-solitude','the-house-of-the-spirits',
    'the-color-purple','a-separate-peace','captain-underpants','dracula',
    'frankenstein','the-picture-of-dorian-gray','ulysses','the-trial',
    'the-metamorphosis-kafka','native-son','black-boy','the-sun-also-rises',
    'for-whom-the-bell-tolls','madame-bovary','the-awakening-chopin',
  ]
  const { data: found } = await s.from('books').select('slug,title').in('slug', toCheck)
  const foundSlugs = new Set(found?.map(b => b.slug))
  console.log('Found:')
  found?.forEach(b => console.log(`  ${b.slug}: "${b.title}"`))
  console.log('\nMissing:')
  toCheck.forEach(s => { if (!foundSlugs.has(s)) console.log(' ', s) })
}
main().catch(console.error)
