// ISR: press page mostly editorial; only stats vary with the catalogue.
// Hourly regen mirrors /about and /dataset.
export const revalidate = 3600

import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { adminClient } from '@/lib/supabase'
import CopyButton from '@/components/copy-button'
import SectionShell from '@/components/section/SectionShell'

export const metadata: Metadata = {
  title: 'Press & Media Kit | Banned Books',
  description:
    'Media kit for Banned Books: boilerplate, stats, logos, story angles, and press contact for journalists and researchers covering book censorship.',
  alternates: { canonical: 'https://www.banned-books.org/press' },
  openGraph: {
    title: 'Press & Media Kit — Banned Books',
    description: 'Boilerplate, stats, logos, and story angles for journalists.',
    url: 'https://www.banned-books.org/press',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

type Stats = {
  books: number
  bans: number
  countries: number
  minYear: number | null
  maxYear: number | null
  dataLastChanged: string | null
}

async function getStats(): Promise<Stats> {
  const s = adminClient()
  const [booksRes, bansRes, countryRowsRes, yearMinRes, yearMaxRes, refreshLogRes] = await Promise.all([
    s.from('books').select('*', { count: 'exact', head: true }),
    s.from('bans').select('*', { count: 'exact', head: true }),
    s.from('bans').select('country_code').neq('country_code', null),
    s
      .from('bans')
      .select('year_started')
      .not('year_started', 'is', null)
      .order('year_started', { ascending: true })
      .limit(1)
      .maybeSingle(),
    s
      .from('bans')
      .select('year_started')
      .not('year_started', 'is', null)
      .order('year_started', { ascending: false })
      .limit(1)
      .maybeSingle(),
    s.from('mv_refresh_log').select('updated_at').eq('key', 'data_last_changed').maybeSingle(),
  ])
  const countries = new Set((countryRowsRes.data ?? []).map((r) => r.country_code)).size
  return {
    books: booksRes.count ?? 0,
    bans: bansRes.count ?? 0,
    countries,
    minYear: yearMinRes.data?.year_started ?? null,
    maxYear: yearMaxRes.data?.year_started ?? null,
    dataLastChanged: (refreshLogRes.data?.updated_at as string | undefined) ?? null,
  }
}

// Logo inventory from public/brand/ (pre-flight). Update if files change.
// TODO: no light-bg-monochrome variant exists yet — add when commissioned.
const LOGO_ASSETS: { file: string; label: string; format: string; description: string }[] = [
  { file: 'main-light.svg', label: 'Primary logo (light backgrounds)', format: 'SVG', description: 'Full mark for use on white or cream surfaces.' },
  { file: 'main-dark.svg', label: 'Primary logo (dark backgrounds)', format: 'SVG', description: 'Full mark for use on dark surfaces.' },
  { file: 'wordmark.svg', label: 'Wordmark (colour)', format: 'SVG', description: '"Banned Books" wordmark in brand oxblood.' },
  { file: 'wordmark-mono-black.svg', label: 'Wordmark (monochrome black)', format: 'SVG', description: 'For single-colour print or grayscale layouts.' },
  { file: 'wordmark-mono-white.svg', label: 'Wordmark (monochrome white)', format: 'SVG', description: 'Reversed wordmark for dark backgrounds.' },
  { file: 'compact-bb.svg', label: 'Compact mark "BB"', format: 'SVG', description: 'Square mark for avatars, favicons, and tight layouts.' },
  { file: 'compact-bb.png', label: 'Compact mark "BB" (raster)', format: 'PNG', description: 'PNG fallback of the square compact mark.' },
  { file: 'single-b.svg', label: 'Monogram "B"', format: 'SVG', description: 'Single-letter monogram for very small surfaces.' },
  { file: 'single-b.png', label: 'Monogram "B" (raster)', format: 'PNG', description: 'PNG fallback of the single-letter monogram.' },
]

const BRAND_COLORS = [
  { name: 'Oxblood', hex: '#5C1010' },
  { name: 'Cream', hex: '#F5E8E8' },
]

const STORY_ANGLES = [
  {
    title: 'The defunct-state censorship archive',
    body: 'What the USSR, East Germany, Czechoslovakia, and Yugoslavia banned — and how their successor states have inherited (or abandoned) those prohibitions.',
    href: '/countries',
    linkLabel: 'Countries index',
  },
  {
    title: 'Why the United States dominates banned-books data — and why that’s misleading',
    body: 'The US accounts for most records in international ban catalogues. The reason is documentation infrastructure, not exceptional repression.',
    href: '/methodology',
    linkLabel: 'Methodology',
  },
  {
    title: 'The reason taxonomy of censorship',
    body: 'LGBTQ+, political, religious, sexual, racial: which categories of objection drive bans where, and which are growing.',
    href: '/reasons',
    linkLabel: 'Reasons',
  },
  {
    title: 'Banned classics still restricted somewhere',
    body: 'Titles banned 50+ years ago that remain prohibited or restricted in at least one jurisdiction today.',
    href: '/banned-classics',
    linkLabel: 'Banned classics',
  },
  {
    title: 'A year in censorship: 2026',
    body: 'A running record of every documented ban, challenge, and restriction so far this year, with comparative context against prior years.',
    href: '/banned-books/2026',
    linkLabel: '2026 in bans',
  },
  {
    title: 'What governments ban that schools don’t (and vice versa)',
    body: 'School-board removals and national prohibitions overlap less than headlines suggest. The two scopes target different books for different reasons.',
    href: '/scope/government',
    linkLabel: 'Government vs. school bans',
  },
  {
    title: 'The "forbidden knowledge" iceberg meme is wrong',
    body: 'The viral image presenting layered tiers of censored knowledge fails on basic factual grounds — and the catalogue documents why.',
    href: '/essays/forbidden-knowledge-iceberg',
    linkLabel: 'Read the essay',
  },
]

function formatLastUpdated(iso: string | null): string {
  if (!iso) return 'recently'
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return 'recently'
  }
}

export default async function PressPage() {
  const stats = await getStats()
  const bookCount = stats.books.toLocaleString('en')
  const banCount = stats.bans.toLocaleString('en')
  const countryCount = stats.countries.toString()
  const minYear = stats.minYear ?? 1559
  const maxYear = stats.maxYear ?? new Date().getUTCFullYear()
  const lastUpdated = formatLastUpdated(stats.dataLastChanged)

  const boilerplate50 =
    `Banned Books (banned-books.org) is an independent, citation-backed database of ${bookCount} books banned, challenged, or restricted across ${countryCount} countries. The catalogue documents censorship by governments, schools, and libraries — historical and contemporary, worldwide — with verifiable sources on every record.`

  const boilerplate100 =
    `Banned Books (banned-books.org) is an independent, citation-backed catalogue of book censorship covering ${bookCount} titles and ${banCount} ban records across ${countryCount} countries and territories, from ${minYear} to ${maxYear}. ` +
    `Built by Ludo Raedts in Groningen, the Netherlands, the project documents prohibitions, removals, and challenges by governments, schools, and libraries. ` +
    `Every record cites a verifiable source. The site is free to read; a structured dataset is available for researchers. ` +
    `The catalogue documents censorship — it does not endorse the bans or the books — and accepts no funding from publishers, governments, or advocacy organisations.`

  const boilerplate250 =
    `Banned Books (banned-books.org) is an independent, citation-backed catalogue of book censorship, documenting ${bookCount} titles and ${banCount} ban records across ${countryCount} countries and territories. ` +
    `The catalogue spans ${minYear} to ${maxYear}, from the Vatican’s Index Librorum Prohibitorum to twenty-first-century school-board removals. It includes defunct states — the Soviet Union, East Germany, Czechoslovakia, Yugoslavia — to preserve censorship history that successor regimes have an incentive to forget. ` +
    `Each record distinguishes formal government bans, institutional restrictions (libraries, schools, prisons), and documented challenges that resulted in removal. Every entry carries a verifiable source: a court judgment, a government decree, a news report, a PEN America export, or an American Library Association challenged-books report. Unsuccessful challenges and informal social pressure are not recorded. ` +
    `The project was started in April 2026 by Ludo Raedts, a Dutch entrepreneur based in Groningen, the Netherlands, working with open data and AI-assisted tooling. ` +
    `Banned Books documents censorship without endorsing either the bans or the books that have been banned. The catalogue deliberately includes morally objectionable titles with extended context rather than excluding them; a catalogue of banned books that omits controversial books is not a catalogue of banned books. ` +
    `The site is free and non-commercial. A structured dataset (CSV, JSON, SQLite) is available for journalists and researchers. Outbound book links point to Bookshop.org and, where available, Project Gutenberg or the Internet Archive; the project does not link to Amazon. Banned Books receives no funding from publishers, governments, or advocacy organisations.`

  const quotableClaims = [
    `Banned Books is the first international database of book censorship covering governments, schools, and libraries across ${countryCount} countries with ${banCount} citation-backed records.`,
    'The Banned Books catalogue includes defunct states — the Soviet Union, East Germany, Czechoslovakia, Yugoslavia — to document censorship that history has hidden.',
    'Banned Books documents censorship; it does not endorse the books or the bans. The catalogue includes morally objectionable titles with extended context rather than excluding them.',
    'The United States dominates the Banned Books data because the United States counts. Countries that ban more — Iran, China, Russia, North Korea — document less.',
    'Every ban record on banned-books.org links to a verifiable source citation.',
    'Banned Books is independent. It accepts no funding from publishers, governments, or advocacy organisations.',
    `The Banned Books catalogue spans ${minYear} to ${maxYear}, from the Vatican’s Index Librorum Prohibitorum to twenty-first-century school-board removals.`,
    'Banned Books deliberately does not link to Amazon. Outbound book links point to Bookshop.org, Project Gutenberg, and the Internet Archive.',
  ]

  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Banned Books',
    url: 'https://www.banned-books.org',
    logo: 'https://www.banned-books.org/brand/main-light.svg',
    founder: { '@type': 'Person', name: 'Ludo Raedts' },
    foundingDate: '2026-04',
    foundingLocation: 'Groningen, Netherlands',
    description: 'Independent international database of book censorship.',
    sameAs: ['https://www.banned-books.org'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Press',
      email: 'info@banned-books.org',
      availableLanguage: ['en'],
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />

      <main>
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
          <div className="max-w-3xl mx-auto">
            <p className="text-sm uppercase tracking-[0.12em] font-semibold text-oxblood mb-3.5">
              Media kit · For journalists &amp; researchers
            </p>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
              Press &amp; Media Kit.
            </h1>
            <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900 max-w-2xl">
              Everything journalists and researchers need to write about Banned Books: live stats, boilerplate copy in three lengths, founder details, downloadable logos, story angles, and a press contact.
            </p>
            <p className="mt-3 text-xs text-neutral-500">
              Data last updated <strong className="font-medium text-neutral-700">{lastUpdated}</strong>.
            </p>
          </div>
        </section>

        {/* ── By the numbers ─────────────────────────────────────────── */}
        <SectionShell tone="cream" eyebrow="Live data">
          <div className="max-w-3xl mx-auto">
            <h2 id="stats-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30">
              By the numbers
            </h2>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              {[
                { value: bookCount, label: 'Books documented' },
                { value: banCount, label: 'Ban records' },
                { value: countryCount, label: 'Countries covered' },
                { value: `${minYear}–${maxYear}`, label: 'Date range' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <div className="font-serif text-3xl md:text-4xl font-semibold tracking-tight text-oxblood tabular-nums">
                    {value}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-600">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionShell>

        {/* ── Boilerplate ────────────────────────────────────────────── */}
        <SectionShell tone="white" eyebrow="Ready to paste">
          <div className="max-w-3xl mx-auto">
            <h2 id="boilerplate-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2 pb-3 border-b border-oxblood/30">
              Boilerplate
            </h2>
            <p className="text-sm text-neutral-600 mb-6">
              Three lengths, ready to paste. All stats are live as of the timestamp above.
            </p>
            <div className="flex flex-col gap-6">
              {[
                { len: '50 words', text: boilerplate50 },
                { len: '100 words', text: boilerplate100 },
                { len: '250 words', text: boilerplate250 },
              ].map(({ len, text }) => (
                <div key={len} className="border border-neutral-200 bg-white rounded-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-oxblood">
                      {len}
                    </span>
                    <CopyButton text={text} label={`${len} boilerplate`} />
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-800 whitespace-pre-wrap">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </SectionShell>

        {/* ── Founder ────────────────────────────────────────────────── */}
        <SectionShell tone="cream" eyebrow="The person behind the project">
          <div className="max-w-3xl mx-auto">
            <h2 id="founder-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30">
              Founder
            </h2>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <Image
                src="/ludo.png"
                alt="Portrait of Ludo Raedts"
                width={200}
                height={200}
                priority
                className="w-[200px] h-[200px] shrink-0 rounded-sm object-cover"
              />
              <div className="flex flex-col gap-3">
                <div>
                  <p className="font-serif text-lg font-semibold leading-tight text-gray-900">Ludo Raedts</p>
                  <p className="text-sm text-neutral-500">Founder · Groningen, Netherlands</p>
                </div>
                <p className="text-sm text-neutral-700 leading-relaxed">
                  Ludo Raedts is a Dutch entrepreneur based in Groningen. He started Banned Books in April 2026 as a solo project, after finding no single structured international reference for book-censorship data. He built one from scratch using open sources, public records, and AI-assisted tooling. The catalogue documents what governments, schools, and libraries have banned — without endorsing the bans or the books — and treats coverage gaps as facts to disclose, not problems to hide.
                </p>
                <p className="text-sm text-neutral-700 leading-relaxed">
                  For Ludo&apos;s personal motivation behind the project, see{' '}
                  <Link href="/about" className="text-oxblood font-medium hover:underline">
                    About →
                  </Link>.
                </p>
              </div>
            </div>
          </div>
        </SectionShell>

        {/* ── Quotable claims ───────────────────────────────────────── */}
        <SectionShell tone="white" eyebrow="For citation">
          <div className="max-w-3xl mx-auto">
            <h2 id="claims-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2 pb-3 border-b border-oxblood/30">
              Quotable claims
            </h2>
            <p className="text-sm text-neutral-600 mb-6">
              Self-contained sentences suitable for direct citation or AI Overview surfaces.
            </p>
            <ul className="flex flex-col gap-3">
              {quotableClaims.map((claim) => (
                <li
                  key={claim}
                  className="font-serif text-base leading-relaxed text-gray-900 border-l-2 border-oxblood/60 pl-4"
                >
                  {claim}
                </li>
              ))}
            </ul>
          </div>
        </SectionShell>

        {/* ── Story angles ─────────────────────────────────────────── */}
        <SectionShell tone="cream" eyebrow="Pitch-ready ideas">
          <div className="max-w-3xl mx-auto">
            <h2 id="angles-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2 pb-3 border-b border-oxblood/30">
              Story angles
            </h2>
            <p className="text-sm text-neutral-600 mb-6">
              Pitch-ready ideas with the catalogue page that supplies the underlying data.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {STORY_ANGLES.map(({ title, body, href, linkLabel }) => (
                <div key={title} className="border border-neutral-200 bg-white rounded-sm p-5 flex flex-col gap-2">
                  <h3 className="font-serif text-base font-semibold leading-snug text-gray-900">{title}</h3>
                  <p className="text-xs text-neutral-600 leading-relaxed flex-1">{body}</p>
                  <Link href={href} className="text-xs font-medium text-oxblood hover:underline self-start mt-1">
                    {linkLabel} →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </SectionShell>

        {/* ── Logo & brand assets ──────────────────────────────────── */}
        <SectionShell tone="white" eyebrow="Brand assets">
          <div className="max-w-3xl mx-auto">
            <h2 id="logo-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2 pb-3 border-b border-oxblood/30">
              Logo &amp; brand assets
            </h2>
            <p className="text-sm text-neutral-600 mb-6">
              Use the wordmark or compact mark when crediting Banned Books. Right-click any preview or use the download link to save the file. Please don&rsquo;t recolour or distort the marks.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {LOGO_ASSETS.map(({ file, label, format, description }) => {
                const isDark = file.includes('main-dark') || file.includes('mono-white')
                return (
                  <div key={file} className="border border-neutral-200 bg-white rounded-sm p-3 flex flex-col gap-2">
                    <div
                      className={`h-24 rounded-sm flex items-center justify-center overflow-hidden ${
                        isDark ? 'bg-neutral-900' : 'bg-neutral-50'
                      }`}
                    >
                      <Image
                        src={`/brand/${file}`}
                        alt={label}
                        width={120}
                        height={80}
                        className="max-h-20 w-auto object-contain"
                        unoptimized={file.endsWith('.svg')}
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-xs font-semibold leading-tight text-gray-900">{label}</p>
                      <p className="text-[11px] text-neutral-500 leading-snug">{description}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] uppercase tracking-widest text-neutral-400">{format}</span>
                        <a
                          href={`/brand/${file}`}
                          download
                          className="text-[11px] font-medium text-oxblood hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-8">
              <h3 className="font-serif text-base font-semibold mb-3 text-gray-900">Brand colours</h3>
              <div className="flex flex-wrap gap-4">
                {BRAND_COLORS.map(({ name, hex }) => (
                  <div
                    key={hex}
                    className="flex items-center gap-3 border border-neutral-200 bg-white rounded-sm px-3 py-2"
                  >
                    <span
                      className="inline-block w-8 h-8 rounded-sm border border-neutral-200"
                      style={{ backgroundColor: hex }}
                      aria-hidden
                    />
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm font-medium text-gray-900">{name}</span>
                      <code className="text-[11px] text-neutral-500">{hex}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionShell>

        {/* ── Recent coverage ──────────────────────────────────────── */}
        <SectionShell tone="cream" eyebrow="As seen in">
          <div className="max-w-3xl mx-auto">
            <h2 id="coverage-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2 pb-3 border-b border-oxblood/30">
              Recent coverage
            </h2>
            <p className="text-sm text-neutral-600 leading-relaxed">
              This list will be populated as coverage appears. To suggest a citation, email{' '}
              <a href="mailto:info@banned-books.org" className="text-oxblood font-medium hover:underline">
                info@banned-books.org
              </a>.
            </p>
          </div>
        </SectionShell>

        {/* ── Contact ──────────────────────────────────────────────── */}
        <SectionShell tone="white" eyebrow="Get in touch">
          <div className="max-w-3xl mx-auto">
            <h2 id="contact-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-6 pb-3 border-b border-oxblood/30">
              Contact
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-neutral-500">Press inquiries</dt>
              <dd>
                <a href="mailto:info@banned-books.org" className="text-oxblood font-medium hover:underline">
                  info@banned-books.org
                </a>
              </dd>
              <dt className="text-neutral-500">Response time</dt>
              <dd className="text-neutral-700">Within 48 hours</dd>
              <dt className="text-neutral-500">Dataset &amp; licensing</dt>
              <dd>
                <Link href="/dataset" className="text-oxblood font-medium hover:underline">
                  /dataset
                </Link>
              </dd>
              <dt className="text-neutral-500">General inquiries</dt>
              <dd>
                <Link href="/about#get-in-touch" className="text-oxblood font-medium hover:underline">
                  Contact form
                </Link>
              </dd>
            </dl>
            <p className="mt-10 pt-6 border-t border-neutral-200 text-xs text-neutral-500 leading-relaxed">
              Banned Books is an independent project. No affiliations with publishers, governments, or advocacy organisations.
            </p>
          </div>
        </SectionShell>
      </main>
    </>
  )
}
