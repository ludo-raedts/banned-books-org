// Seasonal hub — Christmas books with a documented ban or removal, plus the
// (sourced) story of Christmas censorship, plus a Bookshop.org gift CTA.
// Registry + grouping: src/lib/christmas-books.ts (hand-curated, ban-backed).
//
// DB cost per (daily) render: one books read (~45 ids) + one v_book_ban_counts
// read for the same ids. No catalogue sweep.
export const revalidate = 86400

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from '@/components/link'
import { adminClient } from '@/lib/supabase'
import BookCardCompact from '@/components/home/BookCardCompact'
import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import Eyebrow from '@/components/section/Eyebrow'
import BreadcrumbJsonLd from '@/components/breadcrumb-jsonld'
import PageviewTracker from '@/components/pageview-tracker'
import TrackedOutboundLink from '@/components/tracked-outbound-link'
import { coverAlt } from '@/lib/cover-alt'
import { getBookshopUrl, getBookshopLinkType, BOOKSHOP_REL, BOOKSHOP_SHOP_NAME } from '@/lib/bookshop'
import { CHRISTMAS_GROUPS, CHRISTMAS_IDS, CHRISTMAS_GIFT_PICKS } from '@/lib/christmas-books'

const PATH = '/christmas-banned-books'
const PAGE_URL = `https://www.banned-books.org${PATH}`
const STOREFRONT = `https://bookshop.org/shop/${BOOKSHOP_SHOP_NAME}`

export const metadata: Metadata = {
  title: 'Banned Christmas Books: Nativity Stories, Santa & Holiday Reads',
  description:
    'Christmas books that were pulled from school libraries, the surprising history of banning Christmas itself, and gift ideas from independent bookstores via Bookshop.org.',
  alternates: { canonical: PATH },
}

type Row = {
  id: number
  slug: string
  title: string
  isbn13: string | null
  cover_url: string | null
  title_native: string | null
  original_language: string | null
  bookshop_status: 'valid' | 'not_found' | null
  bookshop_isbn13: string | null
  book_authors: { authors: { display_name: string } | null }[]
}

type Book = Row & { author: string; bans: number }

async function loadBooks(): Promise<Map<number, Book>> {
  const db = adminClient()
  const { data, error } = await db
    .from('books')
    .select(
      'id, slug, title, isbn13, cover_url, title_native, original_language, bookshop_status, bookshop_isbn13, book_authors(authors(display_name))',
    )
    .in('id', CHRISTMAS_IDS)
  if (error) throw error
  const { data: counts, error: cErr } = await db
    .from('v_book_ban_counts')
    .select('entity_id, total_bans')
    .in('entity_id', CHRISTMAS_IDS)
  if (cErr) throw cErr
  const bans = new Map((counts ?? []).map((r) => [r.entity_id as number, r.total_bans as number]))
  const out = new Map<number, Book>()
  for (const r of (data ?? []) as unknown as Row[]) {
    out.set(r.id, {
      ...r,
      author: r.book_authors.map((ba) => ba.authors?.display_name).filter(Boolean).join(', '),
      bans: bans.get(r.id) ?? 0,
    })
  }
  return out
}

function toCard(b: Book) {
  return {
    id: b.id,
    title: b.title,
    slug: b.slug,
    cover_url: b.cover_url,
    author: b.author,
    title_native: b.title_native,
    title_native_lang: b.original_language,
    context: `${b.bans} documented ${b.bans === 1 ? 'ban' : 'bans'}`,
  }
}

const SOURCES: { label: string; href: string }[] = [
  { label: 'Harvard Gazette — a historian on Christmas past (Puritan ban, 1659–1681)', href: 'https://news.harvard.edu/gazette/story/2023/12/historian-shares-the-sordid-tales-of-christmas-past/' },
  { label: 'History.com — When Massachusetts banned Christmas', href: 'https://www.history.com/news/when-massachusetts-banned-christmas' },
  { label: "CBLDF — Santa's pipe missing from new edition of classic poem (2012)", href: 'https://cbldf.org/2012/12/santas-pipe-missing-from-new-edition-of-classic-poem/' },
  { label: 'AP via NBC News — "There arose such a clatter over pipe-free Santa"', href: 'https://www.nbcnews.com/news/world/there-arose-such-clatter-over-pipe-free-santa-flna1c7557587' },
]

