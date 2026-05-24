import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { newTimer } from '@/lib/timing'
import { normalizeNewsDisplay, TranslatedBadge } from '@/lib/news-display'
import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import { publishedEssays } from '@/lib/essays-data'

type NewsRow = {
  id: number
  title: string
  headline: string | null
  source_name: string
  published_at: string | null
  summary: string
  source_language: string | null
}

function formatNewsDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function HappeningNowSection() {
  const timer = newTimer('home:happening-now')
  const supabase = adminClient()

  const { data } = await timer.wrap('news_items', () =>
    supabase
      .from('news_items')
      .select('id, title, headline, source_name, published_at, summary, source_language')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3),
  )
  timer.end()

  const items = (data ?? []) as NewsRow[]
  // Latest essay sits beside the 3 news items as a 4th card. Editorial slot
  // so visitors landing on the homepage see we publish long-form, not only
  // news passthrough.
  const latestEssay = publishedEssays()[0]
  if (items.length === 0 && !latestEssay) return null

  return (
    <SectionShell tone="white" eyebrow="Happening now">
      <SectionHeader
        title="Book bans are not history."
        subtitle="The latest from the wires, plus our editorial work."
        viewAllHref="/news"
        viewAllLabel="All news"
        accent="black"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(item => {
          const { sourceName } = normalizeNewsDisplay(item.title, item.source_name)
          return (
            <Link
              key={item.id}
              href="/news"
              className="hover-lift-card group block bg-white border-t border-r border-b border-neutral-200 rounded-r-sm p-4"
              style={{ borderLeft: '2px solid var(--color-oxblood)' }}
            >
              {item.headline && (
                <h3 className="font-serif text-[13px] font-semibold leading-snug text-gray-900 line-clamp-2 mb-1.5 group-hover:text-oxblood transition-colors">
                  {item.headline}
                </h3>
              )}
              <p className="text-xs text-gray-700 leading-snug line-clamp-2">
                {item.summary}
              </p>
              <p className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5 flex-wrap">
                <span>
                  {sourceName}
                  {item.published_at && <span> · {formatNewsDate(item.published_at)}</span>}
                </span>
                <TranslatedBadge code={item.source_language} size="compact" />
              </p>
            </Link>
          )
        })}

        {latestEssay && (
          <Link
            key={latestEssay.slug}
            href={latestEssay.href}
            className="hover-lift-card group block bg-brand-light/30 border-t border-r border-b border-neutral-200 rounded-r-sm p-4"
            style={{ borderLeft: '2px solid var(--color-brand)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand mb-1.5">
              Essay · {latestEssay.readingTimeMin} min read
            </p>
            <h3 className="font-serif text-[13px] font-semibold leading-snug text-gray-900 line-clamp-2 mb-1.5 group-hover:text-brand transition-colors">
              {latestEssay.title}
            </h3>
            <p className="text-xs text-gray-700 leading-snug line-clamp-2">
              {latestEssay.dek}
            </p>
            <p className="mt-2 text-[11px] text-gray-500">
              banned-books.org · {formatNewsDate(latestEssay.publishedAt)}
            </p>
          </Link>
        )}
      </div>
    </SectionShell>
  )
}
