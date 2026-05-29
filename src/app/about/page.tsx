// ISR: about page is mostly editorial copy + 4 small DB counts (totals
// shown in the hero). Hourly regen is plenty; the counts change at most
// after enrichment cycles.
export const revalidate = 3600

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import ContactForm from '@/components/contact-form'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

export const metadata: Metadata = {
  title: 'About',
  description: 'Banned Books is an independent open catalogue of books banned by governments and schools worldwide. Learn about our mission, methodology, and editorial principles.',
  alternates: {
    canonical: '/about',
    types: { 'text/markdown': '/about.md' },
  },
}

async function getStats() {
  const s = adminClient()
  const [books, bans, activeBans, sources, countriesRes] = await Promise.all([
    s.from('books').select('*', { count: 'exact', head: true }),
    s.from('bans').select('*', { count: 'exact', head: true }),
    s.from('bans').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    s.from('ban_sources').select('*', { count: 'exact', head: true }),
    s.from('mv_ban_counts').select('*', { count: 'exact', head: true }),
  ])

  return {
    books: books.count ?? 0,
    bans: bans.count ?? 0,
    countries: countriesRes.count ?? 0,
    activeBans: activeBans.count ?? 0,
    sources: sources.count ?? 0,
    updatedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  }
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Banned Books',
  url: 'https://www.banned-books.org',
  description: 'An independent open catalogue of books banned, challenged, or restricted by governments, schools, and libraries worldwide.',
  foundingDate: '2026',
  knowsAbout: ['Book censorship', 'Literary freedom', 'Intellectual freedom', 'Index librorum prohibitorum'],
}

