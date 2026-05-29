// Pure utilities for the /discover page. No DB imports — safe to bundle
// into the client so all filtering / scoring / picking happens in-browser
// against the pool we ship on initial load.

import { reasonLabel } from '@/components/reason-badge'
import { genreLabel } from '@/components/genre-badge'

export const ICONIC_BOOK_SLUGS = new Set<string>([
  '1984',
  'animal-farm',
  'lolita',
  'brave-new-world',
  'the-handmaids-tale',
  'fahrenheit-451',
  'the-catcher-in-the-rye',
  'to-kill-a-mockingbird',
  'the-great-gatsby',
  'beloved',
  'the-color-purple',
  'of-mice-and-men',
  'the-adventures-of-huckleberry-finn',
  'lady-chatterleys-lover',
  'ulysses',
  'mein-kampf',
  'the-bluest-eye',
])

export const GENRE_ALIASES: Record<string, string[]> = {
  'young-adult': ['young-adult', 'young-adult-fiction'],
}

export const GENRE_BLOCKLIST = new Set<string>([
  'literary-fiction',
])

export type RegionCode =
  | 'americas'
  | 'europe'
  | 'asia'
  | 'africa'
  | 'middle-east'
  | 'oceania'

export const REGION_COUNTRY_CODES: Record<RegionCode, string[]> = {
  americas: ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'CU', 'VE', 'PE', 'EC', 'BO', 'PY', 'UY', 'GT', 'HN', 'NI', 'SV', 'CR', 'PA', 'DO', 'HT', 'JM', 'TT', 'BS'],
  europe: ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'GR', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'HR', 'SI', 'RS', 'BA', 'AL', 'MK', 'XK', 'ME', 'EE', 'LV', 'LT', 'RU', 'UA', 'BY', 'MD', 'IS', 'LU', 'CY', 'MT', 'AD', 'MC', 'LI', 'SM', 'VA'],
  asia: ['CN', 'IN', 'JP', 'KR', 'KP', 'TW', 'HK', 'MO', 'VN', 'TH', 'PH', 'ID', 'MY', 'SG', 'BD', 'PK', 'LK', 'NP', 'BT', 'MM', 'KH', 'LA', 'MN', 'KZ', 'UZ', 'TM', 'TJ', 'KG', 'AF', 'MV'],
  africa: ['ZA', 'NG', 'EG', 'KE', 'ET', 'GH', 'TZ', 'UG', 'ZW', 'ZM', 'AO', 'CM', 'SN', 'CI', 'ML', 'BF', 'NE', 'SD', 'SS', 'SO', 'ER', 'DJ', 'CD', 'CG', 'GA', 'GQ', 'CF', 'TD', 'RW', 'BI', 'MW', 'MZ', 'NA', 'BW', 'SZ', 'LS', 'MG', 'MU', 'SC', 'KM', 'CV', 'ST', 'GN', 'GW', 'SL', 'LR', 'BJ', 'TG', 'GM', 'MR', 'MA', 'DZ', 'TN', 'LY'],
  'middle-east': ['IL', 'PS', 'TR', 'IR', 'IQ', 'SY', 'LB', 'JO', 'SA', 'YE', 'OM', 'AE', 'QA', 'BH', 'KW'],
  oceania: ['AU', 'NZ', 'PG', 'FJ', 'SB', 'VU', 'NC', 'PF', 'WS', 'TO'],
}

export const REGIONS: { code: RegionCode; label: string }[] = [
  { code: 'americas', label: 'The Americas' },
  { code: 'europe', label: 'Europe' },
  { code: 'asia', label: 'Asia' },
  { code: 'africa', label: 'Africa' },
  { code: 'middle-east', label: 'Middle East' },
  { code: 'oceania', label: 'Oceania' },
]

export type SpinScope =
  | { type: 'all' }
  | { type: 'country'; code: string }
  | { type: 'region'; region: RegionCode }

export type DiscoverCandidate = {
  bookId: number
  slug: string
  title: string
  author: string
  coverUrl: string | null
  genres: string[]
  banCountries: string[]
  isIconic: boolean
  hasReadingClubGuide: boolean
  reasonBanCounts: Record<string, number>
}

export type FilterInput = {
  reasonSlugs: string[]
  genreSlugs: string[]
  scope: SpinScope
  excludeIconic: boolean
  withReadingClubGuide: boolean
}

export type ScoredCandidate = DiscoverCandidate & {
  matchedReasons: string[]
  score: number
}

export type SpinPicks = {
  primary: ScoredCandidate | null
  alternatives: ScoredCandidate[]
}

