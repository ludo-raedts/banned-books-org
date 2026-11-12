/** Years before 1000 read oddly bare ("from 8 to 2025"): 8 → "8 AD". */
export function formatYear(y: number): string {
  return y < 1000 ? `${y} AD` : String(y)
}
