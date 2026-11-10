// /registers — index of the large historical lists kept as a lean register.
import type { Metadata } from 'next'
import Link from '@/components/link'
import BreadcrumbJsonLd from '@/components/breadcrumb-jsonld'
import Eyebrow from '@/components/section/Eyebrow'
import { FRAMING_LABEL, getRegisterLists } from '@/lib/registers'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Official ban lists — full registers',
  description:
    'Complete transcriptions of very large historical ban lists — the Soviet-zone "Liste der auszusondernden Literatur" (1946–1953) and the 1877 Index of forbidden books — entry by entry, linked to the original source.',
  alternates: { canonical: '/registers' },
}

export default async function RegistersIndex() {
  const lists = await getRegisterLists()
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <BreadcrumbJsonLd items={[{ label: 'Home', href: '/' }, { label: 'Registers' }]} />
      <Eyebrow>Reference · Official lists</Eyebrow>
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight leading-tight text-gray-900">
        Full registers of official ban lists.
      </h1>
      <p className="mt-5 text-base leading-relaxed text-gray-700">
        Some historical ban lists run to tens of thousands of titles, most of them obscure pamphlets and
        manuals that nobody has written about since. Rather than give each a thin page, we keep these lists
        as registers: every entry as it was printed, alphabetically, with a link to the original source.
        Titles that are also in our main catalogue link to their book page.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        Register entries are counted separately and are not included in our banned-book totals.
      </p>

      <ul className="mt-10 space-y-4">
        {lists.map((l) => (
          <li key={l.slug}>
            <Link
              href={`/registers/${l.slug}`}
              className="group block rounded-sm border border-neutral-200 bg-white px-5 py-4 transition-colors hover:border-oxblood"
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                {FRAMING_LABEL[l.framing]} · {l.year_start}
                {l.year_end && l.year_end !== l.year_start ? `–${l.year_end}` : ''}
              </p>
              <p className="mt-1 font-serif text-lg font-medium text-gray-900 group-hover:text-oxblood">
                {l.title_en ?? l.title}
              </p>
              {l.title_en && <p className="text-sm italic text-neutral-500">{l.title}</p>}
              <p className="mt-2 text-sm text-neutral-600 tabular-nums">
                {l.entry_count.toLocaleString('en-US')} entries
                {l.matched_count > 0 && <> · {l.matched_count.toLocaleString('en-US')} linked to our catalogue</>}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
