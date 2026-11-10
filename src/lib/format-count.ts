/** 32,279 → "32,000": for prose, where the exact figure would read as false precision. */
export function roundedThousands(n: number): string {
  if (n < 1000) return n.toLocaleString('en-US')
  return (Math.floor(n / 1000) * 1000).toLocaleString('en-US')
}
