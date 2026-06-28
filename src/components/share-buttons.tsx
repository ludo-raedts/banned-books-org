'use client'

import { useEffect, useState } from 'react'

interface ShareButtonsProps {
  url: string
  title: string
  /** Total number of ban events for this book (typically per-district granular).
   *  Omit on non-book pages (e.g. essays) and pass `text` instead. */
  banCount?: number
  /** Distinct countries those bans span. May be 1 even when banCount is large
   *  (e.g. 116 US school-district bans across 1 country). */
  countryCount?: number
  /** Pre-composed share text. When given, it overrides the book-count sentence —
   *  used by pages that aren't books, like essays. */
  text?: string
}

export default function ShareButtons({ url, title, banCount, countryCount, text: textOverride }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)
  // Native share is only offered when the platform supports it (mostly mobile).
  // Detected after mount to avoid a hydration mismatch with the server render.
  const [canNativeShare, setCanNativeShare] = useState(false)

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  // When banCount > countryCount we surface both numbers; otherwise the
  // simpler "is banned in N countries" is accurate (1 event = 1 country).
  const countryNoun = countryCount === 1 ? 'country' : 'countries'
  const text = textOverride ?? (
    (banCount ?? 0) > (countryCount ?? 0)
      ? `"${title}" has been banned ${banCount} times across ${countryCount} ${countryNoun}`
      : `"${title}" is banned in ${countryCount} ${countryNoun}`
  )
  const bskyHref = `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text}\n${url}`)}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard write can reject (insecure context, denied permission).
      // Fail quietly rather than throwing an unhandled rejection.
    }
  }

  async function handleNativeShare() {
    try {
      await navigator.share({ title, text, url })
    } catch {
      // User cancelled the share sheet, or the call was rejected. Ignore.
    }
  }

  const linkClass = 'inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors'

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <a href={bskyHref} target="_blank" rel="noopener noreferrer" aria-label="Share on Bluesky" className={linkClass}>
        <svg width="13" height="13" viewBox="0 0 600 530" fill="currentColor" aria-hidden="true">
          <path d="M135.72 44.03C202.216 93.951 273.74 195.17 300 249.49c26.262-54.316 97.782-155.54 164.28-205.46C512.26 8.009 590-19.862 590 68.825c0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.38-3.69-10.832-3.708-7.896-.017-2.936-1.193.516-3.707 7.896-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.449-163.25-81.433C20.15 217.613 9.997 86.535 9.997 68.825c0-88.687 77.742-60.816 125.72-24.795z"/>
        </svg>
        Bluesky
      </a>
      {canNativeShare && (
        <button onClick={handleNativeShare} aria-label="Share via your device" className={linkClass}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share
        </button>
      )}
      <button onClick={handleCopy} aria-label="Copy link to this page" className={linkClass}>
        {copied ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Copied
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy link
          </>
        )}
      </button>
    </div>
  )
}
