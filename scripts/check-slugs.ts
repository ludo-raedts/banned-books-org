import { adminClient } from '../src/lib/supabase'
const supabase = adminClient()
async function main() {
  const { data } = await supabase.from('books').select('slug').order('slug')
  const slugs = new Set((data||[]).map((b:any)=>b.slug))
  const check = [
    'otkan-kunlar','az-i-ya','kvachi-kvachantiradze',
    'fire-and-night-rainis','voices-of-spring-maironis',
    'the-forty-days-of-musa-dagh','the-bastard-of-istanbul',
    'the-jewel-of-medina','fahrenheit-451',
    'da-vinci-code','the-da-vinci-code',
    'zorba-the-greek','captain-michalis',
    'the-gulag-archipelago','the-white-steamship',
    'the-tin-drum','ulysses'
  ]
  for(const s of check) console.log(s+':', slugs.has(s)?'EXISTS':'missing')
  console.log('\nTotal:', slugs.size)
}
main().catch(console.error)
