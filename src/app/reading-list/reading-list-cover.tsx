'use client'

import Image from 'next/image'
import { useState } from 'react'
import BookCoverPlaceholder from '@/components/book-cover-placeholder'

interface ReadingListCoverProps {
  isbn?: string
  title: string
  author: string
}

export default function ReadingListCover({ isbn, title, author }: ReadingListCoverProps) {
  const [failed, setFailed] = useState(false)
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  if (!isbn || failed) {
    return <BookCoverPlaceholder title={title} author={author} slug={slug} />
  }

  return (
    <Image
      src={`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`}
      alt={`Cover of ${title}`}
      width={128}
      height={192}
      className="w-full rounded object-cover aspect-[2/3]"
      onError={() => setFailed(true)}
      onLoad={(e) => {
        if ((e.currentTarget as HTMLImageElement).naturalWidth < 10) setFailed(true)
      }}
    />
  )
}
