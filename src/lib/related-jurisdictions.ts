// States that share a history but are catalogued as separate jurisdictions
// (a ban is filed under the state that issued it). The country page uses this
// to point a reader of /countries/de at /countries/dd and back — without it
// nothing on the Germany page says the Soviet zone / GDR bans live elsewhere.
//
// Only pairs where BOTH codes exist in `countries`. `note` describes the
// TARGET jurisdiction, as shown on the page that links to it.

export type RelatedJurisdiction = { code: string; note: string }

const DD = { code: 'DD', note: 'Bans in the Soviet occupation zone and the GDR (1945–1990) are filed under East Germany, not on this page.' }
const DE = { code: 'DE', note: 'Bans by the German states before 1945, Nazi Germany and the Federal Republic are filed under Germany.' }
const SU = { code: 'SU', note: 'Bans by the Soviet state (1922–1991) are filed under the Soviet Union, not on this page.' }
const RU = { code: 'RU', note: 'Bans by the Russian Empire and the Russian Federation are filed under Russia.' }
const CS = { code: 'CS', note: 'Bans by Czechoslovakia (1918–1992) are filed under Czechoslovakia, not on this page.' }
const CZ = { code: 'CZ', note: 'Bans by the Czech Republic (since 1993) are filed under the Czech Republic.' }

const RELATED: Record<string, RelatedJurisdiction[]> = {
  DE: [DD],
  DD: [DE],
  RU: [SU],
  SU: [RU],
  CZ: [CS],
  CS: [CZ],
}

export function relatedJurisdictions(code: string): RelatedJurisdiction[] {
  return RELATED[code.toUpperCase()] ?? []
}
