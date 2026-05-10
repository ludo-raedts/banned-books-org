// ISO-3166 → emoji flag. Falls back to a neutral flag for historical / unrecognised
// country codes that don't map to a regional indicator pair (Soviet Union,
// Czechoslovakia, East Germany, Yugoslavia).
const FLAGLESS = new Set(['SU', 'CS', 'DD', 'YU'])

export function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🚩'
  const upper = code.toUpperCase()
  if (FLAGLESS.has(upper)) return '🚩'
  return [...upper]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}
