import { adminClient } from '../src/lib/supabase'

async function main() {
  const supabase = adminClient()
  
  // Check all Lady Chatterley books and their bans
  const { data: books } = await supabase.from('books')
    .select('id, title, slug').ilike('title', '%chatterley%')
  
  for (const book of books ?? []) {
    const { data: bans } = await supabase.from('bans')
      .select('id, country_code, year_started, action_type, status, institution, ban_reason_links(reasons(label_en))')
      .eq('book_id', book.id)
    console.log(`\n"${book.title}" (${book.slug}):`)
    bans?.forEach(b => {
      const reasons = b.ban_reason_links.map((r: any) => r.reasons?.label_en).filter(Boolean).join(', ')
      console.log(`  ${b.country_code} ${b.year_started} — ${b.action_type} — ${b.institution ?? 'no institution'} — ${reasons}`)
    })
  }
}
main().catch(console.error)
