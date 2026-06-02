'use client'

import { useState } from 'react'

type Props = {
  /** YouTube video ID (the part after youtu.be/ or watch?v=). */
  videoId: string
  /** Accessible title for the player. */
  title: string
}

/**
 * Lazy YouTube embed using the "facade" pattern: until the viewer clicks play
 * we render only the poster image + a play button, so the page never pays the
 * cost of YouTube's iframe (and its ~hundreds of KB of JS) on load. The heavy
 * iframe is mounted only after the click, with autoplay so it behaves like a
 * normal embed. Keeps the page fast and Lighthouse-clean while staying a plain
 * 16:9 responsive box.
 */
export default function YouTubeEmbed({ videoId, title }: Props) {
  const [activated, setActivated] = useState(false)

  // hqdefault is always present (maxresdefault 404s for some uploads); it is
  // served from YouTube's own CDN, so no next/image host-allowlist concerns.
  const poster = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-black">
      {activated ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerator; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setActivated(true)}
          className="group absolute inset-0 h-full w-full cursor-pointer"
          aria-label={`Play video: ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-oxblood/90 shadow-lg transition-transform group-hover:scale-105 md:h-20 md:w-20">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="ml-1 h-7 w-7 text-cream md:h-9 md:w-9"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  )
}
