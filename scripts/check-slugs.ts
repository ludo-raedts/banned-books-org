import { adminClient } from '../src/lib/supabase'
const supabase = adminClient()
async function main() {
  const { data } = await supabase.from('books').select('slug').order('slug')
  const slugs = (data||[]).map((b:any)=>b.slug)
  const check = [
    'kobzar-shevchenko','the-god-of-small-things','the-kite-runner',
    'giovannis-room','in-the-country-of-men','persepolis-satrapi',
    'the-painted-bird','anne-frank-diary','the-bell-jar',
    'mein-kampf-hitler','the-book-thief','speak-anderson',
    'the-hate-u-give','fahrenheit-451','brave-new-world',
    'lolita','animal-farm','1984','persepolis'
  ]
  for(const s of check) console.log(s+':', slugs.includes(s)?'EXISTS':'missing')
  console.log('\nTotal books:', slugs.length)
}
main().catch(console.error)

// run extra check
async function main2() {
  const { data } = await adminClient().from('books').select('slug').order('slug')
  const slugs = (data||[]).map((b:any)=>b.slug)
  const check2 = [
    'things-fall-apart','heart-of-a-dog','i-the-supreme',
    'the-story-of-zahra','bread-and-wine-silone','zorba-the-greek',
    'sons-and-lovers','the-painted-bird-kosinki',
    'captain-michalis','freedom-or-death',
    'son-of-man-roa-bastos'
  ]
  for(const s of check2) console.log(s+':', slugs.includes(s)?'EXISTS':'missing')
}
main2().catch(console.error)
