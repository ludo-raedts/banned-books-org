import SectionShell from '@/components/section/SectionShell'
import SectionHeader from '@/components/section/SectionHeader'
import { fetchBookBanCourtCases, COURTLISTENER_SEARCH_URL } from '@/lib/courtlistener'

function formatDate(d: string | null): string | null {
  if (!d) return null
  const dt = new Date(`${d}T00:00:00Z`)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

// US-only section: recent published court opinions in book-ban litigation,
// pulled live from CourtListener (Free Law Project). Async server component —
// renders nothing if the feed is empty or unreachable, so the page never
// depends on the external API.
export default async function UsCourtCasesSection() {
  const cases = await fetchBookBanCourtCases(6)
  if (cases.length === 0) return null

  return (
    <SectionShell tone="white" eyebrow="In the courts">
      <SectionHeader
        title="Book bans in U.S. litigation"
        subtitle="Decided court rulings on book removals and school-library challenges, drawn live from CourtListener. Most cases are still pending — these are the ones courts have ruled on."
        accent="oxblood"
      />
      <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
        {cases.map((c) => {
          const date = formatDate(c.dateFiled)
          return (
            <li key={c.url}>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-0.5 py-3.5 hover:bg-white/60 transition-colors -mx-2 px-2"
              >
                <span className="font-serif text-base md:text-lg font-medium text-gray-900 group-hover:text-oxblood transition-colors leading-snug">
                  {c.caseName}
                </span>
                <span className="text-xs uppercase tracking-wider text-neutral-500">
                  {c.court}
                  {date ? ` · ${date}` : ''}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-xs text-neutral-500 leading-relaxed">
        Source:{' '}
        <a
          href={COURTLISTENER_SEARCH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-oxblood"
        >
          CourtListener
        </a>{' '}
        by the Free Law Project. Case selection mirrors the American Library
        Association&rsquo;s censorship-litigation tracking. These are court
        proceedings about book bans, not catalogue entries.
      </p>
    </SectionShell>
  )
}
