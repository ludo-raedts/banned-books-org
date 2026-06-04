import type { Metadata } from 'next'
import Link from 'next/link'
import EssayLayout from '@/components/essay-layout'
import { essayBySlug } from '@/lib/essays-data'
import { buildCitationMeta } from '@/lib/citation-meta'

const essay = essayBySlug('in-whose-name')!

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

export default function InWhoseNamePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EssayLayout essay={essay}>
          <h2>The reason is the tell</h2>

          <p>
            No one who removes a book describes themselves as a censor. That is the first
            thing you notice when you spend long enough with records of banned books. The
            act is always suppression, but the language is always care. A school board does
            not say it is hiding a novel; it says it is shielding fourteen-year-olds from
            pornography. A government does not say it fears a memoir; it says the memoir
            threatens public order. An ecclesiastical authority does not say it cannot win an
            argument; it says the faithful must be protected from error.
          </p>

          <p>
            The justification is never <em>I want this gone</em>. It is always{' '}
            <em>I am protecting someone</em> — the child, the soldier, the believer, the
            state. And because the justification is offered so reliably, it is the most
            revealing thing a censor leaves behind. More revealing, often, than the book
            itself.
          </p>

          <p>
            This essay is about those justifications: not whether they are sincere, but what
            they are made of, how they cluster, and how the vocabulary has moved over the
            last century. I can write it because the reasons are not anecdotes here. They
            are data.
          </p>

          <h2>What the archive makes of it</h2>

          <p>
            Every restriction recorded on banned-books.org carries one or more{' '}
            <em>reasons</em> — a small controlled vocabulary of eleven labels: political,
            moral, sexual, lgbtq, violence, religious, racial, obscenity, language, drugs,
            and a residual <em>other</em>. Each restriction also carries a <em>scope</em> —
            where the act happened: a school, a public library, a prison, a national
            government, a customs desk, a retailer, a church.
          </p>

          <p>
            That structure turns &ldquo;the language of book-banning&rdquo; from a
            rhetorical impression into something countable. As of mid-2026 the catalogue
            holds more than 28,000 recorded restrictions, linked to reasons over 51,000
            times, covering roughly 14,000 distinct books that have been banned, challenged,
            or restricted at least once.
          </p>

          <p>
            One methodological note up front, because it changes every number that follows.
            I count <em>distinct books</em>, not raw restriction events. The same title
            removed from three hundred school districts is three hundred events but one
            banned book. Counting events would inflate the modern American school wave two-
            to threefold and drown out everything else. So when I say a reason
            &ldquo;covers&rdquo; so many books, I mean distinct titles, each counted once per
            reason.
          </p>

          <h2>The taxonomy is itself an argument</h2>

          <p>
            Before the findings, an admission. Eleven categories is a choice, and a
            contestable one. Why is &ldquo;obscenity&rdquo; separate from
            &ldquo;sexual&rdquo;? Why does &ldquo;moral&rdquo; exist as a catch-all for{' '}
            <em>inappropriate for this age</em>? And why — as of a revision I made in 2026 —
            is there no longer a &ldquo;blasphemy&rdquo; label at all, its records folded
            into &ldquo;religious&rdquo;?
          </p>

          <p>
            I do not think any of these lines are natural. They are imposed. A different
            archivist would draw them differently, and some of the disagreements are real. I
            flag this here, at the start, because the rest of the essay reads the vocabulary
            of censors — and it would be dishonest to do that while pretending my own
            vocabulary fell from the sky. It did not. Every count below is a count{' '}
            <em>through my raster</em>. The defence is not that the raster is neutral. It is
            that it is visible, and you can argue with it.
          </p>

          <h2>Reasons stack — and the stacking is strategic</h2>

          <p>The first finding is that a banned book is rarely banned for one thing.</p>

          <p>
            Only about 43 percent of restrictions cite a single reason. The majority — around 57 percent — cite two
            or more; some cite as many as seven. The stack is the norm, not the exception.
            And the way reasons cluster is not random. The most common pairings, counted in
            distinct books, are <em>moral + sexual</em> (1,563 books), <em>lgbtq + sexual</em>{' '}
            (1,097), <em>moral + violence</em> (953), and <em>lgbtq + moral</em> (859).
          </p>

          <p>
            Look closely at where &ldquo;lgbtq&rdquo; sits. It almost never travels alone. A
            book objected to for its queer content is overwhelmingly <em>also</em> tagged
            sexual or moral — &ldquo;sexually explicit,&rdquo; &ldquo;age-inappropriate.&rdquo;
            This is the strategic part. A bare objection to a gay character is hard to defend
            in public and harder to defend in court. An objection to{' '}
            <em>sexually explicit material unsuitable for minors</em> is much easier to
            carry. The durable, pleadable label gets laid over the one that would not survive
            daylight on its own.
          </p>

          <p>
            This is an old move wearing new clothes. The previous regime did exactly the same
            thing through a different word: <em>obscenity</em>.{' '}
            <Link href="/books/lady-chatterleys-lover"><em>Lady Chatterley&apos;s Lover</em></Link>,{' '}
            <Link href="/books/lolita"><em>Lolita</em></Link>,{' '}
            <Link href="/books/tropic-of-cancer"><em>Tropic of Cancer</em></Link>,{' '}
            <Link href="/books/fanny-hill"><em>Fanny Hill</em></Link> — the great
            twentieth-century cases all ride on obscenity, the legal category that let a
            state act against a book without having to say which idea in it frightened them.
            What changed is not the maneuver. It is the vehicle.
          </p>

          <h2>Two shifts across the year-2000 line</h2>

          <p>
            If you split the catalogue at the year 2000 — roughly, the line between
            historical state censorship and the contemporary school-challenge era — two
            movements come into focus.
          </p>

          <p>
            <strong>The venue moved from the state to the school.</strong> Before 2000, the
            dominant scope is national government: 5,259 distinct books restricted by states,
            courts, and customs. Books removed in <em>schools</em> before 2000 number just
            187. After 2000 the figures invert: government restrictions fall to 2,170
            distinct books, while school restrictions explode to 6,516. The characteristic
            act of censorship in the data is no longer a ministry banning a title at the
            border. It is a district pulling a book off a library shelf.
          </p>

          <p>
            <strong>The protected party moved from the state to the child.</strong> Political
            is the historical heavyweight — about 5,960 books, 42 percent of everything, and
            the one reason that is actually <em>larger</em> before 2000 (≈3,320 books) than
            after (≈2,640). It is the through-line of the whole record: power protecting
            itself. What is new is the moral panic of the present. &ldquo;Moral&rdquo;
            justifications rise from roughly 640 books before 2000 to around 3,050 after.
            &ldquo;Sexual&rdquo; from about 640 to 2,390. And &ldquo;lgbtq&rdquo; is almost
            entirely a twenty-first-century phenomenon: 54 distinct books before 2000,
            against some 2,365 after.
          </p>

          <p>
            And then the detail that ties the two shifts together. Of all eleven reasons,
            exactly one <em>shrinks</em> across the line: obscenity, from about 397 books
            before 2000 to 223 after. The legal language of the old regime appears to be
            receding — though on a smaller base than the other reasons, so this is the most
            tentative number in the essay. What the data shows is a <em>correlation</em>, not
            a proven mechanism: as the characteristic venue moved from the court to the
            school board, the courtroom word &ldquo;obscene&rdquo; gives way to
            &ldquo;sexually explicit&rdquo; and &ldquo;age-inappropriate.&rdquo; I read that
            as the same justification modernising with its setting — statute to PTA — but the
            inference is mine, and the obscenity count is thin enough that a careful reader
            should treat it as suggestive rather than settled.
          </p>

          <p>
            (Two notes on the counting. The era figures are not mutually exclusive — a book
            restricted in both eras is counted in each, and a few carry no recorded year — so
            they do not sum to a reason&apos;s all-time total. And a raw-event count would
            tell a noisier story: &ldquo;moral&rdquo; attaches to 10,147 individual
            restriction events but only 3,666 distinct books, &ldquo;lgbtq&rdquo; to 6,767
            events but 2,415 books. The gap between those numbers <em>is</em> the school wave
            — the same titles, removed again and again across districts.)
          </p>

          <h2>The same reason changes at the border</h2>

          <p>
            A reason is not a property of a book. It is a property of the place that bans it.
            The clearest way to see this is to follow a single title across countries.
          </p>

          <p>
            There are 177 books in the catalogue that have been banned in two or more
            countries under <em>different</em> reason sets.{' '}
            <Link href="/books/the-decameron"><em>The Decameron</em></Link>, Boccaccio&apos;s
            fourteenth-century story collection, is recorded as <em>obscenity + sexual</em> in
            the United States, as <em>religious + sexual</em> in the Vatican, and as{' '}
            <em>lgbtq + sexual</em> in Russia — the same medieval text refracted through three
            different anxieties, the most recent of which did not exist as a category when the
            book was written.{' '}
            <Link href="/books/and-tango-makes-three"><em>And Tango Makes Three</em></Link>,
            the picture book about two male penguins, is <em>lgbtq + moral</em> in the United
            States, plainly <em>lgbtq</em> in Singapore and China, and — in Italy — simply{' '}
            <em>moral</em>, the queer content present in the objection but absent from its
            stated name.{' '}
            <Link href="/books/brave-new-world"><em>Brave New World</em></Link> collects six
            different reasons across its many US district challenges (drugs, language, moral,
            obscenity, religious, sexual) and a single one almost everywhere else.
          </p>

          <p>
            <Link href="/books/1984"><em>Nineteen Eighty-Four</em></Link> is the political
            case in miniature: banned as <em>political + violence</em> in the United States,
            but as bare <em>political</em> straight across the old Eastern bloc — China, the
            USSR, Cuba, Romania, Hungary, Bulgaria. The regime it satirised needed only one
            word for it.
          </p>

          <p>
            The exception that proves the rule is{' '}
            <Link href="/books/the-satanic-verses"><em>The Satanic Verses</em></Link>, which
            is recorded as <em>religious</em> in sixteen countries with almost no variation. A
            few reasons really do travel — the objection is the same wherever the book lands.
            But they are the minority. For most of the catalogue, the reason tells you less
            about the book than about the country holding it.
          </p>

          <h2>The grammar underneath every reason</h2>

          <p>
            Strip the eleven labels back and the same sentence is underneath all of them:{' '}
            <em>someone vulnerable must be protected, and I am the one who knows from what.</em>{' '}
            The political ban protects the state from the citizen. The moral ban protects the
            child from the adult world. The religious ban protects the believer from doubt.
            The reasons differ; the grammar does not.
          </p>

          <p>
            Which means the real question a censorship record poses is never{' '}
            <em>is this book offensive</em>. Offence is everywhere and settles nothing. The
            question is <em>who has been cast as the party too weak to choose</em> — and who
            has appointed themselves that party&apos;s guardian. Every act of censorship is,
            at bottom, a claim of guardianship over someone else&apos;s reading. The reason is
            where that claim is made explicit, which is exactly why it is worth recording.
          </p>

          <h2>Stated, legal, imputed — three different things</h2>

          <p>
            A caveat the essay cannot do without, because a hostile reader will reach for it
            first.
          </p>

          <p>
            The reason attached to a record is not always the reason the censor said out
            loud. Sometimes it is the <em>stated</em> reason (a parent&apos;s complaint form).
            Sometimes it is the <em>legal</em> reason (the statute a customs officer cited).
            And sometimes it is <em>imputed</em> — inferred from a description of the event,
            in some cases by an automated classifier I run over restrictions that arrived
            without a clear reason. That residual &ldquo;other&rdquo; category is still sizeable —
            about 1,677 books, 12 percent of the catalogue — even after a 2026 cleanup that
            stripped it from some 900 records where it sat redundantly beside a real reason.
            It is a visible measure of how much still resists clean labelling.
          </p>

          <p>
            I do not think this sinks the analysis, but it bounds it. The numbers describe
            the <em>recorded</em> vocabulary of censorship — what gets said, written down, and
            inferred — not some hidden true motive behind it. The gap between the stated
            reason and the real one is precisely the thing this whole project exists to keep
            visible. Flattening it would be the censor&apos;s move, not the archivist&apos;s.
          </p>

          <h2>Why cataloguing reasons is worth the trouble</h2>

          <p>
            You cannot win an argument against &ldquo;I am protecting children.&rdquo; It is
            unfalsifiable and it is sincere and it ends the conversation. That is what makes
            it effective.
          </p>

          <p>
            What you <em>can</em> do is show the word its own history. You can show that the
            same protective sentence has guarded the state from its citizens and the church
            from its doubters and the school board from a penguin; that the queer objection
            learned to call itself &ldquo;sexually explicit&rdquo; the moment
            &ldquo;obscene&rdquo; stopped working in court; that the venue slid from the
            ministry to the library and the protected party slid from the sovereign to the
            child, and the language slid right along with them. None of that refutes any
            single ban. But it makes the rhetoric legible — and a justification you can read
            in full, across a century and a hundred countries, is a justification that can no
            longer pass itself off as simple common sense.
          </p>

          <p>
            That is the whole reason to count the reasons. Not to catch censors in a lie. To
            make the grammar of protection visible enough that it has to argue for itself.
          </p>

          <hr />

          <h2>Sources &amp; method</h2>

          <p>
            All counts are drawn from the banned-books.org catalogue, as a single snapshot
            taken in June 2026; the catalogue grows continuously, so the live counters on the{' '}
            <Link href="/about">about</Link> and <Link href="/methodology">methodology</Link>{' '}
            pages are authoritative. At snapshot time the catalogue held more than 28,000
            restriction events across roughly 14,000 distinct books, linked to reasons over
            51,000 times. There are eleven reason labels — political, moral, sexual, lgbtq,
            violence, religious, racial, obscenity, language, drugs, other — after blasphemy
            was merged into religious in the 2026 vocabulary revision, and seven scopes. All
            aggregates use the <em>distinct-books</em> metric (a title counted once per reason
            and per era), never raw event counts; the historical/contemporary split is the
            year-2000 cutoff.
          </p>

          <p>
            <strong>Reason distribution (distinct books):</strong> political 5,959 (42.5%);
            moral 3,666 (26.2%); sexual 2,972 (21.2%); lgbtq 2,415 (17.2%); violence 2,036
            (14.5%); other 1,677 (12.0%); religious 1,318 (9.4%); racial 1,243 (8.9%);
            obscenity 610 (4.4%); language 576 (4.1%); drugs 229 (1.6%).
          </p>

          <p>
            <strong>Era split (pre-2000 / post-2000, distinct books):</strong> political
            3,319 / 2,635 · moral 635 / 3,052 · sexual 644 / 2,390 · lgbtq 54 / 2,366 ·
            violence 117 / 1,960 · obscenity 397 / 223.{' '}
            <strong>Scope by era:</strong> government 5,259 / 2,170 · school 187 / 6,516 ·
            church 16 / 0.
          </p>

          <p>
            <strong>Cross-border divergence:</strong> 177 books are banned in two or more
            countries under differing reason sets. The titles named above were each checked
            against real restriction records: <em>The Decameron</em> (obscenity+sexual in the
            US and Australia, religious+sexual in the Vatican, lgbtq+sexual in Russia, 2024);{' '}
            <em>And Tango Makes Three</em> (lgbtq+moral in the US, lgbtq in Singapore and
            China, moral in Italy); <em>Brave New World</em> (a six-reason union across US
            district challenges); <em>Nineteen Eighty-Four</em> (political across the Eastern
            bloc, political+violence in the US). <em>The Satanic Verses</em> is the
            low-variance counter-example.
          </p>

          <p>
            Reason classification and source provenance are independent: a restriction can be
            well-sourced yet carry an imputed or coarse reason tag, which is what the{' '}
            <em>stated, legal, imputed</em> section is about. Provenance is recorded primarily
            at the level of the upstream source — PEN America, the American Library
            Association, Wikipedia&apos;s lists of banned books, Index on Censorship, Freedom
            to Read Canada — with per-event citations on a subset. Each named title links to
            its per-book page, where the ban context and provenance live.
          </p>

          <p>
            This piece is the data-grounded counterpart to{' '}
            <Link href="/essays/what-we-document">What we document — and why that is a choice</Link>{' '}
            and{' '}
            <Link href="/essays/first-amendment-paradox">The First Amendment paradox</Link>,
            and it annotates the <Link href="/reasons">reasons index</Link>.
          </p>
      </EssayLayout>
    </>
  )
}
