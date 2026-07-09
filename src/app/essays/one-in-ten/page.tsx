import type { Metadata } from 'next'
import Link from 'next/link'
import EssayLayout from '@/components/essay-layout'
import { essayBySlug } from '@/lib/essays-data'
import { buildCitationMeta } from '@/lib/citation-meta'

const essay = essayBySlug('one-in-ten')!

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

export default function OneInTenPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EssayLayout essay={essay}>
        <h2>A boy and a skunk</h2>

        <p>
          There is a book in this catalogue called{' '}
          <Link href="/books/a-boy-called-bat"><em>A Boy Called Bat</em></Link>. Bixby
          Alexander Tam &mdash; &ldquo;Bat&rdquo; for short &mdash; is a third-grader who
          lines his crayons up by colour, covers his ears when the world gets too loud, and
          wants nothing in the world so much as to keep the orphaned baby skunk his mother, a
          vet, has brought home. That is the book. It is a chapter book for seven-year-olds
          about a boy on the autism spectrum learning to look after something small. There is
          nothing in it for anyone to object to. And it has been removed from American school
          libraries.
        </p>

        <p>
          I noticed it because of the company it keeps.{' '}
          <Link href="/books/out-of-my-mind"><em>Out of My Mind</em></Link> &mdash; Melody,
          eleven, cerebral palsy, brilliant, unable to speak until a machine gives her a
          voice. <Link href="/books/wonder"><em>Wonder</em></Link> &mdash; Auggie, a facial
          difference, walking into fifth grade.{' '}
          <Link href="/books/handle-with-care"><em>Handle with Care</em></Link> &mdash; a
          family, brittle-bone disease, a lawsuit that breaks them apart. Earnest, gentle
          books, the kind a teacher slides across a desk to a child who feels like the only
          one. All of them, by the record, banned.
        </p>

        <h2>One in ten</h2>

        <p>
          The pattern is not an anecdote. Analysing the 3,743 titles pulled from US schools
          across the 2024&ndash;2025 school year,{' '}
          <a href="https://pen.org/book-bans/pen-america-index-of-school-book-bans-2024-2025/" target="_blank" rel="noopener noreferrer">
            PEN America
          </a>{' '}
          found that 377 of them &mdash; one in ten &mdash; featured a character who is
          disabled or neurodivergent: stories, in PEN&rsquo;s own summary, about confidence,
          self-esteem, and living with ableism.
        </p>

        <p>
          Set against Disability Pride Month, the number reads like a verdict: the shelf is
          being cleared of disabled kids. But the honest story is more complicated than that,
          and the complication matters &mdash; because getting it wrong hands the people
          doing the removing an easy denial.
        </p>

        <h2>Counted is not the same as targeted</h2>

        <p>
          Most of these books were not removed <em>for</em> their disabled character.{' '}
          <Link href="/books/to-kill-a-mockingbird"><em>To Kill a Mockingbird</em></Link>{' '}
          belongs on the list &mdash; Boo Radley, Tom Robinson&rsquo;s withered arm &mdash;
          but it is challenged over a racial slur, not over either of them.{' '}
          <Link href="/books/push"><em>Push</em></Link> is there &mdash; Precious can barely
          read &mdash; but it is pulled for incest and sexual abuse so raw that reasonable
          people argue about where it belongs.{' '}
          <Link href="/books/everything-everything"><em>Everything, Everything</em></Link> and{' '}
          <Link href="/books/say-what-you-will"><em>Say What You Will</em></Link> carry
          first love as much as illness. Again and again, the disabled character is simply
          present in a book that was flagged for something else.
        </p>

        <p>
          So the ten percent is not ten percent of bans motivated by disability. It is the
          rate at which disabled characters happen to live inside books targeted for other
          reasons. That distinction is worth being exact about. The disabled child in these
          stories is rarely the thing someone set out to remove. They are the passenger in a
          car stopped for a different offence &mdash; and they vanish all the same.
        </p>

        <h2>And then the ones no one can explain</h2>

        <p>
          A careful accounting leaves a residue, and the residue is the part that should
          unsettle everyone. Strip out the books removed for sex, for slurs, for violence,
          and you are still left with{' '}
          <Link href="/books/a-boy-called-bat"><em>A Boy Called Bat</em></Link>. With{' '}
          <Link href="/books/out-of-my-mind"><em>Out of My Mind</em></Link>. With{' '}
          <Link href="/books/wonder"><em>Wonder</em></Link>. Books whose entire content is a
          disabled child being an ordinary child. There is no scene to point at, no word to
          circle. There is nothing to object to &mdash; and they came off the shelf anyway.
        </p>

        <p>
          Elsewhere on this site I have argued that the modern machinery of book-banning has
          stopped needing an objection at all (see{' '}
          <Link href="/essays/who-hates-beetles"><em>Who hates beetles?</em></Link>). Flip a
          library&rsquo;s default from <em>permitted unless removed</em> to{' '}
          <em>forbidden unless approved</em>, attach a penalty for guessing wrong, and a
          nervous district will over-remove rather than risk it. No one has to hate Bat. He
          is swept up with everything else, quietly, by a rule that never mentions him. A
          censorship that needs no objection is exactly the censorship that can erase a boy
          and his skunk without anybody deciding to.
        </p>

        <h2>What actually goes missing</h2>

        <p>
          Whichever way a given book left the shelf &mdash; collateral or clearance &mdash;
          the loss lands in the same place. For a child who uses a wheelchair, a
          communication device, a routine no classmate shares, these books are often the only
          place they meet someone like themselves who is not a lesson or a tragedy but a
          protagonist: funny, stubborn, wanting a skunk. Representation is not a slogan here.
          It is the difference between a kid finding their own life on the shelf and not
          finding it. Remove the book and you have not won an argument about values. You have
          returned that child to being the only one.
        </p>

        <p>
          None of this makes every reader who questions a book a censor. A parent weighing
          whether <em>Push</em> belongs in a middle-school library is having a real
          conversation, and it deserves a real answer &mdash; one about placement, age, and
          choice, not removal for everyone. But a chapter book about a boy with autism is not
          that conversation. When <em>A Boy Called Bat</em> comes off the shelf, no argument
          has been won. A child has only been told, without anyone quite saying it, that
          there was not room for him.
        </p>

        <p>
          PEN counts 377 of them in a single year. Some were targeted, most were collateral,
          a few defy any account but the plainest &mdash; that a disabled child in a book is
          easier to remove than to defend. The figure grows every year. The least a catalogue
          can do is write down which books they were, and who was inside them, so the
          disappearance leaves a mark. Bat wanted to keep the skunk. The record can at least
          keep Bat.
        </p>
      </EssayLayout>
    </>
  )
}
