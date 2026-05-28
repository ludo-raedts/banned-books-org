import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import DatasetCheckoutButton from '@/components/dataset-checkout-button'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

const DATASET_PRICE_USD = 19.99

// ISR: dataset landing page reads totals (counts of books/authors/bans)
// for the marketing copy. Hourly regen catches enrichment-cycle growth
// without re-querying on every visit.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Download the Banned Books dataset',
  description:
    'Download the complete Banned Books dataset — every banned, challenged, and restricted book in our catalogue, with sources, countries, and reasons. CSV, JSON, and SQLite formats.',
  alternates: { canonical: '/dataset' },
}

async function getStats() {
  const s = adminClient()
  const [books, bans, sources, countriesRes, yearMinRes, yearMaxRes, refreshLogRes] = await Promise.all([
    s.from('books').select('*', { count: 'exact', head: true }),
    s.from('bans').select('*', { count: 'exact', head: true }),
    s.from('ban_sources').select('*', { count: 'exact', head: true }),
    s.from('mv_ban_counts').select('*', { count: 'exact', head: true }),
    s.from('bans').select('year_started').not('year_started', 'is', null).order('year_started', { ascending: true }).limit(1).maybeSingle(),
    s.from('bans').select('year_started').not('year_started', 'is', null).order('year_started', { ascending: false }).limit(1).maybeSingle(),
    s.from('mv_refresh_log').select('updated_at').eq('key', 'data_last_changed').maybeSingle(),
  ])
  return {
    books: books.count ?? 0,
    bans: bans.count ?? 0,
    sources: sources.count ?? 0,
    countries: countriesRes.count ?? 0,
    minYear: yearMinRes.data?.year_started ?? null,
    maxYear: yearMaxRes.data?.year_started ?? null,
    dataLastChanged: (refreshLogRes.data?.updated_at as string | undefined) ?? null,
  }
}

