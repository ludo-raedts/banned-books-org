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

// A monospace value with an inline copy button — used for the Slack command and
// the raw feed URL on the per-platform subscribe cards.
function CopyField({ value }: { value: string }) {
  const { copied, copy } = useCopied()
  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 min-w-0 text-xs bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 text-neutral-700 overflow-x-auto whitespace-nowrap">
        {value}
      </code>
      <button
        onClick={() => copy(value, value)}
        className="shrink-0 text-xs font-medium text-oxblood hover:underline px-1"
        aria-label="Copy to clipboard"
      >
        {copied === value ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function PlatformCard({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="border border-neutral-200 rounded-lg p-4 flex flex-col gap-2.5">
      <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
      {children}
    </div>
  )
}

const helpLink = 'text-xs font-medium text-oxblood hover:underline mt-auto'

// Per-platform self-serve subscribe cards. The feed itself does all the work;
// each card is just the one paste-this step that platform needs. No accounts,
// no webhooks stored by us — the platforms poll the feed.
export function FeedSubscribe({ feedUrl }: { feedUrl: string }) {
  const slackCmd = `/feed subscribe ${feedUrl}`
  const feedly = `https://feedly.com/i/subscription/feed/${encodeURIComponent(feedUrl)}`

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <PlatformCard name="Slack">
          <p className="text-xs text-neutral-600 leading-relaxed">
            In any channel, paste this — it adds Slack&rsquo;s RSS app and posts the book each day.
          </p>
          <CopyField value={slackCmd} />
          <a href="https://slack.com/help/articles/218688467-Add-RSS-feeds-to-Slack" target="_blank" rel="noopener noreferrer" className={helpLink}>
            How it works →
          </a>
        </PlatformCard>

        <PlatformCard name="Discord">
          <p className="text-xs text-neutral-600 leading-relaxed">
            Add the free MonitoRSS bot, then paste this feed URL and pick a channel.
          </p>
          <CopyField value={feedUrl} />
          <a href="https://monitorss.xyz/" target="_blank" rel="noopener noreferrer" className={helpLink}>
            Get MonitoRSS →
          </a>
        </PlatformCard>

        <PlatformCard name="Teams">
          <p className="text-xs text-neutral-600 leading-relaxed">
            In Power Automate, use &ldquo;When a feed item is published&rdquo; → Post in a channel, with this URL.
          </p>
          <CopyField value={feedUrl} />
          <a href="https://make.powerautomate.com/" target="_blank" rel="noopener noreferrer" className={helpLink}>
            Open Power Automate →
          </a>
        </PlatformCard>
      </div>

      <div className="flex items-center gap-5 flex-wrap text-sm">
        <a href={feedUrl} className="inline-flex items-center gap-1.5 font-medium text-gray-600 hover:text-oxblood transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4 11a9 9 0 0 1 9 9h-2.5A6.5 6.5 0 0 0 4 13.5V11zm0-5a14 14 0 0 1 14 14h-2.5A11.5 11.5 0 0 0 4 8.5V6zm1.5 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
          </svg>
          RSS feed
        </a>
        <a href={feedly} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-600 hover:text-oxblood transition-colors">
          Add to Feedly
        </a>
        <span className="text-neutral-400">Works in any RSS reader.</span>
      </div>
    </div>
  )
}
