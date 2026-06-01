/**
 * Country centroids for the animated-world-map film.
 *
 * (a) PRESENTATION DATA, NOT DB SCHEMA.
 *     These coordinates are a rendering concern for the film project, deliberately
 *     kept out of the `countries` table. The DB stays the source of truth for ban
 *     events; the map layer owns where a country "sits" on screen.
 *
 * (b) COVERAGE. Two needs, one table:
 *       - CHAPTER countries (the content scenes): US, FR, DE, DD, VA, ZA, IR, CN, SU,
 *         ES, IT, AR, BY, MY, SA.
 *       - SLOT-MAP countries: every country with bans since 2000 (the 76 from the
 *         threshold survey). US states live in scripts/lib/us-state-centroids.ts.
 *     Values are approximate geographic centroids (good enough to place a dot on the
 *     right country at world zoom).
 *
 * (c) DEFUNCT / HISTORICAL STATES use the centroid of their OWN historical territory,
 *     never the successor state's:
 *       - SU (Soviet Union) -> centre of the Soviet landmass, east of Moscow (West
 *         Siberia), NOT the Russian Federation centroid.
 *       - DD (East Germany) -> eastward, Berlin/Leipzig axis, NOT unified-DE.
 *       - VA (Holy See)     -> Vatican City / Rome (Index Librorum Prohibitorum).
 *
 * (d) KNOWN PITFALL — FR / 1940: 909 FR events with year_started = 1940 are the
 *     "Liste Otto" (books banned by the German OCCUPIER in occupied France — Nazi
 *     victims, not French state censorship). FR events before 1945 are kept OUT of
 *     the France scene; never render FR/1940 as a French-censorship spike.
 *
 * Coordinate convention: d3-geo / GeoJSON — [longitude, latitude], LONGITUDE FIRST.
 */

/** Countries that appear in the content chapters (the pulse-events layer filters on these). */
export const CHAPTER_COUNTRY_CODES = [
  'US', 'FR', 'DE', 'DD', 'VA', 'ZA', 'IR', 'CN', 'SU', 'ES', 'IT',
  'AR', 'BY', 'MY', 'SA',
] as const

export type ChapterCountryCode = (typeof CHAPTER_COUNTRY_CODES)[number]

/**
 * [lng, lat] centroids. Covers the chapter countries + every country with bans since
 * 2000 (slot map). See header for the historical-territory rationale on SU/DD/VA.
 */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  // ── Chapter countries (existing PoC values kept exactly) ──────────────────
  US: [-98.5, 39.5], // contiguous USA landmass centre (Kansas)
  FR: [2.5, 46.6], // metropolitan France
  DE: [10.4, 51.2], // unified Germany
  DD: [12.6, 52.0], // East Germany (DDR) — Berlin/Leipzig axis (defunct: historical territory)
  VA: [12.45, 41.9], // Vatican City / Rome — Index Librorum Prohibitorum
  ZA: [24.5, -29.0], // South Africa (apartheid-era; no since-2000 bans in data)
  IR: [53.7, 32.4], // Iran
  CN: [104.0, 35.5], // China
  SU: [80.0, 60.0], // Soviet Union — landmass centre, West Siberia (defunct: historical territory)
  ES: [-3.7, 40.3], // Spain
  IT: [12.5, 42.5], // Italy
  AR: [-64.0, -36.0], // Argentina (junta era)
  BY: [28.0, 53.5], // Belarus
  MY: [109.7, 3.8], // Malaysia (peninsula + Borneo)
  SA: [45.0, 24.0], // Saudi Arabia

  // ── Additional countries with bans since 2000 (slot map) ──────────────────
  AE: [54.0, 24.0], // United Arab Emirates
  AF: [66.0, 33.8], // Afghanistan
  AO: [17.5, -12.3], // Angola
  AU: [134.0, -25.6], // Australia
  AZ: [47.6, 40.3], // Azerbaijan
  BD: [90.3, 23.7], // Bangladesh
  BE: [4.6, 50.6], // Belgium
  BH: [50.55, 26.05], // Bahrain
  BR: [-51.9, -10.8], // Brazil
  CA: [-106.0, 56.0], // Canada
  CU: [-79.0, 21.7], // Cuba
  CY: [33.2, 35.1], // Cyprus
  DZ: [2.6, 28.2], // Algeria
  EC: [-78.5, -1.4], // Ecuador
  EE: [25.8, 58.6], // Estonia
  EG: [29.9, 26.8], // Egypt
  ER: [39.0, 15.4], // Eritrea
  GB: [-1.8, 52.9], // United Kingdom
  GR: [22.0, 39.3], // Greece
  HK: [114.15, 22.35], // Hong Kong
  HU: [19.4, 47.2], // Hungary
  ID: [117.0, -2.5], // Indonesia
  IE: [-8.1, 53.2], // Ireland
  IL: [35.0, 31.3], // Israel
  IN: [79.0, 22.5], // India
  JO: [36.5, 31.0], // Jordan
  JP: [138.0, 37.5], // Japan
  KG: [74.5, 41.3], // Kyrgyzstan
  KP: [127.5, 40.3], // North Korea
  KR: [127.8, 36.5], // South Korea
  KW: [47.6, 29.3], // Kuwait
  KZ: [67.0, 48.0], // Kazakhstan
  LB: [35.9, 33.9], // Lebanon
  LK: [80.7, 7.9], // Sri Lanka
  LT: [23.9, 55.2], // Lithuania
  LY: [18.0, 27.0], // Libya
  MA: [-6.5, 31.8], // Morocco
  MM: [96.0, 21.0], // Myanmar
  MV: [73.4, 3.7], // Maldives
  MX: [-102.5, 23.6], // Mexico
  NG: [8.1, 9.6], // Nigeria
  NI: [-85.2, 12.9], // Nicaragua
  NL: [5.6, 52.2], // Netherlands
  NZ: [172.5, -41.5], // New Zealand
  OM: [56.0, 21.0], // Oman
  PE: [-75.0, -9.2], // Peru
  PH: [122.0, 12.0], // Philippines
  PK: [69.3, 30.0], // Pakistan
  PS: [35.25, 31.9], // Palestine
  QA: [51.2, 25.3], // Qatar
  RS: [20.8, 44.0], // Serbia
  RU: [96.0, 61.5], // Russia (landmass centre, Siberia)
  SD: [30.0, 16.0], // Sudan
  SE: [16.0, 62.5], // Sweden
  SG: [103.8, 1.35], // Singapore
  SY: [38.5, 35.0], // Syria
  TH: [101.0, 15.0], // Thailand
  TJ: [71.0, 38.5], // Tajikistan
  TN: [9.6, 34.0], // Tunisia (country code; note: as a US-state code TN = Tennessee, separate lookup)
  TR: [35.2, 39.0], // Turkey
  TZ: [34.8, -6.4], // Tanzania
  UA: [31.2, 49.0], // Ukraine
  UG: [32.4, 1.4], // Uganda
  UZ: [63.5, 41.7], // Uzbekistan
  VE: [-66.5, 7.1], // Venezuela
  VN: [106.0, 16.2], // Vietnam
  YE: [47.6, 15.6], // Yemen
  ZW: [29.8, -19.0], // Zimbabwe
}

/** Look up a country's [lng, lat] centroid. Returns null for unknown codes. */
export function getCentroid(code: string): [number, number] | null {
  return COUNTRY_CENTROIDS[code] ?? null
}
