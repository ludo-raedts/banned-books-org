import type { Metadata } from 'next'
import Link from 'next/link'
import EssayLayout from '@/components/essay-layout'
import YouTubeEmbed from '@/components/youtube-embed'
import { essayBySlug } from '@/lib/essays-data'
import { buildCitationMeta } from '@/lib/citation-meta'

const essay = essayBySlug('the-librarians')!

export const metadata: Metadata = {
  title: essay.title,
  description: essay.dek,
  openGraph: { title: essay.title, description: essay.dek, type: 'article' },
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
  dateModified: essay.publishedAt,
  image: 'https://www.banned-books.org/opengraph-image',
  author: { '@type': 'Organization', name: 'banned-books.org' },
  publisher: {
    '@type': 'Organization',
    name: 'banned-books.org',
    logo: { '@type': 'ImageObject', url: 'https://www.banned-books.org/brand/compact-bb.png' },
  },
  mainEntityOfPage: `https://www.banned-books.org${essay.href}`,
}

export default function TheLibrariansPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EssayLayout essay={essay}>
        <h2>A clip, and a country that looks insane from outside</h2>

        <p>
          The clip that sent me looking was a short one: someone abroad, scrolling past a
          trailer, stopping cold. Librarians investigated and arrested for defending books. A
          book banned because a cartoon mouse wasn&rsquo;t wearing clothes. Parents standing
          up at public meetings to tell a librarian they knew where she lived. From the
          outside it reads as parody &mdash; surely no country does this to the people who run
          its libraries.
        </p>

        <p>
          The trailer was for{' '}
          <a href="https://www.thelibrariansfilm.com/" target="_blank" rel="noopener noreferrer">
            <em>The Librarians</em>
          </a>
          , Kim A. Snyder&rsquo;s documentary about the Americans caught in the middle of the
          country&rsquo;s book-ban movement. It premiered at Sundance in January 2025, reached
          US theaters that October, and airs on PBS&rsquo;s <em>Independent Lens</em>{' '}
          in February 2026, with Sarah Jessica Parker as an executive producer and a score by
          Nico Muhly. It is, by most accounts, a good film &mdash; 93% on Rotten Tomatoes,
          &ldquo;profiles in courage&rdquo; in the <em>New York Times</em>.
        </p>

        {/* Cookie-free trailer: facade pattern + youtube-nocookie.com, no YouTube
            JS or cookies until the viewer clicks play. See src/components/youtube-embed.tsx. */}
        <figure className="not-prose my-8">
          <div className="mx-auto max-w-2xl">
            <YouTubeEmbed
              videoId="Ykll4MWltsQ"
              title="The Librarians — official trailer"
            />
            <figcaption className="mt-2 text-xs text-neutral-500">
              Official trailer · Dogwoof / 8 Above. Playback loads from
              youtube-nocookie.com only after you press play.
            </figcaption>
          </div>
        </figure>

        <p>
          Which is exactly why the two loudest claims in that viral clip are worth getting
          right. The film is better than the outrage it inspires, and the truth turns out to
          be stranger than the version that travels.
        </p>

        <h2>The mouse had a name</h2>

        <p>
          The cartoon mouse belongs to{' '}
          <Link href="/books/maus"><em>Maus</em></Link>, Art Spiegelman&rsquo;s Holocaust
          graphic novel &mdash; Jews drawn as mice, Nazis as cats. In January 2022 the school
          board in McMinn County, Tennessee, voted to remove it from the eighth-grade
          curriculum, citing rough language and a small nude drawing: the author&rsquo;s
          mother, rendered as a mouse, dead in a bath after her suicide.
        </p>

        <p>
          So yes &mdash; a book about Auschwitz was pulled, in part, because a cartoon mouse
          had no clothes. It sounds absurd because it is. But the absurdity is the whole
          tragedy in miniature: you can object to a single pen-stroke and, in the same motion,
          lose the six million behind it. The clip gets the detail right and the register
          wrong. This was never funny.
        </p>

        <h2>Nobody arrested a librarian</h2>

        <p>
          The arrest is the part that isn&rsquo;t true &mdash; and, to its credit, the film
          never claims it is. I went looking for a case of an American librarian arrested
          purely for defending or lending a book, and I could not confirm one.
        </p>

        <p>
          What actually happened to the people in this film is harder to dismiss than an
          arrest, precisely because there are no handcuffs to make it tidy:
        </p>

        <ul>
          <li>
            <strong>Martha Hickson</strong>, a New Jersey school librarian, was called a
            pedophile and a pornographer to her face at a school-board meeting, then reported
            to the police for distributing obscene material. The prosecutor found no crime.
            The accusation did its work anyway &mdash; she has described the anxiety, the
            insomnia, the hair falling out.
          </li>
          <li>
            <strong>Suzette Baker</strong> in Llano County, Texas, and{' '}
            <strong>Julie Miller</strong>, also in Texas, were fired.
          </li>
          <li>
            <strong>Amanda Jones</strong>, a Louisiana librarian, was threatened and harassed
            after speaking at a public meeting, and told that people knew where she lived. She
            sued her harassers rather than go quiet.
          </li>
        </ul>

        <p>
          And underneath the individual stories sits a legal shift the clip can&rsquo;t fit
          into six seconds: a growing number of states have passed or proposed laws stripping
          the exemptions that once kept school and public librarians out of reach of obscenity
          statutes. Remove that shield and the arrest stops being hyperbole and becomes a
          policy waiting for a prosecutor. Nobody has been arrested for defending a book.
          Several states have spent the last few years making sure somebody could be.
        </p>

        <h2>What the film actually documents</h2>

        <p>
          <em>The Librarians</em> traces the movement back to a concrete moment: October 2021,
          when Texas legislator Matt Krause sent school districts a list of 850 titles and
          asked which ones they held. The list ran overwhelmingly to books about race,
          LGBTQ+ lives, and American history &mdash; and it became the template for everything
          that followed, as districts were told not just to pull the listed books but to hunt
          down anything with comparable &ldquo;content.&rdquo;
        </p>

        <p>
          The film&rsquo;s real subject, though, is the people the list landed on. Carolyn
          Foote and the Texas &ldquo;FReadom Fighters&rdquo; she helped organize. Baker,
          Miller, Hickson, Jones. None of them set out to be political figures; they were
          school and public librarians who assumed their job was to shelve books, not to
          defend their own reputations at a microphone while strangers filmed them. Moms for
          Liberty, the group most visible in the removals, declined the filmmakers&rsquo;
          request to take part &mdash; so the movement&rsquo;s own case is largely absent,
          which is the film&rsquo;s one fair criticism and the reason its single notable pan
          calls it one-sided.
        </p>

        <h2>Why the precise version matters</h2>

        <p>
          This site keeps returning to the same argument: the fight over books is won or lost
          on precision (see{' '}
          <Link href="/essays/what-we-document"><em>What we document</em></Link> and{' '}
          <Link href="/essays/the-line-we-pretend-not-to-draw">
            <em>The line we pretend not to draw</em>
          </Link>
          ). When you say <em>they&rsquo;re arresting librarians</em> and it turns out no one
          was arrested, the person doing the banning gets to wave the entire thing away as
          hysteria &mdash; and pocket the firing, the doxxing, and the new law unremarked.
          Overstatement is a gift to the censor. The exact account is the one he can&rsquo;t
          answer.
        </p>

        <p>
          That is not a reason to look away from the clip. It is a reason to trade its outrage
          for something sturdier. Not <em>librarians are being arrested</em>, but: a librarian
          was called a pornographer for shelving a memoir, reported to the police, and cleared
          &mdash; and the law is being rewritten so the next one might not be. That sentence is
          quieter. It is also true, and it does not evaporate the moment someone checks it.
        </p>

        <p>
          The librarians in this film are heroes in the least glamorous sense of the word
          &mdash; people who did their ordinary jobs on a day the job turned dangerous, and
          kept doing them. You can watch them do it: <em>The Librarians</em> is on PBS{' '}
          <em>Independent Lens</em> and Kanopy in the US, and on BBC iPlayer in the UK.
        </p>
      </EssayLayout>
    </>
  )
}
