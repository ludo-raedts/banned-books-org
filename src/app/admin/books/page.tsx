import Link from 'next/link'
import Image from 'next/image'
import { adminClient } from '@/lib/supabase'
import AdminBackLink from '@/components/admin-back-link'
import ListSearch from '../list-search'

export const dynamic = 'force-dynamic'

// Server-side searched + paginated list over the admin_books_list view
// (migration 20260807100000). The previous version fetched the entire
// catalogue (~20k rows with author join, 5-8 MB) on every page view and
// filtered in the browser.

const PAGE_SIZE = 50

type Filter = 'all' | 'unclassified' | 'classified' | 'context' | 'extended'
const FILTERS: Filter[] = ['all', 'unclassified', 'classified', 'context', 'extended']

type Row = {
  id: number
  slug: string
  title: string
  cover_url: string | null
  first_published_year: number | null
  ai_drafted: boolean | null
  warning_level: 'none' | 'context' | 'extended'
  has_rationale: boolean
  author: string
}

// PostgREST .or() patterns break on commas/parens; * is the ilike wildcard.
function toPattern(q: string): string {
  return `*${q.replace(/[,()*%]/g, ' ').trim()}*`
}

function listHref(q: string, filter: Filter, page: number): string {
  const p = new URLSearchParams()
  if (q) p.set('q', q)
  if (filter !== 'all') p.set('filter', filter)
  if (page > 0) p.set('page', String(page + 1))
  const s = p.toString()
  return s ? `/admin/books?${s}` : '/admin/books'
}

export default async function AdminBooksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const filter: Filter = FILTERS.includes(sp.filter as Filter) ? (sp.filter as Filter) : 'all'
  const page = Math.max(0, (parseInt(sp.page ?? '1', 10) || 1) - 1)

  const sb = adminClient()

  let query = sb
    .from('admin_books_list')
    .select('*', { count: 'exact' })

  if (filter === 'unclassified') query = query.eq('warning_level', 'none').eq('has_rationale', false)
  if (filter === 'classified') query = query.or('warning_level.neq.none,has_rationale.is.true')
  if (filter === 'context' || filter === 'extended') query = query.eq('warning_level', filter)
  if (q) {
    const pat = toPattern(q)
    query = query.or(`title.ilike.${pat},author.ilike.${pat}`)
  }

  const [{ data, count, error }, chipCounts] = await Promise.all([
    query.order('title').range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
    Promise.all([
      sb.from('books').select('*', { count: 'exact', head: true }),
      sb.from('books').select('*', { count: 'exact', head: true }).eq('warning_level', 'none').is('inclusion_rationale', null),
      sb.from('books').select('*', { count: 'exact', head: true }).eq('warning_level', 'context'),
      sb.from('books').select('*', { count: 'exact', head: true }).eq('warning_level', 'extended'),
    ]),
  ])

  const rows = (data ?? []) as Row[]
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const [{ count: allCount }, { count: unclassifiedCount }, { count: contextCount }, { count: extendedCount }] = chipCounts
  const chips: Array<[Filter, string]> = [
    ['all', `All (${(allCount ?? 0).toLocaleString('en')})`],
    ['unclassified', `Unclassified (${(unclassifiedCount ?? 0).toLocaleString('en')})`],
    ['classified', `Classified (${((allCount ?? 0) - (unclassifiedCount ?? 0)).toLocaleString('en')})`],
    ['context', `Context (${(contextCount ?? 0).toLocaleString('en')})`],
    ['extended', `Extended (${(extendedCount ?? 0).toLocaleString('en')})`],
  ]

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Books</h1>
          <p className="text-sm text-gray-500 mt-1">{(allCount ?? 0).toLocaleString('en')} books in catalogue</p>
        </div>
        <AdminBackLink href="/admin" label="Admin dashboard" />
      </div>

      <ListSearch placeholder="Search by title or author…" />

      <div className="flex flex-wrap gap-1.5 mb-4 text-xs">
        {chips.map(([key, label]) => (
          <Link
            key={key}
            href={listHref(q, key, 0)}
            className={`px-2.5 py-1.5 rounded-full border transition-colors ${
              filter === key
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            {label}
          </Link>
        ))}
        <span className="ml-auto text-gray-400 self-center hidden sm:inline">
          Classification is editorial — not part of data quality.
        </span>
      </div>

      {error ? (
        <p className="text-sm text-red-600">Failed to load books: {error.message}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">No books match your search.</p>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-2">
            {total.toLocaleString('en')} result{total !== 1 ? 's' : ''}
            {totalPages > 1 && ` — page ${page + 1} of ${totalPages}`}
          </p>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Author</th>
                  <th className="px-3 py-2 hidden sm:table-cell w-16 text-right">Year</th>
                  <th className="px-3 py-2 hidden md:table-cell w-24">Class.</th>
                  <th className="px-3 py-2 w-16 text-right">AI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((book, i) => (
                  <tr
                    key={book.id}
                    className={`border-b last:border-0 border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                  >
                    <td className="px-3 py-2">
                      <Link href={`/admin/books/${book.slug}`} tabIndex={-1}>
                        {book.cover_url ? (
                          <Image
                            src={book.cover_url}
                            alt=""
                            width={27}
                            height={40}
                            className="rounded object-cover w-[27px] h-[40px]"
                            unoptimized
                          />
                        ) : (
                          <div className="w-[27px] h-[40px] rounded bg-gray-200" />
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-medium leading-snug">
                      <Link href={`/admin/books/${book.slug}`} className="hover:underline">
                        {book.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-gray-500">
                      {book.author || '—'}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-gray-500 text-right tabular-nums">
                      {book.first_published_year ?? '—'}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      {book.warning_level === 'extended' ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">extended</span>
                      ) : book.warning_level === 'context' ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">context</span>
                      ) : book.has_rationale ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700">none</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {book.ai_drafted && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">AI</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              {page > 0 ? (
                <Link href={listHref(q, filter, page - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors">
                  ← Prev
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm opacity-40">← Prev</span>
              )}
              <span className="text-sm text-gray-500">
                {page + 1} / {totalPages}
              </span>
              {page < totalPages - 1 ? (
                <Link href={listHref(q, filter, page + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors">
                  Next →
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm opacity-40">Next →</span>
              )}
            </div>
          )}
        </>
      )}
    </main>
  )
}
