import type { Metadata } from 'next'
import Link from '@/components/link'
import EssayLayout from '@/components/essay-layout'
import InstagramEmbed from '@/components/instagram-embed'
import { essayBySlug, essayMetaDescription } from '@/lib/essays-data'
import { buildCitationMeta } from '@/lib/citation-meta'

const essay = essayBySlug('forbidden-library')!

export const metadata: Metadata = {
  title: essay.title,
  description: essayMetaDescription(essay),
  openGraph: {
    title: essay.title,
    description: essayMetaDescription(essay),
    type: 'article',
    // Essays have no per-page card; fall back to the site card so
    // summary_large_image previews are not imageless.
    images: ['https://www.banned-books.org/opengraph-image'],
  },
  alternates: {
    canonical: essay.href,
    types: { 'text/markdown': `${essay.href}.md` },
  },
  robots: essay.draft ? { index: false, follow: true } : undefined,
  other: buildCitationMeta({
    entityType: 'essay',
    title: essay.title,
    url: `https://www.banned-books.org${essay.href}`,
    publicationYear: Number(essay.publishedAt.slice(0, 4)),
    onlineDate: essay.publishedAt,
  }),
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: essay.title,
  description: essay.dek,
  datePublished: essay.publishedAt,
  dateModified: essay.updatedAt ?? essay.publishedAt,
  image: 'https://www.banned-books.org/opengraph-image',
  // Person author (publicly bylined on /about) — a real-authorship signal,
  // deliberately not an anonymous Organization byline.
  author: { '@type': 'Person', name: 'Ludo Raedts', url: 'https://www.banned-books.org/about' },
  publisher: {
    '@type': 'Organization',
    '@id': 'https://www.banned-books.org/#organization',
    name: 'Banned Books',
    logo: { '@type': 'ImageObject', url: 'https://www.banned-books.org/brand/compact-bb.png' },
  },
  mainEntityOfPage: `https://www.banned-books.org${essay.href}`,
  // The artwork the essay is about, credited to its maker.
  about: {
    '@type': 'VisualArtwork',
    name: 'forbidden library',
    artform: 'Data sculpture (video)',
    url: 'https://www.instagram.com/reel/De9K8Xfs-Sp/',
    dateCreated: '2026-10-26',
    creator: { '@type': 'Person', name: 'Evgeniy Afonin', url: 'https://afonin.media/bio/' },
  },
}

