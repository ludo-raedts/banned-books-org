import type { Metadata } from 'next'
import EssayLayout from '@/components/essay-layout'
import { essayBySlug } from '@/lib/essays-data'

const essay = essayBySlug('forbidden-knowledge-iceberg')!

export const metadata: Metadata = {
  title: `${essay.title} — Banned Books`,
  description: essay.dek,
  openGraph: { title: essay.title, description: essay.dek, type: 'article' },
  alternates: { canonical: essay.href },
  robots: essay.draft ? { index: false, follow: true } : undefined,
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: essay.title,
  description: essay.dek,
  datePublished: essay.publishedAt,
  author: { '@type': 'Organization', name: 'banned-books.org' },
  publisher: { '@type': 'Organization', name: 'banned-books.org' },
  mainEntityOfPage: `https://www.banned-books.org${essay.href}`,
}

const proseClasses =
  'prose prose-gray dark:prose-invert max-w-none ' +
  'prose-headings:font-bold prose-headings:tracking-tight ' +
  'prose-a:text-gray-900 dark:prose-a:text-gray-100 prose-a:underline prose-a:underline-offset-2 ' +
  'prose-a:decoration-gray-300 dark:prose-a:decoration-gray-600 ' +
  'hover:prose-a:decoration-gray-600 dark:hover:prose-a:decoration-gray-300 ' +
  'prose-p:leading-relaxed'

export default function ForbiddenKnowledgeIcebergPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EssayLayout essay={essay}>
        <article className={proseClasses}>
          <p>
            <em>Draft — content to be written.</em>
          </p>
          <p>
            Iceberg charts of &ldquo;forbidden knowledge&rdquo; treat very different categories as
            if they were rungs of one ladder: state-banned, religiously suppressed, esoteric,
            uncomfortable, fringe. This essay will argue that the visual format hides the very
            distinctions that matter.
          </p>
          <h2>Section heading</h2>
          <p>Body paragraph.</p>
        </article>
      </EssayLayout>
    </>
  )
}
