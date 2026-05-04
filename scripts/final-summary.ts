import { adminClient } from '../src/lib/supabase'
async function main() {
  const supabase = adminClient()
  const { data: countries } = await supabase.from('countries').select('code, name_en, description')
  
  const withDesc = countries?.filter(c => c.description).length ?? 0
  const withoutDesc = countries?.filter(c => !c.description).length ?? 0
  console.log(`Countries with descriptions: ${withDesc}`)
  console.log(`Countries without descriptions: ${withoutDesc}`)
  
  // Count total books and bans
  let bookCount = 0, offset = 0
  while (true) {
    const { data } = await supabase.from('books').select('id').range(offset, offset + 999)
    if (!data || data.length === 0) break
    bookCount += data.length
    if (data.length < 1000) break
    offset += 1000
  }
  
  let banCount = 0; offset = 0
  while (true) {
    const { data } = await supabase.from('bans').select('id').range(offset, offset + 999)
    if (!data || data.length === 0) break
    banCount += data.length
    if (data.length < 1000) break
    offset += 1000
  }
  
  console.log(`\nTotal books in DB: ${bookCount.toLocaleString()}`)
  console.log(`Total bans in DB: ${banCount.toLocaleString()}`)
  
  // Missing descriptions
  const missing = countries?.filter(c => !c.description).map(c => `${c.code} (${c.name_en})`).join(', ')
  if (missing) console.log(`\nCountries still missing descriptions: ${missing}`)
}
main().catch(console.error)
