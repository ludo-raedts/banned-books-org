// Featured-video registry.
//
// A tiny, hand-curated list of YouTube clips worth embedding on a specific
// book and/or author page — primary-source material (an author speaking about
// their banned work, archival footage of a censorship event) that adds real
// context the generated metadata can't.
//
// This is deliberately a code registry, not a DB column: the book/author pages
// are templates over ~16k rows, and only a handful of titles will ever warrant
// a video. Keying by slug here keeps the special-case out of the page files and
// makes adding the next clip a one-line change. Same doctrine as
// `ban-contexts.ts` and `reason-explainers.ts`.
//
// Privacy: the clip renders through `<YouTubeEmbed>` (facade pattern +
// youtube-nocookie.com), so no YouTube cookies or JS load until the viewer
// clicks play. See src/components/youtube-embed.tsx.

export type FeaturedVideo = {
  /** YouTube video ID (the part after watch?v= or youtu.be/). */
  videoId: string
  /** Accessible/player title and on-page heading source. */
  title: string
  /** Publisher credit shown under the player, e.g. "C-SPAN". */
  credit: string
  /** Book slug this clip belongs on, if any. */
  bookSlug?: string
  /** Author slug this clip belongs on, if any. */
  authorSlug?: string
}

export const FEATURED_VIDEOS: FeaturedVideo[] = [
  {
    videoId: '2G2ItbHtv08',
    title:
      'Jodi Picoult: "My book, Nineteen Minutes, is currently the most banned book in America"',
    credit: 'C-SPAN · America’s Book Club',
    bookSlug: 'nineteen-minutes',
    authorSlug: 'jodi-picoult',
  },
  {
    videoId: 'ljvVUW2vrRU',
    title: 'Margaret Atwood shares real-life parallels in The Handmaid’s Tale',
    credit: 'PBS · Brief But Spectacular',
    bookSlug: 'the-handmaids-tale',
    authorSlug: 'margaret-atwood',
  },
  {
    videoId: '69rd-7vEF3s',
    title: 'John Green on the banning of Looking for Alaska',
    credit: 'vlogbrothers (John Green)',
    bookSlug: 'looking-for-alaska',
    authorSlug: 'john-green',
  },
]

/** The featured clip for a book page, if one is registered. */
export function videoForBook(slug: string): FeaturedVideo | undefined {
  return FEATURED_VIDEOS.find((v) => v.bookSlug === slug)
}

/** The featured clip for an author page, if one is registered. */
export function videoForAuthor(slug: string): FeaturedVideo | undefined {
  return FEATURED_VIDEOS.find((v) => v.authorSlug === slug)
}
