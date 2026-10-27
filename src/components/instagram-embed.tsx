'use client'

import { useState } from 'react'

type Props = {
  /** Instagram post/reel shortcode (the part after /reel/ or /p/). */
  shortcode: string
  /** Account handle without the @, shown on the facade and in the fallback link. */
  handle: string
  /** Accessible title for the embed. */
  title: string
  /** Short line shown on the facade before the post is loaded. */
  teaser?: string
}

/**
 * Click-to-load Instagram embed, the same facade pattern as <YouTubeEmbed>:
 * until the viewer asks for it we render a plain card with no third-party
 * request at all — no embed.js, no thumbnail, no cookies. On click we mount
 * Instagram's own iframe embed (/embed/captioned), which is the officially
 * supported way to show a public post. We don't mirror the post's thumbnail
 * because the frames are the artist's work, not ours.
 */
export default function InstagramEmbed({ shortcode, handle, title, teaser }: Props) {
  const [activated, setActivated] = useState(false)
  const postUrl = `https://www.instagram.com/reel/${shortcode}/`

  return (
    <div className="mx-auto w-full max-w-[400px]">
      {activated ? (
        <iframe
          className="block h-[760px] w-full rounded-sm border border-neutral-200 bg-white"
          src={`https://www.instagram.com/reel/${shortcode}/embed/captioned/`}
          title={title}
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <button
          type="button"
          onClick={() => setActivated(true)}
          className="group relative flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-sm bg-neutral-950 px-8 text-center text-cream"
          aria-label={`Load Instagram post: ${title}`}
        >
          {/* Concentric rings — a nod to the piece's form, drawn locally. */}
          <svg
            viewBox="0 0 200 200"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-15 transition-opacity group-hover:opacity-30"
            aria-hidden="true"
          >
            {[30, 46, 62, 78, 94].map(r => (
              <ellipse key={r} cx="100" cy="100" rx={r} ry={r * 0.32} fill="none" stroke="currentColor" strokeWidth="0.6" />
            ))}
          </svg>
          <span className="relative text-xs uppercase tracking-widest text-cream/70">@{handle} on Instagram</span>
          <span className="relative mt-3 font-serif text-2xl font-semibold">{title}</span>
          {teaser && <span className="relative mt-3 text-sm text-cream/80">{teaser}</span>}
          <span className="relative mt-6 inline-flex items-center gap-2 rounded-full bg-oxblood/90 px-5 py-2.5 text-sm font-medium shadow-lg transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            Load the post
          </span>
        </button>
      )}
      <p className="mt-2 text-xs text-neutral-500">
        Loads from instagram.com only after you click.{' '}
        <a href={postUrl} target="_blank" rel="noopener noreferrer" className="text-oxblood hover:underline">
          Open on Instagram ↗
        </a>
      </p>
    </div>
  )
}
