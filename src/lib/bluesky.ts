// Minimal AT-protocol (Bluesky) client — just the three XRPC calls we need to
// publish a post with a link card: createSession (login), uploadBlob (cover
// thumbnail), createRecord (the post). No SDK; the API is a handful of JSON
// POSTs over HTTPS. Credentials come from BLUESKY_HANDLE + BLUESKY_APP_PASSWORD
// (an app-password, never the account's main password).

const PDS = 'https://bsky.social'

export type BlueskySession = { accessJwt: string; did: string; handle: string }

/** Blob ref as returned by uploadBlob and embedded in a record. */
export type BlobRef = unknown

/** A richtext facet — byte-range annotation that makes part of `text` a link. */
export type Facet = {
  index: { byteStart: number; byteEnd: number }
  features: Array<{ $type: 'app.bsky.richtext.facet#link'; uri: string }>
}

export type ExternalEmbed = {
  $type: 'app.bsky.embed.external'
  external: { uri: string; title: string; description: string; thumb?: BlobRef }
}

async function xrpc<T>(method: string, opts: { token?: string; body?: unknown; raw?: ArrayBuffer; contentType?: string }): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.token) headers['authorization'] = `Bearer ${opts.token}`
  let body: BodyInit | undefined
  if (opts.raw) {
    headers['content-type'] = opts.contentType ?? 'application/octet-stream'
    body = opts.raw
  } else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  const res = await fetch(`${PDS}/xrpc/${method}`, { method: 'POST', headers, body })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const j = json as { error?: string; message?: string }
    throw new Error(`${method} failed (${res.status}): ${j.error ?? ''} ${j.message ?? ''}`.trim())
  }
  return json as T
}

export async function createSession(identifier: string, password: string): Promise<BlueskySession> {
  const j = await xrpc<{ accessJwt: string; did: string; handle: string }>('com.atproto.server.createSession', {
    body: { identifier, password },
  })
  return { accessJwt: j.accessJwt, did: j.did, handle: j.handle }
}

/**
 * Upload an image as a blob so it can be used as a link-card thumbnail.
 * Bluesky caps image blobs at ~1 MB; returns null on oversize/failed fetch so
 * the caller can post a card without a thumb rather than fail the whole post.
 */
export async function uploadImageBlob(session: BlueskySession, imageUrl: string): Promise<BlobRef | null> {
  try {
    const img = await fetch(imageUrl)
    if (!img.ok) return null
    const mime = img.headers.get('content-type') ?? 'image/jpeg'
    if (!mime.startsWith('image/')) return null
    const bytes = await img.arrayBuffer()
    if (bytes.byteLength > 976_000) return null // Bluesky blob cap is ~1 MB
    const j = await xrpc<{ blob: BlobRef }>('com.atproto.repo.uploadBlob', {
      token: session.accessJwt,
      raw: bytes,
      contentType: mime,
    })
    return j.blob
  } catch {
    return null
  }
}

export async function createPost(
  session: BlueskySession,
  post: { text: string; createdAt: string; facets?: Facet[]; embed?: ExternalEmbed; langs?: string[] },
): Promise<{ uri: string; cid: string }> {
  const record: Record<string, unknown> = {
    $type: 'app.bsky.feed.post',
    text: post.text,
    createdAt: post.createdAt,
    langs: post.langs ?? ['en'],
  }
  if (post.facets?.length) record.facets = post.facets
  if (post.embed) record.embed = post.embed
  return xrpc<{ uri: string; cid: string }>('com.atproto.repo.createRecord', {
    token: session.accessJwt,
    body: { repo: session.did, collection: 'app.bsky.feed.post', record },
  })
}

/**
 * Latest post timestamp (ISO) on an account's feed, or null if none / on error.
 * Used as a same-day idempotency guard so a cron retry can't double-post.
 */
export async function latestPostCreatedAt(handle: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${PDS}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=1&filter=posts_no_replies`,
    )
    if (!res.ok) return null
    const j = (await res.json()) as { feed?: Array<{ post?: { record?: { createdAt?: string } } }> }
    return j.feed?.[0]?.post?.record?.createdAt ?? null
  } catch {
    return null
  }
}
