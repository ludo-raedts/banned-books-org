/**
 * Retry a Supabase query on a transient Postgres error — chiefly 57014
 * ("canceling statement due to statement timeout").
 *
 * Heavy list pages (/banned-classics, /banned-childrens-books, …) read the DB
 * at build-time prerender. When a build coincides with a production load spike
 * (a crawler wave, or a concurrent enrichment run), the DB slows server-side
 * enough to trip the ~8s service_role statement_timeout — failing the whole
 * build even though the same query runs in well under a second when the DB is
 * quiet. Reads are idempotent, so retrying after a short backoff rides out the
 * spike (which passes in seconds).
 *
 * `run` must build the query fresh on each call (Supabase builders are one-shot
 * thenables): `withDbRetry(() => supabase.from('books').select(...))`.
 * The `{ data, error }` shape is preserved, so existing `if (error) throw`
 * handling still works once retries are exhausted.
 */
type PgError = { code?: string; message?: string } | null
type PgResult<T> = { data: T; error: PgError }

function isTransient(error: PgError): boolean {
  if (!error) return false
  if (error.code === '57014') return true
  const m = (error.message ?? '').toLowerCase()
  return m.includes('statement timeout') || m.includes('timeout') || m.includes('fetch failed')
}

export async function withDbRetry<T>(
  run: () => PromiseLike<PgResult<T>>,
  label = 'query',
  maxAttempts = 4,
): Promise<PgResult<T>> {
  for (let attempt = 1; ; attempt++) {
    const res = await run()
    if (!res.error || attempt >= maxAttempts || !isTransient(res.error)) return res
    // Exponential backoff (2s, 4s, 8s) to let the load spike pass.
    const waitMs = 1000 * 2 ** attempt
    console.warn(
      `  ⚠ ${label}: ${res.error.code ?? ''} ${res.error.message ?? ''} (attempt ${attempt}/${maxAttempts}); retrying in ${waitMs / 1000}s`,
    )
    await new Promise((r) => setTimeout(r, waitMs))
  }
}
