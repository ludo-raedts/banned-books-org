// Legacy Google News rows were stored as
//   title:        "<headline> - <Publisher>"
//   source_name:  "Google News — banned books"
// Newer ingests already split these. This helper restores them at display time.
const LEGACY_GOOGLE_NEWS = 'Google News — banned books'

export function normalizeNewsDisplay(title: string, sourceName: string): { title: string; sourceName: string } {
  if (sourceName !== LEGACY_GOOGLE_NEWS) return { title, sourceName }
  const idx = title.lastIndexOf(' - ')
  if (idx <= 0) return { title, sourceName }
  const publisher = title.slice(idx + 3).trim()
  if (!publisher || publisher.length > 60) return { title, sourceName }
  return { title: title.slice(0, idx).trim(), sourceName: publisher }
}
