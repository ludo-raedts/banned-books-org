'use client'

import { useState, type MouseEvent } from 'react'

type Props = {
  text: string
  label: string
}

export default function CitationCopyButton({ text, label }: Props) {
  const [copied, setCopied] = useState(false)

  async function onClick(e: MouseEvent<HTMLButtonElement>) {
    // Button lives inside <summary>; without these the click toggles <details>.
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard blocked — leave UI quiet
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Copy ${label} citation to clipboard`}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
