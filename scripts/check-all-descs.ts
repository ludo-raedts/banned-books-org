import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  const codes = ['DE','AU','IE','SU','GB','IN','RU','ZA','FR','IR','KR','SA','AR','HK','CS','PL','BR','CU','EG','GR','PT','VA']
  const { data } = await supabase.from('countries').select('code, name_en, description').in('code', codes)
  data?.sort((a,b) => codes.indexOf(a.code) - codes.indexOf(b.code))
  data?.forEach(c => console.log(`\n=== ${c.code} ${c.name_en} ===\n${c.description ?? '(none)'}`) )
}
main().catch(console.error)
