// Author photo review queue, kept as one JSON file in a PRIVATE storage bucket
// (no schema change: the queue is admin-only working data, rebuilt from the
// vision audit by scripts/publish-photo-review-queue.ts).
//
// Flow: audit-author-photos-vision.ts → publish-photo-review-queue.ts uploads
// the doubtful verdicts (era_mismatch, unsure, art-like not_a_person,
// unreadable) → /admin/authors/photo-review shows them with Good / Wrong /
// Replace → /api/admin/photo-review writes the decision back here and applies
// it to authors.photo_url. A "good" decision is remembered per photo URL, so
// the next audit run does not re-queue the same photo.
import { adminClient } from './supabase'

export const REVIEW_BUCKET = 'admin-data'
export const REVIEW_PATH = 'photo-review.json'

export type ReviewDecision = 'ok' | 'wrong' | 'replaced'

export type ReviewItem = {
  author_id: number
  slug: string
  name: string
  birth_year: number | null
  death_year: number | null
  photo_url: string
  verdict: string
  reasoning: string
  /** hint from audit-author-identity.ts, e.g. a file name naming someone else */
  identity_note?: string
  decision?: ReviewDecision
  decided_at?: string
  new_photo_url?: string | null
}

export type ReviewFile = { generated_at: string; items: ReviewItem[] }

// Read the queue UNCACHED. supabase-js download() went through Storage's CDN
// and Next's fetch cache, and uploads default to cache-control 3600, so the
// admin page (and every Good/Wrong POST) read copies up to an hour old. Each
// click then wrote its decision onto that stale copy, wiping earlier decisions
// (2026-10-20: approved photos kept coming back).
export async function readReview(): Promise<ReviewFile> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) throw new Error('photo-review: Supabase env missing')
  const res = await fetch(
    `${base}/storage/v1/object/authenticated/${REVIEW_BUCKET}/${REVIEW_PATH}?ts=${Date.now()}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' },
  )
  // Not created yet → empty queue. Any OTHER failure must throw: returning an
  // empty queue here would let the next write wipe every decision.
  if (res.status === 404 || res.status === 400) {
    const body = await res.text()
    if (/not.?found/i.test(body)) return { generated_at: '', items: [] }
    throw new Error(`photo-review read: HTTP ${res.status} ${body.slice(0, 120)}`)
  }
  if (!res.ok) throw new Error(`photo-review read: HTTP ${res.status}`)
  return (await res.json()) as ReviewFile
}

export async function writeReview(file: ReviewFile): Promise<void> {
  const sb = adminClient()
  const body = new Blob([JSON.stringify(file)], { type: 'application/json' })
  let { error } = await sb.storage.from(REVIEW_BUCKET).upload(REVIEW_PATH, body, { upsert: true, contentType: 'application/json', cacheControl: '0' })
  if (error && /bucket not found/i.test(error.message)) {
    await sb.storage.createBucket(REVIEW_BUCKET, { public: false })
    ;({ error } = await sb.storage.from(REVIEW_BUCKET).upload(REVIEW_PATH, body, { upsert: true, contentType: 'application/json', cacheControl: '0' }))
  }
  if (error) throw new Error(`photo-review upload: ${error.message}`)
}

/** Photo URLs a human already approved: the audit skips these. */
export function approvedPhotoUrls(file: ReviewFile): Set<string> {
  return new Set(file.items.filter(i => i.decision === 'ok').map(i => i.photo_url))
}
