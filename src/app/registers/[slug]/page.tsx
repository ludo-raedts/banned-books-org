// /registers/<slug> — one large official list: context intro, source credit,
// A–Z browse, and the entries that are also books in our catalogue.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from '@/components/link'
import BreadcrumbJsonLd from '@/components/breadcrumb-jsonld'
import Eyebrow from '@/components/section/Eyebrow'
import { adminClient } from '@/lib/supabase'
import { renderContentBlockHtml } from '@/lib/markdown'
import { FRAMING_LABEL, getLetterCounts, getRegisterList } from '@/lib/registers'
import { LetterNav } from '../letter-nav'

export const revalidate = 86400

// Rendered on first request, then ISR — no DB load at build time.
export function generateStaticParams() {
  return []
}

const proseClasses =
  'prose prose-gray max-w-none prose-a:text-oxblood prose-a:underline prose-a:underline-offset-2 prose-p:leading-relaxed'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const list = await getRegisterList(slug)
  if (!list) return {}
  const name = list.title_en ?? list.title
  const years = list.year_end && list.year_end !== list.year_start ? `${list.year_start}–${list.year_end}` : `${list.year_start}`
  return {
    title: `${name} — full register`,
    description: `All ${list.entry_count.toLocaleString('en-US')} entries of ${list.title} (${years}), as printed, A–Z, each linked to the original source.`,
    alternates: { canonical: `/registers/${slug}` },
  }
}

export default async function RegisterListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const list = await getRegisterList(slug)
  if (!list) notFound()

  const [counts, { data: matched, error }] = await Promise.all([
    getLetterCounts(list.id),
    adminClient()
      .from('register_entries')
      .select('book:books(slug, title)')
      .eq('list_id', list.id)
      .not('matched_book_id', 'is', null)
      .limit(1000),
  ])
  if (error) throw error
  const books = new Map<string, string>()
  for (const r of (matched ?? []) as unknown as { book: { slug: string; title: string } | null }[]) {
    if (r.book) books.set(r.book.slug, r.book.title)
  }
  const matchedBooks = [...books].sort((a, b) => a[1].localeCompare(b[1], 'de'))
  const introHtml = list.intro_md ? renderContentBlockHtml(list.intro_md) : ''
  const years = list.year_end && list.year_end !== list.year_start ? `${list.year_start}–${list.year_end}` : `${list.year_start}`

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <BreadcrumbJsonLd
        items={[{ label: 'Home', href: '/' }, { label: 'Registers', href: '/registers' }, { label: list.title_en ?? list.title }]}
      />
      <Link href="/registers" className="mb-8 inline-block text-sm text-neutral-400 transition-colors hover:text-oxblood">
        ← All registers
      </Link>

      <header className="mb-8 rounded-r-xl border-l-4 border-brand bg-brand-light py-6 pl-6 pr-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-brand/70">
          {FRAMING_LABEL[list.framing]} · {years}
        </p>
        <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {list.title_en ?? list.title}
        </h1>
        {list.title_en && <p className="mt-2 font-serif text-lg italic text-gray-700">{list.title}</p>}
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 tabular-nums">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-neutral-600">Entries</dt>
            <dd className="font-serif text-2xl font-semibold text-oxblood">{list.entry_count.toLocaleString('en-US')}</dd>
          </div>
          {list.matched_count > 0 && (
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-neutral-600">In our catalogue</dt>
              <dd className="font-serif text-2xl font-semibold text-oxblood">{matchedBooks.length.toLocaleString('en-US')}</dd>
            </div>
          )}
        </dl>
      </header>

      {introHtml && <div className={proseClasses} dangerouslySetInnerHTML={{ __html: introHtml }} />}

      <section className="mt-10 border-t border-neutral-200 pt-6">
        <Eyebrow>Browse the register</Eyebrow>
        <h2 className="mb-4 font-serif text-xl font-semibold tracking-tight text-gray-900">All entries, A–Z</h2>
        <LetterNav slug={slug} counts={counts} />
        <p className="mt-4 text-sm text-neutral-500">
          Entries are shown as printed, in the list&apos;s own alphabetical order. These titles are not counted
          in our banned-book totals.
        </p>
      </section>

      {matchedBooks.length > 0 && (
        <section className="mt-10 border-t border-neutral-200 pt-6">
          <h2 className="mb-1 font-serif text-xl font-semibold tracking-tight text-gray-900">
            Also in our catalogue
            <span className="ml-2 text-sm font-normal text-neutral-400">({matchedBooks.length.toLocaleString('en-US')})</span>
          </h2>
          <p className="mb-5 text-sm text-neutral-500">
            Books on this list that we document with their own page, usually because they were banned elsewhere too.
          </p>
          <ul className="columns-1 gap-6 text-sm sm:columns-2">
            {matchedBooks.map(([s, t]) => (
              <li key={s} className="mb-1.5 break-inside-avoid">
                <Link href={`/books/${s}`} className="text-gray-900 underline decoration-oxblood/30 underline-offset-2 hover:decoration-oxblood">
                  {t}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 text-xs leading-relaxed text-neutral-500">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Source</h2>
        <p>
          Issued by {list.issuer}.{' '}
          <a href={list.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {list.source_name}
          </a>
          .
        </p>
        {list.licence_note && <p className="mt-1">{list.licence_note}</p>}
      </section>
    </main>
  )
}