export default async function AboutPage() {
  const stats = await getStats()

  const heroStats = [
    { value: stats.books.toLocaleString('en'), label: 'Books catalogued' },
    { value: stats.bans.toLocaleString('en'), label: 'Bans documented' },
    { value: stats.countries.toString(), label: 'Countries & territories' },
    { value: stats.activeBans.toLocaleString('en'), label: 'Active bans' },
    { value: stats.sources.toLocaleString('en'), label: 'Source citations' },
    { value: '1559', label: 'Earliest record' },
  ]

  const differentiators = [
    { icon: '🌍', title: 'Global scope', body: `${stats.countries} countries including defunct states like the Soviet Union, Czechoslovakia, and East Germany.` },
    { icon: '📖', title: 'Per-book context', body: 'Each title has a "Why it was banned" section explaining who banned it, why, and what happened next.' },
    { icon: '🔍', title: 'Browsable by country, reason, and author', body: 'Not just a flat list — filter by geography, ideology, or the people behind the books.' },
    { icon: '📗', title: 'Free reading links', body: 'Where a book is in the public domain, we link to the free text on Project Gutenberg.' },
    { icon: '🔗', title: 'Source citations on every ban', body: 'PEN America, ALA, Index on Censorship, Freedom to Read Canada — every ban traces back to a source.' },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main>
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
          <div className="max-w-5xl mx-auto">
            <Eyebrow>About this project</Eyebrow>

            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900 max-w-[820px]">
              An open catalogue of censored literature.
            </h1>

            <div className="max-w-[820px]">
              <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-black border-b border-neutral-200 py-4">
                {heroStats.map(s => (
                  <div key={s.label}>
                    <div className="not-italic font-serif text-3xl md:text-4xl font-semibold tracking-tight text-oxblood tabular-nums">
                      {s.value}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-600">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
                Banned Books is an independent, open catalogue of books banned, challenged, or removed by governments, schools, and libraries worldwide.
              </p>
              <p className="mt-3 text-sm md:text-base leading-relaxed text-gray-700">
                We document the who, where, when, and why of literary censorship — from Cold War prohibitions to today&apos;s classroom removals.
              </p>
            </div>
          </div>
        </section>

        {/* ── Mission / What counts / Data transparency ─────────────── */}
        <SectionShell tone="cream">
          <article className="max-w-3xl mx-auto prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-oxblood/30 prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900">

            <h2 className="!mt-0">Mission</h2>
            <p>
              Banned Books started in April 2026 as a personal project by Ludo Raedts, a Dutch entrepreneur based in Groningen, the Netherlands. Frustrated by the lack of a single, structured, international reference for book censorship data, he built one from scratch — using open data sources, public records, and AI-assisted tooling.
            </p>
            <p>
              The mission is simple: make censorship visible. A ban that is not recorded is a ban that can be denied. Every entry in this catalogue represents a documented act of suppression — a government, school board, or institution that decided a book was too dangerous for its citizens or students to read.
            </p>
            <p>
              The catalogue currently documents <strong>{stats.books.toLocaleString('en')} books</strong> and <strong>{stats.bans.toLocaleString('en')} bans</strong> across <strong>{stats.countries} countries and territories</strong>, from the Vatican&apos;s Index Librorum Prohibitorum (1559) to school board removals in 2025. The site is free, non-commercial, and built in the open.
            </p>

            <h2>What counts as a ban</h2>
            <p>
              We use &ldquo;ban&rdquo; as a broad umbrella for three related phenomena. A <strong>formal ban</strong> is a legal prohibition: a government law or court order that makes possessing or distributing a book a criminal act. A <strong>restriction</strong> is an institutional removal — a school district pulling a title from its library, a prison service blocking access, a public library system withdrawing a book under political pressure. A <strong>challenge</strong> is a documented formal complaint that resulted in removal or restriction, typically reported through PEN America or the American Library Association.
            </p>
            <p>
              We do not record unsuccessful challenges (complaints that were rejected), informal social pressure, or self-censorship by publishers. Every entry requires a verifiable source: a court judgment, a government decree, a news report, a PEN America data export, or an ALA challenged books report. Entries without sources are not published.
            </p>
            <p>
              Books are selected for inclusion when there is credible documented evidence of a ban, restriction, or challenge. We do not make editorial judgments about whether a ban was justified — we document what happened.
            </p>
            <p>
              <Link href="/methodology">Read the full methodology →</Link>
              {' · '}
              <Link href="/challenged-books">Browse challenged books →</Link>
            </p>

            <h2>Data transparency</h2>
            <p>
              The database is updated continuously. This page was last rendered on <strong>{stats.updatedAt}</strong>. There are currently <strong>{stats.sources.toLocaleString('en')} source citations</strong> attached to bans in the catalogue, drawn primarily from PEN America, the American Library Association, Index on Censorship, Freedom to Read Canada, and Wikipedia&apos;s lists of banned books. See the{' '}
              <Link href="/sources">full list of sources</Link>{' '}for details.
            </p>
            <p>
              <strong>Coverage gaps we acknowledge openly:</strong> The data is heavily skewed toward the United States, the United Kingdom, Canada, and Western Europe — countries with active civil society organisations that systematically track censorship. Bans in authoritarian states (China, Russia, Iran, North Korea, Saudi Arabia) are far more common but far less documented. We record what we can verify; we do not extrapolate. The United States appearing prominently in our data reflects systematic reporting, not uniquely American censorship.
            </p>
            <p>
              We do not have comprehensive coverage of non-English-language sources. A book banned in Uzbekistan in 2019 is unlikely to appear in our catalogue unless it generated coverage in an English-language source we index. This is a structural limitation we are working to address.
            </p>

          </article>
        </SectionShell>

        {/* ── What makes it different (icon list) ───────────────────── */}
        <SectionShell tone="white" eyebrow="Differentiators">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30">
              What makes it different
            </h2>
            <ul className="flex flex-col gap-5">
              {differentiators.map(({ icon, title, body }) => (
                <li key={title} className="flex gap-4 items-start">
                  <span className="text-2xl leading-none shrink-0">{icon}</span>
                  <div>
                    <p className="font-serif text-base font-semibold text-gray-900">{title}</p>
                    <p className="text-sm text-neutral-700 leading-relaxed mt-0.5">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </SectionShell>

        {/* ── Editorial stance ──────────────────────────────────────── */}
        <SectionShell tone="cream">
          <article className="max-w-3xl mx-auto prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:mt-0 prose-h2:mb-6 prose-h2:pb-3 prose-h2:border-b prose-h2:border-oxblood/30 prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900">
            <h2>Editorial stance</h2>
            <p>
              This site documents censorship. It does not endorse it — and it does not endorse the books it catalogues either. Some of the titles in this database contain material that many readers will find offensive, disturbing, or morally objectionable. That is not a reason to exclude them. A catalogue of banned books that omits controversial titles is not a catalogue of banned books.
            </p>
            <p>
              We link to legal purchase options for every book (Bookshop.org, Kobo). We deliberately do not link to Amazon, which has itself been involved in book removal decisions. Where available, we also link to free Project Gutenberg texts and Internet Archive scans.
            </p>
            <p>
              Some outbound book links are affiliate links (Bookshop.org and Kobo). They help support independent bookstores and this project at no extra cost to you. We do not run tracking pixels, third-party scripts, or sponsored content alongside the catalogue, and the affiliate links never determine which books we include.
            </p>
            <p>
              Banned Books is editorially independent. It receives no funding from publishers, governments, political organisations, or advocacy groups. Inclusion and exclusion decisions are made solely on the basis of documented evidence. The site is the work of one person and a growing set of open-source tools.
            </p>
          </article>
        </SectionShell>

        {/* ── Why I built this (with portrait) ──────────────────────── */}
        <SectionShell tone="white" eyebrow="Personal">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col items-center sm:flex-row-reverse sm:items-start sm:justify-between sm:gap-6 mb-6">
              <Image
                src="/ludo.png"
                alt="Portrait of Ludo Raedts"
                width={120}
                height={120}
                className="w-[120px] h-[120px] shrink-0 rounded-full object-cover mb-4 sm:mb-0"
              />
              <h2 id="why-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 sm:mt-1 pb-3 border-b border-oxblood/30 w-full">
                Why I built this
              </h2>
            </div>
            <article className="prose prose-gray prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900">
              <p>
                I&apos;m Ludo Raedts. I started Banned Books in April 2026, and I should be honest about what I bring to it.
              </p>
              <p>
                In 2024 I visited the Bebelplatz Memorial in Berlin. It&apos;s a small underground room visible through a glass plate in the square — rows of empty white bookshelves, marking the spot where, on 10 May 1933, students of the Nazi German Student Union burned around 20,000 books they had branded &ldquo;un-German.&rdquo; Inscribed on a bronze plaque nearby is a line from Heinrich Heine: <em>&ldquo;Where they burn books, they will in the end also burn people.&rdquo;</em>{' '}Heine wrote it in 1820, in a play about the Spanish Inquisition&apos;s burning of the Quran. More than a century before the Nazis proved him right.
              </p>
              <p>
                What struck me at Bebelplatz was not that this had happened. It was how unsurprising it now felt. Across democracies and authoritarian states alike, restricting what people can read, watch, or say is again being treated as a reasonable response to disagreement. Facts are routinely reframed as opinions; opinions someone disagrees with are reframed as harms that must be silenced. Public debate has become less a conversation between equals and more a contest over who is allowed to speak.
              </p>
              <p>
                I&apos;m of a generation, and from a country, that took the opposite for granted. The Netherlands was the first country in the world to legalise same-sex marriage, on 1 April 2001 — not because everyone agreed it was right, but because a long, slow public conversation had moved the consensus. That conversation depended on people being free to read, write, and argue badly without being shut down. The freedom that lets a country change its mind is the same freedom that lets censorship be challenged when it happens. Both are weakening.
              </p>
              <p>
                Banned Books is my response to that — not an answer, but a record. A catalogue cannot stop a ban, but it can make it harder to deny one happened.
              </p>
              <p>
                The principle of the project is to document, not endorse: to include books I disagree with, bans I find justified, and bans I find indefensible, with the same citation standard for each. I do not get to decide which forms of censorship history will judge most harshly. Future readers can — but only if someone keeps a record.
              </p>
              <p className="text-right italic text-neutral-500 mt-2 !mb-0">
                — Ludo Raedts, Groningen
              </p>
            </article>
          </div>
        </SectionShell>

        {/* ── Press & researchers ───────────────────────────────────── */}
        <SectionShell tone="cream">
          <article className="max-w-3xl mx-auto prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:mt-0 prose-h2:mb-6 prose-h2:pb-3 prose-h2:border-b prose-h2:border-oxblood/30 prose-a:text-oxblood prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900">
            <h2>For press &amp; researchers</h2>
            <p>
              We welcome media inquiries, data requests, and collaboration proposals. If you are writing about book censorship, literary freedom, or library policy, we are happy to provide context, data, or a comment.
            </p>
            <p>
              The catalogue is a work in progress. Coverage is strongest for the United States, Western Europe, and prominent historical cases. We say so explicitly wherever it matters.
            </p>
            <p>
              For systematic analysis, the entire catalogue is available as a{' '}
              <Link href="/dataset">downloadable dataset</Link>{' '}— CSV, JSON, and SQLite — under a personal/research-use license.
            </p>
            <p>
              Boilerplate copy, live stats, logos, and story angles are collected on the{' '}
              <Link href="/press">press &amp; media kit page</Link>.
            </p>
          </article>
        </SectionShell>

        {/* ── Get in touch ──────────────────────────────────────────── */}
        <SectionShell tone="white" id="get-in-touch">
          <div className="max-w-3xl mx-auto">
            <Eyebrow>Contact</Eyebrow>
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2">
              Get in touch.
            </h2>
            <p className="text-sm text-neutral-600 mb-6">For press inquiries, data requests, corrections, or missing books.</p>
            <ContactForm />
          </div>
        </SectionShell>

      </main>
    </>
  )
}
