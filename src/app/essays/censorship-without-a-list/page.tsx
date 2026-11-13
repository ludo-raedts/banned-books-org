import type { Metadata } from 'next'
import Link from '@/components/link'
import EssayLayout from '@/components/essay-layout'
import { essayBySlug, essayMetaDescription } from '@/lib/essays-data'
import { buildCitationMeta } from '@/lib/citation-meta'

const essay = essayBySlug('censorship-without-a-list')!

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

const BARCK = 'https://doi.org/10.14765/zzf.dok.1.1045'

function Figure({
  src, alt, children,
}: { src: string; alt: string; children: React.ReactNode }) {
  return (
    <figure className="not-prose my-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" className="w-full max-w-xl mx-auto rounded-lg" />
      <figcaption className="mx-auto mt-2 max-w-xl text-xs text-neutral-500 leading-relaxed">
        {children}
      </figcaption>
    </figure>
  )
}

export default function CensorshipWithoutAListPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EssayLayout essay={essay}>
        <h2>No list you can look up</h2>

        <p>
          Ask where to find the list of books banned in East Germany &mdash; officially the
          German Democratic Republic, GDR &mdash; and you will be pointed at a list. The{' '}
          <em>Liste der auszusondernden Literatur</em> began in the Soviet occupation zone in
          1946, three years before the GDR existed, and its last supplement appeared in 1953,
          issued by the GDR&rsquo;s Ministry of Education. It was aimed at Nazi and militarist
          literature, and runs to some 31,500 entries. We keep it as a separate{' '}
          <Link href="/registers/sbz-1946">register</Link> and do not count it with the cases
          below, because it belongs to a different kind of censorship.
        </p>

        <p>
          For the thirty-six years after 1953 we found no public, comprehensive list. Internal
          overviews did exist &mdash; in early 1956 the censorship office&rsquo;s fiction
          department compiled a list of the manuscripts that had been refused a print permit
          in 1954 and 1955 &mdash; but they were working papers, not a register anyone could
          consult. Most of the evidence survives in publishing files, print-permit decisions
          and accounts of books stopped on the way to the shop or at the border.
        </p>

        <p>
          That is because the system worked on books before they existed. A manuscript needed
          a <em>Druckgenehmigung</em>, a print permit, from a state office &mdash; first the
          Amt f&uuml;r Literatur, later the Hauptverwaltung Verlage und Buchhandel. A book that
          did not get one was not &ldquo;banned&rdquo;; it was simply not printed. A book that
          did get one could still have its delivery stopped, its edition pulped, or its
          authorisation withdrawn after the fact. And an author who sent a manuscript to a
          West German publisher without the consent of the state&rsquo;s copyright office
          could be fined, expelled from the Writers&rsquo; Union, or arrested.
        </p>

        <p>
          The refusal of Hans Hellmut Kirst&rsquo;s army novel <em>08/15</em> in 1955 is
          recorded in the standard study with a single dry sentence: the ban apparently did not
          even need a comment. The censorship left a substantial paper trail, but no public
          catalogue that we could use.
        </p>

        <h2>So we built one, by hand</h2>

        <p>
          When we added East Germany to the catalogue, the existing data stopped at 1953. To
          cover the other thirty-six years there was no table to import. We went looking for
          cases one at a time, and we set rules for what counts.
        </p>

        <p>
          A case needs <strong>a censorship act by a state or party body against a named
          book</strong>: a print permit refused, an edition pulled or pulped, a delivery
          stopped, an import blocked, an author punished for a Western edition. We also file
          &ldquo;restricted&rdquo; cases &mdash; forced cuts, a print run capped by decree, a
          release delayed for years &mdash; and mark them as restricted, not banned.
        </p>

        <h3>Where we looked</h3>

        <p>
          The backbone is Simone Barck, Martina Langermann and Siegfried Lokatis,{' '}
          <a href={BARCK}><em>&bdquo;Jedes Buch ein Abenteuer&ldquo;</em></a> (Akademie
          Verlag, 1997; open-access reprint from the ZZF Potsdam). It is built on the files of
          the censorship administration itself, held in the Bundesarchiv, and it gives page
          numbers, dates and the censors&rsquo; own wording. It covers the 1950s and 1960s.
          For the later decades we relied on articles from the Federal Agency for Civic
          Education (bpb), a Deutschland Archiv essay on Stefan Heym, regional press, school
          and university reference pages, and a handful of reviews. Wikipedia appears only as
          a second source, never as the only one.
        </p>

        <p>
          At the time of writing the catalogue holds 61 East German books documented this way,
          each with one recorded act. For each we noted the sentence in the source that states
          the fact, in the original German, and re-checked it against the cited page; those
          quotations are kept in our research notes, not on the book pages. Printed sources
          are cited with page numbers; online articles, which have none, are cited with a
          direct link.
        </p>

        <Figure
          src="/essays/ddr/writers-congress-1952.jpg"
          alt="Delegates at the Third German Writers' Congress in East Berlin, May 1952"
        >
          Third German Writers&rsquo; Congress, East Berlin, 22&ndash;25 May 1952. Photo:
          Lothar Gielow / Bundesarchiv, Bild 183-14811-0006,{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Bundesarchiv_Bild_183-14811-0006,_Berlin,_3._Deutscher_Schriftsteller-Kongress.jpg">Wikimedia Commons</a>,
          CC BY-SA 3.0 DE.
        </Figure>

        <h3>What we left out is just as revealing</h3>

        <p>
          Beyond the 61 we researched 39 further cases and did not import them. Some rest on
          a single Wikipedia sentence; some lack a date, or concern a minor or unidentifiable
          title; in some the refusal came from a publisher&rsquo;s own editors with no state
          decision on file. A further 77 leads we dropped outright &mdash; among them Peter
          Huchel&rsquo;s <em>Chausseen Chausseen</em>, where the sources tie his later
          isolation to a prize he refused to decline, not to a ruling on the book.
        </p>

        <p>
          One correction is worth telling in full. An earlier import, drawn from a Wikipedia
          list, had given us Christa Wolf&rsquo;s <em>Was bleibt</em> as a 1979 ban. When we
          went looking for the act itself there was none: the book was never banned, and we
          removed it. It is the reason for the rule above that a named act must exist, not just
          a place on somebody&rsquo;s list.
        </p>

        <p>
          One source we consulted we do not cite: the biographical database &ldquo;Wer war
          wer in der DDR&rdquo; of the Bundesstiftung Aufarbeitung blocks automated access,
          so we could not re-check its quotations. A fact we cannot re-check does not go into
          the catalogue.
        </p>

        <p>
          The files of the censorship administration, on which the Barck study rests, are held
          in the Bundesarchiv (DR 1). We did not consult them directly; we cite them through
          the study, which is why we give you page numbers rather than images of the pages.
        </p>

        <h2>Patterns in what we documented</h2>

        <p>
          Across these cases several patterns emerge. They do not cover the whole history of
          censorship in the GDR, and they reflect the sources that were available to us, but
          they show some of the ways it operated.
        </p>

        <h3>1. The early refusals: &ldquo;decadent,&rdquo; &ldquo;superfluous&rdquo;</h3>

        <p>
          In 1955 the censorship office struck <Link href="/books/der-tod-in-rom">Wolfgang
          Koeppen&rsquo;s <em>Der Tod in Rom</em></Link>, a West German novel about the Nazi
          past, on the grounds that it showed the hopelessness of man in bourgeois society and
          &ldquo;glorified pederasty.&rdquo; Two years later his{' '}
          <Link href="/books/tauben-im-gras"><em>Tauben im Gras</em></Link> became the first
          novel refused explicitly &ldquo;because of its decadent content.&rdquo; Tucholsky was
          struck from a planned reissue so as not to cause confusion about the concept of
          fatherland. <Link href="/books/the-citadel">A. J. Cronin&rsquo;s{' '}
          <em>The Citadel</em></Link> was dropped from a publisher&rsquo;s programme because
          its publication was judged &ldquo;superfluous.&rdquo; William Faulkner&rsquo;s{' '}
          <Link href="/books/a-fable"><em>A Fable</em></Link> was withdrawn as mystical and
          pacifist; J. B. Priestley&rsquo;s{' '}
          <Link href="/books/let-the-people-sing"><em>Let the People Sing</em></Link> was
          blocked because of the author, who had opposed the Stockholm Appeal.
        </p>

        <p>
          These are not underground books. They are the kind of foreign literature a
          literate reader in any country expected to find translated. About fourteen of the
          cases are Western or Soviet licence editions refused in 1955&ndash;58, which is why
          we describe them as refused editions, not as banned authors.
        </p>

        <h3>2. The ally as censor</h3>

        <p>
          Not every ban came from East Berlin. Isaac Babel&rsquo;s <em>Red Cavalry</em> stories
          were already in proof when, in April 1958, the board of the Society for German-Soviet
          Friendship &mdash; the owner of the publisher &mdash; and a Central Committee official
          had them struck; Babel appeared in the GDR only in 1964, shortly after a West German
          edition. Daniil Granin&rsquo;s novel was stopped so as not to give German readers
          &ldquo;false ideas&rdquo; about the Soviet Union. And in 1978 the Soviet ambassador
          protested to Erich Honecker in person about{' '}
          <Link href="/books/tod-am-meer">Werner Heiduczek&rsquo;s <em>Tod am Meer</em></Link>,
          which showed Red Army soldiers raping German women. The book was withdrawn and not
          reissued until 1987.
        </p>

        <Figure
          src="/essays/ddr/uprising-1953.jpg"
          alt="Workers and a Soviet soldier on a street in East Berlin, 17 June 1953"
        >
          East Berlin, 17 June 1953. Photo: Bundesarchiv, Bild 146-2003-0031 (photographer
          unknown),{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Bundesarchiv_Bild_146-2003-0031,_Berlin,_Aufstand,_Bauarbeiter.jpg">Wikimedia Commons</a>,
          CC BY-SA 3.0 DE.
        </Figure>

        <h3>3. Writing about the uprising</h3>

        <p>
          After 17 June 1953 the Mitteldeutscher Verlag stopped delivery of Werner
          Reinowski&rsquo;s <Link href="/books/diese-welt-muss-unser-sein"><em>Diese Welt
          mu&szlig; unser sein</em></Link> except for the 2,000 copies already with libraries; two
          weeks later the Central Committee gave the same instruction.
        </p>

        <p>
          Stefan Heym&rsquo;s case is the better documented. He finished a novel about the
          uprising in 1959, under the working title <em>Der Tag X</em>. No GDR publisher would
          take it, and in 1960 he duplicated the manuscript and sent it to Ulbricht, Grotewohl
          and other leaders, hoping to force a permit. According to the Barck study, ten to
          twenty, possibly fifty copies then circulated at every level of the hierarchy. It did
          not help. The reworked version was refused again in 1974 because it did not match
          the official view of the event, and appeared in Munich as{' '}
          <Link href="/books/5-tage-im-juni"><em>5 Tage im Juni</em></Link>; the first GDR
          edition came out in 1989.
        </p>

        <h3>4. December 1965 and the books that never came out</h3>

        <p>
          The 11th Plenum of the SED Central Committee in December 1965 turned a literary
          policy into a purge. <Link href="/books/rummelplatz">Werner Br&auml;unig&rsquo;s{' '}
          <em>Rummelplatz</em></Link> is the clearest case. It is a novel about the miners of
          the Wismut mining company, and in October 1965 a chapter was pre-printed in the
          journal <em>Neue Deutsche Literatur</em>. Ulbricht and Honecker attacked it around
          the Plenum, still unfinished. In February 1966 the publisher and the Central
          Committee&rsquo;s culture department agreed that it would have to be fundamentally
          rewritten, and the project was put off indefinitely. The contract was dissolved in
          1967. A longer excerpt from the manuscript, then about 900 pages, appeared in 1981,
          five years after Br&auml;unig&rsquo;s death; the novel itself was first published in
          2007. For a reader in the GDR the book consisted of one chapter in a journal.
        </p>

        <p>
          Irmtraud Morgner&rsquo;s{' '}
          <Link href="/books/rumba-auf-einen-herbst"><em>Rumba auf einen Herbst</em></Link>{' '}
          lost a print permit it already had, and the manuscript itself disappeared inside the
          administration. It was reconstructed after her death and published in 1992.
        </p>

        <Figure
          src="/essays/ddr/bitterfeld-1959.jpg"
          alt="Visitors browsing a table of books at an authors' conference in Bitterfeld, April 1959"
        >
          Visitors at the book table of the Mitteldeutscher Verlag authors&rsquo; conference,
          Bitterfeld, 24 April 1959. Photo: Schmidt / Bundesarchiv, Bild 183-63679-0010,{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Bundesarchiv_Bild_183-63679-0010,_1._Bitterfelder_Konferenz,_B%C3%BCchertisch.jpg">Wikimedia Commons</a>,
          CC BY-SA 3.0 DE.
        </Figure>

        <h3>5. The West as an escape route &mdash; and a crime</h3>

        <p>
          From the late 1960s the most common story is the same. A writer cannot publish at
          home, a West German publisher does, and the state punishes the author for it. Heym
          was fined in 1969 for the West German edition of{' '}
          <Link href="/books/lassalle"><em>Lassalle</em></Link>. In 1979 he published{' '}
          <Link href="/books/collin"><em>Collin</em></Link> in the West without the consent of
          the state&rsquo;s copyright office, was prosecuted for a &ldquo;currency
          offence,&rdquo; fined 9,000 marks and expelled from the Writers&rsquo; Union within
          weeks; the book appeared in the GDR in 1990. Wolfgang Hilbig&rsquo;s first poetry
          collection earned him the same charge. Monika Maron&rsquo;s{' '}
          <Link href="/books/flugasche"><em>Flugasche</em></Link>, about pollution in Bitterfeld,
          was refused on the grounds of &ldquo;Schwarzmalerei&rdquo; (painting everything
          black); none of her later books received a permit either.
        </p>

        <p>
          Some paid more. <Link href="/books/die-alternative-zur-kritik-des-real-existierenden-sozialismus">Rudolf
          Bahro</Link> wrote his critique of &ldquo;really existing socialism&rdquo; in secret
          and had it published in West Germany in 1977. He was arrested the day after{' '}
          <em>Der Spiegel</em> printed an extract and sentenced to eight years in 1978; he was
          deported to the West in 1979. The book circulated at home only in smuggled copies.
        </p>

        <Figure
          src="/essays/ddr/heym-1989.jpg"
          alt="Stefan Heym speaking at the Alexanderplatz demonstration in East Berlin, 4 November 1989"
        >
          Stefan Heym speaks at the Alexanderplatz demonstration, East Berlin, 4 November
          1989. Photo: Hubert Link / Bundesarchiv, Bild 183-1989-1104-039,{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Bundesarchiv_Bild_183-1989-1104-039,_Berlin,_Stefan_Heym_spricht_auf_dem_Alexanderplatz.jpg">Wikimedia Commons</a>,
          CC BY-SA 3.0 DE.
        </Figure>

        <h3>6. The permit that was withdrawn after the fact</h3>

        <p>
          In the last years the pattern shifts again. The permit is granted, the book is
          printed &mdash; and then it is stopped. Christoph Hein&rsquo;s{' '}
          <Link href="/books/horns-ende"><em>Horns Ende</em></Link> had its permit in February
          1985; after the copies reached the central distribution depot an order from above
          stopped delivery, and they were released only in February 1986, without advertising.
          Volker Braun&rsquo;s <Link href="/books/hinze-kunze-roman"><em>Hinze-Kunze-Roman</em></Link>{' '}
          went on sale in 1985, and on 10 September, at half past seven in the morning, further
          delivery was stopped; the deputy culture minister who had granted the permit faced
          disciplinary proceedings.
        </p>

        <p>
          G&uuml;nter de Bruyn&rsquo;s <Link href="/books/neue-herrlichkeit"><em>Neue
          Herrlichkeit</em></Link> shows the mechanism most clearly. The publishing
          administration had granted the permit in 1983. Then the West German licence edition
          appeared, and the reviewers there praised the author&rsquo;s critical daring. The
          administration revoked the permit, decided on 20 June 1984 not to publish the book
          in the GDR, and the already printed first edition of the Mitteldeutscher Verlag was
          pulped. A year later, in 1985, it was released unchanged.
        </p>

        <h2>What the numbers cannot tell you</h2>

        <p>
          These 61 cases cannot represent the full extent of censorship in the GDR. They are
          the cases that left a verifiable trail in the sources we could reach, and the trail
          is uneven: the Barck study ends in the late 1960s, so the 1970s and 1980s rest more
          on secondary literature. Some of the effects of censorship leave no manuscript to
          find &mdash; a passage an author never wrote, or a book a publisher decided not to
          submit &mdash; and those we cannot count at all.
        </p>

        <p>
          What we can say is that there was no simple overview to consult, but there are
          individual stories and files from which part of the picture can be reconstructed. You
          can browse the cases on the <Link href="/countries/dd">East Germany (DDR) page</Link>{' '}
          or <Link href="/search?country=DD">search all of them</Link>. If you know of a case
          we missed, or one of ours that is wrong, we would like to hear about it.
        </p>

        <h2>Sources and further reading</h2>

        <ul>
          <li>
            Simone Barck, Martina Langermann, Siegfried Lokatis,{' '}
            <a href={BARCK}><em>&bdquo;Jedes Buch ein Abenteuer&ldquo;. Zensur-System und
            literarische &Ouml;ffentlichkeiten in der DDR bis Ende der sechziger Jahre</em></a>{' '}
            (Akademie Verlag, 1997; open-access reprint, ZZF Potsdam). The main source for the
            1950s and 1960s.
          </li>
          <li>
            Siegfried Lokatis, &ldquo;Die Hauptverwaltung des Leselandes&rdquo;,{' '}
            <a href="https://www.bpb.de/shop/zeitschriften/apuz/32144/die-hauptverwaltung-des-leselandes/"><em>Aus
            Politik und Zeitgeschichte</em> 11/2009</a> (bpb).
          </li>
          <li>
            Manfred J&auml;ger, &ldquo;Das Wechselspiel von Selbstzensur und Literaturlenkung in
            der DDR&rdquo;,{' '}
            <a href="https://www.bpb.de/shop/zeitschriften/apuz/archiv/535791/das-wechselspiel-von-selbstzensur-und-literaturlenkung-in-der-ddr/"><em>Aus
            Politik und Zeitgeschichte</em> 41&ndash;42/1991</a> (bpb).
          </li>
          <li>
            J&ouml;rg Bernhard Bilke, &ldquo;Die verdr&auml;ngte Wirklichkeit. DDR-Literatur unter
            Erich Honecker 1971&ndash;1978&rdquo;,{' '}
            <a href="https://www.bpb.de/shop/zeitschriften/apuz/archiv/530883/die-verdraengte-wirklichkeit-ddr-literatur-unter-erich-honecker-1971-1978/"><em>Aus
            Politik und Zeitgeschichte</em> 23/1978</a> (bpb).
          </li>
          <li>
            <a href="https://www.bpb.de/themen/deutschlandarchiv/53090/mehr-als-ein-weltliterat/?p=all">&ldquo;Mehr
            als ein Weltliterat&rdquo;</a> on Stefan Heym, Deutschland Archiv (bpb).
          </li>
          <li>
            The <Link href="/registers/sbz-1946">1946&ndash;1953 removal lists</Link>, in the
            transcription by Olaf Simons on polunbi.de, are described on our{' '}
            <Link href="/sources">sources page</Link>.
          </li>
        </ul>

        <p className="text-sm text-neutral-500">
          German quotations in our research notes are translated by us where they appear in
          this essay. Photographs: Bundesarchiv via Wikimedia Commons, CC BY-SA 3.0 DE, as
          credited under each image.
        </p>
      </EssayLayout>
    </>
  )
}
