import { adminClient } from '../src/lib/supabase'
async function main() {
  const supabase = adminClient()
  const { data } = await supabase.from('countries').select('code, name_en, description').in('code', ['PH','NO','CL','LB','KP','DK','BY','SY','PY','LY','UA','IQ'])
  data?.forEach(c => console.log(`\n=== ${c.code} ${c.name_en} ===\n${c.description ?? '(none)'}`) )
}
main().catch(console.error)
