import { adminClient } from '../src/lib/supabase'
async function main() {
  const s = adminClient()
  const { count: banCount } = await s.from('bans').select('*', { count: 'exact', head: true })
  const { count: bookCount } = await s.from('books').select('*', { count: 'exact', head: true })
  console.log(`Real ban count: ${banCount}`)
  console.log(`Real book count: ${bookCount}`)
  // Also check which known important books are NOT in DB
  const toCheck = [
    'of-mice-and-men','the-grapes-of-wrath','go-ask-alice',
    'the-perks-of-being-a-wallflower','the-absolutely-true-diary-of-a-part-time-indian',
    'i-know-why-the-caged-bird-sings','invisible-man-ellison','madame-bovary',
    'for-whom-the-bell-tolls','the-sun-also-rises','the-adventures-of-tom-sawyer',
    'captain-underpants','the-curious-incident-of-the-dog-in-the-night-time',
    'harry-potter','a-separate-peace','one-flew-over-the-cuckoos-nest',
    'the-bell-jar','death-of-a-salesman','the-metamorphosis','ulysses',
    'the-trial','it-perks','its-perfectly-normal','the-awakening',
    'native-son','black-boy','go-tell-it-on-the-mountain','the-fire-next-time',
    'the-color-purple','their-eyes-were-watching-god','the-house-on-mango-street',
    'the-house-of-the-spirits','one-hundred-years-of-solitude',
  ]
  const { data: found } = await s.from('books').select('slug').in('slug', toCheck)
  const foundSlugs = new Set(found?.map(b => b.slug))
  console.log('\nMissing from DB:')
  toCheck.forEach(s => { if (!foundSlugs.has(s)) console.log(' ', s) })
}
main().catch(console.error)
