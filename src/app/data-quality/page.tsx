import type { Metadata } from 'next'
import Link from 'next/link'
import CitationBlock from '@/components/citation-block'
import { buildCitationMeta } from '@/lib/citation-meta'

const PAGE_CANONICAL = 'https://www.banned-books.org/data-quality'
const PAGE_ONLINE_DATE = '2026-05-18'

export const metadata: Metadata = {
  title: 'Data quality — how we classify records',
  description:
    'Every book and author entry in this catalogue is rated for data quality. This page explains the three levels — confident, default, and limited — and the automated signals behind them.',
  alternates: { canonical: '/data-quality' },
  other: buildCitationMeta({
    entityType: 'methodology',
    title: 'Data quality — how we classify records',
    url: PAGE_CANONICAL,
    onlineDate: PAGE_ONLINE_DATE,
  }),
}

export default function DataQualityPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <Link
        href="/methodology"
        className="inline-block text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-8"
      >
        ← Methodology
      </Link>

      <div className="bg-red-50 dark:bg-red-950/20 border-l-4 border-red-700 rounded-r-lg p-8 mb-12">
        <p className="text-xs tracking-widest text-red-700 dark:text-red-400 uppercase mb-2">
          Data quality
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-4 text-gray-900 dark:text-gray-100">
          How we classify what we know
        </h1>
        <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
          This catalogue is built mostly by automated import from public
          sources, then enriched and reviewed. Not every entry has been
          checked by a human, and we don&apos;t pretend otherwise — every
          record carries a quality label so you can tell at a glance how
          much weight to put on it.
        </p>
      </div>

      <CitationBlock
        entityType="methodology"
        entity={{
          title: 'Data quality — how we classify records',
          slug: 'data-quality',
        }}
        url={PAGE_CANONICAL}
      />

      <article className="prose prose-gray dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-red-700 prose-a:no-underline hover:prose-a:underline">
        <h2>Three levels</h2>
        <p>
          Every book and author entry falls into one of three buckets,
          computed from the data we hold:
        </p>

        <div className="not-prose space-y-4 my-6">
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-5">
            <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300 mb-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              High-confidence record
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              The work is well-attested: we have a canonical external
              identifier (OpenLibrary, ISBN, or Project Gutenberg), full
              editorial descriptions, and at least one further signal —
              a documented author, multiple ban records, or source
              citations. <em>1984</em>, <em>Animal Farm</em>, and{' '}
              <em>The Satanic Verses</em> sit here.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-5">
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Automated import — not individually verified
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              The default state for most entries. The record was created
              from an automated import pipeline and nothing in our
              quality checks raised a problem — but no one has manually
              cross-checked the specific facts. Treat broad strokes
              (title, author, ban country) as reliable; treat narrower
              details as provisional.
            </p>
          </div>

          <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30 p-5">
            <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1.5">
              Limited verification
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              At least one quality signal failed: the cover is a
              placeholder, the entry was AI-drafted without a description,
              no source citations are linked to its bans, or the author
              attribution is missing. These records are still shown
              because they document a real ban that someone might be
              searching for — but the specifics are unconfirmed.
            </p>
          </div>
        </div>

        <h2>The signals we use</h2>
        <p>
          We don&apos;t hand-grade five thousand books. Classification is
          computed from signals already present in the data:
        </p>

        <ul>
          <li>
            <strong>Canonical identifiers</strong> — an OpenLibrary work
            ID, a valid ISBN-13 confirmed via Bookshop.org, or a Project
            Gutenberg ID. Any of these means we know exactly which work
            we&apos;re talking about.
          </li>
          <li>
            <strong>Editorial completeness</strong> — both the work
            description and the ban-context description are filled in
            with more than a sentence each. This signals that an
            enrichment pass has actually produced usable copy, not
            placeholder text.
          </li>
          <li>
            <strong>Ban evidence</strong> — bans in three or more
            countries, or five or more total ban records, or any ban
            marked as verified. This catches both globally-banned canon
            and US-only canon (where a single title might have dozens of
            school-district records).
          </li>
          <li>
            <strong>Source citations</strong> — bans linked to at least
            one ban-source record (PEN America, the ALA, Reporters
            Without Borders, Wikipedia with archived URL, etc.).
          </li>
          <li>
            <strong>Author legitimacy</strong> — at least one named
            author with a known birth year, not a generic placeholder
            like <em>Anonymous</em> or <em>Various Authors</em>. Genuinely
            anonymous canonical works (the Bible, the Quran,{' '}
            <em>One Thousand and One Nights</em>) bypass this signal
            because they have other evidence.
          </li>
        </ul>

        <h2>What triggers limited verification</h2>
        <p>
          A record is flagged when any of the following holds:
        </p>
        <ul>
          <li>
            The book cover is a known placeholder (we couldn&apos;t find
            a real cover image).
          </li>
          <li>
            The record was drafted by an AI enrichment pass but no
            description was produced.
          </li>
          <li>
            None of the book&apos;s bans have any source citation
            attached.
          </li>
          <li>
            The work has no author or only placeholder authors{' '}
            <em>and</em> no canonical external identifier (so the work
            itself isn&apos;t externally anchored).
          </li>
          <li>
            The publication or birth year is implausibly outside the
            range we can sanity-check (before 3000 BCE or after 2030).
          </li>
        </ul>

        <h2>How often this is recomputed</h2>
        <p>
          The classifier runs periodically against the full catalogue.
          The label on a page reflects the most recent evaluation — when
          you see <em>evaluated 18 May 2026</em> in the footer, that&apos;s
          the date the rules were last applied to that specific record.
          If the underlying data changes (a description gets filled in,
          a source citation gets added, a cover gets corrected), the
          status will update on the next run.
        </p>

        <h2>Why we publish this at all</h2>
        <p>
          A common pattern for automatically-imported databases is to
          present everything as if it were equally trustworthy and hope
          no one notices. We&apos;d rather be explicit. AI search engines
          and human readers both benefit from knowing which records have
          been cross-checked and which are still provisional — and
          flagging our weak entries openly is what lets us be confident
          about the strong ones.
        </p>
        <p>
          If you spot a record that looks misclassified — either a
          flagged record that&apos;s clearly fine, or a confident record
          with a real problem —{' '}
          <a
            href="https://github.com/ludo-raedts/banned-books-org/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-700 dark:text-red-400 underline hover:text-red-900"
          >
            open an issue on GitHub
          </a>{' '}
          or use the contact form on the{' '}
          <Link
            href="/about"
            className="text-red-700 dark:text-red-400 underline hover:text-red-900"
          >
            About page
          </Link>
          .
        </p>

        <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mt-12 not-prose">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            <strong className="text-gray-800 dark:text-gray-200">
              Related reading.
            </strong>{' '}
            For context on the catalogue as a whole, the country
            rankings, and how we treat school bans vs. national bans,
            see the{' '}
            <Link
              href="/methodology"
              className="text-red-700 dark:text-red-400 underline hover:text-red-900"
            >
              methodology page
            </Link>
            . For the policy on which works we include and why, see{' '}
            <Link
              href="/essays/what-we-document"
              className="text-red-700 dark:text-red-400 underline hover:text-red-900"
            >
              What we document — and why that is a choice
            </Link>
            .
          </p>
        </div>
      </article>
    </main>
  )
}
