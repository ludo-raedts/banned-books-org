import { adminClient } from '../src/lib/supabase'
async function main() {
  const s = adminClient()
  const { data } = await s.from('countries').select('code, name_en').in('code', ['HK', 'CN', 'SG'])
  console.log(JSON.stringify(data))
  const { data: bansData } = await s.from('bans').select('id').eq('country_code', 'HK').limit(1)
  console.log('HK bans:', bansData?.length)
}
main().catch(console.error)
