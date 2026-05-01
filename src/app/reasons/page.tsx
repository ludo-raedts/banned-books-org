export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase'
import { reasonLabel, reasonIcon } from '@/components/reason-badge'

export const metadata: Metadata = {
  title: 'Reasons — Why Books Are Banned',
  description: 'Explore the most common reasons books are banned: political content, sexual themes, LGBTQ+ representation, religious blasphemy, and more.',
  alternates: { canonical: '/reasons' },
}

const REASON_COLORS: Record<string, string> = {
  lgbtq:     'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
  political: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  religious: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  sexual:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  violence:  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  racial:    'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  drugs:     'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  obscenity: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  blasphemy: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  moral:     'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  language:  'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  other:     'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700',
}

const REASON_DESCRIPTIONS: Record<string, string> = {
  lgbtq: 'Books featuring LGBTQ+ characters, relationships, or themes have become the single most targeted category in American schools since 2020. Internationally, such books face outright government bans in countries where homosexuality is criminalized.',
  political: 'Political censorship is the oldest form of book banning — from Socrates\'s death sentence to Solzhenitsyn\'s labour camps. Works critical of governments, documenting atrocities, or promoting opposition ideologies have been suppressed by regimes across the political spectrum.',
  religious: 'Blasphemy laws and religious censorship have restricted literary expression for centuries. The Catholic Church\'s Index Librorum Prohibitorum ran from 1559 to 1966 and included most of the Enlightenment. In parts of the Middle East and South Asia, blasphemy accusations can still carry the death penalty.',
  sexual: 'Sexual content was the dominant censorship category throughout the 19th and 20th centuries. Flaubert, Lawrence, Miller, Nabokov, and Burroughs all faced prosecution for novels that are now considered literary classics.',
  violence: 'Depictions of violence — particularly in books aimed at young readers — are a frequent target of school board challenges in the United States. Internationally, books that document atrocities committed by governments face suppression for political rather than moral reasons.',
  racial: 'Books that address race honestly have been challenged both for using racial slurs (in works like Huckleberry Finn) and for challenging racial hierarchies (in works by Black authors). The US school ban wave of the 2020s has a strong racial dimension.',
  drugs: 'Depictions of drug use, especially in books marketed to young adults, face regular challenges. Burroughs\'s Naked Lunch — prosecuted in multiple countries — remains the most famous example of this category.',
  obscenity: 'Obscenity as a legal category has been used to prosecute books from the Victorian era through the 20th century. The Obscene Publications Act (1857) in Britain and the Comstock Act (1873) in the US gave authorities broad powers to seize and destroy publications.',
  blasphemy: 'Blasphemy bans target works deemed offensive to religious belief. The most internationally prominent modern case is the fatwa issued by Ayatollah Khomeini against Salman Rushdie in 1989, which forced Rushdie into hiding for nearly a decade.',
  moral: 'Broad moral grounds have been invoked to ban books that don\'t fit neatly into other categories — often targeting authors who challenge prevailing social norms around class, gender, or family.',
  language: 'Language bans have targeted books written in minority or indigenous languages as part of broader cultural suppression campaigns. The Russian Empire\'s 1863 Ems Decree banned Ukrainian-language publications; Spain\'s Franco regime suppressed Catalan, Basque, and Galician literature.',
  other: 'Some bans defy easy categorization, targeting books for defamation, national security grounds, or simply because of who wrote them.',
}

export default async function ReasonsPage() {
  const supabase = adminClient()

  const { data: bansRaw } = await supabase
    .from('bans')
    .select('id, ban_reason_links(reasons(slug))')

  const bans = (bansRaw ?? []) as unknown as Array<{
    id: number
    ban_reason_links: Array<{ reasons: { slug: string } | null }>
  }>

  const reasonCounts = new Map<string, number>()
  for (const ban of bans) {
    for (const link of ban.ban_reason_links) {
      const slug = link.reasons?.slug
      if (slug) reasonCounts.set(slug, (reasonCounts.get(slug) ?? 0) + 1)
    }
  }

  const totalReasonBans = [...reasonCounts.values()].reduce((a, b) => a + b, 0)

  const reasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slug, count]) => ({ slug, count, pct: ((count / totalReasonBans) * 100).toFixed(0) }))

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-3">Why Books Are Banned</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed text-sm">
          Every ban has an official justification. The stated reason — obscenity, blasphemy, political
          subversion — tells us what the authorities wanted to protect. The book itself tells us what
          they were afraid of.
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
                <div className="text-2xl font-bold tabular-nums">{r.count}</div>
                <div className="text-xs opacity-70">{r.pct}% of bans</div>
              </div>
            </div>
            <p className="text-xs leading-relaxed opacity-80 line-clamp-3">
              {REASON_DESCRIPTIONS[r.slug]}
            </p>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-xs text-gray-400 dark:text-gray-500">
        Note: a single ban can be recorded with multiple reasons. Percentages are calculated from the total number of reason assignments, not total bans.
      </p>
    </main>
  )
}
