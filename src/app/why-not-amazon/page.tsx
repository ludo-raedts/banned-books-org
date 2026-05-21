import type { Metadata } from 'next'
import Link from 'next/link'
import MoreEssays from '@/components/more-essays'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const metadata: Metadata = {
  title: 'Why We Don\'t Link to Amazon',
  description: 'We deliberately choose not to link to Amazon. Here is why.',
  alternates: {
    canonical: '/why-not-amazon',
    types: { 'text/markdown': '/why-not-amazon.md' },
  },
}

export default function WhyNotAmazonPage() {
  return (
    <main>
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-oxblood mb-6 transition-colors"
          >
            ← Home
          </Link>

          <Eyebrow>Essay · Editorial policy</Eyebrow>

          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            Why we don&apos;t link to Amazon.
          </h1>

          <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
            We deliberately choose not to link to Amazon. Access to knowledge should not depend on opaque systems of control.
          </p>
        </div>
      </section>

      <SectionShell tone="cream">
        <article className="max-w-3xl mx-auto prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-oxblood/30 prose-h3:mt-6 prose-h3:mb-2 prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900">

        <p>
          Amazon plays a dominant role in global book distribution, but it also exercises significant
          control over what can be sold or discovered on its platform. Books can be removed, restricted,
          or made harder to find based on internal policies that are not always transparent. These actions
          are not the same as government bans — but they do shape access in practice.
        </p>

        <h2>A complex ethical decision</h2>

        <p>This is not a black-and-white issue.</p>

        <p>
          We recognize that platforms have a responsibility to limit clearly harmful content — such as
          explicit hate speech, incitement to violence, or material that directly endangers individuals
          or groups. Some level of moderation is necessary in any large-scale distribution system.
        </p>

        <p>
          At the same time, there are documented cases where books have been removed or restricted by
          Amazon that fall into more contested territory — covering political views, gender identity
          debates, or broader social issues. These are not always universally classified as harmful, and
          their removal raises legitimate questions about where the line is drawn — and by whom.
        </p>

        <h2>Documented cases that inform our decision</h2>

        <h3>Remote deletion of purchased books (2009)</h3>
        <p>
          Amazon removed digital copies of <em>Nineteen Eighty-Four</em> and <em>Animal Farm</em> from
          users&apos; Kindle devices due to licensing issues.
          <br />
          <a
            href="https://www.nytimes.com/2009/07/18/technology/companies/18amazon.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            The New York Times
          </a>
        </p>

        <h3>Policy-based removal of a book on gender identity (2021)</h3>
        <p>
          Amazon removed <em>When Harry Became Sally</em> by Ryan T. Anderson following a policy update.
          <br />
          <a
            href="https://www.wsj.com/articles/amazon-removes-book-critical-of-transgender-treatments-11615335966"
            target="_blank"
            rel="noopener noreferrer"
          >
            The Wall Street Journal
          </a>
          {' '}·{' '}
          <a
            href="https://www.bbc.com/news/world-us-canada-56220471"
            target="_blank"
            rel="noopener noreferrer"
          >
            BBC News
          </a>
        </p>

        <h3>Misclassification affecting LGBTQ+ books (2019)</h3>
        <p>
          Some LGBTQ+-related titles were incorrectly categorised as &ldquo;adult content,&rdquo;
          reducing their visibility.
          <br />
          <a
            href="https://www.theguardian.com/books/2019/apr/08/amazon-glitch-hides-lgbt-books-from-search-results"
            target="_blank"
            rel="noopener noreferrer"
          >
            The Guardian
          </a>
        </p>

        <h3>Ongoing removals under evolving content policies</h3>
        <p>
          Books have been taken down or restricted under guidelines related to hate speech or
          &ldquo;offensive content,&rdquo; often without detailed public explanation.
          <br />
          <a
            href="https://www.reuters.com/article/us-amazon-books-idUSKBN2B22E9"
            target="_blank"
            rel="noopener noreferrer"
          >
            Reuters
          </a>
          {' '}·{' '}
          <a
            href="https://www.bbc.com/news/technology-56270617"
            target="_blank"
            rel="noopener noreferrer"
          >
            BBC News
          </a>
        </p>

        <h2>Why this matters for our project</h2>

        <p>
          We are not claiming that Amazon systematically &ldquo;bans&rdquo; books in the way governments do.
          The scale and context are fundamentally different.
        </p>

        <p>But for a project focused on banned and challenged books, three things are difficult to ignore:</p>

        <ul>
          <li>centralised control over availability</li>
          <li>limited transparency in decision-making</li>
          <li>real impact on what readers can access or even find</li>
        </ul>

        <h2>Our choice</h2>

        <p>Our goal is simple: make access to books as open and transparent as possible.</p>

        <p>
          Choosing not to link to Amazon is part of that. It&apos;s a deliberate decision — aware of the
          trade-offs, and grounded in the belief that access to knowledge should not depend on opaque
          systems of control.
        </p>

        <p>
          Instead, we link to alternative bookstores and platforms that better align with that principle.
        </p>

        </article>
      </SectionShell>

      <SectionShell tone="white">
        <div className="max-w-3xl mx-auto">
          <MoreEssays currentSlug="why-not-amazon" />
        </div>
      </SectionShell>
    </main>
  )
}
