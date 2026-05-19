import type { Metadata } from 'next'
import Link from 'next/link'
import EssayLayout from '@/components/essay-layout'
import { essayBySlug } from '@/lib/essays-data'
import { buildCitationMeta } from '@/lib/citation-meta'

const essay = essayBySlug('forbidden-knowledge-iceberg')!

export const metadata: Metadata = {
  title: `${essay.title} — Banned Books`,
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
  author: { '@type': 'Organization', name: 'banned-books.org' },
  publisher: { '@type': 'Organization', name: 'banned-books.org' },
  mainEntityOfPage: `https://www.banned-books.org${essay.href}`,
}

const proseClasses =
  'prose prose-gray dark:prose-invert max-w-none ' +
  'prose-headings:font-bold prose-headings:tracking-tight ' +
  'prose-a:text-gray-900 dark:prose-a:text-gray-100 prose-a:underline prose-a:underline-offset-2 ' +
  'prose-a:decoration-gray-300 dark:prose-a:decoration-gray-600 ' +
  'hover:prose-a:decoration-gray-600 dark:hover:prose-a:decoration-gray-300 ' +
  'prose-p:leading-relaxed'

export default function ForbiddenKnowledgeIcebergPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EssayLayout essay={essay}>
        <article className={proseClasses}>
          <p>There is a particular kind of image that keeps resurfacing online.</p>

          <p>
            Sometimes it appears as an iceberg chart. Sometimes as a Reddit thread, a
            YouTube video, or a dramatically narrated TikTok. The format barely matters
            anymore because the structure is always recognizable.
          </p>

          <p>
            At the top sit familiar novels people vaguely remember from school:{' '}
            <Link href="/books/1984"><em>1984</em></Link>,{' '}
            <Link href="/books/the-catcher-in-the-rye"><em>The Catcher in the Rye</em></Link>,{' '}
            <Link href="/books/lolita"><em>Lolita</em></Link>.
          </p>

          <p>Then the viewer descends deeper.</p>

          <p>
            The titles become stranger. More obscure. More extreme. Anarchist manuals.
            Fringe political texts. Occult material. Violent propaganda. Eventually the
            lists reach documents that are no longer meaningfully literature at all, but
            material created to facilitate abuse, intimidation, or ideological violence.
          </p>

          <p>
            The visual language is always the same: the deeper you go, the more forbidden
            the knowledge supposedly becomes.
          </p>

          <p>And beneath all of it sits the same seductive implication:</p>

          <p><em>These are the things they do not want you to read.</em></p>

          <p>
            At first glance, it can feel intellectually rebellious. Anti-authoritarian.
            Curious. Almost romantic in its opposition to censorship.
          </p>

          <p>I think the reality is much less innocent than that.</p>

          <h2>The internet&apos;s mythology of hidden truth</h2>

          <p>
            What makes iceberg culture influential is not the information itself. Most of
            these titles are already publicly available. Some are heavily discussed.
            Others are commercially sold.
          </p>

          <p>The attraction is emotional framing.</p>

          <p>
            The iceberg format transforms radically different categories of material into
            one continuous mythology of hidden truth. Literature, propaganda, criminal
            evidence, internet folklore, extremist fantasies, and abuse material all
            begin occupying the same emotional category in the mind of the viewer.
          </p>

          <p>That process changes how people encounter extremism online.</p>

          <p>
            Not through argument at first, but through aesthetics, escalation, curiosity,
            and the promise of access to something &ldquo;they&rdquo; supposedly want
            hidden.
          </p>

          <p>
            Once everything is framed as forbidden knowledge, moral distinctions start to
            feel naïve. Context becomes suspicious. Expertise starts looking like
            censorship. The deeper layer automatically appears more authentic simply
            because it is harder to find.
          </p>

          <p>That is not archival thinking. It is algorithmic spectacle.</p>

          <h2>A novel is not the same thing as operational propaganda</h2>

          <p>
            One of the stranger habits of online &ldquo;banned books&rdquo; culture is
            the tendency to grant literary status to documents whose original purpose was
            never literary at all.
          </p>

          <p>
            A manifesto written in direct preparation for violence suddenly gets
            discussed beside novels, memoirs, philosophy, or political literature as
            though all belong to the same historical tradition.
          </p>

          <p>They do not.</p>

          <p>
            The manifesto published by Anders Behring Breivik before the attacks of
            July 22, 2011 is one example.
          </p>

          <p>
            Online, it is regularly included in &ldquo;forbidden texts&rdquo; lists.
            Sometimes it is casually described as a &ldquo;book.&rdquo; Technically, it
            resembles one. It has chapters, citations, arguments, structure.
          </p>

          <p>But form alone is not enough.</p>

          <p>
            Breivik&apos;s document was operational propaganda attached to an act of mass
            murder in which 77 people, many of them teenagers, were killed. It was not
            created for literary discourse, philosophical inquiry, or public debate.
          </p>

          <p>That distinction matters.</p>

          <p>
            This does not mean researchers should ignore such documents. Terrorism
            researchers, journalists, historians, and courts all have legitimate reasons
            to preserve and study them.
          </p>

          <p>
            But that is not the same thing as placing them inside a censorship archive
            beside literature and presenting all of it under the same romantic framing of
            forbidden knowledge.
          </p>

          <p>Once everything belongs to the same mythology, the category itself stops meaning anything.</p>

          <h2>The damage these lists do</h2>

          <p>
            The problem with iceberg lists is not only that they are sloppy. It is that
            they quietly distort the conversation around censorship itself.
          </p>

          <p>First, they weaken the credibility of actual censorship victims.</p>

          <p>
            When works such as{' '}
            <Link href="/books/the-gulag-archipelago"><em>The Gulag Archipelago</em></Link>,{' '}
            <Link href="/books/the-satanic-verses"><em>The Satanic Verses</em></Link>, or{' '}
            <Link href="/books/the-diary-of-a-young-girl"><em>The Diary of a Young Girl</em></Link>{' '}
            appear in the same ecosystem as abuse manuals or operational extremist
            propaganda, the concept of &ldquo;banned books&rdquo; itself starts looking
            unserious.
          </p>

          <p>Everything becomes contaminated by association.</p>

          <p>Second, these lists often function less as documentation than as discovery mechanisms.</p>

          <p>
            The creators rarely say this openly, but the structure itself encourages
            escalation. The deeper layers promise increasingly transgressive material.
            Curiosity becomes part of the design.
          </p>

          <p>The point is no longer historical understanding. The point becomes access.</p>

          <p>That is a very different thing.</p>

          <p>
            Third, iceberg culture encourages an intellectually lazy understanding of
            censorship. It implies that anything restricted anywhere automatically
            belongs to the same moral category. That every prohibition is fundamentally
            about suppressing truth.
          </p>

          <p>History is more complicated than that.</p>

          <p>
            Some censorship suppresses minority voices, political dissent, religion,
            sexuality, or historical memory. Some restrictions exist because material
            directly documents or facilitates abuse. Those are not interchangeable
            categories simply because both involve prohibition.
          </p>

          <p>A serious archive has to distinguish between them.</p>

          <h2>The difference between a list and an archive</h2>

          <p>This is why banned-books.org rejects the iceberg approach entirely.</p>

          <p>An iceberg list says:</p>

          <p><em>this is forbidden.</em></p>

          <p>An archive asks different questions:</p>

          <ul>
            <li>who restricted this work?</li>
            <li>when?</li>
            <li>under what legal or political framework?</li>
            <li>what kind of work is it?</li>
            <li>what role did it play historically?</li>
            <li>what arguments surrounded it?</li>
            <li>who was affected?</li>
          </ul>

          <p>Those are fundamentally different ambitions.</p>

          <p>A list accumulates material.</p>
          <p>An archive contextualizes it.</p>

          <p>A list thrives on ambiguity.</p>
          <p>An archive has to make distinctions, even uncomfortable ones.</p>

          <p>
            And yes, those distinctions are partly editorial. There is no perfectly
            neutral censorship archive. Pretending otherwise is mostly performance.
          </p>

          <p>
            The relevant question is not whether editorial choices exist. The question is
            whether those choices are explicit, defensible, and open to criticism.
          </p>

          <h2>Difficult books still belong in the conversation</h2>

          <p>None of this means censorship archives should only contain &ldquo;safe&rdquo; literature.</p>

          <p>Quite the opposite.</p>

          <p>
            Works such as{' '}
            <Link href="/books/mein-kampf"><em>Mein Kampf</em></Link>,{' '}
            <Link href="/books/the-turner-diaries"><em>The Turner Diaries</em></Link>, or{' '}
            <Link href="/books/the-anarchist-cookbook"><em>The Anarchist Cookbook</em></Link>{' '}
            remain historically significant precisely because they sit at the
            intersection of ideology, fear, censorship, violence, and political
            extremism.
          </p>

          <p>Ignoring difficult books teaches us very little about how societies respond to dangerous ideas.</p>

          <p>
            But documenting such works responsibly requires context: how they circulated,
            how they were used, what legal debates surrounded them, and what violence —
            if any — became associated with them.
          </p>

          <p>That is the work of an archive.</p>

          <p>Not aestheticizing everything forbidden into the same seductive mythology of hidden truth.</p>

          <h2>Why transparency matters</h2>

          <p>Every censorship archive draws lines somewhere.</p>

          <p>Some archives simply avoid admitting it.</p>

          <p>I decided not to do that.</p>

          <p>
            The internet rewards vagueness around forbidden knowledge because vagueness
            creates intrigue. It creates clicks. It creates the feeling that every hidden
            thing must contain some suppressed truth.
          </p>

          <p>History suggests otherwise.</p>

          <p>Some hidden things are hidden because governments fear dissent.</p>
          <p>Some because institutions fear criticism.</p>
          <p>Some because societies panic around religion, politics, race, sexuality, or identity.</p>

          <p>And some are hidden because they are evidence of exploitation, abuse, or violence.</p>

          <p>
            Collapsing all of that into one emotional category may work well for viral
            internet content. It does not work for a serious historical archive.
          </p>

          <p>
            If banned-books.org is going to make editorial choices — and every archive
            inevitably does — then I would rather make those choices visible, arguable,
            and open to criticism than quietly hide them behind the performance of
            neutrality.
          </p>
        </article>
      </EssayLayout>
    </>
  )
}
