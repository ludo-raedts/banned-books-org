import { adminClient } from '../src/lib/supabase'

async function main() {
  const s = adminClient()

  // Get all reasons to see their IDs
  const { data: reasons } = await s.from('reasons').select('id, slug, label_en').order('slug')
  console.log('All reasons:', reasons?.map(r => `${r.id}: ${r.slug}`).join(', '))

  const otherReason = reasons?.find(r => r.slug === 'other')
  if (!otherReason) { console.error('no other reason found'); return }

  // Find bans linked to "other" reason
  const { data: otherLinks } = await s
    .from('ban_reason_links')
    .select('ban_id, bans(book_id)')
    .eq('reason_id', otherReason.id)

  const bookIds = [...new Set(
    (otherLinks ?? []).map(l => (l.bans as any)?.book_id).filter(Boolean)
  )]
  console.log(`\nBooks with "other" reason: ${bookIds.length}`)

  // Get their descriptions and current reasons
  const { data: books } = await s
    .from('books')
    .select(`
      id, title, slug, description_ban, description,
      bans(id, ban_reason_links(reasons(slug)))
    `)
    .in('id', bookIds)
    .order('title')

  for (const book of books ?? []) {
    const reasons = [...new Set(
      (book.bans as any[]).flatMap((b: any) =>
        b.ban_reason_links.map((l: any) => l.reasons?.slug).filter(Boolean)
      )
    )]
    const desc = (book.description_ban ?? book.description ?? '').slice(0, 150)
    console.log(`\n[${book.slug}]`)
    console.log(`  Reasons: ${reasons.join(', ')}`)
    console.log(`  Desc: ${desc}`)
  }
}
main().catch(console.error)
