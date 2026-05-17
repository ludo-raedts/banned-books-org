'use client'

// Round author avatar with a robust onError fallback.
//
// Why this exists: the `/most-banned-authors` destination renders 50
// <Image>'s in one shot. Each one goes through the Next.js image
// optimizer, which then proxies upload.wikimedia.org / openlibrary.
// Under that parallel load Wikipedia returns HTTP 429 for a chunk of
// the batch, and the unstyled <img> falls through to its alt text on
// screen ("Photo of <name>"). Server-rendered components can't catch
// that — only a client component can use onError. So this thin client
// shell wraps the avatar: if the Image fails to load (any reason —
// 429, broken URL, blocked host, network) it swaps to the initials
// circle. Looks identical to the no-photo path.

import Image from 'next/image'
import { useState } from 'react'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function AuthorAvatar({
  name,
  photoUrl,
  className,
  initialsClassName,
  sizes = '80px',
}: {
  name: string
  photoUrl: string | null
  // Pass through the round-mask classes (size, shadow, etc.). The
  // component is intentionally style-agnostic so it matches whatever
  // surface it lives on (homepage strip, listing card, detail hero).
  className: string
  initialsClassName: string
  sizes?: string
}) {
  const [failed, setFailed] = useState(false)

  if (photoUrl && !failed) {
    return (
      <Image
        src={photoUrl}
        alt={`Photo of ${name}`}
        width={96}
        height={96}
        className={className}
        sizes={sizes}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <div className={initialsClassName}>{initials(name)}</div>
  )
}
