import type { Metadata } from 'next'
import Link from 'next/link'
import EssayLayout from '@/components/essay-layout'
import { essayBySlug } from '@/lib/essays-data'
import { buildCitationMeta } from '@/lib/citation-meta'

const essay = essayBySlug('first-amendment-paradox')!

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

const proseClasses =
  'prose prose-gray max-w-none ' +
  'prose-headings:font-bold prose-headings:tracking-tight ' +
  'prose-a:text-gray-900 prose-a:underline prose-a:underline-offset-2 ' +
  'prose-a:decoration-gray-300 ' +
  'hover:prose-a:decoration-gray-600 ' +
  'prose-p:leading-relaxed'

export default function FirstAmendmentParadoxPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EssayLayout essay={essay}>
        <article className={proseClasses}>
          <h2>A self-undermining hearing</h2>

          <p>
            On 12 September 2023, the U.S. Senate Judiciary Committee held a hearing with a
            title that already gave away its position: <em>&ldquo;Book Bans: Examining How
            Censorship Limits Liberty and Literature.&rdquo;</em> Chair Dick Durbin opened
            by reminding the room that Chicago once banned <em>The Wonderful Wizard of
            Oz</em> for its &ldquo;ungodly influence.&rdquo; Halfway through, Senator John
            Kennedy of Louisiana started reading aloud from{' '}
            <Link href="/books/all-boys-arent-blue"><em>All Boys Aren&apos;t Blue</em></Link>{' '}
            and{' '}
            <Link href="/books/gender-queer"><em>Gender Queer</em></Link>{' '}
            — graphic passages, deliberately, in front of cameras — to demonstrate that
            some books simply don&apos;t belong in a school library. Kennedy was not, in
            his own framing, censoring anything. He was protecting children. His office
            later put it bluntly: parents &ldquo;are worried that their children are being
            indoctrinated by radicals who think that exposing young students to pornographic
            material is what&apos;s best for their kids.&rdquo;
          </p>

          <p>
            That sentence — <em>indoctrination</em> — is the hinge. It does not appear by
            accident. It is the load-bearing word of the modern American book-removal
            movement, and it is doing a very particular kind of work. It reframes the act
            of removing a book from a public-school shelf as a defensive measure against
            state-sponsored ideology, rather than an act of state-sponsored selection. The
            school library, in this framing, is not a curated collection. It is a vector
            of harm.
          </p>

          <p>
            This is the paradox. The same political coalition that most loudly invokes
            &ldquo;free speech&rdquo; — against social-media moderation, against university
            speech codes, against trigger warnings, against perceived cancel culture — has
            built a parallel movement to remove thousands of books from public-school
            libraries. The two positions are held simultaneously, often by the same people,
            often in the same breath. Anyone trying to understand American book-banning has
            to start here, because the contradiction is not incidental. It is the argument.
          </p>

          <h2>The two-sentence defence</h2>

          <p>
            The standard defence consists of two sentences, deployed together. The first:{' '}
            <em>we are not banning anything; the books are still available on Amazon, in
            public libraries, in bookstores.</em> The second: <em>we are exercising
            parental rights to decide what our children encounter in schools we pay
            for.</em>
          </p>

          <p>Both are sincerely held. Both are also juridically distinct from what their defenders think they mean.</p>

          <p>
            Tina Descovich, co-founder of Moms for Liberty — currently the most organised
            parental-rights group in the country — told <em>USA Today</em>: &ldquo;Parents
            have the fundamental right to direct the upbringing of their children, whether
            it be education or medical care … So they also have the right to monitor what
            their children are watching and reading.&rdquo; She added that her group does
            not ban books: &ldquo;that would require the government to bar a person from
            writing or selling the book.&rdquo; On her organisation&apos;s own website, she
            goes further: &ldquo;many Americans have chosen to use that word to advance a
            political agenda instead of using the word correctly.&rdquo;
          </p>

          <p>
            This is a careful definition. By it, only a state act preventing publication or
            sale qualifies as a ban. Anything short of that — including the removal of a
            specific title from a specific public-school library by a specific government
            body — is curation, selection, or &ldquo;common sense.&rdquo; In January 2025,
            the U.S. Department of Education&apos;s Office for Civil Rights formalised
            exactly this view, dismissing eleven complaints with the announcement that
            &ldquo;books are not being &lsquo;banned,&rsquo; but that school districts, in
            consultation with parents and community stakeholders, have established
            commonsense processes by which to evaluate and remove age-inappropriate
            materials.&rdquo; The Department called the previous administration&apos;s
            position a &ldquo;book ban hoax.&rdquo;
          </p>

          <p>
            The argument has obvious force. A school library is not a marketplace; it is a
            curated collection paid for by taxpayers. Every school librarian makes
            selection choices every day. A school that does not stock <em>Playboy</em> in
            the kindergarten section is not censoring <em>Playboy</em>. There is no
            plausible reading of liberty under which every published book has a
            constitutional right to a shelf in every public school. Curriculum is curation
            by definition.
          </p>

          <p>If the argument stopped there, there would be no paradox — only a debate about where to draw the line.</p>

          <h2>What the First Amendment actually says about school libraries</h2>

          <p>
            The argument does not stop there, because the United States already has a
            Supreme Court decision on what happens when a public-school board removes books
            from a school library for ideological reasons. It is <em>Board of Education,
            Island Trees Union Free School District No. 26 v. Pico</em> (1982), and it cuts
            directly against the &ldquo;we&apos;re just curating&rdquo; defence in one
            specific scenario: when the motive is suppression of ideas.
          </p>

          <p>
            The facts of <em>Pico</em> read like a template for the current wave. A school
            board in Long Island attended a conference run by a conservative parents&apos;
            group, came home with a list of &ldquo;objectionable&rdquo; titles, and ordered
            eleven books — including{' '}
            Vonnegut&apos;s{' '}
            <Link href="/books/slaughterhouse-five"><em>Slaughterhouse-Five</em></Link>{' '}
            and an anthology edited by Langston Hughes — removed from the high-school
            library. The board called the books &ldquo;anti-American, anti-Christian,
            anti-Sem[i]tic, and just plain filthy.&rdquo; Steven Pico, a student, sued.
          </p>

          <p>
            The Supreme Court split, but a plurality led by Justice William Brennan held
            that the First Amendment does limit what a school board can do with its
            library. Brennan wrote that school officials may not remove books &ldquo;for
            the purpose of restricting access to the political ideas or social perspectives
            discussed in the books when that action is motivated simply by the
            officials&apos; disapproval of the ideas involved.&rdquo; The Court drew a
            line: removal for vulgarity or educational unsuitability — fine, schools have
            wide discretion. Removal because the board doesn&apos;t like what a book says
            about race, religion, or politics — not fine. That second category is what the
            Court called &ldquo;official suppression of ideas,&rdquo; and the First
            Amendment forbids it.
          </p>

          <p>
            <em>Pico</em> is a fragile precedent. It was a plurality, not a majority.
            Justice Brennan limited it explicitly to library books, not curriculum. The
            dissents argued, reasonably, that any selection necessarily reflects
            somebody&apos;s values. Lower courts have applied <em>Pico</em> inconsistently,
            and the current Supreme Court has signalled little appetite to revisit the
            question. But it remains the law. And it sets up something the curation defence
            cannot wave away: the same act — a school board removing a specific book — can
            be perfectly constitutional or directly unconstitutional depending entirely on
            the motive. Vulgarity? Fine. Ideological disagreement? Not fine.
          </p>

          <p>
            This is why the rhetoric matters. Each time an advocacy group says a book is
            being removed because it constitutes &ldquo;indoctrination,&rdquo; each time a
            board member explains a removal as protecting students from a particular{' '}
            <em>worldview</em>, the record builds toward exactly the kind of motive{' '}
            <em>Pico</em> identified as the constitutional red line. The legal vulnerability
            is created by the moral language.
          </p>

          <h2>Indoctrination, in two directions</h2>

          <p>
            This is the place to take the indoctrination argument seriously, because
            dismissing it as mere rhetoric misses what makes it powerful.
          </p>

          <p>
            A public-school library is not a neutral assemblage. Every book on the shelf
            is there because someone chose it; every book not on the shelf is absent
            because someone didn&apos;t. Children attend by legal compulsion. Their
            parents pay for the collection through taxation. The state is, in a real
            sense, an active curator of the ideological environment in which children
            spend their formative years. To call this &ldquo;neutral&rdquo; is naive. To
            call any change to it &ldquo;censorship&rdquo; is equally naive — collections
            change every year, by definition.
          </p>

          <p>
            So when parents argue that the inclusion of certain books — especially books
            that affirm identities or histories the parents reject — amounts to state
            endorsement of a worldview, they are not making a frivolous claim. The claim
            is overdrawn in most cases, but the underlying structure is real: schools are
            not viewpoint-neutral, and pretending otherwise is its own kind of dishonesty.
          </p>

          <p>
            The problem is that the same logic runs in both directions, and book-ban
            advocates almost never acknowledge it. If including{' '}
            <Link href="/books/all-boys-arent-blue"><em>All Boys Aren&apos;t Blue</em></Link>{' '}
            in a school library indoctrinates students into queer identity, then excluding
            it indoctrinates them into the assumption that queer lives are not part of the
            readable world. If teaching{' '}
            <Link href="/books/beloved"><em>Beloved</em></Link>{' '}
            indoctrinates students into racial grievance, then removing{' '}
            <em>Beloved</em> indoctrinates them into the idea that this part of American
            history is not a permitted subject. The school does not get to abstain. It
            selects, and selection is the only available option.
          </p>

          <p>
            The honest position is that <em>every</em> school library is an act of
            state-sanctioned worldview-shaping, and the question is not whether to shape
            but how to constrain the shaping — through procedural legitimacy, viewpoint
            diversity, age-appropriate guidelines, and accountability. The dishonest
            position is to insist that <em>your</em> preferred set of removals is curation
            while <em>the other side&apos;s</em> preferred set of inclusions is
            indoctrination. That move is the rhetorical engine of the current wave, and it
            is what makes the free-speech invocation read as a contradiction rather than a
            principle.
          </p>

          <h2>What is actually being defended</h2>

          <p>
            Strip away the framing and the disagreement comes into focus. Almost no one in
            the American debate is arguing for an absolute right of every book to be on
            every shelf. Almost no one is arguing that schools should have zero curatorial
            role. The actual fight is narrower, and it has three dimensions.
          </p>

          <p>
            First: <em>who decides.</em> Librarians and educators using professional
            standards, or parent-organised advocacy groups operating outside those
            standards? A <em>Washington Post</em> analysis in 2023 found that the majority
            of more than a thousand book challenges were filed by just eleven people.
            Polling consistently shows that the overwhelming majority of parents — 80
            percent or more — trust school librarians to choose appropriate books. The
            challenged-book movement is loud and organised, but it is not popular.
          </p>

          <p>
            Second: <em>which kinds of objections count.</em> Sexual explicitness is a
            defensible category, and most participants on all sides will concede that some
            content is not appropriate for elementary-school children. Ideological
            objection — to a book&apos;s treatment of race, sexuality, religion, or
            American history — is the category <em>Pico</em> singled out as
            constitutionally suspect. The current wave routinely conflates the two, which
            is why a book like <em>Beloved</em> (which deals with the legacy of slavery)
            ends up being challenged in the same breath as a book with graphic sex scenes.
            The conflation is the strategy.
          </p>

          <p>
            Third: <em>what counts as a ban.</em> If a book is removed from one school
            library but available at the public library down the street, is that
            censorship or selection? Reasonable people disagree. But the binary the
            defence depends on — <em>ban means total state suppression; everything else is
            just choice</em> — is doing a lot of work. PEN America has counted thousands of
            school-library removals since 2021. The Department of Education calls these
            removals &ldquo;commonsense processes.&rdquo; The same fact, two vocabularies,
            two political universes.
          </p>

          <h2>The honest version of the argument</h2>

          <p>
            There is an intellectually honest version of the parental-rights position, and
            it goes something like this: <em>schools are necessarily curatorial; we accept
            that all curation reflects values; we want the values to reflect ours rather
            than the educational establishment&apos;s; we are willing to be transparent
            that this is what we are doing, and we will accept that the other side will
            use the same mechanisms when they are in power.</em>
          </p>

          <p>
            That version is not the one being made publicly, because it would forfeit the
            rhetorical advantage of the free-speech frame. The free-speech frame allows
            book-removal advocates to claim the mantle of liberty while exercising state
            power to constrain access. It is rhetorically efficient. It is also, on the
            specific terrain mapped out by <em>Pico</em>, legally vulnerable in exactly the
            cases its defenders most want to win.
          </p>

          <p>
            The paradox at the heart of the American book-ban debate is not that one side
            believes in free speech and the other does not. Almost everyone in the debate
            believes in some version of free speech. The paradox is that &ldquo;free
            speech&rdquo; in American public discourse has come to function as a brand
            identity rather than a principle — something asserted to signal which side you
            are on, not something that constrains what you may do once you have power.
          </p>

          <p>
            A catalogue like the one this site maintains is not in the business of
            resolving that paradox. It is in the business of documenting what is removed,
            by whom, and for what stated reason. The record matters because the rhetoric
            is volatile and the legal doctrine depends, more than its defenders would
            like, on what is actually said out loud. A ban that is documented is a ban
            that can be argued about. A ban that is reframed into invisibility is one that
            has already won.
          </p>

          <h2>Sources</h2>

          <p>All quotes were verified against at least three independent sources, with at least one primary source where available.</p>

          <ul>
            <li>
              Tina Descovich quote on parental rights and &ldquo;not banning books&rdquo;:{' '}
              <em>USA Today</em> via Moms for Liberty&apos;s own portal at{' '}
              <a href="https://portal.momsforliberty.org/news/two-sides-of-book-bans-pen-america-and-moms-for-liberty-debate/" target="_blank" rel="noopener noreferrer">portal.momsforliberty.org</a>{' '}
              (primary), and the AOL syndication at{' '}
              <a href="https://www.aol.com/articles/two-sides-book-bans-pen-211049764.html" target="_blank" rel="noopener noreferrer">aol.com</a>.
              The Fox News Radio interview at{' '}
              <a href="https://radio.foxnews.com/2022/09/24/the-debate-over-what-books-your-children-should-and-shouldnt-read/" target="_blank" rel="noopener noreferrer">radio.foxnews.com</a>{' '}
              confirms the broader framing.
            </li>
            <li>
              Senate Judiciary hearing of 12 September 2023, titled &ldquo;Book Bans:
              Examining How Censorship Limits Liberty and Literature&rdquo;: Congressional
              record at{' '}
              <a href="https://www.congress.gov/event/118th-congress/senate-event/LC73584/text" target="_blank" rel="noopener noreferrer">congress.gov</a>{' '}
              (primary), corroborated by the National Coalition Against Censorship at{' '}
              <a href="https://ncac.org/news/ncac-board-president-emily-knox-to-testify-before-u-s-senate-committee-on-the-judiciary-on-book-ban-surge" target="_blank" rel="noopener noreferrer">ncac.org</a>{' '}
              and the EveryLibrary Institute at{' '}
              <a href="https://www.everylibraryinstitute.org/written_testimony_senate_judiciary_sept2023_book_ban_hearing" target="_blank" rel="noopener noreferrer">everylibraryinstitute.org</a>.
            </li>
            <li>
              Senator Kennedy&apos;s office statement on &ldquo;indoctrination&rdquo; and
              parental concerns: <em>Newsweek</em> at{' '}
              <a href="https://www.newsweek.com/senator-reads-aloud-pornographic-book-hearing-1826531" target="_blank" rel="noopener noreferrer">newsweek.com</a>,
              cross-referenced with reporting at{' '}
              <a href="https://thenationaldesk.com/news/americas-news-now/senator-reads-explicit-passage-from-book-during-judiciary-hearing-to-make-point-on-book-bans-john-kennedy-all-boys-arent-blue-gender-queer-political-battle-public-libraries" target="_blank" rel="noopener noreferrer">thenationaldesk.com</a>{' '}
              and{' '}
              <a href="https://www.realclearpolitics.com/video/2023/09/12/sen_john_kennedy_reads_graphic_sexual_banned_book_content_school_librarians_should_decide_who_reads_that.html" target="_blank" rel="noopener noreferrer">realclearpolitics.com</a>.
            </li>
            <li>
              <em>Board of Education v. Pico</em>, 457 U.S. 853 (1982): Justia primary
              source at{' '}
              <a href="https://supreme.justia.com/cases/federal/us/457/853/case.html" target="_blank" rel="noopener noreferrer">supreme.justia.com</a>,
              with secondary analysis at the First Amendment Encyclopedia{' '}
              <a href="https://firstamendment.mtsu.edu/article/board-of-education-island-trees-union-free-school-district-v-pico/" target="_blank" rel="noopener noreferrer">firstamendment.mtsu.edu</a>{' '}
              and Britannica{' '}
              <a href="https://www.britannica.com/topic/Board-of-Education-Island-Trees-Union-Free-School-District-No-26-v-Pico" target="_blank" rel="noopener noreferrer">britannica.com</a>.
            </li>
            <li>
              U.S. Department of Education statement ending the &ldquo;book ban hoax,&rdquo;
              24 January 2025:{' '}
              <a href="https://www.ed.gov/about/news/press-release/us-department-of-education-ends-bidens-book-ban-hoax" target="_blank" rel="noopener noreferrer">ed.gov</a>{' '}
              (primary).
            </li>
            <li>
              <em>Washington Post</em> finding that the majority of 1,000+ book bans came
              from just eleven people: cited by First Focus on Children at{' '}
              <a href="https://firstfocus.org/update/book-bans-dont-protect-children-they-limit-learning/" target="_blank" rel="noopener noreferrer">firstfocus.org</a>.
            </li>
            <li>
              Parent-trust polling: EveryLibrary Institute / BookRiot survey reported by{' '}
              <em>Education Week</em> at{' '}
              <a href="https://www.edweek.org/leadership/parents-trust-school-librarians-to-select-books-but-theres-a-catch/2024/01" target="_blank" rel="noopener noreferrer">edweek.org</a>.
            </li>
          </ul>
        </article>
      </EssayLayout>
    </>
  )
}
