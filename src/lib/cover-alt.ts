// One source of truth for book-cover alt-text. Used by every <Image> that
// renders a book cover (detail pages, related-book grids, search results,
// reading lists, etc.). Adds author + year context to the previous bare
// "Cover of {title}" alt-text — both for accessibility and because Google
// Images uses image-alt + nearby text as a primary ranking signal for
// /imgres results. Book-related image traffic is large and currently
// under-served because every cover image had the same alt-pattern.
//
// Output examples:
//   coverAlt("1984")                              → "Cover of 1984"
//   coverAlt("1984", "George Orwell")             → "Cover of 1984 by George Orwell"
//   coverAlt("1984", "George Orwell", 1949)       → "Cover of 1984 by George Orwell (1949)"

export function coverAlt(
  title: string,
  author?: string | null,
  year?: number | null,
): string {
  const parts: string[] = [`Cover of ${title}`]
  const trimmedAuthor = author?.trim()
  if (trimmedAuthor) parts.push(`by ${trimmedAuthor}`)
  if (year && Number.isFinite(year)) parts.push(`(${year})`)
  return parts.join(' ')
}
