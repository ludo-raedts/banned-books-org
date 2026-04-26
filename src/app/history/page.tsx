import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'The Long Shadow of Censorship: A History of Banned Books',
  description:
    'An in-depth look at the history of banned books, from ancient censorship to modern book bans — including Nazi book burnings, the Catholic Index, and contemporary debates on free speech.',
  openGraph: {
    title: 'The Long Shadow of Censorship: A History of Banned Books',
    description:
      'From Emperor Qin to school board hearings — how book banning has functioned as a confession of fear across two thousand years of human history.',
    type: 'article',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The Long Shadow of Censorship: A History of Banned Books',
  description:
    'An in-depth look at the history of banned books, from ancient censorship to modern book bans, including Nazi book burnings and contemporary debates on free speech.',
  author: { '@type': 'Organization', name: 'banned-books.org' },
  publisher: { '@type': 'Organization', name: 'banned-books.org' },
  mainEntityOfPage: 'https://banned-books.org/history',
  about: ['Book banning', 'Censorship', 'Freedom of speech', 'Nazi book burnings', 'Mein Kampf'],
}

export default function HistoryPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 mb-10 transition-colors"
        >
          ← All books
        </Link>

        {/* Header */}
        <div className="mb-12">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
            Essay
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-6">
            The long shadow of censorship: a history of banned books
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            There is something almost paradoxical about banned books. The act of suppressing a text
            often guarantees its survival. If anything, censorship is less a tool of control than a
            confession of fear — fear of ideas, of dissent, of readers thinking for themselves.
          </p>
        </div>

        {/* Hero image */}
        <figure className="mb-12 -mx-4 sm:mx-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Bundesarchiv_Bild_102-14597%2C_Berlin%2C_Opernplatz%2C_B%C3%BCcherverbrennung.jpg/1280px-Bundesarchiv_Bild_102-14597%2C_Berlin%2C_Opernplatz%2C_B%C3%BCcherverbrennung.jpg"
            alt="Nazi book burning at the Opernplatz in Berlin, May 1933 — public destruction of thousands of banned books"
            className="w-full sm:rounded-xl object-cover"
            loading="eager"
          />
          <figcaption className="text-xs text-gray-400 dark:text-gray-500 mt-2 px-4 sm:px-0">
            Berlin, Opernplatz, 10 May 1933. Nazi students and officials burn thousands of books in a
            public ceremony. Photo:{' '}
            <a
              href="https://commons.wikimedia.org/wiki/File:Bundesarchiv_Bild_102-14597,_Berlin,_Opernplatz,_B%C3%BCcherverbrennung.jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600 dark:hover:text-gray-300"
            >
              Bundesarchiv / Wikimedia Commons
            </a>{' '}
            (CC-BY-SA 3.0 DE)
          </figcaption>
        </figure>

        {/* Article body */}
        <article className="prose prose-gray dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-gray-900 dark:prose-a:text-gray-100 prose-a:underline prose-a:underline-offset-2 prose-a:decoration-gray-300 dark:prose-a:decoration-gray-600 hover:prose-a:decoration-gray-600 dark:hover:prose-a:decoration-gray-300 prose-p:leading-relaxed">

          <p>
            This article traces the history of literary censorship from ancient times to the present —
            not as a neutral timeline, but as a recurring pattern. Whenever power feels threatened,
            knowledge becomes the first casualty.
          </p>

          <h2>Ancient roots: when knowledge became dangerous</h2>

          <p>
            Book banning is older than the printing press. In ancient China, during the Qin dynasty
            (3rd century BCE), Emperor Qin Shi Huang ordered the burning of philosophical texts and the
            burial of scholars to consolidate ideological control. The message was clear: competing ideas
            were not to be debated — they were to be erased.
          </p>

          <p>
            In ancient Greece, works deemed impious or politically subversive could be suppressed. Later,
            the Roman Empire banned texts that challenged imperial authority or religious orthodoxy. The
            underlying logic has barely changed in two thousand years: knowledge is tolerated — until
            it isn&apos;t.
          </p>

          <h2>Religion and control: the medieval and early modern era</h2>

          <p>
            The institutionalisation of censorship reached a new level with religious authorities. The
            Catholic Church created the <em>Index Librorum Prohibitorum</em> in 1559 — a list of
            prohibited books that included works by Galileo, Copernicus, and Enlightenment thinkers like
            Descartes and Locke.
          </p>

          <p>
            Books were banned for &ldquo;heresy,&rdquo; but the real issue was often control over
            interpretation. If people read independently, they might question authority. And questioning
            authority has always been the first step toward change.
          </p>

          <p>
            The printing press, introduced by Johannes Gutenberg in the 1440s, made this problem
            exponentially worse for those in power. Suddenly, ideas could spread faster than institutions
            could suppress them. The Church&apos;s response — the Index — was essentially an admission
            that the race had been lost.
          </p>

          <h2>Fire and ideology: the Nazi book burnings</h2>

          <p>
            Few moments illustrate the symbolism of literary censorship more starkly than the book
            burnings of Nazi Germany. In May 1933, orchestrated by the regime and led in part by
            Joseph Goebbels, students and officials publicly burned thousands of books across Berlin
            and dozens of other German cities.
          </p>

          <p>
            The targets were not random. Works by Jewish authors, political opponents, and intellectuals
            — from Freud to Marx to Hemingway — were thrown into the flames. The intention was not merely
            to remove books from circulation, but to erase entire schools of thought from the culture.
          </p>

          <p>
            The chilling phrase &ldquo;Where they burn books, they will ultimately burn people too&rdquo;
            — written by Heinrich Heine in 1820, a century before the events it predicted — became
            tragically prophetic.
          </p>

          {/* Video embed */}
          <div className="not-prose my-8">
            <div className="aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/kHCmiWaHUCw"
                title="Nazi book burning footage, 1933"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Contemporary footage of the 1933 book burnings. These events were public, deliberate, and
              widely supported at the time — a reminder of how quickly the suppression of ideas can be
              normalised.
            </p>
          </div>

          <p>
            And yet, history introduces a difficult paradox. After World War II, even democratic
            societies struggled with how to handle dangerous texts.{' '}
            <Link href="/books/mein-kampf">
              <em>Mein Kampf</em>
            </Link>{' '}
            was banned or restricted in countries like{' '}
            <Link href="/countries/germany">Germany</Link> for decades. The intention was
            understandable — to prevent the spread of extremist ideology — but it raised an uncomfortable
            question: can a society defend openness by restricting access to ideas?
          </p>

          <p>
            Modern Germany eventually allowed controlled publication with critical annotations, reflecting
            a nuanced approach: not suppression, but contextualisation. The method changes — fire, law,
            or algorithm — but the instinct remains the same.
          </p>

          <h2>Enlightenment and resistance: censorship meets its limits</h2>

          <p>
            By the 18th century, censorship began to face organised resistance. Enlightenment thinkers
            argued that access to information was not a privilege, but a right. The idea that individuals
            could decide for themselves what to read — and what to believe — was, at the time,
            genuinely revolutionary.
          </p>

          <p>
            Thomas Paine&apos;s{' '}
            <Link href="/books/rights-of-man"><em>Rights of Man</em></Link> was prosecuted for
            seditious libel in Britain. Spinoza&apos;s{' '}
            <Link href="/books/theologico-political-treatise">
              <em>Theologico-Political Treatise</em>
            </Link>{' '}
            was banned in Amsterdam and placed on the Catholic Index. Montesquieu&apos;s{' '}
            <Link href="/books/the-spirit-of-the-laws">
              <em>The Spirit of the Laws</em>
            </Link>{' '}
            — the foundational text for the separation of powers later built into the US
            Constitution — was banned in France.
          </p>

          <p>
            Yet something was shifting. Banning a book no longer guaranteed silence. It often
            amplified attention.
          </p>

          <h2>The modern era: from obscenity laws to political weapon</h2>

          <p>
            In the 19th century, censorship in countries like the United States became codified through
            laws such as the Comstock Act, which prohibited the distribution of &ldquo;obscene&rdquo;
            materials through the mail. The definition of obscene was, conveniently, whatever the
            enforcers decided it meant.
          </p>

          <p>
            By the 20th century, even canonical works were not immune. Books like{' '}
            <Link href="/books/to-kill-a-mockingbird">
              <em>To Kill a Mockingbird</em>
            </Link>{' '}
            and{' '}
            <Link href="/books/the-catcher-in-the-rye">
              <em>The Catcher in the Rye</em>
            </Link>{' '}
            were repeatedly challenged or removed from schools for language, themes, or perceived moral
            risks. This raises an uncomfortable question: if even widely celebrated literature can be
            banned, what does that say about the criteria being used?
          </p>

          <h2>Beyond books: the broader logic of banning art</h2>

          <p>
            Censorship has never been limited to books. When authorities attempt to control ideas, they
            rarely stop at text. Paintings have been removed from galleries for &ldquo;indecency.&rdquo;
            Films have been cut or banned for political messaging. Music — from protest songs to entire
            genres — has been censored for challenging dominant narratives.
          </p>

          <p>
            This expansion reveals something deeper. The issue is not the medium — it is the message.
          </p>

          <p>
            In an era defined by the internet, the idea of banning content becomes structurally
            fragile. Information does not disappear — it reroutes. The question is no longer{' '}
            <em>can you suppress it</em>, but what happens when you try. Attempts to block books
            across borders resemble trying to contain water with bare hands. Free press and open
            internet ecosystems have shifted the balance toward access — but they have also triggered
            new forms of control: platform moderation, algorithmic suppression, and state-level
            firewalls.
          </p>

          <p>
            The result is a modern form of literary censorship that is less visible, but no less
            consequential.
          </p>

          <h2>Today: censorship at scale</h2>

          <p>
            If censorship once required centralised power, today it often operates through
            decentralised pressure — school boards, political organisations, and co-ordinated campaigns.
          </p>

          <p>The numbers are striking:</p>

          <ul>
            <li>
              Over <strong>10,000 book bans</strong> were recorded in a single US school year
              (2023–2024), according to PEN America
            </li>
            <li>
              Since 2021, more than <strong>22,000 bans</strong> have been documented across the
              country
            </li>
            <li>
              Many bans disproportionately target books about <strong>race, gender, and
              LGBTQ+ experiences</strong>
            </li>
          </ul>

          <p>
            This is not random. It reflects a broader attempt to shape narratives — what can be
            discussed, whose stories are valid, and which perspectives are considered acceptable. Even
            more telling: many bans are driven not by widespread public demand, but by organised groups
            and political pressure. You can explore the full US record on our{' '}
            <Link href="/countries/united-states">United States country page</Link>.
          </p>

          <h2>Why books get banned (and what that reveals)</h2>

          <p>
            Across history, the reasons for banning books — often called challenged or restricted books
            in contemporary contexts — remain remarkably consistent:
          </p>

          <ul>
            <li><strong>Political control</strong> — suppress dissent or alternative ideologies</li>
            <li><strong>Moral regulation</strong> — restrict content deemed inappropriate</li>
            <li><strong>Religious authority</strong> — enforce doctrinal conformity</li>
            <li><strong>Social anxiety</strong> — limit exposure to uncomfortable truths</li>
          </ul>

          <p>
            But these reasons say more about the institutions enforcing them than about the books
            themselves. A society confident in its values does not need to hide ideas. It engages
            with them.
          </p>

          <h2>Censorship as weakness</h2>

          <p>
            Banning books is rarely a sign of strength. It is usually a sign of insecurity.
          </p>

          <p>
            When a regime — or even a school board — decides that people cannot be trusted to read and
            think critically, it reveals a fundamental lack of confidence in its own position. If an
            idea is truly flawed, it should be easy to challenge it openly. Suppressing it only raises
            suspicion.
          </p>

          <p>
            History demonstrates this repeatedly. From authoritarian regimes to democratic societies
            under pressure, literary censorship emerges when control feels threatened. It is a defensive
            reflex, not a constructive strategy. And it almost never works long term.
          </p>

          <h2>The reader&apos;s role: agency over protection</h2>

          <p>
            At the heart of this issue lies a simple principle: individuals are capable of making their
            own decisions about knowledge.
          </p>

          <p>
            The idea that people must be protected from books assumes that exposure to ideas is
            inherently dangerous. But exposure is not indoctrination. Reading is not agreement.
            Understanding is not endorsement.
          </p>

          <p>
            In fact, the opposite is often true. Access to diverse perspectives strengthens critical
            thinking. Limiting access weakens it.
          </p>

          <h2>Conclusion: the paradox of banned books</h2>

          <p>
            Banned books tell us less about literature and more about power. They map the fault lines
            of society — what we fear, what we resist, and what we try to control.
          </p>

          <p>
            But they also reveal something else: the persistence of ideas.
          </p>

          <p>
            Because every time a book is banned, it raises a question.
            And questions have a way of spreading.
          </p>
        </article>

        {/* FAQ */}
        <section className="mt-16 border-t border-gray-200 dark:border-gray-800 pt-10">
          <h2 className="text-xl font-bold tracking-tight mb-8">FAQ: banned books and censorship</h2>
          <div className="flex flex-col gap-6">
            {[
              {
                q: 'Why did the Nazis burn books in 1933?',
                a: 'The Nazi Party organised book burnings to eliminate ideas they considered "un-German," targeting Jewish, socialist, pacifist, and liberal authors. It was a symbolic and political act aimed at controlling culture and thought — and a warning of what was to come.',
              },
              {
                q: 'Is Mein Kampf still banned?',
                a: "Mein Kampf was banned or restricted in several countries after World War II. In Germany, it was unavailable in new editions until 2016, when the Bavarian state's copyright expired. It is now published in annotated scholarly editions that provide historical and critical context.",
              },
              {
                q: 'Why do modern societies still ban books?',
                a: 'Modern bans are typically driven by political pressure, moral concerns, or debates around education — particularly in schools and public libraries. Even open societies struggle with the tension between free expression and perceived social harm. Since 2021, more than 22,000 book bans have been documented in US schools alone.',
              },
              {
                q: 'Does banning books work?',
                a: 'Historically, banning books often increases their visibility and influence rather than suppressing them. The Catholic Church\'s Index, the Nazi burnings, and contemporary school challenges all produced renewed interest in the targeted works. Censorship tends to function as an advertisement.',
              },
              {
                q: 'What kinds of books are most commonly banned?',
                a: 'Books challenging political authority, questioning religious doctrine, depicting sexuality, or centering marginalised identities have historically faced the most restrictions. Today in the United States, the most challenged books disproportionately feature LGBTQ+ characters or address race — reflecting the political tensions of the moment.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-gray-100 dark:border-gray-800 pb-6 last:border-0 last:pb-0">
                <h3 className="font-semibold text-base mb-2">{q}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Explore links */}
        <section className="mt-12 p-6 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
            Explore the catalogue
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              📕 All books
            </Link>
            <Link
              href="/countries"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              🌍 By country
            </Link>
            <Link
              href="/reasons"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              ⚖️ By reason
            </Link>
            <Link
              href="/stats"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              📊 Stats
            </Link>
            <Link
              href="/countries/united-states"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              🇺🇸 US school bans
            </Link>
            <Link
              href="/countries/germany"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              🇩🇪 Germany
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
