import type { Metadata } from 'next'
import Link from 'next/link'
import EssayCard from '@/components/essay-card'
import { publishedEssays } from '@/lib/essays-data'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const metadata: Metadata = {
  title: 'Essays',
  description:
    'Long-form pieces on censorship, what we document, and the editorial choices behind this catalogue.',
  alternates: {
    canonical: '/essays',
    types: { 'application/rss+xml': '/essays/feed.xml' },
  },
}

export default function EssaysIndexPage() {
  const essays = publishedEssays()

  return (
    <main>
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← Home
          </Link>

          <Eyebrow>Long-form · The catalogue, examined</Eyebrow>

          <div className="flex items-baseline justify-between gap-4">
            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 max-w-[820px]">
              Essays.
            </h1>
            <a
              href="/essays/feed.xml"
              type="application/rss+xml"
              className="shrink-0 text-xs font-medium tracking-wide text-gray-700 hover:text-oxblood underline underline-offset-2 transition-colors whitespace-nowrap"
            >
              RSS feed ↗
            </a>
          </div>

          <p className="mt-6 max-w-[720px] text-sm md:text-base leading-relaxed text-gray-700">
            Long-form pieces about censorship — what we document, how the categories blur, and why the choices behind this catalogue are not neutral.
          </p>
        </div>
      </section>

      <SectionShell tone="cream" eyebrow={`${essays.length} ${essays.length === 1 ? 'essay' : 'essays'}`}>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {essays.map(essay => (
            <li key={essay.slug}>
              <EssayCard essay={essay} />
            </li>
          ))}
        </ul>
      </SectionShell>
    </main>
  )
}
