// Derive the Supabase project host from NEXT_PUBLIC_SUPABASE_URL so that
// mirrored author photos (uploaded to the `author-photos` bucket by
// enrich-author-photos-v2) can render through next/image. Wrapped in a
// try/catch so missing/malformed env doesn't blow up next.config.ts at
// build time.
const SUPABASE_STORAGE_HOST: string | null = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname }
  catch { return null }
})()

export const ALLOWED_IMAGE_HOSTS = [
  'covers.openlibrary.org',
  'upload.wikimedia.org',
  'books.google.com',
  'books.google.fr',
  'books.google.nl',
  'books.google.co.uk',
  'books.google.de',
  'lh3.googleusercontent.com',
  ...(SUPABASE_STORAGE_HOST ? [SUPABASE_STORAGE_HOST] : []),
]

// Single chokepoint for deciding whether an image URL is safe to either
// write into the DB (cover_url / photo_url) or pass to next/image. Returns
// true only for https URLs whose hostname is in ALLOWED_IMAGE_HOSTS — every
// other shape (http://, malformed, rogue hostname) is rejected because
// next/image throws server-side on hostnames outside next.config.ts
// remotePatterns, which 500s the whole page.
//
// All enrichment scripts and admin write-paths MUST gate writes through this
// helper. All render sites that pass a URL to next/image SHOULD null the URL
// through this helper as a defensive backstop (see AuthorAvatar for the
// canonical pattern).
export function isAllowedImageUrl(url: string | null | undefined): url is string {
  if (!url) return false
  let u: URL
  try { u = new URL(url) } catch { return false }
  if (u.protocol !== 'https:') return false
  return ALLOWED_IMAGE_HOSTS.includes(u.hostname.toLowerCase())
}
