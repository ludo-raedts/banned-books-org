import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Methodology — Why the US Dominates This Data',
  description: 'An honest explanation of why the United States accounts for most bans in this catalogue, and what that says about transparency, advocacy, and the limits of available data.',
  alternates: { canonical: '/methodology' },
}

export default function MethodologyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <Link href="/stats" className="inline-block text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-8">
        ← Back to Stats
      </Link>

      <div className="bg-red-50 dark:bg-red-950/20 border-l-4 border-red-700 rounded-r-lg p-8 mb-12">
        <p className="text-xs tracking-widest text-red-700 dark:text-red-400 uppercase mb-2">Essay</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-4 text-gray-900 dark:text-gray-100">
          Why the United States dominates this data
        </h1>
        <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
          The US accounts for the overwhelming majority of bans in this catalogue. That is not because
          American libraries burn the most books — it is because America counts them.
        </p>
      </div>

      <article className="prose prose-gray dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-red-700 prose-a:no-underline hover:prose-a:underline">

        <h2>Transparency creates a paper trail</h2>
        <p>
          The United States has two organisations that do something unusual in the world: they systematically
          count book bans. PEN America publishes an annual Index of School Book Bans, tracking every recorded
          school-district removal across the country. The American Library Association's Office for Intellectual
          Freedom has maintained its list of challenged and banned books since the 1990s. These organisations
          work with local journalists, librarians, and parents to surface and verify individual cases.
        </p>
        <p>
          The result is a dataset with thousands of entries, each with a date, a location, an institution,
          and often a reason. No comparable infrastructure exists anywhere else on Earth.
        </p>

        <h2>School bans are structurally different</h2>
        <p>
          Most US bans are school bans: a school board in Florida removes{' '}
          <Link href="/books/the-hate-u-give" className="text-red-700 underline hover:text-red-900 dark:text-red-400 dark:hover:text-red-200">
            The Hate U Give
          </Link>{' '}
          from its libraries, or a Texas district pulls{' '}
          <Link href="/books/gender-queer" className="text-red-700 underline hover:text-red-900 dark:text-red-400 dark:hover:text-red-200">
            Gender Queer
          </Link>{' '}
          from its shelves. These are local administrative decisions, not national law. The book remains
          available in bookshops, public libraries in other cities, and online. The restriction is real —
          children in that district cannot access it through their school — but it is a different kind of
          restriction than a government banning a book nationwide.
        </p>
        <p>
          In this catalogue, we document both. A school ban in Florida and a government ban in Iran are both
          recorded as bans, though we distinguish them by scope ("school" vs. "government") and status
          ("active" vs. "historical"). The US number is high partly because school-level
          decisions are included and tracked. Most countries' equivalents are never reported.
          See our{' '}
          <Link href="/challenged-books" className="text-red-700 dark:text-red-400 underline hover:text-red-900">
            challenged books page
          </Link>
          {' '}for the full list of school-scope bans and an explanation of challenge vs. ban terminology.
        </p>

        <blockquote className="border-l-4 border-red-700 pl-6 my-8 text-xl text-gray-700 dark:text-gray-300 italic not-italic">
          The United States doesn't ban more books than authoritarian states —
          it just records the ones it does ban.
        </blockquote>

        <h2>Authoritarian states ban more, document less</h2>
        <p>
          Iran, China, North Korea, Saudi Arabia, and Belarus all maintain comprehensive censorship regimes
          in which vast categories of literature are simply unavailable. Works on religion, sexuality, political
          dissent, or historical memory are systematically suppressed. But because there is no free press,
          no civil society watchdog, and no tradition of public reporting on censorship decisions, these bans
          rarely appear in any accessible database.
        </p>
        <p>
          When a North Korean novel is deemed counter-revolutionary, no librarian files a report. When an
          Iranian publisher is told not to print a certain title, there is no press conference. The bans
          exist, but they are invisible to the data. Our catalogue records only a fraction of what likely
          occurs in closed societies.
        </p>

        <h2>What counts as a ban?</h2>
        <p>
          This catalogue uses a broad definition: any formal removal, import restriction, publication
          prohibition, or sustained challenge resulting in a book becoming unavailable through an official
          channel. We include both hard bans (legally prohibited nationwide) and soft bans (withdrawn
          from a school or library after pressure), as long as there is a documented decision.
        </p>
        <p>
          We do not include: books that are simply out of print, books a publisher chose not to distribute,
          or books that are technically available but culturally stigmatised. The restriction must have
          an institutional actor and a documented decision.
        </p>
        <p>
          High-profile US titles like{' '}
          <Link href="/books/all-boys-arent-blue" className="text-red-700 underline hover:text-red-900 dark:text-red-400 dark:hover:text-red-200">
            All Boys Aren't Blue
          </Link>{' '}
          may appear dozens of times because each school-district removal is a separate event. In
          countries where a single national decision bans a book everywhere, it appears once.
        </p>

        <h2>How to read the numbers</h2>
        <p>
          The raw country rankings in this catalogue should be read as a proxy for <em>documentation
          quality</em> as much as for the scale of censorship. A high count for the United States reflects
          a free and watchful civil society. A low count for Belarus reflects the absence of one.
        </p>
        <p>
          The catalogue is most useful when looked at comparatively within categories — US school bans
          versus US library bans, or government bans across European democracies — rather than treating
          the global total as a straightforward ranking of repression. The country pages include background
          context on each country's censorship history to help frame the numbers.
        </p>

        <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mt-12 not-prose">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            <strong className="text-gray-800 dark:text-gray-200">About this catalogue.</strong>{' '}
            Data is drawn from PEN America, the American Library Association, Wikipedia, Reporters Without
            Borders, and Index on Censorship. Every ban entry links to its source. The catalogue is a
            work in progress — if you know of a ban we&apos;ve missed, or spot an error,{' '}
            <a
              href="https://github.com/ludo-raedts/banned-books-org/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-700 dark:text-red-400 underline hover:text-red-900"
            >
              open an issue on GitHub
            </a>
            {' '}or use the contact form on the{' '}
            <Link href="/about" className="text-red-700 dark:text-red-400 underline hover:text-red-900">
              About page
            </Link>
            .
          </p>
        </div>

      </article>
    </main>
  )
}
