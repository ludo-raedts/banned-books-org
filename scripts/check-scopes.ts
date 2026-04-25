import { adminClient } from '../src/lib/supabase'
async function main() {
  const s = adminClient()
  const { data: scopes } = await s.from('scopes').select('*')
  console.log('Scopes:', JSON.stringify(scopes, null, 2))
  // Also check a few orphaned books' batch data
  const slugs = ['the-white-swan-express','peoples-republic-of-amnesia','a-little-life','the-jewel-of-medina']
  for (const slug of slugs) {
    const { data: b } = await s.from('books').select('id,title').eq('slug', slug).single()
    const { data: bans } = await s.from('bans').select('*').eq('book_id', b?.id ?? 0)
    console.log(`\n${slug}: bans = ${bans?.length ?? 0}`)
  }
}
main().catch(console.error)
