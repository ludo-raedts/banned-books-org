import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import AdminBackLink from '@/components/admin-back-link'
import ListSearch from '../list-search'

export const dynamic = 'force-dynamic'

// Server-side searched + paginated list over the admin_authors_list view
// (migration 20260807100000). The previous version fetched all ~12.8k authors
// INCLUDING their longtext bios (10-20 MB) just to render a ✓/✗ column.

const PAGE_SIZE = 50

type Row = {
  id: number
  slug: string
  display_name: string
  has_bio: boolean
  has_photo: boolean
  birth_year: number | null
}

function listHref(q: string, page: number): string {
  const p = new URLSearchParams()
  if (q) p.set('q', q)
  if (page > 0) p.set('page', String(page + 1))
  const s = p.toString()
  return s ? `/admin/authors?${s}` : '/admin/authors'
}

function Mark({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-green-600" aria-label="yes">✓</span>
    : <span className="text-red-500" aria-label="no">✗</span>
}

export default async function AdminAuthorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const page = Math.max(0, (parseInt(sp.page ?? '1', 10) || 1) - 1)

  const sb = adminClient()

  let query = sb.from('admin_authors_list').select('*', { count: 'exact' })
  if (q) query = query.ilike('display_name', `%${q.replace(/[%_]/g, ' ')}%`)

  const [{ data, count, error }, { count: allCount }] = await Promise.all([
    query.order('display_name').range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
    sb.from('authors').select('*', { count: 'exact', head: true }),
  ])

  const rows = (data ?? []) as Row[]
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Authors</h1>
          <p className="text-sm text-gray-500 mt-1">{(allCount ?? 0).toLocaleString('en')} authors in catalogue</p>
        </div>
        <AdminBackLink href="/admin" label="Admin dashboard" />
      </div>

      <ListSearch placeholder="Search by name…" />

      {error ? (
        <p className="text-sm text-red-600">Failed to load authors: {error.message}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">No authors match your search.</p>
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
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2 hidden sm:table-cell w-16 text-center">Bio?</th>
                  <th className="px-3 py-2 hidden sm:table-cell w-16 text-center">Photo?</th>
                  <th className="px-3 py-2 hidden sm:table-cell w-16 text-right">Birth</th>
                  <th className="px-3 py-2 w-20 text-right">Edit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((author, i) => (
                  <tr
                    key={author.id}
                    className={`border-b last:border-0 border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                  >
                    <td className="px-3 py-2 font-medium leading-snug">
                      <Link href={`/admin/authors/${author.slug}`} className="hover:underline">
                        {author.display_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-center"><Mark ok={author.has_bio} /></td>
                    <td className="px-3 py-2 hidden sm:table-cell text-center"><Mark ok={author.has_photo} /></td>
                    <td className="px-3 py-2 hidden sm:table-cell text-gray-500 text-right tabular-nums">
                      {author.birth_year ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/admin/authors/${author.slug}`} className="text-gray-400 hover:text-gray-900 text-xs">
                        Edit →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              {page > 0 ? (
                <Link href={listHref(q, page - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors">
                  ← Prev
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm opacity-40">← Prev</span>
              )}
              <span className="text-sm text-gray-500">
                {page + 1} / {totalPages}
              </span>
              {page < totalPages - 1 ? (
                <Link href={listHref(q, page + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors">
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
