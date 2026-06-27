import AdminBackLink from '@/components/admin-back-link'
import { pickForDates, buildPost, listExcludedBooks, type DailyBook } from '@/lib/bluesky-post'
import { getRecentPosts } from '@/lib/bluesky'
import UpcomingManager from './upcoming-manager'
import { Clock, CheckCircle, XCircle, ExternalLink, Heart, Repeat2, MessageCircle, Megaphone, Rss, Share2, Code2, Image as ImageIcon } from 'lucide-react'

// Live view — always fresh: upcoming generated posts + the account's real feed.
export const dynamic = 'force-dynamic'

const cardCls = 'border border-gray-200 rounded-xl p-6 flex flex-col gap-4 bg-white'

const HANDLE = process.env.BLUESKY_HANDLE ?? 'banned-books.org'
const PROFILE_URL = `https://bsky.app/profile/${HANDLE}`
const UPCOMING_DAYS = 7

const SITE = 'https://www.banned-books.org'
// The one daily pick fans out to every channel below. Bluesky is posted natively
// by our cron; Instagram/Facebook/LinkedIn are auto-posted by Make.com, which
// polls our RSS feed; the rest are pull surfaces anyone can embed or poll.
const SOCIAL = {
  instagram: 'https://www.instagram.com/bannedbooksarchive',
  facebook: 'https://www.facebook.com/bannedbooks.org',
  linkedin: 'https://www.linkedin.com/company/banned-books-org',
}
const MAKE_DASHBOARD = 'https://eu1.make.com/organization/8159588/dashboard'
const FEED_URL = `${SITE}/book-of-the-day/feed.xml`
const EMBED_URL = `${SITE}/embed/book-of-the-day`
const SHARE_URL = `${SITE}/share`
const BADGE_URL = `${SITE}/book-of-the-day/badge.svg`

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return iso.replace('T', ' ').slice(0, 16) + ' UTC'
}

/** 14:00 UTC rendered in Amsterdam wall-clock (auto CET/CEST). */
function amsterdamPostTime(): string {
  const d = new Date(`${new Date().toISOString().slice(0, 10)}T14:00:00Z`)
  return new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(d)
}

