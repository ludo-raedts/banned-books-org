import type { Metadata } from 'next'
import Link from 'next/link'
import SectionShell from '@/components/section/SectionShell'
import TrackedOutboundLink from '@/components/tracked-outbound-link'
import { BookshopListEmbed } from '@/components/bookshop-list-embed'
import { bookshopListUrl, BOOKSHOP_LISTS } from '@/lib/bookshop-lists'
import { BOOKSHOP_REL } from '@/lib/bookshop'
import { getKoboStorefrontUrl, KOBO_REL } from '@/lib/kobo'

export const metadata: Metadata = {
  title: 'Get Banned Books — Support Independent Bookstores',
  description:
    'Where to buy or download the banned books in our catalogue: curated lists on Bookshop.org (every sale supports independent bookstores), ebooks on Kobo, and free public-domain editions.',
  alternates: { canonical: '/get-banned-books' },
}

const STOREFRONT_URL = 'https://bookshop.org/shop/Banned-books'

// The curated affiliate lists live on bookshop.org under our shop; slugs
// mirror src/lib/bookshop-lists.ts (which maps reason/scope pages to the
// same lists). Regenerate list contents with
// scripts/export-bookshop-lists.ts after ISBN-enrichment batches.
const CURATED_LISTS: ReadonlyArray<{ slug: string; title: string; blurb: string }> = [
  {
    slug: BOOKSHOP_LISTS.mostBanned,
    title: 'The Most Banned Books in the World',
    blurb: 'Ranked by documented ban events across more than 90 countries.',
  },
  {
    slug: BOOKSHOP_LISTS.twenty20s,
    title: 'Most Banned in the 2020s',
    blurb: 'The titles at the centre of the current wave, 2020 onward.',
  },
  {
    slug: BOOKSHOP_LISTS.penAmerica2024_25,
    title: 'PEN America Index 2024–25',
    blurb: 'The most-removed books in U.S. school districts this academic year.',
  },
  {
    slug: 'banned-in-u-s-schools',
    title: 'Banned in U.S. Schools',
    blurb: 'The dominant front in contemporary book banning.',
  },
  {
    slug: BOOKSHOP_LISTS.classics,
    title: 'Banned Classics',
    blurb: 'Ulysses, Lady Chatterley, Candide — bans documented before 1950.',
  },
  {
    slug: 'banned-lgbtq-books-banned-books',
    title: 'Banned LGBTQ+ Books',
    blurb: 'The largest single category of school-library challenges since 2021.',
  },
  {
    slug: 'banned-political-books',
    title: 'Banned Political Books',
    blurb: 'Dissent, exiled voices, and accounts of authoritarianism.',
  },
  {
    slug: 'books-banned-for-race-and-racism',
    title: 'Banned for Race and Racism',
    blurb: 'Morrison, Baldwin, Kendi, Coates — targeted across centuries.',
  },
  {
    slug: 'banned-for-religion-or-blasphemy',
    title: 'Banned for Religion or Blasphemy',
    blurb: 'From the Catholic Index to modern blasphemy prosecutions.',
  },
  {
    slug: 'books-banned-for-sexual-content',
    title: 'Banned for Sexual Content',
    blurb: 'Obscenity trials, moral panics, and the current school wave.',
  },
  {
    slug: 'banned-for-violent-content',
    title: 'Banned for Violent Content',
    blurb: 'Anti-war literature, graphic memoirs, and YA about trauma.',
  },
  {
    slug: 'banned-by-the-church',
    title: 'Banned by the Church',
    blurb: 'Galileo, Descartes, Spinoza — the Index Librorum Prohibitorum.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': 'https://www.banned-books.org/get-banned-books',
  name: 'Get banned books — support independent bookstores',
  description:
    'Where to buy or download the banned books in our catalogue: curated lists on Bookshop.org, ebooks on Kobo, and free public-domain editions.',
  url: 'https://www.banned-books.org/get-banned-books',
}

export default function GetBannedBooksPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main>
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="relative pt-10 md:pt-14 px-6 md:px-9 pb-10 md:pb-14 bg-white">
          <div className="max-w-3xl mx-auto">
            <p className="text-sm uppercase tracking-[0.12em] font-semibold text-oxblood mb-3.5">
              Get the books · Independent bookstores
            </p>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-gray-900">
              Get banned books.
            </h1>
            <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-gray-900">
              The simplest answer to a book ban is to read the book. Here is
              where to find every title in our catalogue — without a cent
              going to the platforms that quietly delist them.
            </p>
            <div className="mt-6 text-sm text-gray-700 leading-relaxed flex flex-col gap-4">
              <p>
                We are not a store, and we don&rsquo;t want to be one. Instead,
                we point every &ldquo;find this book&rdquo; link at{' '}
                <TrackedOutboundLink
                  eventName="Bookshop Click"
                  eventProperties={{ source: 'get-banned-books', linkType: 'storefront' }}
                  href={STOREFRONT_URL}
                  target="_blank"
                  rel={BOOKSHOP_REL}
                  className="text-oxblood hover:underline"
                >
                  Bookshop.org
                </TrackedOutboundLink>
                , the online bookstore that shares its profit pool with
                independent bookstores — over $40 million raised for local
                shops so far. You can even pick a specific local bookstore at
                checkout and it receives the full profit margin of your order.
              </p>
              <p>
                For ebooks we link to Kobo, and for public-domain classics we
                point to free editions. We deliberately{' '}
                <Link href="/why-not-amazon" className="text-oxblood hover:underline">
                  don&rsquo;t link to Amazon
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* ── Disclosure ───────────────────────────────────────────── */}
        <SectionShell tone="white">
          <div className="max-w-3xl mx-auto px-4 py-3 border border-neutral-200 bg-white rounded-sm text-xs text-neutral-500 leading-relaxed">
            <p>
              Outbound Bookshop.org and Kobo links are affiliate links. They
              support independent bookstores and this project at no extra cost
              to you — and they never influence which books we document or how
              we rank them.
            </p>
          </div>
        </SectionShell>

        {/* ── Featured list embed ──────────────────────────────────── */}
        <SectionShell tone="cream" eyebrow="Featured · Curated on Bookshop.org">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2 pb-3 border-b border-oxblood/30">
              The most banned books in the world
            </h2>
            <p className="text-sm text-neutral-600 leading-relaxed mb-6">
              Fifty titles, ranked by documented ban events in our database —
              every one available through independent bookstores.
            </p>
            <BookshopListEmbed slug={BOOKSHOP_LISTS.mostBanned} variant="list" />
          </div>
        </SectionShell>

        {/* ── All curated lists ────────────────────────────────────── */}
        <SectionShell tone="white" eyebrow={`Browse · ${CURATED_LISTS.length} curated lists`}>
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2 pb-3 border-b border-oxblood/30">
              Banned books by theme
            </h2>
            <p className="text-sm text-neutral-600 leading-relaxed mb-6">
              Each list is compiled from our database and kept on Bookshop.org,
              so every purchase routes through independent bookstores.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CURATED_LISTS.map(list => (
                <TrackedOutboundLink
                  key={list.slug}
                  eventName="Bookshop Click"
                  eventProperties={{ source: 'get-banned-books', linkType: 'list', listSlug: list.slug }}
                  href={bookshopListUrl(list.slug)}
                  target="_blank"
                  rel={BOOKSHOP_REL}
                  className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
                >
                  <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
                    {list.title} →
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 leading-relaxed">{list.blurb}</p>
                </TrackedOutboundLink>
              ))}
            </div>
            <div className="mt-6">
              <TrackedOutboundLink
                eventName="Bookshop Click"
                eventProperties={{ source: 'get-banned-books', linkType: 'storefront' }}
                href={STOREFRONT_URL}
                target="_blank"
                rel={BOOKSHOP_REL}
                className="inline-flex items-center justify-center rounded-lg bg-oxblood px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-oxblood/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-oxblood/40"
              >
                Visit our full Bookshop.org storefront →
              </TrackedOutboundLink>
            </div>
          </div>
        </SectionShell>

        {/* ── Ebooks (Kobo) ────────────────────────────────────────── */}
        <SectionShell tone="cream" eyebrow="Ebooks">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2 pb-3 border-b border-oxblood/30">
              Prefer to read digitally?
            </h2>
            <p className="text-sm text-neutral-700 leading-relaxed max-w-2xl">
              Every book page on this site has a &ldquo;Find on Kobo&rdquo;
              link for the ebook edition. Kobo sells standard EPUB files that
              can be read on most e-readers, phones, and tablets — not a
              closed ecosystem.
            </p>
            <div className="mt-5">
              <TrackedOutboundLink
                eventName="Kobo Click"
                eventProperties={{ source: 'get-banned-books' }}
                href={getKoboStorefrontUrl('get-banned-books')}
                target="_blank"
                rel={KOBO_REL}
                className="inline-flex items-center justify-center rounded-lg border border-oxblood/30 px-6 py-3 text-base font-semibold text-oxblood transition-colors hover:bg-oxblood/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-oxblood/40"
              >
                Browse ebooks on Kobo →
              </TrackedOutboundLink>
            </div>
          </div>
        </SectionShell>

        {/* ── Free & public domain ─────────────────────────────────── */}
        <SectionShell tone="white" eyebrow="Free · Public domain">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2 pb-3 border-b border-oxblood/30">
              Many banned classics are free
            </h2>
            <p className="text-sm text-neutral-700 leading-relaxed max-w-2xl">
              A large share of historically banned literature is in the public
              domain. Project Gutenberg offers over 75,000 free ebooks —
              including many of the titles on our{' '}
              <Link href="/banned-classics" className="text-oxblood hover:underline">
                banned classics
              </Link>{' '}
              list — with no account, no tracking, and no DRM.
            </p>
            <div className="mt-5">
              <a
                href="https://www.gutenberg.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-6 py-3 text-base font-semibold text-gray-800 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
              >
                Project Gutenberg →
              </a>
            </div>
          </div>
        </SectionShell>

        {/* ── Bottom CTAs ──────────────────────────────────────────── */}
        <SectionShell tone="white">
          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/reading-club"
              className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
            >
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Read along</p>
              <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
                Join the banned books reading club →
              </p>
            </Link>
            <Link
              href="/reading-list"
              className="group block px-5 py-4 border border-neutral-200 hover:border-oxblood transition-colors rounded-sm"
            >
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Go deeper</p>
              <p className="font-serif text-base font-semibold text-gray-900 group-hover:text-oxblood transition-colors">
                Books about censorship itself →
              </p>
            </Link>
          </div>
        </SectionShell>
      </main>
    </>
  )
}
