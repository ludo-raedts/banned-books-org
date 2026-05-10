// Highwire Press meta tags for academic reference managers (Zotero, Mendeley, EndNote).
// Returns a string-record suitable for Next.js Metadata API's `other` field — when a
// value is an array, Next renders one <meta> tag per element, which is what Highwire
// expects for citation_author.

import type { EntityType } from '@/lib/citations'

export type CitationMetaInput = {
  entityType: EntityType
  title: string                  // Page title (descriptive, not raw entity title is fine — keep it short)
  authors?: string[]             // For books: book authors. For author pages: the author themselves. Optional.
  url: string                    // Canonical URL
  publicationYear?: number       // For citation_publication_date — the year. Falls back to current year.
  onlineDate?: string            // ISO YYYY-MM-DD or YYYY — when this *page* first went online.
}

const PUBLISHER = 'Banned Books'
const SELF_AUTHOR = 'Raedts, Ludo'

export function buildCitationMeta(input: CitationMetaInput): Record<string, string | string[]> {
  const meta: Record<string, string | string[]> = {
    citation_title: input.title,
    citation_publisher: PUBLISHER,
    citation_fulltext_html_url: input.url,
  }

  // Author tag(s)
  let authors: string[] = []
  if (input.entityType === 'essay' || input.entityType === 'methodology') {
    authors = [SELF_AUTHOR]
  } else if (input.authors && input.authors.length > 0) {
    authors = input.authors
  }
  if (authors.length === 1) meta.citation_author = authors[0]
  else if (authors.length > 1) meta.citation_author = authors

  // Publication date — Highwire accepts YYYY, YYYY/MM/DD, or YYYY-MM-DD.
  const pubYear = input.publicationYear ?? new Date().getFullYear()
  meta.citation_publication_date = String(pubYear)

  if (input.onlineDate) {
    meta.citation_online_date = input.onlineDate
  }

  return meta
}
