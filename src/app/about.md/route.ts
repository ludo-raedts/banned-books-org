import { buildAboutDocument } from '@/lib/markdown-pages/about'
import { markdownResponse } from '@/lib/markdown-response'
import { adminClient } from '@/lib/supabase'

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
      books: books.count ?? 0,
      bans: bans.count ?? 0,
      countries: countriesRes.count ?? 0,
      activeBans: activeBans.count ?? 0,
      sources: sources.count ?? 0,
    }),
  )
}
