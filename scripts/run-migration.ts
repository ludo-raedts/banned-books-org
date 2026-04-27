import { adminClient } from '../src/lib/supabase'
async function main() {
  const s = adminClient()
  // Try inserting a test to see if columns exist
  const { data, error } = await s.from('authors').select('bio, birth_country, photo_url').limit(1)
  if (error) {
    console.log('Columns missing:', error.message)
    console.log('\nRun this SQL in your Supabase SQL editor:')
    console.log(`
ALTER TABLE authors
  ADD COLUMN IF NOT EXISTS bio           text,
  ADD COLUMN IF NOT EXISTS birth_country text,
  ADD COLUMN IF NOT EXISTS photo_url     text;
`)
  } else {
    console.log('Columns exist ✓', Object.keys(data?.[0] ?? {}))
  }
}
main()
