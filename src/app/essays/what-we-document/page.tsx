import type { Metadata } from 'next'
import Link from 'next/link'
import EssayLayout from '@/components/essay-layout'
import { essayBySlug } from '@/lib/essays-data'
import { buildCitationMeta } from '@/lib/citation-meta'

const essay = essayBySlug('what-we-document')!

export const metadata: Metadata = {
  title: `${essay.title} — Banned Books`,
  description: essay.dek,
  openGraph: { title: essay.title, description: essay.dek, type: 'article' },
  alternates: { canonical: essay.href },
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

export default function WhatWeDocumentPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EssayLayout essay={essay}>
        <article className={proseClasses}>
          <p>
            When I started building banned-books.org, I assumed the difficult part would
            be the data.
          </p>

          <p>
            Finding reliable sources. Comparing countries. Verifying whether a title had
            actually been banned or merely challenged. Untangling contradictions between
            government statements, NGO reports, library records, academic papers, and
            newspaper archives. That work is messy enough already.
          </p>

          <p>But it turned out not to be the hardest part.</p>

          <p>
            The harder question arrived later, almost accidentally: what actually belongs
            in a censorship archive?
          </p>

          <p>
            At some point I noticed the contradiction sitting underneath the entire
            project. I was documenting books banned in Russia because they discuss
            homosexuality, gender identity, or queer life. At the same time, I was
            deliberately excluding publications designed to facilitate child abuse, even
            though those publications are technically &ldquo;banned&rdquo; somewhere too.
          </p>

          <p>
            At first glance, that looks inconsistent. Almost hypocritical. As if some
            restrictions count as censorship while others suddenly become acceptable
            because they happen to align with my own moral framework.
          </p>

          <p>I do not think that tension disappears by pretending it is not there.</p>

          <p>
            Every serious archive makes editorial choices. The difference is whether those
            choices remain hidden behind the language of neutrality, or whether someone is
            willing to explain them openly.
          </p>

          <p>This article is an attempt to explain ours.</p>

          <h2>The problem with the modern conversation around banned books</h2>

          <p>Over the past decade, the term &ldquo;banned book&rdquo; has stretched far beyond literature.</p>

          <p>Sometimes reasonably. Often carelessly.</p>

          <p>
            A novel removed from a school library now appears online next to extremist
            manifestos, operational propaganda, violent instruction manuals, self-published
            abuse material, conspiracy pamphlets, and internet folklore presented as
            &ldquo;forbidden texts.&rdquo; Everything collapses into the same emotional
            category: hidden knowledge.
          </p>

          <p>The internet is very good at flattening distinctions that should remain visible.</p>

          <p>Literature and propaganda become interchangeable.</p>
          <p>Controversial ideas and direct facilitation of harm begin to blur together.</p>
          <p>Censorship and criminal law start sounding like variations of the same thing.</p>

          <p>
            A novel such as{' '}
            <Link href="/books/the-satanic-verses"><em>The Satanic Verses</em></Link>{' '}
            belongs in a censorship archive because the reaction to it tells us something
            important about religion, power, fear, politics, and freedom of expression.
            Whether someone admires the novel is almost secondary.
          </p>

          <p>
            A document created to facilitate abuse belongs somewhere else entirely. Not
            because it is &ldquo;controversial.&rdquo; Literature has always offended
            people. That is hardly new. It belongs elsewhere because harm is embedded in
            the purpose of the material itself.
          </p>

          <p>
            Those are fundamentally different categories, even if online culture
            increasingly treats them as part of the same mythology of forbidden knowledge.
          </p>

          <h2>What I actually document</h2>

          <p>
            Banned-books.org documents restrictions on books and literary works when those
            restrictions limit access to ideas, identities, histories, political thought,
            religion, philosophy, science, or cultural expression.
          </p>

          <p>That includes books many people dislike intensely.</p>

          <p>
            Some are politically extreme. Some are racist. Some are anti-religious. Some
            remain deeply uncomfortable to read decades after publication. A censorship
            archive that only documents books everyone already agrees with would not teach
            us very much about censorship.
          </p>

          <p>
            I document school bans, prison restrictions, ideological purges, military
            confiscations, religious censorship, library removals, restrictions on LGBTQ
            literature, attempts to erase minority voices, and efforts to suppress
            inconvenient histories.
          </p>

          <p>Documenting censorship is not endorsement.</p>
          <p>An archive is not a recommendation list.</p>
          <p>That distinction has become surprisingly important to say out loud.</p>

          <h2>The line I draw</h2>

          <p>My criterion is not legality.</p>

          <p>
            If legality alone determined what belongs in a censorship archive,
            authoritarian governments would effectively define intellectual freedom for
            everyone else.
          </p>

          <p>A novel discussing homosexuality would simply become &ldquo;illegal local content.&rdquo;</p>
          <p>A dissident memoir confiscated in prison would become &ldquo;restricted material.&rdquo;</p>
          <p>Religious criticism punished under blasphemy laws would become &ldquo;criminal speech.&rdquo;</p>

          <p>That framework collapses almost immediately.</p>

          <p>
            But the opposite extreme fails too. Not every prohibited publication
            automatically becomes part of some noble struggle for free expression. The
            internet often romanticizes prohibition itself, as though difficulty of access
            automatically gives something intellectual value.
          </p>

          <p>I do not think that is a serious way to think about censorship.</p>

          <p>
            There are works whose creation, distribution, or purpose directly harms people
            who cannot meaningfully protect themselves or consent. That distinction
            matters ethically, historically, and legally.
          </p>

          <p>
            For that reason, banned-books.org does not include child sexual abuse
            material, publications designed to facilitate abuse of minors, manuals
            intended to organize exploitation, or material whose existence itself
            documents ongoing abuse.
          </p>

          <p>I do not consider such material &ldquo;suppressed literature.&rdquo;</p>

          <p>
            Not because it is unpopular. Not because it shocks people. Literature has
            always shocked people. The exclusion exists because the harm is intrinsic to
            the material itself.
          </p>

          <p>
            That is fundamentally different from a controversial novel, a radical
            political tract, or a blasphemous essay.
          </p>

          <p>
            Some readers will disagree with where these lines are drawn. I understand
            that. Difficult archives inevitably force difficult distinctions. Pretending
            otherwise would simply make those distinctions invisible instead of absent.
          </p>

          <h2>Why this is not simply a Western double standard</h2>

          <p>One criticism returns frequently whenever these boundaries are discussed.</p>

          <p>
            Why document books banned under anti-LGBTQ laws, while refusing to document
            material prohibited under laws against child exploitation? Am I not simply
            deciding which laws deserve respect and which do not?
          </p>

          <p>I think that question deserves a serious answer.</p>

          <p>
            The distinction is not based on nationality, ideology, religion, or cultural
            preference. It is based on where the harm primarily occurs.
          </p>

          <p>
            In many censorship cases, the damage is created by the restriction itself.
            Readers lose access to ideas. Writers are silenced. Histories disappear.
            Communities are pushed out of public discourse. Debate narrows.
          </p>

          <p>The suppression creates the harm.</p>

          <p>
            In cases involving child exploitation material, the harm does not primarily
            emerge from the restriction. The harm already exists in the production and
            circulation of the material itself, often involving victims who never had the
            ability to consent or defend themselves.
          </p>

          <p>
            That is not merely a disagreement about morality. It is a fundamentally
            different category.
          </p>

          <p>
            International human rights law recognizes this distinction too. Freedom of
            expression protections under Article 19 of the ICCPR coexist with obligations
            to protect the rights and safety of others, particularly children and
            vulnerable individuals.
          </p>

          <p>
            No archive is neutral. But serious archives should at least be honest about
            the standards they apply.
          </p>

          <h2>Books, manifestos, and pamphlets</h2>

          <p>There is another line I draw, and it is one the internet increasingly ignores.</p>

          <p>Not every prohibited publication is meaningfully a book.</p>

          <p>
            Today it is common to see manifestos, propaganda documents, operational
            terrorist texts, and extremist pamphlets grouped together with novels,
            memoirs, philosophy, and literature under the same vague category of
            &ldquo;banned books.&rdquo;
          </p>

          <p>
            The manifesto published by Anders Behring Breivik before the attacks of
            July 22, 2011 is one example.
          </p>

          <p>
            Online, it is frequently included in &ldquo;forbidden texts&rdquo; lists
            beside literary works. Technically, it resembles a long-form publication. It
            has chapters, citations, arguments, structure.
          </p>

          <p>But form alone is not enough.</p>

          <p>
            Breivik&apos;s document was operational propaganda directly connected to an
            act of mass murder in which 77 people, many of them teenagers, were killed.
            It was not written for literary discourse, philosophical inquiry, or public
            debate.
          </p>

          <p>That distinction matters.</p>

          <p>
            This does not mean historians or researchers should ignore such documents.
            Courts, journalists, historians, and terrorism researchers all have legitimate
            reasons to preserve and study them.
          </p>

          <p>But banned-books.org is not building a terrorism archive.</p>

          <p>
            I am documenting censorship, literature, restricted cultural expression, and
            the suppression of intellectual life. That requires editorial distinctions
            not only about content, but also about purpose and context.
          </p>

          <p>
            Those distinctions are imperfect sometimes. Refusing to make any distinctions
            at all would be worse.
          </p>

          <h2>Difficult books still matter</h2>

          <p>Some works remain genuinely difficult to classify.</p>

          <p>
            Books such as{' '}
            <Link href="/books/mein-kampf"><em>Mein Kampf</em></Link>,{' '}
            <Link href="/books/lolita"><em>Lolita</em></Link>,{' '}
            <Link href="/books/the-turner-diaries"><em>The Turner Diaries</em></Link>, or{' '}
            <Link href="/books/the-anarchist-cookbook"><em>The Anarchist Cookbook</em></Link>{' '}
            continue to provoke arguments for good reason.
          </p>

          <p>
            Some inspired violence. Some remain morally disturbing. Some have histories
            tied to extremism. That discomfort is precisely why contextualization matters.
          </p>

          <p>
            Where necessary, I add editorial context explaining why a work appears in the
            archive, why it remains controversial, and why documenting censorship does
            not imply endorsement.
          </p>

          <p>
            A censorship archive that only contains books everyone already agrees with
            would not teach us much about censorship — or about ourselves.
          </p>

          <h2>Responsibility at scale</h2>

          <p>
            Banned-books.org relies partly on AI-assisted research, structured datasets,
            historical records, NGO reporting, legal documents, library data, and
            open-source archival work to identify and document restricted books around
            the world.
          </p>

          <p>That scale creates possibilities that would have been almost impossible a decade ago.</p>

          <p>It also creates new responsibilities.</p>

          <p>
            Large language models blur categories easily. Open web sources are
            inconsistent. &ldquo;Iceberg&rdquo; lists routinely mix literature,
            propaganda, abuse material, internet mythology, and criminal evidence into
            the same seductive aesthetic of forbidden knowledge.
          </p>

          <p>I reject that approach completely.</p>

          <p>
            A serious censorship archive has to distinguish between literature and
            operational propaganda, between controversial ideas and direct exploitation,
            between suppressed expression and evidence of abuse.
          </p>

          <p>Those distinctions will never be perfectly objective. I am aware of that.</p>

          <p>
            But I would rather make the editorial choices visible — and open to
            criticism — than quietly pretend they do not exist.
          </p>
        </article>
      </EssayLayout>
    </>
  )
}