export function scopeToCountryCodes(scope: SpinScope): Set<string> | null {
  if (scope.type === 'all') return null
  if (scope.type === 'country') return new Set([scope.code])
  return new Set(REGION_COUNTRY_CODES[scope.region])
}

export function expandGenreFilter(slugs: string[]): Set<string> | null {
  if (slugs.length === 0) return null
  const out = new Set<string>()
  for (const slug of slugs) {
    out.add(slug)
    for (const a of GENRE_ALIASES[slug] ?? []) out.add(a)
  }
  return out
}

export function filterAndScore(
  pool: DiscoverCandidate[],
  filter: FilterInput,
): ScoredCandidate[] {
  const filterCountries = scopeToCountryCodes(filter.scope)
  const filterGenres = expandGenreFilter(filter.genreSlugs)
  const reasonSet = new Set(filter.reasonSlugs)
  const reasonsActive = reasonSet.size > 0

  const out: ScoredCandidate[] = []
  for (const c of pool) {
    if (filter.excludeIconic && c.isIconic) continue
    if (filter.withReadingClubGuide && !c.hasReadingClubGuide) continue

    if (filterCountries) {
      let countryMatch = false
      for (const code of c.banCountries) {
        if (filterCountries.has(code)) { countryMatch = true; break }
      }
      if (!countryMatch) continue
    }

    if (filterGenres) {
      let genreMatch = false
      for (const g of c.genres) {
        if (filterGenres.has(g)) { genreMatch = true; break }
      }
      if (!genreMatch) continue
    }

    const matched: string[] = []
    let maxBan = 0
    if (reasonsActive) {
      for (const [slug, n] of Object.entries(c.reasonBanCounts)) {
        if (reasonSet.has(slug)) {
          matched.push(slug)
          if (n > maxBan) maxBan = n
        }
      }
      if (matched.length === 0) continue
    } else {
      // No reason filter: use the strongest single-reason signal as the
      // book's intrinsic ban weight so the wheel still favours impact.
      for (const [, n] of Object.entries(c.reasonBanCounts)) {
        if (n > maxBan) maxBan = n
      }
    }

    const score = (matched.length || 1) * 1000 + maxBan
    out.push({ ...c, matchedReasons: matched, score })
  }

  out.sort((a, b) => b.score - a.score)
  return out
}

export function pickFromScored(
  scored: ScoredCandidate[],
  excludeIds: Set<number>,
): SpinPicks {
  const fresh = excludeIds.size > 0
    ? scored.filter(c => !excludeIds.has(c.bookId))
    : scored
  if (fresh.length === 0) return { primary: null, alternatives: [] }

  const pool = fresh.slice(0, Math.min(20, fresh.length))
  const primary = weightedPickByRank(pool)
  const alternatives = fresh.filter(c => c.bookId !== primary.bookId).slice(0, 2)
  return { primary, alternatives }
}

export function pickContext(pick: ScoredCandidate, reasonsActive: boolean): string {
  const countryCount = pick.banCountries.length
  const countryNote = countryCount === 1 ? '1 country' : `${countryCount} countries`
  if (reasonsActive && pick.matchedReasons.length > 0) {
    const labels = pick.matchedReasons.map(s => reasonLabel(s)).join(', ')
    return `Banned in ${countryNote} · ${labels}`
  }
  // Without reason filters, surface the dominant reason on the book itself.
  const dominant = Object.entries(pick.reasonBanCounts)
    .sort((a, b) => b[1] - a[1])[0]
  if (dominant) return `Banned in ${countryNote} · ${reasonLabel(dominant[0])}`
  return `Banned in ${countryNote}`
}

// Top-N covers from the filtered pool, used by the live preview strip.
export function previewCovers(scored: ScoredCandidate[], limit: number): ScoredCandidate[] {
  const seen = new Set<string>()
  const out: ScoredCandidate[] = []
  for (const c of scored) {
    if (!c.coverUrl) continue
    if (seen.has(c.coverUrl)) continue
    seen.add(c.coverUrl)
    out.push(c)
    if (out.length >= limit) break
  }
  return out
}

// Rank weights: index 0 gets weight N, last gets 1. Slot-machine feel
// without surfacing obvious mismatches.
function weightedPickByRank<T>(items: T[]): T {
  const total = (items.length * (items.length + 1)) / 2
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= items.length - i
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

// Re-export so the wizard can label genres + reasons without bouncing
// back to the component packages directly.
export { reasonLabel, genreLabel }
