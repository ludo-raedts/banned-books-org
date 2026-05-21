import Eyebrow from '@/components/section/Eyebrow'
import HeroSearch from './HeroSearch'

type Stat = { value: string; label: string }

export default function HeroSection({
  totalBooks,
  countryCount,
  totalBans,
}: {
  totalBooks: number
  countryCount: number
  totalBans: number
}) {
  const stats: Stat[] = [
    { value: totalBooks.toLocaleString('en'), label: 'Books documented' },
    { value: countryCount.toLocaleString('en'), label: 'Countries' },
    { value: totalBans.toLocaleString('en'), label: 'Bans recorded' },
    { value: '100%', label: 'Citation-backed' },
  ]

  return (
    <section className="pt-12 px-9 pb-10 bg-white">
      <div className="max-w-5xl mx-auto">
        <Eyebrow>An international archive of censored literature</Eyebrow>

        <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.03] text-gray-900">
          The world&apos;s books under censorship.
        </h1>

        <div className="max-w-[720px]">
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-black border-b border-neutral-200 py-4">
            {stats.map(s => (
              <div key={s.label}>
                <div className="not-italic font-serif text-3xl md:text-4xl font-semibold tracking-tight text-oxblood">
                  {s.value}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-600">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm md:text-base leading-relaxed text-gray-700">
            Banned, restricted, and challenged books — historical and contemporary, worldwide. Every entry traces back to a verifiable source.
          </p>

          <div className="mt-6">
            <HeroSearch bookCount={totalBooks} />
          </div>
        </div>
      </div>
    </section>
  )
}
