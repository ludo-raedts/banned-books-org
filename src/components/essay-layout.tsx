import Link from 'next/link'
import type { ReactNode } from 'react'
import EssayRelatedBooks from './essay-related-books'
import MoreEssays from './more-essays'
import CitationBlock from './citation-block'
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
  children: ReactNode               // The essay body — typically wrapped in <article class="prose">
}

export default function EssayLayout({ essay, hero, children }: Props) {
  const publishedDate = new Date(essay.publishedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <Link
        href="/essays"
        className="inline-block text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-8"
      >
        ← Essays
      </Link>

      <header className="bg-brand-light dark:bg-brand-dark/10 border-l-4 border-brand pl-6 pr-4 py-6 mb-12 rounded-r-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-brand/70 dark:text-brand/60 mb-3">
          Essay · {essay.readingTimeMin} min read
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-4">
          {essay.title}
        </h1>
        <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
          {essay.dek}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
          Published {publishedDate}
        </p>
      </header>

      {hero && (
        <figure className="mb-12 -mx-4 sm:mx-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero.src}
            alt={hero.alt}
            className="w-full sm:rounded-xl object-cover"
            loading={hero.eager ? 'eager' : 'lazy'}
          />
          {hero.caption && (
            <figcaption className="text-xs text-gray-400 dark:text-gray-500 mt-2 px-4 sm:px-0">
              {hero.caption}
            </figcaption>
          )}
        </figure>
      )}

      {children}

      <CitationBlock
        entityType="essay"
        entity={{ title: essay.title, slug: essay.slug }}
        url={`https://www.banned-books.org${essay.href}`}
      />

      {essay.relatedBookSlugs.length > 0 && (
        <EssayRelatedBooks slugs={essay.relatedBookSlugs} />
      )}

      <MoreEssays currentSlug={essay.slug} />
    </main>
  )
}
