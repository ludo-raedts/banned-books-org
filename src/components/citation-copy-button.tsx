'use client'

import { useState, type MouseEvent } from 'react'

type Props = {
  // A function is resolved at click time, so date-stamped citations carry
  // the actual access date instead of the ISR render date.
  text: string | (() => string)
  label: string
  // Visible button text; defaults to "Copy".
  children?: string
  onCopy?: () => void
}

export default function CitationCopyButton({ text, label, children = 'Copy', onCopy }: Props) {
  const [copied, setCopied] = useState(false)

  async function onClick(e: MouseEvent<HTMLButtonElement>) {
    // Button lives inside <summary>; without these the click toggles <details>.
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(typeof text === 'function' ? text() : text)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard blocked — leave UI quiet
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Copy ${label} citation to clipboard`}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors"
      >
        {copied ? 'Copied!' : children}
      </button>
      {/* The static aria-label masks the "Copied!" text swap from screen
          readers, so announce success through a polite live region instead. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? `${label} citation copied to clipboard` : ''}
      </span>
    </>
  )
}
