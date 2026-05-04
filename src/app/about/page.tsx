export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import ContactForm from '@/components/contact-form'

export const metadata: Metadata = {
  title: 'About — Banned Books',
  description: 'Banned Books is an independent open catalogue of books banned by governments and schools worldwide. Learn about our mission, methodology, and editorial principles.',
  alternates: { canonical: '/about' },
}

async function getStats() {
  const s = adminClient()
  const [books, bans, activeBans, sources] = await Promise.all([
    s.from('books').select('*', { count: 'exact', head: true }),
    s.from('bans').select('*', { count: 'exact', head: true }),
    s.from('bans').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    s.from('ban_sources').select('*', { count: 'exact', head: true }),
  ])
  const { data: countryRows } = await s
    .from('bans')
    .select('country_code')
    .neq('country_code', null)
  const countries = new Set((countryRows ?? []).map((r) => r.country_code)).size

  return {
    books: books.count ?? 0,
    bans: bans.count ?? 0,
    countries,
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-14">

        {/* Header */}
        <div className="bg-brand-light dark:bg-brand-dark/10 border-l-4 border-brand pl-6 pr-4 py-6 rounded-r-xl">
          <p className="text-xs font-medium uppercase tracking-widest text-brand/70 dark:text-brand/60 mb-3">About</p>
          <h1 className="text-3xl font-bold tracking-tight mb-2">About this project</h1>
          <p className="text-gray-700 dark:text-gray-300 max-w-2xl leading-relaxed text-sm">
            Banned Books is an independent, open catalogue of books banned, challenged, or removed by governments, schools,
            and libraries worldwide. We document the who, where, when, and why of literary censorship — from Cold War
            prohibitions to today&apos;s classroom removals.
          </p>
        </div>

        {/* 1. Mission */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Mission</h2>
          <div className="text-gray-700 dark:text-gray-300 leading-relaxed flex flex-col gap-4 text-sm">
            <p>
              Banned Books started in April 2026 as a personal project by Ludo Raedts, a Dutch entrepreneur based in
              Groningen, the Netherlands. Frustrated by the lack of a single, structured, international reference for
              book censorship data, he built one from scratch — using open data sources, public records, and
              AI-assisted tooling.
            </p>
            <p>
              The mission is simple: make censorship visible. A ban that is not recorded is a ban that can be denied.
              Every entry in this catalogue represents a documented act of suppression — a government, school board,
              or institution that decided a book was too dangerous for its citizens or students to read.
            </p>
            <p>
              The catalogue currently documents <strong>{stats.books.toLocaleString()} books</strong> and{' '}
              <strong>{stats.bans.toLocaleString()} bans</strong> across{' '}
              <strong>{stats.countries} countries and territories</strong>, from the Vatican&apos;s Index Librorum
              Prohibitorum (1559) to school board removals in 2025. The site is free, non-commercial, and built in
              the open.
            </p>
          </div>
        </section>

        {/* 2. Live stats */}
        <section>
          <h2 className="text-xl font-semibold mb-4">By the numbers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { value: stats.books.toLocaleString(), label: 'Books catalogued' },
              { value: stats.bans.toLocaleString(), label: 'Bans documented' },
              { value: stats.countries.toString(), label: 'Countries & territories' },
              { value: stats.activeBans.toLocaleString(), label: 'Currently active bans' },
              { value: stats.sources.toLocaleString(), label: 'Source citations' },
              { value: '1559', label: 'Earliest ban recorded' },
            ].map(({ value, label }) => (
              <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-5 flex flex-col gap-1">
                <span className="text-2xl font-bold tracking-tight">{value}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Methodology summary */}
        <section>
          <h2 className="text-xl font-semibold mb-4">What counts as a ban</h2>
          <div className="text-gray-700 dark:text-gray-300 leading-relaxed flex flex-col gap-4 text-sm">
            <p>
              We use &ldquo;ban&rdquo; as a broad umbrella for three related phenomena. A{' '}
              <strong>formal ban</strong> is a legal prohibition: a government law or court order that makes
              possessing or distributing a book a criminal act. A <strong>restriction</strong> is an
              institutional removal — a school district pulling a title from its library, a prison service
              blocking access, a public library system withdrawing a book under political pressure. A{' '}
              <strong>challenge</strong> is a documented formal complaint that resulted in removal or
              restriction, typically reported through PEN America or the American Library Association.
            </p>
            <p>
              We do not record unsuccessful challenges (complaints that were rejected), informal social
              pressure, or self-censorship by publishers. Every entry requires a verifiable source: a
              court judgment, a government decree, a news report, a PEN America data export, or an ALA
              challenged books report. Entries without sources are not published.
            </p>
            <p>
              Books are selected for inclusion when there is credible documented evidence of a ban,
              restriction, or challenge. We do not make editorial judgments about whether a ban was
              justified — we document what happened.
            </p>
            <p className="flex flex-wrap gap-x-5 gap-y-1">
              <Link href="/methodology" className="underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors font-medium">
                Read the full methodology →
              </Link>
              <Link href="/challenged-books" className="underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors font-medium">
                Browse challenged books →
              </Link>
            </p>
          </div>
        </section>

        {/* 4. Data transparency */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Data transparency</h2>
          <div className="text-gray-700 dark:text-gray-300 leading-relaxed flex flex-col gap-4 text-sm">
            <p>
              The database is updated continuously. This page was last rendered on <strong>{stats.updatedAt}</strong>.
              There are currently <strong>{stats.sources.toLocaleString()} source citations</strong> attached to bans
              in the catalogue, drawn primarily from PEN America, the American Library Association, Index on Censorship,
              Freedom to Read Canada, and Wikipedia&apos;s lists of banned books.
            </p>
            <p>
              <strong>Coverage gaps we acknowledge openly:</strong> The data is heavily skewed toward the United States,
              the United Kingdom, Canada, and Western Europe — countries with active civil society organisations that
              systematically track censorship. Bans in authoritarian states (China, Russia, Iran, North Korea, Saudi Arabia)
              are far more common but far less documented. We record what we can verify; we do not extrapolate. The{' '}
              United States appearing prominently in our data reflects systematic reporting, not uniquely American censorship.
            </p>
            <p>
              We do not have comprehensive coverage of non-English-language sources. A book banned in
              Uzbekistan in 2019 is unlikely to appear in our catalogue unless it generated coverage in an
              English-language source we index. This is a structural limitation we are working to address.
            </p>
          </div>
        </section>

        {/* 5. What makes it different */}
        <section>
          <h2 className="text-xl font-semibold mb-4">What makes it different</h2>
          <ul className="flex flex-col gap-4 text-sm">
            {[
              {
                icon: '🌍',
                title: 'Global scope',
                body: `${stats.countries} countries including defunct states like the Soviet Union, Czechoslovakia, and East Germany.`,
              },
              {
                icon: '📖',
                title: 'Per-book context',
                body: 'Each title has a "Why it was banned" section explaining who banned it, why, and what happened next.',
              },
              {
                icon: '🔍',
                title: 'Browsable by country, reason, and author',
                body: 'Not just a flat list — filter by geography, ideology, or the people behind the books.',
              },
              {
                icon: '📗',
                title: 'Free reading links',
                body: 'Where a book is in the public domain, we link to the free text on Project Gutenberg.',
              },
              {
                icon: '🔗',
                title: 'Source citations on every ban',
                body: 'PEN America, ALA, Index on Censorship, Freedom to Read Canada — every ban traces back to a source.',
              },
            ].map(({ icon, title, body }) => (
              <li key={title} className="flex gap-4 items-start">
                <span className="text-xl leading-none mt-0.5 shrink-0">{icon}</span>
                <div>
                  <span className="font-medium">{title}</span>
                  {' — '}
                  <span className="text-gray-600 dark:text-gray-400">{body}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 6. Editorial stance */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Editorial stance</h2>
          <div className="text-gray-700 dark:text-gray-300 leading-relaxed flex flex-col gap-4 text-sm">
            <p>
              This site documents censorship. It does not endorse it — and it does not endorse the books it catalogues either.
              Some of the titles in this database contain material that many readers will find offensive, disturbing, or morally
              objectionable. That is not a reason to exclude them. A catalogue of banned books that omits controversial titles
              is not a catalogue of banned books.
            </p>
            <p>
              We link to legal purchase options for every book (Bookshop.org, Kobo). We deliberately do not link to Amazon,
              which has itself been involved in book removal decisions. We link to free Project Gutenberg texts where available.
              We do not profit from these links — this is not an affiliate site.
            </p>
            <p>
              Banned Books is editorially independent. It receives no funding from publishers, governments, political
              organisations, or advocacy groups. Inclusion and exclusion decisions are made solely on the basis of
              documented evidence. The site is the work of one person and a growing set of open-source tools.
            </p>
          </div>
        </section>

        {/* 7. Press & researchers */}
        <section>
          <h2 className="text-xl font-semibold mb-4">For press &amp; researchers</h2>
          <div className="text-gray-700 dark:text-gray-300 leading-relaxed flex flex-col gap-4 text-sm">
            <p>
              We welcome media inquiries, data requests, and collaboration proposals. If you are writing about book
              censorship, literary freedom, or library policy, we are happy to provide context, data, or a comment.
            </p>
            <p>
              The catalogue is a work in progress. Coverage is strongest for the United States, Western Europe, and
              prominent historical cases. We say so explicitly wherever it matters.
            </p>
          </div>
        </section>

        {/* 8. Contact */}
        <section>
          <h2 className="text-xl font-semibold mb-1">Get in touch</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">For press inquiries, data requests, corrections, or missing books.</p>
          <ContactForm />
        </section>

      </main>
    </>
  )
}
