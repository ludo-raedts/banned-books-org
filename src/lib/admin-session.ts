// Signed admin-session token.
//
// The `admin_session` cookie used to hold the raw ADMIN_SECRET, so a leaked
// cookie revealed the master password and sessions could only be revoked by
// rotating the secret. Instead the cookie now holds an HMAC-signed expiry
// stamp: `<exp>.<sig>` where `sig = HMAC-SHA256(exp, ADMIN_SECRET)`. The secret
// never leaves the server, tokens expire on their own, and a stolen cookie is
// worthless once expired.
//
// Uses Web Crypto (globalThis.crypto.subtle) so the exact same code runs in the
// Edge middleware and in Node route handlers — no `node:crypto` import.

export const SESSION_COOKIE = 'admin_session'

// 24h — keep in sync with the cookie's maxAge in the login route.
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000

const encoder = new TextEncoder()

function base64url(bytes: ArrayBuffer): string {
  let bin = ''
  const arr = new Uint8Array(bytes)
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return base64url(sig)
}

// Length-independent comparison to avoid leaking the signature via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

/** Constant-time string compare for the login password check. */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(a, b)
}

/** Mint a fresh signed session token valid for SESSION_TTL_MS from now. */
export async function createSessionToken(secret: string): Promise<string> {
  const exp = String(Date.now() + SESSION_TTL_MS)
  const sig = await hmac(secret, exp)
  return `${exp}.${sig}`
}

/** True iff `token` is a well-formed, unexpired token signed by `secret`. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!token || !secret) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const exp = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expNum = Number(exp)
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false
  const expected = await hmac(secret, exp)
  return timingSafeEqual(sig, expected)
}