export default function ForbiddenLibraryPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EssayLayout essay={essay}>
        <h2>A library you can only walk around</h2>

        <p>
          On 26 October 2026 a media artist named Evgeniy Afonin posted a short video to
          Instagram. It shows a slowly turning tower of rings, each ring a thin band of book
          covers, each band one country&rsquo;s list of forbidden titles. Small labels float
          beside them &mdash; a country code, a span of years. He called it{' '}
          <em>forbidden library</em>, and described it as a data sculpture. Within a day it had
          more than a hundred thousand likes, and TouchDesigner, the real-time graphics software
          he built it in, had reposted it to its own followers.
        </p>

        <p>
          The data under it is ours. The caption credits this catalogue&rsquo;s open dataset by
          name, under the CC&nbsp;BY&nbsp;4.0 licence it is published with, and the book covers
          to Open Library and the Internet Archive. That is how I found out about it: thousands
          of people I had never met started typing <em>banned-books.org</em> into their phones
          to see where the rings came from.
        </p>

        {/* Click-to-load: no Instagram request until the reader asks for it.
            See src/components/instagram-embed.tsx. */}
        <figure className="not-prose my-8">
          <InstagramEmbed
            shortcode="De9K8Xfs-Sp"
            handle="netzzy"
            title="forbidden library"
            teaser="A data sculpture by Evgeniy Afonin, built on this catalogue’s open dataset."
          />
          <figcaption className="mx-auto mt-1 max-w-[400px] text-xs text-neutral-500">
            <em>forbidden library</em>, Evgeniy Afonin, 2026. Data: Banned Books &mdash; Open
            Censorship Core (CC BY 4.0). Covers: Open Library / Internet Archive.
          </figcaption>
        </figure>

        <h2>Who made it</h2>

        <p>
          Afonin is not a data journalist who learned some 3D; he is a stage artist who
          learned to read archives. He started out as a VJ, moved into new media around 2008,
          and has spent most of his career in theatre and performance &mdash; media
          scenography, interactive light, large-scale shows. Since 2012 he has worked with Yan
          Kalnberzin as the duo{' '}
          <a href="https://curiositylab.media/" target="_blank" rel="noopener noreferrer">
            Curiosity Media Lab
          </a>
          , and he teaches TouchDesigner to a generation of real-time artists. His video and
          lighting design for the production <em>Exhibit/Awakening</em> won a Golden Mask,
          Russia&rsquo;s national theatre award; his 360-degree film{' '}
          <em>Gagarin. Lieutenant of the Sky</em> won a Moscow Art Award.
        </p>

        <p>
          Lately his work has turned to what he calls archival studies: public datasets turned
          into objects you can look at. A Princeton collection of Soviet and East European
          propaganda posters, rendered as something closer to a pathogen than a gallery. Russian
          election-commission results, searched for anomalies. Twenty-five years of the US
          aviation authority&rsquo;s wildlife-strike database, plotted strike by strike
          until an aircraft outline emerges. Rocket alerts in Israel. A
          Smithsonian parasite collection. The archive is the material; the sculpture is a way of
          making its shape visible. <em>forbidden library</em> is the latest of these, and you can
          see more of them on{' '}
          <a href="https://afonin.media/" target="_blank" rel="noopener noreferrer">
            his site
          </a>
          .
        </p>

        <h2>Five lines of methodology</h2>

        <p>
          The part of the post I keep going back to is not the video. It is the caption.
          Before any titles, Afonin lists what the sculpture leaves out. It only counts bans
          by states. It only counts bans someone documented, so it shows the record, not how
          far censorship actually went. Closed states rarely publish their lists. And then:
          &ldquo;no record is not no censorship.&rdquo;
        </p>

        <p>
          That is this site&rsquo;s methodology, written better than I have managed to write
          it. Our{' '}
          <Link href="/methodology">methodology page</Link> makes the same point at length:
          the United States does not ban more books than authoritarian states, it just
          records the ones it bans. And{' '}
          <Link href="/essays/what-we-document"><em>What we document</em></Link> is a whole
          essay about where the line is drawn and why. Most people who reuse a dataset like
          this lead with the biggest number. Afonin led with the limits. Then he made a piece
          in which the limits are the thing you see.
        </p>

        <h2>What the rings actually show</h2>

        <p>
          Filter the catalogue to bans by states &mdash; government and customs bans, more or
          less what his caption describes &mdash; and you get roughly 12,600 titles across 117 countries. But the bands are wildly uneven, and
          the unevenness is the story:
        </p>

        <ul>
          <li>
            <strong>Germany</strong>: about 3,600 titles, almost all from 1933 to 1945 &mdash;
            the Nazi state&rsquo;s own lists of &ldquo;harmful and undesirable&rdquo;
            literature, compiled and maintained with bureaucratic care.
          </li>
          <li>
            <strong>Malaysia</strong>: about 3,100 titles, nearly all from the Home
            Ministry&rsquo;s published gazette of prohibited publications.
          </li>
          <li>
            <strong>Portugal</strong>: around 900, nearly all of them banned by the Estado
            Novo dictatorship&rsquo;s censors.
          </li>
          <li>
            <strong>China</strong>, 58. <strong>Iran</strong>, 52.{' '}
            <strong>Saudi Arabia</strong>, 25. <strong>North Korea</strong>, 6.{' '}
            <strong>Turkmenistan</strong>, 1.
          </li>
        </ul>

        <p>
          Nobody seriously believes Germany is the most censorious country in this dataset or
          that North Korea forbids six books. The largest rings belong to censors who wrote
          things down: a regime that lost and left its paperwork behind, a government that
          prints its bans in an official gazette, a dictatorship whose archives were opened.
          The thinnest rings belong to systems where censorship works well enough that it
          doesn&rsquo;t need a list &mdash; where a book never gets printed, imported, or
          mentioned in the first place. A complete ban leaves almost no trace in any record.
        </p>

        <p>
          So a sculpture made of these lists is, without ever saying so, also a picture of
          paperwork. When you watch the tower turn, the empty space between the rings is not
          freedom. It is the part nobody wrote down.
        </p>

        <h2>The books that cross borders</h2>

        <p>
          The caption ends with a ranking by number of countries, and the top of it matches
          ours:{' '}
          <Link href="/books/the-satanic-verses"><em>The Satanic Verses</em></Link> at 22,
          then <Link href="/books/lady-chatterleys-lover"><em>Lady Chatterley&rsquo;s Lover</em></Link>,{' '}
          <Link href="/books/1984"><em>1984</em></Link>,{' '}
          <Link href="/books/lolita"><em>Lolita</em></Link>,{' '}
          <Link href="/books/tropic-of-cancer"><em>Tropic of Cancer</em></Link>,{' '}
          <Link href="/books/animal-farm"><em>Animal Farm</em></Link>. Sex, blasphemy, and two
          books about the state lying to you. These are the titles that travel because they
          were famous before anyone banned them, and every ban made them more famous. The same
          caveat applies here too: a famous book gets its bans written down, reported, and
          catalogued. A pamphlet seized at a border in 1974 usually does not.
        </p>

        <p>
          That is the strange double nature of the piece. It is a monument to the books that
          were forbidden, and it is equally a monument to the people who did the forbidding
          &mdash; the clerks, censors, and customs officers whose lists are the only reason any
          of this can be counted at all.
        </p>

        <h2>What an open dataset is for</h2>

        <p>
          When I put the censorship core of this catalogue on{' '}
          <Link href="/dataset">Zenodo under CC&nbsp;BY&nbsp;4.0</Link>, I pictured
          researchers, librarians, maybe a journalist on deadline. I did not picture a
          sculpture. That is exactly why the data is open: you do not know in advance what
          someone will build with it, and the best uses are the ones nobody planned. Afonin
          credited it properly, kept its limitations in the frame, and showed more than a
          hundred thousand people the shape of a thing most of them had never thought about.
        </p>

        <p>
          If you build something with the data &mdash; a sculpture, a paper, a lesson, a map
          &mdash; I would like to see it. And if you came here from the video: the rings are
          made of real books. Every one of them has a page on this site, with the countries
          that banned it and the sources that say so. Start with the{' '}
          <Link href="/countries">countries</Link>, or with the book that appears in the most
          rings of all,{' '}
          <Link href="/books/the-satanic-verses"><em>The Satanic Verses</em></Link>.
        </p>
      </EssayLayout>
    </>
  )
}
