// Static informational page. No per-request data; safe to fully prerender.
// Lives under /laws/ (not /countries/fr/) on purpose: a literal `fr` segment
// folder would shadow the dynamic /countries/[code] route. /laws/ is also
// extensible — other speech regimes the archive already references
// (Volksverhetzung, Comstock Act, Verbotsgesetz) can join here later.

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { buildCitationMeta } from '@/lib/citation-meta'

const TITLE = 'The Loi Gayssot — France’s Holocaust-denial law'
const DEK =
  'France’s 1990 Gayssot Act made it a crime to deny the Nazi crimes against humanity established at Nuremberg. It is the legal basis under which several books in this archive were banned or prosecuted.'
const HREF = '/laws/loi-gayssot'
const URL = `https://www.banned-books.org${HREF}`

export const metadata: Metadata = {
  title: `${TITLE} — Banned Books`,
  description: DEK,
  openGraph: { title: TITLE, description: DEK, type: 'article' },
  alternates: { canonical: HREF },
  other: buildCitationMeta({
    entityType: 'essay',
    title: TITLE,
    url: URL,
    publicationYear: 2026,
  }),
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: TITLE,
  description: DEK,
  about: { '@type': 'Legislation', name: 'Loi n° 90-615 du 13 juillet 1990 (loi Gayssot)' },
  datePublished: '2026-05-30',
  dateModified: '2026-05-31',
  image: 'https://www.banned-books.org/laws/oradour.jpg',
  author: { '@type': 'Organization', name: 'banned-books.org' },
  publisher: {
    '@type': 'Organization',
    name: 'banned-books.org',
    logo: { '@type': 'ImageObject', url: 'https://www.banned-books.org/brand/compact-bb.png' },
  },
  mainEntityOfPage: URL,
}

// ── Hero image slot ──────────────────────────────────────────────────────────
// Drop a file in /public (e.g. /public/laws/loi-gayssot.jpg) and fill this in.
// The page renders fine without it. Keep `credit` honest about the licence.
type Hero = { src: string; alt: string; caption?: ReactNode; credit?: ReactNode }
const HERO: Hero | null = {
  src: '/laws/oradour.jpg',
  alt: 'The preserved ruins of Oradour-sur-Glane, the French village destroyed in the 1944 SS massacre.',
  caption:
    'The ruins of Oradour-sur-Glane, kept as a memorial to the 642 civilians killed by the Waffen-SS in June 1944. Vincent Reynouard’s attempt to recast that massacre was prosecuted under the Gayssot Act.',
  credit: '© L. Raedts',
}

const proseClasses =
  'prose prose-gray max-w-none ' +
  'prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight ' +
  'prose-a:text-oxblood prose-a:underline prose-a:underline-offset-2 ' +
  'prose-a:decoration-oxblood/30 hover:prose-a:decoration-oxblood ' +
  'prose-p:leading-relaxed'

// Books in the archive directly tied to the French denial / collaboration
// regime. The first group was banned or prosecuted under the negationism
// statute itself; the second under France’s older publication-control law.
const GAYSSOT_BOOKS: { slug: string; title: string; author: string }[] = [
  { slug: 'lholocauste-au-scanner', title: 'L’Holocauste au scanner', author: 'Jürgen Graf' },
  { slug: 'rapport-dexpertise-sur-la-formation-et-le-controle-de-la-presence-de-composes-cyanures-dans-les-chambres-a-gaz-dauschwitz', title: 'Rapport d’expertise … « chambres à gaz » d’Auschwitz (the “Rudolf Report”)', author: 'Germar Rudolf' },
  { slug: 'le-massacre-doradour', title: 'Le Massacre d’Oradour', author: 'Vincent Reynouard' },
  { slug: 'les-camps-de-concentration-allemands-1941-1945-mythes-propages-realites-occultees', title: 'Les Camps de concentration allemands 1941-1945, mythes propagés, réalités occultées', author: 'Vincent Reynouard' },
]

