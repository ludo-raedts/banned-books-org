import type { Metadata } from 'next'
import Link from 'next/link'
import { getThemes } from '@/lib/reading-club-data'
import { getPublishedBlockMap, REQUIRED_BLOCKS_BY_PAGE } from '@/lib/content-blocks'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'By theme — Reading Club',
  description:
    'Banned-books reading paths by theme: LGBTQ+, political dissent, religious censorship, race and racism, sexuality.',
  alternates: { canonical: '/reading-club/by-theme' },
}

export default async function ByThemePage() {
  const [themes, blocks] = await Promise.all([
    getThemes(),
    getPublishedBlockMap(REQUIRED_BLOCKS_BY_PAGE['reading-club-themes']),
  ])
  const intro = blocks.get('track-themes-intro')

  return (
    <main>
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/reading-club"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← Reading Club
          </Link>

          <Eyebrow>Track · By theme</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            By theme.
          </h1>

          {intro && (
            <div
              className="mt-6 prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 max-w-none"
              dangerouslySetInnerHTML={{ __html: intro }}
            />
          )}
        </div>
      </section>

      <SectionShell tone="cream" eyebrow={`${themes.length} ${themes.length === 1 ? 'theme' : 'themes'}`}>
        <div className="max-w-3xl mx-auto">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {themes.map(t => (
              <li key={t.slug}>
                <Link
                  href={`/reading-club/by-theme/${t.slug}`}
                  className="group flex flex-col h-full w-full bg-white border border-neutral-200 hover:border-oxblood rounded-sm p-5 transition-colors"
                >
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Theme</span>
                  <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
                    {t.display_name}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">→ Explore</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      <SectionShell tone="white" eyebrow="Other tracks">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/reading-club/currently-challenged" className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">This year</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Currently challenged →
            </p>
          </Link>
          <Link href="/reading-club/international" className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Worldwide</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              International cases →
            </p>
          </Link>
          <Link href="/reading-club/classics" className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Historical</p>
            <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
              Banned classics →
            </p>
          </Link>
        </div>
      </SectionShell>
    </main>
  )
}
