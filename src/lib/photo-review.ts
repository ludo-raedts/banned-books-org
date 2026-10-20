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
  decision?: ReviewDecision
  decided_at?: string
  new_photo_url?: string | null
}

export type ReviewFile = { generated_at: string; items: ReviewItem[] }

export async function readReview(): Promise<ReviewFile> {
  const { data, error } = await adminClient().storage.from(REVIEW_BUCKET).download(REVIEW_PATH)
  if (error || !data) return { generated_at: '', items: [] }
  try {
    return JSON.parse(await data.text()) as ReviewFile
  } catch {
    return { generated_at: '', items: [] }
  }
}

export async function writeReview(file: ReviewFile): Promise<void> {
  const sb = adminClient()
  const body = new Blob([JSON.stringify(file)], { type: 'application/json' })
  let { error } = await sb.storage.from(REVIEW_BUCKET).upload(REVIEW_PATH, body, { upsert: true, contentType: 'application/json' })
  if (error && /bucket not found/i.test(error.message)) {
    await sb.storage.createBucket(REVIEW_BUCKET, { public: false })
    ;({ error } = await sb.storage.from(REVIEW_BUCKET).upload(REVIEW_PATH, body, { upsert: true, contentType: 'application/json' }))
  }
  if (error) throw new Error(`photo-review upload: ${error.message}`)
}

/** Photo URLs a human already approved: the audit skips these. */
export function approvedPhotoUrls(file: ReviewFile): Set<string> {
  return new Set(file.items.filter(i => i.decision === 'ok').map(i => i.photo_url))
}
