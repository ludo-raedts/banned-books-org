import { buildAboutDocument } from '@/lib/markdown-pages/about'
import { markdownResponse } from '@/lib/markdown-response'
import { getSiteTotals } from '@/lib/site-totals'

export const revalidate = 3600

export async function GET() {
  const t = await getSiteTotals()
  return markdownResponse(
    buildAboutDocument({
      books: t.books,
      bans: t.bans,
      countries: t.countries,
      activeBans: t.activeBans,
      sources: t.citations,
      registerTitles: t.registerTitles,
      earliest: t.earliest,
    }),
  )
}
