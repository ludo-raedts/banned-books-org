import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { ZENODO_CONCEPT_DOI, ZENODO_DOI_URL, ZENODO_VERSIONS } from '@/lib/zenodo'
import DatasetCheckoutButton from '@/components/dataset-checkout-button'
import TrackedOutboundLink from '@/components/tracked-outbound-link'
import SectionShell from '@/components/section/SectionShell'
import Eyebrow from '@/components/section/Eyebrow'

const DATASET_PRICE_USD = 19.99

// ISR: dataset landing page reads totals (counts of books/authors/bans)
// for the marketing copy. Hourly regen catches enrichment-cycle growth
// without re-querying on every visit.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Banned Books Dataset — Free Open CSV (CC-BY) + Full Dataset',
  description:
    'Free, citeable CSV dataset of book bans worldwide — CC-BY-4.0 with a permanent DOI — plus a full commercial dataset (CSV, JSON, SQLite). Books, countries, years, reasons, and a source citation for every ban.',
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
  // Pre-1000 CE bans (e.g. Ovid's Ars Amatoria, 8 AD) render as "8" without
  // an era marker, which reads like a typo. Tag them "AD" in the prose; the
  // ISO 8601 temporalCoverage below stays 4-digit-padded for validators.
  const minYearLabel = minYear < 1000 ? `${minYear} AD` : String(minYear)
  const datasetKeywords = [
    'book censorship',
    'banned books',
    'library censorship',
    'intellectual freedom',
    'challenged books',
    'school book bans',
    'government censorship',
    'international censorship',
    'free expression',
  ]
  const temporalCoverage = `${String(minYear).padStart(4, '0')}/${String(maxYear).padStart(4, '0')}`

  // The paid, full dataset is a commercial PRODUCT (with an Offer) — deliberately
  // NOT a second Dataset. Two Dataset entities sharing this page's URL/DOI made
  // Google Dataset Search drop the record; the open CC-BY-4.0 Dataset below is
  // now this page's sole Dataset entity.
  const productSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Banned Books — Full Dataset',
    description: `The full Banned Books dataset: ${stats.books.toLocaleString('en')} books banned, challenged, or restricted across ${stats.countries} countries (${stats.bans.toLocaleString('en')} ban records, ${minYearLabel}–${maxYear}), adding editorial prose, enrichment (ISBN-13, cover images, author bios) and convenience formats (denormalised JSON + ready-to-query SQLite) on top of the open core. CSV, JSON, and SQLite.`,
    url: 'https://www.banned-books.org/dataset',
    image: 'https://www.banned-books.org/brand/compact-bb.png',
    brand: { '@type': 'Brand', name: 'Banned Books' },
    category: 'Dataset',
    keywords: datasetKeywords,
    offers: {
      '@type': 'Offer',
      price: DATASET_PRICE_USD.toFixed(2),
      priceCurrency: 'USD',
      url: 'https://www.banned-books.org/dataset',
      availability: 'https://schema.org/InStock',
    },
  }

  // Second Dataset entity: the OPEN, free, CC-BY-4.0 censorship core deposited on
  // Zenodo. Distinct from the commercial schema above — this one carries the
  // signals Google Dataset Search rewards (isAccessibleForFree, a real CC-BY
  // license URL, the concept DOI, and a Zenodo distribution). No Offer here: it
  // isn't sold. Only emitted once the concept DOI is live.
  const openDatasetSchema: Record<string, unknown> | null = ZENODO_DOI_URL
    ? {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: 'Banned Books — Open Censorship Core',
        description: `The open, verifiable censorship core of the Banned Books catalogue: structured facts about book bans, restrictions, and challenges across ${stats.countries} countries, with the reason taxonomy and source citations behind them. Released under CC-BY-4.0 as a citeable research dataset. Excludes the editorial prose, enrichment, and convenience formats of the commercial dataset.`,
        url: 'https://www.banned-books.org/dataset',
        identifier: ZENODO_DOI_URL,
        sameAs: ZENODO_DOI_URL,
        isAccessibleForFree: true,
        license: 'https://creativecommons.org/licenses/by/4.0/',
        creator: {
          '@type': 'Person',
          name: 'Ludo Raedts',
          url: 'https://www.banned-books.org/about',
          identifier: 'https://orcid.org/0009-0006-8358-7119',
          sameAs: 'https://orcid.org/0009-0006-8358-7119',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Banned Books',
          url: 'https://www.banned-books.org',
          logo: 'https://www.banned-books.org/brand/compact-bb.png',
        },
        keywords: datasetKeywords,
        temporalCoverage,
        spatialCoverage: { '@type': 'Place', name: 'Global (worldwide)' },
        variableMeasured: [
          'book title',
          'country of ban',
          'ban year (start, end)',
          'ban scope (school, government, prison)',
          'ban status (active, historical, rescinded)',
          'ban action type (banned, restricted, challenged)',
          'ban reason taxonomy',
          'source citation URL',
          'source verification status',
        ],
        distribution: {
          '@type': 'DataDownload',
          encodingFormat: 'text/csv',
          name: 'Open censorship core — CSV tables (Zenodo)',
          contentUrl: ZENODO_DOI_URL,
        },
        inLanguage: 'en',
      }
    : null
  if (openDatasetSchema && stats.dataLastChanged) openDatasetSchema.dateModified = stats.dataLastChanged

  const ldHtml = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

  const heroStats = [
    { value: stats.books.toLocaleString('en'), label: 'Books' },
    { value: stats.bans.toLocaleString('en'), label: 'Ban records' },
    { value: stats.countries.toString(), label: 'Countries' },
    { value: stats.sources.toLocaleString('en'), label: 'Sources' },
  ]

  // Citation form for the open deposit (descriptor §8). Built from the live
  // concept DOI in zenodo.ts — not hardcoded here.
  const zenodoCitation = ZENODO_CONCEPT_DOI
    ? `Raedts, Ludo. Banned Books — Open Censorship Core. Zenodo. CC-BY-4.0. DOI: ${ZENODO_CONCEPT_DOI}.`
    : null

  // The field split, stated once. Membership is the argument — no sell copy.
  const comparison: { label: string; open: boolean }[] = [
    { label: 'Structured facts — book, country, year, action type, status, scope', open: true },
    { label: 'Reason taxonomy (structured reason slugs)', open: true },
    { label: 'Source citations + verification status', open: true },
    { label: 'Aggregate-author flag (is_placeholder)', open: true },
    { label: 'Editorial prose — book & ban descriptions, censorship context', open: false },
    { label: 'Enrichment — ISBN-13, cover images, author bios & photos, edition data', open: false },
    { label: 'Convenience formats — denormalised JSON + ready-to-query SQLite', open: false },
  ]

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldHtml(productSchema) }}
      />
      {openDatasetSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldHtml(openDatasetSchema) }}
        />
      )}

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <Eyebrow>Dataset · open core + full dataset</Eyebrow>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
            The dataset, two ways.
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
            Every documented ban, with the sources behind it — in two forms for two jobs. The open core is for <strong className="font-semibold">citing and verifying</strong>; the full dataset is for <strong className="font-semibold">working with the data</strong>.
          </p>
        </div>
      </section>

      {/* ── Two versions, side by side ────────────────────────────── */}
      <SectionShell tone="cream" eyebrow="Two versions">
        <div className="max-w-3xl mx-auto">
          <div className="grid md:grid-cols-2 gap-5 items-stretch">

            {/* Open core — Zenodo, CC-BY-4.0, free */}
            <div className="flex flex-col border border-neutral-200 bg-white rounded-sm p-6">
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">Free CSV download · CC-BY-4.0</p>
              <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-gray-900">
                For citing &amp; verifying
              </h2>
              <p className="mt-3 text-sm text-neutral-700 leading-relaxed flex-1">
                A free, downloadable CSV dataset of the verifiable censorship core — the facts and the source citations behind them. Deposited on Zenodo as a citeable research dataset under CC-BY-4.0, with a permanent, version-independent DOI.
              </p>
              {ZENODO_DOI_URL ? (
                <>
                  <TrackedOutboundLink
                    eventName="Dataset Zenodo Viewed"
                    href={ZENODO_DOI_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex w-fit items-center border border-oxblood text-oxblood hover:bg-oxblood hover:text-cream font-serif font-semibold rounded-sm px-5 py-2.5 text-sm transition-colors"
                  >
                    View on Zenodo →
                  </TrackedOutboundLink>
                  {zenodoCitation && (
                    <div className="mt-4">
                      <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">Cite as</p>
                      <p className="text-xs text-neutral-600 leading-relaxed">{zenodoCitation}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-5 text-sm text-neutral-500">Open version coming soon.</p>
              )}
            </div>

            {/* Full dataset — commercial, Stripe (unchanged flow) */}
            <div className="flex flex-col border border-neutral-200 bg-white rounded-sm p-6">
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">Full dataset · ${DATASET_PRICE_USD.toFixed(2)}</p>
              <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-gray-900">
                For working with the data
              </h2>
              <p className="mt-3 text-sm text-neutral-700 leading-relaxed flex-1">
                The complete working dataset: every open field <em>plus</em> editorial prose, enrichment (ISBNs, covers, author bios), and ready-to-use formats — a denormalised JSON file and a SQLite database.
              </p>
              <form action="/api/dataset/checkout" method="POST" className="mt-5">
                <DatasetCheckoutButton
                  priceUsd={DATASET_PRICE_USD}
                  className="bg-oxblood hover:bg-brand-dark text-cream font-serif font-semibold rounded-sm px-5 py-2.5 text-sm transition-colors"
                >
                  Buy and download →
                </DatasetCheckoutButton>
              </form>
              <p className="mt-3 text-xs text-neutral-500 leading-relaxed">
                One-time payment via Stripe · instant download · taxes calculated at checkout. The dataset reflects the catalogue at the moment of purchase.
              </p>
            </div>

          </div>
          <p className="mt-6 text-center text-sm text-neutral-500">
            Do you find this useful?{' '}
            <Link href="/support" className="text-oxblood font-medium hover:underline">
              Support the project
            </Link>{' '}
            to help keep the data free and growing.
          </p>
        </div>
      </SectionShell>

      {/* ── What's in each ────────────────────────────────────────── */}
      <SectionShell tone="white" eyebrow="Comparison">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30">
            What&rsquo;s in each
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-oxblood/30 text-left">
                  <th className="py-2 pr-4 font-serif font-semibold text-gray-900">Included</th>
                  <th className="py-2 px-3 text-center text-[11px] uppercase tracking-wider text-neutral-600 whitespace-nowrap">Open core</th>
                  <th className="py-2 px-3 text-center text-[11px] uppercase tracking-wider text-neutral-600 whitespace-nowrap">Full dataset</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.label} className="border-b border-neutral-200 align-top">
                    <td className="py-2.5 pr-4 text-neutral-700 leading-relaxed">{row.label}</td>
                    <td className="py-2.5 px-3 text-center">
                      {row.open
                        ? <span className="text-oxblood font-semibold" aria-label="included">✓</span>
                        : <span className="text-neutral-300" aria-label="not included">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-oxblood font-semibold" aria-label="included">✓</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 text-xs text-neutral-500 leading-relaxed">
            The open core carries the facts you can verify and cite; the full dataset adds the editorial and convenience layers built on top of them.
          </p>
        </div>
      </SectionShell>

      {/* ── Licensing ─────────────────────────────────────────────── */}
      <SectionShell tone="cream" eyebrow="Usage rights">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30">
            Licensing
          </h2>
          <div className="flex flex-col gap-4 text-sm text-neutral-700 leading-relaxed">
            <p>
              <strong className="text-gray-900">Open core —</strong> released under{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="text-oxblood font-medium hover:underline">CC-BY-4.0</a>. Share and adapt it for any purpose, including commercially, with attribution{ZENODO_DOI_URL ? <> — cite the concept DOI (<a href={ZENODO_DOI_URL} target="_blank" rel="noopener noreferrer" className="text-oxblood font-medium hover:underline">{ZENODO_DOI_URL}</a>)</> : null}.
            </p>
            <p>
              <strong className="text-gray-900">Full dataset —</strong> a one-time purchase grants a perpetual personal-use license: cite, analyse, and use the data in your own research, articles, and tools. Redistributing the dataset itself, or using it in a commercial product that resells the data, requires a separate license — get in touch via the{' '}
              <Link href="/about#get-in-touch" className="text-oxblood font-medium hover:underline">About page</Link>.
            </p>
          </div>
        </div>
      </SectionShell>

      {/* ── Versions & changelog ──────────────────────────────────── */}
      {ZENODO_CONCEPT_DOI && (
        <SectionShell tone="white" eyebrow="Versions">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-4 pb-3 border-b border-oxblood/30">
              Dataset versions
            </h2>
            <p className="text-sm text-neutral-700 leading-relaxed mb-6">
              The open dataset is versioned on Zenodo. The concept DOI{' '}
              {ZENODO_DOI_URL && (
                <a href={ZENODO_DOI_URL} target="_blank" rel="noopener noreferrer" className="text-oxblood font-medium hover:underline">
                  ({ZENODO_CONCEPT_DOI})
                </a>
              )}{' '}
              always resolves to the latest release; each release below also has its own
              version DOI that pins that exact snapshot for reproducible citation. Figures
              grow as the catalogue does — the deposited files are the authority.
            </p>
            <ol className="flex flex-col gap-5">
              {ZENODO_VERSIONS.map((v) => (
                <li key={v.version} className="border-l-2 border-oxblood/30 pl-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-serif text-lg font-semibold text-gray-900">v{v.version}</span>
                    <time dateTime={v.date} className="text-sm text-neutral-500">
                      {new Date(v.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </time>
                    <a
                      href={`https://doi.org/${v.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-oxblood font-medium hover:underline"
                    >
                      DOI: {v.doi}
                    </a>
                  </div>
                  <p className="mt-1.5 text-sm text-neutral-700 leading-relaxed">{v.summary}</p>
                </li>
              ))}
            </ol>
          </div>
        </SectionShell>
      )}
    </main>
  )
}
