import type { Metadata } from 'next'
import Link from 'next/link'
import EssayLayout from '@/components/essay-layout'
import { essayBySlug } from '@/lib/essays-data'

const essay = essayBySlug('the-grey-zone')!

const NOS_SOURCE_URL =
  'https://nos-nl.translate.goog/artikel/2613565-nederlandse-strip-met-gewelddadige-seksuele-fantasieen-van-leeslijst-belgische-school?_x_tr_sl=it&_x_tr_tl=en&_x_tr_hl=nl&_x_tr_pto=wapp&_x_tr_hist=true'

export const metadata: Metadata = {
  title: essay.title,
  description: essay.dek,
  openGraph: { title: essay.title, description: essay.dek, type: 'article' },
  alternates: { canonical: essay.href },
  robots: essay.draft ? { index: false, follow: true } : undefined,
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

export default function TheGreyZonePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EssayLayout essay={essay}>
        <article className={proseClasses}>
          <p>
            A secondary school in Antwerp{' '}
            <a href={NOS_SOURCE_URL} target="_blank" rel="noopener noreferrer">
              recently removed a graphic novel from its reading list
            </a>{' '}
            after a parent complained about drawings depicting violent sexual
            fantasies. The book is <em>Iedereen op Claudia</em> by Dutch artist
            Sam Peeters, and it had been on the list — a curated selection of
            sixty graphic novels — for three years without a single complaint.
            The list itself was assembled in 2018 by Margreet de Heer, the Dutch
            <em> Stripmaker des Vaderlands</em>, alongside other contributors,
            specifically to give schools an alternative to <em>Donald Duck</em>
            {' '}and <em>Suske en Wiske</em>.
          </p>

          <p>
            When I started banned-books.org, I assumed cases like this would
            form the core of the database. They will not. And the reason why
            says something important about the project itself.
          </p>

          <p>
            At first glance, the Antwerp case looks exactly like a banned-book
            story. A school. A book. A removal. A parent who said{' '}
            <em>&ldquo;Ik vraag me af of deze inhoud geschikt is voor een
            14-jarige.&rdquo;</em> From there it is tempting to slot the case
            into the familiar narrative of institutional censorship.
          </p>

          <p>But the details resist that narrative.</p>

          <h2>What the author said</h2>

          <p>
            The most striking detail is what the author himself said. Sam
            Peeters supports the school&apos;s decision. He calls it a great
            honour that the book is on the list, but he would not put it in
            front of readers under seventeen or eighteen without careful
            guidance from someone who can explain the work. He teaches comic
            design at ArtEZ in Zwolle, and even with his own students he
            insists on context first. The protagonist, he explains, becomes
            obsessed with a girl in his class, and his fantasies turn — in his
            words — <em>&ldquo;gruwelijk toxisch&rdquo;</em> and violent.
            Peeters rejects the idea that the drawings are pornographic. They
            are deliberately extreme: a portrait of a sick mind, not an
            invitation to arousal.
          </p>

          <p>
            That position complicates the censorship framing in a useful way.
            The person whose work was removed agrees the work needs gatekeeping
            at this age. He disagrees only with the idea that the book itself
            is the problem.
          </p>

          <h2>What the curator said</h2>

          <p>
            De Heer, who put the list together, takes a different view. She
            argues that the school cannot reasonably claim ignorance: the
            accompanying guide states explicitly that obsession and sexuality
            are central themes, and one of the discussion questions asks
            students how they recognise the moment when reality slides into
            fantasy. Her objection is not that fourteen-year-olds must read
            this book. Her objection is that the institution failed to do its
            homework before adopting the list, and is now correcting that
            failure by removing the book rather than by teaching it properly.
          </p>

          <p>
            This is the actual debate. It is not censorship versus freedom. It
            is a disagreement about institutional responsibility, pedagogical
            preparation, and the difference between curating a reading list
            and supervising what happens after a book is chosen.
          </p>

          <h2>Why this case will not enter the database</h2>

          <p>
            The database documents books that were formally banned, challenged,
            or restricted in ways that are publicly verifiable and structurally
            significant — government bans, criminal prohibitions, system-wide
            removals, organised pressure campaigns, library policies that
            affect entire jurisdictions. A single school correcting a
            curatorial oversight, with the author&apos;s own backing, does not
            meet that threshold. If it did, the threshold would mean nothing.
            Every ordinary curriculum decision would count as a ban, and the
            archive would lose the ability to show readers what serious
            censorship actually looks like.
          </p>

          <p>
            But excluding the case from the database is not the same as
            ignoring it. The harder questions about cultural visibility rarely
            arrive as dramatic confrontations. They arrive as quiet
            institutional choices made by people who believe they are acting
            responsibly — and who often are. Schools choose. Publishers choose.
            Libraries choose. Prize juries choose. Most of these choices are
            defensible. Some are not. The pattern only becomes visible when you
            look across many of them at once.
          </p>

          <p>
            Historically, books that were later formally banned often
            disappeared first through smaller decisions of exactly this kind.
            That is worth taking seriously. It is also worth resisting,
            because the same logic — every removal is a step toward censorship
            — collapses every editorial judgement into a moral panic. Both
            failures are real. Treating them as the same failure is a mistake.
          </p>

          <h2>The grey zone</h2>

          <p>
            What makes the Antwerp case worth writing about, then, is not that
            it belongs in a censorship archive. It is that all four parties —
            the parent, the school, the curator, the author — articulated
            coherent and partly conflicting positions about what a
            fourteen-year-old should encounter at school and under what
            conditions. None of them reached for the language of free speech
            or the language of protection-from-harm in its purest form. They
            argued about preparation, context, age, and supervision.
          </p>

          <p>
            That is the grey zone. And the grey zone is where the harder
            thinking has to happen, long before anything is officially
            forbidden.
          </p>
        </article>
      </EssayLayout>
    </>
  )
}
