import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getThemes, getThemeBooks, THEME_REASON_MAP } from '@/lib/reading-club-data'
import { getPublishedBlockHtml } from '@/lib/content-blocks'
import ReadingClubBookCard from '@/components/reading-club-card'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

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
    <main>
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/reading-club/by-theme"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← All themes
          </Link>

          <Eyebrow>Theme</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            {theme.display_name}.
          </h1>

          {intro && (
            <div
              className="mt-6 prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 max-w-none"
              dangerouslySetInnerHTML={{ __html: intro }}
            />
          )}
        </div>
      </section>

      <SectionShell tone="cream" eyebrow={`${books.length} ${books.length === 1 ? 'title' : 'titles'}`}>
        <div className="max-w-3xl mx-auto">
          {books.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4">
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
            <p className="text-sm text-neutral-500">No books match this theme yet.</p>
          )}
        </div>
      </SectionShell>

      <SectionShell tone="white">
        <div className="max-w-3xl mx-auto flex flex-wrap gap-x-5 gap-y-2 text-xs">
          <Link href="/reading-club" className="text-oxblood hover:underline">
            ← Reading Club
          </Link>
          <Link href="/reading-club/by-theme" className="text-oxblood hover:underline">
            All themes
          </Link>
        </div>
      </SectionShell>
    </main>
  )
}
