import type { Metadata } from 'next'
import Link from 'next/link'
import YouTubeEmbed from '@/components/youtube-embed'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

// ── Film constants ───────────────────────────────────────────────────────────
// The YouTube video ID (the part after youtu.be/ — for
// https://youtu.be/ZVuLsMQ_NLo it is "ZVuLsMQ_NLo"). Swap in the final ID here
// if the upload is replaced; everything (embed, poster, JSON-LD) derives from it.
const YOUTUBE_VIDEO_ID = 'ZVuLsMQ_NLo'
// Upload date for the VideoObject — full ISO 8601 with timezone (Google's video
// structured-data validator warns on a bare date). Mirrors YouTube's own
// publishDate for this upload; update if the video is re-uploaded.
const FILM_UPLOAD_DATE = '2026-06-02T09:17:48-07:00'

const FILM_TITLE = 'A World Map of Banned Books'
const FILM_DESCRIPTION =
  'A short documentary mapping book censorship across the world — built on the banned-books.org catalogue and PEN America records. The map reflects what is documented, not the full scale of censorship.'

const EMBED_URL = `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}`
const WATCH_URL = `https://youtu.be/${YOUTUBE_VIDEO_ID}`
const THUMBNAIL_URL = `https://i.ytimg.com/vi/${YOUTUBE_VIDEO_ID}/hqdefault.jpg`

// Static page — content is editorial, no per-request data. No need to revalidate.
export const metadata: Metadata = {
  title: 'The film',
  description: FILM_DESCRIPTION,
  alternates: { canonical: '/film' },
  openGraph: {
    title: FILM_TITLE,
    description: FILM_DESCRIPTION,
    type: 'video.other',
    url: 'https://www.banned-books.org/film',
    // Declaring an openGraph block suppresses the inherited opengraph-image file
    // convention (Next.js merges file images only when no openGraph.images is
    // set on the route), so point at the site default explicitly to keep it.
    images: ['/opengraph-image'],
  },
}

// VideoObject JSON-LD — gives the documentary the same structured
// discoverability that Book / Person / Dataset already carry. publisher mirrors
// the Organization shape used across the other schemas on the site.
const videoSchema = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: FILM_TITLE,
  description: FILM_DESCRIPTION,
  thumbnailUrl: [THUMBNAIL_URL],
  uploadDate: FILM_UPLOAD_DATE,
  embedUrl: EMBED_URL,
  contentUrl: WATCH_URL,
  publisher: {
    '@type': 'Organization',
    name: 'Banned Books',
    url: 'https://www.banned-books.org',
    logo: {
      '@type': 'ImageObject',
      url: 'https://www.banned-books.org/brand/compact-bb.png',
    },
  },
}

const ldHtml = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

// Film-credit blocks, kept in credit-roll order. The Bundesarchiv image is
// CC-BY-SA 3.0 — the attribution string is a legal requirement and is
// reproduced verbatim.
const credits: { role: string; lines: React.ReactNode[] }[] = [
  {
    role: 'Source & data',
    lines: [
      <>
        Catalogue compiled by banned-books.org — full sources at{' '}
        <Link href="/sources" className="text-oxblood hover:underline">
          /sources
        </Link>
      </>,
      'School-ban figures: PEN America',
    ],
  },
  {
    role: 'Images',
    lines: [
      <>
        Bundesarchiv Bild 102-14597 / CC-BY-SA 3.0, via{' '}
        <a
          href="https://commons.wikimedia.org/wiki/File:Bundesarchiv_Bild_102-14597,_Berlin,_Opernplatz,_B%C3%BCcherverbrennung.jpg"
          target="_blank"
          rel="noopener noreferrer"
          className="text-oxblood hover:underline"
        >
          Wikimedia Commons
        </a>
      </>,
      <>
        Ludwig von Langenmantel, 1879 — public domain, via{' '}
        <a
          href="https://commons.wikimedia.org/wiki/Category:Ludwig_von_Langenmantel"
          target="_blank"
          rel="noopener noreferrer"
          className="text-oxblood hover:underline"
        >
          Wikimedia Commons
        </a>
      </>,
    ],
  },
  {
    role: 'Map geometry',
    lines: ['world-atlas & us-atlas (Natural Earth)'],
  },
  { role: 'Music', lines: ['Generated with Suno'] },
]

export default function FilmPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldHtml(videoSchema) }}
      />

      {/* ── Hero + video ──────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-12 bg-white">
        <div className="max-w-3xl mx-auto">
          <Eyebrow>Film · documentary</Eyebrow>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            {FILM_TITLE}
          </h1>

          <div className="mt-8">
            <YouTubeEmbed videoId={YOUTUBE_VIDEO_ID} title={FILM_TITLE} />
          </div>
        </div>
      </section>

      {/* ── Intro + traffic splitter ──────────────────────────────────── */}
      <SectionShell tone="white">
        <div className="max-w-3xl mx-auto">
          <p className="font-serif text-lg md:text-xl leading-relaxed text-gray-900">
            A short documentary that maps book censorship across the world,
            drawn from the banned-books.org catalogue and PEN America&rsquo;s
            records.
          </p>

          <p className="mt-5 text-base leading-relaxed text-neutral-700">
            One caveat shapes how the map should be read:{' '}
            <strong className="font-semibold text-gray-900">
              the map reflects what is documented, not the full scale of
              censorship.
            </strong>{' '}
            The United States looks prominent not because it bans the most books,
            but because its bans are reported, catalogued, and counted in
            unusual detail. In many countries the same suppression goes
            unrecorded — so the brightest regions on the map are often the ones
            with the freest press, not the heaviest censorship.
          </p>

          <p className="mt-5 text-base leading-relaxed text-neutral-700">
            The film is a doorway into the archive. Everything in it is browsable,
            sourced, and downloadable.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center border border-oxblood text-oxblood hover:bg-oxblood hover:text-cream font-serif font-semibold rounded-sm px-5 py-2.5 text-sm transition-colors"
            >
              Explore the archive →
            </Link>
            <Link
              href="/dataset"
              className="inline-flex items-center border border-oxblood text-oxblood hover:bg-oxblood hover:text-cream font-serif font-semibold rounded-sm px-5 py-2.5 text-sm transition-colors"
            >
              Get the dataset →
            </Link>
          </div>
        </div>
      </SectionShell>

      {/* ── Credits ───────────────────────────────────────────────────── */}
      <SectionShell tone="cream">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30">
            Credits
          </h2>
          <dl className="flex flex-col gap-5">
            {credits.map((c) => (
              <div
                key={c.role}
                className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-1 sm:gap-4"
              >
                <dt className="text-[11px] uppercase tracking-wider text-neutral-500 pt-0.5">
                  {c.role}
                </dt>
                <dd className="text-sm text-neutral-700 leading-relaxed">
                  {c.lines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </SectionShell>
    </main>
  )
}