export default function LoiGayssotPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link
          href="/countries/fr"
          className="inline-block text-sm text-neutral-400 hover:text-oxblood mb-8 transition-colors"
        >
          ← Books banned in France
        </Link>

        <header className="bg-brand-light border-l-4 border-brand pl-6 pr-4 py-6 mb-10 rounded-r-xl">
          <p className="text-xs font-medium uppercase tracking-widest text-brand/70 mb-3">
            Legal context · France
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight leading-tight mb-4">
            {TITLE}
          </h1>
          <p className="text-base text-gray-700 leading-relaxed">
            {DEK}
          </p>
        </header>

        <article className={proseClasses}>
          <h2>What the law says</h2>
          <p>
            The <strong>loi Gayssot</strong> (Law n° 90-615 of 13 July 1990) added{' '}
            <em>article 24 bis</em> to France’s 1881 Law on the Freedom of the Press. It makes
            it a criminal offence to publicly dispute the existence of one or more of the{' '}
            <strong>crimes against humanity</strong> as defined by the Charter of the
            International Military Tribunal annexed to the London Agreement of 8 August 1945, and
            committed either by members of an organisation declared criminal at Nuremberg or by a
            person found guilty of such crimes by a French or international court. In practice the
            statute targets <strong>Holocaust denial</strong> (<em>négationnisme</em>).
          </p>

          {HERO && (
            <figure className="my-10 -mx-4 sm:mx-0">
              <Image
                src={HERO.src}
                alt={HERO.alt}
                width={1600}
                height={1066}
                priority
                sizes="(min-width: 768px) 720px, 100vw"
                className="w-full h-auto sm:rounded-xl"
              />
              {(HERO.caption || HERO.credit) && (
                <figcaption className="text-xs text-neutral-400 mt-2 px-4 sm:px-0">
                  {HERO.caption} {HERO.credit && <span className="text-neutral-400">{HERO.credit}</span>}
                </figcaption>
              )}
            </figure>
          )}

          <p>
            It is named after <strong>Jean-Claude Gayssot</strong>, the Communist deputy who
            introduced the bill. Conviction carries up to one year’s imprisonment and a fine of
            up to €45,000.
          </p>

          <h2>Why it was passed</h2>
          <p>
            The law was adopted amid a rise of organised Holocaust denial in France — most
            prominently the long campaign of the literature professor Robert Faurisson — and in
            the immediate aftermath of the May 1990 desecration of the Jewish cemetery at
            Carpentras, which provoked national revulsion. Parliament chose to place denial of
            the Nazi genocide outside the protection ordinarily given to historical and political
            speech.
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
            censorship event worth recording — not because the book has any merit. For works
            banned under the Gayssot Act this distinction matters more than usual. Our editorial
            notes describe what each author <em>claims</em> or <em>argues</em>; they never
            restate denialist assertions as fact. The historical record is not in doubt: the Nazi
            genocide of roughly six million Jews, the operation of the extermination camps, and
            massacres such as Oradour-sur-Glane are among the most thoroughly documented facts of
            the twentieth century. Documenting how France has confronted those who deny them is
            not endorsement of the denial.
          </p>
        </article>

        {/* ── Books in the archive banned under this regime ───────────────── */}
        <section className="mt-12 border-t border-neutral-200 pt-6">
          <h2 className="font-serif text-xl font-semibold tracking-tight text-gray-900 mb-1">
            Books in this archive tied to the Gayssot Act
          </h2>
          <p className="text-sm text-neutral-500 mb-5">
            Denial works banned or prosecuted under the negationism statute. Each carries an
            editorial note; commercial links are suppressed.
          </p>
          <ul className="space-y-2">
            {GAYSSOT_BOOKS.map((b) => (
              <li key={b.slug}>
                <Link
                  href={`/books/${b.slug}`}
                  className="group flex flex-col px-4 py-3 bg-white border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
                >
                  <span className="font-serif text-base font-medium text-gray-900 group-hover:text-oxblood transition-colors">
                    {b.title}
                  </span>
                  <span className="text-xs text-neutral-500">{b.author}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Sources ─────────────────────────────────────────────────────── */}
        <section className="mt-10 text-xs text-neutral-500 leading-relaxed">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            Sources
          </h2>
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
            <li>
              Article 24 bis, Loi du 29 juillet 1881 sur la liberté de la presse.
            </li>
            <li>
              See also our essay{' '}
              <Link href="/essays/what-we-document" className="underline hover:no-underline">
                What we document — and why that is a choice
              </Link>
              .
            </li>
          </ul>
        </section>
      </main>
    </>
  )
}
