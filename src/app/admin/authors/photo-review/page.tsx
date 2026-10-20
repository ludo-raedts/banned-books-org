import PhotoReviewClient from './photo-review-client'

export const dynamic = 'force-dynamic'

// Human review of the author photos the vision audit could not settle
// (era_mismatch / unsure / art-like not_a_person / unreadable). Queue lives in
// storage, see src/lib/photo-review.ts.
export default function PhotoReviewPage() {
  return <PhotoReviewClient />
}
