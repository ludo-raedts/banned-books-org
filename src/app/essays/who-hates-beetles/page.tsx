import type { Metadata } from 'next'
import Link from 'next/link'
import EssayLayout from '@/components/essay-layout'
import { essayBySlug } from '@/lib/essays-data'
import { buildCitationMeta } from '@/lib/citation-meta'

const essay = essayBySlug('who-hates-beetles')!

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

export default function WhoHatesBeetlesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EssayLayout essay={essay}>
          <h2>The book about beetles</h2>

          <p>
            There is a book in this catalogue called{' '}
            <Link href="/books/insect"><em>Insect</em></Link>. It is a DK Eyewitness
            reference, the kind of large-format paperback that has sat on primary-school
            shelves for thirty years: close-up photographs of a stag beetle&rsquo;s jaws, a
            cutaway of a honeybee, a spread on how a dragonfly&rsquo;s wings work. It teaches
            a seven-year-old the difference between an exoskeleton and a spine. And it is, by
            the record, a banned book — pulled from school libraries in two Florida counties.
          </p>

          <p>
            I checked it three times. I assumed it was a data error — a title collision, a
            stray import, a novel with a misleadingly literal name. It was not.{' '}
            <em>Insect</em> is in the catalogue because PEN America&rsquo;s Index of School
            Book Bans lists it: removed in the School District of Manatee County, restricted
            in Hillsborough County. The book about beetles really did come off the shelf.
          </p>

          <p>
            The question that arrives first is almost funny. Who hates beetles? What parent
            stood up at a school-board meeting and demanded their child be protected from a
            photograph of a ladybird? What worldview is threatened by a diagram of a moth?
          </p>

          <p>
            The answer is the part that stops being funny. <strong>No one objected to the
            beetles.</strong> And that is worse than if someone had.
          </p>

          <h2>Two kinds of banning</h2>

          <p>
            Spend long enough with records of banned books and a pattern sorts itself: the
            bans aimed at fiction are almost always arguments about feeling. Someone
            encountered a novel and did not like what it made them feel, or feared what it
            would make a child feel.{' '}
            <Link href="/books/the-bluest-eye"><em>The Bluest Eye</em></Link> makes you sit
            inside an unbearable thing.{' '}
            <Link href="/books/gender-queer"><em>Gender Queer</em></Link> puts a body and a
            desire on the page.{' '}
            <Link href="/books/to-kill-a-mockingbird"><em>To Kill a Mockingbird</em></Link>{' '}
            uses a word that wounds. Trace nearly any challenge to a fiction title back far
            enough and you reach a feeling someone wanted to prevent: discomfort, arousal,
            fear, recognition, grief.
          </p>

          <p>
            The discomfort is often real, and the people feeling it are not cartoons. A
            parent who does not want their eleven-year-old to meet explicit sex in a school
            library is not a book-burner. There is a genuine debate about what belongs on
            which shelf at which age, and that debate is legitimate. What is not legitimate
            is the answer — <em>ban it, for everyone</em> — when the honest tool is a
            conversation about placement, context, and choice. But it is at least a debate
            about values, and two people who hold different values about what a child should
            feel can disagree in good faith.
          </p>

          <p>
            Banning a book of facts is a different act entirely. <em>Insect</em> does not
            make anyone feel anything. It takes no position. It contains no values to
            dispute — only information about how the natural world is put together. To remove
            it is not to win an argument about what a child should feel. It is to decide what
            a child is permitted to <em>know</em>.
          </p>

          <p>
            That is the line. Banning fiction polices the imagination. Banning nonfiction
            polices reality.
          </p>

          <h2>The trend behind the anecdote</h2>

          <p>
            One beetle book is an anecdote. The trend is not. In May 2026 PEN America
            published <em>Facts &amp; Fiction: Stories Stripped Away by Book Bans</em>, an
            analysis of the 3,743 unique titles removed from US school libraries and
            classrooms between July 2024 and June 2025. Of those, 1,102 — twenty-nine
            percent — were nonfiction, more than double the number banned the year before.
            Not novels someone found indecent: history, health, biography, memoir, general
            knowledge. PEN named the trend plainly. It called it &ldquo;an embrace of
            anti-intellectualism.&rdquo;
          </p>

          <p>
            Read the topics climbing the list and the shape comes into focus. Among the
            most-targeted were violence, death and grief, and — the one I keep returning to —
            &ldquo;empowerment and self-esteem.&rdquo; Books that tell a child they are
            capable. Biographies of people who fought back. The censorship is no longer aimed
            only at what is arousing or frightening. It is aimed at what is true and
            inconvenient: the history of a riot, the existence of a body part, the record of
            a movement, the plain fact that the world holds more kinds of people, and more
            kinds of animals, than a given shelf has been authorized to admit.
          </p>

          <h2>How a beetle book disappears</h2>

          <p>
            So return to the question. If no one hates beetles, how does <em>Insect</em> come
            off the shelf?
          </p>

          <p>
            Through a law that requires no one to hate anything. In 2022 Florida passed
            HB 1467, mandating that every book available to students be vetted by a certified
            media specialist. The intent was framed as oversight. The effect, when it reached
            classrooms in January 2023, was that any book <em>not yet vetted</em> had to be
            treated as forbidden. In Manatee County, teachers covered their classroom
            libraries with paper and trash bags, or emptied the shelves, because the
            alternative — leaving an unapproved book within a child&rsquo;s reach — carried
            the threat of felony prosecution. Among the casualties that month:{' '}
            <em>Dragons Love Tacos</em>. <em>Sneezy the Snowman</em>. A reference book about
            insects.
          </p>

          <p>
            This is the mechanism, and it is the thing to take from this page. The modern
            apparatus of book banning has reached the point where it no longer needs an
            objection. It needs only a default. Flip the default from{' '}
            <em>permitted unless removed</em> to <em>forbidden unless approved</em>, attach a
            penalty severe enough, and you never have to send anyone to hate the beetles. The
            beetles vanish on their own, swept up as collateral, because a frightened
            institution will always over-remove rather than risk being wrong. Pre-emptive
            compliance does the censoring that no censor would sign their name to. No one had
            to decide that a child should not learn about insects. Someone only had to decide
            that no one had yet been cleared to teach it.
          </p>

          <p>
            And a censorship that needs no objection also leaves no fingerprints. This is the
            property that makes fact-banning so much quieter than the banning of a famous
            novel. The novel survives — in print, fought over, remembered; denial is
            impossible because everyone can still point at it. The beetle book is one of
            3,743 titles pulled in a single year, obscure, unnewsworthy, gone. Remove it and
            remove nothing anyone will miss, and the removal becomes unfalsifiable:{' '}
            <em>no one ever banned a book about insects; don&rsquo;t be absurd.</em> A ban
            that is never recorded is a ban that can be denied — and a fact that disappears
            without a record does not look banned. It looks like it was never there.
          </p>

          <p>
            Which is why the answer to a removal that needs no hatred and leaves no trace is
            the one thing it cannot survive: being written down. <em>Insect</em>, a DK
            Eyewitness reference, photographs of a stag beetle&rsquo;s jaws — removed in
            Manatee County, restricted in Hillsborough, PEN America&rsquo;s Index as the
            source. Not because it is a great book. Because the measure of how far a
            censorship movement has travelled is not whether it can bring itself to ban the
            dangerous book. It is whether it can make a child&rsquo;s book about beetles
            disappear without anyone intending to — and whether anyone bothered to notice it
            was gone.
          </p>

          <p>
            Who hates beetles? No one. That was never the point. It no longer takes hatred to
            ban a book — only a default, a penalty, and a shelf no one is brave enough to
            defend. The least we can do is refuse the last step and keep the list.
          </p>
      </EssayLayout>
    </>
  )
}
