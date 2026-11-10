// /registers/<slug>/<letter>[-<part>] — the printed entries under one letter,
// up to REGISTER_PAGE_SIZE per page. Static via ISR; no searchParams (they
// would make the route dynamic and kill revalidate).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from '@/components/link'
import BreadcrumbJsonLd from '@/components/breadcrumb-jsonld'
import { GOOGLE_ONLY_NOINDEX } from '@/lib/robots-meta'
import {
  REGISTER_PAGE_SIZE,
  editionLabel,
  entrySourceUrl,
  extraAuthorName,
  getLetterCounts,
  getLetterEntries,
  getRegisterList,
  pageSegment,
  parseLetterSegment,
  type RegisterEntry,
} from '@/lib/registers'
import { LetterNav, PageNav } from '../../letter-nav'

export const revalidate = 86400

export function generateStaticParams() {
  return []
}

type Params = Promise<{ slug: string; letter: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, letter: seg } = await params
  const parsed = parseLetterSegment(seg)
  const list = await getRegisterList(slug)
  if (!list || !parsed) return {}
  const name = list.title_en ?? list.title
  const label = parsed.letter === '#' ? '0–9' : parsed.letter
  return {
    title: `${name}: ${label}${parsed.page > 1 ? ` (part ${parsed.page})` : ''}`,
    description: `Entries under “${label}” in ${list.title}, as printed, each linked to the original source.`,
    alternates: { canonical: `/registers/${slug}/${seg}` },
    // Thin by nature (list rows): kept out of Google's index, open to other engines.
    robots: GOOGLE_ONLY_NOINDEX,
  }
}

const KIND_BADGE: Partial<Record<RegisterEntry['kind'], string>> = {
  blanket: 'all works',
  group: 'whole category',
  periodical: 'periodical',
  rescission: 'ban lifted',
}

export default async function RegisterLetterPage({ params }: { params: Params }) {
  const { slug, letter: seg } = await params
  const parsed = parseLetterSegment(seg)
  if (!parsed) notFound()
  const list = await getRegisterList(slug)
  if (!list) notFound()
  const { letter, page } = parsed

  const [counts, entries] = await Promise.all([getLetterCounts(list.id), getLetterEntries(list.id, letter, page)])
  const total = counts.get(letter) ?? 0
  if (total === 0 || page > Math.ceil(total / REGISTER_PAGE_SIZE)) notFound()

  const name = list.title_en ?? list.title
  const label = letter === '#' ? '0–9' : letter
  const first = (page - 1) * REGISTER_PAGE_SIZE + 1
  const last = first + entries.length - 1
  const multiEdition = (list.year_end ?? list.year_start) !== list.year_start

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <BreadcrumbJsonLd
        items={[
          { label: 'Home', href: '/' },
          { label: 'Registers', href: '/registers' },
          { label: name, href: `/registers/${slug}` },
          { label },
        ]}
      />
      <Link href={`/registers/${slug}`} className="mb-6 inline-block text-sm text-neutral-400 transition-colors hover:text-oxblood">
        ← {name}
      </Link>
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-gray-900">
        {label}
        <span className="ml-3 align-middle text-base font-normal text-neutral-500 tabular-nums">
          {total > REGISTER_PAGE_SIZE
            ? `entries ${first.toLocaleString('en-US')}–${last.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}`
            : `${total.toLocaleString('en-US')} ${total === 1 ? 'entry' : 'entries'}`}
        </span>
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        {list.title} — as printed. Not counted in our banned-book totals.
      </p>

      <div className="mt-6 space-y-3">
        <LetterNav slug={slug} counts={counts} current={letter} />
        <PageNav slug={slug} letter={letter} total={total} page={page} />
      </div>

      <ol className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200" start={first}>
        {entries.map((e) => {
          const extra = extraAuthorName(e)
          const badge = KIND_BADGE[e.kind]
          return (
            <li key={e.id} className="py-3 text-sm leading-relaxed">
              <p className="text-gray-900">
                {e.printed_author && <span className="font-semibold">{e.printed_author}: </span>}
                {e.book ? (
                  <Link
                    href={`/books/${e.book.slug}`}
                    className="font-serif italic text-oxblood underline decoration-oxblood/30 underline-offset-2 hover:decoration-oxblood"
                  >
                    {e.title}
                  </Link>
                ) : (
                  <span className="font-serif italic">{e.title}</span>
                )}
                {e.imprint && <span className="text-neutral-600">. {e.imprint}</span>}
                {extra && <span className="text-neutral-500"> ({extra})</span>}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                {multiEdition && <span className="tabular-nums">{editionLabel(slug, e.edition)}</span>}
                {e.ban_year && !multiEdition && <span className="tabular-nums">{e.ban_year}</span>}
                {badge && (
                  <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-neutral-600">
                    {badge}
                  </span>
                )}
                {e.note && <span>{e.note}</span>}
                {e.locator && <span>{e.locator}</span>}
                {e.book && (
                  <Link href={`/books/${e.book.slug}`} className="text-oxblood hover:underline">
                    Book page →
                  </Link>
                )}
                <a href={entrySourceUrl(list, e)} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-600 hover:underline">
                  Source ↗
                </a>
              </p>
            </li>
          )
        })}
      </ol>

      {total > REGISTER_PAGE_SIZE && (
        <div className="mt-6">
          <PageNav slug={slug} letter={letter} total={total} page={page} />
        </div>
      )}
      {page * REGISTER_PAGE_SIZE < total && (
        <p className="mt-4 text-sm">
          <Link href={`/registers/${slug}/${pageSegment(letter, page + 1)}`} className="text-oxblood hover:underline">
            Continue with {label}, part {page + 1} →
          </Link>
        </p>
      )}
    </main>
  )
}
