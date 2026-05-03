/**
 * Check for cover_search_attempts table; print SQL to run if missing.
 * Usage: npx tsx --env-file=.env.local scripts/migrate-cover-search-attempts.ts
 */
import { adminClient } from '../src/lib/supabase'

async function main() {
  const s = adminClient()
  const { error } = await s.from('cover_search_attempts').select('book_id').limit(1)
  if (error?.message.includes('cover_search_attempts') || error?.code === '42P01') {
    console.log('Table missing. Run this in the Supabase SQL editor:\n')
    console.log(`CREATE TABLE IF NOT EXISTS cover_search_attempts (
  book_id BIGINT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  last_searched_at TIMESTAMPTZ DEFAULT NOW(),
  attempts INTEGER DEFAULT 1,
  sources_tried TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);`)
  } else if (error) {
    console.error('Unexpected error:', error.message)
  } else {
    console.log('cover_search_attempts table exists ✓')
  }
}
main()
