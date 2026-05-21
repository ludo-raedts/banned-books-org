import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getThemes, getThemeBooks, THEME_REASON_MAP } from '@/lib/reading-club-data'
import { getPublishedBlockHtml } from '@/lib/content-blocks'
import ReadingClubBookCard from '@/components/reading-club-card'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  if (!(slug in THEME_REASON_MAP)) return { title: 'Theme not found' }
  const themes = await getThemes()
  const theme = themes.find(t => t.slug === slug)
  return {
    title: `${theme?.display_name ?? slug} — Reading Club by theme`,
    description: `Banned and challenged books on the theme of ${theme?.display_name?.toLowerCase() ?? slug}.`,
    alternates: { canonical: `/reading-club/by-theme/${slug}` },
  }
}

export default async function ThemeSubpage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!(slug in THEME_REASON_MAP)) notFound()

  const [themes, books, intro] = await Promise.all([
    getThemes(),
    getThemeBooks(slug),
    getPublishedBlockHtml(`theme-${slug}-intro`),
  ])
  const theme = themes.find(t => t.slug === slug)
  if (!theme) notFound()

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/reading-club/by-theme" className="text-sm text-gray-500 hover:underline">
        ← All themes
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-4">{theme.display_name}</h1>

      {intro && (
        <section className="mb-8 prose prose-gray dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: intro }} />
      )}

      {books.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 mb-10">
          {books.map(b => (
            <ReadingClubBookCard
              key={b.bookId ?? b.position}
              card={b}
              showCountries
              track="by-theme"
              themeSlug={slug}
              clubHref={b.bookSlug ? `/reading-club/by-theme/${slug}/${b.bookSlug}` : undefined}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 my-10">No books match this theme yet.</p>
      )}

      <p className="text-xs text-gray-500 mt-10">
        → <Link href="/reading-club" className="hover:underline">Reading Club</Link>{' · '}
        <Link href="/reading-club/by-theme" className="hover:underline">All themes</Link>
      </p>
    </main>
  )
}
