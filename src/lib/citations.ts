// Academic citation strings for /books, /authors, /countries, /essays, /methodology.
// Pure functions (no React) so they can be unit-tested with a fixed date.

export type CitationFormat = 'apa' | 'mla' | 'chicago'
export type EntityType = 'book' | 'author' | 'country' | 'essay' | 'methodology' | 'scope'

export type CitationEntity = {
  title: string                  // book title, author display name, country name, essay title, or page title for methodology
  authors?: string[]             // book authors only — display names ("George Orwell")
  slug: string
  code?: string
}

export type CitationInput = {
  entityType: EntityType
  entity: CitationEntity
  url: string
  accessedAt: Date
}

const PUBLISHER = 'Banned Books'

// Personal author for self-authored pages (essays, methodology).
// APA wants initials ("Raedts, L."), MLA/Chicago want full given name.
const PERSONAL_AUTHOR: Record<CitationFormat, string> = {
  apa: 'Raedts, L.',
  mla: 'Raedts, Ludo',
  chicago: 'Raedts, Ludo',
}

function hasPersonalAuthor(entityType: EntityType): boolean {
  return entityType === 'essay' || entityType === 'methodology'
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, '')
}

function formatAccessedUS(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  }).format(date)
}

function formatAccessedMLA(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

// Up to three authors are listed; four or more collapse to "first three, et al."
// (APA convention adapted for in-line "by X" usage.)
function formatAuthorList(authors: string[]): string {
  const trimmed = authors.map(a => a.trim()).filter(Boolean)
  if (trimmed.length === 0) return ''
  if (trimmed.length === 1) return trimmed[0]
  if (trimmed.length === 2) return `${trimmed[0]} and ${trimmed[1]}`
  if (trimmed.length === 3) return `${trimmed[0]}, ${trimmed[1]}, and ${trimmed[2]}`
  return `${trimmed[0]}, ${trimmed[1]}, ${trimmed[2]}, et al.`
}

function descriptiveTitle(input: CitationInput, format: CitationFormat): string {
  const titleCase = format === 'mla' || format === 'chicago'

  switch (input.entityType) {
    case 'book': {
      const authorPart = formatAuthorList(input.entity.authors ?? [])
      const tail = titleCase ? 'Censorship History' : 'Censorship history'
      return authorPart
        ? `${input.entity.title} by ${authorPart}: ${tail}`
        : `${input.entity.title}: ${tail}`
    }
    case 'author':
      return titleCase
        ? `${input.entity.title}: Banned Books and Censorship`
        : `${input.entity.title}: Banned books and censorship`
    case 'country':
      return titleCase
        ? `Book Censorship in ${input.entity.title}`
        : `Book censorship in ${input.entity.title}`
    case 'essay':
      return input.entity.title
    case 'methodology':
      return titleCase
        ? 'Methodology and Coverage Notes'
        : 'Methodology and coverage notes'
    case 'scope':
      return titleCase
        ? `Book Bans in ${input.entity.title} Settings`
        : `Book bans in ${input.entity.title.toLowerCase()} settings`
  }
}

function formatAPA(input: CitationInput): string {
  const year = input.accessedAt.getFullYear()
  const accessed = formatAccessedUS(input.accessedAt)
  const title = descriptiveTitle(input, 'apa')

  if (hasPersonalAuthor(input.entityType)) {
    return `${PERSONAL_AUTHOR.apa} (${year}). ${title}. ${PUBLISHER}. Retrieved ${accessed}, from ${input.url}`
  }
  return `${PUBLISHER}. (${year}). ${title}. Retrieved ${accessed}, from ${input.url}`
}

function formatMLA(input: CitationInput): string {
  const accessed = formatAccessedMLA(input.accessedAt)
  const title = descriptiveTitle(input, 'mla')
  const urlBare = stripProtocol(input.url)

  if (hasPersonalAuthor(input.entityType)) {
    return `${PERSONAL_AUTHOR.mla}. "${title}." ${PUBLISHER}, ${accessed}, ${urlBare}.`
  }
  return `"${title}." ${PUBLISHER}, ${accessed}, ${urlBare}.`
}

function formatChicago(input: CitationInput): string {
  const accessed = formatAccessedUS(input.accessedAt)
  const title = descriptiveTitle(input, 'chicago')

  if (hasPersonalAuthor(input.entityType)) {
    return `${PERSONAL_AUTHOR.chicago}. "${title}." ${PUBLISHER}. Accessed ${accessed}. ${input.url}.`
  }
  return `"${title}." ${PUBLISHER}. Accessed ${accessed}. ${input.url}.`
}

export function formatCitation(input: CitationInput, format: CitationFormat): string {
  switch (format) {
    case 'apa': return formatAPA(input)
    case 'mla': return formatMLA(input)
    case 'chicago': return formatChicago(input)
  }
}

export const CITATION_FORMATS: { id: CitationFormat; label: string }[] = [
  { id: 'apa', label: 'APA' },
  { id: 'mla', label: 'MLA' },
  { id: 'chicago', label: 'Chicago' },
]
