'use client'

// Small book cover with an onError fallback — the cover counterpart of
// author-avatar.tsx. "Show 250 more" on /banned-books/[year] requests dozens of
// never-optimized covers at once; under that burst some optimizer fetches from
// covers.openlibrary.org fail and the <img> fell back to its alt text
// ("Cove…") on screen. Any load failure now swaps to the generated placeholder
// that books without a cover already get.

import Image from 'next/image'
import { useState } from 'react'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'
import { isAllowedImageUrl } from '@/lib/allowed-image-hosts'

export default function CoverThumb({
  title,
  slug,
  coverUrl,
  alt,
  width,
  height,
  sizes,
}: {
  title: string
  slug: string
  coverUrl: string | null
  alt: string
  width: number
  height: number
  sizes: string
}) {
  const [failed, setFailed] = useState(false)
  if (!failed && isAllowedImageUrl(coverUrl)) {
    return (
      <Image
        src={coverUrl}
        alt={alt}
        width={width}
        height={height}
        className="w-full h-full object-cover"
        sizes={sizes}
        onError={() => setFailed(true)}
      />
    )
  }
  return <BookCoverPlaceholder title={title} slug={slug} className="h-full" />
}
