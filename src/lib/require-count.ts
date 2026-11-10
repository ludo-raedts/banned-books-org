// A headline count must never render from a failed query. A Supabase error
// (statement timeout under load) leaves `count` null, and the old `?? 0`
// fallback let ISR cache "0 books" pages for the whole revalidate window
// (2026-11-10). Throwing instead keeps the last good page in the cache.
export function requireCount(res: { count: number | null; error?: unknown }, label: string): number {
  if (res.error) throw res.error
  if (res.count == null) throw new Error(`requireCount: no count for ${label}`)
  return res.count
}
