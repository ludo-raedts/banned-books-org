'use client'

import { useState } from 'react'

type Props = {
  text: string
  label: string
  className?: string
}

export default function CopyButton({ text, label, className }: Props) {
  const [copied, setCopied] = useState(false)

  async function onClick() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
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
        aria-label={`Copy ${label} to clipboard`}
        className={
          className ??
          'inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors'
        }
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      {/* The static aria-label above masks the "Copied" text swap from screen
          readers, so announce success through a polite live region instead. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? `${label} copied to clipboard` : ''}
      </span>
    </>
  )
}
