import { adminClient } from '../src/lib/supabase'
const supabase = adminClient()
async function main() {
  const slugs = ['tombstone-yang-jisheng','kobzar-shevchenko','in-the-country-of-men','i-the-supreme','son-of-man-roa-bastos','bread-and-wine-silone','fontamara-silone','stalingrad-grossman']
  for (const slug of slugs) {
    const { data: book } = await supabase.from('books').select('id,title').eq('slug',slug).single()
    if (!book) { console.log(`${slug}: NOT FOUND`); continue }
    const { data: bans } = await supabase.from('bans').select('country_code').eq('book_id',(book as any).id)
    const codes = (bans||[]).map((b:any)=>b.country_code).join(',')
    console.log(`${slug}: [${codes}]`)
  }
}
main().catch(console.error)
