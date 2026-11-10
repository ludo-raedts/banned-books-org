import { buildAboutDocument } from '@/lib/markdown-pages/about'
import { markdownResponse } from '@/lib/markdown-response'
import { adminClient } from '@/lib/supabase'
import { requireCount } from '@/lib/require-count'

export const revalidate = 3600

export async function GET() {
  const s = adminClient()
  const [books, bans, activeBans, sources, countriesRes] = await Promise.all([
    s.from('books').select('*', { count: 'exact', head: true }),
    s.from('bans').select('*', { count: 'exact', head: true }),
    s.from('bans').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    s.from('ban_sources').select('*', { count: 'exact', head: true }),
    s.from('mv_ban_counts').select('*', { count: 'exact', head: true }),
  ])

  return markdownResponse(
    buildAboutDocument({
      books: requireCount(books, 'books'),
      bans: requireCount(bans, 'bans'),
      countries: requireCount(countriesRes, 'countriesRes'),
      activeBans: requireCount(activeBans, 'activeBans'),
      sources: requireCount(sources, 'sources'),
    }),
  )
}
