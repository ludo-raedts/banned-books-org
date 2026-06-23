'use client'

// Client-side share + embed tooling for the /share hub. Two exports:
//  - ShareRow: one-tap share to Bluesky / X / LinkedIn / email, plus copy-link
//    and (mobile) the native share sheet.
//  - EmbedSnippets: copy-paste <iframe> and image-badge snippets so anyone can
//    drop the live "book of the day" onto their own site / README / newsletter.

import { useEffect, useState } from 'react'

function useCopied() {
  const [copied, setCopied] = useState<string | null>(null)
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(c => (c === key ? null : c)), 2000)
    } catch {
      /* insecure context / denied — fail quietly */
    }
  }
  return { copied, copy }
}

const linkClass =
  'inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-oxblood transition-colors'

export function ShareRow({ url, text }: { url: string; text: string }) {
  const { copied, copy } = useCopied()
  const [canNativeShare, setCanNativeShare] = useState(false)
  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  const bsky = `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text}\n${url}`)}`
  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
  const mail = `mailto:?subject=${encodeURIComponent('Banned book of the day')}&body=${encodeURIComponent(`${text}\n\n${url}`)}`

  async function nativeShare() {
    try {
      await navigator.share({ title: 'Banned book of the day', text, url })
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <a href={bsky} target="_blank" rel="noopener noreferrer" className={linkClass} aria-label="Share on Bluesky">
        <svg width="15" height="15" viewBox="0 0 600 530" fill="currentColor" aria-hidden="true">
          <path d="M135.72 44.03C202.216 93.951 273.74 195.17 300 249.49c26.262-54.316 97.782-155.54 164.28-205.46C512.26 8.009 590-19.862 590 68.825c0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.38-3.69-10.832-3.708-7.896-.017-2.936-1.193.516-3.707 7.896-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.449-163.25-81.433C20.15 217.613 9.997 86.535 9.997 68.825c0-88.687 77.742-60.816 125.72-24.795z" />
        </svg>
        Bluesky
      </a>
      <a href={x} target="_blank" rel="noopener noreferrer" className={linkClass} aria-label="Share on X">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        X
      </a>
      <a href={linkedin} target="_blank" rel="noopener noreferrer" className={linkClass} aria-label="Share on LinkedIn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
        </svg>
        LinkedIn
      </a>
      <a href={mail} className={linkClass} aria-label="Share by email">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" />
        </svg>
        Email
      </a>
      {canNativeShare && (
        <button onClick={nativeShare} className={linkClass} aria-label="Share via your device">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </button>
      )}
      <button onClick={() => copy('link', url)} className={linkClass} aria-label="Copy link">
        {copied === 'link' ? (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            Copied
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            Copy link
          </>
        )}
      </button>
    </div>
  )
}

function SnippetBox({ label, code, copied, onCopy }: { label: string; code: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
        <button onClick={onCopy} className="text-xs text-oxblood hover:underline font-medium">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded-md p-3 overflow-x-auto text-neutral-700 whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  )
}

export function EmbedSnippets({ iframe, badge }: { iframe: string; badge: string }) {
  const { copied, copy } = useCopied()
  return (
    <div className="space-y-4">
      <SnippetBox label="Embed (iframe)" code={iframe} copied={copied === 'iframe'} onCopy={() => copy('iframe', iframe)} />
      <SnippetBox label="Image badge (Markdown)" code={badge} copied={copied === 'badge'} onCopy={() => copy('badge', badge)} />
    </div>
  )
}
