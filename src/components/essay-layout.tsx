import Link from 'next/link'
import type { ReactNode } from 'react'
import EssayRelatedBooks from './essay-related-books'
import MoreEssays from './more-essays'
import CitationBlock from './citation-block'
import SectionShell from './section/SectionShell'
import Eyebrow from './section/Eyebrow'
import type { Essay } from '@/lib/essays-data'

type Hero = {
  src: string
  alt: string
  caption?: ReactNode
  eager?: boolean
}

type Props = {
  essay: Essay
  hero?: Hero
  children: ReactNode               // The essay prose — rendered inside a styled <article>
}

// Shared prose styling, matching the modern reference pages (/why-not-amazon,
// /methodology): serif headings with an oxblood underline rule, oxblood links.
const proseClasses =
  'max-w-3xl mx-auto prose prose-gray ' +
  'prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight ' +
  'prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 ' +
  'prose-h2:border-b prose-h2:border-oxblood/30 ' +
  'prose-h3:mt-6 prose-h3:mb-2 ' +
  'prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline ' +
  'prose-strong:text-gray-900 prose-p:leading-relaxed'

export default function EssayLayout({ essay, hero, children }: Props) {
  const publishedDate = new Date(essay.publishedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/essays"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← Essays
          </Link>

          <Eyebrow>Essay · {essay.readingTimeMin} min read</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            {essay.title}
          </h1>

          <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
            {essay.dek}
          </p>

          <p className="mt-6 text-xs text-neutral-500">
            Published {publishedDate}
          </p>
        </div>
      </section>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <SectionShell tone="cream">
        {hero && (
          <figure className="max-w-3xl mx-auto mb-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero.src}
              alt={hero.alt}
              className="w-full rounded-xl object-cover"
              loading={hero.eager ? 'eager' : 'lazy'}
            />
            {hero.caption && (
              <figcaption className="text-xs text-neutral-500 mt-2">
                {hero.caption}
              </figcaption>
            )}
          </figure>
        )}

        <article className={proseClasses}>{children}</article>
      </SectionShell>

      {/* ── Footer: citation, related books, more essays ──────────── */}
      <SectionShell tone="white">
        <div className="max-w-3xl mx-auto">
          <CitationBlock
            entityType="essay"
            entity={{ title: essay.title, slug: essay.slug }}
            url={`https://www.banned-books.org${essay.href}`}
          />

          {essay.relatedBookSlugs.length > 0 && (
            <EssayRelatedBooks slugs={essay.relatedBookSlugs} />
          )}

          <MoreEssays currentSlug={essay.slug} />
        </div>
      </SectionShell>
    </main>
  )
}
