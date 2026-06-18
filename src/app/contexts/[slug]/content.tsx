import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

// Long-form bodies for the /contexts hub pages, keyed by registry slug. Only
// slugs whose registry entry has `hasHub: true` need an entry here. The route
// supplies the title/badge (from the registry) and the data-driven book list;
// this module supplies the prose, hero, attribution sources, and any
// page-specific JSON-LD `about` node.

type Hero = { src: string; alt: string; caption?: ReactNode; credit?: ReactNode }

export type ContextContent = {
  /** Lead paragraph under the H1 (also used as the meta description). */
  dek: string
  hero?: Hero
  /** Main article body (one or more <h2> sections + <p>). */
  body: ReactNode
  /** Heading + blurb shown above the data-driven list of matching books. */
  listHeading: string
  listIntro: string
  /** Source citations for the prose. */
  sources: ReactNode
  /** Back-link target (e.g. the relevant country page). */
  backLink: { href: string; label: string }
  /** Optional schema.org node for the article's primary subject. */
  jsonLdAbout?: Record<string, unknown>
  /** Optional publication/modification dates for JSON-LD + citation meta. */
  datePublished?: string
  dateModified?: string
}

export const CONTEXT_CONTENT: Record<string, ContextContent> = {
  'liste-otto': {
    dek:
      'The Liste Otto was the list of books the German occupation authorities ordered withdrawn from sale in occupied France during the Second World War. Drawn up with the agreement of French publishers, it named some 1,060 titles in 1940 and grew to several thousand by 1943 — the works of Jewish, anti-Nazi, communist and émigré authors. The books in this archive that appear on it are victims of that censorship, not its instruments.',
    body: (
      <>
        <h2>What it was</h2>
        <p>
          On <strong>28 September 1940</strong>, three months into the German occupation of
          northern France, the occupation authorities issued a list of roughly{' '}
          <strong>1,060 book titles</strong> that were to be pulled from bookshops and
          publishers’ stocks and destroyed. It became known as the <strong>Liste Otto</strong>,
          after <strong>Otto Abetz</strong>, the German ambassador in Paris. The list named
          <em> &ldquo;ouvrages littéraires français non désirables&rdquo;</em> — French literary
          works deemed undesirable.
        </p>
        <p>
          On the same day the German authorities concluded a{' '}
          <strong>&ldquo;convention de censure&rdquo;</strong> with the French publishers’
          syndicate (the <em>Syndicat des éditeurs</em>). Under it, publishers agreed to censor
          themselves — to stop printing and selling the listed works — in exchange for being
          allowed to keep operating. The Liste Otto is therefore not only an act of occupation;
          it is also a notorious episode of <strong>collaborationist self-censorship</strong>.
        </p>

        <h2>Who was on it</h2>
        <p>
          The list targeted the works of <strong>Jewish authors</strong>, communists, anti-Nazi
          essayists, émigrés, and translations from English and Polish. Among the names were
          Thomas Mann, Stefan Zweig, Heinrich Heine, Léon Blum, Sigmund Freud and Louis Aragon.
          A later supplement to the 1943 edition listed hundreds of{' '}
          <em>&ldquo;écrivains juifs de langue française&rdquo;</em> — Jewish writers in French —
          whose entire output was banned regardless of subject.
        </p>

        <h2>How it grew</h2>
        <p>
          The September 1940 list replaced an earlier, smaller <strong>&ldquo;liste
          Bernhard&rdquo;</strong> of about 143 political titles, drawn up in Berlin and applied
          in Paris that August. A second edition of the Liste Otto followed on{' '}
          <strong>8 July 1942</strong> (around 1,170 titles), and a third on{' '}
          <strong>10 May 1943</strong>, by which point the cumulative lists ran to several
          thousand works and reached deep into British, American and Russian literature.
        </p>

        <h2>How to read these entries</h2>
        <p>
          A book’s presence on the Liste Otto means the Nazi occupation tried to erase it. These
          titles are recorded here as <strong>targets of censorship</strong>: appearing on this
          list is a mark against the regime that banned the book, not against the book or its
          author. Where an author’s complete works were swept up — the &ldquo;Toutes ses
          œuvres&rdquo; entries — we isolate those blanket bans rather than invent individual
          titles for them.
        </p>
      </>
    ),
    listHeading: 'Books in this archive on the Liste Otto',
    listIntro:
      'Titles documented here that appear on the Liste Otto and its supplements. Each was withdrawn from sale in occupied France.',
    sources: (
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <em>Liste Otto, 3e édition (1943): Ouvrages littéraires non désirables en France</em> —
          transcription on{' '}
          <a
            href="https://fr.wikisource.org/wiki/Ouvrages_litt%C3%A9raires_non_d%C3%A9sirables_en_France"
            className="underline hover:no-underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Wikisource
          </a>
          .
        </li>
        <li>
          Natalie Zemon Davis (preface), <em>Liste Otto: The Official List of French Books Banned
          under the German Occupation, 1940</em> (Harvard College Library, 1992).
        </li>
        <li>
          &ldquo;Liste Otto&rdquo; — overview on{' '}
          <a
            href="https://fr.wikipedia.org/wiki/Liste_Otto"
            className="underline hover:no-underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Wikipédia (FR)
          </a>
          .
        </li>
      </ul>
    ),
    backLink: { href: '/countries/fr', label: 'Books banned in France' },
    jsonLdAbout: { '@type': 'CreativeWork', name: 'Liste Otto (1940)' },
    datePublished: '2026-06-18',
    dateModified: '2026-06-18',
  },

  'berlin-1938-verbannte-buecher': {
    dek:
      'From 1933 the Nazi state compiled a master register of forbidden books — the “Liste des schädlichen und unerwünschten Schrifttums” (List of harmful and undesirable writing). The version as of 31 December 1938 ran to more than 4,500 entries, often sweeping up an author’s entire output. The books in this archive that appear on it are victims of that censorship.',
    body: (
      <>
        <h2>What it was</h2>
        <p>
          The <strong>Liste des schädlichen und unerwünschten Schrifttums</strong> — the “List of
          harmful and undesirable writing” — was the Nazi regime’s central index of banned books.
          The edition reproduced here is the one current as of{' '}
          <strong>31 December 1938</strong>, with <strong>more than 4,500 entries</strong>; many
          were not single titles but an author’s complete works or a whole publisher’s catalogue.
          Listed books were to be removed from bookshops, libraries and publishers’ stocks.
        </p>

        <h2>Who drew it up</h2>
        <p>
          The first &ldquo;black lists&rdquo; were assembled in the spring of 1933 by the Berlin
          librarian <strong>Dr Wolfgang Herrmann</strong> — the lists that guided the public{' '}
          <strong>book burnings of 10 May 1933</strong>. From there the{' '}
          <strong>Reichsschrifttumskammer</strong> (the Reich Chamber of Literature, established
          1 November 1933 under Goebbels’s Ministry for Public Enlightenment and Propaganda) took
          over and systematically expanded the register. A directive of 25 April 1935 formally
          charged the chamber with listing books that &ldquo;endanger National Socialist cultural
          objectives.&rdquo; A first secret draft circulated in late 1935; supplementary lists
          were issued roughly annually through 1941.
        </p>

        <h2>The source</h2>
        <p>
          The entries here are drawn from <strong>Berlin.de’s “Verbannte Bücher”</strong> (Banned
          Books) project, which digitised and made the 1938 list publicly searchable — published
          75 years after the 1933 burnings &ldquo;to reveal this theft of cultural property.&rdquo;
        </p>

        <h2>How to read these entries</h2>
        <p>
          A book’s presence on this list means the Nazi state tried to erase it. These titles are
          recorded here as <strong>targets of censorship</strong> — the mark is against the regime
          that banned them, not against the books or their authors. Where an author’s entire
          output was condemned, we isolate those blanket bans rather than fabricate individual
          titles.
        </p>
      </>
    ),
    listHeading: 'Books in this archive on the 1938 Nazi list',
    listIntro:
      'Titles documented here that appear on the “Liste des schädlichen und unerwünschten Schrifttums” as it stood at the end of 1938.',
    sources: (
      <ul className="list-disc pl-5 space-y-1">
        <li>
          Berlin.de — <em>Verbannte Bücher</em> (“Liste des schädlichen und unerwünschten
          Schrifttums”, Stand 31.12.1938):{' '}
          <a
            href="https://www.berlin.de/verbannte-buecher/"
            className="underline hover:no-underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            berlin.de/verbannte-buecher
          </a>
          .
        </li>
        <li>
          Berlin.de — <em>About this project</em>, on the list’s origins and the
          Reichsschrifttumskammer.
        </li>
      </ul>
    ),
    backLink: { href: '/countries/de', label: 'Books banned in Germany' },
    jsonLdAbout: {
      '@type': 'CreativeWork',
      name: 'Liste des schädlichen und unerwünschten Schrifttums (1938)',
    },
    datePublished: '2026-06-18',
    dateModified: '2026-06-18',
  },

  'russia-federal-extremist-list': {
    dek:
      'Russia’s Federal List of Extremist Materials is the state register of works that courts have ruled “extremist.” Maintained by the Ministry of Justice since 2007, it had grown past 5,300 entries — books, leaflets, websites, songs and videos — and ranges from genuine hate literature to peaceful religious and political texts. Producing, storing or distributing a listed work is a criminal offence in Russia.',
    body: (
      <>
        <h2>What it is</h2>
        <p>
          The <strong>Federal List of Extremist Materials</strong> (
          <em>Федеральный список экстремистских материалов</em>) is Russia’s official register of
          banned material, compiled and published by the{' '}
          <strong>Ministry of Justice of the Russian Federation</strong>. By January 2023 it
          contained roughly <strong>5,300 entries</strong> — not only books but pamphlets,
          websites, songs, videos, artwork and poetry.
        </p>

        <h2>The legal basis</h2>
        <p>
          The list rests on <strong>Federal Law No. 114-FZ, “On Countering Extremist
          Activity,”</strong> enacted on <strong>25 July 2002</strong>. Article 13 of that law
          directs the Ministry of Justice to maintain a single federal list; the ministry has
          published it since <strong>14 July 2007</strong>. Once a work is listed, its production,
          storage and distribution — including online quotation outside academic work — becomes an
          offence.
        </p>

        <h2>How material is added</h2>
        <p>
          The ministry does not decide what is extremist. A <strong>Russian court</strong> makes
          that ruling — usually on a prosecutor’s submission, often prompted by the security
          services — at the place where the material was found or distributed. The decision can be
          appealed, but in practice the list has expanded steadily and unevenly.
        </p>

        <h2>What is on it — and why it is contested</h2>
        <p>
          The register mixes genuine hate material — <em>Mein Kampf</em>, fascist tracts — with a
          great deal of peaceful religious and political writing: Jehovah’s Witnesses
          publications, Said Nursî’s <em>Risale-i Nur</em> Islamic commentaries, Falun Gong
          literature, Scientology works, and material by Kremlin critics. Human-rights monitors
          have long argued that the law’s vague definition of &ldquo;extremism&rdquo; makes the
          list a tool for suppressing religious minorities and dissent.
        </p>

        <h2>How to read these entries</h2>
        <p>
          Listing here means the Russian state has declared the work illegal — a censorship event
          worth recording. It is not our endorsement of a book’s contents, nor (for the genuine
          hate material on the register) a defence of them; we document the <em>act of banning</em>
          and leave the reader to weigh the work.
        </p>
      </>
    ),
    listHeading: 'Books in this archive on the Federal List',
    listIntro:
      'Titles documented here that appear on Russia’s Federal List of Extremist Materials. The full register also covers non-book material we do not catalogue.',
    sources: (
      <ul className="list-disc pl-5 space-y-1">
        <li>
          Ministry of Justice of the Russian Federation — Federal List of Extremist Materials:{' '}
          <a
            href="https://minjust.gov.ru/ru/extremist-materials/"
            className="underline hover:no-underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            minjust.gov.ru
          </a>
          .
        </li>
        <li>
          Federal Law No. 114-FZ of 25 July 2002, “On Countering Extremist Activity” (Article 13).
        </li>
        <li>
          &ldquo;Federal List of Extremist Materials&rdquo; — overview on{' '}
          <a
            href="https://en.wikipedia.org/wiki/Federal_List_of_Extremist_Materials"
            className="underline hover:no-underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Wikipedia
          </a>
          .
        </li>
      </ul>
    ),
    backLink: { href: '/countries/ru', label: 'Books banned in Russia' },
    jsonLdAbout: {
      '@type': 'Legislation',
      name: 'Federal Law No. 114-FZ “On Countering Extremist Activity” (2002)',
    },
    datePublished: '2026-06-18',
    dateModified: '2026-06-18',
  },

  'loi-gayssot': {
    dek:
      'France’s 1990 Gayssot Act made it a crime to deny the Nazi crimes against humanity established at Nuremberg. It is the legal basis under which several books in this archive were banned or prosecuted.',
    hero: {
      src: '/laws/oradour.jpg',
      alt: 'The preserved ruins of Oradour-sur-Glane, the French village destroyed in the 1944 SS massacre.',
      caption:
        'The ruins of Oradour-sur-Glane, kept as a memorial to the 642 civilians killed by the Waffen-SS in June 1944. Vincent Reynouard’s attempt to recast that massacre was prosecuted under the Gayssot Act.',
      credit: '© L. Raedts',
    },
    body: (
      <>
        <h2>What the law says</h2>
        <p>
          The <strong>loi Gayssot</strong> (Law n° 90-615 of 13 July 1990) added{' '}
          <em>article 24 bis</em> to France’s 1881 Law on the Freedom of the Press. It makes it a
          criminal offence to publicly dispute the existence of one or more of the{' '}
          <strong>crimes against humanity</strong> as defined by the Charter of the International
          Military Tribunal annexed to the London Agreement of 8 August 1945, and committed
          either by members of an organisation declared criminal at Nuremberg or by a person
          found guilty of such crimes by a French or international court. In practice the statute
          targets <strong>Holocaust denial</strong> (<em>négationnisme</em>).
        </p>
        <p>
          It is named after <strong>Jean-Claude Gayssot</strong>, the Communist deputy who
          introduced the bill. Conviction carries up to one year’s imprisonment and a fine of up
          to €45,000.
        </p>

        <h2>Why it was passed</h2>
        <p>
          The law was adopted amid a rise of organised Holocaust denial in France — most
          prominently the long campaign of the literature professor Robert Faurisson — and in the
          immediate aftermath of the May 1990 desecration of the Jewish cemetery at Carpentras,
          which provoked national revulsion. Parliament chose to place denial of the Nazi
          genocide outside the protection ordinarily given to historical and political speech.
        </p>

        <h2>How it has been applied</h2>
        <p>
          Faurisson was among the first convicted under the new statute. The philosopher Roger
          Garaudy was convicted in 1998 for <em>Les Mythes fondateurs de la politique
          israélienne</em>. Vincent Reynouard has been convicted repeatedly and has spent years
          as a fugitive across Europe. Several of the works documented in this archive were
          banned by ministerial decree or prosecuted on this basis.
        </p>

        <h2>It remains contested</h2>
        <p>
          The Gayssot Act is debated even by people who despise what it punishes. Critics —
          including historians associated with the 2005 <em>Liberté pour l’histoire</em> appeal
          led by Pierre Nora — argue that the state should not legislate historical truth, and
          that &ldquo;memory laws&rdquo; risk turning the courtroom into an arbiter of the past.
          Its defenders answer that organised denial is not historical inquiry but a vehicle for
          antisemitism, and that a society has the right to refuse it a platform. That tension —
          between free expression and the protection of a documented historical record — is
          exactly why these cases belong in a censorship archive.
        </p>

        <h2>Why these books appear here — and how to read them</h2>
        <p>
          We document a book because the <em>act of banning or prosecuting it</em> is a
          censorship event worth recording — not because the book has any merit. For works banned
          under the Gayssot Act this distinction matters more than usual. Our editorial notes
          describe what each author <em>claims</em> or <em>argues</em>; they never restate
          denialist assertions as fact. The historical record is not in doubt: the Nazi genocide
          of roughly six million Jews, the operation of the extermination camps, and massacres
          such as Oradour-sur-Glane are among the most thoroughly documented facts of the
          twentieth century. Documenting how France has confronted those who deny them is not
          endorsement of the denial.
        </p>
      </>
    ),
    listHeading: 'Books in this archive tied to the Gayssot Act',
    listIntro:
      'Denial works banned or prosecuted under the negationism statute. Each carries an editorial note; commercial links are suppressed.',
    sources: (
      <ul className="list-disc pl-5 space-y-1">
        <li>
          Loi n° 90-615 du 13 juillet 1990 (loi Gayssot) — full text on{' '}
          <a
            href="https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000532990/"
            className="underline hover:no-underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Légifrance
          </a>
          .
        </li>
        <li>Article 24 bis, Loi du 29 juillet 1881 sur la liberté de la presse.</li>
        <li>
          See also our essay{' '}
          <Link href="/essays/what-we-document" className="underline hover:no-underline">
            What we document — and why that is a choice
          </Link>
          .
        </li>
      </ul>
    ),
    backLink: { href: '/countries/fr', label: 'Books banned in France' },
    jsonLdAbout: {
      '@type': 'Legislation',
      name: 'Loi n° 90-615 du 13 juillet 1990 (loi Gayssot)',
    },
    datePublished: '2026-05-30',
    dateModified: '2026-06-18',
  },
}

// Re-exported here so the route can render the hero without re-deriving the type.
export function ContextHero({ hero }: { hero: Hero }) {
  return (
    <figure className="my-10 -mx-4 sm:mx-0">
      <Image
        src={hero.src}
        alt={hero.alt}
        width={1600}
        height={1066}
        priority
        sizes="(min-width: 768px) 720px, 100vw"
        className="w-full h-auto sm:rounded-xl"
      />
      {(hero.caption || hero.credit) && (
        <figcaption className="text-xs text-neutral-400 mt-2 px-4 sm:px-0">
          {hero.caption} {hero.credit && <span className="text-neutral-400">{hero.credit}</span>}
        </figcaption>
      )}
    </figure>
  )
}
