import React from 'react'

/**
 * Small subtle attribution rendered under description_book on the book
 * page. Tells the reader where the text came from (Wikipedia, OpenLibrary,
 * Google Books, or AI-synthesised from cited sources) and links out.
 *
 * Only rendered for descriptions produced by enrich-descriptions-v2;
 * legacy rows (description_source_url = NULL) show nothing.
 *
 * Design notes:
 *   - Single line, text-xs, gray — does not compete with the description.
 *   - For llm_grounded_* labels we are explicit that AI was involved; the
 *     URL still points at the primary cited source so a reader can
 *     verify any factual claim against it.
 */
const TYPE_LABEL: Record<string, string> = {
  wikipedia:           'Wikipedia',
  wikipedia_translated:'Wikipedia (translated)',
  openlibrary:         'Open Library',
  google_books:        'Google Books',
  llm_grounded_multi:  'multiple cited sources, AI-summarised',
  llm_grounded_single: 'cited source, AI-summarised',
  manual:              'editorial team',
}

export default function DescriptionSourceAttribution({
  url,
  type,
}: {
  url: string
  type: string
}) {
  const label = TYPE_LABEL[type] ?? 'external source'
  return (
    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
      Source:{' '}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-brand"
      >
        {label}
      </a>
    </p>
  )
}