export default async function ChristmasBannedBooksPage() {
  const books = await loadBooks()
  const groups = CHRISTMAS_GROUPS.map((g) => ({
    ...g,
    books: g.ids.map((id) => books.get(id)).filter((b): b is Book => !!b),
  }))
  const all = groups.flatMap((g) => g.books)
  const totalBans = all.reduce((s, b) => s + b.bans, 0)
  const gifts = CHRISTMAS_GIFT_PICKS.map((id) => books.get(id)).filter((b): b is Book => !!b)

  const ldHtml = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Banned Christmas Books',
    url: PAGE_URL,
    description: `${all.length} Christmas books with a documented ban or removal in US school libraries.`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: all.length,
      itemListElement: all.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://www.banned-books.org/books/${b.slug}`,
        name: b.title,
      })),
    },
  }

  return (
    <main>
      <BreadcrumbJsonLd items={[{ label: 'Home', href: '/' }, { label: 'Banned Christmas Books' }]} />
      <PageviewTracker entityType="page" path={PATH} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldHtml(collectionJsonLd) }} />

      {/* Hero — deep evergreen with a quiet snowfall, kept inside the site's oxblood/cream palette */}
      <section className="relative overflow-hidden bg-[#143626] text-white px-6 md:px-9 pt-12 md:pt-16 pb-12 md:pb-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 18%, #fff 1.5px, transparent 2px), radial-gradient(circle at 31% 62%, #fff 1px, transparent 1.5px), radial-gradient(circle at 58% 22%, #fff 2px, transparent 2.5px), radial-gradient(circle at 77% 71%, #fff 1.5px, transparent 2px), radial-gradient(circle at 91% 33%, #fff 1px, transparent 1.5px), radial-gradient(circle at 45% 88%, #fff 1.5px, transparent 2px)',
            backgroundSize: '260px 260px',
          }}
        />
        <div className="relative max-w-5xl mx-auto">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#e9c46a]">
            <span aria-hidden="true">❄ </span>Seasonal reading list
          </p>
          <h1 className="mt-3 font-serif text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Banned Christmas Books
          </h1>
          <p className="mt-5 max-w-[720px] font-serif text-lg md:text-xl leading-relaxed text-white/90">
            Nativity stories, a Dickens classic, snowed-in teen romances and Santa himself: {all.length} Christmas
            books that have been pulled from school libraries. Christmas has been banned too — by England&apos;s Parliament
            in 1647 and by Massachusetts in 1659 — so this is an old tradition.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-white/25 pt-5">
            <div>
              <div className="font-serif text-3xl md:text-4xl font-semibold tabular-nums text-[#e9c46a]">{all.length}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-white/70">Christmas books on this list</div>
            </div>
            <div>
              <div className="font-serif text-3xl md:text-4xl font-semibold tabular-nums text-[#e9c46a]">{totalBans}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-white/70">Documented bans and removals</div>
            </div>
            <div>
              <div className="font-serif text-3xl md:text-4xl font-semibold tabular-nums text-[#e9c46a]">1647</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-white/70">Year England&apos;s Parliament outlawed the feast</div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#gift"
              className="inline-flex items-center gap-2 rounded-sm bg-[#e9c46a] px-5 py-2.5 text-sm font-semibold text-[#143626] hover:bg-[#f1d88f] transition-colors"
            >
              <span aria-hidden="true">🎁</span> Gift a banned book
            </a>
            <a href="#list" className="inline-flex items-center rounded-sm border border-white/40 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors">
              Jump to the list ↓
            </a>
          </div>
        </div>
      </section>

      {/* What this list is — and is not */}
      <SectionShell tone="white" eyebrow="Before you read">
        <div className="max-w-[760px]">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            Nobody is banning Christmas. Mostly.
          </h2>
          <p className="mt-4 font-serif text-lg leading-relaxed text-gray-900">
            Be honest about the pattern: the books below were not removed <em>because</em> they are about
            Christmas. All are US school-district removals recorded between 2021 and 2026, and several come
            from district-wide reviews — New Braunfels ISD in Texas, for example, scanned its entire
            collection against a new state law in 2025. Our records usually give no reason for the
            individual title, and we don&apos;t invent one.
          </p>
          <p className="mt-4 text-base leading-relaxed text-gray-800">
            That is exactly what makes the list worth reading. <strong>Books about the nativity</strong> sit next to{' '}
            <strong>a ghost-of-Christmas-past retelling</strong>; Dickens next to a picture book about a boy who
            keeps getting in trouble. When shelves are cleared out wholesale, the season&apos;s books go
            too. A decorated shelf is a good place to see what a book ban really
            looks like up close: not a villain, but a checklist.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-gray-600">
            Every title listed has at least one ban or removal row in our catalogue and links through to its
            own page with the institution, year and source. See the{' '}
            <Link href="/methodology" className="underline underline-offset-2 hover:text-gray-900">methodology</Link>{' '}
            for how we count.
          </p>
        </div>
      </SectionShell>

      {/* The list */}
      <div id="list" />
      {groups.map((g, i) => (
        <SectionShell key={g.key} tone={i % 2 === 0 ? 'cream' : 'white'} eyebrow={`${g.books.length} books`}>
          <SectionHeader title={g.title} subtitle={g.subtitle} accent="oxblood" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {g.books.map((b) => (
              <BookCardCompact key={b.id} book={toCard(b)} />
            ))}
          </div>
        </SectionShell>
      ))}

      {/* Bookshop CTA */}
      <section id="gift" className="bg-[#143626] text-white px-6 md:px-9 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#e9c46a]">
            <span aria-hidden="true">🎁 </span>Under the tree
          </p>
          <h2 className="mt-3 font-serif text-3xl md:text-4xl font-semibold tracking-tight">
            Give a banned book this Christmas — from an independent bookshop
          </h2>
          <p className="mt-4 max-w-[720px] text-base md:text-lg leading-relaxed text-white/85">
            The best answer to an emptied shelf is a full one. Bookshop.org shares its profit with
            independent bookstores, so a gift bought there keeps a local shop open — and puts a
            contested book in someone&apos;s hands.
          </p>

          <div className="mt-8 grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
            {gifts.map((b) => {
              const href = getBookshopUrl({ isbn13: b.isbn13, bookshopIsbn13: b.bookshop_isbn13, bookshopStatus: b.bookshop_status })
              return (
                <TrackedOutboundLink
                  key={b.id}
                  eventName="Bookshop Click"
                  eventProperties={{ source: 'christmas-gift-strip', bookSlug: b.slug, isbn13: b.isbn13 ?? null, linkType: getBookshopLinkType(href) }}
                  href={href}
                  target="_blank"
                  rel={BOOKSHOP_REL}
                  className="group block"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-sm bg-white/10 ring-1 ring-white/20 group-hover:ring-[#e9c46a] transition">
                    {b.cover_url && (
                      <Image
                        src={b.cover_url}
                        alt={coverAlt(b.title, b.author)}
                        fill
                        className="object-cover"
                        sizes="(min-width: 768px) 150px, 30vw"
                      />
                    )}
                  </div>
                  <div className="mt-2 text-xs leading-snug text-white/90 group-hover:text-white line-clamp-2">{b.title}</div>
                </TrackedOutboundLink>
              )
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <TrackedOutboundLink
              eventName="Bookshop Click"
              eventProperties={{ source: 'christmas-cta', linkType: 'storefront' }}
              href={STOREFRONT}
              target="_blank"
              rel={BOOKSHOP_REL}
              className="inline-flex items-center gap-2 rounded-sm bg-[#e9c46a] px-6 py-3 text-sm font-semibold text-[#143626] hover:bg-[#f1d88f] transition-colors"
            >
              Shop banned books at Bookshop.org <span aria-hidden="true">→</span>
            </TrackedOutboundLink>
            <Link href="/get-banned-books" className="text-sm text-white/85 underline underline-offset-4 hover:text-white">
              More ways to get banned books (ebooks, free editions)
            </Link>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-white/60 max-w-[720px]">
            Affiliate disclosure: as a Bookshop.org affiliate banned-books.org earns a small commission on
            purchases made through these links, at no extra cost to you. It never changes what we list or how
            we rank it.
          </p>
        </div>
      </section>

      {/* History + stories */}
      <SectionShell tone="white" eyebrow="Christmas &amp; censorship">
        <SectionHeader
          title="Banning Christmas: a short, strange history"
          subtitle="Three stories where the holiday itself — or its most famous poem — ended up in the censor's hands."
          accent="oxblood"
        />
        <div className="grid gap-5 md:grid-cols-3">
          <article className="rounded-sm border border-neutral-200 bg-white p-5">
            <div className="text-2xl" aria-hidden="true">🕯️</div>
            <h3 className="mt-2 font-serif text-xl font-semibold text-gray-900">1647: England cancels it</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">
              England&apos;s Puritan-led Parliament decided in the 1640s that the feast of the Nativity should no longer be
              observed, treating Christmas as a Catholic and pagan leftover. December 25 became a day of
              fasting and repentance in some years. The holiday returned with the monarchy in 1660.
            </p>
          </article>
          <article className="rounded-sm border border-neutral-200 bg-white p-5">
            <div className="text-2xl" aria-hidden="true">⚖️</div>
            <h3 className="mt-2 font-serif text-xl font-semibold text-gray-900">1659: Massachusetts fines it</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">
              The Massachusetts General Court made observing Christmas — by feasting, by not working — a
              punishable offence, with a five-shilling fine. The law stood until 1681, when the Crown took
              tighter control of the colony. Public Christmas stayed unpopular in New England for generations.
            </p>
          </article>
          <article className="rounded-sm border border-neutral-200 bg-white p-5">
            <div className="text-2xl" aria-hidden="true">🚬</div>
            <h3 className="mt-2 font-serif text-xl font-semibold text-gray-900">2012: Santa loses his pipe</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">
              A Vancouver-based author-publisher released &lsquo;Twas the Night Before Christmas with two lines about
              Santa&apos;s pipe cut and the pipe erased from the cover, &ldquo;for the benefit of children
              of the 21st century.&rdquo; The American Library Association objected; the edit became a small
              culture-war moment. The original text, published since 1823, was never withdrawn.
            </p>
          </article>
        </div>
      </SectionShell>

      {/* What we looked for */}
      <SectionShell tone="cream" eyebrow="Our research notes">
        <div className="max-w-[760px]">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            Books you may expect here — and why they are not
          </h2>
          <p className="mt-4 text-base leading-relaxed text-gray-800">
            Social-media posts about &ldquo;banned Christmas books&rdquo; circulate every December, usually as a
            cover collage with no sources. We checked the titles in one of them. For{' '}
            <em>Father Christmas</em> (Raymond Briggs), <em>The House Without a Christmas Tree</em> (Gail Rock),{' '}
            <em>Santa Claus Around the World</em> (Lisl Weil) and Holly Hobbie&apos;s illustrated{' '}
            <em>The Night Before Christmas</em>, we found no documented ban, removal or challenge. So they are
            not on this list. (<em>It&apos;s Christmas, David!</em> is, with three documented school removals.)
          </p>
          <p className="mt-4 text-base leading-relaxed text-gray-800">
            If you have a source for any of them — a school-board minute, a library notice, a news report —{' '}
            <Link href="/about" className="underline underline-offset-2 hover:text-oxblood">
              tell us
            </Link>{' '}
            and we&apos;ll add it. A title is only worth a place here if someone, somewhere, actually took it
            off the shelf.
          </p>
          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wider text-gray-500">Sources for this page&apos;s history</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            {SOURCES.map((s) => (
              <li key={s.href}>
                <a href={s.href} target="_blank" rel="noopener" className="underline underline-offset-2 text-gray-800 hover:text-oxblood">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      <SectionShell tone="white">
        <div className="max-w-[760px]">
          <Eyebrow>Keep reading</Eyebrow>
          <ul className="mt-3 grid gap-2 text-base sm:grid-cols-2">
            <li><Link href="/top-100-banned-books" className="underline underline-offset-2 hover:text-oxblood">The 100 most banned books</Link></li>
            <li><Link href="/themes/lgbtq" className="underline underline-offset-2 hover:text-oxblood">Banned books with LGBTQ+ characters</Link></li>
            <li><Link href="/banned-books-week" className="underline underline-offset-2 hover:text-oxblood">Banned Books Week</Link></li>
            <li><Link href="/get-banned-books" className="underline underline-offset-2 hover:text-oxblood">Where to buy banned books</Link></li>
          </ul>
        </div>
      </SectionShell>
    </main>
  )
}
