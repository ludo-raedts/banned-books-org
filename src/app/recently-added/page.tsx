// Daily ISR: one RPC call per book/author list per day. Imports land in
// irregular bulk batches, so a daily refresh is plenty.
export const revalidate = 86400

import type { Metadata } from 'next'
import Link from '@/components/link'
import { adminClient } from '@/lib/supabase'
import SectionShell from '@/components/section/SectionShell'
import { GOOGLE_ONLY_NOINDEX } from '@/lib/robots-meta'

export const metadata: Metadata = {
  title: 'Recently added books and authors',
  description:
    'The newest 500 books and 500 authors added to the Banned Books catalogue, grouped by date and source, with the country of their first recorded ban.',
  alternates: { canonical: '/recently-added' },
  // Newest rows are the thinnest (not yet enriched): keep the page out of
  // Google like the rest of the non-core set; Bing/AI crawlers still follow it.
  robots: GOOGLE_ONLY_NOINDEX,
}

const LIMIT = 500

type Row = {
  id: number
  slug: string
  title: string
  author_name: string | null
  author_slug: string | null
  country_code: string | null
  country_name: string | null
  country_slug: string | null
  source_name: string | null
  added_at: string
}

async function load(kind: 'books' | 'authors'): Promise<Row[]> {
  const { data, error } = await adminClient().rpc('recently_added', {
    p_kind: kind,
    p_limit: LIMIT,
  })
  if (error) throw new Error(`recently_added(${kind}): ${error.message}`)
  return (data ?? []) as Row[]
}

type Batch = { key: string; date: string; source: string | null; rows: Row[] }

// A "batch" = same UTC day + same source. Biggest batches of a day first.
function toBatches(rows: Row[]): Batch[] {
  const map = new Map<string, Batch>()
  for (const r of rows) {
    const date = r.added_at.slice(0, 10)
    const key = `${date}|${r.source_name ?? ''}`
    let b = map.get(key)
    if (!b) {
      b = { key, date, source: r.source_name, rows: [] }
      map.set(key, b)
    }
    b.rows.push(r)
  }
  return [...map.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || b.rows.length - a.rows.length,
  )
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function BatchList({ kind, rows }: { kind: 'books' | 'authors'; rows: Row[] }) {
  return (
    <div className="space-y-8">
      {toBatches(rows).map(batch => (
        <div key={batch.key}>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            {fmtDate(batch.date)} ·{' '}
            <span title={batch.source ?? undefined}>
              {batch.source
                ? batch.source.length > 90
                  ? `${batch.source.slice(0, 90).trimEnd()}…`
                  : batch.source
                : 'Source not recorded'}
            </span>
            <span className="ml-2 font-normal text-neutral-500 tabular-nums">
              {batch.rows.length.toLocaleString('en-US')} {kind}
            </span>
          </h3>
          <ul className="text-sm divide-y divide-gray-100 border-y border-gray-100">
            {batch.rows.map(r => (
              <li key={r.id} className="py-1.5 flex flex-wrap items-baseline gap-x-3">
                <Link
                  href={kind === 'books' ? `/books/${r.slug}` : `/authors/${r.slug}`}
                  className="text-gray-900 hover:underline"
                >
                  {r.title}
                </Link>
                {kind === 'books' && r.author_name && r.author_slug && r.author_name !== 'Unknown' && (
                  <span className="text-neutral-500">
                    by{' '}
                    <Link href={`/authors/${r.author_slug}`} className="hover:underline">
                      {r.author_name}
                    </Link>
                  </span>
                )}
                {r.country_code && r.country_name && (
                  <Link
                    href={`/countries/${r.country_code.toLowerCase()}`}
                    className="ml-auto text-neutral-500 hover:underline"
                  >
                    {r.country_name}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default async function RecentlyAddedPage() {
  const [books, authors] = await Promise.all([load('books'), load('authors')])
  const latest = [...books, ...authors].map(r => r.added_at).sort().at(-1)

  return (
    <SectionShell>
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-gray-900">
        Recently added
      </h1>
      <p className="mt-3 text-sm text-neutral-600 max-w-2xl">
        The newest {LIMIT} books and {LIMIT} authors in the catalogue, grouped by the day
        they were added and the source of their first recorded ban. Country is where that
        first ban applies. New entries are often still being enriched with covers and
        descriptions. See <Link href="/sources" className="underline">sources</Link> and{' '}
        <Link href="/methodology" className="underline">methodology</Link>.
      </p>
      <p className="mt-2 text-xs text-neutral-500">
        Last updated: {latest ? fmtDate(latest.slice(0, 10)) : 'n/a'} (page refreshes daily) ·{' '}
        <a href="#books" className="underline">Books</a> ·{' '}
        <a href="#authors" className="underline">Authors</a>
      </p>

      <h2 id="books" className="mt-10 mb-4 font-serif text-2xl font-semibold text-gray-900">
        Books
      </h2>
      <BatchList kind="books" rows={books} />

      <h2 id="authors" className="mt-14 mb-4 font-serif text-2xl font-semibold text-gray-900">
        Authors
      </h2>
      <BatchList kind="authors" rows={authors} />
    </SectionShell>
  )
}