export default async function DatasetPage() {
  const stats = await getStats()

  const minYear = stats.minYear ?? 1900
  const maxYear = stats.maxYear ?? new Date().getUTCFullYear()
  const datasetSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Banned Books: International Censorship Database',
    alternateName: 'banned-books.org dataset',
    description: `A structured, citation-backed dataset of ${stats.books.toLocaleString('en')} books banned, challenged, or restricted across ${stats.countries} countries (${stats.bans.toLocaleString('en')} total ban records, ${minYear}–${maxYear}). Every ban record carries a verifiable source citation. Includes books, authors, bans (with year, scope, status, reasons), source citations, and country dimensions. CSV, JSON, and SQLite formats. International scope; includes defunct states (USSR, East Germany, Czechoslovakia, Yugoslavia).`,
    url: 'https://www.banned-books.org/dataset',
    sameAs: 'https://www.banned-books.org',
    keywords: [
      'book censorship',
      'banned books',
      'library censorship',
      'intellectual freedom',
      'challenged books',
      'school book bans',
      'government censorship',
      'international censorship',
      'free expression',
    ],
    creator: {
      '@type': 'Person',
      name: 'Ludo Raedts',
      url: 'https://www.banned-books.org/about',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Banned Books',
      url: 'https://www.banned-books.org',
      logo: 'https://www.banned-books.org/brand/compact-bb.png',
    },
    license: 'https://www.banned-books.org/dataset',
    isAccessibleForFree: false,
    offers: {
      '@type': 'Offer',
      price: DATASET_PRICE_USD.toFixed(2),
      priceCurrency: 'USD',
      url: 'https://www.banned-books.org/dataset',
      availability: 'https://schema.org/InStock',
    },
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'text/csv', name: 'CSV files (books, bans, sources, countries, authors, reasons)' },
      { '@type': 'DataDownload', encodingFormat: 'application/json', name: 'Single-file JSON dataset' },
      { '@type': 'DataDownload', encodingFormat: 'application/vnd.sqlite3', name: 'SQLite database' },
    ],
    temporalCoverage: `${String(minYear).padStart(4, '0')}/${String(maxYear).padStart(4, '0')}`,
    spatialCoverage: { '@type': 'Place', name: 'Global (worldwide)' },
    variableMeasured: [
      'book title',
      'author name',
      'first published year',
      'ISBN',
      'country of ban',
      'ban year (start, end)',
      'ban scope (school, government, prison)',
      'ban status (active, historical)',
      'ban action type (banned, restricted, challenged)',
      'ban reason taxonomy',
      'source citation URL',
    ],
    datePublished: '2026-04-24',
    inLanguage: 'en',
    // TODO(zenodo): add "citation" with DOI once Zenodo upload is live
  }
  if (stats.dataLastChanged) datasetSchema.dateModified = stats.dataLastChanged

  const ldHtml = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

  const heroStats = [
    { value: stats.books.toLocaleString('en'), label: 'Books' },
    { value: stats.bans.toLocaleString('en'), label: 'Ban records' },
    { value: stats.countries.toString(), label: 'Countries' },
    { value: stats.sources.toLocaleString('en'), label: 'Sources' },
  ]

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldHtml(datasetSchema) }}
      />

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <Eyebrow>Dataset · CSV · JSON · SQLite</Eyebrow>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            Download the full dataset.
          </h1>

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
            The complete Banned Books catalogue as a structured dataset. Every book, every ban, every source citation — in formats you can analyse, cite, and build on.
          </p>
        </div>
      </section>

      {/* ── What's in the file ────────────────────────────────────── */}
      <SectionShell tone="cream" eyebrow="File contents">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30">
            What&rsquo;s in the file
          </h2>
          <ul className="text-sm text-neutral-700 leading-relaxed flex flex-col gap-2">
            <li><strong className="text-gray-900">books.csv</strong> — title, author, ISBN, year, genres, description</li>
            <li><strong className="text-gray-900">bans.csv</strong> — country, year, status, scope, action type, reasons</li>
            <li><strong className="text-gray-900">sources.csv</strong> — citation URLs and source names for every ban</li>
            <li><strong className="text-gray-900">countries.csv</strong>, <strong className="text-gray-900">authors.csv</strong>, <strong className="text-gray-900">reasons.csv</strong> — lookup tables</li>
            <li><strong className="text-gray-900">dataset.json</strong> — single-file nested format for programmatic use</li>
            <li><strong className="text-gray-900">dataset.sqlite</strong> — single-file SQLite database with all relations preserved</li>
          </ul>
        </div>
      </SectionShell>

      {/* ── Use cases ─────────────────────────────────────────────── */}
      <SectionShell tone="white" eyebrow="Who buys this">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30">
            Use cases
          </h2>
          <ul className="text-sm text-neutral-700 leading-relaxed flex flex-col gap-3">
            <li>📊 <strong className="text-gray-900">Research and journalism</strong> — quantify trends in censorship, identify under-reported regions, write data-driven stories.</li>
            <li>🎓 <strong className="text-gray-900">Academic work</strong> — cite stable, dated snapshots in papers on intellectual freedom, library science, or media studies.</li>
            <li>🛠️ <strong className="text-gray-900">Building tools</strong> — power dashboards, comparison sites, classroom resources, or reading-list generators.</li>
            <li>📚 <strong className="text-gray-900">Library and archive collections</strong> — cross-reference your holdings against a documented record of bans.</li>
          </ul>
        </div>
      </SectionShell>

      {/* ── License ───────────────────────────────────────────────── */}
      <SectionShell tone="cream" eyebrow="Terms of use">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30">
            License
          </h2>
          <p className="text-sm text-neutral-700 leading-relaxed">
            One-time purchase grants you a perpetual personal-use license: cite, analyse, and use the data in your own research, articles, and tools. Redistribution of the dataset itself, or use in a commercial product that resells the data, requires a separate license — get in touch via the{' '}
            <Link href="/about#get-in-touch" className="text-oxblood font-medium hover:underline">About page</Link>.
          </p>
        </div>
      </SectionShell>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <SectionShell tone="white" eyebrow="Buy now">
        <div className="max-w-3xl mx-auto">
          <div className="border border-neutral-200 bg-white rounded-sm p-6 sm:p-8 flex flex-col gap-5 items-start">
            <div>
              <p className="font-serif text-4xl md:text-5xl font-semibold tracking-tight text-oxblood">
                ${DATASET_PRICE_USD.toFixed(2)}
              </p>
              <p className="text-xs text-neutral-500 mt-1">One-time payment · instant download · taxes calculated at checkout</p>
            </div>
            <form action="/api/dataset/checkout" method="POST">
              <DatasetCheckoutButton
                priceUsd={DATASET_PRICE_USD}
                className="bg-oxblood hover:bg-brand-dark text-cream font-serif font-semibold rounded-sm px-6 py-3 text-base transition-colors"
              >
                Buy and download →
              </DatasetCheckoutButton>
            </form>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Payment is handled by Stripe. After checkout you&rsquo;ll receive a download link by email and on the confirmation page. The dataset reflects the catalogue at the moment of purchase.
            </p>
          </div>
        </div>
      </SectionShell>
    </main>
  )
}
