/**
 * Check for censorship_context column; print SQL to run if missing.
 */
import { adminClient } from '../src/lib/supabase'

async function main() {
  const s = adminClient()
  const { error } = await s.from('books').select('censorship_context').limit(1)
  if (error?.message.includes('censorship_context')) {
    console.log('Column missing. Run in Supabase SQL editor:\n')
    console.log(`ALTER TABLE books ADD COLUMN IF NOT EXISTS censorship_context TEXT;`)
  } else {
    console.log('censorship_context column exists ✓')
  }
}
main()
