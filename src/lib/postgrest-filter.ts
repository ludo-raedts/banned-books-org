// Safe building blocks for user-supplied text in PostgREST filters.
//
// supabase-js `.or('a.ilike.X,b.ilike.Y')` takes a raw filter string, so an
// unescaped `,` `(` `)` `.` in X splits or breaks the expression (or injects
// extra conditions on arbitrary columns). Values must be double-quoted inside
// `.or()`, and LIKE metacharacters must be escaped so `%`/`_` match literally.

/** `%q%` substring pattern with LIKE metacharacters (`\`, `%`, `_`) escaped. */
export function ilikeContains(q: string): string {
  return `%${q.replace(/[\\%_]/g, '\\$&')}%`
}

/** Quote a value for use inside a PostgREST `.or()` string. */
export function quoteOrValue(value: string): string {
  return `"${value.replace(/[\\"]/g, '\\$&')}"`
}

/**
 * Build an `.or()` string matching `q` as a substring in any of `columns`.
 * Safe for arbitrary user input.
 */
export function orIlikeContains(columns: readonly string[], q: string): string {
  const value = quoteOrValue(ilikeContains(q))
  return columns.map((c) => `${c}.ilike.${value}`).join(',')
}
