// One fetch helper for every admin API call: always sends credentials, always
// checks res.ok, and extracts the route's { error } message. Before this, 9 of
// 29 call sites forgot credentials and two treated a 500 as success.

export async function adminFetch<T = Record<string, unknown>>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {}
  const res = await fetch(url, {
    credentials: 'include',
    ...rest,
    ...(json !== undefined
      ? { headers: { 'Content-Type': 'application/json', ...rest.headers }, body: JSON.stringify(json) }
      : {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return data as T
}