function dayLabel(ymd: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${ymd}T00:00:00Z`))
}

function whyLine(book: DailyBook): string {
  return buildPost(book).text.split('\n').find(l => l.startsWith('Banned')) ?? ''
}

export default async function BlueskyAdminPage() {
  const enabled = process.env.BLUESKY_POST_ENABLED === 'true'

  const todayMs = Date.now()
  const dates = Array.from({ length: UPCOMING_DAYS }, (_, i) => new Date(todayMs + i * 86_400_000).toISOString().slice(0, 10))

  let books: (DailyBook | null)[] = []
  let pickError: string | null = null
  try {
    books = await pickForDates(dates)
  } catch (e) {
    pickError = e instanceof Error ? e.message : 'Failed to build posts.'
  }
  const today = books[0]
  const todayPost = today ? buildPost(today) : null
  const upcoming = dates.slice(1).map((ymd, i) => {
    const b = books[i + 1] ?? null
    return { ymd, label: dayLabel(ymd), book: b ? { id: b.id, title: b.title, author: b.author, why: whyLine(b), birthday: b.birthday ?? null } : null }
  })

  const [recent, excluded] = await Promise.all([getRecentPosts(HANDLE, 20), listExcludedBooks()])

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
            <a href="/admin" className="hover:text-gray-600">Admin</a> / Book of the day
          </p>
          <h1 className="text-2xl font-bold">Banned book of the day</h1>
          <p className="text-sm text-gray-500 mt-1">One daily pick, broadcast across every channel below.</p>
        </div>
        <AdminBackLink href="/admin" label="Admin dashboard" />
      </div>

      <div className="flex flex-col gap-6">
        {/* ── Distribution channels ──────────────────────────────── */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-gray-400 shrink-0" />
            <h2 className="font-semibold text-gray-900">Distribution</h2>
            <span className="text-xs text-gray-400">one daily pick · many channels</span>
          </div>
          <p className="text-sm text-gray-600">
            Every channel broadcasts the <strong>same</strong> banned book of the day (the frozen pick, with birthday overrides).
            Skipping or curating a day here changes all of them at once.
          </p>

          {/* Auto-posted */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Auto-posted</p>

            {/* Bluesky — native cron */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium text-gray-900 w-24 shrink-0">Bluesky</span>
              {enabled ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium"><CheckCircle className="w-4 h-4" /> Live</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium"><XCircle className="w-4 h-4" /> Dry-run</span>
              )}
              <span className="inline-flex items-center gap-1 text-gray-500"><Clock className="w-3.5 h-3.5" /> 14:00 UTC ({amsterdamPostTime()} AMS)</span>
              <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-1">@{HANDLE} <ExternalLink className="w-3 h-3" /></a>
              <span className="text-[11px] text-gray-400 basis-full">Native daily cron post.{enabled ? '' : ' Set BLUESKY_POST_ENABLED=true to go live.'}</span>
            </div>

            {/* Make.com → socials, via the RSS feed */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium text-gray-900 w-24 shrink-0">Make.com</span>
              <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-1">Instagram <ExternalLink className="w-3 h-3" /></a>
              <a href={SOCIAL.facebook} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-1">Facebook <ExternalLink className="w-3 h-3" /></a>
              <a href={SOCIAL.linkedin} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-1">LinkedIn <ExternalLink className="w-3 h-3" /></a>
              <a href={MAKE_DASHBOARD} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-brand inline-flex items-center gap-1">Make dashboard <ExternalLink className="w-3 h-3" /></a>
              <span className="text-[11px] text-gray-400 basis-full">Make polls the RSS feed and posts to these three. Scheduling &amp; on/off live in Make, not here.</span>
            </div>
          </div>

          {/* Pull surfaces */}
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Feeds &amp; widgets (always live)</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              <a href={FEED_URL} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-1"><Rss className="w-3.5 h-3.5" /> RSS feed</a>
              <a href={EMBED_URL} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-1"><Code2 className="w-3.5 h-3.5" /> Embed widget</a>
              <a href={SHARE_URL} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /> Share hub</a>
              <a href={BADGE_URL} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> Badge image</a>
            </div>
            <p className="text-[11px] text-gray-400">The RSS feed is the source of truth other platforms poll (Make, Slack, Discord, …).</p>
          </div>
        </div>

        {/* ── Today's generated post ─────────────────────────────── */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Today&apos;s post <span className="font-normal text-gray-400 text-sm">— Bluesky</span></h2>
            {todayPost && <span className="text-xs text-gray-400">{Array.from(todayPost.text).length} / 300 characters</span>}
          </div>
          {pickError ? (
            <p className="text-sm text-red-600">{pickError}</p>
          ) : todayPost ? (
            <div className="flex flex-col gap-3">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 bg-gray-50 rounded-lg p-4 border border-gray-100">{todayPost.text}</pre>
              <div className="flex gap-3 border border-gray-200 rounded-lg overflow-hidden max-w-md">
                {todayPost.card.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={todayPost.card.coverUrl} alt="" className="w-20 h-28 object-cover shrink-0" />
                )}
                <div className="p-3 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{todayPost.card.title}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{todayPost.card.description}</p>
                  <p className="text-[11px] text-gray-400 mt-1">www.banned-books.org</p>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                {enabled ? 'This is the Bluesky post for today.' : 'Preview only — Bluesky posting is off.'}{' '}
                Instagram/Facebook/LinkedIn render from the{' '}
                <a href={FEED_URL} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">RSS feed</a>{' · '}
                <a href={EMBED_URL} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">embed preview</a>.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No eligible book found for today.</p>
          )}
        </div>

        {/* ── Upcoming queue + exclusion management ──────────────── */}
        <UpcomingManager upcoming={upcoming} excluded={excluded} />

        {/* ── Recent posts (live from the account) ───────────────── */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent posts <span className="font-normal text-gray-400 text-sm">— Bluesky</span></h2>
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
                      <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" /> {p.likes}</span>
                      <span className="inline-flex items-center gap-1"><Repeat2 className="w-3 h-3" /> {p.reposts}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {p.replies}</span>
                      <a href={p.webUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-1">open <ExternalLink className="w-3 h-3" /></a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-gray-400">Likes · reposts · replies come from Bluesky. Link clicks aren&apos;t exposed by the API — they show up in Vercel Web Analytics via the post&apos;s <code>utm_source=bluesky</code> tag.</p>
        </div>
      </div>
    </main>
  )
}
