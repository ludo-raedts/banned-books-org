import { buildAboutDocument } from '@/lib/markdown-pages/about'
import { markdownResponse } from '@/lib/markdown-response'
import { adminClient } from '@/lib/supabase'

export const revalidate = 3600

export async function GET() {
  const s = adminClient()
  const [books, bans, activeBans, sources, countryRows] = await Promise.all([
    s.from('books').select('*', { count: 'exact', head: true }),
    s.from('bans').select('*', { count: 'exact', head: true }),
    s.from('bans').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    s.from('ban_sources').select('*', { count: 'exact', head: true }),
    s.from('bans').select('country_code').neq('country_code', null),
  ])
  const countries = new Set(
    ((countryRows.data ?? []) as { country_code: string | null }[])
      .map((r) => r.country_code)
      .filter((c): c is string => !!c),
  ).size

  return markdownResponse(
    buildAboutDocument({
      books: books.count ?? 0,
      bans: bans.count ?? 0,
      countries,
      activeBans: activeBans.count ?? 0,
      sources: sources.count ?? 0,
    }),
  )
}
