import type { Metadata } from 'next'
import { adminClient } from '@/lib/supabase'
import ContactForm from '@/components/contact-form'

export const metadata: Metadata = {
  title: 'About',
  description: 'About the Banned Books catalogue — an independent open database of books banned by governments, schools, and libraries worldwide.',
  alternates: { canonical: '/about' },
}

async function getStats() {
  const s = adminClient()
  const [books, bans, activeBans] = await Promise.all([
    s.from('books').select('*', { count: 'exact', head: true }),
    s.from('bans').select('*', { count: 'exact', head: true }),
    s.from('bans').select('*', { count: 'exact', head: true }).eq('status', 'active'),
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
  }
}

export default async function AboutPage() {
  const stats = await getStats()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'About Banned Books',
            description: 'About the Banned Books catalogue — an independent open database of books banned by governments, schools, and libraries worldwide.',
            url: 'https://www.banned-books.org/about',
          }),
        }}
      />

      {/* Hero */}
      <div className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-14">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">About Banned Books</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl">
            Banned Books is an independent, open catalogue of books banned, challenged, or removed by governments, schools, and libraries worldwide.
            We document the who, where, when, and why of literary censorship — from Cold War prohibitions to today&apos;s classroom removals.
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-14">

        {/* Section 1 — The project */}
        <section>
          <h2 className="text-xl font-semibold mb-4">The project</h2>
          <div className="text-gray-700 dark:text-gray-300 leading-relaxed flex flex-col gap-4">
            <p>
              Banned Books started in April 2026 as a personal project by Ludo Raedts, a Dutch entrepreneur based in Groningen, the Netherlands.
              Frustrated by the lack of a single, structured, international reference for book censorship data, he built one from scratch —
              using open data sources, public records, and AI-assisted tooling.
            </p>
            <p>
              The catalogue documents <strong>{stats.books.toLocaleString()} books</strong> and{' '}
              <strong>{stats.bans.toLocaleString()} bans</strong> across{' '}
              <strong>{stats.countries} countries and territories</strong>, from the Vatican&apos;s Index Librorum Prohibitorum (1559) to
              school board removals in Florida in 2025. Every ban includes a source citation. Every book has a page. The site is free,
              non-commercial, and built in the open.
            </p>
          </div>
        </section>

        {/* Section 2 — Live stats */}
        <section>
          <h2 className="text-xl font-semibold mb-4">By the numbers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { value: stats.books.toLocaleString(), label: 'Books catalogued' },
              { value: stats.bans.toLocaleString(), label: 'Bans documented' },
              { value: stats.countries.toString(), label: 'Countries & territories' },
              { value: stats.activeBans.toLocaleString(), label: 'Currently active bans' },
            ].map(({ value, label }) => (
              <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-5 flex flex-col gap-1">
                <span className="text-2xl font-bold tracking-tight">{value}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3 — What makes it different */}
        <section>
          <h2 className="text-xl font-semibold mb-4">What makes it different</h2>
          <ul className="flex flex-col gap-4">
            {[
              {
                icon: '🌍',
                title: 'Global scope',
                body: '80 countries including defunct states like the Soviet Union, Czechoslovakia, and East Germany.',
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
                body: 'PEN America, ALA, Wikipedia, Index on Censorship, Freedom to Read Canada — every ban traces back to a source.',
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

        {/* Section 4 — Press & researchers */}
        <section>
          <h2 className="text-xl font-semibold mb-4">For press &amp; researchers</h2>
          <div className="text-gray-700 dark:text-gray-300 leading-relaxed flex flex-col gap-4">
            <p>
              We welcome media inquiries, data requests, and collaboration proposals. If you are writing about book censorship,
              literary freedom, or library policy, we are happy to provide context, data exports, or a comment.
            </p>
            <p>
              The catalogue is a work in progress. Coverage is strongest for the United States, Western Europe, and prominent
              historical cases. Bans in closed authoritarian states are systematically underdocumented — we say so explicitly on the site.
            </p>
          </div>
        </section>

        {/* Section 5 — Contact */}
        <section>
          <h2 className="text-xl font-semibold mb-1">Get in touch</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">For press inquiries, data requests, or corrections.</p>
          <ContactForm />
        </section>

      </main>
    </>
  )
}
