// Shared Kobo product-matching guards, used by enrich-kobo-links.ts
// (Rakuten Product Search API) and enrich-kobo-links-site.ts (Kobo site
// search via Firecrawl). Kobo's catalogue is flooded with study guides,
// summaries, and "<Title> by <Author>" reprint-mill knockoffs that all
// contain the title tokens — matching must be strict; a miss is safe
// (the site keeps its search-link fallback).

export function tokenList(s: string): string[] {
  const toks = s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  // Leading articles differ freely between editions — strip for comparison.
  while (toks.length > 1 && ['the', 'a', 'an'].includes(toks[0])) toks.shift()
  return toks
}

export const STUDY_GUIDE_RE = /summary|analysis|study guide|sparknotes|cliffsnotes|maxnotes|litcharts|shmoop|bookrags|gradesaver|workbook|lesson plan|classroom|questions|teaching|quiz|trivia|essay|critique|critical|companion|sidekick|conversation starters|book review|abridged|adapted|retold|songbook|musical|soundtrack|movie version/i

// Knockoff summaries and reprint mills title themselves "<Title> by
// <Author>"; official publisher editions never put the author inside the
// productname.
export function looksLikeByAuthorKnockoff(productName: string, authorLastName: string): boolean {
  if (!authorLastName) return false
  return new RegExp(`\\bby\\s+[a-z.\\s]*${authorLastName}\\b`, 'i').test(productName)
}

// productname must START with the book's main-title token sequence
// (modulo leading articles); study-guide vocabulary rejects unless the
// word is part of our own title ("The Lesbiana's Guide to …").
export function titleGuard(bookTitle: string, productName: string): boolean {
  const title = tokenList(bookTitle.split(':')[0])
  const product = tokenList(productName)
  if (title.length === 0 || product.length < title.length) return false
  for (let i = 0; i < title.length; i++) {
    if (product[i] !== title[i]) return false
  }
  const m = productName.match(STUDY_GUIDE_RE)
  if (m && !bookTitle.toLowerCase().includes(m[0].toLowerCase())) return false
  return true
}

// Among guard-passing candidates the real edition is the one with the
// FEWEST tokens beyond the title — "The Satanic Verses" beats "The
// Satanic Verses: The Rhetoric of…". The subtitle allowance scales with
// title length: a one-word title like "Lucky" must match exactly (it
// otherwise pulls in "The Lucky Egg"), two words allow one extra, longer
// titles allow a 3-token subtitle.
export function pickBestMatch<T extends { name: string }>(
  candidates: T[], bookTitle: string, authorLastName: string,
): T | undefined {
  const titleLen = tokenList(bookTitle.split(':')[0]).length
  const extraCap = titleLen === 1 ? 0 : titleLen === 2 ? 1 : 3
  return candidates
    .filter(c =>
      titleGuard(bookTitle, c.name) &&
      !looksLikeByAuthorKnockoff(c.name, authorLastName) &&
      tokenList(c.name).length - titleLen <= extraCap,
    )
    .sort((x, y) => tokenList(x.name).length - tokenList(y.name).length)[0]
}

export function lastName(display: string): string {
  const parts = display.trim().split(/\s+/)
  return parts[parts.length - 1] ?? ''
}
