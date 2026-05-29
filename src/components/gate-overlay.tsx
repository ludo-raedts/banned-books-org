'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Bucket B interstitial (CSAM-adjacent policy §5a). Opaque, full-page, rendered
// on top of the record until the reader actively continues. No localStorage /
// sessionStorage by design: the choice is React state only, so a reload brings
// the overlay back. Copy is medium-neutral — it covers both a photographic work
// (Show Me) and a text work (The Raped Little Runaway), so it avoids the
// image-specific wording of the policy's reference text.
export default function GateOverlay({ country }: { country: string | null }) {
  const [revealed, setRevealed] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (revealed) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [revealed])

  if (revealed) return null

  const classified = country
    ? `This work has been classified as child pornography in ${country}.`
    : 'This work has been classified as child pornography in at least one jurisdiction.'

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
    >
      <div className="max-w-2xl mx-auto px-5 py-16 sm:py-24">
        <h1
          id="gate-title"
          className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 mb-6"
        >
          This page documents a censored work.
        </h1>
        <div className="space-y-4 text-[15px] leading-relaxed text-gray-700">
          <p>
            {classified} It is included here because its censorship is a documented
            and genuinely contested case, sitting at the boundary of our inclusion
            criterion.
          </p>
          <p>
            We document this censorship case. We do not reproduce the work&rsquo;s
            contents, we provide no way to obtain it, and we take no position on
            whether it should be available. Our inclusion criterion documents
            restrictions where the contested harm concerns the reader, author, or
            community; we exclude material where the harm is intrinsic to the work
            and directed at those who cannot protect themselves. This case sits at
            that boundary, which is why it carries this notice.
          </p>
        </div>
        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="px-5 py-3 rounded-lg bg-oxblood text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Continue to the censorship record
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Leave this page
          </button>
        </div>
      </div>
    </div>
  )
}
