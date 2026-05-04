import { adminClient } from '../src/lib/supabase'
async function main() {
  const sb = adminClient()
  // Check scopes
  const { data: scopes } = await sb.from('scopes').select('id, slug') as any
  console.log('Scopes:', scopes)
  const school = scopes?.find((s: any) => s.slug === 'school')
  console.log('School scope:', school)

  // Check if US exists in countries
  const { data: us } = await sb.from('countries').select('code').eq('code', 'US').single() as any
  console.log('US country:', us)

  // Test ban insert with a real book
  const { data: book } = await sb.from('books').select('id').order('id', { ascending: false }).limit(1).single() as any
  console.log('Latest book id:', book?.id)

  if (school && book) {
    const { data: ban, error: banErr } = await sb.from('bans').insert({
      book_id: book.id,
      country_code: 'US',
      scope_id: school.id,
      action_type: 'banned',
      status: 'active',
      year_started: 2024,
    }).select('id').single() as any
    if (banErr) {
      console.log('Ban error code:', banErr.code)
      console.log('Ban error message:', banErr.message)
      console.log('Ban error details:', banErr.details)
    } else {
      console.log('Ban insert ok, id:', ban.id)
      await sb.from('bans').delete().eq('id', ban.id)
    }
  }
}
main().catch(console.error)
