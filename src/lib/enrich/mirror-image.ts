// Download a remote image and re-upload it to the `author-photos` Supabase
// Storage bucket, keyed by author slug. Used by enrichAuthorPhotos when the
// matched source URL is on a host outside ALLOWED_IMAGE_HOSTS (Squarespace,
// Jetpack, individual author personal CDNs). The resulting public Storage
// URL is on our own Supabase host — single allowlist entry, immune to
// upstream link-rot, and our copy persists even if the source site goes
// away.
//
// Wikidata (Wikimedia Commons) and OpenLibrary URLs are NOT mirrored — they
// already render fine, are CC-licensed at the source, and we preserve their
// implicit attribution-via-URL by storing the originals. Only the mirror
// target is for hosts we can't render directly.

import type { SupabaseClient } from '@supabase/supabase-js'

// Filter out trackers, transparent pixels, and obvious placeholder graphics
// — anything under 5 KB. The lower bound was picked from a sample of real
// Wikimedia thumbnails: those are 10-40 KB minimum, so 5 KB is safely below
// the real-portrait floor.
const MIN_BYTES = 5 * 1024
// Match the bucket cap (file_size_limit = 5 MB).
const MAX_BYTES = 5 * 1024 * 1024

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const BUCKET = 'author-photos'

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/pjpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
}

export type MirrorResult =
  | { ok: true;  publicUrl: string; bytes: number; contentType: string }
  | { ok: false; reason: string }

export async function mirrorImageToStorage(
  supabase: SupabaseClient,
  sourceUrl: string,
  slug: string,
): Promise<MirrorResult> {
  let res: Response
  try {
    res = await fetch(sourceUrl, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'image/*' },
      redirect: 'follow',
    })
  } catch (e) {
    return { ok: false, reason: `fetch failed: ${e instanceof Error ? e.message : 'unknown'}` }
  }
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }

  const contentType = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
  const ext = EXT_BY_MIME[contentType]
  if (!ext) return { ok: false, reason: `unsupported content-type=${contentType || 'unknown'}` }

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < MIN_BYTES) return { ok: false, reason: `too small (${buf.length}B)` }
  if (buf.length > MAX_BYTES) return { ok: false, reason: `too large (${buf.length}B)` }

  // Sanity-check the buffer's magic bytes match the claimed content-type so
  // a server lying about the MIME (Jetpack sometimes serves `image/jpeg` for
  // an HTML error page) can't poison the bucket.
  if (!magicBytesMatch(buf, ext)) {
    return { ok: false, reason: `magic-byte mismatch for ${ext}` }
  }

  const path = `${slug}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType,
    upsert: true,
    cacheControl: '31536000',
  })
  if (error) return { ok: false, reason: `upload failed: ${error.message}` }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { ok: true, publicUrl: data.publicUrl, bytes: buf.length, contentType }
}

function magicBytesMatch(buf: Buffer, ext: string): boolean {
  if (buf.length < 12) return false
  // JPEG: starts with FF D8 FF
  if (ext === 'jpg') return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (ext === 'png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47
  // WEBP: starts with RIFF .... WEBP
  if (ext === 'webp') return buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP'
  // GIF: GIF87a or GIF89a
  if (ext === 'gif') {
    const head = buf.slice(0, 6).toString('ascii')
    return head === 'GIF87a' || head === 'GIF89a'
  }
  return false
}
