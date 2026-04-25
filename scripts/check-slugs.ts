import { adminClient } from '../src/lib/supabase'
const supabase = adminClient()
async function main() {
  const { data } = await supabase.from('books').select('slug,title').order('title')
  const slugs = new Set((data||[]).map((b:any)=>b.slug))
  // Check alternate slugs for some books
  const check = [
    'absolutely-true-diary','the-absolutely-true-diary-of-a-part-time-indian',
    'speak','speak-halse-anderson','stamped','push','in-the-dream-house',
    'a-little-life','lawn-boy','front-desk','class-act','new-kid',
    'hey-kiddo','identical','burned','tricks'
  ]
  for(const s of check) console.log(s+':', slugs.has(s)?'EXISTS':'missing')
}
main().catch(console.error)
