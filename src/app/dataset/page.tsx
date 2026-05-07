import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Download the Banned Books dataset',
  description:
    'Download the complete Banned Books dataset — every banned, challenged, and restricted book in our catalogue, with sources, countries, and reasons. CSV, JSON, and SQLite formats.',
  alternates: { canonical: '/dataset' },
}

async function getStats() {
  const s = adminClient()
  const [books, bans, sources] = await Promise.all([
    s.from('books').select('*', { count: 'exact', head: true }),
    s.from('bans').select('*', { count: 'exact', head: true }),
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
    sources: sources.count ?? 0,
    countries,
  }
}

export default async function DatasetPage() {
  const stats = await getStats()

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-12">

      <div className="bg-brand-light dark:bg-brand-dark/10 border-l-4 border-brand pl-6 pr-4 py-6 rounded-r-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-brand/70 dark:text-brand/60 mb-3">Dataset</p>
        <h1 className="text-3xl font-bold tracking-tight mb-3">Download the full dataset</h1>
        <p className="text-gray-700 dark:text-gray-300 max-w-2xl leading-relaxed text-sm">
          The complete Banned Books catalogue as a structured dataset. Every book, every ban,
          every source citation — in formats you can analyse, cite, and build on.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">What&rsquo;s in the file</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { value: stats.books.toLocaleString('en'), label: 'Books' },
            { value: stats.bans.toLocaleString('en'), label: 'Bans' },
            { value: stats.countries.toString(), label: 'Countries' },
            { value: stats.sources.toLocaleString('en'), label: 'Sources' },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-4 flex flex-col gap-1"
            >
              <span className="text-2xl font-bold tracking-tight">{value}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
            </div>
          ))}
        </div>
        <ul className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed flex flex-col gap-2">
          <li><strong>books.csv</strong> — title, author, ISBN, year, genres, description</li>
          <li><strong>bans.csv</strong> — country, year, status, scope, action type, reasons</li>
          <li><strong>sources.csv</strong> — citation URLs and source names for every ban</li>
          <li><strong>countries.csv</strong>, <strong>authors.csv</strong>, <strong>reasons.csv</strong> — lookup tables</li>
          <li><strong>dataset.json</strong> — single-file nested format for programmatic use</li>
          <li><strong>dataset.sqlite</strong> — single-file SQLite database with all relations preserved</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Use cases</h2>
        <ul className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed flex flex-col gap-3">
          <li>📊 <strong>Research and journalism</strong> — quantify trends in censorship, identify under-reported regions, write data-driven stories.</li>
          <li>🎓 <strong>Academic work</strong> — cite stable, dated snapshots in papers on intellectual freedom, library science, or media studies.</li>
          <li>🛠️ <strong>Building tools</strong> — power dashboards, comparison sites, classroom resources, or reading-list generators.</li>
          <li>📚 <strong>Library and archive collections</strong> — cross-reference your holdings against a documented record of bans.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">License</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          One-time purchase grants you a perpetual personal-use license: cite, analyse, and use the data
          in your own research, articles, and tools. Redistribution of the dataset itself, or use in a
          commercial product that resells the data, requires a separate license — get in touch via the{' '}
          <Link href="/about#get-in-touch" className="underline hover:text-gray-900 dark:hover:text-gray-100">
            About page
          </Link>.
        </p>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-6 sm:p-8 flex flex-col gap-5 items-start">
        <div>
          <p className="text-3xl font-bold tracking-tight">$19.99</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">One-time payment · instant download · taxes calculated at checkout</p>
        </div>
        <form action="/api/dataset/checkout" method="POST">
          <button
            type="submit"
            className="bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg px-6 py-3 text-sm transition-colors"
          >
            Buy and download →
          </button>
        </form>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          Payment is handled by Stripe. After checkout you&rsquo;ll receive a download link by email
          and on the confirmation page. The dataset reflects the catalogue at the moment of purchase.
        </p>
      </section>

    </main>
  )
}
