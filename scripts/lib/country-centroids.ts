/**
 * Country centroids for the animated-world-map film PoC.
 *
 * (a) PRESENTATION DATA, NOT DB SCHEMA.
 *     These coordinates are a rendering concern for the film project, deliberately
 *     kept out of the `countries` table. The DB stays the source of truth for ban
 *     events; the map layer owns where a country "sits" on screen. If the film repo
 *     ever needs more codes, extend this file — do not add lat/lng columns to the DB.
 *
 * (b) DEFUNCT / HISTORICAL STATES use the centroid of their OWN historical territory,
 *     never the successor state's:
 *       - SU (Soviet Union)   -> centre of the Soviet landmass, east of Moscow
 *                                (West Siberia), NOT the Russian Federation centroid.
 *       - DD (East Germany)   -> eastward, around the Berlin/Leipzig axis,
 *                                NOT the unified-Germany centroid.
 *       - VA (Holy See)       -> Vatican City / Rome. Carries the Index Librorum
 *                                Prohibitorum — the richest early-modern source.
 *
 * (c) KNOWN PITFALL — FR / 1940:
 *     The dataset holds 909 events under FR with year_started = 1940. These are the
 *     "Liste Otto": books banned by the GERMAN OCCUPIER in occupied France. They are
 *     Nazi victims, NOT French state censorship. The film must NOT render FR/1940 as a
 *     French-censorship spike — it would invert the historical meaning.
 *     For this PoC, FR events before 1945 are kept OUT of the France scene entirely.
 *
 * Coordinate convention: d3-geo / GeoJSON — [longitude, latitude], LONGITUDE FIRST.
 */

/** The eleven codes covered by the proof-of-concept. */
export const POC_COUNTRY_CODES = [
  'US',
  'FR',
  'DE',
  'DD',
  'VA',
  'ZA',
  'IR',
  'CN',
  'SU',
  'ES',
  'IT',
] as const

export type PocCountryCode = (typeof POC_COUNTRY_CODES)[number]

/**
 * [lng, lat] centroids. See header for the historical-territory rationale on
 * defunct states (SU, DD) and the Holy See (VA).
 */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  US: [-98.5, 39.5], // contiguous USA landmass centre (Kansas)
  FR: [2.5, 46.6], // metropolitan France
  DE: [10.4, 51.2], // unified Germany
  DD: [12.6, 52.0], // East Germany (DDR) — Berlin/Leipzig axis, east of unified-DE centroid
  VA: [12.45, 41.9], // Vatican City / Rome — seat of the Index Librorum Prohibitorum
  ZA: [24.5, -29.0], // South Africa
  IR: [53.7, 32.4], // Iran
  CN: [104.0, 35.5], // China
  SU: [80.0, 60.0], // Soviet Union — landmass centre, West Siberia, well east of Moscow
  ES: [-3.7, 40.3], // Spain (Iberian interior, Madrid latitude)
  IT: [12.5, 42.5], // Italy
}

/**
 * Look up a country's [lng, lat] centroid. Returns null for codes not in the PoC set.
 */
export function getCentroid(code: string): [number, number] | null {
  return COUNTRY_CENTROIDS[code] ?? null
}
