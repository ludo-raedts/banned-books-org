// ISR: regenerate every hour. The page only shows aggregate counts (11 reason
// rows × distinct slug counts from ban_reason_links). Previously force-dynamic
// → paginated read of ~6500 ban_reason_links rows on every visit (~325 KB
// egress per visitor). Hourly revalidation collapses that to one read per
// hour shared across all visitors and crawlers.
export const revalidate = 3600

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { reasonLabel, reasonIcon } from '@/components/reason-badge'

export async function generateMetadata(): Promise<Metadata> {
  const { count } = await adminClient().from('reasons').select('*', { count: 'exact', head: true })
  const n = count ?? 0
  return {
    title: `Why Books Are Banned — ${n} Documented Reasons | Banned Books`,
    description: 'Explore the most common reasons books are banned: political content, sexual themes, LGBTQ+ representation, religious offence, and more.',
    alternates: { canonical: '/reasons' },
  }
}

const REASON_COLORS: Record<string, string> = {
  lgbtq:     'bg-pink-100 text-pink-700 border-pink-200',
  political: 'bg-blue-100 text-blue-700 border-blue-200',
  religious: 'bg-amber-100 text-amber-700 border-amber-200',
  sexual:    'bg-red-100 text-red-700 border-red-200',
  violence:  'bg-orange-100 text-orange-700 border-orange-200',
  racial:    'bg-purple-100 text-purple-700 border-purple-200',
  drugs:     'bg-green-100 text-green-700 border-green-200',
  obscenity: 'bg-rose-100 text-rose-700 border-rose-200',
  moral:     'bg-teal-100 text-teal-700 border-teal-200',
  language:  'bg-indigo-100 text-indigo-700 border-indigo-200',
  other:     'bg-gray-100 text-gray-600 border-gray-200',
}

const REASON_DESCRIPTIONS: Record<string, string> = {
  lgbtq: 'Books featuring LGBTQ+ characters, relationships, or themes have become the single most targeted category in American schools since 2020. Internationally, such books face outright government bans in countries where homosexuality is criminalized.',
  political: 'Political censorship is the oldest form of book banning — from Socrates\'s death sentence to Solzhenitsyn\'s labour camps. Works critical of governments, documenting atrocities, or promoting opposition ideologies have been suppressed by regimes across the political spectrum.',
  religious: 'Religious censorship — including blasphemy laws, ecclesiastical bans, and offence-to-faith prosecutions — has restricted literary expression for centuries. The Catholic Church\'s Index Librorum Prohibitorum ran from 1559 to 1966 and included most of the Enlightenment; the 1989 fatwa against Salman Rushdie made The Satanic Verses the defining case of the modern era. Blasphemy remains a criminal offence in over 70 countries.',
  sexual: 'Sexual content was the dominant censorship category throughout the 19th and 20th centuries. Flaubert, Lawrence, Miller, Nabokov, and Burroughs all faced prosecution for novels that are now considered literary classics.',
  violence: 'Depictions of violence — particularly in books aimed at young readers — are a frequent target of school board challenges in the United States. Internationally, books that document atrocities committed by governments face suppression for political rather than moral reasons.',
  racial: 'Books that address race honestly have been challenged both for using racial slurs (in works like Huckleberry Finn) and for challenging racial hierarchies (in works by Black authors). The US school ban wave of the 2020s has a strong racial dimension.',
  drugs: 'Depictions of drug use, especially in books marketed to young adults, face regular challenges. Burroughs\'s Naked Lunch — prosecuted in multiple countries — remains the most famous example of this category.',
  obscenity: 'Obscenity as a legal category has been used to prosecute books from the Victorian era through the 20th century. The Obscene Publications Act (1857) in Britain and the Comstock Act (1873) in the US gave authorities broad powers to seize and destroy publications.',
  moral: 'Broad moral grounds have been invoked to ban books that don\'t fit neatly into other categories — often targeting authors who challenge prevailing social norms around class, gender, or family.',
  language: 'Language bans have targeted books written in minority or indigenous languages as part of broader cultural suppression campaigns. The Russian Empire\'s 1863 Ems Decree banned Ukrainian-language publications; Spain\'s Franco regime suppressed Catalan, Basque, and Galician literature.',
  other: 'Some bans defy easy categorization, targeting books for defamation, national security grounds, or simply because of who wrote them.',
}

export default async function ReasonsPage() {
  const supabase = adminClient()

  // Aggregate per-reason totals from the pre-built materialized view rather
  // than paginating ban_reason_links (~6500 rows, ~325 KB egress) on every
  // revalidation. mv_country_reason_counts is keyed on (country_code,
  // reason_slug) so summing total_bans across countries reproduces the same
  // headline number for ~990 rows (~15 KB). Refreshed by the hourly
  // refresh_all_materialized_views cron.
  const reasonCounts = new Map<string, number>()
  {
    const { data } = await supabase
      .from('mv_country_reason_counts')
      .select('reason_slug, total_bans')
    for (const row of (data ?? []) as Array<{ reason_slug: string; total_bans: number }>) {
      reasonCounts.set(row.reason_slug, (reasonCounts.get(row.reason_slug) ?? 0) + row.total_bans)
    }
  }

  const totalReasonBans = [...reasonCounts.values()].reduce((a, b) => a + b, 0)

  const reasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slug, count]) => {
      const raw = (count / totalReasonBans) * 100
      const pct = raw > 0 && raw < 0.5 ? '<1' : raw.toFixed(0)
      return { slug, count, pct }
    })

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="bg-brand-light border-l-4 border-brand pl-6 pr-4 py-6 mb-10 rounded-r-xl">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Why Books Are Banned</h1>
        <p className="text-sm text-brand/70 mb-2">{reasons.length} documented reasons</p>
        <p className="text-gray-700 max-w-2xl leading-relaxed text-sm">
          Every ban has an official justification. The stated reason — obscenity, religious offence,
          political subversion — tells us what the authorities wanted to protect. The book itself
          tells us what they were afraid of.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {reasons.map(r => (
          <Link
            key={r.slug}
            href={`/reasons/${r.slug}`}
            className={`border rounded-xl p-5 transition-opacity hover:opacity-80 ${REASON_COLORS[r.slug] ?? REASON_COLORS.other}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-2xl" aria-hidden="true">{reasonIcon(r.slug)}</span>
                <h2 className="text-lg font-bold mt-1">{reasonLabel(r.slug)}</h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums text-brand">{r.count}</div>
                <div className="text-xs opacity-70">{r.pct}% of bans</div>
              </div>
            </div>
            <p className="text-xs leading-relaxed opacity-80 line-clamp-3">
              {REASON_DESCRIPTIONS[r.slug]}
            </p>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Note: a single ban can be recorded with multiple reasons. Percentages are calculated from the total number of reason assignments, not total bans.
      </p>
      <p className="mt-3 text-xs text-gray-400">
        <Link href="/top-100-banned-books" className="underline hover:text-gray-600 transition-colors">
          See the 100 most banned books →
        </Link>
      </p>
    </main>
  )
}
