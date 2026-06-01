/**
 * Static US-state centroids for the film PoC (Option B: per-state spreading of the
 * PEN-Index data). Presentation data — NOT in the DB, no schema change.
 *
 * Convention: d3-geo / GeoJSON — [longitude, latitude], LONGITUDE FIRST (matches
 * scripts/lib/country-centroids.ts). Approximate geographic centroids; precise
 * enough to place a dot on the right state at country/continent zoom.
 *
 * NOTE on the `VA` collision: in COUNTRY space `VA` = Vatican; here in STATE space
 * `VA` = Virginia. They live in different lookups and the film distinguishes them
 * by country_code (US) vs the country-centroid table — no real clash.
 */

export const US_STATE_CENTROIDS: Record<string, [number, number]> = {
  AL: [-86.8, 32.8],
  AK: [-152.0, 64.0],
  AZ: [-111.7, 34.3],
  AR: [-92.4, 34.9],
  CA: [-119.7, 37.2],
  CO: [-105.5, 39.0],
  CT: [-72.7, 41.6],
  DE: [-75.5, 39.0],
  DC: [-77.0, 38.9],
  FL: [-81.7, 28.6],
  GA: [-83.4, 32.6],
  HI: [-157.5, 20.3],
  ID: [-114.6, 44.4],
  IL: [-89.2, 40.0],
  IN: [-86.3, 39.9],
  IA: [-93.5, 42.0],
  KS: [-98.4, 38.5],
  KY: [-85.3, 37.5],
  LA: [-92.0, 31.0],
  ME: [-69.2, 45.4],
  MD: [-76.8, 39.0],
  MA: [-71.8, 42.3],
  MI: [-85.4, 44.3],
  MN: [-94.3, 46.3],
  MS: [-89.7, 32.7],
  MO: [-92.5, 38.4],
  MT: [-109.6, 47.0],
  NE: [-99.8, 41.5],
  NV: [-116.6, 39.3],
  NH: [-71.6, 43.7],
  NJ: [-74.7, 40.1],
  NM: [-106.1, 34.4],
  NY: [-75.5, 42.9],
  NC: [-79.4, 35.5],
  ND: [-100.3, 47.4],
  OH: [-82.8, 40.2],
  OK: [-97.5, 35.6],
  OR: [-120.6, 43.9],
  PA: [-77.8, 40.9],
  RI: [-71.5, 41.7],
  SC: [-80.9, 33.9],
  SD: [-100.2, 44.4],
  TN: [-86.3, 35.8],
  TX: [-99.3, 31.5],
  UT: [-111.7, 39.3],
  VT: [-72.7, 44.1],
  VA: [-78.8, 37.5],
  WA: [-120.4, 47.4],
  WV: [-80.6, 38.6],
  WI: [-89.9, 44.6],
  WY: [-107.5, 43.0],
}

export const STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  'District of Columbia': 'DC',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
}

// The handful of city-only `region` values in the data whose state is unambiguous.
const CITY_TO_CODE: Record<string, string> = {
  Chicago: 'IL',
  'Los Angeles': 'CA',
}

/** [lng, lat] centroid for a 2-letter state code, or null if unknown. */
export function getStateCentroid(code: string): [number, number] | null {
  return US_STATE_CENTROIDS[code] ?? null
}

/**
 * Resolve a US `region` string to a 2-letter state code, or null if no state can
 * be determined. Handles: exact state name; "City, State" (state after the last
 * comma); a few known city-only names. Returns null for "Nation" (handled
 * separately as a national dot) and for un-attributable values.
 */
export function stateCodeFromRegion(region: string | null | undefined): string | null {
  if (!region) return null
  const r = region.trim()
  if (!r) return null
  if (r in STATE_NAME_TO_CODE) return STATE_NAME_TO_CODE[r]
  if (r in CITY_TO_CODE) return CITY_TO_CODE[r]
  if (r.includes(',')) {
    const last = r.split(',').pop()!.trim()
    if (last in STATE_NAME_TO_CODE) return STATE_NAME_TO_CODE[last]
  }
  return null
}
