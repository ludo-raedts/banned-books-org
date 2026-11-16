import type { Metadata } from 'next'
import Link from '@/components/link'
import EssayLayout from '@/components/essay-layout'
import { essayBySlug, essayMetaDescription } from '@/lib/essays-data'
import { buildCitationMeta } from '@/lib/citation-meta'

const essay = essayBySlug('when-a-list-becomes-a-warning-label')!

export const metadata: Metadata = {
  title: essay.title,
  description: essayMetaDescription(essay),
  openGraph: {
    title: essay.title,
    description: essayMetaDescription(essay),
    type: 'article',
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
  author: { '@type': 'Person', name: 'Ludo Raedts', url: 'https://www.banned-books.org/about' },
  publisher: {
    '@type': 'Organization',
    '@id': 'https://www.banned-books.org/#organization',
    name: 'Banned Books',
    logo: { '@type': 'ImageObject', url: 'https://www.banned-books.org/brand/compact-bb.png' },
  },
  mainEntityOfPage: `https://www.banned-books.org${essay.href}`,
}

const LOOP_ALT =
  'A loop of four steps: a book is removed in one district; the removal is documented in news, records and lists; elsewhere the record is read as a risk signal; the title is flagged and reviewed, which may end in another removal and a longer record. A side branch notes that the same attention can bring the book more readers, sales and library loans.'

export default function WhenAListBecomesAWarningLabelPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EssayLayout essay={essay}>
        <p>
          A book does not have to be read before someone tries to remove it. A title on a
          list, a quotation lifted from another complaint, or a warning from a campaign group
          can be enough to start the process.
        </p>

        <p>
          AI makes that process easier to repeat. It can produce an assessment in minutes,
          complete with passages and the language of a legal standard. The result can look
          like a considered review even when nobody involved has read the book.
        </p>

        <h2>Mason City</h2>

        <p>
          In August 2023, Mason City Community School District in Iowa removed 19 books from
          its libraries. Iowa had just passed Senate File 496, which requires school library
          materials to be &ldquo;age appropriate&rdquo; and excludes depictions of sex acts.
          The district said it had no time to read everything before the school year and that
          the state had given no guidance. So the assistant superintendent put a list of about
          50 frequently challenged books into ChatGPT and asked whether each contained a
          description of a sex act. For 19 the answer was yes. The superintendent
          cross-checked those against BookLooks.org, a site run by parents that reviews books,
          and the books were pulled. According to the district, it had never received a
          parental challenge (
          <a href="https://www.edweek.org/teaching-learning/an-iowa-district-used-ai-to-figure-out-which-books-to-ban/2023/08">Education
          Week</a>).
        </p>

        <p>
          Reporters then tested the tool themselves. The{' '}
          <a href="https://www.inquirer.com/news/nation-world/friday-night-lights-book-ban-iowa-buzz-bissinger-ai-chatgpt-20230818.html">Philadelphia
          Inquirer</a> asked ChatGPT about <em>Friday Night Lights</em> and was told no;
          screenshots it reviewed showed that the chatbot had said yes to the district.{' '}
          <a href="https://www.popsci.com/technology/iowa-chatgpt-book-ban/">Popular Science</a>{' '}
          also received differing answers when it asked about the 19 titles. After the story
          ran, the district reversed the removal of <em>Friday Night Lights</em>. Its author,
          Buzz Bissinger, said: &ldquo;If you&rsquo;re going to ban a book, you might as well
          read it.&rdquo;
        </p>

        <p>
          Mason City is not a story about a campaign. It is a story about an institution under
          legal pressure reaching for the fastest tool. That distinction matters. A book can
          get into trouble through an individual complaint, through an organised campaign that
          spreads forms and title lists, or through an institutional audit in which a district
          screens its own collection, usually because a law or a state agency tells it to. AI
          can play a part in each, but the actor and the decision are different every time.
        </p>

        <h2>The tools</h2>

        <p>
          In 2026, reporting describes a small market. According to{' '}
          <a href="https://www.404media.co/blockade-the-right-is-using-ai-content-scanners-to-try-to-supercharge-book-banning/">404
          Media</a>, <strong>BLOCKADE</strong> is an open-source script that sends a
          book&rsquo;s text to an OpenAI or xAI model and produces a risk report; its prompt
          defines &ldquo;educational inappropriateness&rdquo; as content offensive to
          conservative values. <strong>Rated Books</strong> hosts AI-assisted reports that
          check passages against Utah&rsquo;s &ldquo;harmful to minors&rdquo; standard, and
          its founder is reported to have told members that the AI &ldquo;errs on the side of
          over-application.&rdquo; <strong>NarraTrue</strong> sells a scan for five dollars
          that returns page numbers and excerpts. These tools work with book text or selected
          passages, though how they obtain and assess that material differs.
        </p>

        <p>
          The most interesting product works with something else.{' '}
          <strong>Bookmarked</strong>, which{' '}
          <a href="https://www.k12dive.com/news/as-ai-enters-book-ban-disputes-heres-what-it-means-for-school-districts/816385/">K-12
          Dive</a> reports is used by at least 150 Texas districts, was described by its CEO
          in April 2026 as technology that does not search the contents of books. Instead it
          compared titles with online information: publicity, negative social-media feedback,
          and lists from other districts, Moms for Liberty and PEN America. He said it only
          flags titles and that educators decide, and he acknowledged the risk of relying on
          &ldquo;hearsay.&rdquo; (The company was reportedly working on a version that would
          flag books by content.)
        </p>

        <p>
          Word lists are an older instrument of the same kind. BLOCKADE&rsquo;s scoring starts
          from a list of roughly 300 words. PEN America&rsquo;s recent research on federal
          agencies identified more than 900 unique words and phrases, from &ldquo;bias
          training&rdquo; to &ldquo;feminist&rdquo;, that agencies had banned or flagged for
          review, used to terminate grants and flag applications and publications.
          &ldquo;If your ultimate goal is to suppress the free expression of ideas,&rdquo; PEN
          America&rsquo;s Jonathan Friedman said, &ldquo;then controlling language is a good
          place to start.&rdquo; A list is cheap to apply, and a machine applies it without
          asking what the word is doing in the sentence.
        </p>

        <h2>The paradox of the list</h2>

        <p>
          Here is the mechanism that brings me to this subject. A list that exists to make
          censorship visible records that a book has been challenged somewhere. Used inside a
          different process, the same fact becomes a risk signal: this title has been in
          trouble, so it deserves a look. The more often a book appears on such lists, the
          more opportunities there are for it to be flagged again. If that leads to another
          documented removal, the record can grow, making the title more visible to the next
          district.
        </p>

        <figure className="not-prose my-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/essays/ai-book-bans/loop.svg"
            alt={LOOP_ALT}
            loading="lazy"
            className="w-full max-w-2xl mx-auto"
          />
          <figcaption className="mx-auto mt-2 max-w-2xl text-xs text-neutral-500 leading-relaxed">
            The possible feedback between archives and new reviews, and the attention that can
            run alongside it. Diagram by the author.
          </figcaption>
        </figure>

        <p>
          Attention cuts both ways, and that is what makes the paradox harder to resolve. A
          record that marks a book as targeted also advertises it. When a Tennessee school
          board removed <Link href="/books/maus"><em>Maus</em></Link> from its eighth-grade
          curriculum in January 2022, the book climbed to the top of Amazon&rsquo;s bestseller
          lists within days and a local comic shop handed out free copies to students (
          <a href="https://www.cnbc.com/2022/01/28/maus-amazon-bestseller-after-tennessee-school-ban.html">CNBC</a>).
          Researchers have started to measure the effect. A{' '}
          <a href="https://www.infodocket.com/2023/10/31/increased-circulation-book-bans-may-have-unintended-consequences-in-increasingly-polarized-united-states/">Carnegie
          Mellon working paper</a> using library circulation data from 38 states, covering
          January 2021 to June 2022, found that ban events raised circulation of the banned
          books, by about 12 percent in states where they were banned and about 11 percent
          where they were not. The gains were concentrated among lesser-known authors, and
          books with little social-media visibility saw no effect. A{' '}
          <a href="https://business.gmu.edu/news/2025-03/book-bans-are-not-what-they-seem">separate
          paper</a> reports a rise of about 12 percent in circulation for the most-banned
          titles and a better Amazon sales rank. Both are recent, one is a working paper, and
          both measure circulation and sales rank, not total readership.
        </p>

        <p>
          So a list can send some readers toward a book while helping others decide it is
          risky. The two effects do not cancel out. The reader who gains a bestseller is not
          the student in the district where the book is no longer on the shelf.
        </p>

        <p>
          This does not require AI, and it does not require a villain. Florida shows the
          institutional version. According to{' '}
          <a href="https://www.wlrn.org/education/2026-10-22/palm-beach-county-schools-banned-books-libraries">WLRN</a>,
          which worked from public documents, Palm Beach County Public Schools had more than
          1,830 unique titles under review in an audit in autumn 2026, after a state
          Department of Education memo urged districts to review their libraries proactively,
          including books removed elsewhere in the state and frequently challenged authors. If
          a school held a title on the list, staff were instructed to remove it from student
          access while it was assessed. WLRN could not establish how many of those titles were
          actually on school shelves when the review began, and, according to WLRN, parents in
          the district had not submitted objections to school library books in the previous
          two years. WLRN did not report that AI was used. The case shows how earlier removals
          can steer a new audit, regardless of the technology involved.
        </p>

        <p>
          We build that kind of record. This catalogue holds tens of thousands of ban records,
          and its <Link href="/dataset">open dataset</Link> is licensed CC BY 4.0 so teachers,
          journalists and researchers can use it. I cannot say that any tool uses our data,
          and I have no evidence that one does. But I cannot make the data open for people I
          approve of and closed for everyone else. A book&rsquo;s presence in an archive of
          censorship is a reason to read about it. Nothing in the data says it is a reason to
          remove it, and I should say that on the dataset&rsquo;s own page.
        </p>

        <h2>What the complaints show, and what they do not</h2>

        <p>
          The same openness helps in the other direction, because the strongest evidence about
          who is asking for bans comes from people who read records.
        </p>

        <p>
          <a href="https://www.washingtonpost.com/education/2023/12/23/post-reviewed-1000-school-book-challenges-heres-what-we-found/">The
          Washington Post</a> obtained 1,065 school book challenges from more than 100
          districts in 37 states. In its analysis of complaints from the 2021&ndash;22 school
          year, the newspaper reported that 11 people were responsible for 60 percent of the
          filings it examined. In Florida, the Tampa Bay Times reported in August 2023 (
          <a href="https://pineapplereport.com/florida-schools-got-hundreds-of-book-complaints-mostly-from-2-people/">reprinted
          here</a>) that two people were behind roughly 600 of about 1,100 complaints filed in
          the year after July 2022, in the 62 districts that responded.{' '}
          <a href="https://pen.org/report/banned-usa-growing-movement-to-censor-books-in-schools/">PEN
          America</a> reports that organised groups often supply messaging, forms and
          instructions that make challenges easier to file, and that books banned in one
          district are frequently banned in others. In Wisconsin, one parent challenged 444
          books, which were temporarily removed pending review. They were later returned to
          circulation, although some were restricted or moved to different libraries (
          <a href="https://ncac.org/letters/ncac-recommends-policy-improvements-for-a-wisconsin-school-district-that-received-over-400-book-challenges">National
          Coalition Against Censorship</a>).
        </p>

        <p>
          These findings come from particular datasets and districts. They do not show that
          most challenges in the United States come from a few people, and they say nothing
          about how many parents support or oppose a removal. They show who filed the forms
          that were examined. That matters because a small number of people can generate a
          large volume of complaints, and each complaint may require a school or district to
          respond.
        </p>

        <h2>What AI could contribute</h2>

        <p>
          Obtaining and reading those records takes time. AI may help researchers work through
          them, provided that people check the results.
        </p>

        <p>
          Language models and text-similarity methods are good at comparing large piles of
          documents. Applied to challenge forms obtained through public-records requests, they
          could cluster near-identical wording and show which complaints share a template. They
          could also help researchers follow how groups of titles appear together in several
          districts. A shared passage or shared title list suggests a common source, though not
          which one: someone could have used the source and read the book as well, and a record
          may be dated after the list was already circulating.
        </p>

        <p>
          Everything depends on people checking the matches. Records are incomplete, not every
          district keeps or releases forms, and the same person can appear under different
          spellings while two people share a name. Any claim about concentration should start
          from aggregated counts, and anything naming individuals needs care about privacy and
          about the risk of pointing readers at people who have received threats. And when we
          test the AI scanners themselves, the test should rest on independent human assessment
          against stated criteria, not on a second model prompt.
        </p>

        <h2>The responsibility of an archive</h2>

        <p>
          I will keep the dataset open. I also need to be clear about what it records: a
          decision made somewhere, at a particular time, under particular circumstances. A
          book&rsquo;s presence in the archive is not a judgment on whether it belongs in a
          library.
        </p>

        <p>
          The record can show us where to start looking. Understanding what happened still
          takes people willing to read it.
        </p>

        <p className="text-sm text-neutral-500">
          Sources are linked in the text. The Tampa Bay Times figures are cited through a
          reprint; the PEN America word-list research is described in{' '}
          <a href="https://www.instagram.com/penamerica/">PEN America&rsquo;s own post</a>.
          See also <Link href="/methodology">our methodology</Link>.
        </p>
      </EssayLayout>
    </>
  )
}
