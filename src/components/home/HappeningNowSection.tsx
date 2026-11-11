import Link from '@/components/link'
import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
import { normalizeNewsDisplay, TranslatedBadge } from '@/lib/news-display'
import Eyebrow from '@/components/section/Eyebrow'
import { publishedEssays } from '@/lib/essays-data'

type NewsRow = {
  id: number
  title: string
  headline: string | null
  source_name: string
  published_at: string | null
  source_language: string | null
}

function formatNewsDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// The news column of the homepage's two-column top band (UX review
// 2026-11-11): three headlines with source and date, a link to all news and one
// clearly marked featured story. The longer summaries stay on /news, so current
// events are visible without this column asking for as much attention as the
// book beside it. On a phone it sits under the book of the day, as text lines.
export default async function HappeningNowSection() {
  const timer = newTimer('home:happening-now')
  const supabase = adminClient()

  const { data } = await timer.wrap('news_items', () =>
    supabase
      .from('news_items')
      .select('id, title, headline, source_name, published_at, source_language')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3),
  )
  timer.end()

  const items = (data ?? []) as NewsRow[]
  const latestEssay = publishedEssays()[0]
  if (items.length === 0 && !latestEssay) return null
  const currentYear = new Date().getUTCFullYear()

  return (
    <div className="lg:border-l lg:border-neutral-200 lg:pl-8">
      <Eyebrow>Happening now</Eyebrow>
      <h2 className="font-serif text-xl md:text-2xl font-semibold tracking-tight text-gray-900">
        Book bans are not history.
      </h2>

      <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
        {items.map(item => {
          const { sourceName } = normalizeNewsDisplay(item.title, item.source_name)
          return (
            <li key={item.id}>
              <Link href="/news" className="group block py-3">
                <h3 className="font-serif text-[15px] font-semibold leading-snug text-gray-900 group-hover:text-oxblood transition-colors line-clamp-3">
                  {item.headline ?? item.title}
                </h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-600">
                  <span>
                    {sourceName}
                    {item.published_at && <span> · {formatNewsDate(item.published_at)}</span>}
                  </span>
                  <TranslatedBadge code={item.source_language} size="compact" />
                </p>
              </Link>
            </li>
          )
        })}
      </ul>

      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Link href="/news" className="font-medium text-oxblood underline underline-offset-2 decoration-oxblood/30 hover:decoration-oxblood">
          All news →
        </Link>
        <Link href={`/banned-books/${currentYear}`} className="text-neutral-700 hover:text-oxblood hover:underline">
          Banned books {currentYear}
        </Link>
      </p>

      {latestEssay && (
        <Link
          href={latestEssay.href}
          className="hover-lift-card group mt-5 block bg-brand-light/30 border-t border-r border-b border-neutral-200 rounded-r-sm p-4"
          style={{ borderLeft: '2px solid var(--color-brand)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand mb-1.5">
            Featured story · {latestEssay.readingTimeMin} min read
          </p>
          <h3 className="font-serif text-[15px] font-semibold leading-snug text-gray-900 group-hover:text-brand transition-colors">
            {latestEssay.title}
          </h3>
          <p className="mt-1.5 text-xs text-gray-700 leading-snug line-clamp-3">{latestEssay.dek}</p>
          <p className="mt-2 text-[11px] text-gray-500">
            banned-books.org · {formatNewsDate(latestEssay.publishedAt)}
          </p>
        </Link>
      )}
    </div>
  )
}
