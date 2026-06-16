import AdminBackLink from '@/components/admin-back-link'
import { pickDailyBook, buildPost } from '@/lib/bluesky-post'
import { getRecentPosts } from '@/lib/bluesky'
import { Send, Clock, CheckCircle, XCircle, ExternalLink } from 'lucide-react'

// Live view — always fresh: today's generated post + the account's real feed.
export const dynamic = 'force-dynamic'

const cardCls = 'border border-gray-200 rounded-xl p-6 flex flex-col gap-4 bg-white'

const HANDLE = process.env.BLUESKY_HANDLE ?? 'banned-books.org'
const PROFILE_URL = `https://bsky.app/profile/${HANDLE}`

function fmt(iso: string | null): string {
  if (!iso) return '—'
  // Stable, locale-independent rendering (no Date.now needed).
  return iso.replace('T', ' ').slice(0, 16) + ' UTC'
}

export default async function BlueskyAdminPage() {
  const enabled = process.env.BLUESKY_POST_ENABLED === 'true'

  let preview: { text: string; graphemes: number; coverUrl: string | null; cardTitle: string; cardDesc: string } | null = null
  let previewError: string | null = null
  try {
    const book = await pickDailyBook()
    if (book) {
      const built = buildPost(book)
      preview = {
        text: built.text,
        graphemes: Array.from(built.text).length,
        coverUrl: built.card.coverUrl,
        cardTitle: built.card.title,
        cardDesc: built.card.description,
      }
    } else {
      previewError = 'No eligible book found for today.'
    }
  } catch (e) {
    previewError = e instanceof Error ? e.message : 'Failed to build preview.'
  }

  const recent = await getRecentPosts(HANDLE, 20)

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
            <a href="/admin" className="hover:text-gray-600">Admin</a> / Bluesky
          </p>
          <h1 className="text-2xl font-bold">Bluesky — banned book of the day</h1>
        </div>
        <AdminBackLink href="/admin" label="Admin dashboard" />
      </div>

      <div className="flex flex-col gap-6">
        {/* ── Status ─────────────────────────────────────────────── */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-gray-400 shrink-0" />
            <h2 className="font-semibold text-gray-900">Status</h2>
          </div>
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-gray-500">Account</dt>
            <dd>
              <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="font-mono text-brand hover:underline inline-flex items-center gap-1">
                @{HANDLE} <ExternalLink className="w-3 h-3" />
              </a>
            </dd>
            <dt className="text-gray-500">Posting</dt>
            <dd>
              {enabled ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium"><CheckCircle className="w-4 h-4" /> Live (auto-posts daily)</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium"><XCircle className="w-4 h-4" /> Dry-run (set BLUESKY_POST_ENABLED=true to go live)</span>
              )}
            </dd>
            <dt className="text-gray-500">Schedule</dt>
            <dd className="inline-flex items-center gap-1.5 text-gray-700"><Clock className="w-4 h-4 text-gray-400" /> Daily at 14:00 UTC</dd>
          </dl>
        </div>

        {/* ── Today's generated post ─────────────────────────────── */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Today&apos;s post</h2>
            {preview && <span className="text-xs text-gray-400">{preview.graphemes} / 300 characters</span>}
          </div>
          {previewError ? (
            <p className="text-sm text-red-600">{previewError}</p>
          ) : preview ? (
            <div className="flex flex-col gap-3">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 bg-gray-50 rounded-lg p-4 border border-gray-100">{preview.text}</pre>
              <div className="flex gap-3 border border-gray-200 rounded-lg overflow-hidden max-w-md">
                {preview.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.coverUrl} alt="" className="w-20 h-28 object-cover shrink-0" />
                )}
                <div className="p-3 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{preview.cardTitle}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{preview.cardDesc}</p>
                  <p className="text-[11px] text-gray-400 mt-1">www.banned-books.org</p>
                </div>
              </div>
              <p className="text-xs text-gray-400">{enabled ? 'This is what posts (or posted) today.' : 'Preview only — posting is off.'}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Loading…</p>
          )}
        </div>

        {/* ── Recent posts (live from the account) ───────────────── */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent posts</h2>
            <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline inline-flex items-center gap-1">View on Bluesky <ExternalLink className="w-3 h-3" /></a>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500">No posts yet (or the feed could not be reached).</p>
          ) : (
            <ul className="flex flex-col divide-y divide-gray-100">
              {recent.map(p => (
                <li key={p.uri} className="py-3 flex gap-3">
                  {p.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumb} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 line-clamp-3 whitespace-pre-wrap">{p.text}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                      <span>{fmt(p.createdAt)}</span>
                      <a href={p.webUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-1">open <ExternalLink className="w-3 h-3" /></a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
